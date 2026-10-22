import { describe, expect, test } from "bun:test";
import { analyserDate, naissanceDepuisAge } from "../src/lib/dates";

describe("analyserDate", () => {
  test.each([
    ["28/11/1897", "1897-11-28", "1897-11-28"],
    ["28 novembre 1897", "1897-11-28", "1897-11-28"],
    ["1er mars 1800", "1800-03-01", "1800-03-01"],
    ["11/1897", "1897-11-01", "1897-11-30"],
    ["nov 1897", "1897-11-01", "1897-11-30"],
    ["1897", "1897-01-01", "1897-12-31"],
    ["vers 1826", "1824-01-01", "1828-12-31"],
    ["avant 1790", null, "1790-01-01"],
    ["après 29/11/1897", "1897-11-29", null],
    ["entre 1778 et 1782", "1778-01-01", "1782-12-31"],
    ["1778-1782", "1778-01-01", "1782-12-31"],
  ])("%s", (saisie, min, max) => {
    expect(analyserDate(saisie)).toEqual({ min, max });
  });

  test("naissance calculée depuis un âge : bornes précises", () => {
    expect(analyserDate("vers 1826 (71 ans le 29/11/1897)")).toEqual({ min: "1825-11-30", max: "1826-11-29" });
  });

  test("dates invalides ou incomprises", () => {
    expect(analyserDate("31/02/1800")).toBeNull();
    expect(analyserDate("29/02/1900")).toBeNull();
    expect(analyserDate("n'importe quoi")).toBeNull();
    expect(analyserDate("")).toBeNull();
  });
});

describe("naissanceDepuisAge", () => {
  const acte = analyserDate("29/11/1897");
  test("71 ans le 29/11/1897 → né entre le 30/11/1825 et le 29/11/1826", () => {
    expect(naissanceDepuisAge("71 ans", acte, "29/11/1897")).toEqual({
      saisie: "vers 1826 (71 ans le 29/11/1897)",
      min: "1825-11-30",
      max: "1826-11-29",
    });
  });
  test("âge sans unité = années", () => {
    expect(naissanceDepuisAge("46", acte)?.saisie).toBe("vers 1851 (46 ans)");
  });
  test("date d'acte réduite à une année : « en 1926 »", () => {
    const n = naissanceDepuisAge("28", analyserDate("1926"), "1926");
    expect(n?.saisie).toBe("vers 1898 (28 ans en 1926)");
    expect(analyserDate(n!.saisie)).toEqual({ min: n!.min, max: n!.max });
  });

  test("sans date d'acte, pas de calcul", () => {
    expect(naissanceDepuisAge("46", null)).toBeNull();
  });
});
