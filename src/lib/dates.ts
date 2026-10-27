/*
 * Dates floues de généalogie. On garde toujours la saisie d'origine et on en déduit
 * deux bornes ISO (AAAA-MM-JJ) pour trier / filtrer. Formes reconnues :
 *   28/11/1897 · 28 novembre 1897 · 11/1897 · novembre 1897 · 1897
 *   vers 1826 (±2 ans) · avant 1790 · après 1790 · entre 1778 et 1782 · 1778-1782
 *   3 brumaire an IV · brumaire an IV · an IV (calendrier républicain, voir republicain.ts)
 */
import { convertirTexte, isoVersRepublicain, plageRepublicaine } from "./republicain";

export type Bornes = { min: string | null; max: string | null };

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const MOIS_AFFICHAGE = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MARGE_VERS = 2;

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (a: number, m: number, j: number) => `${String(a).padStart(4, "0")}-${pad(m)}-${pad(j)}`;
const finDeMois = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();

/** Une date simple (jour, mois ou année) → sa plage. */
function plage(s: string): { min: string; max: string } | null {
  s = s.trim();
  const republicaine = plageRepublicaine(s);
  if (republicaine) return republicaine;
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{3,4})$/);
  if (m) {
    const [j, mo, a] = [+m[1], +m[2], +m[3]];
    if (mo < 1 || mo > 12 || j < 1 || j > finDeMois(a, mo)) return null;
    return { min: iso(a, mo, j), max: iso(a, mo, j) };
  }
  m = s.match(/^(\d{1,2})[/.-](\d{3,4})$/);
  if (m) {
    const [mo, a] = [+m[1], +m[2]];
    if (mo < 1 || mo > 12) return null;
    return { min: iso(a, mo, 1), max: iso(a, mo, finDeMois(a, mo)) };
  }
  m = s.match(/^(?:(\d{1,2})(?:er)?\s+)?([a-z]+)\s+(\d{3,4})$/);
  if (m) {
    const mo = MOIS.findIndex((x) => x.startsWith(m![2]) && m![2].length >= 3) + 1;
    if (!mo) return null;
    const a = +m[3];
    if (m[1]) {
      const j = +m[1];
      if (j < 1 || j > finDeMois(a, mo)) return null;
      return { min: iso(a, mo, j), max: iso(a, mo, j) };
    }
    return { min: iso(a, mo, 1), max: iso(a, mo, finDeMois(a, mo)) };
  }
  m = s.match(/^(\d{3,4})$/);
  if (m) return { min: iso(+m[1], 1, 1), max: iso(+m[1], 12, 31) };
  return null;
}

/** Analyse une saisie ; renvoie null si elle n'est pas comprise. */
export function analyserDate(saisie: string | null | undefined): Bornes | null {
  if (!saisie?.trim()) return null;
  const brut = sansAccents(saisie.toLowerCase());
  // « vers 1826 (71 ans le 29/11/1897) » : l'âge et la date donnent des bornes précises.
  const age = brut.match(/\((.+?)\s+(?:le|en)\s+(.+?)\)/);
  if (age) {
    const n = naissanceDepuisAge(age[1], analyserDate(age[2]));
    if (n) return { min: n.min, max: n.max };
  }
  // Sinon on ignore ce qui est entre parenthèses.
  const s = brut.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();

  let m = s.match(/^(?:vers|env\.?|environ|ca\.?|circa|~)\s*(.+)$/);
  if (m) {
    const p = plage(m[1]);
    if (!p) return null;
    const dec = (d: string, n: number) => `${String(+d.slice(0, 4) + n).padStart(4, "0")}${d.slice(4)}`;
    return { min: dec(p.min, -MARGE_VERS), max: dec(p.max, MARGE_VERS) };
  }
  m = s.match(/^(?:avant|av\.?|<)\s*(?:le\s+)?(.+)$/);
  if (m) {
    const p = plage(m[1]);
    return p ? { min: null, max: p.min } : null;
  }
  m = s.match(/^(?:apres|ap\.?|>)\s*(?:le\s+)?(.+)$/);
  if (m) {
    const p = plage(m[1]);
    return p ? { min: p.max, max: null } : null;
  }
  m = s.match(/^(?:entre\s+(?:le\s+)?)?(.+?)\s+(?:et|-)\s+(?:le\s+)?(.+)$/) ?? s.match(/^(\d{3,4})-(\d{3,4})$/);
  if (m) {
    const a = plage(m[1]);
    const b = plage(m[2]);
    return a && b ? { min: a.min, max: b.max } : null;
  }
  return plage(s);
}

/**
 * Date à afficher : la saisie telle quelle, sauf une date républicaine, montrée d'abord en grégorien :
 * « 3 brumaire an IV » → « 25/10/1795 (3 brumaire an IV) ».
 */
export function afficherDate(saisie: string | null | undefined): string {
  if (!saisie) return "";
  return convertirTexte(saisie, (g, r) => `${g} (${r})`) ?? saisie;
}

/** Pour les citations : la date de l'acte d'abord, la conversion ensuite : « 3 brumaire an IV (25/10/1795) ». */
export function afficherDateSource(saisie: string | null | undefined): string {
  if (!saisie) return "";
  return convertirTexte(saisie, (g, r) => `${r} (${g})`) ?? saisie;
}

/**
 * Convertisseur (recherche Ctrl+K) : « 3 brumaire an IV » → « 25/10/1795 », et « 25/10/1795 » → « 3 brumaire an IV »
 * pour une date entre le 22/09/1792 et le 31/12/1805. Null si le texte n'est pas une date à convertir.
 */
export function conversionCalendrier(texte: string): { resultat: string; detail: string } | null {
  const bornes = analyserDate(texte);
  if (!bornes) return null;
  const gregorien = convertirTexte(texte);
  if (gregorien) return { resultat: gregorien, detail: decrireBornes(bornes) ?? "" };
  if (bornes.min && bornes.min === bornes.max) {
    const republicain = isoVersRepublicain(bornes.min);
    if (republicain) return { resultat: republicain, detail: `calendrier républicain — ${formaterIso(bornes.min)}` };
  }
  return null;
}

export function formaterIso(d: string | null) {
  if (!d) return "?";
  const [a, m, j] = d.split("-").map(Number);
  return `${j === 1 ? "1er" : j} ${MOIS_AFFICHAGE[m - 1]} ${a}`;
}

/** Texte lisible de l'interprétation, affiché sous le champ de saisie. */
export function decrireBornes(b: Bornes | null) {
  if (!b) return null;
  if (b.min && b.max && b.min === b.max) return formaterIso(b.min);
  if (!b.min) return `avant le ${formaterIso(b.max)}`;
  if (!b.max) return `après le ${formaterIso(b.min)}`;
  return `entre le ${formaterIso(b.min)} et le ${formaterIso(b.max)}`;
}

function decalerAns(d: string, ans: number, jours = 0) {
  const [a, m, j] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(2000, m - 1, j));
  dt.setUTCFullYear(a - ans);
  dt.setUTCDate(dt.getUTCDate() + jours);
  return dt.toISOString().slice(0, 10);
}

/**
 * Naissance estimée à partir d'un âge déclaré (« 71 ans », « 71 », « 3 mois », « 8 jours »)
 * et de la date de l'acte. Renvoie la saisie à afficher et les bornes.
 */
export function naissanceDepuisAge(age: string | null | undefined, dateActe: Bornes | null, texteDateActe?: string | null) {
  if (!age?.trim() || !dateActe?.min || !dateActe.max) return null;
  const s = sansAccents(age.toLowerCase());
  const n = s.match(/(\d+)/);
  if (!n) return null;
  const v = +n[1];
  let min: string;
  let max: string;
  if (/mois/.test(s)) {
    min = decalerAns(dateActe.min, Math.floor((v + 1) / 12), -(((v + 1) % 12) * 31));
    max = decalerAns(dateActe.max, Math.floor(v / 12), -((v % 12) * 28));
  } else if (/jour/.test(s)) {
    min = decalerAns(dateActe.min, 0, -(v + 1));
    max = decalerAns(dateActe.max, 0, -v);
  } else {
    // v ans : né entre (date - v - 1 an + 1 jour) et (date - v ans).
    min = decalerAns(dateActe.min, v + 1, 1);
    max = decalerAns(dateActe.max, v);
  }
  const anneeMilieu = Math.round((+min.slice(0, 4) + +max.slice(0, 4)) / 2);
  // « le 29/11/1897 », mais « en 1926 » pour une simple année (recensement…).
  const ref = texteDateActe ? (/^\d{3,4}$/.test(texteDateActe.trim()) ? ` en ${texteDateActe.trim()}` : ` le ${texteDateActe}`) : "";
  const ageTexte = /^\d+$/.test(age.trim()) ? `${v} ans` : age.trim();
  return { saisie: `vers ${anneeMilieu} (${ageTexte}${ref})`, min, max };
}
