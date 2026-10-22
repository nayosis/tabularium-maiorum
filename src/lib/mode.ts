/**
 * Compte en lecture seule : aucune écriture possible, les formulaires sont figés.
 * Fixé une fois au démarrage, d'après le rôle de l'utilisateur connecté (avant le premier affichage).
 */
export let LECTURE_SEULE = false;

export const definirLectureSeule = (v: boolean) => {
  LECTURE_SEULE = v;
};
