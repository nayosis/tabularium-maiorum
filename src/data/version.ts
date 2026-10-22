/*
 * Versions des fiches modifiées à plusieurs : `modifie_le` sert de version.
 * Côté serveur uniquement (importé par les fonctions de src/data/, jamais par le navigateur).
 */
import { query } from "../db/client";
import { Conflit } from "../lib/conflit";
import { utilisateurCourant } from "../../serveur/tracabilite";

type TableVersionnee = "acte" | "releve" | "individu" | "source" | "tache";

/**
 * Refuse l'écriture si la fiche a changé depuis la version connue du navigateur, et que ce changement
 * vient de quelqu'un d'autre (ses propres modifications, depuis un autre formulaire, ne gênent pas).
 * Sans version (`undefined`), aucune vérification.
 */
export async function verifierVersion(table: TableVersionnee, id: string, version: string | null | undefined) {
  if (version === undefined) return;
  const [ligne] = await query(`select modifie_le, modifie_par from ${table} where id = ?`, [id]);
  if (!ligne) return;
  const [le, par] = ligne as [string | null, string | null];
  if (le !== version && par && par !== utilisateurCourant()) throw new Conflit(par, le);
}

/** Version de la fiche après une écriture (renvoyée au navigateur pour l'écriture suivante). */
export async function versionDe(table: TableVersionnee, id: string) {
  const [ligne] = await query(`select modifie_le from ${table} where id = ?`, [id]);
  return { modifieLe: (ligne?.[0] as string | null) ?? null };
}

/** Les colonnes de traçabilité ne viennent jamais du navigateur : remplies par le serveur. */
export function sansTrace<T extends object>(patch: T): T {
  const { creePar: _a, modifiePar: _b, modifieLe: _c, ...reste } = patch as T & { creePar?: unknown; modifiePar?: unknown; modifieLe?: unknown };
  return reste as T;
}
