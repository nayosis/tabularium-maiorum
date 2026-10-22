/*
 * Mise à jour en direct : chaque navigateur connecté écoute /api/evenements (Server-Sent Events).
 * Après chaque écriture, le serveur diffuse { par, fonction, client } ; les autres navigateurs
 * rechargent alors leurs données.
 */
export type Evenement =
  | { type: "modification"; par: string; fonction: string; client?: string }
  | { type: "restauration"; par: string };

const abonnes = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encodeur = new TextEncoder();

export function diffuser(e: Evenement) {
  const message = encodeur.encode(`data: ${JSON.stringify(e)}\n\n`);
  for (const c of abonnes) {
    try {
      c.enqueue(message);
    } catch {
      abonnes.delete(c);
    }
  }
}

/** Flux d'événements pour un navigateur ; un commentaire régulier garde la connexion ouverte (proxys). */
export function fluxEvenements(signal: AbortSignal) {
  let controleur: ReadableStreamDefaultController<Uint8Array>;
  let battement: ReturnType<typeof setInterval>;
  const fermer = () => {
    clearInterval(battement);
    abonnes.delete(controleur);
  };
  return new ReadableStream<Uint8Array>({
    start(c) {
      controleur = c;
      abonnes.add(c);
      c.enqueue(encodeur.encode(": connecté\n\n"));
      battement = setInterval(() => {
        try {
          c.enqueue(encodeur.encode(": ping\n\n"));
        } catch {
          fermer();
        }
      }, 25_000);
      signal.addEventListener("abort", () => {
        fermer();
        try {
          c.close();
        } catch {
          // déjà fermé
        }
      });
    },
    cancel: fermer,
  });
}

export const nombreAbonnes = () => abonnes.size;
