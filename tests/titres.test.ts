import { expect, test } from "bun:test";
import { titreAuto } from "../src/lib/titres";

const r = (role: string, nom: string, prenoms: string, autre: Record<string, string> = {}) => ({
  role, nom, prenoms, nomEcrit: null, prenomsEcrits: null, naissance: null, deces: null, mariage: null, age: null,
  individuId: null, individuNom: null, individuPrenoms: null, ...autre,
});
const acte = (type: string, date: string | null = null) => ({ nature: "acte", type, date, pages: [] });
const cassien = { nom: "Saint Cassien", departement: "86" };

test("mariage : l'époux et l'épouse, la date et le lieu", () => {
  const releves = [r("père de l'époux", "Caduc", "Jean"), r("épouse", "Pinsard", "Flavide Alexandrine"), r("époux", "Caduc", "Victor")];
  expect(titreAuto(acte("mariage", "25/06/1872"), releves, cassien, undefined)).toBe(
    "Acte mariage Caduc Victor et Pinsard Flavide Alexandrine 25/06/1872 @ Saint Cassien 86",
  );
});

test("mariage : un seul époux relevé, date reprise du relevé", () => {
  const releves = [r("époux", "Caduc", "Victor", { mariage: "25/06/1872" })];
  expect(titreAuto(acte("mariage"), releves, undefined, undefined)).toBe("Acte mariage Caduc Victor 25/06/1872");
});

test("naissance : la personne principale et sa date de naissance", () => {
  const releves = [r("père", "Gouadon", "Ernest"), r("enfant", "Gouadon", "Henry Louis René", { naissance: "28/11/1897" })];
  expect(titreAuto(acte("naissance", "29/11/1897"), releves, { nom: "Brissac", departement: "49" }, undefined)).toBe(
    "Acte naissance Gouadon Henry Louis René 28/11/1897 @ Brissac 49",
  );
});

test("registre matricule et recensement", () => {
  const conscrit = { ...r("conscrit", "Caduc", "Victor"), militaire: { classe: "1856", matricule: "412", bureau: "Poitiers" } };
  expect(titreAuto(acte("matricule"), [conscrit], undefined, undefined)).toBe("Fiche matricule Caduc Victor classe 1856 matricule 412 bureau Poitiers");
  const menage = [r("épouse", "Gouadon", "Louise"), r("chef de ménage", "Gouadon", "Ernest")];
  expect(titreAuto(acte("recensement", "1906"), menage, { nom: "Brissac", departement: "49" }, undefined)).toBe("Recensement 1906 @ Brissac 49 — ménage Gouadon Ernest");
});
