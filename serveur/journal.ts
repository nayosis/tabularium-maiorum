/** Journal des modifications : qui a appelé quelle fonction d'écriture, sur quelle fiche, quand. */
import { baseCourante } from "./base";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fiche concernée : premier identifiant parmi les arguments, sinon celui renvoyé (création). */
function cibleDe(args: unknown[], resultat: unknown) {
  const id = args.find((a) => typeof a === "string" && UUID.test(a));
  if (typeof id === "string") return id;
  return typeof resultat === "string" && UUID.test(resultat) ? resultat : null;
}

/** Résumé lisible des arguments (tronqué) : utile pour savoir ce qui a été changé. */
function resumeDe(args: unknown[]) {
  const texte = JSON.stringify(args.filter((a) => !(typeof a === "string" && UUID.test(a))));
  return texte.length > 400 ? `${texte.slice(0, 399)}…` : texte;
}

export function journaliser(utilisateur: string, fonction: string, args: unknown[], resultat: unknown) {
  try {
    baseCourante()
      .query("INSERT INTO journal (quand, utilisateur, fonction, cible, resume) VALUES (?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), utilisateur, fonction, cibleDe(args, resultat), resumeDe(args));
  } catch (e) {
    // Le journal ne doit jamais faire échouer l'écriture elle-même.
    console.error("Journal :", e);
  }
}

export type LigneJournal = { id: number; quand: string; utilisateur: string; fonction: string; cible: string | null; resume: string | null };

/** 200 lignes au plus, des plus récentes aux plus anciennes ; `avant` : id pour la page suivante. */
export function lireJournal(f: { utilisateur?: string; depuis?: string; avant?: number }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (f.utilisateur) {
    conditions.push("utilisateur = ?");
    params.push(f.utilisateur);
  }
  if (f.depuis) {
    conditions.push("quand >= ?");
    params.push(f.depuis);
  }
  if (f.avant) {
    conditions.push("id < ?");
    params.push(f.avant);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return baseCourante()
    .query<LigneJournal, (string | number)[]>(`SELECT id, quand, utilisateur, fonction, cible, resume FROM journal ${where} ORDER BY id DESC LIMIT 200`)
    .all(...params);
}
