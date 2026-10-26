import { Anchor, Badge, Button, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconExternalLink, IconShieldStar } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { copier } from "../lib/citation";
import { nomComplet } from "../lib/libelles";
import { aDuMilitaire, DEGRES_INSTRUCTION, identification, libelleDecision, MEMOIRE_DES_HOMMES, signalement, type Militaire } from "../lib/militaire";

type ReleveMilitaire = { id: string; acteId: string; acteTitre: string; acteType: string | null; militaire: Militaire | null };

/** Relevés militaires d'une personne (fiches matricules, lignes de table). */
export const relevesMilitaires = <R extends ReleveMilitaire>(releves: R[]) =>
  releves.filter((r) => (r.acteType === "matricule" || r.acteType === "table_matricule") && aDuMilitaire(r.militaire));

/** Localités successives (registre matricule), pour le parcours de vie. */
export const domicilesMilitaires = (releves: ReleveMilitaire[]) =>
  relevesMilitaires(releves).flatMap((r) => (r.militaire?.adresses ?? []).filter((a) => a.lieu?.trim()));

/** Fiche : le service militaire relevé sur les registres matricules. */
export function ServiceMilitaire({ releves, nom, prenoms }: { releves: ReleveMilitaire[]; nom: string | null; prenoms: string | null }) {
  const navigate = useNavigate();
  const liste = relevesMilitaires(releves);
  if (!liste.length) return null;
  // Les fiches matricules d'abord (plus complètes que les lignes de table).
  liste.sort((a, b) => (a.acteType === "matricule" ? 0 : 1) - (b.acteType === "matricule" ? 0 : 1));
  const mpf = liste.some((r) => r.militaire?.mortPourLaFrance);

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconShieldStar size={20} color="var(--mantine-color-teal-6)" />
          <Title order={4}>Service militaire</Title>
        </Group>
        {mpf && (
          <Badge color="blue" variant="light">
            Mort pour la France
          </Badge>
        )}
      </Group>
      <Stack gap="md">
        {liste.map((r) => {
          const m = r.militaire!;
          const instruction = DEGRES_INSTRUCTION.find((d) => d.value === m.instruction)?.label;
          return (
            <Stack key={r.id} gap={4}>
              {identification(m) && <Text fw={600}>{identification(m)}</Text>}
              {signalement(m) && (
                <Text size="sm">
                  <Text span c="dimmed">
                    Signalement :{" "}
                  </Text>
                  {signalement(m)}
                </Text>
              )}
              {instruction && (
                <Text size="sm">
                  <Text span c="dimmed">
                    Instruction :{" "}
                  </Text>
                  {instruction}
                </Text>
              )}
              {libelleDecision(m) && (
                <Text size="sm">
                  <Text span c="dimmed">
                    Conseil de révision :{" "}
                  </Text>
                  {libelleDecision(m)}
                </Text>
              )}
              {m.services && (
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {m.services}
                </Text>
              )}
              {!!m.adresses?.length && (
                <>
                  <Text size="sm" c="dimmed">
                    Localités successives :
                  </Text>
                  <List size="sm" spacing={2}>
                    {m.adresses.map((a, i) => (
                      <List.Item key={i}>{[a.date, a.lieu].filter(Boolean).join(" — ")}</List.Item>
                    ))}
                  </List>
                </>
              )}
              <Anchor size="xs" onClick={() => navigate({ to: "/actes/$acteId", params: { acteId: r.acteId } })}>
                {r.acteTitre}
              </Anchor>
            </Stack>
          );
        })}
        {mpf && (
          <Group gap="xs">
            <Button component="a" href={MEMOIRE_DES_HOMMES} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="light" rightSection={<IconExternalLink size={14} />}>
              Chercher sur Mémoire des hommes
            </Button>
            <Button
              size="compact-sm"
              variant="subtle"
              leftSection={<IconCopy size={14} />}
              onClick={async () => {
                const ok = await copier([nom?.toUpperCase(), prenoms].filter(Boolean).join(" "));
                notifications.show({ color: ok ? "teal" : "red", message: ok ? "Nom copié : à coller dans la recherche de Mémoire des hommes" : "Copie impossible" });
              }}
            >
              Copier « {nomComplet({ nom, prenoms })} »
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
