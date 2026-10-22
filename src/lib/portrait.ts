import type { Rect } from "../db/schema";

/** Portrait d'une personne : la zone où elle est identifiée sur une photo. */
export type Portrait = { annotationId: string; fichier: string; largeur: number; hauteur: number; rects: Rect[] };

/** Lecture du JSON produit par la sous-requête SQL (null si pas de portrait). */
export function lirePortrait(v: unknown): Portrait | null {
  if (!v) return null;
  try {
    const p = typeof v === "string" ? JSON.parse(v) : v;
    if (!p?.fichier || !Array.isArray(p.rects) || !p.rects.length) return null;
    return p as Portrait;
  } catch {
    return null;
  }
}

/**
 * Cadre carré autour de la zone (rectangle englobant de tous ses rectangles), avec une marge,
 * gardé dans l'image : c'est la partie de la photo affichée dans la vignette.
 */
export function cadrePortrait(rects: Rect[], largeur: number, hauteur: number, marge = 0.08) {
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  const cote = Math.min(Math.max(x2 - x1, y2 - y1) * (1 + 2 * marge), largeur, hauteur);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const x = Math.min(Math.max(cx - cote / 2, 0), largeur - cote);
  const y = Math.min(Math.max(cy - cote / 2, 0), hauteur - cote);
  return { x, y, w: cote, h: cote };
}
