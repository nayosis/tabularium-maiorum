import { expect, test } from "bun:test";
import { join } from "node:path";
import { dossierDonneesParDefaut, lireReglages } from "../serveur/local";

test("tabularium.ini : clés en minuscules, commentaires et lignes vides ignorés, BOM toléré", () => {
  const texte = "\uFEFF# Réglages\r\nDossier = D:\Généalogie\r\n\r\n; commentaire\r\nreseau=oui\nport=3300\nligne sans égal\n";
  expect(lireReglages(texte)).toEqual({ dossier: "D:\Généalogie", reseau: "oui", port: "3300" });
});

test("données par défaut : Documents/Tabularium, ou ~/Tabularium sous Linux et sans dossier Documents", () => {
  const maison = join(import.meta.dir, "..");
  expect(dossierDonneesParDefaut("linux", maison)).toBe(join(maison, "Tabularium"));
  // Pas de dossier « Documents » dans le dépôt : repli sur ~/Tabularium.
  expect(dossierDonneesParDefaut("win32", maison)).toBe(join(maison, "Tabularium"));
});
