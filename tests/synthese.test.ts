import { describe, expect, test } from "bun:test";
import type { ReleveAvecActe } from "../src/data/releves";
import { croisementNaissance, dejaDansFiche, propositions } from "../src/lib/synthese";
import { naissanceDepuisAge, analyserDate } from "../src/lib/dates";

let n = 0;
const releve = (p: Partial<ReleveAvecActe>): ReleveAvecActe =>
  ({
    id: `r${++n}`, acteId: `a${n}`, acteTitre: `Acte ${n}`, individuId: "i", role: null, nomEcrit: null, prenomsEcrits: null, nom: null,
    prenoms: null, sexe: null, age: null, naissance: null, naissanceMin: null, naissanceMax: null, naissanceLieu: null, mariage: null,
    mariageMin: null, mariageMax: null, mariageLieu: null, deces: null, decesMin: null, decesMax: null, decesLieu: null, profession: null,
    domicile: null, origine: null, signature: null, relations: null, confiance: null, notes: null, ordre: 0, creeLe: "",
    acteType: null, acteDate: null, acteDateMin: null, acteDateMax: null, acteLieuId: null, acteLieuNom: null, ...p,
  }) as ReleveAvecActe;

const avecAge = (age: string, dateActe: string) => {
  const b = naissanceDepuisAge(age, analyserDate(dateActe), dateActe)!;
  return { age, naissance: b.saisie, naissanceMin: b.min, naissanceMax: b.max };
};

describe("propositions", () => {
  const releves = [
    releve({ role: "enfant", acteType: "naissance", acteDate: "29/11/1897", acteLieuId: "brissac", acteLieuNom: "Brissac", nomEcrit: "Gouadon", prenomsEcrits: "Henri Louis René", sexe: "M" }),
    releve({ role: "époux", nomEcrit: "Gouadon", prenomsEcrits: "Henry Louis René", profession: "menuisier" }),
    releve({ role: "témoin", nom: "Gouadon", profession: "Menuisier", deces: "5/9/1981", decesMin: "1981-09-05", decesMax: "1981-09-05", decesLieu: "Saumur" }),
  ];
  const ps = propositions(releves);
  const de = (champ: string) => ps.filter((p) => p.champ === champ);

  test("valeurs identiques regroupées avec leurs sources", () => {
    expect(de("nom")).toHaveLength(1);
    expect(de("nom")[0].sources).toHaveLength(3);
    // « menuisier » et « Menuisier » : même valeur.
    expect(de("profession")).toHaveLength(1);
    expect(de("profession")[0].sources).toHaveLength(2);
  });

  test("variantes gardées séparément", () => {
    expect(de("prenoms").map((p) => p.valeur)).toEqual(["Henri Louis René", "Henry Louis René"]);
  });

  test("naissance et lieu déduits d'un acte de naissance", () => {
    const [naiss] = de("naissance");
    expect(naiss.deduite).toContain("29/11/1897");
    expect(naiss.patch).toMatchObject({ naissance: "avant le 29/11/1897", naissanceMin: null, naissanceMax: "1897-11-29" });
    expect(de("naissanceLieu")[0]).toMatchObject({ lieu: { id: "brissac", nom: "Brissac" }, deduite: "lieu de l'acte" });
  });

  test("mention de décès lue dans un relevé", () => {
    expect(de("deces")[0].patch).toMatchObject({ deces: "5/9/1981", decesMin: "1981-09-05" });
    expect(de("decesLieu")[0].lieu).toEqual({ id: null, nom: "Saumur" });
  });

  test("dans l'ordre des champs de la fiche", () => {
    expect([...new Set(ps.map((p) => p.champ))]).toEqual(["nom", "prenoms", "sexe", "naissance", "naissanceLieu", "deces", "decesLieu", "profession"]);
  });

  test("déjà dans la fiche", () => {
    expect(dejaDansFiche(de("nom")[0], { nom: "GOUADON" })).toBe(true);
    expect(dejaDansFiche(de("profession")[0], { profession: "chapelier, menuisier" })).toBe(true);
    expect(dejaDansFiche(de("profession")[0], { profession: "chapelier" })).toBe(false);
  });
});

describe("croisementNaissance", () => {
  test("intersection des âges déclarés", () => {
    // 71 ans le 29/11/1897 → 30/11/1825–29/11/1826 ; 45 ans le 10/06/1871 → 11/06/1825–10/06/1826
    const c = croisementNaissance([releve(avecAge("71 ans", "29/11/1897")), releve(avecAge("45 ans", "10/06/1871"))]);
    expect(c).toMatchObject({ contradiction: false, nb: 2, min: "1825-11-30", max: "1826-06-10" });
    expect(c && !c.contradiction && c.saisie).toBe("entre le 30/11/1825 et le 10/06/1826");
    expect(analyserDate("entre le 30/11/1825 et le 10/06/1826")).toEqual({ min: "1825-11-30", max: "1826-06-10" });
  });

  test("âges incompatibles signalés", () => {
    const c = croisementNaissance([releve(avecAge("71 ans", "29/11/1897")), releve(avecAge("30 ans", "10/06/1871"))]);
    expect(c?.contradiction).toBe(true);
  });

  test("la date d'un acte de naissance resserre la fourchette", () => {
    const c = croisementNaissance([
      releve(avecAge("23 ans", "12/05/1921")),
      releve({ role: "enfant", acteType: "naissance", acteDate: "29/11/1897" }),
    ]);
    expect(c).toMatchObject({ contradiction: false, nb: 2, min: "1897-05-13", max: "1897-11-29" });
  });

  test("avec l'acte de naissance, pas d'alerte : l'âge erroné est seulement signalé", () => {
    // Fils né le 01/03/1785 (acte de naissance) ; « 34 ans le 26/01/1819 » sur l'acte de son fils → faux.
    const releves = [
      releve({ role: "enfant", acteType: "naissance", acteDate: "01/03/1785", acteDateMin: "1785-03-01", acteDateMax: "1785-03-01", naissance: "01/03/1785", naissanceMin: "1785-03-01", naissanceMax: "1785-03-01" }),
      releve({ role: "père", ...avecAge("34 ans", "26/01/1819") }),
      releve({ role: "défunt", ...avecAge("48 ans", "25/05/1833") }),
    ];
    expect(croisementNaissance(releves)).toBeNull();
    const naissances = propositions(releves).filter((p) => p.champ === "naissance");
    expect(naissances.find((p) => p.valeur.includes("34 ans"))?.incompatible).toContain("acte de naissance");
    expect(naissances.find((p) => p.valeur === "01/03/1785")?.incompatible).toBeUndefined();
    // 48 ans le 25/05/1833 → né entre le 26/05/1784 et le 25/05/1785 : compatible.
    expect(naissances.find((p) => p.valeur.includes("48 ans"))?.incompatible).toBeUndefined();
  });

  test("un seul relevé daté : pas de croisement", () => {
    expect(croisementNaissance([releve(avecAge("71 ans", "29/11/1897")), releve({})])).toBeNull();
  });
});
