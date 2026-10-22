import { describe, expect, test } from "bun:test";
import { estPlacee, etapesVie, type SujetParcours } from "../src/lib/parcours";

const lieux = [
  { id: "brissac", nom: "Brissac", departement: "49", latitude: 47.35, longitude: -0.45 },
  { id: "saumur", nom: "Saumur", departement: "49", latitude: 47.26, longitude: -0.08 },
  { id: "angers", nom: "Angers", departement: "49", latitude: null, longitude: null },
];

const henri: SujetParcours = {
  naissance: "28/11/1897", naissanceMin: "1897-11-28", naissanceLieuId: "brissac", acteNaissanceId: null,
  deces: "5/9/1981", decesMin: "1981-09-05", decesLieuId: null, acteDecesId: "acteDeces",
  couples: [{ date: "12/05/1921", dateMin: "1921-05-12", lieuId: "saumur", acteId: null, conjointNom: "Martin", conjointPrenoms: "Jeanne" }],
  enfants: [
    { nom: "Gouadon", prenoms: "Marie", sexe: "F", naissance: "1925", naissanceMin: "1925-01-01", naissanceLieuId: "angers", acteNaissanceId: null },
    { nom: "Gouadon", prenoms: "Pierre", sexe: "M", naissance: "1922", naissanceMin: "1922-01-01", naissanceLieuId: "saumur", acteNaissanceId: null },
  ],
};

describe("etapesVie", () => {
  const etapes = etapesVie(henri, lieux, new Map([["acteDeces", "saumur"]]));

  test("ordre chronologique : naissance, mariage, enfants par date, décès", () => {
    expect(etapes.map((e) => e.libelle)).toEqual([
      "Naissance",
      "Mariage avec Jeanne MARTIN",
      "Naissance d'un fils : Pierre GOUADON",
      "Naissance d'une fille : Marie GOUADON",
      "Décès",
    ]);
  });

  test("lieu de la fiche, sinon lieu de l'acte relié", () => {
    expect(etapes[0].lieu?.nom).toBe("Brissac");
    expect(etapes[4].lieu?.nom).toBe("Saumur"); // décès : lieu pris sur l'acte de décès
  });

  test("étapes non placées (lieu sans coordonnées)", () => {
    expect(etapes.map(estPlacee)).toEqual([true, true, true, false, true]);
  });

  test("sans date : naissance en tête, décès en fin, rien d'inventé", () => {
    const e = etapesVie(
      { ...henri, naissance: null, naissanceMin: null, deces: null, decesMin: null, decesLieuId: "saumur", acteDecesId: null, couples: [], enfants: [] },
      lieux,
      new Map(),
    );
    expect(e.map((x) => [x.quoi, x.date])).toEqual([
      ["naissance", null],
      ["deces", null],
    ]);
  });

  test("personne sans aucune information : aucune étape", () => {
    const vide = { naissance: null, naissanceMin: null, naissanceLieuId: null, acteNaissanceId: null, deces: null, decesMin: null, decesLieuId: null, acteDecesId: null, couples: [], enfants: [] };
    expect(etapesVie(vide, lieux, new Map())).toEqual([]);
  });
});
