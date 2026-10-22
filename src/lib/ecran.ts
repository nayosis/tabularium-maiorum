import { useMediaQuery } from "@mantine/hooks";

export type TypeEcran = "telephone" | "tablette" | "ordinateur";

/**
 * Type d'écran, seule source de vérité pour adapter l'interface :
 * téléphone < 768 px ≤ tablette < 1200 px ≤ ordinateur. `tactile` : pointeur grossier (doigt).
 */
export function useEcran() {
  const petit = useMediaQuery("(max-width: 767.98px)", false, { getInitialValueInEffect: false });
  const moyen = useMediaQuery("(max-width: 1199.98px)", false, { getInitialValueInEffect: false });
  const tactile = useMediaQuery("(pointer: coarse)", false, { getInitialValueInEffect: false });
  const type: TypeEcran = petit ? "telephone" : moyen ? "tablette" : "ordinateur";
  return { type, telephone: type === "telephone", tablette: type === "tablette", ordinateur: type === "ordinateur", tactile };
}
