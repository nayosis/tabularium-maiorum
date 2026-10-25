import { useState } from "react";
import { Alert, Button, FileButton, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconFileExport, IconFileImport, IconFileTypography } from "@tabler/icons-react";
import { exporterGedcom, importerGedcom, type BilanImport } from "../data/gedcom";
import { decoderGedcom } from "../lib/gedcom";
import { ecrire } from "../lib/query";

function telecharger(texte: string, nom: string) {
  const url = URL.createObjectURL(new Blob([texte], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Échanger son arbre avec les autres logiciels de généalogie (Geneanet, Heredis, Ancestris, Gramps…). */
export function EchangeGedcom() {
  const [export_, setExport] = useState(false);
  const [import_, setImport] = useState(false);
  const [bilan, setBilan] = useState<(BilanImport & { fichier: string }) | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const exporter = async () => {
    setExport(true);
    try {
      const texte = await exporterGedcom();
      const d = new Date();
      telecharger(texte, `tabularium-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.ged`);
    } finally {
      setExport(false);
    }
  };

  const importer = (fichier: File | null) => {
    if (!fichier) return;
    modals.openConfirmModal({
      title: `Importer « ${fichier.name} » ?`,
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Les personnes du fichier sont ajoutées comme nouvelles fiches, avec leurs familles, dates et lieux. Chaque source citée
            devient un document « à transcrire » dans un registre, prêt à recevoir l'image de l'acte.
          </Text>
          <Text size="sm">
            Rien n'est fusionné : les personnes qui ressemblent à des fiches existantes apparaîtront dans « Doublons possibles »
            (Individus → Doutes), à vérifier une par une.
          </Text>
          <Text size="sm" c="dimmed">
            Conseil : téléchargez d'abord une sauvegarde.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Importer", cancel: "Annuler" },
      onConfirm: async () => {
        setImport(true);
        setErreur(null);
        setBilan(null);
        try {
          const { texte } = decoderGedcom(new Uint8Array(await fichier.arrayBuffer()));
          const b = await ecrire(() => importerGedcom(fichier.name, texte));
          if (b) setBilan({ ...b, fichier: fichier.name });
        } catch (e) {
          setErreur(e instanceof Error ? e.message : String(e));
        } finally {
          setImport(false);
        }
      },
    });
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Group gap="xs">
          <IconFileTypography size={20} />
          <Title order={4}>Échanger avec d'autres logiciels (GEDCOM)</Title>
        </Group>
        <Text size="sm" c="dimmed">
          GEDCOM est le format d'échange de tous les logiciels de généalogie (Geneanet, Heredis, Ancestris, Gramps, MyHeritage…).
        </Text>
        <List size="sm" spacing={4}>
          <List.Item>
            <b>Exporter</b> : tout l'arbre (personnes, familles, dates, lieux, professions, notes) avec ses sources — chaque fait cite
            son acte (archives, registre, cote, vue, lien). Format GEDCOM 5.5.1.
          </List.Item>
          <List.Item>
            <b>Importer</b> : un fichier .ged venu d'un autre logiciel ; les sources citées deviennent des documents à transcrire.
          </List.Item>
        </List>
        <Group>
          <Button leftSection={<IconFileExport size={16} />} loading={export_} onClick={exporter}>
            Exporter en GEDCOM
          </Button>
          <FileButton onChange={importer} accept=".ged,.gedcom,text/plain">
            {(props) => (
              <Button {...props} variant="default" leftSection={<IconFileImport size={16} />} loading={import_}>
                Importer un fichier GEDCOM
              </Button>
            )}
          </FileButton>
        </Group>
        {erreur && <Alert color="red">{erreur}</Alert>}
        {bilan && (
          <Alert color="teal" title={`« ${bilan.fichier} » importé`}>
            <Text size="sm">
              {bilan.individus} personne{bilan.individus > 1 ? "s" : ""}, {bilan.familles} union{bilan.familles > 1 ? "s" : ""},{" "}
              {bilan.documents} document{bilan.documents > 1 ? "s" : ""} à transcrire dans {bilan.registres} registre
              {bilan.registres > 1 ? "s" : ""}, {bilan.lieux} nouveau{bilan.lieux > 1 ? "x" : ""} lieu{bilan.lieux > 1 ? "x" : ""}.
            </Text>
            {bilan.avertissements.length > 0 && (
              <List size="xs" mt="xs">
                {bilan.avertissements.map((a) => (
                  <List.Item key={a}>{a}</List.Item>
                ))}
              </List>
            )}
            <Text size="sm" mt="xs">
              Pensez à vérifier les « Doublons possibles » (Individus → Doutes).
            </Text>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
