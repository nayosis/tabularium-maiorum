import { Alert, Button, Paper, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconListSearch } from "@tabler/icons-react";
import type { Acte, Releve } from "../../db/schema";
import { creerRecherche } from "../../data/recherches";
import { DateFloueInput, patchDate } from "../../components/DateFloueInput";
import { EVENEMENT_INDEX, nomComplet } from "../../lib/libelles";
import { ecrire } from "../../lib/query";
import { ActeSelect } from "../liensActes";
import { LECTURE_SEULE } from "../../lib/mode";

const LIBELLE_EVENEMENT = { naissance: "naissance", deces: "décès", mariage: "mariage" } as const;

type Props = {
  releve: Releve & { individuNom?: string | null; individuPrenoms?: string | null };
  /** Valeurs en cours de saisie du relevé. */
  v: Releve;
  modifier: (patch: Partial<Releve>) => void;
  acte: Acte;
};

/**
 * Relevé d'une page d'index (table décennale…) : la ligne donne un événement et sa date,
 * et renvoie vers l'acte qu'il reste à trouver.
 */
export function LigneIndex({ releve, v, modifier, acte }: Props) {
  const quoi = EVENEMENT_INDEX[(v.role ?? "").trim().toLowerCase()];

  if (!quoi) {
    return (
      <Alert variant="light" color="grape" p="xs">
        <Text size="xs">
          Ligne d'index : choisissez le rôle <b>enfant</b> (naissance), <b>défunt</b> (décès), <b>époux</b> ou <b>épouse</b> (mariage).
        </Text>
      </Alert>
    );
  }

  const evenement = LIBELLE_EVENEMENT[quoi];
  const date = v[quoi];

  const creerLaRecherche = async () => {
    if (!releve.individuId) return;
    const id = await ecrire(() =>
      creerRecherche(releve.individuId!, {
        type: quoi,
        titre: `Acte de ${evenement}${date ? ` — ${date}` : ""}`,
        description: `D'après ${acte.titre}.`,
      }),
    );
    if (id) {
      notifications.show({
        color: "teal",
        message: `Recherche « acte de ${evenement} » ajoutée sur la fiche de ${nomComplet({ nom: releve.individuNom, prenoms: releve.individuPrenoms })}.`,
      });
    }
  };

  return (
    <Paper p="sm" bg="grape.0" radius="md">
      <Stack gap="xs">
        <DateFloueInput label={`Date du ${evenement} indiquée par la table`} value={date} onChange={(d) => modifier(patchDate(quoi, d))} />
        <ActeSelect
          label={`Acte de ${evenement} correspondant (une fois trouvé)`}
          value={v.acteRenvoiId}
          onChange={(id) => modifier({ acteRenvoiId: id })}
          prioritaires={[]}
        />
        {!v.acteRenvoiId && !LECTURE_SEULE && (
          <Button
            size="xs"
            variant="light"
            color="grape"
            leftSection={<IconListSearch size={14} />}
            disabled={!releve.individuId}
            onClick={creerLaRecherche}
          >
            {releve.individuId ? `Créer la recherche de l'acte de ${evenement}` : "Rattachez d'abord la ligne à un individu pour créer la recherche"}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
