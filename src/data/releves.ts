import { asc, eq, getTableColumns, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, newId } from "../db/client";
import { acte, individu, lieu, releve, type Releve } from "../db/schema";
import { sansTrace, verifierVersion, versionDe } from "./version";

export async function relevesActe(acteId: string) {
  return db
    .select({
      ...getTableColumns(releve),
      individuNom: individu.nom,
      individuPrenoms: individu.prenoms,
    })
    .from(releve)
    .leftJoin(individu, eq(individu.id, releve.individuId))
    .where(eq(releve.acteId, acteId))
    .orderBy(asc(releve.ordre), asc(releve.creeLe));
}
export type ReleveActe = Awaited<ReturnType<typeof relevesActe>>[number];

const avecActe = () =>
  db
    .select({
      ...getTableColumns(releve),
      acteTitre: acte.titre,
      acteType: acte.type,
      acteNature: acte.nature,
      acteDate: acte.date,
      acteDateMin: acte.dateMin,
      acteDateMax: acte.dateMax,
      acteLieuId: acte.lieuId,
      acteLieuNom: lieu.nom,
      individuNom: individu.nom,
      individuPrenoms: individu.prenoms,
      individuSexe: individu.sexe,
    })
    .from(releve)
    .innerJoin(acte, eq(acte.id, releve.acteId))
    .leftJoin(lieu, eq(lieu.id, acte.lieuId))
    .leftJoin(individu, eq(individu.id, releve.individuId));

export const relevesIndividu = (individuId: string) =>
  avecActe().where(eq(releve.individuId, individuId)).orderBy(asc(acte.dateMin));

/** Relevés datés rattachés à un individu : les points de la frise chronologique. */
export const evenementsIndividus = () =>
  db
    .select({
      releveId: releve.id,
      individuId: releve.individuId,
      role: releve.role,
      acteId: acte.id,
      acteTitre: acte.titre,
      acteNature: acte.nature,
      acteDate: acte.date,
      acteDateMin: acte.dateMin,
      acteDateMax: acte.dateMax,
      naissanceMin: releve.naissanceMin,
      naissanceMax: releve.naissanceMax,
      mariageMin: releve.mariageMin,
      mariageMax: releve.mariageMax,
      decesMin: releve.decesMin,
      decesMax: releve.decesMax,
    })
    .from(releve)
    .innerJoin(acte, eq(acte.id, releve.acteId))
    .where(isNotNull(releve.individuId));
export type EvenementIndividu = Awaited<ReturnType<typeof evenementsIndividus>>[number];

/** Tous les relevés d'un ensemble d'actes (les autres personnes citées avec quelqu'un). */
export const relevesDesActes = async (acteIds: string[]) =>
  acteIds.length ? avecActe().where(inArray(releve.acteId, acteIds)).orderBy(asc(releve.ordre)) : [];

export const relevesNonRattaches = () => avecActe().where(isNull(releve.individuId)).orderBy(asc(releve.nom));
export type ReleveAvecActe = Awaited<ReturnType<typeof relevesNonRattaches>>[number];

export async function creerReleve(acteId: string) {
  const id = newId();
  const existants = await db.select({ id: releve.id }).from(releve).where(eq(releve.acteId, acteId));
  await db.insert(releve).values({ id, acteId, ordre: existants.length });
  return id;
}

export async function majReleve(id: string, patch: Partial<Releve>, version?: string | null) {
  await verifierVersion("releve", id, version);
  await db.update(releve).set(sansTrace(patch)).where(eq(releve.id, id));
  return versionDe("releve", id);
}

export const supprimerReleve = (id: string) => db.delete(releve).where(eq(releve.id, id));

export const rattacher = (releveId: string, individuId: string | null) =>
  db.update(releve).set({ individuId }).where(eq(releve.id, releveId));

/** Crée un individu pré-rempli à partir d'un relevé, et les relie. */
export async function creerIndividuDepuisReleve(r: Releve) {
  const id = newId();
  await db.batch([
    db.insert(individu).values({
      id,
      nom: r.nom || r.nomEcrit,
      prenoms: r.prenoms || r.prenomsEcrits,
      sexe: r.sexe,
      naissance: r.naissance,
      naissanceMin: r.naissanceMin,
      naissanceMax: r.naissanceMax,
      deces: r.deces,
      decesMin: r.decesMin,
      decesMax: r.decesMax,
      profession: r.profession,
    }),
    db.update(releve).set({ individuId: id }).where(eq(releve.id, r.id)),
  ]);
  return id;
}
