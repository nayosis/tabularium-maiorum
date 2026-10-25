import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";
import { citation, type DonneesCitation } from "../src/lib/citation";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
const actes = await import("../src/data/actes");
const registres = await import("../src/data/registres");
const lieux = await import("../src/data/lieux");
const { donneesCitations } = await import("../src/data/citations");

const base: DonneesCitation = {
  acteId: "a", titre: "Acte naissance Gouadon Henry 28/11/1897 @ Brissac 49", nature: "acte", type: "naissance", numero: "45",
  date: "29/11/1897", coteActe: null, acteLieu: "Brissac", registreTitre: "Brissac — Naissances", periode: "1893-1902",
  coteRegistre: "6 E 54/12", archives: "Archives départementales de Maine-et-Loire", vue: "12", url: "https://archives49.fr/ark:/123",
};

test("citation complète : archives, registre, période, cote, acte, vue, lien", () => {
  expect(citation(base)).toBe(
    "Archives départementales de Maine-et-Loire, Brissac — Naissances (1893-1902), cote 6 E 54/12 — acte de naissance n° 45 du 29/11/1897, vue 12. En ligne : https://archives49.fr/ark:/123",
  );
});

test("citation partielle : sans registre, sans lien ; photo ; titre en dernier recours", () => {
  const sansRegistre = { ...base, registreTitre: null, periode: null, coteRegistre: null, archives: null, url: null, vue: null };
  expect(citation(sansRegistre)).toBe("Acte de naissance n° 45 du 29/11/1897 à Brissac.");
  expect(citation({ ...sansRegistre, numero: null, date: null, type: null })).toBe("Acte naissance Gouadon Henry 28/11/1897 @ Brissac 49.");
  expect(citation({ ...base, nature: "photo", type: null, numero: null, vue: null, url: null })).toBe(
    "Archives départementales de Maine-et-Loire, Brissac — Naissances (1893-1902), cote 6 E 54/12 — photographie du 29/11/1897.",
  );
  // La période déjà dans le titre du registre n'est pas répétée.
  expect(citation({ ...base, registreTitre: "Brissac — Naissances (1893-1902)", url: null })).toContain("Brissac — Naissances (1893-1902), cote");
});

test("données de citation lues en base : registre, archives, vue de la première page, lien du registre", async () => {
  const brissac = await lieux.creerLieu("Brissac", "49");
  const registre = await registres.creerRegistre("Brissac — Naissances", {
    periode: "1893-1902", cote: "6 E 54/12", serviceArchives: "AD 49", url: "https://archives49.fr/registre",
  });
  const id = await actes.creerActe([{ fichier: "a.jpg", largeur: 10, hauteur: 10 }], { titre: "Acte", type: "naissance", numero: "45", date: "29/11/1897", sourceId: registre, lieuId: brissac }, "12");
  const [d] = await donneesCitations([id, id, ""]);
  expect(d).toMatchObject({ acteId: id, registreTitre: "Brissac — Naissances", archives: "AD 49", vue: "12", url: "https://archives49.fr/registre", acteLieu: "Brissac" });
  expect(citation(d)).toBe("AD 49, Brissac — Naissances (1893-1902), cote 6 E 54/12 — acte de naissance n° 45 du 29/11/1897, vue 12. En ligne : https://archives49.fr/registre");
  expect(await donneesCitations([])).toEqual([]);
});
