import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
const individus = await import("../src/data/individus");
const doutes = await import("../src/data/doutes");
const recherches = await import("../src/data/recherches");
const { tableauDeBord } = await import("../src/data/statistiques");

const nouvelle = (nom: string, prenoms: string) => individus.creerIndividu({ nom, prenoms });

test("création, paire rangée, réouverture, statut, note, suppression", async () => {
  const a = await nouvelle("Martin", "Jean");
  const b = await nouvelle("Martin", "Jean-Baptiste");
  expect(doutes.creerDoute(a, a)).rejects.toThrow();

  const id = await doutes.creerDoute(b, a, "même parrain");
  // Vu depuis chaque fiche, l'autre fiche est en « b ».
  const depuisA = await doutes.doutesIndividu(a);
  expect(depuisA).toHaveLength(1);
  expect(depuisA[0]).toMatchObject({ id, statut: "a_verifier", note: "même parrain" });
  expect(depuisA[0].b.id).toBe(b);
  expect((await doutes.doutesIndividu(b))[0].b.id).toBe(a);
  expect((await individus.listeIndividus()).find((i) => i.id === a)?.nbDoutes).toBe(1);
  expect((await tableauDeBord()).aFaire.doutes).toBe(1);

  await doutes.majDoute(id, { statut: "differentes" });
  expect((await doutes.listeDoutes())[0].statut).toBe("differentes");
  expect((await individus.listeIndividus()).find((i) => i.id === a)?.nbDoutes).toBe(0);
  expect(doutes.majDoute(id, { statut: "peut-etre" })).rejects.toThrow();

  // Signaler à nouveau la même paire : le doute est rouvert, la note complétée.
  expect(await doutes.creerDoute(a, b, "mais pas la même mère")).toBe(id);
  expect((await doutes.doutesIndividu(a))[0]).toMatchObject({ statut: "a_verifier", note: "même parrain\nmais pas la même mère" });

  await doutes.supprimerDoute(id);
  expect(await doutes.listeDoutes()).toHaveLength(0);
});

test("recherche liée : créée une fois, sur la première fiche", async () => {
  const a = await nouvelle("Durand", "Pierre");
  const b = await nouvelle("Durant", "Pierre");
  const id = await doutes.creerDoute(a, b, "même date de naissance");
  const tacheId = await doutes.creerRechercheDoute(id);
  expect(await doutes.creerRechercheDoute(id)).toBe(tacheId);
  const d = (await doutes.doutesIndividu(a))[0];
  expect(d.tacheId).toBe(tacheId);
  // L'ordre des deux noms suit celui de la paire (identifiants) : les deux y sont.
  expect(["Lever le doute : DURAND Pierre / DURANT Pierre", "Lever le doute : DURANT Pierre / DURAND Pierre"]).toContain(d.tacheTitre!);
  const r = (await recherches.toutesRecherches()).find((x) => x.id === tacheId);
  expect(r?.statut).toBe("a_faire");
});

test("suppression d'une fiche : ses doutes disparaissent", async () => {
  const a = await nouvelle("Bernard", "Louis");
  const b = await nouvelle("Bernard", "Louis");
  await doutes.creerDoute(a, b);
  await individus.supprimerIndividu(a);
  expect(await doutes.doutesIndividu(b)).toHaveLength(0);
});

test("fusion : le doute entre les deux est levé, ceux du doublon passent à la fiche gardée", async () => {
  const cible = await nouvelle("Petit", "Anne");
  const doublon = await nouvelle("Petit", "Anne Marie");
  const tiers = await nouvelle("Petit", "Marie");
  const autre = await nouvelle("Petit", "Annette");
  await doutes.creerDoute(cible, doublon, "à fusionner");
  await doutes.creerDoute(doublon, tiers, "doute du doublon");
  await doutes.creerDoute(doublon, autre, "en double");
  await doutes.creerDoute(cible, autre, "déjà côté cible");

  await individus.fusionnerIndividus(cible, doublon, {});

  const restants = await doutes.doutesIndividu(cible);
  expect(restants.map((d) => [d.b.id, d.note]).sort()).toEqual(
    [[tiers, "doute du doublon"], [autre, "déjà côté cible"]].sort(),
  );
  // Paires toujours rangées.
  for (const d of await doutes.listeDoutes()) expect(d.a.id < d.b.id).toBe(true);
});
