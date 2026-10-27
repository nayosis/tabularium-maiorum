import { expect, test } from "bun:test";
import { afficherDate, afficherDateSource, analyserDate, conversionCalendrier } from "../src/lib/dates";
import { dateDepuisGedcom, dateVersGedcom } from "../src/lib/gedcom";
import { ANNEES_REPUBLICAINES, depuisGregorien, isoVersRepublicain, versGregorien } from "../src/lib/republicain";
import { titreAuto } from "../src/lib/titres";

const jour = (iso: string) => analyserDate(iso.split("-").reverse().join("/"))!.min;

test("dates repères", () => {
  expect(analyserDate("1er vendémiaire an I")).toEqual({ min: "1792-09-22", max: "1792-09-22" });
  expect(analyserDate("18 brumaire an VIII")).toEqual({ min: "1799-11-09", max: "1799-11-09" });
  expect(analyserDate("10 nivôse an XIV")).toEqual({ min: "1805-12-31", max: "1805-12-31" });
  expect(analyserDate("6e jour complémentaire an III")).toEqual({ min: "1795-09-22", max: "1795-09-22" });
  expect(analyserDate("3 Brumaire an IV")).toEqual({ min: "1795-10-25", max: "1795-10-25" });
  expect(ANNEES_REPUBLICAINES.filter((a) => a.sextile).map((a) => a.romain)).toEqual(["III", "VII", "XI"]);
});

test("autres formes : abréviations, chiffres arabes, mois, année, vers, entre", () => {
  const le25 = { min: "1795-10-25", max: "1795-10-25" };
  expect(analyserDate("3 brumaire an 4")).toEqual(le25);
  expect(analyserDate("3 brum. an IV")).toEqual(le25);
  expect(analyserDate("premier brumaire an IV")).toEqual({ min: "1795-10-23", max: "1795-10-23" });
  expect(analyserDate("brumaire an IV")).toEqual({ min: "1795-10-23", max: "1795-11-21" });
  expect(analyserDate("an IV")).toEqual({ min: "1795-09-23", max: "1796-09-21" });
  expect(analyserDate("2e sans-culottide an VII")).toEqual({ min: "1799-09-18", max: "1799-09-18" });
  expect(analyserDate("jour de la Révolution an XI")).toEqual({ min: "1803-09-23", max: "1803-09-23" });
  expect(analyserDate("vers an IV")).toEqual({ min: "1793-09-23", max: "1798-09-21" });
  expect(analyserDate("avant le 3 brumaire an IV")).toEqual({ min: null, max: "1795-10-25" });
  expect(analyserDate("entre an IV et an V")).toEqual({ min: "1795-09-23", max: "1797-09-21" });
  // L'âge déclaré dans un acte républicain.
  expect(analyserDate("vers 1745 (50 ans le 3 brumaire an IV)")).toEqual({ min: "1744-10-26", max: "1745-10-25" });
});

test("dates impossibles : refusées", () => {
  for (const s of ["31 brumaire an IV", "6e jour complémentaire an IV", "an XV", "11 nivôse an XIV", "ven an IV", "3 brumaire an IIII"])
    expect(analyserDate(s)).toBeNull();
});

test("aller-retour sur tous les jours de l'an I à l'an XIV", () => {
  for (const a of ANNEES_REPUBLICAINES) {
    for (let iso = a.debut; iso <= a.fin; iso = new Date(Date.parse(iso) + 86400000).toISOString().slice(0, 10)) {
      const d = depuisGregorien(iso)!;
      expect(d.an).toBe(a.an);
      expect(versGregorien(d.an, d.mois, d.jour)).toBe(iso);
      expect(analyserDate(isoVersRepublicain(iso))!.min).toBe(iso);
    }
  }
  expect(depuisGregorien("1792-09-21")).toBeNull();
  expect(depuisGregorien("1806-01-01")).toBeNull();
  expect(jour("1806-01-01")).toBe("1806-01-01");
});

test("affichage : grégorien d'abord ; citations : la date de l'acte d'abord", () => {
  expect(afficherDate("3 brumaire an IV")).toBe("25/10/1795 (3 brumaire an IV)");
  expect(afficherDate("vers brumaire an IV")).toBe("vers 23/10–21/11/1795 (brumaire an IV)");
  expect(afficherDate("an IV")).toBe("23/09/1795–21/09/1796 (an IV)");
  expect(afficherDate("28/11/1897")).toBe("28/11/1897");
  expect(afficherDateSource("3 brumaire an IV")).toBe("3 brumaire an IV (25/10/1795)");
  const acte = { nature: "acte", type: "naissance", date: "3 brumaire an IV", pages: [] };
  const enfant = { role: "enfant", nom: "Veillon", prenoms: "François", nomEcrit: null, prenomsEcrits: null, naissance: null, deces: null, mariage: null, age: null, individuId: null, individuNom: null, individuPrenoms: null };
  expect(titreAuto(acte, [enfant], { nom: "Allonne", departement: "79" }, undefined)).toBe(
    "Acte naissance Veillon François 25/10/1795 (3 brumaire an IV) @ Allonne 79",
  );
});

test("convertisseur (Ctrl+K) dans les deux sens", () => {
  expect(conversionCalendrier("18 brumaire an VIII")?.resultat).toBe("09/11/1799");
  expect(conversionCalendrier("09/11/1799")?.resultat).toBe("18 brumaire an VIII");
  expect(conversionCalendrier("28/11/1897")).toBeNull();
  expect(conversionCalendrier("Veillon")).toBeNull();
});

test("GEDCOM : @#DFRENCH R@ à l'export et à l'import", () => {
  const b = analyserDate("3 brumaire an IV")!;
  expect(dateVersGedcom("3 brumaire an IV", b.min, b.max)).toBe("@#DFRENCH R@ 3 BRUM 4");
  expect(dateVersGedcom("vers brumaire an IV", null, null)).toBe("ABT @#DFRENCH R@ BRUM 4");
  expect(dateVersGedcom("2e jour complémentaire an VII", null, null)).toBe("@#DFRENCH R@ 2 COMP 7");
  expect(dateDepuisGedcom("@#DFRENCH R@ 3 BRUM 4")).toBe("3 brumaire an IV");
  expect(dateDepuisGedcom("ABT @#DFRENCH R@ BRUM 4")).toBe("vers brumaire an IV");
  expect(dateDepuisGedcom("@#DFRENCH R@ 4")).toBe("an IV");
});
