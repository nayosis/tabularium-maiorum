/*
 * Homonymes : aux XVIIe et XVIIIe siècles, père, fils et cousins portent souvent les mêmes nom et prénom. On les
 * distingue par une parenthèse : le nom de la mère et l'année de naissance (« VEILLON François (Denault, °1742) »),
 * ou un qualificatif saisi à la main (« l'aîné », « le jeune »), qui prime.
 */

export type PersonneHomonyme = {
  id: string;
  nom: string | null;
  prenoms: string | null;
  qualificatif?: string | null;
  mereId?: string | null;
  naissanceMin: string | null;
  naissanceMax: string | null;
};

export type Distinction = { qualificatif: string | null; mere: string | null; naissance: string | null };

const normaliser = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Même nom et même premier prénom, sans tenir compte des accents ni de la casse. */
export function cleHomonyme(p: Pick<PersonneHomonyme, "nom" | "prenoms">) {
  const nom = p.nom?.trim();
  const prenom = p.prenoms?.trim().split(/[\s-]+/)[0];
  return nom && prenom ? `${normaliser(nom)}|${normaliser(prenom)}` : null;
}

/** « °1742 », ou « °v. 1742 » si la date n'est connue qu'à peu près. */
export function anneeNaissance(p: Pick<PersonneHomonyme, "naissanceMin" | "naissanceMax">) {
  const min = p.naissanceMin?.slice(0, 4);
  const max = p.naissanceMax?.slice(0, 4);
  if (!min && !max) return null;
  if (min && max && min !== max) return `°v. ${Math.round((+min + +max) / 2)}`;
  return `°${min ?? max}`;
}

/** Groupes d'homonymes : clé → ids (seulement les clés partagées par au moins deux personnes). */
export function groupesHomonymes(personnes: PersonneHomonyme[]) {
  const groupes = new Map<string, string[]>();
  for (const p of personnes) {
    const cle = cleHomonyme(p);
    if (cle) groupes.set(cle, [...(groupes.get(cle) ?? []), p.id]);
  }
  for (const [cle, ids] of groupes) if (ids.length < 2) groupes.delete(cle);
  return groupes;
}

/** Ce qui distingue chaque homonyme, et chaque personne qui a un qualificatif. */
export function distinctions(personnes: PersonneHomonyme[]) {
  const parId = new Map(personnes.map((p) => [p.id, p]));
  const homonymes = new Set([...groupesHomonymes(personnes).values()].flat());
  const resultat = new Map<string, Distinction>();
  for (const p of personnes) {
    const qualificatif = p.qualificatif?.trim() || null;
    if (!qualificatif && !homonymes.has(p.id)) continue;
    const mere = (p.mereId && parId.get(p.mereId)?.nom?.trim()) || null;
    const d = { qualificatif, mere, naissance: anneeNaissance(p) };
    if (d.qualificatif || d.mere || d.naissance) resultat.set(p.id, d);
  }
  return resultat;
}

/** Contenu de la parenthèse : « l'aîné », « Denault, °1742 », ou null. `dates` remplace l'année (menus de choix). */
export function mention(d: Distinction | undefined, dates?: string | null) {
  if (d?.qualificatif) return dates ? `${d.qualificatif}, ${dates}` : d.qualificatif;
  return [d?.mere, dates || d?.naissance].filter(Boolean).join(", ") || null;
}

export const suffixe = (d: Distinction | undefined, dates?: string | null) => {
  const m = mention(d, dates);
  return m ? ` (${m})` : "";
};
