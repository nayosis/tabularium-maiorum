import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { installerExecuteur, type Executeur, type Statement } from "../src/db/client";
import { fixerContexte, installerTracabilite } from "./tracabilite";

/** Exécuteur SQL sur une base bun:sqlite : celui qu'utilisent les fonctions de src/data/ (via Drizzle). */
export function executeurSqlite(base: Database, suivie = false): Executeur {
  const une = (st: Statement) => {
    const q = base.prepare(st.sql);
    try {
      // Drizzle passe parfois des booléens : SQLite veut des entiers.
      const params = st.params.map((p) => (typeof p === "boolean" ? Number(p) : p)) as never[];
      if (q.columnNames.length === 0) {
        // Écriture : l'utilisateur de la requête, pour les déclencheurs de traçabilité.
        if (suivie) fixerContexte(base);
        q.run(...params);
        return [];
      }
      return q.values(...params) as unknown[][];
    } finally {
      // Libérée tout de suite : sinon la base ne peut pas être fermée (restauration).
      q.finalize();
    }
  };
  const transaction = base.transaction((sts: Statement[]) => sts.map(une));
  return { query: une, batch: (sts) => transaction(sts) };
}

let courante: Database | null = null;

/** Base généalogique ouverte (pour la sauvegarde et la restauration). */
export const baseCourante = () => {
  if (!courante) throw new Error("Base de données non ouverte");
  return courante;
};

/**
 * Ouvre (ou crée) la base généalogique, applique les migrations, installe la traçabilité
 * et l'exécuteur pour src/data/.
 */
export function ouvrirBase(chemin: string, migrations: string) {
  const base = new Database(chemin, { create: true });
  base.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  const appliquees = migrer(base, migrations);
  installerTracabilite(base);
  installerExecuteur(executeurSqlite(base, true));
  courante = base;
  return { base, appliquees };
}

/** Ferme la base (avant de la remplacer par une sauvegarde). */
export function fermerBase() {
  if (!courante) return;
  courante.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  courante.close(true);
  courante = null;
}

/**
 * Applique les migrations manquantes (fichiers drizzle/*.sql, découpés comme drizzle-kit les écrit).
 * Renvoie les noms des migrations appliquées.
 */
export function migrer(base: Database, dossier: string) {
  base.exec("CREATE TABLE IF NOT EXISTS __migrations (nom TEXT PRIMARY KEY, appliquee_le TEXT NOT NULL DEFAULT (datetime('now')))");
  const faites = new Set(base.query("SELECT nom FROM __migrations").values().map((r) => r[0] as string));
  const aFaire = readdirSync(dossier)
    .filter((f) => f.endsWith(".sql") && !faites.has(f))
    .sort();
  for (const nom of aFaire) {
    const instructions = readFileSync(join(dossier, nom), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    base.transaction(() => {
      for (const sql of instructions) base.exec(sql);
      base.query("INSERT INTO __migrations (nom) VALUES (?)").run(nom);
    })();
  }
  return aFaire;
}
