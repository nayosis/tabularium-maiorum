/*
 * Calendrier républicain (22 septembre 1792 – 31 décembre 1805) : 12 mois de 30 jours, puis 5 ou 6 jours
 * complémentaires (sans-culottides). L'année commence à l'équinoxe d'automne : on utilise la table officielle des
 * débuts d'année (an I à an XIV), pas une formule. Années sextiles (6 jours complémentaires) : III, VII et XI.
 *
 * Formes reconnues (accents et majuscules ignorés) :
 *   3 brumaire an IV · 3 brumaire an 4 · 1er / premier brumaire an IV · 3 brum. an IV · brumaire an IV · an IV
 *   2e jour complémentaire an VII · 2e sans-culottide an VII · jour de la Révolution an III
 */

export type MoisRepublicain = { nom: string; saison: string; sens: string; abreviation: string; debut: string; gedcom: string };

/** `debut` : date grégorienne approximative du 1er du mois (à un jour près selon l'année). */
export const MOIS_REPUBLICAINS: MoisRepublicain[] = [
  { nom: "vendémiaire", saison: "automne", sens: "les vendanges", abreviation: "vend.", debut: "22 septembre", gedcom: "VEND" },
  { nom: "brumaire", saison: "automne", sens: "les brumes", abreviation: "brum.", debut: "22 octobre", gedcom: "BRUM" },
  { nom: "frimaire", saison: "automne", sens: "les frimas", abreviation: "frim.", debut: "21 novembre", gedcom: "FRIM" },
  { nom: "nivôse", saison: "hiver", sens: "la neige", abreviation: "niv.", debut: "21 décembre", gedcom: "NIVO" },
  { nom: "pluviôse", saison: "hiver", sens: "la pluie", abreviation: "pluv.", debut: "20 janvier", gedcom: "PLUV" },
  { nom: "ventôse", saison: "hiver", sens: "le vent", abreviation: "vent.", debut: "19 février", gedcom: "VENT" },
  { nom: "germinal", saison: "printemps", sens: "la germination", abreviation: "germ.", debut: "21 mars", gedcom: "GERM" },
  { nom: "floréal", saison: "printemps", sens: "les fleurs", abreviation: "flor.", debut: "20 avril", gedcom: "FLOR" },
  { nom: "prairial", saison: "printemps", sens: "les prairies", abreviation: "prair.", debut: "20 mai", gedcom: "PRAI" },
  { nom: "messidor", saison: "été", sens: "les moissons", abreviation: "mess.", debut: "19 juin", gedcom: "MESS" },
  { nom: "thermidor", saison: "été", sens: "la chaleur", abreviation: "therm.", debut: "19 juillet", gedcom: "THER" },
  { nom: "fructidor", saison: "été", sens: "les fruits", abreviation: "fruct.", debut: "18 août", gedcom: "FRUC" },
];

/** 1er vendémiaire de chaque année, an I à an XIV (table officielle). */
const DEBUTS = [
  "1792-09-22", "1793-09-22", "1794-09-22", "1795-09-23", "1796-09-22", "1797-09-22", "1798-09-22",
  "1799-09-23", "1800-09-23", "1801-09-23", "1802-09-23", "1803-09-24", "1804-09-23", "1805-09-23",
];
/** Le calendrier est abandonné après le 10 nivôse an XIV. */
export const FIN_CALENDRIER = "1805-12-31";

const jour = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
const depuisJour = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);

export function romain(n: number) {
  const t: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "";
  for (const [v, s] of t) while (n >= v) (r += s), (n -= v);
  return r;
}

/** Années de la table : début, fin, sextile. */
export const ANNEES_REPUBLICAINES = DEBUTS.map((debut, i) => {
  const suivant = DEBUTS[i + 1];
  return {
    an: i + 1,
    romain: romain(i + 1),
    debut,
    fin: suivant ? depuisJour(jour(suivant) - 1) : FIN_CALENDRIER,
    sextile: !!suivant && jour(suivant) - jour(debut) === 366,
  };
});

function lireAn(s: string): number | null {
  if (/^\d{1,2}$/.test(s)) return +s;
  const v: Record<string, number> = { i: 1, v: 5, x: 10 };
  let n = 0;
  for (let k = 0; k < s.length; k++) {
    const a = v[s[k]];
    const b = v[s[k + 1]] ?? 0;
    n += a < b ? -a : a;
  }
  return romain(n).toLowerCase() === s ? n : null;
}

const sansAccents = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "");
/** Début des noms de mois (assez pour les distinguer : vend- / vent-). */
const RACINES = ["vend", "brum", "frim", "niv", "pluv", "vent", "germ", "flor", "prai", "mess", "ther", "fruc"];

/** « brum. », « brumaire », « fructid » → 1..12. */
function lireMois(s: string): number | null {
  const t = s.replace(/\.$/, "");
  const i = MOIS_REPUBLICAINS.findIndex((m, k) => t.startsWith(RACINES[k]) && sansAccents(m.nom).startsWith(t));
  return i < 0 ? null : i + 1;
}

/** Jour j (1..30) du mois m (1..12, ou 13 pour les jours complémentaires) de l'an a → ISO, ou null si impossible. */
export function versGregorien(a: number, m: number, j: number): string | null {
  const annee = ANNEES_REPUBLICAINES[a - 1];
  if (!annee || m < 1 || m > 13 || j < 1) return null;
  if (m <= 12 ? j > 30 : j > (annee.sextile ? 6 : 5)) return null;
  const iso = depuisJour(jour(annee.debut) + (m - 1) * 30 + j - 1);
  return iso > annee.fin ? null : iso;
}

/** ISO → { an, mois (13 = complémentaire), jour }, ou null hors du calendrier. */
export function depuisGregorien(iso: string) {
  if (iso < DEBUTS[0] || iso > FIN_CALENDRIER) return null;
  const i = DEBUTS.findLastIndex((d) => d <= iso);
  const n = jour(iso) - jour(DEBUTS[i]);
  return { an: i + 1, mois: Math.floor(n / 30) + 1, jour: (n % 30) + 1 };
}

/** « 3 brumaire an IV », « 2e jour complémentaire an VII », « jour de la Révolution an III ». */
export function formaterRepublicain(d: { an: number; mois: number; jour: number }) {
  const an = `an ${romain(d.an)}`;
  if (d.mois === 13) return d.jour === 6 ? `jour de la Révolution ${an}` : `${d.jour === 1 ? "1er" : `${d.jour}e`} jour complémentaire ${an}`;
  return `${d.jour === 1 ? "1er" : d.jour} ${MOIS_REPUBLICAINS[d.mois - 1].nom} ${an}`;
}

export const isoVersRepublicain = (iso: string) => {
  const d = depuisGregorien(iso);
  return d ? formaterRepublicain(d) : null;
};

// Sur une chaîne en minuscules sans accents ; la même expression sert à l'analyse et au repérage dans un texte.
const AN = String.raw`(?:de\s+)?(?:l'\s*)?an\s+([ivx]+|\d{1,2})\b`;
const JOUR = String.raw`(\d{1,2})(?:er|eme|e)?|premier`;
const MOIS = String.raw`((?:${RACINES.join("|")})[a-z]*\.?)`;
const SOURCE = [
  String.raw`(?:${JOUR})\s+(?:jours?\s+complementaires?|sans-?\s?culottides?)\s+${AN}`,
  String.raw`jour\s+de\s+la\s+revolution\s+${AN}`,
  String.raw`(?:(?:${JOUR})\s+)?${MOIS}\s+${AN}`,
  AN,
]
  .map((x) => `(${x})`)
  .join("|");
const EXPRESSION = new RegExp(String.raw`(?<![a-z0-9])(?:${SOURCE})`, "g");
const SEULE = new RegExp(`^(?:${SOURCE})$`);

type Plage = { min: string; max: string };
type Analyse = { an: number; mois: number | null; jour: number | null };

/** Groupes : [1] complémentaire (2 jour, 3 an), [4] Révolution (5 an), [6] date (7 jour, 8 mois, 9 an), [10] an (11). */
function analyser(m: RegExpExecArray | RegExpMatchArray): Analyse | null {
  const jourDe = (x: string | undefined, texte: string) => (x ? +x : texte.startsWith("premier") ? 1 : null);
  if (m[1]) {
    const an = lireAn(m[3]);
    return an ? { an, mois: 13, jour: jourDe(m[2], m[1]) } : null;
  }
  if (m[4]) {
    const an = lireAn(m[5]);
    return an ? { an, mois: 13, jour: 6 } : null;
  }
  if (m[6]) {
    const an = lireAn(m[9]);
    const mois = lireMois(m[8]);
    return an && mois ? { an, mois, jour: jourDe(m[7], m[6]) } : null;
  }
  const an = lireAn(m[11]);
  return an ? { an, mois: null, jour: null } : null;
}

function plage(a: Analyse | null): Plage | null {
  const annee = a && ANNEES_REPUBLICAINES[a.an - 1];
  if (!a || !annee) return null;
  if (!a.mois) return { min: annee.debut, max: annee.fin };
  if (a.jour) {
    const iso = versGregorien(a.an, a.mois, a.jour);
    return iso ? { min: iso, max: iso } : null;
  }
  const min = versGregorien(a.an, a.mois, 1);
  return min ? { min, max: versGregorien(a.an, a.mois, 30) ?? annee.fin } : null;
}

/** Une date républicaine seule (jour, mois ou année) → sa plage grégorienne. `s` : minuscules, sans accents. */
export function plageRepublicaine(s: string): Plage | null {
  const m = s.trim().match(SEULE);
  return m ? plage(analyser(m)) : null;
}

const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Plage grégorienne lisible : « 25/10/1795 », « 23/10–21/11/1795 », « 23/09/1795–21/09/1796 ». */
function plageLisible(p: Plage) {
  if (p.min === p.max) return `${jjmm(p.min)}/${p.min.slice(0, 4)}`;
  if (p.min.slice(0, 4) === p.max.slice(0, 4)) return `${jjmm(p.min)}–${jjmm(p.max)}/${p.max.slice(0, 4)}`;
  return `${jjmm(p.min)}/${p.min.slice(0, 4)}–${jjmm(p.max)}/${p.max.slice(0, 4)}`;
}

/** Minuscules sans accents, caractère par caractère : les positions restent celles du texte d'origine. */
const aplatir = (s: string) => [...s].map((c) => c.normalize("NFD")[0].toLowerCase()).join("");

/**
 * Le texte, chaque date républicaine remplacée par son équivalent grégorien ; null s'il n'y en a pas.
 * « vers 3 brumaire an IV » → « vers 25/10/1795 ». `ecrire` choisit la forme de chaque remplacement
 * (par défaut, le grégorien seul).
 */
export function convertirTexte(
  texte: string | null | undefined,
  ecrire: (gregorien: string, republicain: string) => string = (g) => g,
): string | null {
  if (!texte) return null;
  const s = texte.normalize("NFC");
  let resultat = "";
  let pos = 0;
  for (const m of aplatir(s).matchAll(EXPRESSION)) {
    const p = plage(analyser(m));
    if (!p) continue;
    resultat += s.slice(pos, m.index) + ecrire(plageLisible(p), s.slice(m.index, m.index + m[0].length));
    pos = m.index + m[0].length;
  }
  return pos ? resultat + s.slice(pos) : null;
}

/** GEDCOM : « 3 brumaire an iv » → « @#DFRENCH R@ 3 BRUM 4 » (date simple seulement). `s` : minuscules, sans accents. */
export function republicainVersGedcom(s: string): string | null {
  const m = s.trim().match(SEULE);
  const a = m ? analyser(m) : null;
  if (!a || !plage(a)) return null;
  const mois = a.mois === 13 ? "COMP" : a.mois ? MOIS_REPUBLICAINS[a.mois - 1].gedcom : null;
  return ["@#DFRENCH R@", a.jour, mois, a.an].filter(Boolean).join(" ");
}

/** GEDCOM : « 3 BRUM 4 » (après « @#DFRENCH R@ ») → « 3 brumaire an IV ». */
export function republicainDepuisGedcom(s: string): string | null {
  const m = s.trim().toUpperCase().match(/^(?:(\d{1,2})\s+)?(?:([A-Z]{4})\s+)?(\d{1,2})$/);
  if (!m) return null;
  const an = +m[3];
  if (!ANNEES_REPUBLICAINES[an - 1]) return null;
  if (!m[2]) return m[1] ? null : `an ${romain(an)}`;
  if (m[2] === "COMP") return m[1] ? formaterRepublicain({ an, mois: 13, jour: +m[1] }) : null;
  const mois = MOIS_REPUBLICAINS.findIndex((x) => x.gedcom === m[2]) + 1;
  if (!mois) return null;
  return m[1] ? formaterRepublicain({ an, mois, jour: +m[1] }) : `${MOIS_REPUBLICAINS[mois - 1].nom} an ${romain(an)}`;
}
