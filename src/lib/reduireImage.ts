/**
 * Photos de téléphone (souvent 4000 à 8000 px) : réduites avant l'envoi pour ménager le réseau mobile,
 * tout en restant largement lisibles pour un acte manuscrit.
 */
export const COTE_MAX = 4000;
export const QUALITE = 0.9;

/** Dimensions après réduction : le plus grand côté ramené à `max`, proportions gardées ; inchangées si déjà plus petites. */
export function dimensionsReduites(largeur: number, hauteur: number, max = COTE_MAX) {
  const cote = Math.max(largeur, hauteur);
  if (cote <= max) return { largeur, hauteur, reduite: false };
  const f = max / cote;
  return { largeur: Math.round(largeur * f), hauteur: Math.round(hauteur * f), reduite: true };
}

/** Réduit l'image si besoin (JPEG) ; sinon renvoie le fichier tel quel. */
export async function reduireImage(fichier: File, max = COTE_MAX): Promise<File> {
  const bitmap = await createImageBitmap(fichier);
  try {
    const d = dimensionsReduites(bitmap.width, bitmap.height, max);
    if (!d.reduite) return fichier;
    const canvas = document.createElement("canvas");
    canvas.width = d.largeur;
    canvas.height = d.hauteur;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, d.largeur, d.hauteur);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", QUALITE));
    if (!blob) return fichier;
    const nom = fichier.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nom, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
