/**
 * Conflit d'écriture : la fiche a été modifiée par quelqu'un d'autre depuis qu'on l'a ouverte.
 * Levée côté serveur (src/data/version.ts), renvoyée au navigateur avec le statut 409.
 */
export class Conflit extends Error {
  constructor(
    public par: string,
    public le: string | null,
  ) {
    super(`Modifié entre-temps par ${par}`);
  }
}

export type DetailsConflit = { par: string; le: string | null };
