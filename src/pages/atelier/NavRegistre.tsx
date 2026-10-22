import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { listeActes } from "../../data/actes";
import { remplacer } from "../../lib/onglets";
import { trierParPage } from "../../lib/regroupement";

/**
 * Feuilleter le registre du document : précédent / suivant, dans l'ordre des pages.
 * Alt+← et Alt+→ font de même au clavier.
 */
export function NavRegistre({ acteId, sourceId }: { acteId: string; sourceId: string | null }) {
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const docs = sourceId ? trierParPage(actes.filter((a) => a.sourceId === sourceId)) : [];
  const i = docs.findIndex((a) => a.id === acteId);
  const precedent = i > 0 ? docs[i - 1] : null;
  const suivant = i >= 0 && i < docs.length - 1 ? docs[i + 1] : null;
  const aller = (a: { id: string } | null) => a && remplacer(`/actes/${a.id}`);

  useHotkeys([
    ["alt+ArrowLeft", () => aller(precedent)],
    ["alt+ArrowRight", () => aller(suivant)],
  ]);

  if (docs.length < 2 || i < 0) return null;
  return (
    <Group gap={2} wrap="nowrap">
      <Tooltip label={precedent ? `Précédent : ${precedent.titre} (Alt+←)` : "Premier document du registre"}>
        <ActionIcon variant="subtle" disabled={!precedent} onClick={() => aller(precedent)} aria-label="Document précédent">
          <IconChevronLeft size={18} />
        </ActionIcon>
      </Tooltip>
      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
        {i + 1} / {docs.length}
      </Text>
      <Tooltip label={suivant ? `Suivant : ${suivant.titre} (Alt+→)` : "Dernier document du registre"}>
        <ActionIcon variant="subtle" disabled={!suivant} onClick={() => aller(suivant)} aria-label="Document suivant">
          <IconChevronRight size={18} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
