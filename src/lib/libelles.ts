export const TYPES_ACTE = [
  { value: "naissance", label: "Naissance" },
  { value: "bapteme", label: "Baptême" },
  { value: "mariage", label: "Mariage" },
  { value: "deces", label: "Décès" },
  { value: "sepulture", label: "Sépulture" },
  { value: "reconnaissance", label: "Reconnaissance" },
  { value: "legitimation", label: "Légitimation" },
  { value: "recensement", label: "Recensement" },
  { value: "matricule", label: "Registre matricule" },
  { value: "notarie", label: "Acte notarié" },
  { value: "autre", label: "Autre" },
];

/** Index : pages de tables ou de répertoires, dont chaque ligne renvoie à un acte. */
export const TYPES_INDEX = [
  { value: "table_decennale", label: "Table décennale" },
  { value: "table_alphabetique", label: "Table alphabétique de registre" },
  { value: "table_matricule", label: "Table alphabétique du registre matricule" },
  { value: "repertoire_notaire", label: "Répertoire de notaire" },
  { value: "table_successions", label: "Table des successions et absences" },
  { value: "autre_index", label: "Autre index" },
];

export const NATURES = [
  { value: "acte", label: "Acte" },
  { value: "index", label: "Index / table" },
  { value: "photo", label: "Photo" },
];

export const libelleType = (nature: string | null | undefined, type: string | null | undefined) =>
  nature === "photo" ? "" : libelle(nature === "index" ? TYPES_INDEX : TYPES_ACTE, type);

/** Rôles d'une ligne d'index, et la date d'événement qu'elle porte. */
export const EVENEMENT_INDEX: Record<string, "naissance" | "deces" | "mariage"> = {
  enfant: "naissance",
  "défunt": "deces",
  "époux": "mariage",
  "épouse": "mariage",
};

export const STATUTS_ACTE = [
  { value: "a_transcrire", label: "À transcrire", couleur: "gray" },
  { value: "a_analyser", label: "À analyser", couleur: "orange" },
  { value: "en_cours", label: "En cours", couleur: "blue" },
  { value: "exploite", label: "Exploité", couleur: "green" },
];

export const ROLES = [
  "enfant", "père", "mère", "parrain", "marraine", "époux", "épouse",
  "père de l'époux", "mère de l'époux", "père de l'épouse", "mère de l'épouse",
  "défunt", "conjoint du défunt", "témoin", "déclarant", "officier", "conscrit", "autre",
];

/** Rôles proposés selon le document (on peut toujours en saisir un autre). */
const ROLES_RECENSEMENT = [
  "chef de ménage", "épouse", "fils", "fille", "père", "mère", "beau-père", "belle-mère", "gendre", "belle-fille",
  "petit-fils", "petite-fille", "frère", "sœur", "neveu", "nièce", "domestique", "pensionnaire", "autre",
];
const ROLES_NOTARIE = [
  "vendeur", "acquéreur", "testateur", "légataire", "donateur", "donataire", "futur époux", "future épouse",
  "débiteur", "créancier", "héritier", "partie", "témoin", "notaire", "autre",
];
export function rolesPour(nature: string | null, type: string | null): string[] {
  if (nature === "index") return type === "table_matricule" ? ["conscrit"] : ["enfant", "défunt", "époux", "épouse"];
  if (type === "matricule") return ["conscrit", "autre"];
  if (type === "recensement") return ROLES_RECENSEMENT;
  if (type === "notarie") return ROLES_NOTARIE;
  return ROLES;
}

/** Rôles désignant la personne principale de l'acte (pour le titre automatique). */
export const ROLES_PRINCIPAUX = ["enfant", "défunt", "époux", "épouse", "conscrit", "chef de ménage", "testateur"];

export const SIGNATURES = [
  { value: "signe", label: "A signé" },
  { value: "ne_sait_pas", label: "Ne sait pas signer" },
  { value: "non_precise", label: "Non précisé" },
];

export const CONFIANCES = [
  { value: "certain", label: "Certain" },
  { value: "probable", label: "Probable" },
  { value: "hypothese", label: "Hypothèse" },
];

export const SEXES = [
  { value: "M", label: "Homme" },
  { value: "F", label: "Femme" },
  { value: "?", label: "?" },
];

export const TYPES_FILIATION = [
  { value: "biologique", label: "Biologique" },
  { value: "adoptive", label: "Adoptive" },
  { value: "reconnue", label: "Reconnaissance" },
  { value: "legitimee", label: "Légitimation" },
  { value: "putative", label: "Supposée" },
];

export const libelle = (liste: { value: string; label: string }[], v: string | null | undefined) =>
  liste.find((x) => x.value === v)?.label ?? v ?? "";

/** Couleur de surlignage par rôle. */
export function couleurRole(role: string | null | undefined): string {
  const r = (role ?? "").toLowerCase();
  if (r === "enfant" || r === "défunt" || r === "conscrit" || r === "chef de ménage" || r === "testateur" || r.startsWith("époux") || r.startsWith("épouse"))
    return "#f59f00";
  if (r.startsWith("père")) return "#1c7ed6";
  if (r.startsWith("mère")) return "#d6336c";
  if (r === "parrain" || r === "marraine") return "#7048e8";
  if (r === "témoin" || r === "déclarant") return "#2f9e44";
  return "#868e96";
}

export const nomComplet = (p: { nom?: string | null; prenoms?: string | null }) =>
  [p.nom?.toUpperCase(), p.prenoms].filter(Boolean).join(" ") || "(sans nom)";

/** « Brissac (49) » : nom de la commune, avec son département s'il est connu. */
export const libelleLieu = (l: { nom: string; departement: string | null }) => (l.departement ? `${l.nom} (${l.departement})` : l.nom);
