/*
 * Individus de l'arbre qui pourraient correspondre à un relevé non rattaché.
 * Score = ressemblance (nom, prénoms, sexe, dates) + structure de l'acte : si l'enfant de l'acte
 * est déjà rattaché, son père dans l'arbre est le candidat évident pour le relevé « père », etc.
 */
import type { DonneesArbre } from "../data/individus";
import { nomComplet } from "./libelles";

type Personne = DonneesArbre["personnes"][number];

export type ReleveCible = {
  id: string;
  role: string | null;
  nom: string | null;
  nomEcrit: string | null;
  prenoms: string | null;
  prenomsEcrits: string | null;
  sexe: string | null;
  naissanceMin: string | null;
  naissanceMax: string | null;
  relations: string | null;
};

export type ContexteActe = {
  dateMin: string | null;
  dateMax: string | null;
  /** Les autres relevés de l'acte déjà rattachés. */
  autres: { id: string; role: string | null; individuId: string | null }[];
};

export type Candidat = { personne: Personne; score: number; raisons: string[] };

export const SEUIL = 40;

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Clé de nom tolérante aux graphies anciennes : Gouadon ≈ Goüadon ≈ Gouaddon, Thibault ≈ Thibaud. */
export function cleNom(s: string | null | undefined) {
  return sansAccents(s ?? "")
    .replace(/[^a-z]/g, "")
    .replace(/y/g, "i")
    .replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1")
    .replace(/(l[dt]|[dtsxze])$/, "");
}

export const motsPrenoms = (s: string | null | undefined) =>
  sansAccents(s ?? "")
    .split(/[\s,-]+/)
    .map((m) => m.replace(/[^a-z]/g, "").replace(/y/g, "i"))
    .filter(Boolean);

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const an = (d: string | null) => (d ? +d.slice(0, 4) : null);
const role = (r: string | null) => (r ?? "").trim().toLowerCase();

/** Liens attendus : pour un relevé de rôle R, et un autre relevé de rôle R2 rattaché à Y, le candidat est relation(Y). */
type Relation = "pere" | "mere" | "enfant" | "conjoint";
const STRUCTURE: Record<string, Record<string, Relation>> = {
  "père": { enfant: "pere", "défunt": "pere", "mère": "conjoint" },
  "mère": { enfant: "mere", "défunt": "mere", "père": "conjoint" },
  enfant: { "père": "enfant", "mère": "enfant" },
  "époux": { "épouse": "conjoint", "père de l'époux": "enfant", "mère de l'époux": "enfant" },
  "épouse": { "époux": "conjoint", "père de l'épouse": "enfant", "mère de l'épouse": "enfant" },
  "père de l'époux": { "époux": "pere", "mère de l'époux": "conjoint" },
  "mère de l'époux": { "époux": "mere", "père de l'époux": "conjoint" },
  "père de l'épouse": { "épouse": "pere", "mère de l'épouse": "conjoint" },
  "mère de l'épouse": { "épouse": "mere", "père de l'épouse": "conjoint" },
  "défunt": { "conjoint du défunt": "conjoint", "père": "enfant", "mère": "enfant" },
  "conjoint du défunt": { "défunt": "conjoint" },
};
const LIBELLE_RELATION: Record<Relation, string> = { pere: "père", mere: "mère", enfant: "enfant", conjoint: "conjoint" };

/** Prépare l'index de l'arbre une fois, puis évalue autant de relevés que nécessaire. */
export function indexCandidats(d: DonneesArbre) {
  const parId = new Map(d.personnes.map((p) => [p.id, p]));
  const relations = new Map<string, Map<Relation, Set<string>>>();
  const ajouter = (de: string, rel: Relation, vers: string) => {
    if (!relations.has(de)) relations.set(de, new Map());
    const m = relations.get(de)!;
    if (!m.has(rel)) m.set(rel, new Set());
    m.get(rel)!.add(vers);
  };
  for (const f of d.filiations) {
    const parent = parId.get(f.parentId);
    if (!parent) continue;
    ajouter(f.enfantId, parent.sexe === "F" ? "mere" : "pere", f.parentId);
    ajouter(f.parentId, "enfant", f.enfantId);
  }
  for (const c of d.couples) {
    if (!c.b) continue;
    ajouter(c.a, "conjoint", c.b);
    ajouter(c.b, "conjoint", c.a);
  }

  return function candidats(r: ReleveCible, ctx: ContexteActe, max = 3): Candidat[] {
    const nomR = cleNom(r.nom || r.nomEcrit);
    const prenomsR = motsPrenoms(r.prenoms || r.prenomsEcrits);
    const dejaDansActe = new Set(ctx.autres.filter((a) => a.id !== r.id && a.individuId).map((a) => a.individuId!));
    const feu = /\bfeu|\bfeue|\bdéfunt|\bdecede/.test(sansAccents(r.relations ?? ""));

    // Liens structurels : candidats attendus d'après les autres personnes rattachées de l'acte.
    const attendus = new Map<string, string>();
    const regles = STRUCTURE[role(r.role)] ?? {};
    for (const a of ctx.autres) {
      const rel = regles[role(a.role)];
      if (!rel || !a.individuId || a.id === r.id) continue;
      const y = parId.get(a.individuId);
      for (const id of relations.get(a.individuId)?.get(rel) ?? []) {
        attendus.set(id, `${LIBELLE_RELATION[rel]} de ${y ? nomComplet(y) : "?"} (${role(a.role)} de l'acte) dans l'arbre`);
      }
    }

    const res: Candidat[] = [];
    for (const p of d.personnes) {
      if (dejaDansActe.has(p.id)) continue;
      if (r.sexe && p.sexe && (r.sexe === "M" || r.sexe === "F") && (p.sexe === "M" || p.sexe === "F") && r.sexe !== p.sexe) continue;
      let score = 0;
      const raisons: string[] = [];

      const structurel = attendus.get(p.id);
      if (structurel) {
        score += 50;
        raisons.push(structurel);
      }

      const nomP = cleNom(p.nom);
      if (nomR && nomP) {
        if (nomR === nomP) {
          score += 35;
          raisons.push("même nom");
        } else if (nomR.length >= 4 && distance(nomR, nomP) <= (nomR.length >= 7 ? 2 : 1)) {
          score += 20;
          raisons.push("nom proche");
        }
      }

      const prenomsP = motsPrenoms(p.prenoms);
      if (prenomsR.length && prenomsP.length) {
        const communs = prenomsR.filter((m) => prenomsP.some((q) => q === m || (m.length >= 5 && distance(m, q) <= 1)));
        if (communs.length && prenomsR[0] && communs.includes(prenomsR[0])) {
          score += 25;
          raisons.push(`prénom ${communs.join(" ")}`);
        } else if (communs.length) {
          score += 12;
          raisons.push(`prénom ${communs.join(" ")}`);
        }
      }

      // Dates : né après l'acte, ou mort avant (hors « feu »), c'est une autre personne.
      const acteMin = an(ctx.dateMin);
      const acteMax = an(ctx.dateMax ?? ctx.dateMin);
      const naissMin = an(p.naissanceMin);
      const decesMax = an(p.decesMax);
      if (acteMax && naissMin && naissMin > acteMax) score -= 60;
      if (acteMin && decesMax && decesMax < acteMin && !feu) score -= 40;

      const nrMin = an(r.naissanceMin);
      const nrMax = an(r.naissanceMax);
      const npMin = an(p.naissanceMin);
      const npMax = an(p.naissanceMax);
      if (nrMin && nrMax && npMin && npMax) {
        const ecart = Math.max(0, nrMin - npMax, npMin - nrMax);
        if (ecart === 0) {
          score += 15;
          raisons.push("naissance proche");
        } else if (ecart > 5) score -= 25;
      }

      if (score >= SEUIL) res.push({ personne: p, score, raisons });
    }
    return res.sort((a, b) => b.score - a.score).slice(0, max);
  };
}
