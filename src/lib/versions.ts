/** Dépôt du projet : code source, nouvelles versions, signalement des problèmes. */
export const DEPOT_URL = "https://github.com/nayosis/tabularium-maiorum";

const morceaux = (v: string) => {
  const [base, pre] = v.trim().replace(/^v/i, "").split("-", 2);
  const [a = 0, b = 0, c = 0] = base.split(".").map((n) => Number.parseInt(n, 10) || 0);
  return { nombres: [a, b, c], pre: pre ?? null };
};

/** Compare deux versions « 1.2.3 » (le « v » initial est toléré) : > 0 si a est plus récente que b. */
export function comparerVersions(a: string, b: string) {
  const x = morceaux(a);
  const y = morceaux(b);
  for (let i = 0; i < 3; i++) if (x.nombres[i] !== y.nombres[i]) return x.nombres[i] - y.nombres[i];
  // 1.2.0-beta est antérieure à 1.2.0.
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Comment Tabularium est installé : détermine la façon de le mettre à jour. */
export type Installation = "docker" | "ordinateur" | "source";

/** Réponse de /api/mise-a-jour. */
export type EtatMiseAJour = {
  actuelle: string;
  installation: Installation;
  depot: string;
  /** false : vérification désactivée, ou dépôt injoignable. */
  verifiee: boolean;
  derniere?: string | null;
  url?: string | null;
  publieeLe?: string | null;
  disponible?: boolean;
};
