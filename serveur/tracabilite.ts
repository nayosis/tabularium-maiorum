/*
 * Traçabilité : qui a créé / modifié chaque ligne, et quand.
 *
 * L'utilisateur de la requête en cours est porté par un contexte asynchrone (AsyncLocalStorage).
 * Avant chaque écriture, l'exécuteur SQL le recopie dans une table temporaire `contexte` ;
 * des déclencheurs (temporaires, propres à la connexion) remplissent alors cree_par, modifie_par
 * et modifie_le, sans que les fonctions de src/data/ aient à s'en occuper.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Database } from "bun:sqlite";

export type Contexte = { utilisateur: string; client?: string };
export const contexteRequete = new AsyncLocalStorage<Contexte>();
export const utilisateurCourant = () => contexteRequete.getStore()?.utilisateur ?? null;

/** Tables suivies (colonnes cree_par, modifie_par, modifie_le). */
export const TABLES_SUIVIES = ["acte", "releve", "individu", "source", "tache", "consultation", "lieu", "couple", "filiation", "annotation", "doute"];

const MAINTENANT = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Installe la table de contexte et les déclencheurs sur cette connexion (après les migrations). */
export function installerTracabilite(base: Database) {
  base.exec("CREATE TEMP TABLE IF NOT EXISTS contexte (utilisateur TEXT)");
  if (!base.query("SELECT 1 FROM temp.contexte").get()) base.exec("INSERT INTO temp.contexte VALUES (NULL)");
  for (const t of TABLES_SUIVIES) {
    base.exec(`
      CREATE TEMP TRIGGER IF NOT EXISTS trace_${t}_creation AFTER INSERT ON main.${t}
      BEGIN
        UPDATE main.${t} SET cree_par = (SELECT utilisateur FROM temp.contexte), modifie_par = (SELECT utilisateur FROM temp.contexte),
          modifie_le = ${MAINTENANT}
        WHERE rowid = NEW.rowid;
      END;
      CREATE TEMP TRIGGER IF NOT EXISTS trace_${t}_modification AFTER UPDATE ON main.${t}
      WHEN NEW.modifie_le IS OLD.modifie_le
      BEGIN
        UPDATE main.${t} SET modifie_par = (SELECT utilisateur FROM temp.contexte), modifie_le = ${MAINTENANT}
        WHERE rowid = NEW.rowid;
      END;
    `);
  }
}

/** Recopie l'utilisateur de la requête en cours dans la table de contexte (avant une écriture). */
export function fixerContexte(base: Database) {
  base.query("UPDATE temp.contexte SET utilisateur = ?").run(utilisateurCourant());
}
