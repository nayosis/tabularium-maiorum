import { useEffect, useState } from "react";
import { ActionIcon, Alert, Anchor, Autocomplete, Button, Group, Modal, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { openUrl } from "../lib/liens";
import { majSource } from "../data/actes";
import { chargerSource, enregistrerConsultation, supprimerConsultation, type ConsultationDetaillee } from "../data/recherches";
import { RESULTATS, TYPES_SOURCE } from "../lib/recherches";
import type { Source } from "../db/schema";
import { useAutoSave } from "../hooks/useAutoSave";
import { ecrire } from "../lib/query";
import { LieuSelect, SourceSelect } from "./selects";
import { LECTURE_SEULE } from "../lib/mode";
import { Lecture } from "./Lecture";

type Props = {
  opened: boolean;
  onClose: () => void;
  tacheId: string;
  /** Consultation à modifier ; absente pour en ajouter une. */
  consultation?: ConsultationDetaillee | null;
  /** Consultations déjà faites pour cette recherche (pour signaler une source déjà fouillée). */
  deja: ConsultationDetaillee[];
};

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const dateFr = (iso: string) => iso.split("-").reverse().join("/");

export function ModalConsultation({ opened, onClose, tacheId, consultation, deja }: Props) {
  const [date, setDate] = useState(aujourdhui());
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [resultat, setResultat] = useState("rien");
  const [notes, setNotes] = useState("");
  const [permalien, setPermalien] = useState("");
  const [vues, setVues] = useState("");

  useEffect(() => {
    if (!opened) return;
    setDate(consultation?.date ?? aujourdhui());
    setSourceId(consultation?.sourceId ?? null);
    setResultat(consultation?.resultat ?? "rien");
    setNotes(consultation?.notes ?? "");
    setPermalien(consultation?.permalien ?? "");
    setVues(consultation?.vues ?? "");
  }, [opened, consultation]);

  const dejaFouillee = deja.filter((c) => c.sourceId && c.sourceId === sourceId && c.id !== consultation?.id);

  const enregistrer = async () => {
    const ok = await ecrire(() =>
      enregistrerConsultation({
        id: consultation?.id,
        tacheId,
        date: date || aujourdhui(),
        sourceId,
        resultat,
        notes: notes.trim() || null,
        permalien: permalien.trim() || null,
        vues: vues.trim() || null,
      }),
    );
    if (ok) onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={consultation ? "Consultation" : "Nouvelle consultation"} size="lg">
      <Stack gap="sm">
        <Lecture>
        <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput type="date" label="Consultée le" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Résultat
            </Text>
            <SegmentedControl size="xs" data={RESULTATS} value={resultat} onChange={setResultat} />
          </Stack>
        </SimpleGrid>

        <SourceSelect label="Source consultée" value={sourceId} onChange={setSourceId} />
        {dejaFouillee.length > 0 && (
          <Alert color="yellow" variant="light" p="xs" icon={<IconInfoCircle size={16} />}>
            Déjà consultée pour cette recherche le {dejaFouillee.map((c) => dateFr(c.date)).join(", ")}.
          </Alert>
        )}
        {sourceId && <DetailsSource key={sourceId} sourceId={sourceId} />}

        <Group gap={4} align="flex-end" wrap="nowrap">
          <TextInput
            flex={1}
            label="Permalien"
            description="Lien vers la vue exacte consultée (copié depuis le site d'archives)"
            placeholder="https://…"
            value={permalien}
            onChange={(e) => setPermalien(e.currentTarget.value)}
          />
          {permalien.trim() && (
            <Tooltip label="Ouvrir le permalien">
              <ActionIcon variant="subtle" mb={4} onClick={() => openUrl(permalien.trim())}>
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <TextInput w={120} label="Vue(s)" placeholder="12 à 15" value={vues} onChange={(e) => setVues(e.currentTarget.value)} />
        </Group>

        <Textarea
          label="Notes"
          placeholder="Ce qui a été vu : années parcourues, noms approchants, lacunes…"
          autosize
          minRows={3}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        </Stack>
        </Lecture>
        {LECTURE_SEULE && permalien && (
          <Anchor href={permalien} target="_blank" rel="noopener" size="sm">
            Ouvrir la vue consultée (permalien)
          </Anchor>
        )}

        <Group justify="space-between">
          {consultation && !LECTURE_SEULE ? (
            <Button
              variant="subtle"
              color="red"
              onClick={() =>
                modals.openConfirmModal({
                  title: "Supprimer cette consultation ?",
                  labels: { confirm: "Supprimer", cancel: "Annuler" },
                  confirmProps: { color: "red" },
                  onConfirm: async () => {
                    await ecrire(() => supprimerConsultation(consultation.id));
                    onClose();
                  },
                })
              }
            >
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              {LECTURE_SEULE ? "Fermer" : "Annuler"}
            </Button>
            {!LECTURE_SEULE && <Button onClick={enregistrer}>Enregistrer</Button>}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Détails de la source (type, lieu, période, cote, lien), enregistrés au fil de la saisie. */
function DetailsSource({ sourceId }: { sourceId: string }) {
  const { data: source } = useQuery({ queryKey: ["source", sourceId], queryFn: () => chargerSource(sourceId) });
  if (!source) return null;
  return <FormSource source={source} />;
}

function FormSource({ source }: { source: Source }) {
  const { valeurs: v, modifier } = useAutoSave<Source>(source, (patch, version) => majSource(source.id, patch, version), { version: source.modifieLe });
  const t = (champ: "periode" | "cote" | "serviceArchives" | "url") => ({
    value: v[champ] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => modifier({ [champ]: e.currentTarget.value || null }),
  });
  return (
    <Stack gap="xs" p="sm" bg="var(--t-fond-doux)" style={{ borderRadius: 8 }}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <Autocomplete label="Type" data={TYPES_SOURCE} value={v.typeRegistre ?? ""} onChange={(x) => modifier({ typeRegistre: x || null })} />
        <LieuSelect label="Lieu" value={v.lieuId} onChange={(id) => modifier({ lieuId: id })} />
        <TextInput label="Période couverte" placeholder="1873-1882" {...t("periode")} />
        <TextInput label="Cote" {...t("cote")} />
      </SimpleGrid>
      <TextInput label="Service d'archives" placeholder="AD79" {...t("serviceArchives")} />
      <Group gap={4} align="flex-end" wrap="nowrap">
        <TextInput flex={1} label="Lien" placeholder="Adresse de la source en ligne" {...t("url")} />
        {v.url && (
          <Tooltip label="Ouvrir dans le navigateur">
            <ActionIcon variant="subtle" mb={4} onClick={() => openUrl(v.url!)}>
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Stack>
  );
}
