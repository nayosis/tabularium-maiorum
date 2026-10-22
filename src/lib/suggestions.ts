/*
 * Suggestions de liens familiaux tirées des actes : si une personne est « enfant » dans un acte,
 * les relevés « père » et « mère » du même acte sont ses parents probables ; si elle est « époux »,
 * le relevé « épouse » est son conjoint, et l'acte son acte de mariage ; etc.
 */
import type { ReleveAvecActe } from "../data/releves";

type R = ReleveAvecActe;

export type LienParent = { filiationId: string; acteId: string | null };

export type EtatFiche = {
  id: string;
  pereId: string | null;
  mereId: string | null;
  /** Liens existants vers le père / la mère, pour proposer l'acte qui les établit. */
  liens?: { pere: LienParent | null; mere: LienParent | null };
  acteNaissanceId: string | null;
  acteDecesId: string | null;
  couples: { id: string; conjointId: string | null; acteId: string | null }[];
};

export type SuggestionParent = { type: "parent"; role: "pere" | "mere"; releve: R; source: R; remplace: boolean };
export type SuggestionUnion = { type: "union"; releve: R; source: R; typeUnion: "mariage" | "inconnu"; acteMariage: boolean };
export type SuggestionActeUnion = { type: "acteUnion"; coupleId: string; source: R };
export type SuggestionActe = { type: "acte"; quoi: "naissance" | "deces"; source: R };
/** Le parent est déjà lié : proposer l'acte de reconnaissance / légitimation comme justificatif. */
export type SuggestionActeFiliation = { type: "acteFiliation"; role: "pere" | "mere"; filiationId: string; source: R };
export type Suggestion = SuggestionParent | SuggestionUnion | SuggestionActeUnion | SuggestionActe | SuggestionActeFiliation;

/** Actes qui établissent une filiation après la naissance. */
export const ACTES_FILIATION = ["reconnaissance", "legitimation"];

const role = (r: R) => (r.role ?? "").trim().toLowerCase();

/** Rôles des parents selon le rôle de la personne dans l'acte. */
const PARENTS: Record<string, { pere: string; mere: string }> = {
  enfant: { pere: "père", mere: "mère" },
  "défunt": { pere: "père", mere: "mère" },
  "époux": { pere: "père de l'époux", mere: "mère de l'époux" },
  "épouse": { pere: "père de l'épouse", mere: "mère de l'épouse" },
};

/** Rôle du conjoint selon le rôle de la personne, et nature de l'union. */
const CONJOINTS: Record<string, { role: string; type: "mariage" | "inconnu"; acte: boolean }> = {
  "époux": { role: "épouse", type: "mariage", acte: true },
  "épouse": { role: "époux", type: "mariage", acte: true },
  "défunt": { role: "conjoint du défunt", type: "mariage", acte: false },
  "conjoint du défunt": { role: "défunt", type: "mariage", acte: false },
  "père": { role: "mère", type: "inconnu", acte: false },
  "mère": { role: "père", type: "inconnu", acte: false },
  "père de l'époux": { role: "mère de l'époux", type: "inconnu", acte: false },
  "mère de l'époux": { role: "père de l'époux", type: "inconnu", acte: false },
  "père de l'épouse": { role: "mère de l'épouse", type: "inconnu", acte: false },
  "mère de l'épouse": { role: "père de l'épouse", type: "inconnu", acte: false },
};

const cle = (r: R) => r.individuId ?? `releve:${r.id}`;

export function suggestionsFamille(etat: EtatFiche, relevesPersonne: R[], relevesActes: R[]): Suggestion[] {
  const res: Suggestion[] = [];
  const vus = new Set<string>();
  const unique = (k: string) => (vus.has(k) ? false : (vus.add(k), true));
  const autres = (source: R, roleCherche: string) =>
    relevesActes.filter((r) => r.acteId === source.acteId && r.id !== source.id && role(r) === roleCherche && r.individuId !== etat.id);

  for (const source of relevesPersonne) {
    // Sur une page de table, deux lignes voisines n'ont aucun lien de famille.
    if (source.acteNature === "index") continue;
    const rs = role(source);

    // Parents
    const p = PARENTS[rs];
    if (p) {
      for (const [quel, roleParent] of [["pere", p.pere], ["mere", p.mere]] as const) {
        const actuel = quel === "pere" ? etat.pereId : etat.mereId;
        for (const r of autres(source, roleParent)) {
          if (r.individuId && r.individuId === actuel) {
            const lien = etat.liens?.[quel];
            if (lien && lien.acteId !== source.acteId && ACTES_FILIATION.includes(source.acteType ?? "")) {
              if (unique(`acteFiliation:${lien.filiationId}:${source.acteId}`)) {
                res.push({ type: "acteFiliation", role: quel, filiationId: lien.filiationId, source });
              }
            }
            continue;
          }
          if (unique(`parent:${quel}:${cle(r)}`)) res.push({ type: "parent", role: quel, releve: r, source, remplace: !!actuel });
        }
      }
    }

    // Unions
    const c = CONJOINTS[rs];
    if (c) {
      for (const r of autres(source, c.role)) {
        const acteMariage = c.acte && (!source.acteType || source.acteType === "mariage");
        const existant = r.individuId ? etat.couples.find((x) => x.conjointId === r.individuId) : undefined;
        if (existant) {
          // Union déjà connue : on propose seulement d'y associer l'acte de mariage.
          if (acteMariage && !existant.acteId && unique(`acteUnion:${existant.id}`)) {
            res.push({ type: "acteUnion", coupleId: existant.id, source });
          }
          continue;
        }
        if (unique(`union:${cle(r)}`)) res.push({ type: "union", releve: r, source, typeUnion: c.type, acteMariage });
      }
    }

    // Actes de naissance / décès de la personne
    if (rs === "enfant" && (source.acteType === "naissance" || source.acteType === "bapteme") && etat.acteNaissanceId !== source.acteId) {
      if (unique(`acte:naissance:${source.acteId}`)) res.push({ type: "acte", quoi: "naissance", source });
    }
    if (rs === "défunt" && (source.acteType === "deces" || source.acteType === "sepulture") && etat.acteDecesId !== source.acteId) {
      if (unique(`acte:deces:${source.acteId}`)) res.push({ type: "acte", quoi: "deces", source });
    }
  }
  return res;
}
