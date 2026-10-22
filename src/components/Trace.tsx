import { Text, Tooltip } from "@mantine/core";

const date = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** « Modifié par marie@… le 4 oct. 2026 à 19:30 » (et, au survol, qui l'a créé). Rien pour les fiches d'avant la version web. */
export function Trace({ creePar, modifiePar, modifieLe }: { creePar?: string | null; modifiePar?: string | null; modifieLe?: string | null }) {
  if (!modifiePar || !modifieLe) return null;
  const texte = (
    <Text size="xs" c="dimmed" span>
      Modifié par {modifiePar} le {date(modifieLe)}
    </Text>
  );
  return creePar && creePar !== modifiePar ? <Tooltip label={`Créé par ${creePar}`}>{texte}</Tooltip> : texte;
}
