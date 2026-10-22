import { useState } from "react";
import { ActionIcon, Anchor, Button, Divider, Group, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Tooltip } from "@mantine/core";
import { IconExternalLink, IconPlus, IconTrash } from "@tabler/icons-react";
import { openUrl } from "../../lib/liens";
import type { Acte, Lien } from "../../db/schema";
import { ajouterLien, majActe, majLien, majPage, supprimerLien, type ActeComplet } from "../../data/actes";
import { DateFloueInput, patchDate } from "../../components/DateFloueInput";
import { LieuSelect, SourceSelect } from "../../components/selects";
import { useAutoSave } from "../../hooks/useAutoSave";
import { TYPES_ACTE, TYPES_INDEX } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { ecrire } from "../../lib/query";
import { Trace } from "../../components/Trace";

type Props = { acte: ActeComplet; pageId: string | undefined };

export function PanneauActe({ acte, pageId }: Props) {
  const { valeurs: v, modifier } = useAutoSave<Acte>(acte, (patch, version) => majActe(acte.id, patch, version), { version: acte.modifieLe });
  const t = (champ: keyof Acte) => ({
    value: (v[champ] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      modifier({ [champ]: e.currentTarget.value || null } as Partial<Acte>),
  });
  const page = acte.pages.find((p) => p.id === pageId);

  // Photo : date et lieu facultatifs, album, description. Ni type, ni numéro, ni cote.
  if (acte.nature === "photo") {
    return (
      <Stack gap="sm">
        <DateFloueInput label="Date (facultative)" value={v.date} onChange={(d) => modifier(patchDate("date", d))} />
        <LieuSelect label="Lieu (facultatif)" value={v.lieuId} onChange={(id) => modifier({ lieuId: id })} />
        <SourceSelect label="Album" value={v.sourceId} onChange={(id) => modifier({ sourceId: id })} />
        <Textarea
          label="Description"
          placeholder="Mariage de Jean et Marie, devant la mairie de Brissac ; inscription au dos : …"
          autosize
          minRows={3}
          {...t("notes")}
        />
        <Divider label="Liens internet" labelPosition="left" />
        {acte.liens.map((l) => (
          <LigneLien key={l.id} lien={l} />
        ))}
        <NouveauLien acteId={acte.id} />
        <Trace creePar={acte.creePar} modifiePar={acte.modifiePar} modifieLe={acte.modifieLe} />
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <Select
          searchable
          label={acte.nature === "index" ? "Type d'index" : "Type d'acte"}
          data={acte.nature === "index" ? TYPES_INDEX : TYPES_ACTE}
          value={v.type}
          onChange={(x) => modifier({ type: x })}
          clearable
        />
        <TextInput label="N° d'acte" {...t("numero")} />
      </SimpleGrid>
      <DateFloueInput
        label={acte.nature === "index" ? "Date ou période (facultatif)" : "Date de l'acte"}
        value={v.date}
        onChange={(d) => modifier(patchDate("date", d))}
      />
      <LieuSelect label="Lieu" value={v.lieuId} onChange={(id) => modifier({ lieuId: id })} />

      <Divider label="Archive" labelPosition="left" />
      <SourceSelect label="Registre" value={v.sourceId} onChange={(id) => modifier({ sourceId: id })} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <TextInput label="Cote" placeholder="3E 123/45" {...t("cote")} />
        {page && <NumeroVue key={page.id} pageId={page.id} initial={page.numeroVue} />}
      </SimpleGrid>

      <Divider label="Liens internet" labelPosition="left" />
      {acte.liens.map((l) => (
        <LigneLien key={l.id} lien={l} />
      ))}
      <NouveauLien acteId={acte.id} />

      <Divider />
      <Textarea label="Notes" autosize minRows={3} {...t("notes")} />
      <Trace creePar={acte.creePar} modifiePar={acte.modifiePar} modifieLe={acte.modifieLe} />
    </Stack>
  );
}

function NumeroVue({ pageId, initial }: { pageId: string; initial: string | null }) {
  const { valeurs, modifier } = useAutoSave({ numeroVue: initial ?? "" }, (p) => majPage(pageId, { numeroVue: p.numeroVue || null }));
  return (
    <TextInput
      label="N° de vue (page affichée)"
      value={valeurs.numeroVue}
      onChange={(e) => modifier({ numeroVue: e.currentTarget.value })}
    />
  );
}

function LigneLien({ lien }: { lien: Lien }) {
  if (LECTURE_SEULE) {
    return (
      <Anchor href={lien.url} target="_blank" rel="noopener" size="sm">
        {lien.libelle || lien.url}
      </Anchor>
    );
  }
  return <LigneLienEdition lien={lien} />;
}

function LigneLienEdition({ lien }: { lien: Lien }) {
  const { valeurs, modifier } = useAutoSave({ url: lien.url, libelle: lien.libelle ?? "" }, (p) =>
    majLien(lien.id, { ...p, libelle: p.libelle === undefined ? undefined : p.libelle || null }),
  );
  return (
    <Group gap={4} wrap="nowrap" align="flex-end">
      <TextInput size="xs" w={110} placeholder="Libellé" value={valeurs.libelle} onChange={(e) => modifier({ libelle: e.currentTarget.value })} />
      <TextInput size="xs" flex={1} value={valeurs.url} onChange={(e) => modifier({ url: e.currentTarget.value })} />
      <Tooltip label="Ouvrir dans le navigateur">
        <ActionIcon variant="subtle" onClick={() => openUrl(valeurs.url)}>
          <IconExternalLink size={16} />
        </ActionIcon>
      </Tooltip>
      <ActionIcon variant="subtle" color="red" onClick={() => ecrire(() => supprimerLien(lien.id))}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );
}

function NouveauLien({ acteId }: { acteId: string }) {
  if (LECTURE_SEULE) return null;
  return <NouveauLienEdition acteId={acteId} />;
}

function NouveauLienEdition({ acteId }: { acteId: string }) {
  const [url, setUrl] = useState("");
  const ajouter = async () => {
    if (!url.trim()) return;
    await ecrire(() => ajouterLien(acteId, url.trim()));
    setUrl("");
  };
  return (
    <Group gap={4} wrap="nowrap">
      <TextInput
        size="xs"
        flex={1}
        placeholder="Coller l'adresse de la page (Archives départementales, Geneanet…)"
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Enter" && ajouter()}
      />
      <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={ajouter} disabled={!url.trim()}>
        Ajouter
      </Button>
    </Group>
  );
}

export function PanneauTranscription({ acte }: { acte: Acte }) {
  const { valeurs, modifier } = useAutoSave(
    { transcription: acte.transcription ?? "", traduction: acte.traduction ?? "" },
    (p) => majActe(acte.id, p),
  );
  return (
    <Stack gap="sm">
      <Textarea
        label="Transcription"
        description="Texte de l'acte, tel qu'écrit"
        autosize
        minRows={12}
        value={valeurs.transcription}
        onChange={(e) => modifier({ transcription: e.currentTarget.value })}
      />
      <Textarea
        label="Traduction"
        description="Pour les actes en latin"
        autosize
        minRows={4}
        value={valeurs.traduction}
        onChange={(e) => modifier({ traduction: e.currentTarget.value })}
      />
      <Text size="xs" c="dimmed">
        Plus tard : lecture assistée (OCR / IA) pour pré-remplir ce champ.
      </Text>
    </Stack>
  );
}
