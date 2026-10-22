import type { DonneesArbre } from "../../data/individus";

/*
 * Arbre « sablier » : la racine au centre, ses ancêtres au-dessus (numérotés Sosa),
 * ses descendants en dessous. Disposition simple et sans chevauchement : chaque feuille
 * reçoit une colonne, chaque parent est centré au-dessus (ou en dessous) de ses branches.
 */

export type Personne = DonneesArbre["personnes"][number];

export const BOITE = { l: 200, h: 104, ecartX: 24, ecartY: 56 };
export const COLONNE = BOITE.l + BOITE.ecartX;
export const RANG = BOITE.h + BOITE.ecartY;

export type Noeud = {
  cle: string;
  personne: Personne | null;
  /** Case vide « + Père / + Mère » pour compléter l'arbre, ou parent déclaré inconnu. */
  manquant?: { enfantId: string; role: "pere" | "mere"; inconnu: boolean };
  sosa?: number;
  conjoints?: Personne[];
  racine?: boolean;
  /** Vue « famille élargie » : lien de parenté avec la personne choisie (« oncle », « cousine germaine »…). */
  parente?: string;
  x: number;
  y: number;
};

/** Union dont l'enfant est issu, quand le parent a eu des enfants de plusieurs unions. */
export type UnionLien = { rang: number; total: number; conjointId: string | null; teinte: number };

export type Lien = { parent: Noeud; enfant: Noeud; union?: UnionLien };

/** Couleurs des unions successives (traits parent → enfants, noms des conjoints). */
// Ni bleu ni rose : réservés au sexe des personnes.
export const COULEURS_UNIONS = ["#e8590c", "#2f9e44", "#862e3c", "#b08800", "#5f3dc4", "#8d5524"];
// La teinte suit l'ordre des mariages : même couleur pour le trait et pour le nom du conjoint dans la case.
export const couleurUnion = (u: UnionLien) => (u.conjointId ? COULEURS_UNIONS[u.teinte % COULEURS_UNIONS.length] : "#868e96");

export type Options = { ascendants: number; descendants: number };

export function index(d: DonneesArbre) {
  const parId = new Map(d.personnes.map((p) => [p.id, p]));
  const parents = new Map<string, Personne[]>();
  const enfants = new Map<string, Personne[]>();
  for (const f of d.filiations) {
    const p = parId.get(f.parentId);
    const e = parId.get(f.enfantId);
    if (!p || !e) continue;
    parents.set(e.id, [...(parents.get(e.id) ?? []), p]);
    enfants.set(p.id, [...(enfants.get(p.id) ?? []), e]);
  }
  for (const liste of enfants.values()) liste.sort((a, b) => (a.naissanceMin ?? "9999").localeCompare(b.naissanceMin ?? "9999"));

  const conjoints = new Map<string, Personne[]>();
  for (const c of [...d.couples].sort((a, b) => (a.dateMin ?? "9999").localeCompare(b.dateMin ?? "9999"))) {
    if (!c.b) continue;
    const a = parId.get(c.a);
    const b = parId.get(c.b);
    if (!a || !b) continue;
    conjoints.set(a.id, [...(conjoints.get(a.id) ?? []), b]);
    conjoints.set(b.id, [...(conjoints.get(b.id) ?? []), a]);
  }

  /** Père et mère selon le sexe ; un parent de sexe inconnu prend la place libre. */
  const pereMere = (id: string) => {
    const ps = parents.get(id) ?? [];
    let pere = ps.find((p) => p.sexe === "M") ?? null;
    let mere = ps.find((p) => p.sexe === "F") ?? null;
    for (const p of ps.filter((p) => p.sexe !== "M" && p.sexe !== "F")) {
      if (!pere) pere = p;
      else if (!mere) mere = p;
    }
    return { pere, mere };
  };

  /**
   * Enfants regroupés par union (l'autre parent) : conjoints dans l'ordre des mariages,
   * puis autres parents, puis parent inconnu ; par naissance dans chaque groupe.
   */
  const parUnion = (parentId: string, liste: Personne[] = enfants.get(parentId) ?? []) => {
    const ordre = (conjoints.get(parentId) ?? []).map((c) => c.id);
    const autre = (e: Personne) => (parents.get(e.id) ?? []).find((p) => p.id !== parentId)?.id ?? null;
    const groupes = Map.groupBy(liste, autre);
    const poids = (k: string | null) => (k === null ? ordre.length + 1 : ordre.includes(k) ? ordre.indexOf(k) : ordre.length);
    const cles = [...groupes.keys()].sort((a, b) => poids(a) - poids(b));
    const union = new Map<string, UnionLien>();
    cles.forEach((k, rang) => {
      for (const e of groupes.get(k)!) union.set(e.id, { rang, total: cles.length, conjointId: k, teinte: k !== null && ordre.includes(k) ? ordre.indexOf(k) : ordre.length + rang });
    });
    return { enfants: cles.flatMap((k) => groupes.get(k)!), union: cles.length > 1 ? union : null };
  };

  return {
    parId,
    pereMere,
    enfants: (id: string) => enfants.get(id) ?? [],
    conjoints: (id: string) => conjoints.get(id) ?? [],
    parUnion,
  };
}

export function disposerArbre(d: DonneesArbre, racineId: string, opt: Options) {
  const idx = index(d);
  const racine = idx.parId.get(racineId);
  if (!racine) return { noeuds: [] as Noeud[], liens: [] as Lien[] };

  // --- Ascendants (vers le haut) ---
  const noeudsAsc: Noeud[] = [];
  const liensAsc: Lien[] = [];
  let colonne = 0;
  const asc = (p: Personne, gen: number, sosa: number): Noeud => {
    const n: Noeud = { cle: `a${sosa}`, personne: p, sosa, x: 0, y: -gen * RANG || 0 };
    noeudsAsc.push(n);
    if (gen >= opt.ascendants) {
      n.x = colonne++;
      return n;
    }
    const { pere, mere } = idx.pereMere(p.id);
    const branches = (
      [
        [pere, "pere", sosa * 2],
        [mere, "mere", sosa * 2 + 1],
      ] as const
    ).map(([parent, role, s]) => {
      if (parent) return asc(parent, gen + 1, s);
      const inconnu = role === "pere" ? !!p.pereInconnu : !!p.mereInconnue;
      const vide: Noeud = { cle: `a${s}`, personne: null, manquant: { enfantId: p.id, role, inconnu }, sosa: s, x: colonne++, y: -(gen + 1) * RANG };
      noeudsAsc.push(vide);
      return vide;
    });
    for (const b of branches) liensAsc.push({ parent: b, enfant: n });
    n.x = (branches[0].x + branches[1].x) / 2;
    return n;
  };
  const racineAsc = asc(racine, 0, 1);

  // --- Descendants (vers le bas) ---
  const noeudsDesc: Noeud[] = [];
  const liensDesc: Lien[] = [];
  colonne = 0;
  const desc = (p: Personne, gen: number, chemin: string): Noeud => {
    const n: Noeud = { cle: `d${chemin}`, personne: p, conjoints: idx.conjoints(p.id), x: 0, y: gen * RANG };
    noeudsDesc.push(n);
    // Enfants de plusieurs unions : regroupés par union, chaque groupe relié par son propre trait.
    const { enfants, union } = gen < opt.descendants ? idx.parUnion(p.id) : { enfants: [], union: null };
    if (!enfants.length) {
      n.x = colonne++;
      return n;
    }
    const branches = enfants.map((e, i) => desc(e, gen + 1, `${chemin}.${i}`));
    branches.forEach((b, i) => liensDesc.push({ parent: n, enfant: b, union: union?.get(enfants[i].id) }));
    n.x = (branches[0].x + branches[branches.length - 1].x) / 2;
    return n;
  };
  const racineDesc = desc(racine, 0, "0");

  // Alignement des deux moitiés sur la racine, conversion colonnes → unités.
  const decA = racineAsc.x;
  for (const n of noeudsAsc) n.x = (n.x - decA) * COLONNE;
  const decD = racineDesc.x;
  for (const n of noeudsDesc) n.x = (n.x - decD) * COLONNE;

  // Une seule case pour la racine : celle des ascendants, complétée des conjoints.
  racineAsc.racine = true;
  racineAsc.conjoints = racineDesc.conjoints;
  for (const l of liensDesc) if (l.parent === racineDesc) l.parent = racineAsc;

  return {
    noeuds: [...noeudsAsc, ...noeudsDesc.filter((n) => n !== racineDesc)],
    liens: [...liensAsc, ...liensDesc],
  };
}

const annee = (d: string | null) => (d ? +d.slice(0, 4) : null);

/** « 1826 », « ~1826 » (plage), « <1790 », « >1790 » à partir des bornes. */
export function anneeFloue(min: string | null, max: string | null) {
  const a = annee(min);
  const b = annee(max);
  if (a && b) return a === b ? `${a}` : `~${Math.round((a + b) / 2)}`;
  if (b) return `<${b}`;
  if (a) return `>${a}`;
  return "";
}

/** « ° 1897 · Brissac » ; vide si ni date ni lieu. */
export function ligneNaissance(p: Personne) {
  const an = anneeFloue(p.naissanceMin, p.naissanceMax);
  return an || p.naissanceLieu ? `° ${[an, p.naissanceLieu].filter(Boolean).join(" · ")}` : "";
}

/** « † 1981 · Saumur » ; vide si ni date ni lieu. */
export function ligneDeces(p: Personne) {
  const an = anneeFloue(p.decesMin, p.decesMax);
  return an || p.decesLieu ? `† ${[an, p.decesLieu].filter(Boolean).join(" · ")}` : "";
}

export function dates(p: Personne) {
  const n = anneeFloue(p.naissanceMin, p.naissanceMax);
  const d = anneeFloue(p.decesMin, p.decesMax);
  if (!n && !d) return "";
  return `${n || "?"} – ${d}`;
}
