import { and, asc, desc, eq, getTableColumns, inArray, ne, notExists, sql } from "drizzle-orm";
import { batch, db, newId } from "../db/client";
import { acte, actePage, annotation, lien, lieu, page, releve, source, type Acte, type Rect } from "../db/schema";
import type { ImageEnregistree } from "../lib/images";
// Côté serveur uniquement : ce module n'est jamais chargé par le navigateur (appels RPC).
import { supprimerImage } from "../../serveur/fichiers";
import { sansTrace, verifierVersion, versionDe } from "./version";

// Dans une sous-requête, Drizzle écrirait "id" sans table : on qualifie explicitement.
const acteIdQualifie = sql.raw(`"acte"."id"`);

export async function listeActes() {
  return db
    .select({
      ...getTableColumns(acte),
      lieuNom: lieu.nom,
      sourceTitre: source.titre,
      nbReleves: sql<number>`(select count(*) from releve r where r.acte_id = ${acteIdQualifie})`,
      numeroPage: sql<string | null>`(select p.numero_vue from acte_page ap join page p on p.id = ap.page_id where ap.acte_id = ${acteIdQualifie} order by ap.ordre limit 1)`,
      nbRattaches: sql<number>`(select count(*) from releve r where r.acte_id = ${acteIdQualifie} and r.individu_id is not null)`,
    })
    .from(acte)
    .leftJoin(lieu, eq(acte.lieuId, lieu.id))
    .leftJoin(source, eq(acte.sourceId, source.id))
    .orderBy(desc(acte.creeLe));
}
export type ActeListe = Awaited<ReturnType<typeof listeActes>>[number];

export async function chargerActe(id: string) {
  const [a] = await db.select().from(acte).where(eq(acte.id, id));
  if (!a) return null;
  const pages = await db
    .select({ ...getTableColumns(page), ordre: actePage.ordre })
    .from(actePage)
    .innerJoin(page, eq(page.id, actePage.pageId))
    .where(eq(actePage.acteId, id))
    .orderBy(asc(actePage.ordre));
  const liens = await db.select().from(lien).where(eq(lien.acteId, id)).orderBy(asc(lien.creeLe));
  return { ...a, pages, liens };
}
export type ActeComplet = NonNullable<Awaited<ReturnType<typeof chargerActe>>>;

/** Un nouvel acte à partir d'une ou plusieurs images (une page par image). */
export async function creerActe(images: ImageEnregistree[], patch: Partial<Acte> = {}, numeroVue?: string | null) {
  const acteId = newId();
  const pages = images.map((img, i) => ({
    id: newId(),
    fichier: img.fichier,
    largeur: img.largeur,
    hauteur: img.hauteur,
    sourceId: patch.sourceId ?? null,
    numeroVue: i === 0 ? (numeroVue ?? null) : null,
  }));
  await db.batch([
    db.insert(acte).values({ titre: "Nouveau document", statut: "a_analyser", ...patch, id: acteId }),
    ...pages.map((p) => db.insert(page).values(p)),
    ...pages.map((p, i) => db.insert(actePage).values({ acteId, pageId: p.id, ordre: i })),
  ]);
  return acteId;
}

/**
 * Liasses : les autres actes qui partagent au moins une image avec celui-ci,
 * et les images de ces actes que celui-ci n'a pas (pour un acte qui continue sur l'image suivante).
 */
export async function voisinsDansLaLiasse(acteId: string) {
  const mesPages = db.select({ id: actePage.pageId }).from(actePage).where(eq(actePage.acteId, acteId));
  const actes = await db
    .selectDistinct({ id: acte.id, titre: acte.titre, type: acte.type, nature: acte.nature })
    .from(actePage)
    .innerJoin(acte, eq(acte.id, actePage.acteId))
    .where(and(inArray(actePage.pageId, mesPages), ne(actePage.acteId, acteId)))
    .orderBy(asc(acte.creeLe));
  const pages = actes.length
    ? await db
        .selectDistinct({ ...getTableColumns(page) })
        .from(actePage)
        .innerJoin(page, eq(page.id, actePage.pageId))
        .where(
          and(
            inArray(actePage.acteId, actes.map((a) => a.id)),
            notExists(db.select().from(actePage).where(and(eq(actePage.acteId, acteId), eq(actePage.pageId, page.id)))),
          ),
        )
        .orderBy(asc(page.creeLe))
    : [];
  return { actes, pages };
}

/** Un nouvel acte sur des images déjà présentes (plusieurs actes sur une même page de liasse). */
export async function creerActeSurPages(pageIds: string[], patch: Partial<Acte> = {}) {
  const acteId = newId();
  await db.batch([
    db.insert(acte).values({ titre: "Nouvel acte", statut: "a_analyser", ...patch, id: acteId }),
    ...pageIds.map((pageId, i) => db.insert(actePage).values({ acteId, pageId, ordre: i })),
  ]);
  return acteId;
}

/** Ajoute à l'acte une image existante (l'acte continue sur l'image suivante de la liasse). */
export async function lierPage(acteId: string, pageId: string) {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${actePage.ordre}), -1)` })
    .from(actePage)
    .where(eq(actePage.acteId, acteId));
  await db.insert(actePage).values({ acteId, pageId, ordre: max + 1 }).onConflictDoNothing();
}

export async function ajouterPages(acteId: string, images: ImageEnregistree[]) {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${actePage.ordre}), -1)` })
    .from(actePage)
    .where(eq(actePage.acteId, acteId));
  const pages = images.map((img) => ({ id: newId(), fichier: img.fichier, largeur: img.largeur, hauteur: img.hauteur }));
  await db.batch([
    db.insert(page).values(pages[0]),
    ...pages.slice(1).map((p) => db.insert(page).values(p)),
    ...pages.map((p, i) => db.insert(actePage).values({ acteId, pageId: p.id, ordre: max + 1 + i })),
  ]);
}

/** `version` : modifie_le connu du formulaire ; refusé (conflit) si quelqu'un d'autre a modifié l'acte entre-temps. */
export async function majActe(id: string, patch: Partial<Acte>, version?: string | null) {
  await verifierVersion("acte", id, version);
  await db.update(acte).set(sansTrace(patch)).where(eq(acte.id, id));
  return versionDe("acte", id);
}

export const majPage = (id: string, patch: { numeroVue?: string | null; notes?: string | null }) =>
  db.update(page).set(patch).where(eq(page.id, id));

/** Supprime les pages qui ne sont plus rattachées à aucun acte, et leurs fichiers. */
async function nettoyerPagesOrphelines(pageIds: string[]) {
  if (!pageIds.length) return;
  const orphelines = await db
    .select({ id: page.id, fichier: page.fichier })
    .from(page)
    .where(
      and(
        inArray(page.id, pageIds),
        notExists(db.select().from(actePage).where(eq(actePage.pageId, page.id))),
      ),
    );
  if (!orphelines.length) return;
  await db.delete(page).where(inArray(page.id, orphelines.map((p) => p.id)));
  await Promise.all(orphelines.map((p) => supprimerImage(p.fichier)));
}

export async function retirerPage(acteId: string, pageId: string) {
  await db.batch([
    db.delete(annotation).where(and(eq(annotation.pageId, pageId), eq(annotation.acteId, acteId))),
    db.delete(actePage).where(and(eq(actePage.acteId, acteId), eq(actePage.pageId, pageId))),
  ]);
  await nettoyerPagesOrphelines([pageId]);
}

export async function supprimerActe(id: string) {
  const pages = await db.select({ id: actePage.pageId }).from(actePage).where(eq(actePage.acteId, id));
  await db.batch([
    // Les lignes d'index qui renvoyaient à cet acte redeviennent « à trouver ».
    // (Fait ici : certaines bases n'ont pas le ON DELETE SET NULL sur cette colonne.)
    db.update(releve).set({ acteRenvoiId: null }).where(eq(releve.acteRenvoiId, id)),
    db.delete(acte).where(eq(acte.id, id)),
  ]);
  await nettoyerPagesOrphelines(pages.map((p) => p.id));
}

// Liens internet
export const ajouterLien = (acteId: string, url: string, libelle?: string) =>
  db.insert(lien).values({ id: newId(), acteId, url, libelle: libelle || null });
export const majLien = (id: string, patch: { url?: string; libelle?: string | null }) =>
  db.update(lien).set(patch).where(eq(lien.id, id));
export const supprimerLien = (id: string) => db.delete(lien).where(eq(lien.id, id));

// Annotations
export async function annotationsPages(pageIds: string[]) {
  if (!pageIds.length) return [];
  return db.select().from(annotation).where(inArray(annotation.pageId, pageIds));
}

/** Zone sur l'image + nouveau relevé associé. Renvoie l'id du relevé. */
export async function creerZonePersonne(acteId: string, pageId: string, rect: Rect) {
  const releveId = newId();
  const [{ ordre }] = await db
    .select({ ordre: sql<number>`coalesce(max(${releve.ordre}), -1) + 1` })
    .from(releve)
    .where(eq(releve.acteId, acteId));
  await db.batch([
    db.insert(releve).values({ id: releveId, acteId, ordre }),
    db.insert(annotation).values({ id: newId(), pageId, acteId, releveId, rectangles: [rect] }),
  ]);
  return releveId;
}

export async function creerZoneNote(acteId: string, pageId: string, rect: Rect) {
  const id = newId();
  await db.insert(annotation).values({ id, pageId, acteId, rectangles: [rect], note: "" });
  return id;
}

/** Zone pour un relevé existant qui n'en a pas encore sur cette page. */
export async function creerZonePourReleve(acteId: string, pageId: string, releveId: string, rect: Rect) {
  const id = newId();
  await db.insert(annotation).values({ id, pageId, acteId, releveId, rectangles: [rect] });
  return id;
}

export const majAnnotation = (id: string, patch: { rectangles?: Rect[]; note?: string | null; texteBulle?: string | null }) =>
  db.update(annotation).set(patch).where(eq(annotation.id, id));
export const supprimerAnnotation = (id: string) => db.delete(annotation).where(eq(annotation.id, id));

/**
 * Range des documents dans un registre. `numeros` : numéro de page à reporter sur la première image
 * de chaque document (seulement si elle n'en a pas déjà un).
 */
export async function regrouperDansRegistre(acteIds: string[], sourceId: string | null, numeros: Record<string, string> = {}) {
  if (!acteIds.length) return;
  await batch([
    ...acteIds.map((id) => ({ sql: "UPDATE acte SET source_id = ? WHERE id = ?", params: [sourceId, id] })),
    ...Object.entries(numeros).map(([id, numero]) => ({
      sql: `UPDATE page SET numero_vue = ? WHERE (numero_vue IS NULL OR numero_vue = '')
              AND id = (SELECT page_id FROM acte_page WHERE acte_id = ? ORDER BY ordre LIMIT 1)`,
      params: [numero, id],
    })),
  ]);
}

export async function majStatutActes(acteIds: string[], statut: string) {
  if (acteIds.length) await db.update(acte).set({ statut }).where(inArray(acte.id, acteIds));
}

// Sources (registres)
export const listeSources = () => db.select().from(source).orderBy(asc(source.titre));
export async function creerSource(titre: string) {
  const id = newId();
  await db.insert(source).values({ id, titre });
  return id;
}
export async function majSource(id: string, patch: Partial<typeof source.$inferInsert>, version?: string | null) {
  await verifierVersion("source", id, version);
  await db.update(source).set(sansTrace(patch)).where(eq(source.id, id));
  return versionDe("source", id);
}
