import { expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";

const MIGRATIONS = join(import.meta.dir, "..", "drizzle");
ouvrirBase(":memory:", MIGRATIONS);
const individus = await import("../src/data/individus");
const actes = await import("../src/data/actes");
const lieux = await import("../src/data/lieux");
const registres = await import("../src/data/registres");
const gedcom = await import("../src/data/gedcom");
const { donneesCitations } = await import("../src/data/citations");
const { query } = await import("../src/db/client");

// Fichier typique d'un autre logiciel : sources, lieux composés, dates floues, adoption, note partagée.
const FICHIER = `0 HEAD
1 SOUR Heredis
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Jean /MARTIN/
1 SEX M
1 BIRT
2 DATE ABT 1820
2 PLAC Brissac, 49, Maine-et-Loire, France
3 MAP
4 LATI N47.35
4 LONG W0.45
1 OCCU Menuisier
1 FAMS @F1@
0 @I2@ INDI
1 NAME Marie /DUPONT/
1 SEX F
1 BIRT
2 DATE 3 FEB 1825
2 PLAC Angers, 49
2 SOUR @S1@
3 PAGE Acte n° 12, vue 4
1 DEAT
2 DATE BEF 1880
1 FAMS @F1@
1 NOTE @N1@
0 @I3@ INDI
1 NAME Pierre /MARTIN/
1 SEX M
1 BIRT
2 DATE 12 MAR 1850
2 PLAC Brissac, 49
1 FAMC @F1@
2 PEDI adopted
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 10 JUN 1848
2 PLAC Brissac, 49
2 SOUR @S2@
3 PAGE vue 33
0 @S1@ SOUR
1 TITL Angers — Naissances 1820-1830
1 AUTH Archives départementales de Maine-et-Loire
0 @S2@ SOUR
1 TITL Brissac — Mariages
0 @N1@ NOTE Sage-femme
1 CONT du village
0 TRLR
`;

test("import d'un GEDCOM : fiches, union, filiation, lieux, documents à transcrire", async () => {
  const brissac = await lieux.creerLieu("Brissac", "49");
  const bilan = await gedcom.importerGedcom("famille.ged", FICHIER);
  expect(bilan).toMatchObject({ individus: 3, familles: 1, documents: 2, registres: 2, lieux: 1 });

  const liste = await individus.listeIndividus();
  const jean = liste.find((i) => i.prenoms === "Jean")!;
  const marie = liste.find((i) => i.prenoms === "Marie")!;
  const pierre = liste.find((i) => i.prenoms === "Pierre")!;
  expect(jean).toMatchObject({ nom: "Martin", sexe: "M", naissance: "vers 1820", naissanceLieuId: brissac, profession: "Menuisier" });
  expect(marie).toMatchObject({ naissance: "03/02/1825", naissanceMin: "1825-02-03", deces: "avant 1880", notes: "Sage-femme\ndu village" });
  expect(pierre).toMatchObject({ pereId: jean.id, mereId: marie.id });
  expect((await query("select type from filiation where enfant_id = ? limit 1", [pierre.id]))[0][0]).toBe("adoptive");

  // Angers créé avec le département ; Brissac (existant) réutilisé.
  expect((await query("select nom, departement from lieu order by nom")).map((r) => r.join(" "))).toEqual(["Angers 49", "Brissac 49"]);

  // Source de la naissance de Marie : un document à transcrire, dans son registre, relié à la fiche et cité.
  const [d] = await donneesCitations([marie.acteNaissanceId!]);
  expect(d).toMatchObject({ type: "naissance", registreTitre: "Angers — Naissances 1820-1830", archives: "Archives départementales de Maine-et-Loire", date: "03/02/1825" });
  const acteMarie = await actes.chargerActe(marie.acteNaissanceId!);
  expect(acteMarie).toMatchObject({ statut: "a_transcrire" });
  expect(acteMarie!.notes).toContain("Acte n° 12, vue 4");

  // Mariage : union avec son acte, et les deux époux relevés sur l'acte.
  const fiche = await individus.chargerIndividu(jean.id);
  expect(fiche!.couples[0]).toMatchObject({ type: "mariage", date: "10/06/1848", conjointId: marie.id });
  const roles = await query("select role from releve where acte_id = ? order by role", [fiche!.couples[0].acteId]);
  expect(roles.map((r) => r[0])).toEqual(["épouse", "époux"]);
});

test("export GEDCOM 5.5.1 puis réimport dans une base neuve : même arbre", async () => {
  const registre = await registres.creerRegistre("Brissac — Naissances", { serviceArchives: "AD 49", cote: "6 E 54/12" });
  const enfant = (await individus.listeIndividus()).find((i) => i.prenoms === "Pierre")!;
  const acteId = await actes.creerActe([{ fichier: "p.jpg", largeur: 1, hauteur: 1 }], { titre: "Naissance Pierre", type: "naissance", numero: "8", date: "12/03/1850", sourceId: registre }, "21");
  await individus.majIndividu(enfant.id, { acteNaissanceId: acteId, qualificatif: "le jeune" });

  await query("update lieu set latitude = 47.35, longitude = -0.45 where nom = 'Brissac'");
  const texte = await gedcom.exporterGedcom();
  expect(texte).toStartWith("0 HEAD\n1 SOUR TABULARIUM");
  expect(texte).toContain("2 VERS 5.5.1");
  expect(texte).toContain("1 NAME Jean /MARTIN/");
  expect(texte).toContain("2 NICK le jeune");
  expect(texte).toContain("2 DATE ABT 1820");
  expect(texte).toContain("2 PLAC Brissac, 49");
  expect(texte).toContain("4 LATI N47.35");
  expect(texte).toContain("4 LONG W0.45");
  expect(texte).toContain("3 PAGE AD 49, Brissac — Naissances, cote 6 E 54/12 — acte de naissance n° 8 du 12/03/1850, vue 21.");
  expect(texte).toContain("2 PEDI adopted");
  expect(texte.trimEnd()).toEndWith("0 TRLR");

  ouvrirBase(":memory:", MIGRATIONS);
  const bilan = await gedcom.importerGedcom("export.ged", texte);
  expect(bilan).toMatchObject({ individus: 3, familles: 1 });
  const liste = await individus.listeIndividus();
  const pierre = liste.find((i) => i.prenoms === "Pierre")!;
  expect(pierre).toMatchObject({ nom: "Martin", naissance: "12/03/1850", qualificatif: "le jeune" });
  expect(liste.find((i) => i.id === pierre.pereId)?.prenoms).toBe("Jean");
  expect(liste.find((i) => i.id === pierre.mereId)?.prenoms).toBe("Marie");
  const [d] = await donneesCitations([pierre.acteNaissanceId!]);
  expect(d.registreTitre).toBe("Brissac — Naissances");
  expect(d.archives).toBe("AD 49");
  // Coordonnées reprises à l'import.
  expect((await query("select latitude, longitude from lieu where nom = 'Brissac'"))[0]).toEqual([47.35, -0.45]);
});

test("fichier qui n'est pas un GEDCOM : refusé, rien n'est créé", async () => {
  expect(gedcom.importerGedcom("x.txt", "bonjour")).rejects.toThrow();
});
