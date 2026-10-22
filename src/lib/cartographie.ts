/*
 * Cartographie : ascendance ou descendance d'une personne, placée sur les lieux de naissance.
 * Ascendance : étiquette = numéro de génération (1 = parents, 2 = grands-parents…).
 * Descendance : étiquette = « génération-ordre » (1-1, 1-2 pour les enfants ; 2-x pour les petits-enfants).
 */
import type { DonneesArbre } from "../data/individus";
import { index, type Personne } from "../pages/arbre/disposition";
import type { LieuGps } from "./parcours";

export type PointCarte = {
  personne: Personne;
  generation: number;
  etiquette: string;
  lieu: LieuGps | null;
  /** Personne à laquelle relier ce point (l'enfant en ascendance, le parent en descendance). */
  relieA: string | null;
};

/** Lieu de naissance : celui de la fiche, sinon celui de l'acte de naissance relié. */
export function lieuNaissance(p: Personne, lieux: Map<string, LieuGps>, lieuActe: Map<string, string | null>): LieuGps | null {
  const id = p.naissanceLieuId ?? (p.acteNaissanceId ? lieuActe.get(p.acteNaissanceId) ?? null : null);
  return id ? lieux.get(id) ?? null : null;
}

const parNaissance = (a: Personne, b: Personne) => (a.naissanceMin ?? "9999").localeCompare(b.naissanceMin ?? "9999");

export function pointsAscendance(d: DonneesArbre, racineId: string, generations: number, lieu: (p: Personne) => LieuGps | null): PointCarte[] {
  const idx = index(d);
  const racine = idx.parId.get(racineId);
  if (!racine) return [];
  const points: PointCarte[] = [{ personne: racine, generation: 0, etiquette: "0", lieu: lieu(racine), relieA: null }];
  // Un ancêtre qui apparaît par deux chemins (implexe) n'est placé qu'une fois, à sa génération la plus proche.
  const vus = new Set([racineId]);
  let courante = [racine];
  for (let g = 1; g <= generations && courante.length; g++) {
    const suivante: Personne[] = [];
    for (const enfant of courante) {
      const { pere, mere } = idx.pereMere(enfant.id);
      for (const p of [pere, mere]) {
        if (!p || vus.has(p.id)) continue;
        vus.add(p.id);
        suivante.push(p);
        points.push({ personne: p, generation: g, etiquette: String(g), lieu: lieu(p), relieA: enfant.id });
      }
    }
    courante = suivante;
  }
  return points;
}

export function pointsDescendance(d: DonneesArbre, racineId: string, generations: number, lieu: (p: Personne) => LieuGps | null): PointCarte[] {
  const idx = index(d);
  const racine = idx.parId.get(racineId);
  if (!racine) return [];
  const points: PointCarte[] = [{ personne: racine, generation: 0, etiquette: "0", lieu: lieu(racine), relieA: null }];
  const vus = new Set([racineId]);
  let courante = [racine];
  for (let g = 1; g <= generations && courante.length; g++) {
    const suivante: Personne[] = [];
    let ordre = 0;
    // Ordre : par famille (dans l'ordre de la génération précédente), puis par date de naissance.
    for (const parent of courante) {
      for (const e of [...idx.enfants(parent.id)].sort(parNaissance)) {
        if (vus.has(e.id)) continue;
        vus.add(e.id);
        suivante.push(e);
        points.push({ personne: e, generation: g, etiquette: `${g}-${++ordre}`, lieu: lieu(e), relieA: parent.id });
      }
    }
    courante = suivante;
  }
  return points;
}

export const estPlace = (p: PointCarte) => p.lieu?.latitude != null && p.lieu?.longitude != null;

/*
 * Couleur par génération : violet → bleu → vert → jaune (à grands pas, pour bien distinguer les premières générations),
 * puis orange, rouge et bruns pour les plus anciennes. La personne choisie est en noir.
 */
const PALETTE = [
  "#212529", "#5c1a8c", "#3b62c4", "#1f9e89", "#5ec962", "#c8e020", "#fdb32f", "#f07f2e", "#d8456c", "#a2307e", "#8c510a", "#543005", "#868e96",
];
export const couleurGeneration = (g: number) => PALETTE[Math.max(0, Math.min(g, PALETTE.length - 1))];

/** Texte lisible sur une couleur de fond (#rrggbb) : blanc sur fond foncé, foncé sur fond clair. */
export function texteSur(fond: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(fond.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#212529" : "#ffffff";
}

/** Une pastille par lieu : les personnes placées, regroupées par lieu, par génération croissante. */
export function regrouperParLieu(points: PointCarte[]) {
  const groupes = Map.groupBy(points.filter(estPlace), (p) => p.lieu!.id);
  return [...groupes.values()].map((pts) => ({ lieu: pts[0].lieu!, points: [...pts].sort((a, b) => a.generation - b.generation) }));
}

/** Lignée d'une personne jusqu'à la personne choisie (en suivant `relieA`), elle comprise. */
export function lignee(points: PointCarte[], id: string): string[] {
  const parId = new Map(points.map((p) => [p.personne.id, p]));
  const chaine: string[] = [];
  for (let p = parId.get(id); p && !chaine.includes(p.personne.id); p = p.relieA ? parId.get(p.relieA) : undefined) chaine.push(p.personne.id);
  return chaine;
}
