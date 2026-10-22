/** Erreur renvoyée par le serveur (message lisible, statut HTTP). */
export class ErreurServeur extends Error {
  constructor(
    message: string,
    public statut: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Identifiant de cet onglet : il ne se recharge pas pour les événements de ses propres écritures. */
export const ID_CLIENT = crypto.randomUUID();

type Rappel = (e: ErreurServeur) => void;
const PAGES_PUBLIQUES = ["/connexion", "/lien/"];
let surNonConnecte: Rappel = () => {
  if (PAGES_PUBLIQUES.some((p) => location.pathname.startsWith(p))) return;
  location.assign(`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`);
};
/** Que faire quand la session a expiré (par défaut : page de connexion). */
export const definirSurNonConnecte = (f: Rappel) => {
  surNonConnecte = f;
};

/** Appel JSON vers l'API. L'en-tête X-Tabularium protège des requêtes forgées depuis un autre site. */
export async function appelApi<T>(chemin: string, options: { methode?: string; corps?: unknown; silencieux?: boolean } = {}): Promise<T> {
  const r = await fetch(chemin, {
    method: options.methode ?? (options.corps === undefined ? "GET" : "POST"),
    headers: { "content-type": "application/json", "x-tabularium": "1", "x-client": ID_CLIENT },
    credentials: "same-origin",
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  });
  const corps = (await r.json().catch(() => ({}))) as { erreur?: string; details?: unknown };
  if (!r.ok) {
    const e = new ErreurServeur(corps.erreur ?? `Erreur ${r.status}`, r.status, corps.details);
    // Session expirée en cours d'utilisation : retour à la page de connexion.
    if (r.status === 401 && !options.silencieux) surNonConnecte(e);
    throw e;
  }
  return corps as T;
}

/**
 * Appelle une fonction de src/data/ exécutée par le serveur. Les `undefined` en fin de liste
 * sont retirés : le serveur applique alors les valeurs par défaut des paramètres.
 */
export async function rpc(nom: string, args: unknown[]) {
  const a = [...args];
  while (a.length && a[a.length - 1] === undefined) a.pop();
  const { resultat } = await appelApi<{ resultat: unknown }>(`/api/rpc/${nom}`, { corps: { args: a } });
  return resultat;
}
