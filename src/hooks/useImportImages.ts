import { useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { LECTURE_SEULE } from "../lib/mode";
import { enregistrerBlob, estImage, type ImageEnregistree } from "../lib/images";

/**
 * Reçoit des images par glisser-déposer (fichiers de l'explorateur) ou par Ctrl+V
 * (capture d'écran, image copiée depuis le navigateur). `survol` indique un glisser en cours.
 */
export function useImportImages(recevoir: (images: ImageEnregistree[]) => void | Promise<void>, actif = true) {
  const [survol, setSurvol] = useState(false);
  const recevoirRef = useRef(recevoir);
  recevoirRef.current = recevoir;

  useEffect(() => {
    if (!actif || LECTURE_SEULE) return;

    const traiter = async (fichiers: File[]) => {
      if (!fichiers.length) return;
      try {
        await recevoirRef.current(await Promise.all(fichiers.map(enregistrerBlob)));
      } catch (e) {
        notifications.show({ color: "red", title: "Import impossible", message: String(e instanceof Error ? e.message : e) });
      }
    };

    const coller = (e: ClipboardEvent) => {
      const fichiers = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (!fichiers.length) return;
      e.preventDefault();
      void traiter(fichiers);
    };

    // Glisser-déposer : on ne réagit qu'aux fichiers (pas aux textes ni aux éléments de la page).
    let profondeur = 0;
    const avecFichiers = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const entrer = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      e.preventDefault();
      profondeur++;
      setSurvol(true);
    };
    const survoler = (e: DragEvent) => {
      if (avecFichiers(e)) e.preventDefault();
    };
    const quitter = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      profondeur = Math.max(0, profondeur - 1);
      if (!profondeur) setSurvol(false);
    };
    const deposer = (e: DragEvent) => {
      if (!avecFichiers(e)) return;
      e.preventDefault();
      profondeur = 0;
      setSurvol(false);
      const fichiers = Array.from(e.dataTransfer?.files ?? []);
      const images = fichiers.filter(estImage);
      if (images.length < fichiers.length) {
        notifications.show({ color: "yellow", message: "Seules les images (jpg, png, webp, gif, bmp) sont importées." });
      }
      void traiter(images);
    };

    window.addEventListener("paste", coller);
    window.addEventListener("dragenter", entrer);
    window.addEventListener("dragover", survoler);
    window.addEventListener("dragleave", quitter);
    window.addEventListener("drop", deposer);
    return () => {
      window.removeEventListener("paste", coller);
      window.removeEventListener("dragenter", entrer);
      window.removeEventListener("dragover", survoler);
      window.removeEventListener("dragleave", quitter);
      window.removeEventListener("drop", deposer);
    };
  }, [actif]);

  return { survol };
}
