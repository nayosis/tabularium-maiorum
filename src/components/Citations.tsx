import { ActionIcon, Anchor, Button, Group, Paper, Stack, Text, Title, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconQuote } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { donneesCitations } from "../data/citations";
import type { IndividuComplet } from "../data/individus";
import { citation, copier } from "../lib/citation";
import { nomComplet } from "../lib/libelles";
import { queryClient } from "../lib/query";

const cle = (ids: string[]) => ["citations", [...new Set(ids)].sort().join(",")];

export const useCitations = (acteIds: string[]) =>
  useQuery({ queryKey: cle(acteIds), queryFn: () => donneesCitations(acteIds), enabled: acteIds.length > 0 });

async function copierTexte(texte: string, quoi = "Citation copiée") {
  const ok = await copier(texte);
  notifications.show(ok ? { color: "teal", message: quoi } : { color: "red", message: "Copie impossible : sélectionnez le texte à la main." });
}

/** Bouton « Copier la citation » d'un document. */
export function BoutonCitation({ acteId }: { acteId: string }) {
  return (
    <Tooltip label="Copier la citation de la source (archives, registre, cote, acte, vue, lien)">
      <ActionIcon
        variant="subtle"
        aria-label="Copier la citation"
        onClick={async () => {
          const [d] = await queryClient.fetchQuery({ queryKey: cle([acteId]), queryFn: () => donneesCitations([acteId]) });
          if (d) await copierTexte(citation(d));
        }}
      >
        <IconQuote size={18} />
      </ActionIcon>
    </Tooltip>
  );
}

/** Fiche : la source de chaque fait (naissance, mariages, décès), puis les autres documents où la personne apparaît. */
export function SourcesFiche({ ind, acteIds, roles }: { ind: IndividuComplet; acteIds: string[]; roles?: Map<string, string | null> }) {
  const navigate = useNavigate();
  const faits: { libelle: string; acteId: string }[] = [];
  if (ind.acteNaissanceId) faits.push({ libelle: "Naissance", acteId: ind.acteNaissanceId });
  for (const c of ind.couples)
    if (c.acteId) faits.push({ libelle: `Mariage${c.conjointId ? ` avec ${nomComplet({ nom: c.conjointNom, prenoms: c.conjointPrenoms })}` : ""}`, acteId: c.acteId });
  if (ind.acteDecesId) faits.push({ libelle: "Décès", acteId: ind.acteDecesId });
  const dejaCites = new Set(faits.map((f) => f.acteId));
  for (const id of acteIds) {
    if (dejaCites.has(id)) continue;
    const role = roles?.get(id);
    faits.push({ libelle: role ? `Mentionné (${role})` : "Mentionné", acteId: id });
  }

  const { data = [] } = useCitations(faits.map((f) => f.acteId));
  const parId = new Map(data.map((d) => [d.acteId, d]));
  const lignes = faits.flatMap((f) => {
    const d = parId.get(f.acteId);
    return d ? [{ ...f, texte: citation(d), titre: d.titre }] : [];
  });
  if (!faits.length) return null;

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Sources</Title>
        {lignes.length > 1 && (
          <Button
            size="compact-sm"
            variant="subtle"
            leftSection={<IconCopy size={14} />}
            onClick={() => copierTexte(`${nomComplet(ind)}\n${lignes.map((l) => `- ${l.libelle} : ${l.texte}`).join("\n")}`, "Sources copiées")}
          >
            Tout copier
          </Button>
        )}
      </Group>
      <Stack gap="sm">
        {lignes.map((l, i) => (
          <Group key={`${l.acteId}-${i}`} gap="xs" wrap="nowrap" align="flex-start">
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600}>
                {l.libelle}{" "}
                <Anchor size="xs" fw={400} onClick={() => navigate({ to: "/actes/$acteId", params: { acteId: l.acteId } })}>
                  voir le document
                </Anchor>
              </Text>
              <Text size="xs" c="dimmed" style={{ userSelect: "text" }}>
                {l.texte}
              </Text>
            </div>
            <Tooltip label="Copier la citation">
              <ActionIcon variant="subtle" size="sm" aria-label="Copier la citation" onClick={() => copierTexte(l.texte)}>
                <IconCopy size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
