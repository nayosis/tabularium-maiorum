/*
 * Registre matricule (service militaire, classes 1867 à 1940 environ) : ce qu'on relève sur la fiche d'un conscrit,
 * et sa présentation (signalement, décision, adresses successives).
 */

export type AdresseMilitaire = { date: string | null; lieu: string };

export type Militaire = {
  // Identification
  classe?: string | null;
  matricule?: string | null;
  bureau?: string | null;
  canton?: string | null;
  tirage?: string | null;
  // Signalement
  taille?: string | null;
  cheveux?: string | null;
  sourcils?: string | null;
  yeux?: string | null;
  front?: string | null;
  nez?: string | null;
  bouche?: string | null;
  menton?: string | null;
  visage?: string | null;
  marques?: string | null;
  instruction?: string | null;
  // Décision et services
  decision?: string | null;
  motif?: string | null;
  services?: string | null;
  mortPourLaFrance?: boolean | null;
  // Localités successives habitées
  adresses?: AdresseMilitaire[] | null;
};

export const DEGRES_INSTRUCTION = [
  { value: "0", label: "0 — ne sait ni lire ni écrire" },
  { value: "1", label: "1 — sait lire seulement" },
  { value: "2", label: "2 — sait lire et écrire" },
  { value: "3", label: "3 — instruction primaire plus développée" },
  { value: "4", label: "4 — brevet de l'enseignement primaire" },
  { value: "5", label: "5 — bachelier, licencié…" },
  { value: "X", label: "X — non vérifié" },
];

export const DECISIONS_CONSEIL = [
  { value: "bon", label: "Bon pour le service" },
  { value: "bon_auxiliaire", label: "Service auxiliaire" },
  { value: "ajourne", label: "Ajourné" },
  { value: "exempte", label: "Exempté" },
  { value: "dispense", label: "Dispensé" },
  { value: "reforme", label: "Réformé" },
  { value: "autre", label: "Autre" },
];

/** Champs du signalement, dans l'ordre de la fiche matricule. */
export const SIGNALEMENT: { cle: keyof Militaire; label: string }[] = [
  { cle: "cheveux", label: "Cheveux" },
  { cle: "sourcils", label: "Sourcils" },
  { cle: "yeux", label: "Yeux" },
  { cle: "front", label: "Front" },
  { cle: "nez", label: "Nez" },
  { cle: "bouche", label: "Bouche" },
  { cle: "menton", label: "Menton" },
  { cle: "visage", label: "Visage" },
];

const rempli = (v: unknown) => v != null && v !== "" && !(Array.isArray(v) && !v.length);

/** Le relevé contient-il quelque chose du service militaire ? */
export const aDuMilitaire = (m: Militaire | null | undefined) => !!m && Object.values(m).some(rempli);

/** « 1,65 m · cheveux châtains · yeux gris · visage ovale · cicatrice au front » */
export function signalement(m: Militaire) {
  const taille = m.taille?.trim();
  return [
    taille && (/^\d+([.,]\d+)?$/.test(taille) ? `${taille.replace(".", ",")} m` : taille),
    ...SIGNALEMENT.map((s) => {
      const v = (m[s.cle] as string | null | undefined)?.trim();
      return v ? `${s.label.toLowerCase()} ${v}` : null;
    }),
    m.marques?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** « Classe 1897 · matricule 1234 · bureau d'Angers » */
export function identification(m: Militaire) {
  return [m.classe && `Classe ${m.classe}`, m.matricule && `matricule ${m.matricule}`, m.bureau && `bureau ${m.bureau}`, m.canton && `canton ${m.canton}`]
    .filter(Boolean)
    .join(" · ");
}

export const libelleDecision = (m: Militaire) => {
  const d = DECISIONS_CONSEIL.find((x) => x.value === m.decision)?.label ?? m.decision;
  return [d, m.motif?.trim()].filter(Boolean).join(" — ");
};

/** Base des morts pour la France (service public) : on y cherche par nom et prénom. */
export const MEMOIRE_DES_HOMMES = "https://www.memoiredeshommes.sga.defense.gouv.fr/";
