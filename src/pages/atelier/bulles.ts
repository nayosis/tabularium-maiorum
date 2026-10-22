import type { Annotation, Page, Rect, Releve } from "../../db/schema";
import { couleurRole } from "../../lib/libelles";

export const COULEUR_NOTE = "#868e96";

/** Texte généré depuis le relevé (remplaçable par un texte personnalisé). */
export type ReleveBulle = Partial<Releve> & { individuNom?: string | null; individuPrenoms?: string | null };

export function texteAutoReleve(r: ReleveBulle): string {
  const nom =
    [r.nomEcrit || r.nom, r.prenomsEcrits || r.prenoms].filter(Boolean).join(" ") ||
    [r.individuNom?.toUpperCase(), r.individuPrenoms].filter(Boolean).join(" ") ||
    (r.role ? "Personne ?" : "Inconnu à identifier");
  const ne = r.sexe === "F" ? "née" : "né";
  const age = r.age?.trim();
  return [
    nom,
    r.relations?.trim() || r.role,
    r.profession,
    age && (/^\d+$/.test(age) ? `${age} ans` : age),
    !age && r.naissance && `${ne} ${r.naissance}`,
    r.mariage && `∞ ${r.mariage}`,
    r.deces && `† ${r.deces}${r.decesLieu ? ` à ${r.decesLieu}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function texteBulle(a: Annotation, r: ReleveBulle | undefined) {
  if (a.texteBulle?.trim()) return a.texteBulle;
  if (r) return texteAutoReleve(r);
  return a.note?.trim() || "Note";
}

export function couleurAnnotation(a: Annotation, r: Partial<Releve> | undefined) {
  // Personne sans rôle (photo) : verte si identifiée, orange si encore inconnue.
  if (r && !r.role && !a.couleur) return r.individuId ? "#0ca678" : "#f08c00";
  return a.couleur ?? (r ? couleurRole(r.role) : COULEUR_NOTE);
}

function couper(texte: string, max: number): string[] {
  return texte.split("\n").flatMap((ligne) => {
    const lignes: string[] = [];
    let courante = "";
    for (const mot of ligne.split(/\s+/)) {
      if (courante && (courante + " " + mot).length > max) {
        lignes.push(courante);
        courante = mot;
      } else courante = courante ? `${courante} ${mot}` : mot;
    }
    lignes.push(courante);
    return lignes;
  });
}

export type Bulle = {
  annotation: Annotation;
  couleur: string;
  lignes: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  cible: { x: number; y: number };
};

/** Dimensions de la colonne de bulles, proportionnelles à la largeur de l'image. */
export function metriques(page: Pick<Page, "largeur">) {
  const fs = Math.max(12, page.largeur / 70);
  return {
    fs,
    lh: fs * 1.3,
    pad: fs * 0.7,
    ecart: page.largeur * 0.06,
    largeur: page.largeur * 0.3,
    espace: fs * 0.8,
  };
}

export const boite = (rects: Rect[]) => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, x2: Math.max(...rects.map((r) => r.x + r.w)), y2: Math.max(...rects.map((r) => r.y + r.h)) };
};

/**
 * Bulles rangées dans une colonne à droite de l'image, dans l'ordre vertical des zones,
 * chacune au plus près de sa zone sans chevaucher la précédente.
 */
export function calculerBulles(page: Page, annotations: Annotation[], releves: Map<string, Partial<Releve>>): Bulle[] {
  const m = metriques(page);
  const x = page.largeur + m.ecart;
  const maxCar = Math.floor((m.largeur - 2 * m.pad) / (m.fs * 0.55));
  let bas = -Infinity;

  return annotations
    .filter((a) => a.rectangles.length)
    .map((a) => ({ a, b: boite(a.rectangles) }))
    .sort((u, v) => u.b.y - v.b.y)
    .map(({ a, b }) => {
      const r = a.releveId ? releves.get(a.releveId) : undefined;
      const lignes = couper(texteBulle(a, r), maxCar);
      const h = lignes.length * m.lh + 2 * m.pad;
      const y = Math.max((b.y + b.y2) / 2 - h / 2, bas + m.espace, 0);
      bas = y + h;
      // La flèche vise le bord droit du rectangle le plus à droite.
      const cible = a.rectangles.reduce((best, rc) => (rc.x + rc.w > best.x + best.w ? rc : best));
      return {
        annotation: a,
        couleur: couleurAnnotation(a, r),
        lignes,
        x,
        y,
        w: m.largeur,
        h,
        cible: { x: cible.x + cible.w, y: cible.y + cible.h / 2 },
      };
    });
}
