import type { ReactNode } from "react";
import { LECTURE_SEULE } from "../lib/mode";

/**
 * En consultation, fige tous les champs et boutons de formulaire qu'il contient (fieldset désactivé).
 * Les liens (<a>) restent utilisables. Ailleurs, ne change rien.
 */
export function Lecture({ children }: { children: ReactNode }) {
  if (!LECTURE_SEULE) return <>{children}</>;
  return (
    <fieldset disabled className="lecture">
      {children}
    </fieldset>
  );
}

/** N'affiche son contenu que dans l'application (pas sur le site familial). */
export function EnEdition({ children }: { children: ReactNode }) {
  return LECTURE_SEULE ? null : <>{children}</>;
}
