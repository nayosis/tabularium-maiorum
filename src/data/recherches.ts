import { asc, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db, newId } from "../db/client";
import { consultation, individu, lieu, source, tache, type Consultation, type Source, type Tache } from "../db/schema";
import { sansTrace, verifierVersion, versionDe } from "./version";

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Consultations avec leur source (titre, lieu, cote, lien). */
const consultationsDetaillees = () =>
  db
    .select({
      ...getTableColumns(consultation),
      sourceTitre: source.titre,
      sourceType: source.typeRegistre,
      sourcePeriode: source.periode,
      sourceCote: source.cote,
      sourceUrl: source.url,
      sourceArchives: source.serviceArchives,
      sourceLieuNom: lieu.nom,
    })
    .from(consultation)
    .leftJoin(source, eq(source.id, consultation.sourceId))
    .leftJoin(lieu, eq(lieu.id, source.lieuId));
export type ConsultationDetaillee = Awaited<ReturnType<typeof consultationsDetaillees>>[number];

export async function recherchesIndividu(individuId: string) {
  const taches = await db.select().from(tache).where(eq(tache.individuId, individuId)).orderBy(desc(tache.creeLe));
  if (!taches.length) return [];
  const consultations = await consultationsDetaillees()
    .where(sql`${consultation.tacheId} in (select id from tache where individu_id = ${individuId})`)
    .orderBy(asc(consultation.date), asc(consultation.creeLe));
  const parTache = Map.groupBy(consultations, (c) => c.tacheId);
  return taches.map((t) => ({ ...t, consultations: parTache.get(t.id) ?? [] }));
}
export type Recherche = Awaited<ReturnType<typeof recherchesIndividu>>[number];

/** Toutes les recherches, avec la personne concernée et un résumé des consultations. */
export async function toutesRecherches() {
  return db
    .select({
      ...getTableColumns(tache),
      individuNom: individu.nom,
      individuPrenoms: individu.prenoms,
      nbConsultations: sql<number>`(select count(*) from consultation c where c.tache_id = ${sql.raw(`"tache"."id"`)})`,
      derniere: sql<string | null>`(select max(c.date) from consultation c where c.tache_id = ${sql.raw(`"tache"."id"`)})`,
    })
    .from(tache)
    .leftJoin(individu, eq(individu.id, tache.individuId))
    .orderBy(desc(tache.creeLe));
}
export type RechercheListe = Awaited<ReturnType<typeof toutesRecherches>>[number];

/** Chaque source avec tout ce qu'on y a déjà cherché. */
export async function sourcesEtConsultations() {
  const sources = await db
    .select({ ...getTableColumns(source), lieuNom: lieu.nom })
    .from(source)
    .leftJoin(lieu, eq(lieu.id, source.lieuId))
    .orderBy(asc(source.titre));
  const consultations = await db
    .select({
      ...getTableColumns(consultation),
      tacheTitre: tache.titre,
      individuId: tache.individuId,
      individuNom: individu.nom,
      individuPrenoms: individu.prenoms,
    })
    .from(consultation)
    .innerJoin(tache, eq(tache.id, consultation.tacheId))
    .leftJoin(individu, eq(individu.id, tache.individuId))
    .orderBy(desc(consultation.date));
  const parSource = Map.groupBy(consultations, (c) => c.sourceId ?? "");
  return sources.map((s) => ({ ...s, consultations: parSource.get(s.id) ?? [] }));
}

export async function creerRecherche(individuId: string, patch: Partial<Tache> = {}) {
  const id = newId();
  await db.insert(tache).values({ titre: "Nouvelle recherche", statut: "en_cours", ...patch, id, individuId });
  return id;
}

export async function majRecherche(id: string, patch: Partial<Tache>, version?: string | null) {
  await verifierVersion("tache", id, version);
  // Date de fin posée / retirée selon le statut.
  const fin =
    patch.statut === undefined
      ? {}
      : { termineLe: patch.statut === "trouve" || patch.statut === "abandonne" ? aujourdhui() : null };
  await db.update(tache).set({ ...sansTrace(patch), ...fin }).where(eq(tache.id, id));
  return versionDe("tache", id);
}

export const supprimerRecherche = (id: string) => db.delete(tache).where(eq(tache.id, id));

export async function enregistrerConsultation(c: Partial<Consultation> & { tacheId: string }) {
  if (c.id) {
    const { id, ...patch } = c;
    await db.update(consultation).set(patch).where(eq(consultation.id, id));
    return id;
  }
  const id = newId();
  await db.insert(consultation).values({ date: aujourdhui(), resultat: "rien", ...c, id });
  return id;
}

export const supprimerConsultation = (id: string) => db.delete(consultation).where(eq(consultation.id, id));

export const chargerSource = async (id: string) => (await db.select().from(source).where(eq(source.id, id)))[0] ?? null;
export type { Source };
