/*
 * Tests de la couche de données : les fonctions de src/data/ sur une base SQLite en mémoire,
 * avec l'exécuteur et les migrations du serveur (comme en production).
 * Lancer avec : bun test
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";

ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));

const actes = await import("../src/data/actes");
const releves = await import("../src/data/releves");
const individus = await import("../src/data/individus");
const lieux = await import("../src/data/lieux");
const photos = await import("../src/data/photos");

describe("acte de naissance Gouadon 1897", () => {
  let acteId: string;
  let enfantId: string;
  let grandPereId: string;

  test("création d'un document à partir d'une image", async () => {
    acteId = await actes.creerActe([{ fichier: "a.jpg", largeur: 3000, hauteur: 2000 }]);
    const lieuId = await lieux.creerLieu("Brissac", "49");
    await actes.majActe(acteId, { type: "naissance", date: "29/11/1897", dateMin: "1897-11-29", dateMax: "1897-11-29", lieuId });
    await actes.ajouterLien(acteId, "https://archives.maine-et-loire.fr/…");

    const a = await actes.chargerActe(acteId);
    expect(a?.pages).toHaveLength(1);
    expect(a?.pages[0].largeur).toBe(3000);
    expect(a?.liens).toHaveLength(1);

    const liste = await actes.listeActes();
    expect(liste[0]).toMatchObject({ lieuNom: "Brissac", nbReleves: 0 });
  });

  test("zones surlignées → relevés", async () => {
    const [p] = (await actes.chargerActe(acteId))!.pages;
    enfantId = await actes.creerZonePersonne(acteId, p.id, { x: 10, y: 10, w: 100, h: 20 });
    await releves.majReleve(enfantId, { role: "enfant", nomEcrit: "Gouadon", prenomsEcrits: "Henri Louis René", sexe: "M" });
    grandPereId = await actes.creerZonePersonne(acteId, p.id, { x: 10, y: 300, w: 200, h: 20 });
    await releves.majReleve(grandPereId, { role: "témoin", nomEcrit: "Delhumeau", prenomsEcrits: "Louis Henri", age: "71", relations: "grand-père de l'enfant" });
    await actes.creerZoneNote(acteId, p.id, { x: 0, y: 0, w: 50, h: 50 });

    const annots = await actes.annotationsPages([p.id]);
    expect(annots).toHaveLength(3);
    const zoneGp = annots.find((a) => a.releveId === grandPereId)!;
    expect(zoneGp.rectangles).toEqual([{ x: 10, y: 300, w: 200, h: 20 }]);

    // Maj+tracé : ajout d'un second rectangle à la même zone (texte sur deux lignes).
    await actes.majAnnotation(zoneGp.id, { rectangles: [...zoneGp.rectangles, { x: 0, y: 330, w: 150, h: 20 }] });
    const apres = await actes.annotationsPages([p.id]);
    expect(apres.find((a) => a.id === zoneGp.id)!.rectangles).toHaveLength(2);

    const rs = await releves.relevesActe(acteId);
    expect(rs.map((r) => r.role)).toEqual(["enfant", "témoin"]);
    expect((await actes.listeActes())[0]).toMatchObject({ nbReleves: 2, nbRattaches: 0 });
  });

  test("rattachement relevé → individu, puis détachement", async () => {
    expect(await releves.relevesNonRattaches()).toHaveLength(2);
    const [enfant] = (await releves.relevesActe(acteId)).filter((r) => r.id === enfantId);
    const indId = await releves.creerIndividuDepuisReleve(enfant);

    const ind = await individus.chargerIndividu(indId);
    expect(ind).toMatchObject({ nom: "Gouadon", prenoms: "Henri Louis René", sexe: "M" });
    expect(await releves.relevesIndividu(indId)).toHaveLength(1);
    expect(await releves.relevesNonRattaches()).toHaveLength(1);

    await releves.rattacher(enfantId, null);
    expect(await releves.relevesNonRattaches()).toHaveLength(2);
    await releves.rattacher(enfantId, indId);
  });

  test("père, mère, unions, enfants", async () => {
    const enfant = (await individus.listeIndividus()).find((i) => i.nom === "Gouadon")!;
    const pere = await individus.creerIndividu({ nom: "Gouadon", prenoms: "Ernest Étienne", sexe: "M" });
    const mere = await individus.creerIndividu({ nom: "Delhumeau", prenoms: "Louise Eugénie", sexe: "F" });
    await individus.changerParent(enfant.id, null, pere);
    await individus.changerParent(enfant.id, null, mere);
    await individus.creerCouple(pere, mere);

    const fiche = await individus.chargerIndividu(enfant.id);
    expect(fiche?.pere?.prenoms).toBe("Ernest Étienne");
    expect(fiche?.mere?.prenoms).toBe("Louise Eugénie");

    const fichePere = await individus.chargerIndividu(pere);
    expect(fichePere?.enfants.map((e) => e.id)).toEqual([enfant.id]);
    expect(fichePere?.couples[0].conjointId).toBe(mere);
    const ficheMere = await individus.chargerIndividu(mere);
    expect(ficheMere?.couples[0].conjointId).toBe(pere);

    const liste = await individus.listeIndividus();
    expect(liste.find((i) => i.id === enfant.id)).toMatchObject({ pereId: pere, mereId: mere, nbReleves: 1 });

    // Changement de père.
    const autre = await individus.creerIndividu({ nom: "X", sexe: "M" });
    await individus.changerParent(enfant.id, pere, autre);
    expect((await individus.chargerIndividu(enfant.id))?.pere?.id).toBe(autre);
  });

  test("page partagée entre deux actes, puis suppressions", async () => {
    const [p] = (await actes.chargerActe(acteId))!.pages;
    const autreActe = await actes.creerActe([{ fichier: "b.jpg", largeur: 10, hauteur: 10 }]);
    await actes.ajouterPages(autreActe, [{ fichier: "c.jpg", largeur: 10, hauteur: 10 }]);
    expect((await actes.chargerActe(autreActe))!.pages.map((x) => x.fichier)).toEqual(["b.jpg", "c.jpg"]);

    await actes.supprimerActe(autreActe);
    expect(await actes.chargerActe(autreActe)).toBeNull();

    // Supprimer l'acte Gouadon : relevés, zones et page disparaissent, l'individu reste.
    await actes.supprimerActe(acteId);
    expect(await actes.annotationsPages([p.id])).toHaveLength(0);
    expect(await releves.relevesNonRattaches()).toHaveLength(0);
    expect((await individus.listeIndividus()).find((i) => i.nom === "Gouadon")?.nbReleves).toBe(0);
  });
});

describe("fusion de deux fiches", () => {
  test("relevés, parents, enfants, unions transférés ; doublon supprimé", async () => {
    const acteId = await actes.creerActe([{ fichier: "f.jpg", largeur: 10, hauteur: 10 }]);
    const r1 = await releves.creerReleve(acteId);
    const r2 = await releves.creerReleve(acteId);

    const cible = await individus.creerIndividu({ nom: "Martin", prenoms: "Jean", sexe: "M" });
    const doublon = await individus.creerIndividu({ nom: "Martin", prenoms: "Jean Baptiste", sexe: "M", naissance: "vers 1780", profession: "journalier" });
    await releves.rattacher(r1, cible);
    await releves.rattacher(r2, doublon);

    // Même père des deux côtés (doit rester unique), mère connue seulement du doublon.
    const pere = await individus.creerIndividu({ nom: "Martin", prenoms: "Pierre", sexe: "M" });
    const mere = await individus.creerIndividu({ nom: "Durand", prenoms: "Marie", sexe: "F" });
    await individus.changerParent(cible, null, pere);
    await individus.changerParent(doublon, null, pere);
    await individus.changerParent(doublon, null, mere);

    // Enfant du doublon, épouse du doublon, et une union aberrante cible–doublon.
    const enfant = await individus.creerIndividu({ nom: "Martin", prenoms: "Paul" });
    await individus.changerParent(enfant, null, doublon);
    const epouse = await individus.creerIndividu({ nom: "Petit", prenoms: "Anne", sexe: "F" });
    await individus.creerCouple(epouse, doublon);
    await individus.creerCouple(cible, doublon);

    await individus.fusionnerIndividus(cible, doublon, { prenoms: "Jean Baptiste", naissance: "vers 1780", profession: "journalier" });

    const f = (await individus.chargerIndividu(cible))!;
    expect(f).toMatchObject({ prenoms: "Jean Baptiste", naissance: "vers 1780", profession: "journalier" });
    expect(f.pere?.id).toBe(pere);
    expect(f.mere?.id).toBe(mere);
    expect(f.enfants.map((e) => e.id)).toEqual([enfant]);
    expect(f.couples.map((c) => c.conjointId)).toEqual([epouse]);
    expect((await releves.relevesIndividu(cible)).map((r) => r.id).sort()).toEqual([r1, r2].sort());
    expect(await individus.chargerIndividu(doublon)).toBeNull();
    expect((await individus.chargerIndividu(pere))!.enfants.map((e) => e.id)).toEqual([cible]);
  });

  test("choix entre deux pères différents", async () => {
    const cible = await individus.creerIndividu({ nom: "A", sexe: "M" });
    const doublon = await individus.creerIndividu({ nom: "A", sexe: "M" });
    const pere1 = await individus.creerIndividu({ nom: "P1", sexe: "M" });
    const pere2 = await individus.creerIndividu({ nom: "P2", sexe: "M" });
    await individus.changerParent(cible, null, pere1);
    await individus.changerParent(doublon, null, pere2);

    // On garde le père du doublon.
    await individus.fusionnerIndividus(cible, doublon, {}, [{ enfantId: cible, parentId: pere1 }]);
    const f = (await individus.chargerIndividu(cible))!;
    expect(f.pere?.id).toBe(pere2);
    expect((await individus.chargerIndividu(pere1))!.enfants).toHaveLength(0);
  });

  test("refuse de fusionner une fiche avec elle-même", async () => {
    const a = await individus.creerIndividu({ nom: "Seul" });
    expect(individus.fusionnerIndividus(a, a, {})).rejects.toThrow();
  });
});

describe("reconnaissance d'un enfant né de père inconnu", () => {
  test("filiation justifiée par l'acte de reconnaissance ; père inconnu mémorisé", async () => {
    const reco = await actes.creerActe([{ fichier: "r.jpg", largeur: 10, hauteur: 10 }]);
    await actes.majActe(reco, { type: "reconnaissance" });
    const enfant = await individus.creerIndividu({ nom: "Enfant", pereInconnu: true });
    const mere = await individus.creerIndividu({ nom: "Mère", sexe: "F" });
    await individus.changerParent(enfant, null, mere, { type: "reconnue", acteId: reco });

    let f = (await individus.chargerIndividu(enfant))!;
    expect(f.pereInconnu).toBe(true);
    expect(f.mereInconnue).toBe(false);
    expect(f.mere).toMatchObject({ id: mere, type: "reconnue", filiationActeId: reco });

    await actes.supprimerActe(reco);
    f = (await individus.chargerIndividu(enfant))!;
    expect(f.mere?.filiationActeId).toBeNull();
    expect(f.mere?.type).toBe("reconnue");
  });
});

describe("actes associés aux personnes et aux unions", () => {
  test("associer, puis supprimer l'acte : le lien est simplement retiré", async () => {
    const naissance = await actes.creerActe([{ fichier: "n.jpg", largeur: 10, hauteur: 10 }]);
    const mariage = await actes.creerActe([{ fichier: "m.jpg", largeur: 10, hauteur: 10 }]);
    const a = await individus.creerIndividu({ nom: "A", sexe: "M" });
    const b = await individus.creerIndividu({ nom: "B", sexe: "F" });
    await individus.majIndividu(a, { acteNaissanceId: naissance });
    await individus.creerCouple(a, b, { acteId: mariage, date: "1921" });

    let f = (await individus.chargerIndividu(a))!;
    expect(f.acteNaissanceId).toBe(naissance);
    expect(f.couples[0]).toMatchObject({ acteId: mariage, date: "1921", type: "mariage" });

    await actes.supprimerActe(naissance);
    await actes.supprimerActe(mariage);
    f = (await individus.chargerIndividu(a))!;
    expect(f.acteNaissanceId).toBeNull();
    expect(f.couples[0].acteId).toBeNull();
  });
});

describe("journal de recherche", () => {
  test("recherche, consultations négatives, source réutilisée, trouvé", async () => {
    const recherches = await import("../src/data/recherches");
    const dame = await individus.creerIndividu({ nom: "Dame", sexe: "F" });
    const verruyes = await lieux.creerLieu("Verruyes", "79");
    const table = await actes.creerSource("Table décennale Verruyes 1873-1882");
    await actes.majSource(table, { typeRegistre: "Table décennale", lieuId: verruyes, periode: "1873-1882", url: "https://archives.deux-sevres.fr/…" });

    const r = await recherches.creerRecherche(dame, { titre: "Naissance vers 1877 autour d'Allonne", type: "naissance" });
    await recherches.enregistrerConsultation({ tacheId: r, sourceId: table, date: "2026-09-27", resultat: "rien", notes: "rien sur cette personne" });
    const c2 = await recherches.enregistrerConsultation({ tacheId: r, date: "2026-09-28", resultat: "piste" });
    await recherches.enregistrerConsultation({ id: c2, tacheId: r, notes: "un acte Martin à vérifier", permalien: "https://archives.example/ark:/58825/vta123/v12", vues: "12 à 15" });

    const [rech] = await recherches.recherchesIndividu(dame);
    expect(rech).toMatchObject({ titre: "Naissance vers 1877 autour d'Allonne", statut: "en_cours", type: "naissance" });
    expect(rech.consultations.map((c) => c.resultat)).toEqual(["rien", "piste"]);
    expect(rech.consultations[0]).toMatchObject({ sourceTitre: "Table décennale Verruyes 1873-1882", sourceLieuNom: "Verruyes", sourceUrl: "https://archives.deux-sevres.fr/…" });
    expect(rech.consultations[1]).toMatchObject({ notes: "un acte Martin à vérifier", permalien: "https://archives.example/ark:/58825/vta123/v12", vues: "12 à 15" });

    // La même source consultée pour une autre personne : visible depuis la source.
    const autre = await individus.creerIndividu({ nom: "Autre" });
    const r2 = await recherches.creerRecherche(autre, { titre: "Décès" });
    await recherches.enregistrerConsultation({ tacheId: r2, sourceId: table, date: "2026-09-29" });
    const src = (await recherches.sourcesEtConsultations()).find((s) => s.id === table)!;
    expect(src.consultations.map((c) => c.individuNom)).toEqual(["Autre", "Dame"]);

    // Trouvé : date de fin posée ; liste globale.
    await recherches.majRecherche(r, { statut: "trouve" });
    const liste = await recherches.toutesRecherches();
    expect(liste.find((x) => x.id === r)).toMatchObject({ statut: "trouve", nbConsultations: 2, derniere: "2026-09-28", individuNom: "Dame" });
    expect(liste.find((x) => x.id === r)!.termineLe).not.toBeNull();

    // Supprimer la recherche supprime ses consultations, pas la source.
    await recherches.supprimerRecherche(r);
    expect(await recherches.recherchesIndividu(dame)).toEqual([]);
    expect((await recherches.sourcesEtConsultations()).find((s) => s.id === table)!.consultations).toHaveLength(1);
  });
});

describe("liasses et index", () => {
  test("plusieurs actes sur les mêmes images, acte à cheval sur deux images", async () => {
    // Un pli de 2 images importé comme un document, puis découpé en actes.
    const acte1 = await actes.creerActe([
      { fichier: "pli1.jpg", largeur: 10, hauteur: 10 },
      { fichier: "pli2.jpg", largeur: 10, hauteur: 10 },
    ]);
    const [img1, img2] = (await actes.chargerActe(acte1))!.pages;
    expect((await actes.chargerActe(acte1))!.nature).toBe("acte");

    // Acte 2 commence sur l'image 1…
    const acte2 = await actes.creerActeSurPages([img1.id], { type: "mariage" });
    let v = await actes.voisinsDansLaLiasse(acte2);
    expect(v.actes.map((a) => a.id)).toEqual([acte1]);
    expect(v.pages.map((p) => p.id)).toEqual([img2.id]);

    // … et continue sur l'image 2.
    await actes.lierPage(acte2, img2.id);
    await actes.lierPage(acte2, img2.id); // sans doublon
    expect((await actes.chargerActe(acte2))!.pages.map((p) => p.id)).toEqual([img1.id, img2.id]);
    v = await actes.voisinsDansLaLiasse(acte2);
    expect(v.pages).toEqual([]);

    // Retirer une image d'un acte ne la supprime pas si un autre acte l'utilise.
    await actes.retirerPage(acte1, img2.id);
    expect((await actes.chargerActe(acte2))!.pages).toHaveLength(2);
    expect((await actes.chargerActe(acte1))!.pages.map((p) => p.id)).toEqual([img1.id]);
  });

  test("ligne d'index renvoyant à l'acte trouvé", async () => {
    const table = await actes.creerActe([{ fichier: "td.jpg", largeur: 10, hauteur: 10 }]);
    await actes.majActe(table, { nature: "index", type: "table_decennale" });
    const acteTrouve = await actes.creerActe([{ fichier: "n.jpg", largeur: 10, hauteur: 10 }]);
    const ligne = await releves.creerReleve(table);
    await releves.majReleve(ligne, { role: "enfant", naissance: "12/03/1847", naissanceMin: "1847-03-12", naissanceMax: "1847-03-12", acteRenvoiId: acteTrouve });

    const [r] = await releves.relevesActe(table);
    expect(r).toMatchObject({ acteRenvoiId: acteTrouve });
    expect((await actes.listeActes()).find((a) => a.id === table)).toMatchObject({ nature: "index", type: "table_decennale" });

    await actes.supprimerActe(acteTrouve);
    expect((await releves.relevesActe(table))[0].acteRenvoiId).toBeNull();
  });
});

describe("regroupement des documents par registre", () => {
  test("rattacher des pages d'index à un registre, avec leur numéro de page", async () => {
    const d1 = await actes.creerActe([{ fichier: "p159.jpg", largeur: 10, hauteur: 10 }]);
    const d2 = await actes.creerActe([{ fichier: "p12.jpg", largeur: 10, hauteur: 10 }]);
    const d3 = await actes.creerActe([{ fichier: "p7.jpg", largeur: 10, hauteur: 10 }]);
    // d3 a déjà un numéro saisi à la main : il n'est pas écrasé.
    await actes.majPage((await actes.chargerActe(d3))!.pages[0].id, { numeroVue: "7 bis" });
    const reg = await actes.creerSource("Tables décennales Allonne 1803-1892");

    await actes.regrouperDansRegistre([d1, d2, d3], reg, { [d1]: "159", [d2]: "12", [d3]: "7" });
    await actes.majStatutActes([d1, d2], "exploite");

    const liste = await actes.listeActes();
    const par = (id: string) => liste.find((a) => a.id === id)!;
    expect(par(d1)).toMatchObject({ sourceId: reg, sourceTitre: "Tables décennales Allonne 1803-1892", numeroPage: "159", statut: "exploite" });
    expect(par(d2)).toMatchObject({ numeroPage: "12", statut: "exploite" });
    expect(par(d3)).toMatchObject({ numeroPage: "7 bis", statut: "a_analyser" });

    // Retirer du registre.
    await actes.regrouperDansRegistre([d3], null);
    expect((await actes.listeActes()).find((a) => a.id === d3)!.sourceId).toBeNull();
  });
});

describe("liste des individus : lieux et actes reliés", () => {
  test("communes de naissance et de décès, actes de naissance / mariage / décès", async () => {
    const brissac = await lieux.creerLieu("Brissac-Lieux", "49");
    const saumur = await lieux.creerLieu("Saumur-Lieux", "49");
    const naiss = await actes.creerActe([{ fichier: "ln.jpg", largeur: 10, hauteur: 10 }]);
    const mar = await actes.creerActe([{ fichier: "lm.jpg", largeur: 10, hauteur: 10 }]);
    const a = await individus.creerIndividu({ nom: "Lieux-A", naissanceLieuId: brissac, decesLieuId: saumur, acteNaissanceId: naiss });
    const b = await individus.creerIndividu({ nom: "Lieux-B" });
    await individus.creerCouple(a, b, { acteId: mar });
    const c = await individus.creerIndividu({ nom: "Lieux-C" });

    const liste = await individus.listeIndividus();
    const par = (id: string) => liste.find((i) => i.id === id)!;
    expect(par(a)).toMatchObject({ naissanceLieuNom: "Brissac-Lieux", decesLieuNom: "Saumur-Lieux", acteNaissanceId: naiss, acteMariage: 1 });
    expect(par(b)).toMatchObject({ acteMariage: 1, naissanceLieuNom: null });
    expect(par(c)).toMatchObject({ acteMariage: 0, acteNaissanceId: null, acteDecesId: null });

    const arbre = await individus.donneesArbre();
    expect(arbre.personnes.find((p) => p.id === a)).toMatchObject({ naissanceLieu: "Brissac-Lieux", decesLieu: "Saumur-Lieux", acteNaissanceId: naiss, acteMariage: 1 });
    expect(arbre.personnes.find((p) => p.id === c)).toMatchObject({ acteNaissanceId: null, acteMariage: 0 });
  });
});

describe("registres", () => {
  test("ajouter un document directement dans un registre ; comptages", async () => {
    const R = await import("../src/data/registres");
    const reg = await R.creerRegistre("Tables décennales Verruyes 1803-1892");
    const doc = await actes.creerActe([{ fichier: "v172.jpg", largeur: 10, hauteur: 10 }], {
      sourceId: reg, nature: "index", type: "table_decennale", titre: "Tables décennales Verruyes 1803-1892 — p. 172",
    }, "172");
    const r = await releves.creerReleve(doc);
    const a = (await actes.chargerActe(doc))!;
    expect(a).toMatchObject({ sourceId: reg, nature: "index", type: "table_decennale" });
    expect(a.pages[0]).toMatchObject({ numeroVue: "172", sourceId: reg });

    const recherches = await import("../src/data/recherches");
    const ind = await individus.creerIndividu({ nom: "Registre" });
    const t = await recherches.creerRecherche(ind, { titre: "Naissance" });
    await recherches.enregistrerConsultation({ tacheId: t, sourceId: reg });

    const reg2 = (await R.listeRegistres()).find((x) => x.id === reg)!;
    expect(reg2).toMatchObject({ nbDocuments: 1, nbReleves: 1, nbConsultations: 1 });

    // Supprimer le registre : le document reste, sans registre.
    await R.supprimerRegistre(reg);
    expect((await actes.chargerActe(doc))!.sourceId).toBeNull();
    expect(r).toBeTruthy();
  });

  test("numéro de page deviné depuis le nom du fichier", async () => {
    const { numeroDepuisNomFichier: n } = await import("../src/lib/regroupement");
    expect(n("Allonne tables page 172.jpg")).toBe("172");
    expect(n("FRAD079_3E12_0172.jpg")).toBe("172");
    expect(n("vue 12.png")).toBe("12");
    expect(n("IMG_1850.jpg")).toBeNull();
    expect(n("capture.png")).toBeNull();
    expect(n(undefined)).toBeNull();
  });
});

describe("photos", () => {
  test("galerie : première image, personnes identifiées, inconnus, tri par date", async () => {
    const jean = await individus.creerIndividu({ nom: "MARTIN", prenoms: "Jean" });
    const groupe = await actes.creerActe(
      [{ fichier: "recto.jpg", largeur: 1200, hauteur: 800 }, { fichier: "verso.jpg", largeur: 1200, hauteur: 800 }],
      { nature: "photo", titre: "Mariage", date: "vers 1920", dateMin: "1918-01-01", dateMax: "1922-12-31" },
    );
    const portrait = await actes.creerActe([{ fichier: "portrait.jpg", largeur: 600, hauteur: 800 }], {
      nature: "photo",
      titre: "Portrait",
      dateMin: "1905-01-01",
      dateMax: "1905-12-31",
    });
    const [recto] = (await actes.chargerActe(groupe))!.pages;
    const r1 = await actes.creerZonePersonne(groupe, recto.id, { x: 0, y: 0, w: 100, h: 100 });
    await releves.rattacher(r1, jean);
    await actes.creerZonePersonne(groupe, recto.id, { x: 200, y: 0, w: 100, h: 100 });

    const liste = await photos.listePhotos();
    expect(liste.map((p) => p.titre)).toEqual(["Portrait", "Mariage"]);
    const mariage = liste.find((p) => p.id === groupe)!;
    expect(mariage).toMatchObject({ fichier: "recto.jpg", nbImages: 2, nbInconnus: 1 });
    expect(mariage.identifies).toEqual([{ id: jean, nom: "MARTIN", prenoms: "Jean" }]);
    expect(liste.find((p) => p.id === portrait)).toMatchObject({ nbInconnus: 0, identifies: [] });
    // Les actes ne sont pas des photos.
    expect(liste.every((p) => p.id === groupe || p.id === portrait)).toBe(true);
  });

  test("portrait : zone d'une photo, lu partout, retiré si la zone disparaît", async () => {
    const marie = await individus.creerIndividu({ nom: "DUPONT", prenoms: "Marie" });
    const photo = await actes.creerActe([{ fichier: "groupe.jpg", largeur: 1000, hauteur: 600 }], { nature: "photo", titre: "Groupe" });
    const [img] = (await actes.chargerActe(photo))!.pages;
    const r = await actes.creerZonePersonne(photo, img.id, { x: 10, y: 20, w: 30, h: 40 });
    await releves.rattacher(r, marie);
    const { query } = await import("../src/db/client");
    const zone = (await query("select id from annotation where releve_id = ?", [r]))[0][0] as string;
    await individus.majIndividu(marie, { portraitAnnotationId: zone });

    const attendu = { annotationId: zone, fichier: "groupe.jpg", largeur: 1000, hauteur: 600, rects: [{ x: 10, y: 20, w: 30, h: 40 }] };
    expect((await individus.chargerIndividu(marie))!.portrait).toEqual(attendu);
    expect((await individus.listeIndividus()).find((i) => i.id === marie)!.portrait).toEqual(attendu);
    expect((await individus.donneesArbre()).personnes.find((p) => p.id === marie)!.portrait).toEqual(attendu);
    expect(await photos.photosIndividu(marie)).toEqual([{ acteId: photo, titre: "Groupe", date: null, portrait: attendu, fichier: "groupe.jpg" }]);

    await actes.supprimerAnnotation(zone);
    expect((await individus.chargerIndividu(marie))!.portrait).toBeNull();
  });
});


describe("téléchargement", () => {
  test("nom de fichier tiré du titre, sans caractères interdits, numéro de page si plusieurs", async () => {
    const { nomTelechargement } = await import("../src/lib/telechargement");
    expect(nomTelechargement("Acte naissance GOUADON Henry 28/11/1897 @ Brissac 49", "abc.jpg")).toBe(
      "Acte naissance GOUADON Henry 28 11 1897 @ Brissac 49.jpg",
    );
    expect(nomTelechargement("Tables : NMD? « Verruyes »", "x.png", 2)).toBe("Tables NMD « Verruyes » - p2.png");
    expect(nomTelechargement("   ", "x.jpg")).toBe("document.jpg");
  });
});
