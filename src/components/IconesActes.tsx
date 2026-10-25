import { Group, Tooltip } from "@mantine/core";
import { IconBabyCarriage, IconCross, IconRings } from "@tabler/icons-react";

export type SujetActes = {
  acteNaissanceId: string | null;
  /** Une union de la personne a son acte de mariage (0/1 ou booléen, selon la requête). */
  acteMariage: number | boolean | null;
  acteDecesId: string | null;
  /** « Aucune union » déclarée : pas d'acte de mariage à chercher, l'indicateur disparaît. */
  sansUnion?: boolean | number | null;
};

/**
 * Indicateurs d'actes de vie (naissance · mariage · décès) : règle unique pour toute l'application
 * (fiche, liste, cartes, arbre). `rang` garde la position d'origine (alignement dans les cases de l'arbre).
 */
export function actesDeVie(p: SujetActes) {
  return [
    { rang: 0, quoi: "de naissance", relie: !!p.acteNaissanceId, Icone: IconBabyCarriage, couleur: "#12b886", attendu: true },
    { rang: 1, quoi: "de mariage", relie: !!p.acteMariage, Icone: IconRings, couleur: "#e64980", attendu: !p.sansUnion },
    { rang: 2, quoi: "de décès", relie: !!p.acteDecesId, Icone: IconCross, couleur: "#495057", attendu: true },
  ].filter((a) => a.attendu);
}

const GRIS = "var(--t-inactif)";

/** Naissance · mariage · décès : en couleur si l'acte est relié à la personne, grisé sinon. */
export function IconesActes({ taille = 16, ...p }: SujetActes & { taille?: number }) {
  return (
    <Group gap={4} wrap="nowrap">
      {actesDeVie(p).map(({ relie, Icone, couleur, quoi }) => (
        <Tooltip key={quoi} label={relie ? `Acte ${quoi} relié` : `Pas d'acte ${quoi} relié`}>
          <Icone size={taille} color={relie ? couleur : GRIS} stroke={relie ? 2 : 1.5} aria-label={relie ? `Acte ${quoi} relié` : `Acte ${quoi} manquant`} />
        </Tooltip>
      ))}
    </Group>
  );
}
