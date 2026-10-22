import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** Dossier des données : base généalogique, comptes, images. Volume Docker en production (/data). */
export const DOSSIER_DONNEES = resolve(process.env.DOSSIER_DONNEES ?? join(import.meta.dir, "..", "data"));
export const DOSSIER_IMAGES = join(DOSSIER_DONNEES, "images");
export const BASE_DONNEES = join(DOSSIER_DONNEES, "donnees.db");
export const BASE_COMPTES = join(DOSSIER_DONNEES, "comptes.db");

/** Front compilé (vite build), servi par le même serveur en production. */
export const DOSSIER_CLIENT = resolve(process.env.DOSSIER_CLIENT ?? join(import.meta.dir, "..", "dist"));
export const DOSSIER_MIGRATIONS = resolve(process.env.DOSSIER_MIGRATIONS ?? join(import.meta.dir, "..", "drizzle"));

export const PORT = Number(process.env.PORT ?? 3210);

/** Version du programme (package.json), affichée dans l'interface et par /api/sante. */
export const VERSION: string = (await import("../package.json")).version;

/** Fond de carte : OpenStreetMap par défaut, ou un autre fournisseur (modèle d'URL Leaflet). */
export const TUILES = {
  url: process.env.TABULARIUM_TUILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: process.env.TABULARIUM_TUILES_ATTRIBUTION || '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

export function preparerDossiers() {
  mkdirSync(DOSSIER_IMAGES, { recursive: true });
}
