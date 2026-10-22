/** Avant tous les tests : dossier de données temporaire (les tests ne touchent jamais ./data). */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DOSSIER_DONNEES = mkdtempSync(join(tmpdir(), "tabularium-tests-"));
