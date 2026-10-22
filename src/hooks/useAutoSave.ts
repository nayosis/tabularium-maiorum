import { useCallback, useEffect, useRef, useState } from "react";
import { ecrire } from "../lib/query";
import { LECTURE_SEULE } from "../lib/mode";

type Options = {
  delai?: number;
  /**
   * Version de la fiche à l'ouverture du formulaire (son `modifieLe`) : transmise à chaque
   * enregistrement, pour être prévenu si quelqu'un d'autre l'a modifiée entre-temps.
   */
  version?: string | null;
};

/**
 * État local d'un formulaire, enregistré automatiquement après une courte pause de frappe.
 * Le composant doit être « keyé » par l'id de l'entité : l'état n'est initialisé qu'une fois.
 */
export function useAutoSave<T extends object>(
  initial: T,
  enregistrer: (patch: Partial<T>, version?: string | null) => Promise<unknown>,
  options: Options = {},
) {
  const delai = options.delai ?? 400;
  const [valeurs, setValeurs] = useState(initial);
  const enAttente = useRef<Partial<T>>({});
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enregistrerRef = useRef(enregistrer);
  enregistrerRef.current = enregistrer;
  const versionRef = useRef(options.version);

  const vider = useCallback(async () => {
    clearTimeout(minuteur.current);
    const patch = enAttente.current;
    enAttente.current = {};
    if (!Object.keys(patch).length) return;
    const res = await ecrire(() => enregistrerRef.current(patch, versionRef.current));
    // La fonction renvoie la nouvelle version : l'enregistrement suivant part de celle-ci.
    if (res && typeof res === "object" && "modifieLe" in res) versionRef.current = (res as { modifieLe: string | null }).modifieLe;
  }, []);

  const modifier = useCallback(
    (patch: Partial<T>) => {
      if (LECTURE_SEULE) return;
      setValeurs((v) => ({ ...v, ...patch }));
      Object.assign(enAttente.current, patch);
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(vider, delai);
    },
    [vider, delai],
  );

  // Enregistre ce qui reste en quittant le formulaire.
  useEffect(() => () => void vider(), [vider]);

  return { valeurs, modifier, vider };
}
