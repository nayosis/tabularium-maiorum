import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { migrer, ouvrirBase } from "../serveur/base";
import { installerSuperAdmin, ouvrirComptes } from "../serveur/comptes";
import { BASE_DONNEES, DOSSIER_DONNEES, DOSSIER_IMAGES, DOSSIER_MIGRATIONS } from "../serveur/config";
import { Database } from "bun:sqlite";

// Base sur disque (la restauration remplace des fichiers), dans le dossier temporaire des tests.
mkdirSync(DOSSIER_IMAGES, { recursive: true });
ouvrirBase(BASE_DONNEES, DOSSIER_MIGRATIONS);
ouvrirComptes(join(DOSSIER_DONNEES, "comptes.db"));
await installerSuperAdmin("super@tabularium.test", "super-mot-de-passe");
const { creerApp } = await import("../serveur/app");
const app = creerApp();
const individus = await import("../src/data/individus");

const connexion = async () => {
  const r = await app.handle(
    new Request("http://local/api/auth/connexion", {
      method: "POST",
      headers: { "content-type": "application/json", "x-tabularium": "1" },
      body: JSON.stringify({ email: "super@tabularium.test", motDePasse: "super-mot-de-passe", souvenir: false }),
    }),
  );
  return (r.headers.get("set-cookie") ?? "").split(";")[0];
};
const cookie = await connexion();

const telecharger = async () => {
  const r = await app.handle(new Request("http://local/api/sauvegarde", { headers: { cookie } }));
  expect(r.status).toBe(200);
  expect(r.headers.get("content-disposition")).toContain("tabularium-sauvegarde-");
  return new Uint8Array(await r.arrayBuffer());
};
const restaurer = (zip: Uint8Array) => {
  const f = new FormData();
  f.append("fichier", new File([zip], "sauvegarde.zip", { type: "application/zip" }));
  return app.handle(new Request("http://local/api/sauvegarde/restaurer", { method: "POST", body: f, headers: { cookie, "x-tabularium": "1" } }));
};

describe("sauvegarde", () => {
  test("aller-retour : téléchargement, modifications, restauration de l'état sauvegardé", async () => {
    const jean = await individus.creerIndividu({ nom: "MARTIN", prenoms: "Jean" });
    writeFileSync(join(DOSSIER_IMAGES, "11111111-aaaa.jpg"), "image");
    const zip = await telecharger();
    const contenu = unzipSync(zip);
    expect(Object.keys(contenu).sort()).toEqual(["images/11111111-aaaa.jpg", "lignee.db", "manifest.json"]);
    expect(JSON.parse(new TextDecoder().decode(contenu["manifest.json"]))).toMatchObject({ application: "Tabularium", format: 1 });

    // Modifications après la sauvegarde
    await individus.creerIndividu({ nom: "APRES", prenoms: "Sauvegarde" });
    writeFileSync(join(DOSSIER_IMAGES, "22222222-bbbb.jpg"), "autre");

    const r = await restaurer(zip);
    const corps = await r.json();
    expect(r.status).toBe(200);
    expect(corps.installe.individus).toBe(1);
    expect((await individus.listeIndividus()).map((i) => i.id)).toEqual([jean]);
    expect(existsSync(join(DOSSIER_IMAGES, "11111111-aaaa.jpg"))).toBe(true);
    // Base précédente conservée à côté ; les images existantes ne sont jamais supprimées.
    expect(existsSync(`${BASE_DONNEES}.avant-restauration`)).toBe(true);
    expect(existsSync(join(DOSSIER_IMAGES, "22222222-bbbb.jpg"))).toBe(true);
  });

  test("sauvegarde de la version de bureau (migrations anciennes) : importée puis mise à niveau", async () => {
    // Base « bureau » à la migration 0006, sans les colonnes ajoutées ensuite.
    const tmp = join(DOSSIER_DONNEES, "bureau.db");
    const ancienne = new Database(tmp, { create: true });
    const toutes = await import("node:fs").then((fs) => fs.readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith(".sql")).sort());
    const dossierPartiel = join(DOSSIER_DONNEES, "migrations-bureau");
    mkdirSync(dossierPartiel, { recursive: true });
    for (const f of toutes.filter((f) => f < "0007")) writeFileSync(join(dossierPartiel, f), readFileSync(join(DOSSIER_MIGRATIONS, f)));
    migrer(ancienne, dossierPartiel);
    ancienne.query("INSERT INTO individu (id, nom) VALUES ('bureau-1', 'BUREAU')").run();
    ancienne.close();

    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify({ application: "Tabularium", format: 1 })),
      "lignee.db": new Uint8Array(readFileSync(tmp)),
      "images/abcdef-12.png": strToU8("png"),
    });
    const r = await restaurer(zip);
    expect(r.status).toBe(200);
    expect(existsSync(join(DOSSIER_IMAGES, "abcdef-12.png"))).toBe(true);
    const liste = await individus.listeIndividus();
    expect(liste.map((i) => i.nom)).toEqual(["BUREAU"]);
    // Colonnes des migrations suivantes présentes (sans_union, portrait…)
    expect(liste[0]).toMatchObject({ sansUnion: false, portrait: null });
  });

  test("ZIP piégé ou étranger refusé, base intacte", async () => {
    const avant = (await individus.listeIndividus()).length;
    const etranger = zipSync({ "photo.jpg": strToU8("x") });
    expect((await (await restaurer(etranger)).json()).erreur).toContain("pas une sauvegarde");
    const piege = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: 1 })),
      "lignee.db": strToU8("ceci n'est pas une base"),
      "../../evasion.txt": strToU8("x"),
      "images/../../evasion.jpg": strToU8("x"),
    });
    const r = await restaurer(piege);
    expect(r.status).toBe(400);
    expect(existsSync(join(DOSSIER_DONNEES, "..", "evasion.txt"))).toBe(false);
    expect((await individus.listeIndividus()).length).toBe(avant);
  });

  test("droits : un admin télécharge, seul le super admin restaure", async () => {
    const r = await app.handle(new Request("http://local/api/sauvegarde"));
    expect(r.status).toBe(401);
  });
});
