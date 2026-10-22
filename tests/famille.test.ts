import { describe, expect, test } from "bun:test";
import type { DonneesArbre } from "../src/data/individus";
import { disposerFamille } from "../src/pages/arbre/famille";
import { BOITE, type Personne } from "../src/pages/arbre/disposition";

const p = (id: string, sexe: string | null, naissanceMin: string | null = null): Personne => ({
  id, nom: id, prenoms: null, sexe, naissance: null, naissanceMin, naissanceMax: naissanceMin, deces: null, decesMin: null, decesMax: null,
  pereInconnu: false, mereInconnue: false, sansUnion: false, naissanceLieu: null, naissanceLieuId: null, decesLieu: null, acteNaissanceId: null, acteDecesId: null, acteMariage: 0, portrait: null,
});

/*
 *   gpP ∞ gmP                     gpM ∞ gmM
 *      ├── pere ∞ mere ──────────────┤ (mere fille de gpM/gmM)
 *      │     ├── moi (1900)          ├── tanteM ── cousinM
 *      │     ├── soeur (1902) ── neveu
 *      │     └── (mere seule) demi (1910, autre père)
 *      └── oncleP ── cousineP
 */
const personnes = [
  p("gpP", "M"), p("gmP", "F"), p("gpM", "M"), p("gmM", "F"),
  p("pere", "M", "1870-01-01"), p("oncleP", "M", "1872-01-01"), p("mere", "F", "1875-01-01"), p("tanteM", "F", "1878-01-01"),
  p("moi", "M", "1900-01-01"), p("soeur", "F", "1902-01-01"), p("demi", "M", "1910-01-01"),
  p("cousineP", "F", "1905-01-01"), p("cousinM", "M", "1906-01-01"), p("neveu", "M", "1925-01-01"), p("autrePere", "M"),
];
const f = (enfantId: string, parentId: string) => ({ enfantId, parentId, type: "biologique" });
const donnees: DonneesArbre = {
  personnes,
  filiations: [
    f("pere", "gpP"), f("pere", "gmP"), f("oncleP", "gpP"), f("oncleP", "gmP"),
    f("mere", "gpM"), f("mere", "gmM"), f("tanteM", "gpM"), f("tanteM", "gmM"),
    f("moi", "pere"), f("moi", "mere"), f("soeur", "pere"), f("soeur", "mere"),
    f("demi", "mere"), f("demi", "autrePere"),
    f("cousineP", "oncleP"), f("cousinM", "tanteM"), f("neveu", "soeur"),
  ],
  couples: [{ a: "pere", b: "mere", dateMin: null }, { a: "gpP", b: "gmP", dateMin: null }, { a: "gpM", b: "gmM", dateMin: null }],
};

const parente = (r: ReturnType<typeof disposerFamille>) => Object.fromEntries(r.noeuds.map((n) => [n.personne!.id, n.racine ? "moi" : n.parente]));

describe("famille élargie", () => {
  test("jusqu'aux grands-parents : oncles, tantes, cousins, frères, demi-frère ; chacun une seule fois", () => {
    const r = disposerFamille(donnees, "moi", { remonter: 2, descendre: 0 });
    expect(parente(r)).toEqual({
      gpP: "grand-père", pere: "père", moi: "moi", soeur: "sœur", oncleP: "oncle", cousineP: "cousine germaine",
      gpM: "grand-père", mere: "mère", demi: "demi-frère", tanteM: "tante", cousinM: "cousin germain",
    });
    const ids = r.noeuds.map((n) => n.personne!.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Pas de neveu : on ne descend pas sous la génération de la personne.
    expect(ids).not.toContain("neveu");
  });

  test("une génération de plus vers le bas : neveux", () => {
    const r = disposerFamille(donnees, "moi", { remonter: 2, descendre: 1 });
    expect(parente(r).neveu).toBe("neveu");
  });

  test("côté paternel à gauche, maternel à droite, personne choisie au centre", () => {
    const r = disposerFamille(donnees, "moi", { remonter: 2, descendre: 0 });
    const x = (id: string) => r.noeuds.find((n) => n.personne!.id === id)!.x;
    expect(x("moi")).toBe(0);
    expect(x("oncleP")).toBeGreaterThan(x("pere")); // enfants des grands-parents triés par naissance
    expect(x("gpM")).toBeGreaterThan(x("gpP"));
    expect(x("tanteM")).toBeGreaterThan(0);
  });

  test("les parents, dans deux branches différentes, sont reliés", () => {
    const r = disposerFamille(donnees, "moi", { remonter: 2, descendre: 0 });
    expect(r.couples.map((c) => [c.a.personne!.id, c.b.personne!.id].sort())).toEqual([["mere", "pere"]]);
  });

  test("pas de chevauchement sur une même ligne", () => {
    const r = disposerFamille(donnees, "moi", { remonter: 2, descendre: 1 });
    for (const ligne of Map.groupBy(r.noeuds, (n) => n.y).values()) {
      const xs = ligne.map((n) => n.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(BOITE.l);
    }
  });

  test("jusqu'aux parents seulement : frères et sœurs", () => {
    const r = disposerFamille(donnees, "moi", { remonter: 1, descendre: 0 });
    expect(parente(r)).toEqual({ pere: "père", moi: "moi", soeur: "sœur", demi: "demi-frère" });
  });

  test("ancêtres inconnus : la personne seule, avec ses enfants si on descend", () => {
    const r = disposerFamille(donnees, "soeur", { remonter: 3, descendre: 1 });
    expect(r.noeuds.some((n) => n.personne!.id === "neveu")).toBe(true);
    const seul = disposerFamille({ ...donnees, filiations: [] }, "moi", { remonter: 2, descendre: 1 });
    expect(seul.noeuds.map((n) => n.personne!.id)).toEqual(["moi"]);
  });
});
