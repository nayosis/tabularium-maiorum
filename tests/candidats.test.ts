import { describe, expect, test } from "bun:test";
import type { DonneesArbre } from "../src/data/individus";
import { cleNom, indexCandidats, type ReleveCible } from "../src/lib/candidats";

const p = (id: string, nom: string, prenoms: string, sexe: string | null, naiss: string | null = null, deces: string | null = null) => ({
  id, nom, prenoms, sexe, naissance: naiss, naissanceMin: naiss, naissanceMax: naiss, deces, decesMin: deces, decesMax: deces,
  pereInconnu: false, mereInconnue: false,
});

const donnees: DonneesArbre = {
  personnes: [
    p("aimable", "Gouadon", "Aimable René", "M", "1785-03-01", "1833-05-21"),
    p("marin", "Gouadon", "René Aimable Marin", "M", "1819-01-25"),
    p("jeanne", "Thibault", "Jeanne", "F", "1790-01-01"),
    p("autreAimable", "Gouadon", "Aimable", "M", "1850-01-01"),
    p("pierre", "Martin", "Pierre", "M", "1700-01-01", "1760-01-01"),
  ],
  filiations: [
    { enfantId: "marin", parentId: "aimable", type: "biologique" },
    { enfantId: "marin", parentId: "jeanne", type: "biologique" },
  ],
  couples: [{ a: "aimable", b: "jeanne", dateMin: null }],
};

const releve = (patch: Partial<ReleveCible>): ReleveCible => ({
  id: "r", role: null, nom: null, nomEcrit: null, prenoms: null, prenomsEcrits: null, sexe: null, naissanceMin: null, naissanceMax: null, relations: null, ...patch,
});

const candidats = indexCandidats(donnees);

describe("candidats pour un relevé", () => {
  test("père d'un enfant déjà rattaché : le père de l'arbre arrive en tête", () => {
    // Acte de naissance de Marin (1819) : le père est écrit « Gouadon Aymable », âge faux.
    const r = releve({ role: "père", nomEcrit: "Gouadon", prenomsEcrits: "Aymable", sexe: "M", naissanceMin: "1784-01-27", naissanceMax: "1785-01-26" });
    const res = candidats(r, { dateMin: "1819-01-26", dateMax: "1819-01-26", autres: [{ id: "e", role: "enfant", individuId: "marin" }] });
    expect(res[0].personne.id).toBe("aimable");
    expect(res[0].raisons.join(" ")).toContain("père de GOUADON René Aimable Marin");
    // L'autre Aimable, né en 1850, ne peut pas être père en 1819.
    expect(res.some((c) => c.personne.id === "autreAimable")).toBe(false);
  });

  test("mère : sexe opposé exclu, conjoint du père rattaché proposé", () => {
    const r = releve({ role: "mère", nomEcrit: "Tibault", prenomsEcrits: "Jeanne", sexe: "F" });
    const res = candidats(r, { dateMin: "1819-01-26", dateMax: "1819-01-26", autres: [{ id: "x", role: "père", individuId: "aimable" }] });
    expect(res.map((c) => c.personne.id)).toEqual(["jeanne"]);
    expect(res[0].raisons).toContain("nom proche");
  });

  test("déjà présent dans l'acte : pas proposé une seconde fois", () => {
    const r = releve({ role: "témoin", nomEcrit: "Gouadon", prenomsEcrits: "Aimable" });
    const res = candidats(r, { dateMin: "1819-01-26", dateMax: "1819-01-26", autres: [{ id: "x", role: "père", individuId: "aimable" }] });
    expect(res.some((c) => c.personne.id === "aimable")).toBe(false);
  });

  test("mort avant l'acte : écarté, sauf « feu »", () => {
    const r = releve({ role: "témoin", nomEcrit: "Martin", prenomsEcrits: "Pierre" });
    const ctx = { dateMin: "1790-01-01", dateMax: "1790-01-01", autres: [] };
    expect(candidats(r, ctx)).toEqual([]);
    expect(candidats({ ...r, relations: "fils de feu Pierre" }, ctx).map((c) => c.personne.id)).toEqual(["pierre"]);
  });

  test("rien de ressemblant : aucune suggestion", () => {
    expect(candidats(releve({ nomEcrit: "Dupont", prenomsEcrits: "Louis" }), { dateMin: null, dateMax: null, autres: [] })).toEqual([]);
  });
});

test("cleNom : graphies anciennes", () => {
  expect(cleNom("Thibault")).toBe(cleNom("Thibaud"));
  expect(cleNom("Goüaddon")).toBe(cleNom("Gouadon"));
  expect(cleNom("Mayenne")).toBe(cleNom("Maienne"));
});
