import { expect, test } from "bun:test";
import { analyserDate } from "../src/lib/dates";
import { dateDepuisGedcom, dateVersGedcom, decoderGedcom, ligne, lireGedcom, lireNom, nomGedcom, valeur } from "../src/lib/gedcom";

test("dates GEDCOM → saisie floue comprise par Tabularium", () => {
  const cas: [string, string][] = [
    ["12 MAR 1850", "12/03/1850"], ["MAR 1850", "03/1850"], ["1850", "1850"], ["ABT 1850", "vers 1850"], ["EST 1850", "vers 1850"],
    ["BEF 1790", "avant 1790"], ["AFT 2 JAN 1790", "après 02/01/1790"], ["BET 1778 AND 1782", "entre 1778 et 1782"], ["(fin de l'été 1850)", "fin de l'été 1850"],
  ];
  for (const [g, fr] of cas) expect(dateDepuisGedcom(g)).toBe(fr);
  for (const [, fr] of cas.slice(0, -1)) expect(analyserDate(fr)).not.toBeNull();
});

test("saisie floue → date GEDCOM 5.5.1", () => {
  expect(dateVersGedcom("28/11/1897", "1897-11-28", "1897-11-28")).toBe("28 NOV 1897");
  expect(dateVersGedcom("vers 1826", "1824-01-01", "1828-12-31")).toBe("ABT 1826");
  expect(dateVersGedcom("avant 1790", null, "1790-01-01")).toBe("BEF 1790");
  expect(dateVersGedcom("entre 1778 et 1782", "1778-01-01", "1782-12-31")).toBe("BET 1778 AND 1782");
  expect(dateVersGedcom("vers 1826 (71 ans le 29/11/1897)", "1825-11-30", "1826-11-29")).toBe("ABT 1826");
  // Saisie libre non reconnue : bornes calculées, saisie en clair.
  expect(dateVersGedcom("au printemps", "1850-03-01", "1850-05-31")).toBe("BET 1 MAR 1850 AND 31 MAY 1850 (au printemps)");
  expect(dateVersGedcom(null, null, null)).toBeNull();
});

test("lecture : enregistrements, CONT / CONC, noms", () => {
  const racines = lireGedcom("0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Jean Pierre /MARTIN/\n1 NOTE Première ligne\n2 CONT seconde\n2 CONC  suite\n0 TRLR\n");
  const indi = racines.find((r) => r.tag === "INDI")!;
  expect(indi.xref).toBe("@I1@");
  expect(lireNom(valeur(indi, "NAME")!)).toEqual({ prenoms: "Jean Pierre", nom: "MARTIN" });
  expect(valeur(indi, "NOTE")).toBe("Première ligne\nseconde suite");
});

test("écriture : CONT pour les retours à la ligne, CONC pour les lignes longues ; nom entre barres", () => {
  expect(ligne(1, "NOTE", "a\nb")).toEqual(["1 NOTE a", "2 CONT b"]);
  expect(ligne(1, "NOTE", "x".repeat(250))).toEqual([`1 NOTE ${"x".repeat(200)}`, `2 CONC ${"x".repeat(50)}`]);
  expect(nomGedcom("MARTIN", "Jean")).toBe("Jean /MARTIN/");
});

test("encodage : UTF-8 par défaut, Windows-1252 si annoncé", () => {
  const ansi = new Uint8Array([...new TextEncoder().encode("0 HEAD\n1 CHAR ANSI\n0 @I1@ INDI\n1 NAME Ren"), 0xe9, ...new TextEncoder().encode(" /X/\n")]);
  expect(decoderGedcom(ansi).texte).toContain("René /X/");
  expect(decoderGedcom(new TextEncoder().encode("﻿0 HEAD\n1 CHAR UTF-8\n1 NOTE été")).texte).toBe("0 HEAD\n1 CHAR UTF-8\n1 NOTE été");
});
