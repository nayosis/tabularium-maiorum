import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Installation } from "../src/lib/versions";

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

/** Type d'installation (docker : fixé par l'image ; ordinateur : par l'exécutable) : dit comment mettre à jour. */
export const INSTALLATION: Installation =
  process.env.TABULARIUM_INSTALLATION === "docker" || process.env.TABULARIUM_INSTALLATION === "ordinateur" ? process.env.TABULARIUM_INSTALLATION : "source";

/** Vérifier sur GitHub qu'une nouvelle version existe (désactivable : TABULARIUM_VERIFIER_MISES_A_JOUR=non). */
export const VERIFIER_MISES_A_JOUR = !["non", "no", "false", "0"].includes((process.env.TABULARIUM_VERIFIER_MISES_A_JOUR ?? "").toLowerCase());

export function preparerDossiers() {
  mkdirSync(DOSSIER_IMAGES, { recursive: true });
}
