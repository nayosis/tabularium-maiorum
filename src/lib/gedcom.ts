/*
 * GEDCOM (format d'échange des logiciels de généalogie) : lecture (5.5, 5.5.1, 5.5.5, la plupart des 7.0),
 * écriture en 5.5.1, et conversion des dates entre GEDCOM (« ABT 1850 ») et la saisie floue de Tabularium
 * (« vers 1850 »). Fonctions pures, sans base de données.
 */

export type Noeud = { niveau: number; xref: string | null; tag: string; valeur: string; enfants: Noeud[] };

/** Décode les octets d'un fichier GEDCOM : UTF-8 (par défaut), ou Windows-1252 si l'en-tête annonce ANSI / IBMPC / ANSEL. */
export function decoderGedcom(octets: Uint8Array) {
  const debut = new TextDecoder("latin1").decode(octets.subarray(0, 4000));
  const charset = debut.match(/^\s*1\s+CHAR\s+(\S+)/m)?.[1]?.toUpperCase() ?? "UTF-8";
  const encodage = ["ANSI", "IBMPC", "ANSEL", "ASCII", "WINDOWS-1252", "CP1252", "LATIN1", "ISO-8859-1"].includes(charset) ? "windows-1252" : "utf-8";
  // ANSEL est rare et proche de l'ASCII pour les lettres sans accent : on le lit comme Windows-1252.
  return { texte: new TextDecoder(encodage).decode(octets).replace(/^﻿/, ""), charset };
}

/** Lignes → arbre d'enregistrements ; CONT (nouvelle ligne) et CONC (suite) sont recollés à leur parent. */
export function lireGedcom(texte: string): Noeud[] {
  const racines: Noeud[] = [];
  const pile: Noeud[] = [];
  for (const brute of texte.split(/\r\n|\r|\n/)) {
    const m = brute.match(/^\s*(\d+)\s+(@[^@]+@\s+)?(\S+)(?: (.*))?$/);
    if (!m) continue;
    const niveau = Number(m[1]);
    const tag = m[3].toUpperCase();
    const valeur = m[4] ?? "";
    if ((tag === "CONT" || tag === "CONC") && pile[niveau - 1]) {
      pile[niveau - 1].valeur += (tag === "CONT" ? "\n" : "") + valeur;
      continue;
    }
    const noeud: Noeud = { niveau, xref: m[2]?.trim() ?? null, tag, valeur, enfants: [] };
    pile.length = niveau;
    if (niveau === 0) racines.push(noeud);
    else pile[niveau - 1]?.enfants.push(noeud);
    pile[niveau] = noeud;
  }
  return racines;
}

export const enfant = (n: Noeud | undefined, tag: string) => n?.enfants.find((e) => e.tag === tag);
export const enfants = (n: Noeud | undefined, tag: string) => n?.enfants.filter((e) => e.tag === tag) ?? [];
export const valeur = (n: Noeud | undefined, tag: string) => enfant(n, tag)?.valeur.trim() || null;

// --- Dates

const MOIS_GEDCOM = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pad = (n: number | string) => String(n).padStart(2, "0");

/** « 12 MAR 1850 » → « 12/03/1850 », « MAR 1850 » → « 03/1850 », « 1850 » → « 1850 ». */
function dateSimpleVersFr(s: string): string | null {
  const m = s.trim().toUpperCase().match(/^(?:(\d{1,2})\s+)?(?:([A-Z]{3})\s+)?(\d{3,4})(?:\/\d{2})?$/);
  if (!m) return null;
  const mois = m[2] ? MOIS_GEDCOM.indexOf(m[2]) + 1 : 0;
  if (m[2] && !mois) return null;
  if (m[1] && mois) return `${pad(m[1])}/${pad(mois)}/${m[3]}`;
  if (mois) return `${pad(mois)}/${m[3]}`;
  return m[3];
}

/** Date GEDCOM → saisie floue de Tabularium (comprise par analyserDate). Les dates non comprises sont gardées telles quelles. */
export function dateDepuisGedcom(g: string | null | undefined): string | null {
  if (!g?.trim()) return null;
  const s = g.trim().replace(/^@#DGREGORIAN@\s*/i, "");
  // Date en clair entre parenthèses (« (vers la fin de l'été 1850) ») : gardée telle quelle.
  if (/^\(.*\)$/.test(s)) return s.slice(1, -1);
  const u = s.toUpperCase();
  let m = u.match(/^(?:ABT|EST|CAL)\s+(.+)$/);
  if (m) return (d => (d ? `vers ${d}` : s))(dateSimpleVersFr(m[1]));
  m = u.match(/^(?:BEF)\s+(.+)$/);
  if (m) return (d => (d ? `avant ${d}` : s))(dateSimpleVersFr(m[1]));
  m = u.match(/^(?:AFT)\s+(.+)$/);
  if (m) return (d => (d ? `après ${d}` : s))(dateSimpleVersFr(m[1]));
  m = u.match(/^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+(.+)$/);
  if (m) {
    const [a, b] = [dateSimpleVersFr(m[1]), dateSimpleVersFr(m[2])];
    return a && b ? `entre ${a} et ${b}` : s;
  }
  m = u.match(/^(?:FROM|TO)\s+(.+)$/);
  if (m) return dateSimpleVersFr(m[1]) ?? s;
  m = u.match(/^INT\s+(.+?)\s*\(.*\)$/);
  if (m) return dateSimpleVersFr(m[1]) ?? s;
  return dateSimpleVersFr(u) ?? s;
}

/** « 12/03/1850 » → « 12 MAR 1850 », « 03/1850 » → « MAR 1850 », « 1850 » → « 1850 ». */
function dateSimpleVersGedcom(s: string): string | null {
  let m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{3,4})$/);
  if (m) return `${+m[1]} ${MOIS_GEDCOM[+m[2] - 1] ?? ""} ${m[3]}`.replace(/\s+/g, " ");
  m = s.trim().match(/^(\d{1,2})[/.-](\d{3,4})$/);
  if (m) return MOIS_GEDCOM[+m[1] - 1] ? `${MOIS_GEDCOM[+m[1] - 1]} ${m[2]}` : null;
  m = s.trim().match(/^(\d{3,4})$/);
  return m ? m[1] : null;
}

const isoVersGedcom = (iso: string) => {
  const [a, mo, j] = iso.split("-").map(Number);
  return `${j} ${MOIS_GEDCOM[mo - 1]} ${a}`;
};

/**
 * Saisie floue de Tabularium → date GEDCOM 5.5.1. On traduit la saisie quand elle est reconnue
 * (vers / avant / après / entre), sinon on se rabat sur les bornes calculées (et la saisie en clair).
 */
export function dateVersGedcom(texte: string | null, min: string | null, max: string | null): string | null {
  const t = (texte ?? "").trim();
  if (t) {
    const s = t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\(.*?\)/g, "").trim();
    const simple = dateSimpleVersGedcom(s);
    if (simple) return simple;
    let m = s.match(/^(?:vers|env\.?|environ|ca\.?|circa|~)\s*(.+)$/);
    if (m && dateSimpleVersGedcom(m[1])) return `ABT ${dateSimpleVersGedcom(m[1])}`;
    m = s.match(/^(?:avant|av\.?)\s*(?:le\s+)?(.+)$/);
    if (m && dateSimpleVersGedcom(m[1])) return `BEF ${dateSimpleVersGedcom(m[1])}`;
    m = s.match(/^(?:apres|ap\.?)\s*(?:le\s+)?(.+)$/);
    if (m && dateSimpleVersGedcom(m[1])) return `AFT ${dateSimpleVersGedcom(m[1])}`;
    m = s.match(/^(?:entre\s+(?:le\s+)?)?(.+?)\s+(?:et|-)\s+(?:le\s+)?(.+)$/);
    if (m && dateSimpleVersGedcom(m[1]) && dateSimpleVersGedcom(m[2])) return `BET ${dateSimpleVersGedcom(m[1])} AND ${dateSimpleVersGedcom(m[2])}`;
  }
  if (min && max) {
    if (min === max) return isoVersGedcom(min);
    if (min.slice(0, 4) === max.slice(0, 4) && min.endsWith("-01-01") && max.endsWith("-12-31")) return min.slice(0, 4);
    return `BET ${isoVersGedcom(min)} AND ${isoVersGedcom(max)}${t ? ` (${t.replace(/[()]/g, "")})` : ""}`.replace(/ \(\)$/, "");
  }
  if (max) return `BEF ${isoVersGedcom(max)}`;
  if (min) return `AFT ${isoVersGedcom(min)}`;
  return t ? `(${t.replace(/[()]/g, "")})` : null;
}

// --- Écriture

/** Lignes GEDCOM : valeurs multi-lignes en CONT, longues en CONC (≤ 200 caractères par ligne). */
export function ligne(niveau: number, tag: string, val?: string | null, xref?: string) {
  const tete = `${niveau}${xref ? ` ${xref}` : ""} ${tag}`;
  if (val == null || val === "") return [tete];
  const lignes: string[] = [];
  val.split(/\r?\n/).forEach((morceau, i) => {
    const decoupes = morceau.match(/[\s\S]{1,200}/g) ?? [""];
    decoupes.forEach((d, k) => {
      if (i === 0 && k === 0) lignes.push(`${tete} ${d}`);
      else lignes.push(`${niveau + 1} ${k === 0 ? "CONT" : "CONC"}${d ? ` ${d}` : ""}`);
    });
  });
  return lignes;
}

/** « Jean Pierre /MARTIN/ » (le nom entre barres obliques). */
export const nomGedcom = (nom: string | null, prenoms: string | null) => `${prenoms ?? ""} /${nom ?? ""}/`.trim();

/** « Jean Pierre /MARTIN/ » → { prenoms, nom }. */
export function lireNom(v: string) {
  const m = v.match(/^(.*?)\/(.*?)\/(.*)$/);
  if (!m) return { prenoms: v.trim() || null, nom: null };
  return { prenoms: `${m[1]} ${m[3]}`.replace(/\s+/g, " ").trim() || null, nom: m[2].trim() || null };
}
