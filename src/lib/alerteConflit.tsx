import { Button, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import type { DetailsConflit } from "./conflit";

let conflitAffiche = false;

/**
 * Quelqu'un d'autre a modifié la fiche pendant qu'on la modifiait : on prévient (qui, quand),
 * puis on recharge la page pour repartir de sa version.
 */
export function signalerConflit(d: DetailsConflit | undefined) {
  if (conflitAffiche) return;
  conflitAffiche = true;
  const quand = d?.le ? new Date(d.le).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : null;
  modals.open({
    title: "Fiche modifiée entre-temps",
    closeOnClickOutside: false,
    closeOnEscape: false,
    withCloseButton: false,
    children: (
      <Stack>
        <Text size="sm">
          <b>{d?.par ?? "Quelqu'un d'autre"}</b> a modifié cette fiche{quand ? ` (${quand})` : ""} pendant que vous la modifiiez. Votre
          dernière saisie n'a pas été enregistrée, pour ne pas écraser la sienne.
        </Text>
        <Text size="sm" c="dimmed">
          La fiche va être rechargée avec sa version ; refaites ensuite votre modification.
        </Text>
        <Button onClick={() => location.reload()}>Recharger la fiche</Button>
      </Stack>
    ),
  });
}
