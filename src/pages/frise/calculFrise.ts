import { EVENEMENT_INDEX } from "../../lib/libelles";

/*
 * Frise chronologique : chaque individu devient une période [x0, x1] → [x2, x3] en années décimales.
 *   x0–x1 : naissance (plage d'incertitude, dessinée en fondu)
 *   x1–x2 : vie certaine (trait plein)
 *   x2–x3 : décès (plage d'incertitude, en fondu)
 * Une date manquante est estimée (durée de vie typique) et marquée comme telle.
 */

export type PersonneFrise = {
  id: string;
  nom: string | null;
  prenoms: string | null;
  sexe: string | null;
  naissanceMin: string | null;
  naissanceMax: string | null;
  decesMin: string | null;
  decesMax: string | null;
};

export type Periode = {
  personne: PersonneFrise;
  x0: number;
  x1: number;
  x2: number;
  x3: number;
  naissanceEstimee: boolean;
  decesEstime: boolean;
};

/** Marge de fondu quand une seule borne est connue (« avant 1790 »). */
const FONDU = 5;
/** Sans date de décès : vie pleine jusqu'à +50 ans, puis fondu jusqu'à +90. */
const VIE_SURE = 50;
const VIE_MAX = 90;

/** 1897-11-28 → 1897.91 */
export function anneeDecimale(iso: string): number {
  const [a, m, j] = iso.split("-").map(Number);
  return a + ((m - 1) * 30.44 + (j - 1)) / 365.25;
}

function plage(min: string | null, max: string | null): [number, number] | null {
  if (min && max) return [anneeDecimale(min), anneeDecimale(max)];
  if (max) return [anneeDecimale(max) - FONDU, anneeDecimale(max)];
  if (min) return [anneeDecimale(min), anneeDecimale(min) + FONDU];
  return null;
}

export function periode(p: PersonneFrise): Periode | null {
  const n = plage(p.naissanceMin, p.naissanceMax);
  const d = plage(p.decesMin, p.decesMax);
  if (!n && !d) return null;
  const [x0, x1] = n ?? [d![0] - VIE_MAX, d![0] - VIE_SURE];
  const [x2, x3] = d ?? [x1 + VIE_SURE, x1 + VIE_MAX];
  // Données incohérentes (décès avant naissance) : on évite une barre à l'envers.
  return {
    personne: p,
    x0: Math.min(x0, x1),
    x1,
    x2: Math.max(x2, x1),
    x3: Math.max(x3, x2, x1),
    naissanceEstimee: !n,
    decesEstime: !d,
  };
}

export type Tri = "naissance" | "nom";

export function construireFrise(personnes: PersonneFrise[], tri: Tri) {
  const periodes: Periode[] = [];
  const sansDates: PersonneFrise[] = [];
  for (const p of personnes) {
    const per = periode(p);
    if (per) periodes.push(per);
    else sansDates.push(p);
  }
  periodes.sort((a, b) =>
    tri === "nom"
      ? `${a.personne.nom ?? ""} ${a.personne.prenoms ?? ""}`.localeCompare(`${b.personne.nom ?? ""} ${b.personne.prenoms ?? ""}`, "fr") || a.x1 - b.x1
      : a.x1 - b.x1 || a.x0 - b.x0,
  );
  if (!periodes.length) return { periodes, sansDates, debut: 0, fin: 0 };
  const debut = Math.floor((Math.min(...periodes.map((p) => p.x0)) - 2) / 10) * 10;
  const fin = Math.ceil((Math.max(...periodes.map((p) => p.x3)) + 2) / 10) * 10;
  return { periodes, sansDates, debut, fin };
}

type EvenementDate = {
  role: string | null;
  acteNature: string;
  acteDateMin: string | null;
  acteDateMax: string | null;
  naissanceMin: string | null;
  naissanceMax: string | null;
  mariageMin: string | null;
  mariageMax: string | null;
  decesMin: string | null;
  decesMax: string | null;
};

/**
 * Année où placer un relevé sur la frise : la date de l'acte ;
 * pour une ligne d'index (table décennale…), la date de l'événement qu'elle indique.
 */
export function anneeEvenement(e: EvenementDate): number | null {
  let min = e.acteDateMin;
  let max = e.acteDateMax;
  if (e.acteNature === "index") {
    const quoi = EVENEMENT_INDEX[(e.role ?? "").trim().toLowerCase()];
    if (!quoi) return null;
    min = e[`${quoi}Min`];
    max = e[`${quoi}Max`];
  }
  if (!min && !max) return null;
  return (anneeDecimale(min ?? max!) + anneeDecimale(max ?? min!)) / 2;
}

/** Pas des graduations : le plus petit pas qui laisse au moins `minPx` pixels entre deux traits. */
export function pasGraduation(pxParAn: number, minPx = 60) {
  return [1, 2, 5, 10, 20, 25, 50, 100, 200].find((p) => p * pxParAn >= minPx) ?? 500;
}
