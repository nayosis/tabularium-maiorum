/** Erreur métier renvoyée telle quelle au navigateur (message lisible, statut HTTP). */
export class ErreurMetier extends Error {
  constructor(
    message: string,
    public statut = 400,
    public details?: unknown,
  ) {
    super(message);
  }
}
