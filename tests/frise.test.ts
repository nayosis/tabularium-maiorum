import { describe, expect, test } from "bun:test";
import { anneeDecimale, anneeEvenement, construireFrise, pasGraduation, periode, type PersonneFrise } from "../src/pages/frise/calculFrise";

const p = (id: string, n: [string | null, string | null], d: [string | null, string | null] = [null, null], nom = id): PersonneFrise => ({
  id, nom, prenoms: null, sexe: null, naissanceMin: n[0], naissanceMax: n[1], decesMin: d[0], decesMax: d[1],
});

describe("periode", () => {
  test("dates exactes : pas de fondu", () => {
    const per = periode(p("henri", ["1897-11-28", "1897-11-28"], ["1981-09-05", "1981-09-05"]))!;
    expect(per.x0).toBe(per.x1);
    expect(per.x2).toBe(per.x3);
    expect(per.x1).toBeCloseTo(1897.9, 1);
    expect(per.x2).toBeCloseTo(1981.68, 1);
    expect(per.naissanceEstimee || per.decesEstime).toBe(false);
  });

  test("naissance en fourchette : fondu sur la plage", () => {
    const per = periode(p("louis", ["1825-11-30", "1826-11-29"], ["1901-01-01", "1901-12-31"]))!;
    expect(per.x1 - per.x0).toBeCloseTo(1, 1);
  });

  test("« avant 1790 » : fondu de 5 ans avant la borne", () => {
    const per = periode(p("x", [null, "1790-01-01"]))!;
    expect(per.x1).toBe(1790);
    expect(per.x0).toBe(1785);
  });

  test("décès inconnu : estimé", () => {
    const per = periode(p("x", ["1900-01-01", "1900-01-01"]))!;
    expect(per.decesEstime).toBe(true);
    expect(per.x2).toBe(1950);
    expect(per.x3).toBe(1990);
  });

  test("seulement le décès : naissance estimée", () => {
    const per = periode(p("x", [null, null], ["1900-01-01", "1900-01-01"]))!;
    expect(per.naissanceEstimee).toBe(true);
    expect(per.x3).toBe(1900);
    expect(per.x0).toBeLessThan(per.x1);
  });

  test("sans aucune date : exclu", () => {
    expect(periode(p("x", [null, null]))).toBeNull();
  });

  test("décès avant naissance : jamais de barre à l'envers", () => {
    const per = periode(p("x", ["1900-01-01", "1900-01-01"], ["1850-01-01", "1850-01-01"]))!;
    expect(per.x0).toBeLessThanOrEqual(per.x1);
    expect(per.x1).toBeLessThanOrEqual(per.x2);
    expect(per.x2).toBeLessThanOrEqual(per.x3);
  });
});

describe("construireFrise", () => {
  const personnes = [p("b", ["1900-01-01", "1900-01-01"], [null, null], "Martin"), p("a", ["1850-01-01", "1850-01-01"], [null, null], "Durand"), p("c", [null, null])];

  test("tri par naissance, bornes arrondies à la décennie, sans dates à part", () => {
    const f = construireFrise(personnes, "naissance");
    expect(f.periodes.map((x) => x.personne.id)).toEqual(["a", "b"]);
    expect(f.sansDates.map((x) => x.id)).toEqual(["c"]);
    expect(f.debut).toBe(1840);
    expect(f.fin).toBe(2000);
  });

  test("tri par nom", () => {
    expect(construireFrise(personnes, "nom").periodes.map((x) => x.personne.nom)).toEqual(["Durand", "Martin"]);
  });
});

test("anneeEvenement : date de l'acte, ou de l'événement pour une ligne d'index", () => {
  const vide = { naissanceMin: null, naissanceMax: null, mariageMin: null, mariageMax: null, decesMin: null, decesMax: null };
  expect(anneeEvenement({ ...vide, role: "témoin", acteNature: "acte", acteDateMin: "1900-01-01", acteDateMax: "1900-01-01" })).toBe(1900);
  // Table décennale 1803-1892, ligne « défunt » décédé en 1850.
  expect(anneeEvenement({ ...vide, role: "défunt", acteNature: "index", acteDateMin: null, acteDateMax: null, decesMin: "1850-01-01", decesMax: "1850-01-01" })).toBe(1850);
  expect(anneeEvenement({ ...vide, role: "Époux", acteNature: "index", acteDateMin: null, acteDateMax: null, mariageMin: "1849-01-01", mariageMax: "1849-01-01" })).toBe(1849);
  // Ligne d'index sans date ni rôle reconnu : pas de point.
  expect(anneeEvenement({ ...vide, role: "témoin", acteNature: "index", acteDateMin: "1803-01-01", acteDateMax: "1892-12-31" })).toBeNull();
  expect(anneeEvenement({ ...vide, role: null, acteNature: "acte", acteDateMin: null, acteDateMax: null })).toBeNull();
});

test("pasGraduation", () => {
  expect(pasGraduation(3)).toBe(20);
  expect(pasGraduation(12)).toBe(5);
  expect(anneeDecimale("2000-01-01")).toBe(2000);
});
