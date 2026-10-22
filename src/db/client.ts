import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

type Rows = unknown[][];
export type Statement = { sql: string; params: unknown[] };

/**
 * Exécute réellement le SQL. Installé au démarrage par le serveur (bun:sqlite) et par les tests ;
 * le navigateur n'y accède jamais : il appelle les fonctions de src/data/ par RPC.
 */
export type Executeur = {
  query: (st: Statement) => Rows;
  /** Plusieurs instructions dans une même transaction. */
  batch: (sts: Statement[]) => Rows[];
};

let executeur: Executeur | null = null;
export const installerExecuteur = (e: Executeur) => {
  executeur = e;
};
const exec = () => {
  if (!executeur) throw new Error("Base de données non initialisée");
  return executeur;
};

export const query = async (sql: string, params: unknown[] = []) => exec().query({ sql, params });

export const batch = async (statements: Statement[]) => exec().batch(statements);

/** Drizzle en mode « proxy » : le SQL généré est exécuté par l'exécuteur installé. */
export const db = drizzle(
  async (sql, params, method) => {
    const rows = await query(sql, params);
    return { rows: method === "get" ? (rows[0] ?? undefined) : rows } as { rows: any };
  },
  async (queries) => {
    const results = await batch(queries.map((q) => ({ sql: q.sql, params: q.params })));
    return results.map((rows, i) => ({
      rows: queries[i].method === "get" ? (rows[0] ?? undefined) : rows,
    })) as { rows: any }[];
  },
  { schema },
);

export const newId = () => crypto.randomUUID();
