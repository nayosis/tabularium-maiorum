import { urlImage } from "./images";

type PageImage = { fichier: string };

/** Nom de fichier lisible à partir du titre du document (caractères interdits sous Windows retirés). */
export function nomTelechargement(titre: string, fichier: string, numero?: number) {
  const ext = fichier.split(".").pop() ?? "jpg";
  const base =
    titre
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "document";
  return `${base}${numero ? ` - p${numero}` : ""}.${ext}`;
}

/**
 * Télécharge les images d'un document par le navigateur (dossier « Téléchargements »),
 * une image par page (« titre - p1.jpg »…). Renvoie le nombre d'images.
 */
export async function telechargerImages(titre: string, pages: PageImage[], numeros?: number[]) {
  for (let i = 0; i < pages.length; i++) {
    const a = document.createElement("a");
    a.href = urlImage(pages[i].fichier);
    a.download = nomTelechargement(titre, pages[i].fichier, pages.length > 1 ? (numeros?.[i] ?? i + 1) : undefined);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Laisser au navigateur le temps de lancer chaque téléchargement.
    if (i < pages.length - 1) await new Promise((r) => setTimeout(r, 300));
  }
  return pages.length;
}
