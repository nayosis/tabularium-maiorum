/** Listes de valeurs des recherches et des sources (partagées par le serveur et l'interface). */

export const TYPES_RECHERCHE = [
  { value: "naissance", label: "Naissance" },
  { value: "mariage", label: "Mariage" },
  { value: "deces", label: "Décès" },
  { value: "autre", label: "Autre" },
];

export const STATUTS_RECHERCHE = [
  { value: "a_faire", label: "À faire", couleur: "gray" },
  { value: "en_cours", label: "En cours", couleur: "blue" },
  { value: "trouve", label: "Trouvé", couleur: "teal" },
  { value: "abandonne", label: "Abandonné", couleur: "dark" },
];

export const RESULTATS = [
  { value: "rien", label: "Rien trouvé", couleur: "gray" },
  { value: "piste", label: "Piste", couleur: "yellow" },
  { value: "trouve", label: "Trouvé", couleur: "teal" },
  { value: "lacune", label: "Lacune / illisible", couleur: "orange" },
];

export const TYPES_SOURCE = [
  "Table décennale",
  "Registre d'état civil",
  "Registre paroissial",
  "Recensement",
  "Registre matricule",
  "Archives notariales",
  "Presse",
  "Base en ligne (Geneanet, Filae…)",
  /** Papiers de famille (classeur perso, boîte du grenier…) : pas de service d'archives ni de cote. */
  "Archives familiales",
  "Album photo",
  "Autre",
];
