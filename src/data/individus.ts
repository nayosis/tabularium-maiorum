import { and, asc, eq, getTableColumns, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { batch, db, newId } from "../db/client";
import { couple, filiation, individu, lieu, type Individu } from "../db/schema";
import { lirePortrait } from "../lib/portrait";
import { sansTrace, verifierVersion, versionDe } from "./version";

// Dans une sous-requête, Drizzle écrirait "id" sans table : on qualifie explicitement.
const individuIdQualifie = sql.raw(`"individu"."id"`);

const lieuNaissance = alias(lieu, "lieu_naissance");
const lieuDeces = alias(lieu, "lieu_deces");

/** Une union de la personne a-t-elle son acte de mariage ? */
const acteMariageSql = sql<number>`exists (select 1 from couple c where c.acte_id is not null
  and (c.individu1_id = ${individuIdQualifie} or c.individu2_id = ${individuIdQualifie}))`;

/** Portrait : image et zone de la photo choisie (JSON décodé en `Portrait`, ou null). */
const portraitIdQualifie = sql.raw(`"individu"."portrait_annotation_id"`);
const portraitSql = sql<string | null>`(
  select json_object('annotationId', a.id, 'fichier', p.fichier, 'largeur', p.largeur, 'hauteur', p.hauteur, 'rects', json(a.rectangles))
  from annotation a join page p on p.id = a.page_id where a.id = ${portraitIdQualifie})`.mapWith(lirePortrait);

// Père / mère = parent de filiation, distingué par le sexe du parent.
const parentSql = (sexe: "M" | "F") => sql<string | null>`(
  select p.id from filiation f join individu p on p.id = f.parent_id
  where f.enfant_id = ${individuIdQualifie} and p.sexe = ${sexe} limit 1)`;

export async function listeIndividus() {
  return db
    .select({
      ...getTableColumns(individu),
      pereId: parentSql("M"),
      mereId: parentSql("F"),
      nbReleves: sql<number>`(select count(*) from releve r where r.individu_id = ${individuIdQualifie})`,
      naissanceLieuNom: lieuNaissance.nom,
      decesLieuNom: lieuDeces.nom,
      acteMariage: acteMariageSql,
      portrait: portraitSql,
    })
    .from(individu)
    .leftJoin(lieuNaissance, eq(lieuNaissance.id, individu.naissanceLieuId))
    .leftJoin(lieuDeces, eq(lieuDeces.id, individu.decesLieuId))
    .orderBy(asc(individu.nom), asc(individu.prenoms), asc(individu.naissanceMin));
}
export type IndividuListe = Awaited<ReturnType<typeof listeIndividus>>[number];

export async function chargerIndividu(id: string) {
  const [i] = await db.select({ ...getTableColumns(individu), portrait: portraitSql }).from(individu).where(eq(individu.id, id));
  if (!i) return null;

  const parent = alias(individu, "parent");
  const parents = await db
    .select({ filiationId: filiation.id, type: filiation.type, filiationActeId: filiation.acteId, ...getTableColumns(parent) })
    .from(filiation)
    .innerJoin(parent, eq(parent.id, filiation.parentId))
    .where(eq(filiation.enfantId, id));

  const enfant = alias(individu, "enfant");
  const enfants = await db
    .select({ filiationId: filiation.id, type: filiation.type, ...getTableColumns(enfant) })
    .from(filiation)
    .innerJoin(enfant, eq(enfant.id, filiation.enfantId))
    .where(eq(filiation.parentId, id))
    .orderBy(asc(enfant.naissanceMin));

  const conjoint = alias(individu, "conjoint");
  const lieuCouple = alias(lieu, "lieu_couple");
  const couples = await db
    .select({
      ...getTableColumns(couple),
      conjointId: conjoint.id,
      conjointNom: conjoint.nom,
      conjointPrenoms: conjoint.prenoms,
      lieuNom: lieuCouple.nom,
    })
    .from(couple)
    .leftJoin(
      conjoint,
      sql`${conjoint.id} = case when ${couple.individu1Id} = ${id} then ${couple.individu2Id} else ${couple.individu1Id} end`,
    )
    .leftJoin(lieuCouple, eq(lieuCouple.id, couple.lieuId))
    .where(or(eq(couple.individu1Id, id), eq(couple.individu2Id, id)))
    .orderBy(asc(couple.dateMin));

  return {
    ...i,
    pere: parents.find((p) => p.sexe === "M") ?? null,
    mere: parents.find((p) => p.sexe === "F") ?? null,
    autresParents: parents.filter((p) => p.sexe !== "M" && p.sexe !== "F"),
    enfants,
    couples,
  };
}
export type IndividuComplet = NonNullable<Awaited<ReturnType<typeof chargerIndividu>>>;

export async function creerIndividu(patch: Partial<Individu> = {}) {
  const id = newId();
  await db.insert(individu).values({ ...patch, id });
  return id;
}

export async function majIndividu(id: string, patch: Partial<Individu>, version?: string | null) {
  await verifierVersion("individu", id, version);
  await db.update(individu).set(sansTrace(patch)).where(eq(individu.id, id));
  return versionDe("individu", id);
}

export const supprimerIndividu = (id: string) => db.delete(individu).where(eq(individu.id, id));

/** Remplace un parent (père ou mère) : retire l'ancien lien, crée le nouveau. */
export async function changerParent(
  enfantId: string,
  ancienId: string | null,
  nouveauId: string | null,
  lien: { type?: string; acteId?: string | null } = {},
) {
  const ops = [];
  if (ancienId) {
    ops.push(db.delete(filiation).where(and(eq(filiation.enfantId, enfantId), eq(filiation.parentId, ancienId))));
  }
  if (nouveauId) {
    ops.push(db.insert(filiation).values({ ...lien, id: newId(), enfantId, parentId: nouveauId }).onConflictDoNothing());
  }
  if (ops.length) await db.batch(ops as [(typeof ops)[number], ...typeof ops]);
}

export const majFiliation = (id: string, patch: { type?: string; acteId?: string | null }) =>
  db.update(filiation).set(patch).where(eq(filiation.id, id));

export async function creerCouple(individu1Id: string, individu2Id: string | null, patch: Partial<typeof couple.$inferInsert> = {}) {
  await db.insert(couple).values({ type: "mariage", ...patch, id: newId(), individu1Id, individu2Id });
}
export const majCouple = (id: string, patch: Partial<typeof couple.$inferInsert>) =>
  db.update(couple).set(patch).where(eq(couple.id, id));
export const supprimerCouple = (id: string) => db.delete(couple).where(eq(couple.id, id));

/**
 * Fusionne `doublonId` dans `cibleId` : la cible reçoit `patch` (valeurs choisies),
 * récupère relevés, tâches, parents, enfants et unions du doublon, puis le doublon est supprimé.
 * `liensParentsASupprimer` : liens parent→enfant écartés lors du choix entre deux pères / mères.
 * Tout se fait dans une seule transaction.
 */
export async function fusionnerIndividus(
  cibleId: string,
  doublonId: string,
  patch: Partial<Individu>,
  liensParentsASupprimer: { enfantId: string; parentId: string }[] = [],
) {
  if (cibleId === doublonId) throw new Error("Impossible de fusionner un individu avec lui-même.");
  const st = (sql: string, ...params: unknown[]) => ({ sql, params });
  const { id: _, ...champs } = patch;
  const maj = Object.keys(champs).length ? [db.update(individu).set(champs).where(eq(individu.id, cibleId)).toSQL()] : [];

  await batch([
    ...maj,
    ...liensParentsASupprimer.map((l) => st("DELETE FROM filiation WHERE enfant_id = ? AND parent_id = ?", l.enfantId, l.parentId)),
    st("UPDATE releve SET individu_id = ? WHERE individu_id = ?", cibleId, doublonId),
    st("UPDATE tache SET individu_id = ? WHERE individu_id = ?", cibleId, doublonId),
    // OR IGNORE : si le lien existe déjà côté cible, on garde celui-là (le reste part avec le doublon).
    st("UPDATE OR IGNORE filiation SET enfant_id = ? WHERE enfant_id = ?", cibleId, doublonId),
    st("UPDATE OR IGNORE filiation SET parent_id = ? WHERE parent_id = ?", cibleId, doublonId),
    st("DELETE FROM filiation WHERE enfant_id = parent_id"),
    st("UPDATE couple SET individu1_id = ? WHERE individu1_id = ?", cibleId, doublonId),
    st("UPDATE couple SET individu2_id = ? WHERE individu2_id = ?", cibleId, doublonId),
    st("DELETE FROM couple WHERE individu1_id = individu2_id"),
    st("DELETE FROM individu WHERE id = ?", doublonId),
  ]);
}

/** Tout ce qu'il faut pour dessiner l'arbre (base ≤ quelques milliers de personnes). */
export async function donneesArbre() {
  const [personnes, filiations, couples] = await Promise.all([
    db
      .select({
        id: individu.id,
        nom: individu.nom,
        prenoms: individu.prenoms,
        sexe: individu.sexe,
        naissance: individu.naissance,
        naissanceMin: individu.naissanceMin,
        naissanceMax: individu.naissanceMax,
        deces: individu.deces,
        decesMin: individu.decesMin,
        decesMax: individu.decesMax,
        pereInconnu: individu.pereInconnu,
        mereInconnue: individu.mereInconnue,
        sansUnion: individu.sansUnion,
        naissanceLieu: lieuNaissance.nom,
        naissanceLieuId: individu.naissanceLieuId,
        decesLieu: lieuDeces.nom,
        acteNaissanceId: individu.acteNaissanceId,
        acteDecesId: individu.acteDecesId,
        acteMariage: acteMariageSql,
        portrait: portraitSql,
      })
      .from(individu)
      .leftJoin(lieuNaissance, eq(lieuNaissance.id, individu.naissanceLieuId))
      .leftJoin(lieuDeces, eq(lieuDeces.id, individu.decesLieuId)),
    db.select({ enfantId: filiation.enfantId, parentId: filiation.parentId, type: filiation.type }).from(filiation),
    db.select({ a: couple.individu1Id, b: couple.individu2Id, dateMin: couple.dateMin }).from(couple),
  ]);
  return { personnes, filiations, couples };
}
export type DonneesArbre = Awaited<ReturnType<typeof donneesArbre>>;
