import { ActionIcon, Autocomplete, Button, Checkbox, Divider, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { IconPlus, IconShieldStar, IconTrash } from "@tabler/icons-react";
import { useLieux } from "../../components/selects";
import { DECISIONS_CONSEIL, DEGRES_INSTRUCTION, SIGNALEMENT, type AdresseMilitaire, type Militaire } from "../../lib/militaire";
import { LECTURE_SEULE } from "../../lib/mode";

type Props = { militaire: Militaire | null; onChange: (m: Militaire) => void; /** Table alphabétique : seulement l'identification. */ ligneIndex?: boolean };

/** Relevé d'une fiche matricule (ou d'une ligne de sa table alphabétique). */
export function SectionMilitaire({ militaire, onChange, ligneIndex = false }: Props) {
  const m = militaire ?? {};
  const { data: lieux = [] } = useLieux();
  const noms = [...new Set(lieux.map((l) => l.nom))].sort();
  const changer = (patch: Partial<Militaire>) => onChange({ ...m, ...patch });
  const champ = (cle: keyof Militaire) => ({
    value: (m[cle] as string | null | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => changer({ [cle]: e.currentTarget.value || null }),
  });
  const adresses = m.adresses ?? [];
  const changerAdresse = (i: number, patch: Partial<AdresseMilitaire>) => changer({ adresses: adresses.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const identification = (
    <SimpleGrid cols={{ base: 2, sm: ligneIndex ? 3 : 4 }} spacing="xs">
      <TextInput label="Classe" placeholder="1897" {...champ("classe")} />
      <TextInput label="N° matricule" {...champ("matricule")} />
      <TextInput label="Bureau de recrutement" placeholder="Angers" {...champ("bureau")} />
      {!ligneIndex && <TextInput label="Canton / n° de tirage" placeholder="Brissac, 45" {...champ("canton")} />}
    </SimpleGrid>
  );
  if (ligneIndex) return identification;

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="sm">
        <Group gap="xs">
          <IconShieldStar size={18} color="var(--mantine-color-teal-6)" />
          <Text fw={600} size="sm">
            Service militaire
          </Text>
        </Group>
        {identification}

        <Divider label="Signalement" labelPosition="left" />
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
          <TextInput label="Taille" placeholder="1,65" {...champ("taille")} />
          {SIGNALEMENT.map((s) => (
            <TextInput key={s.cle} label={s.label} {...champ(s.cle)} />
          ))}
        </SimpleGrid>
        <TextInput label="Marques particulières" placeholder="cicatrice au front…" {...champ("marques")} />
        <Select label="Degré d'instruction" data={DEGRES_INSTRUCTION} value={m.instruction ?? null} onChange={(x) => changer({ instruction: x })} clearable />

        <Divider label="Conseil de révision et services" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <Select label="Décision" data={DECISIONS_CONSEIL} value={m.decision ?? null} onChange={(x) => changer({ decision: x })} clearable />
          <TextInput label="Motif" placeholder="faiblesse, soutien de famille…" {...champ("motif")} />
        </SimpleGrid>
        <Textarea
          label="Services, campagnes, blessures, décorations"
          placeholder="Incorporé au 135e RI le 15/11/1898… Campagne contre l'Allemagne du 2/8/1914 au… Croix de guerre…"
          autosize
          minRows={3}
          {...champ("services")}
        />
        <Checkbox label="Mort pour la France" checked={!!m.mortPourLaFrance} onChange={(e) => changer({ mortPourLaFrance: e.currentTarget.checked || null })} />

        <Divider label="Localités successives habitées" labelPosition="left" />
        {adresses.map((a, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput label={i === 0 ? "Date" : undefined} placeholder="12/03/1905" w={130} value={a.date ?? ""} onChange={(e) => changerAdresse(i, { date: e.currentTarget.value || null })} />
            <Autocomplete
              label={i === 0 ? "Lieu (commune, adresse…)" : undefined}
              style={{ flex: 1 }}
              data={noms}
              value={a.lieu}
              onChange={(x) => changerAdresse(i, { lieu: x })}
              placeholder="Angers, 12 rue…"
            />
            {!LECTURE_SEULE && (
              <ActionIcon variant="subtle" color="red" mb={4} onClick={() => changer({ adresses: adresses.filter((_, j) => j !== i) })} aria-label="Retirer cette adresse">
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        ))}
        {!LECTURE_SEULE && (
          <Button size="xs" variant="light" w="fit-content" leftSection={<IconPlus size={14} />} onClick={() => changer({ adresses: [...adresses, { date: null, lieu: "" }] })}>
            Ajouter une localité
          </Button>
        )}
        <Text size="xs" c="dimmed">
          Les localités dont la commune est connue dans Tabularium apparaissent dans le parcours de vie et sur la carte.
        </Text>
      </Stack>
    </Paper>
  );
}
