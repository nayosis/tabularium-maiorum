/*
 * Doublons possibles : deux fiches qui pourraient être la même personne (même nom, prénoms et dates compatibles).
 * Proposés à l'utilisateur, qui les signale en doute, les fusionne ou les écarte (« personnes différentes »).
 */
import { cleNom, motsPrenoms } from "./candidats";

export type FicheComparable = {
  id: string;
  nom: string | null;
  prenoms: string | null;
  sexe: string | null;
  naissanceMin: string | null;
  naissanceMax: string | null;
  naissanceLieuId: string | null;
  decesMin: string | null;
  decesMax: string | null;
  pereId: string | null;
  mereId: string | null;
};

export type DoublonPossible<F extends FicheComparable = FicheComparable> = { a: F; b: F; score: number; raisons: string[] };

export const SEUIL_DOUBLON = 40;
/** Au-delà : doublon « probable » (en dessous : « possible »). */
export const SEUIL_PROBABLE = 70;

const annee = (d: string | null) => (d ? Number.parseInt(d.slice(0, 4), 10) : null);
/** Écart en années entre deux intervalles de dates (0 s'ils se recouvrent), ou null si l'un est inconnu. */
function ecart(aMin: string | null, aMax: string | null, bMin: string | null, bMax: string | null) {
  const [a1, a2, b1, b2] = [annee(aMin), annee(aMax ?? aMin), annee(bMin), annee(bMax ?? bMin)];
  if (a1 == null || a2 == null || b1 == null || b2 == null) return null;
  return Math.max(0, b1 - a2, a1 - b2);
}
/** Clé de paire indépendante de l'ordre. */
export const clePaire = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

/** Compare deux fiches : score (0 si impossible) et raisons lisibles. */
export function comparer(a: FicheComparable, b: FicheComparable): { score: number; raisons: string[] } {
  const non = { score: 0, raisons: [] };
  if (a.id === b.id) return non;
  const nom = cleNom(a.nom);
  if (!nom || nom !== cleNom(b.nom)) return non;
  if (a.sexe && b.sexe && a.sexe !== b.sexe) return non;
  // Parent et enfant ne sont jamais la même personne.
  if ([a.pereId, a.mereId].includes(b.id) || [b.pereId, b.mereId].includes(a.id)) return non;

  const raisons: string[] = [];
  let score = 0;

  const pa = motsPrenoms(a.prenoms);
  const pb = motsPrenoms(b.prenoms);
  const communs = pa.filter((m) => pb.includes(m));
  if (!communs.length) return non;
  if (pa.length === pb.length && communs.length === pa.length) {
    score += 40;
    raisons.push("mêmes prénoms");
  } else if (pa[0] === pb[0] && !(pa[1] && pb[1] && !pb.includes(pa[1]) && !pa.includes(pb[1]))) {
    // Même premier prénom ; mais « Marie Pauline » / « Marie Ursulle » : deux prénoms usuels différents.
    score += 30;
    raisons.push("même premier prénom");
  } else if (communs.length === Math.min(pa.length, pb.length)) {
    score += 25;
    raisons.push("prénoms compatibles");
  } else {
    score += 15;
    raisons.push("un prénom en commun");
  }

  // Deux dates de naissance exactes, à plus d'un mois d'écart : deux personnes (frères et sœurs…).
  const exacte = (f: FicheComparable) => f.naissanceMin && f.naissanceMin === f.naissanceMax;
  if (exacte(a) && exacte(b) && Math.abs(Date.parse(a.naissanceMin!) - Date.parse(b.naissanceMin!)) > 31 * 86400_000) return non;

  const n = ecart(a.naissanceMin, a.naissanceMax, b.naissanceMin, b.naissanceMax);
  if (n != null) {
    if (n > 3) return non; // nés à plusieurs années d'écart : deux personnes
    // Un an d'écart est fréquent (âges approximatifs dans les actes).
    score += n === 0 ? 30 : n === 1 ? 25 : 15;
    raisons.push(n === 0 ? "naissances compatibles" : `naissances à ${n} an${n > 1 ? "s" : ""} près`);
  } else if (a.naissanceMin || b.naissanceMin) score += 5;

  const d = ecart(a.decesMin, a.decesMax, b.decesMin, b.decesMax);
  if (d != null) {
    if (d > 2) return non;
    score += 15;
    raisons.push("décès compatibles");
  }

  if (a.naissanceLieuId && a.naissanceLieuId === b.naissanceLieuId) {
    score += 15;
    raisons.push("même lieu de naissance");
  }

  const memesParents = (x: string | null, y: string | null) => x && y && x === y;
  const autresParents = (x: string | null, y: string | null) => x && y && x !== y;
  if (memesParents(a.pereId, b.pereId) || memesParents(a.mereId, b.mereId)) {
    score += 10;
    raisons.push("mêmes parents");
  } else if (autresParents(a.pereId, b.pereId) || autresParents(a.mereId, b.mereId)) {
    score -= 20;
    raisons.push("parents différents");
  }

  return { score: Math.max(0, Math.min(100, score)), raisons };
}

/**
 * Doublons possibles parmi les fiches, du plus probable au moins probable.
 * `dejaVues` : paires déjà signalées en doute (à vérifier ou écartées) — jamais reproposées.
 */
export function detecterDoublons<F extends FicheComparable>(fiches: F[], dejaVues: Set<string> = new Set(), seuil = SEUIL_DOUBLON) {
  const parNom = Map.groupBy(
    fiches.filter((f) => cleNom(f.nom)),
    (f) => cleNom(f.nom),
  );
  const resultats: DoublonPossible<F>[] = [];
  for (const groupe of parNom.values()) {
    for (let i = 0; i < groupe.length; i++)
      for (let j = i + 1; j < groupe.length; j++) {
        const [a, b] = [groupe[i], groupe[j]];
        if (dejaVues.has(clePaire(a.id, b.id))) continue;
        const { score, raisons } = comparer(a, b);
        if (score >= seuil) resultats.push({ a, b, score, raisons });
      }
  }
  return resultats.sort((x, y) => y.score - x.score);
}
