/** Doutes « peut-être la même personne » : statuts (« même personne » se règle par la fusion). */
export const STATUTS_DOUTE = [
  { value: "a_verifier", label: "À vérifier", couleur: "orange" },
  { value: "differentes", label: "Personnes différentes", couleur: "gray" },
] as const;
export type StatutDoute = (typeof STATUTS_DOUTE)[number]["value"];
