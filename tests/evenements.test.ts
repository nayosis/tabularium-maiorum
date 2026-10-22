import { describe, expect, test } from "bun:test";
import { evenementsReleve, resumeVie } from "../src/lib/evenements";

const vide = {
  role: null, acteNature: "acte", acteType: null, acteDate: null, acteLieuNom: null,
  naissance: null, naissanceLieu: null, mariage: null, mariageLieu: null, deces: null, decesLieu: null,
};

describe("evenementsReleve", () => {
  test("époux dans un acte de mariage : type, date et lieu de l'acte", () => {
    expect(evenementsReleve({ ...vide, role: "époux", acteType: "mariage", acteDate: "12/05/1921", acteLieuNom: "Saumur" })).toEqual([
      "Mariage · 12/05/1921 · Saumur",
    ]);
  });

  test("témoin avec âge : l'acte, puis la naissance calculée", () => {
    expect(evenementsReleve({ ...vide, role: "témoin", acteType: "naissance", acteDate: "29/11/1897", naissance: "vers 1826 (71 ans le 29/11/1897)" })).toEqual([
      "Naissance · 29/11/1897",
      "° vers 1826 (71 ans le 29/11/1897)",
    ]);
  });

  test("ligne de table décennale : l'événement indiqué, sans répéter la date", () => {
    expect(evenementsReleve({ ...vide, role: "Défunt", acteNature: "index", acteType: "table_decennale", deces: "14 mars 1850" })).toEqual([
      "Décès · 14 mars 1850",
    ]);
    expect(evenementsReleve({ ...vide, role: "épouse", acteNature: "index", acteType: "table_decennale" })).toEqual(["Mariage · date non notée"]);
  });

  test("mention marginale de décès sur un acte de naissance", () => {
    expect(evenementsReleve({ ...vide, role: "enfant", acteType: "naissance", acteDate: "29/11/1897", deces: "5/9/1981", decesLieu: "Saumur" })).toEqual([
      "Naissance · 29/11/1897",
      "† 5/9/1981 · Saumur",
    ]);
  });
});

test("resumeVie", () => {
  expect(resumeVie({ naissance: "28/11/1897", naissanceLieu: "Brissac", deces: "5/9/1981", decesLieu: "Saumur" })).toBe(
    "° 28/11/1897 · Brissac   † 5/9/1981 · Saumur",
  );
  expect(resumeVie({ naissance: null, naissanceLieu: null, deces: null, decesLieu: "Saumur" })).toBe("† Saumur");
  expect(resumeVie({ naissance: null, naissanceLieu: null, deces: null, decesLieu: null })).toBe("");
});
