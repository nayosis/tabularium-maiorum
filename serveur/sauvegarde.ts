/*
 * Sauvegarde et restauration : un ZIP contenant `manifest.json`, `lignee.db` et `images/`,
 * au même format que la version de bureau (une sauvegarde de bureau s'importe telle quelle).
 *
 * - La base est copiée par `VACUUM INTO` : copie cohérente même pendant l'utilisation.
 * - La restauration extrait dans un dossier temporaire, vérifie le manifeste et la base (intégrité),
 *   ignore tout chemin inattendu, puis remplace base et images. L'état précédent est gardé à côté
 *   (`donnees.db.avant-restauration`) ; les images de la sauvegarde rejoignent les images existantes.
 *   Les comptes ne sont pas touchés.
 */
import { Database } from "bun:sqlite";
import {
  closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, rmSync, statSync, unlinkSync, writeSync,
} from "node:fs";
import { join } from "node:path";
import { Unzip, UnzipInflate, UnzipPassThrough, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { baseCourante, fermerBase, ouvrirBase } from "./base";
import { BASE_DONNEES, DOSSIER_DONNEES, DOSSIER_IMAGES, DOSSIER_MIGRATIONS } from "./config";
import { nomValide } from "./fichiers";

const MANIFESTE = "manifest.json";
// Nom historique du fichier dans le ZIP : inchangé, pour relire toutes les sauvegardes.
const BASE = "lignee.db";
const IMAGES = "images/";

export type Manifeste = {
  application: "Tabularium";
  format: 1;
  creeLe: string;
  motif: string;
  migrations: string[];
  compteurs: { documents: number; images: number; releves: number; individus: number; lieux: number };
};

export function manifeste(base: Database, motif: string): Manifeste {
  const c = base
    .query(
      `select (select count(*) from acte), (select count(*) from page), (select count(*) from releve),
              (select count(*) from individu), (select count(*) from lieu)`,
    )
    .values()[0]
    .map(Number);
  const migrations = base.query("select nom from __migrations order by nom").values().map((r) => r[0] as string);
  const [documents, images, releves, individus, lieux] = c;
  return { application: "Tabularium", format: 1, creeLe: new Date().toISOString(), motif, migrations, compteurs: { documents, images, releves, individus, lieux } };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const nomSauvegarde = (d = new Date()) =>
  `tabularium-sauvegarde-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}h${pad(d.getMinutes())}.zip`;

/**
 * Lecture d'un fichier par blocs, fermé dès la fin : sous Windows, un fichier resté ouvert
 * empêcherait ensuite de le déplacer ou de le supprimer (restauration).
 */
function* blocsDe(chemin: string, taille = 1024 * 1024) {
  const fd = openSync(chemin, "r");
  try {
    const tampon = new Uint8Array(taille);
    for (;;) {
      const lus = readSync(fd, tampon, 0, taille, null);
      if (!lus) return;
      yield tampon.slice(0, lus);
    }
  } finally {
    closeSync(fd);
  }
}

/** ZIP de sauvegarde, produit au fil de l'eau (pas tout en mémoire). */
export function fluxSauvegarde(): ReadableStream<Uint8Array> {
  const base = baseCourante();
  const copie = join(DOSSIER_DONNEES, `export-${crypto.randomUUID()}.db`);
  base.query("VACUUM INTO ?").run(copie);
  const m = manifeste(base, "export");
  const images = existsSync(DOSSIER_IMAGES) ? readdirSync(DOSSIER_IMAGES).filter(nomValide) : [];
  const nettoyer = () => existsSync(copie) && unlinkSync(copie);

  return new ReadableStream({
    async start(controller) {
      const zip = new Zip((err, morceau, fin) => {
        if (err) {
          nettoyer();
          return controller.error(err);
        }
        controller.enqueue(morceau);
        if (fin) {
          nettoyer();
          controller.close();
        }
      });
      const ajouter = async (nom: string, blocs: Iterable<Uint8Array>, compresser: boolean) => {
        const entree = compresser ? new ZipDeflate(nom, { level: 6 }) : new ZipPassThrough(nom);
        zip.add(entree);
        for (const bloc of blocs) {
          entree.push(bloc);
          // Laisser respirer la boucle d'événements entre deux blocs.
          await Promise.resolve();
        }
        entree.push(new Uint8Array(0), true);
      };
      try {
        await ajouter(MANIFESTE, [new TextEncoder().encode(JSON.stringify(m, null, 2))], true);
        await ajouter(BASE, blocsDe(copie), true);
        // Images déjà compressées (JPEG, PNG…) : stockées telles quelles.
        for (const nom of images) await ajouter(IMAGES + nom, blocsDe(join(DOSSIER_IMAGES, nom)), false);
        zip.end();
      } catch (e) {
        nettoyer();
        controller.error(e);
      }
    },
  });
}

/** Extrait le ZIP dans `dossier` : seulement le manifeste, la base et des images au nom sûr. */
async function extraire(zip: Blob, dossier: string) {
  mkdirSync(join(dossier, "images"), { recursive: true });
  let erreur: unknown = null;
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  unzip.onfile = (f) => {
    const nom = f.name.replace(/\\/g, "/");
    let cible: string | null = null;
    if (nom === MANIFESTE) cible = join(dossier, MANIFESTE);
    else if (nom === BASE) cible = join(dossier, BASE);
    else if (nom.startsWith(IMAGES) && nomValide(nom.slice(IMAGES.length))) cible = join(dossier, "images", nom.slice(IMAGES.length));
    // Tout autre chemin (« ../ », absolu, inattendu) est ignoré.
    if (!cible) return;
    // Écriture synchrone, fichier fermé dès la fin : sous Windows, un fichier resté ouvert
    // empêcherait de déplacer le dossier ensuite.
    const fd = openSync(cible, "w");
    f.ondata = (err, donnees, fin) => {
      if (err) erreur = err;
      else if (donnees.length) writeSync(fd, donnees);
      if (err || fin) closeSync(fd);
    };
    f.start();
  };
  for await (const bloc of zip.stream()) unzip.push(bloc);
  unzip.push(new Uint8Array(0), true);
  if (erreur) throw new Error(`Archive illisible : ${String(erreur)}`);
}

/** Vérifie une sauvegarde extraite : manifeste Tabularium, base SQLite intègre contenant les tables attendues. */
function verifier(dossier: string): Partial<Manifeste> {
  const chemin = join(dossier, MANIFESTE);
  if (!existsSync(chemin)) throw new Error("Ce fichier n'est pas une sauvegarde Tabularium (manifest.json absent).");
  let m: Partial<Manifeste>;
  try {
    m = JSON.parse(readFileSync(chemin, "utf8"));
  } catch {
    throw new Error("Manifeste de sauvegarde illisible.");
  }
  if (m.format !== 1) throw new Error("Format de sauvegarde inconnu.");
  if (!existsSync(join(dossier, BASE))) throw new Error("La sauvegarde ne contient pas de base de données.");
  const base = new Database(join(dossier, BASE), { readonly: true });
  try {
    const integrite = base.query("PRAGMA integrity_check").values()[0]?.[0];
    if (integrite !== "ok") throw new Error(`Base de la sauvegarde endommagée (${integrite}).`);
    const tables = new Set(base.query("select name from sqlite_master where type = 'table'").values().map((r) => r[0]));
    for (const t of ["acte", "individu", "releve", "__migrations"]) {
      if (!tables.has(t)) throw new Error("La sauvegarde ne contient pas une base Tabularium.");
    }
  } finally {
    base.close();
  }
  return m;
}

const remplacer = (source: string, cible: string, ancien: string) => {
  if (existsSync(ancien)) rmSync(ancien, { recursive: true, force: true });
  if (existsSync(cible)) renameSync(cible, ancien);
  renameSync(source, cible);
};

/**
 * Restaure une sauvegarde (ZIP de la version web ou de bureau) : remplace la base et les images,
 * applique les migrations manquantes. Renvoie le manifeste et les compteurs de la base installée.
 */
export async function restaurer(zip: Blob) {
  const dossier = join(DOSSIER_DONNEES, `restauration-${crypto.randomUUID()}`);
  try {
    await extraire(zip, dossier);
    const m = verifier(dossier);

    // Installation : base (et ses fichiers WAL) puis images, l'état précédent gardé à côté.
    fermerBase();
    for (const suffixe of ["-wal", "-shm"]) if (existsSync(BASE_DONNEES + suffixe)) unlinkSync(BASE_DONNEES + suffixe);
    try {
      remplacer(join(dossier, BASE), BASE_DONNEES, `${BASE_DONNEES}.avant-restauration`);
    } finally {
      ouvrirBase(BASE_DONNEES, DOSSIER_MIGRATIONS);
    }
    // Images : copiées à côté des existantes (noms uniques). Les anciennes restent sur le disque :
    // rien n'est perdu, et un fichier en cours de lecture ne peut pas bloquer la restauration.
    mkdirSync(DOSSIER_IMAGES, { recursive: true });
    for (const nom of readdirSync(join(dossier, "images"))) {
      const cible = join(DOSSIER_IMAGES, nom);
      if (!existsSync(cible)) copyFileSync(join(dossier, "images", nom), cible);
    }
    return { manifeste: m, installe: manifeste(baseCourante(), "restauration").compteurs };
  } finally {
    if (existsSync(dossier)) rmSync(dossier, { recursive: true, force: true });
  }
}

/** Taille approximative des données (base + images), pour l'affichage. */
export function tailleDonnees() {
  const base = existsSync(BASE_DONNEES) ? statSync(BASE_DONNEES).size : 0;
  const images = existsSync(DOSSIER_IMAGES) ? readdirSync(DOSSIER_IMAGES).reduce((t, f) => t + statSync(join(DOSSIER_IMAGES, f)).size, 0) : 0;
  return { base, images };
}
