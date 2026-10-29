import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";
import { communeCorrespondante, normaliserCommune, type CommuneOfficielle } from "../src/lib/communes";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
const lieux = await import("../src/data/lieux");
const individus = await import("../src/data/individus");
const actes = await import("../src/data/actes");
const registres = await import("../src/data/registres");
const { tableauDeBord } = await import("../src/data/statistiques");

test("rattachements d'un lieu : personnes, unions, documents, registres ; lieux inutilisés et non placés", async () => {
  const allonne = await lieux.creerLieu("Allonne", "79");
  const allone = await lieux.creerLieu("Allone", "79");
  await lieux.majLieu(allonne, { latitude: 46.57, longitude: -0.38 });
  const jean = await individus.creerIndividu({ nom: "Veillon", prenoms: "Jean", naissanceLieuId: allonne, decesLieuId: allonne });
  const marie = await individus.creerIndividu({ nom: "Denault", prenoms: "Marie", decesLieuId: allonne });
  await individus.creerCouple(jean, marie, { lieuId: allonne, date: "3 brumaire an IV" });
  await actes.creerActe([{ fichier: "a.jpg", largeur: 1, hauteur: 1 }], { titre: "Naissance Jean", lieuId: allonne });
  await registres.creerRegistre("Allonne — NMD", { lieuId: allonne });

  const usages = await lieux.usagesLieux();
  // Jean, né et décédé à Allonne, ne compte qu'une fois.
  expect(usages[allonne]).toEqual({ personnes: 2, unions: 1, actes: 1, registres: 1 });
  expect(usages[allone]).toBeUndefined();

  const r = await lieux.rattachementsLieu(allonne);
  expect(r.personnes.map((p) => [p.prenoms, p.nee, p.decedee])).toEqual([
    ["Marie", false, true],
    ["Jean", true, true],
  ]);
  expect(r.unions[0].conjoints.map((c) => c.prenoms)).toEqual(["Jean", "Marie"]);
  expect(r.actes.map((a) => a.titre)).toEqual(["Naissance Jean"]);
  expect(r.registres.map((s) => s.titre)).toEqual(["Allonne — NMD"]);
  expect(await lieux.rattachementsLieu(allone)).toEqual({ personnes: [], unions: [], actes: [], registres: [] });

  const d = await tableauDeBord();
  expect(d.lieuxNonPlaces).toEqual({ total: 1, premiers: [{ id: allone, nom: "Allone", departement: "79", n: 0 }] });
});

const commune = (nom: string, code: string, departement: string, type: CommuneOfficielle["type"] = "actuelle"): CommuneOfficielle => ({
  nom, code, departement, type, lat: 47, lng: -0.4,
});

test("commune officielle : même nom (écriture libre), même département ; homonymes laissés au choix", () => {
  expect(normaliserCommune("St-Martin-d'Ars")).toBe("saint martin d ars");
  const brissac = [commune("Brissac", "34042", "34"), commune("Brissac Loire Aubance", "49050", "49"), commune("Brissac-Quincé", "49050", "49", "deleguee")];
  // Sans département, deux « Brissac » possibles ? Ici un seul porte exactement ce nom.
  expect(communeCorrespondante("Brissac", null, brissac)?.code).toBe("34042");
  // Dans le 49, « Brissac » n'est pas un nom exact : à choisir à la main.
  expect(communeCorrespondante("Brissac", "49", brissac)).toBeNull();
  expect(communeCorrespondante("brissac quince", "49", brissac)).toMatchObject({ code: "49050", type: "deleguee" });
  const homonymes = [commune("Saint-Cassien", "24384", "24"), commune("Saint-Cassien", "38373", "38")];
  expect(communeCorrespondante("St Cassien", null, homonymes)).toBeNull();
  expect(communeCorrespondante("St Cassien", "38", homonymes)?.code).toBe("38373");
  expect(communeCorrespondante("Allonne", "79", [])).toBeNull();
});
