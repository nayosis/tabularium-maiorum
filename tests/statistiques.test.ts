import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
const individus = await import("../src/data/individus");
const lieux = await import("../src/data/lieux");
const actes = await import("../src/data/actes");
const recherches = await import("../src/data/recherches");
const { tableauDeBord } = await import("../src/data/statistiques");

test("tableau de bord : totaux, complétude, siècles, patronymes, lieux, recherches, activité", async () => {
  const vide = await tableauDeBord();
  expect(vide.totaux.individus).toBe(0);
  expect(vide.plusAncien).toBeNull();

  const brissac = await lieux.creerLieu("Brissac", "49");
  const pere = await individus.creerIndividu({ nom: "Martin", prenoms: "Jean", naissance: "1795", naissanceMin: "1795-01-01", naissanceLieuId: brissac });
  const fils = await individus.creerIndividu({ nom: "martin ", prenoms: "Pierre", naissance: "1830", naissanceMin: "1830-01-01", naissanceLieuId: brissac });
  await individus.creerIndividu({ nom: "Dupont", prenoms: "Marie" });
  await individus.changerParent(fils, null, pere);
  await actes.creerActe([{ fichier: "a.jpg", largeur: 10, hauteur: 10 }], { titre: "Acte", statut: "a_transcrire" });
  await actes.creerActe([{ fichier: "b.jpg", largeur: 10, hauteur: 10 }], { titre: "Photo", nature: "photo" });
  await recherches.creerRecherche(fils, { titre: "Trouver son mariage" });

  const t = await tableauDeBord();
  expect(t.totaux).toMatchObject({ individus: 3, documents: 1, photos: 1, lieux: 1, recherches: 1 });
  expect(t.statuts).toEqual({ a_transcrire: 1 });
  expect(t.completude).toEqual({ avecNaissance: 2, avecLieuNaissance: 2, avecActeNaissance: 0, avecDeces: 0, avecParents: 1 });
  expect(t.parSiecle).toEqual([{ siecle: 18, n: 1 }, { siecle: 19, n: 1 }]);
  // Patronymes regroupés malgré la casse et les espaces.
  expect(t.patronymes[0]).toEqual({ nom: "MARTIN", n: 2 });
  expect(t.lieuxNaissance).toEqual([{ id: brissac, nom: "Brissac", departement: "49", n: 2 }]);
  expect(t.geographie).toEqual({ communes: 1, departements: 1 });
  expect(t.plusAncien).toMatchObject({ id: pere, prenoms: "Jean" });
  expect(t.recherchesOuvertes.map((r) => r.titre)).toEqual(["Trouver son mariage"]);
  expect(t.activite).toHaveLength(5);
  expect(t.activite.every((a) => /^\d{4}-\d\d-\d\dT.*Z$/.test(a.quand))).toBe(true);
});
