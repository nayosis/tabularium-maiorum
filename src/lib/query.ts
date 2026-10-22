import { QueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { LECTURE_SEULE } from "./mode";
import { ErreurServeur } from "./rpc";
import type { DetailsConflit } from "./conflit";
import { signalerConflit } from "./alerteConflit";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
  },
});

/** Base petite : après chaque écriture on rafraîchit tout, c'est instantané. */
export const invalider = () => queryClient.invalidateQueries();

/** Exécute une écriture, rafraîchit les données, affiche l'erreur éventuelle. */
export async function ecrire<T>(action: () => Promise<T>): Promise<T | undefined> {
  if (LECTURE_SEULE) {
    notifications.show({ color: "gray", message: "Compte en lecture seule : rien n'est modifiable." });
    return undefined;
  }
  try {
    const res = await action();
    await invalider();
    return res;
  } catch (e) {
    if (e instanceof ErreurServeur && e.statut === 409) {
      signalerConflit(e.details as DetailsConflit | undefined);
      return undefined;
    }
    notifications.show({ color: "red", title: "Erreur", message: e instanceof Error ? e.message : String(e) });
    return undefined;
  }
}
