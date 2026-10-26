import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";
import { citation, type DonneesCitation } from "../src/lib/citation";
import { aDuMilitaire, identification, libelleDecision, signalement } from "../src/lib/militaire";
import { etapesVie, lieuDansTexte } from "../src/lib/parcours";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
const individus = await import("../src/data/individus");
const actes = await import("../src/data/actes");
const releves = await import("../src/data/releves");
const gedcom = await import("../src/data/gedcom");

const fiche = {
  classe: "1897", matricule: "1234", bureau: "Angers", taille: "1.65", cheveux: "châtains", yeux: "gris", visage: "ovale",
  marques: "cicatrice au front", decision: "ajourne", motif: "faiblesse", services: "Incorporé au 135e RI le 15/11/1898.",
  adresses: [{ date: "12/03/1905", lieu: "Angers, 12 rue Saint-Aubin" }, { date: "1910", lieu: "à Brissac (49)" }],
};

test("présentation : identification, signalement, décision", () => {
  expect(identification(fiche)).toBe("Classe 1897 · matricule 1234 · bureau Angers");
  expect(signalement(fiche)).toBe("1,65 m · cheveux châtains · yeux gris · visage ovale · cicatrice au front");
  expect(libelleDecision(fiche)).toBe("Ajourné — faiblesse");
  expect(aDuMilitaire({})).toBe(false);
  expect(aDuMilitaire({ adresses: [] })).toBe(false);
  expect(aDuMilitaire({ classe: "1897" })).toBe(true);
});

test("adresses successives dans le parcours de vie, avec la commune reconnue", () => {
  const lieux = [
    { id: "angers", nom: "Angers", departement: "49", latitude: 47.47, longitude: -0.55 },
    { id: "brissac", nom: "Brissac", departement: "49", latitude: 47.35, longitude: -0.45 },
    { id: "saint-aubin", nom: "Saint-Aubin-de-Luigné", departement: "49", latitude: null, longitude: null },
  ];
  expect(lieuDansTexte("Angers, 12 rue Saint-Aubin", lieux)?.id).toBe("angers");
  expect(lieuDansTexte("à Brissac (49)", lieux)?.id).toBe("brissac");
  expect(lieuDansTexte("Paris", lieux)).toBeNull();
  const personne = { naissance: "1877", naissanceMin: "1877-01-01", naissanceLieuId: "brissac", acteNaissanceId: null, deces: null, decesMin: null, decesLieuId: null, acteDecesId: null, couples: [], enfants: [], domiciles: fiche.adresses };
  const etapes = etapesVie(personne, lieux, new Map());
  expect(etapes.map((e) => [e.quoi, e.lieu?.id ?? null])).toEqual([["naissance", "brissac"], ["domicile", "angers"], ["domicile", "brissac"]]);
});

test("citation d'une fiche matricule", () => {
  const d: DonneesCitation = {
    acteId: "a", titre: "Fiche matricule", nature: "acte", type: "matricule", numero: "1234", date: null, coteActe: null, acteLieu: null,
    registreTitre: "Registre matricule, classe 1897, bureau d'Angers", periode: null, coteRegistre: "1 R 1234", archives: "AD 49", vue: "212", url: null,
  };
  expect(citation(d)).toBe("AD 49, Registre matricule, classe 1897, bureau d'Angers, cote 1 R 1234 — fiche matricule n° 1234, vue 212.");
});

test("relevé militaire enregistré, et exporté en GEDCOM (service militaire, résidences)", async () => {
  const id = await individus.creerIndividu({ nom: "Martin", prenoms: "Jean", sexe: "M" });
  const acteId = await actes.creerActe([{ fichier: "m.jpg", largeur: 1, hauteur: 1 }], { titre: "Fiche matricule", type: "matricule" });
  const releveId = await releves.creerReleve(acteId);
  await releves.majReleve(releveId, { role: "conscrit", individuId: id, militaire: fiche });
  const [r] = await releves.relevesIndividu(id);
  expect(r.militaire).toEqual(fiche);

  const texte = await gedcom.exporterGedcom();
  expect(texte).toContain("1 EVEN\n2 TYPE Service militaire\n2 DATE 1897\n2 NOTE Classe 1897 · matricule 1234 · bureau Angers\n3 CONT Signalement : 1,65 m");
  expect(texte).toContain("1 RESI\n2 DATE 12 MAR 1905\n2 ADDR Angers, 12 rue Saint-Aubin");
});
