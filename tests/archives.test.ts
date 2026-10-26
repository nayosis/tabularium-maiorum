import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";
import { DEPARTEMENTS, liensAffiches, liensFournis, liensMasques, trouverDepartement } from "../src/lib/archives";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
const archives = await import("../src/data/archives");

test("annuaire : 101 départements, codes uniques, sites en https", () => {
  expect(DEPARTEMENTS).toHaveLength(101);
  expect(new Set(DEPARTEMENTS.map((d) => d.code)).size).toBe(101);
  expect(DEPARTEMENTS.every((d) => d.site === null || d.site.startsWith("https://"))).toBe(true);
});

test("département d'un lieu : code, code sur trois chiffres, nom avec ou sans accents", () => {
  expect(trouverDepartement("49")?.nom).toBe("Maine-et-Loire");
  expect(trouverDepartement("049")?.code).toBe("49");
  expect(trouverDepartement("deux-sevres")?.code).toBe("79");
  expect(trouverDepartement("2a")?.nom).toBe("Corse-du-Sud");
  expect(trouverDepartement("01")?.nom).toBe("Ain");
  expect(trouverDepartement("Atlantis")).toBeNull();
});

test("liens fournis corrigés, masqués, ajoutés ; rétablis en supprimant la correction", async () => {
  const [site, detail] = liensFournis("44");
  expect(site).toMatchObject({ categorie: "site", url: "https://archives.loire-atlantique.fr" });

  await archives.enregistrerLienArchives({ departement: "44", categorie: "site", libelle: "Nouveau site", url: "https://exemple.fr/ad44", defaut: site.url });
  await archives.masquerLienArchives("44", detail.url, detail.categorie);
  await archives.enregistrerLienArchives({ departement: "44", categorie: "recensements", libelle: "Recensements de Nantes", url: "https://exemple.fr/recensements" });
  expect(archives.enregistrerLienArchives({ departement: "44", categorie: "autre", libelle: "x", url: "ftp://non" })).rejects.toThrow();

  let perso = await archives.liensArchivesPerso();
  const affiches = liensAffiches("44", perso);
  expect(affiches.map((l) => [l.origine, l.libelle])).toEqual([
    ["corrige", "Nouveau site"],
    ["fourni", "Conscrits militaires (recherche nominative)"],
    ["ajoute", "Recensements de Nantes"],
  ]);
  expect(liensMasques("44", perso)).toHaveLength(1);

  // Rétablir le site fourni et le lien masqué.
  await archives.supprimerLienArchives(affiches[0].id!);
  await archives.supprimerLienArchives(liensMasques("44", perso)[0].id);
  perso = await archives.liensArchivesPerso();
  expect(liensAffiches("44", perso).filter((l) => l.origine === "fourni")).toHaveLength(3);
});
