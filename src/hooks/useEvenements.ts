import { useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { invalider } from "../lib/query";
import { ID_CLIENT } from "../lib/rpc";

type Evenement =
  | { type: "modification"; par: string; fonction: string; client?: string }
  | { type: "restauration"; par: string };

/**
 * Mise à jour en direct : quand quelqu'un d'autre enregistre, les données affichées sont rechargées
 * (les formulaires en cours de saisie gardent ce qu'on y tape). Après une restauration, la page se recharge.
 */
export function useEvenements() {
  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource("/api/evenements");
    source.onmessage = (m) => {
      let e: Evenement;
      try {
        e = JSON.parse(m.data);
      } catch {
        return;
      }
      if (e.type === "restauration") {
        notifications.show({ color: "orange", title: "Données restaurées", message: `${e.par} a restauré une sauvegarde : la page va se recharger.` });
        setTimeout(() => location.reload(), 2500);
        return;
      }
      if (e.client === ID_CLIENT) return;
      // Plusieurs écritures rapprochées (saisie) : un seul rechargement.
      clearTimeout(minuteur);
      minuteur = setTimeout(() => void invalider(), 400);
    };
    return () => {
      clearTimeout(minuteur);
      source.close();
    };
  }, []);
}
