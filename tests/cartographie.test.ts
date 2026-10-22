import { describe, expect, test } from "bun:test";
import type { DonneesArbre } from "../src/data/individus";
import type { Personne } from "../src/pages/arbre/disposition";
import {
  couleurGeneration, estPlace, lieuNaissance, lignee, pointsAscendance, pointsDescendance, regrouperParLieu, texteSur,
} from "../src/lib/cartographie";

const p = (id: string, sexe: string | null, naissanceMin: string | null = null, naissanceLieuId: string | null = null, acteNaissanceId: string | null = null): Personne => ({
  id, nom: id, prenoms: null, sexe, naissance: null, naissanceMin, naissanceMax: naissanceMin, deces: null, decesMin: null, decesMax: null,
  pereInconnu: false, mereInconnue: false, sansUnion: false, naissanceLieu: null, naissanceLieuId, decesLieu: null, acteNaissanceId, acteDecesId: null, acteMariage: 0, portrait: null,
});
const f = (enfantId: string, parentId: string) => ({ enfantId, parentId, type: "biologique" });

const lieux = new Map([
  ["brissac", { id: "brissac", nom: "Brissac", departement: "49", latitude: 47.35, longitude: -0.45 }],
  ["angers", { id: "angers", nom: "Angers", departement: "49", latitude: null, longitude: null }],
]);
const lieuActe = new Map<string, string | null>([["acteN", "brissac"]]);
const lieu = (x: Personne) => lieuNaissance(x, lieux, lieuActe);

// grand-père gp, père, mère, moi, 2 enfants (fille née avant le fils), 1 petit-enfant
const d: DonneesArbre = {
  personnes: [
    p("gp", "M"), p("pere", "M", null, "brissac"), p("mere", "F", null, null, "acteN"), p("moi", "M", "1900-01-01", "angers"),
    p("fils", "M", "1930-01-01"), p("fille", "F", "1925-01-01"), p("petit", "M", "1955-01-01"),
  ],
  filiations: [f("pere", "gp"), f("moi", "pere"), f("moi", "mere"), f("fils", "moi"), f("fille", "moi"), f("petit", "fille")],
  couples: [],
};

describe("ascendance", () => {
  const pts = pointsAscendance(d, "moi", 5, lieu);
  test("numéro de génération, relié à l'enfant", () => {
    expect(pts.map((x) => [x.personne.id, x.etiquette, x.relieA])).toEqual([
      ["moi", "0", null],
      ["pere", "1", "moi"],
      ["mere", "1", "moi"],
      ["gp", "2", "pere"],
    ]);
  });
  test("lieu de la fiche, sinon de l'acte de naissance ; placé seulement avec coordonnées", () => {
    expect(pts.map((x) => x.lieu?.nom ?? null)).toEqual(["Angers", "Brissac", "Brissac", null]);
    expect(pts.map(estPlace)).toEqual([false, true, true, false]);
  });
  test("limite de générations", () => {
    expect(pointsAscendance(d, "moi", 1, lieu).map((x) => x.personne.id)).toEqual(["moi", "pere", "mere"]);
  });
});

describe("descendance", () => {
  test("génération-ordre : enfants par date de naissance, puis petits-enfants", () => {
    const pts = pointsDescendance(d, "moi", 5, lieu);
    expect(pts.map((x) => [x.personne.id, x.etiquette, x.relieA])).toEqual([
      ["moi", "0", null],
      ["fille", "1-1", "moi"],
      ["fils", "1-2", "moi"],
      ["petit", "2-1", "fille"],
    ]);
  });
  test("personne inconnue : aucun point", () => {
    expect(pointsDescendance(d, "absent", 3, lieu)).toEqual([]);
  });
});

describe("lisibilité de la carte", () => {
  test("couleur par génération : distincte, noire pour la personne choisie, bornée au-delà de la palette", () => {
    expect(couleurGeneration(0)).toBe("#212529");
    expect(new Set([0, 1, 2, 3, 4, 5, 6].map(couleurGeneration)).size).toBe(7);
    expect(couleurGeneration(40)).toBe(couleurGeneration(12));
  });
  test("texte blanc sur fond foncé, foncé sur fond clair", () => {
    expect(texteSur(couleurGeneration(1))).toBe("#ffffff");
    expect(texteSur(couleurGeneration(5))).toBe("#212529");
  });
  test("regroupement par lieu : seulement les lieux placés, par génération", () => {
    const pts = pointsAscendance(d, "moi", 5, lieu);
    expect(regrouperParLieu(pts).map((g) => [g.lieu.nom, g.points.map((x) => x.personne.id)])).toEqual([["Brissac", ["pere", "mere"]]]);
  });
  test("lignée jusqu'à la personne choisie, en ascendance comme en descendance", () => {
    expect(lignee(pointsAscendance(d, "moi", 5, lieu), "gp")).toEqual(["gp", "pere", "moi"]);
    expect(lignee(pointsDescendance(d, "moi", 5, lieu), "petit")).toEqual(["petit", "fille", "moi"]);
    expect(lignee(pointsAscendance(d, "moi", 5, lieu), "inconnu")).toEqual([]);
  });
});
