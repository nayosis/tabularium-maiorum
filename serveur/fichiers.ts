import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DOSSIER_IMAGES } from "./config";

/** Nom de fichier image choisi par le serveur (UUID + extension) : jamais de chemin. */
export const nomValide = (nom: string) => /^[a-zA-Z0-9-]+\.[a-z0-9]{2,5}$/.test(nom);

export const cheminImage = (nom: string) => {
  if (!nomValide(nom)) throw new Error(`Nom de fichier invalide : ${nom}`);
  return join(DOSSIER_IMAGES, nom);
};

/** Supprime une image du disque (appelé par les fonctions de suppression de src/data/). */
export async function supprimerImage(nom: string) {
  const chemin = cheminImage(nom);
  if (existsSync(chemin)) unlinkSync(chemin);
}
