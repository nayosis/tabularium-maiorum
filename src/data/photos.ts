import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { acte, actePage, annotation, individu, lieu, page, releve, source } from "../db/schema";
import type { Portrait } from "../lib/portrait";

/** Pour la galerie : les photos, leur première image, les personnes identifiées et le nombre d'inconnus. */
export async function listePhotos() {
  const photos = await db
    .select({
      id: acte.id,
      titre: acte.titre,
      date: acte.date,
      dateMin: acte.dateMin,
      dateMax: acte.dateMax,
      description: acte.notes,
      lieuNom: lieu.nom,
      sourceId: acte.sourceId,
      albumTitre: source.titre,
      creeLe: acte.creeLe,
    })
    .from(acte)
    .leftJoin(lieu, eq(lieu.id, acte.lieuId))
    .leftJoin(source, eq(source.id, acte.sourceId))
    .where(eq(acte.nature, "photo"));
  if (!photos.length) return [];

  const images = await db
    .select({ acteId: actePage.acteId, fichier: page.fichier, ordre: actePage.ordre })
    .from(actePage)
    .innerJoin(page, eq(page.id, actePage.pageId))
    .innerJoin(acte, eq(acte.id, actePage.acteId))
    .where(eq(acte.nature, "photo"))
    .orderBy(asc(actePage.ordre));
  const personnes = await db
    .select({ acteId: releve.acteId, individuId: releve.individuId, nom: individu.nom, prenoms: individu.prenoms })
    .from(releve)
    .innerJoin(acte, eq(acte.id, releve.acteId))
    .leftJoin(individu, eq(individu.id, releve.individuId))
    .where(sql`${acte.nature} = 'photo'`)
    .orderBy(asc(releve.ordre));

  const premiere = new Map<string, string>();
  const nbImages = new Map<string, number>();
  for (const i of images) {
    if (!premiere.has(i.acteId)) premiere.set(i.acteId, i.fichier);
    nbImages.set(i.acteId, (nbImages.get(i.acteId) ?? 0) + 1);
  }
  const parPhoto = Map.groupBy(personnes, (p) => p.acteId);

  return photos
    .map((p) => {
      const ps = parPhoto.get(p.id) ?? [];
      return {
        ...p,
        fichier: premiere.get(p.id) ?? null,
        nbImages: nbImages.get(p.id) ?? 0,
        identifies: ps.filter((x) => x.individuId).map((x) => ({ id: x.individuId!, nom: x.nom, prenoms: x.prenoms })),
        nbInconnus: ps.filter((x) => !x.individuId).length,
      };
    })
    .sort((a, b) => (a.dateMin ?? "9999").localeCompare(b.dateMin ?? "9999") || b.creeLe.localeCompare(a.creeLe));
}
export type PhotoListe = Awaited<ReturnType<typeof listePhotos>>[number];

/**
 * Photos où la personne est identifiée, avec sa zone (pour une vignette recadrée sur elle).
 * Sans zone tracée, la vignette montre la première image entière.
 */
export async function photosIndividu(individuId: string) {
  const lignes = await db
    .select({
      acteId: acte.id,
      titre: acte.titre,
      date: acte.date,
      dateMin: acte.dateMin,
      annotationId: annotation.id,
      rects: annotation.rectangles,
      fichier: page.fichier,
      largeur: page.largeur,
      hauteur: page.hauteur,
      premiere: sql<string | null>`(select p2.fichier from acte_page ap join page p2 on p2.id = ap.page_id where ap.acte_id = ${sql.raw(`"acte"."id"`)} order by ap.ordre limit 1)`,
    })
    .from(releve)
    .innerJoin(acte, eq(acte.id, releve.acteId))
    .leftJoin(annotation, eq(annotation.releveId, releve.id))
    .leftJoin(page, eq(page.id, annotation.pageId))
    .where(sql`${releve.individuId} = ${individuId} and ${acte.nature} = 'photo'`)
    .orderBy(asc(acte.dateMin));
  // Une vignette par photo (la première zone de la personne).
  const vues = new Map<string, (typeof lignes)[number]>();
  for (const l of lignes) if (!vues.has(l.acteId) || (!vues.get(l.acteId)!.annotationId && l.annotationId)) vues.set(l.acteId, l);
  return [...vues.values()].map((l) => ({
    acteId: l.acteId,
    titre: l.titre,
    date: l.date,
    portrait:
      l.annotationId && l.fichier && l.rects?.length
        ? ({ annotationId: l.annotationId, fichier: l.fichier, largeur: l.largeur!, hauteur: l.hauteur!, rects: l.rects } satisfies Portrait)
        : null,
    fichier: l.fichier ?? l.premiere,
  }));
}
export type PhotoIndividu = Awaited<ReturnType<typeof photosIndividu>>[number];
