/*
 * Nouvelle version disponible ? Le serveur interroge la page des versions du dépôt GitHub (au plus deux fois par
 * jour, résultat gardé en mémoire). Aucune donnée n'est envoyée ; désactivable (TABULARIUM_VERIFIER_MISES_A_JOUR=non).
 */
import { comparerVersions, DEPOT_URL, type EtatMiseAJour } from "../src/lib/versions";
import { INSTALLATION, VERIFIER_MISES_A_JOUR, VERSION } from "./config";

const API = DEPOT_URL.replace("https://github.com/", "https://api.github.com/repos/") + "/releases/latest";
const DUREE_CACHE_MS = 12 * 3600 * 1000;
const DUREE_CACHE_ECHEC_MS = 3600 * 1000;

type Derniere = { version: string; url: string; publieeLe: string | null };
let cache: { expire: number; derniere: Derniere | null } | null = null;

/** Dernière version publiée (null si inconnue : hors ligne, GitHub indisponible…). */
export async function derniereVersion(lire: typeof fetch = fetch): Promise<Derniere | null> {
  if (cache && cache.expire > Date.now()) return cache.derniere;
  try {
    const r = await lire(API, {
      headers: { accept: "application/vnd.github+json", "user-agent": `Tabularium/${VERSION}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`GitHub : ${r.status}`);
    const j = (await r.json()) as { tag_name?: string; html_url?: string; published_at?: string };
    if (!j.tag_name) throw new Error("Réponse sans version");
    const derniere = { version: j.tag_name.replace(/^v/i, ""), url: j.html_url ?? `${DEPOT_URL}/releases`, publieeLe: j.published_at ?? null };
    cache = { expire: Date.now() + DUREE_CACHE_MS, derniere };
    return derniere;
  } catch {
    cache = { expire: Date.now() + DUREE_CACHE_ECHEC_MS, derniere: null };
    return null;
  }
}

export const viderCacheMiseAJour = () => {
  cache = null;
};

export async function etatMiseAJour(lire: typeof fetch = fetch): Promise<EtatMiseAJour> {
  const base = { actuelle: VERSION, installation: INSTALLATION, depot: DEPOT_URL };
  if (!VERIFIER_MISES_A_JOUR) return { ...base, verifiee: false };
  const derniere = await derniereVersion(lire);
  return {
    ...base,
    verifiee: !!derniere,
    derniere: derniere?.version ?? null,
    url: derniere?.url ?? null,
    publieeLe: derniere?.publieeLe ?? null,
    disponible: !!derniere && comparerVersions(derniere.version, VERSION) > 0,
  };
}
