import { ErreurServeur } from "./rpc";

export const EXTENSIONS_IMAGE = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

/** Les images sont servies par le serveur, à qui est connecté. */
export const urlImage = (fichier: string) => `/api/images/${encodeURIComponent(fichier)}`;

export type ImageEnregistree = {
  fichier: string;
  largeur: number;
  hauteur: number;
  /** Nom du fichier d'origine (import depuis le disque), pour deviner un numéro de page. */
  nomOrigine?: string;
};

const extension = (nom: string) => nom.split(".").pop()?.toLowerCase() ?? "";

export const estImage = (f: File | string) =>
  typeof f === "string" ? EXTENSIONS_IMAGE.includes(extension(f)) : f.type.startsWith("image/") || EXTENSIONS_IMAGE.includes(extension(f.name));

/** Dimensions lues localement, avant l'envoi (pas d'aller-retour serveur). */
async function dimensions(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { largeur: img.naturalWidth, hauteur: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Envoie une image (collée, déposée ou choisie) au serveur, qui lui donne son nom de fichier. */
export async function enregistrerBlob(blob: Blob): Promise<ImageEnregistree> {
  const taille = await dimensions(blob);
  const formulaire = new FormData();
  formulaire.append("fichier", blob, blob instanceof File ? blob.name : "image");
  const r = await fetch("/api/images", { method: "POST", body: formulaire, headers: { "x-tabularium": "1" }, credentials: "same-origin" });
  const corps = (await r.json().catch(() => ({}))) as { fichier?: string; erreur?: string };
  if (!r.ok || !corps.fichier) throw new ErreurServeur(corps.erreur ?? `Envoi impossible (${r.status})`, r.status);
  return { fichier: corps.fichier, ...taille, nomOrigine: blob instanceof File ? blob.name : undefined };
}

/** Fichier choisi ou déposé : même envoi. */
export const importerFichier = (f: File) => enregistrerBlob(f);

/** Sélecteur de fichiers du navigateur (plusieurs images). */
export function choisirImages(): Promise<File[]> {
  return new Promise((resolve) => {
    const champ = document.createElement("input");
    champ.type = "file";
    champ.multiple = true;
    champ.accept = "image/*";
    champ.onchange = () => resolve(Array.from(champ.files ?? []));
    // Annulation : certains navigateurs signalent « cancel », sinon la promesse reste en attente (sans effet).
    champ.addEventListener("cancel", () => resolve([]));
    champ.click();
  });
}
