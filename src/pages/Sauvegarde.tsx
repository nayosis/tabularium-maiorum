import { useState } from "react";
import { Alert, Button, FileButton, Group, List, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconDatabaseExport, IconDatabaseImport, IconInfoCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { appelApi, ErreurServeur } from "../lib/rpc";
import { utilisateur } from "../lib/session";

type Compteurs = { documents: number; images: number; releves: number; individus: number; lieux: number };

export const formaterTaille = (octets: number) =>
  octets < 1024 * 1024 ? `${Math.max(1, Math.round(octets / 1024))} Ko` : `${(octets / 1024 / 1024).toFixed(octets < 100 * 1024 * 1024 ? 1 : 0)} Mo`;

function Chiffres({ c }: { c: Compteurs }) {
  return (
    <SimpleGrid cols={5} spacing="xs">
      {(
        [
          ["Documents", c.documents],
          ["Images", c.images],
          ["Relevés", c.releves],
          ["Individus", c.individus],
          ["Lieux", c.lieux],
        ] as const
      ).map(([l, n]) => (
        <Stack key={l} gap={0} align="center">
          <Text fw={700} size="lg">
            {n}
          </Text>
          <Text size="xs" c="dimmed">
            {l}
          </Text>
        </Stack>
      ))}
    </SimpleGrid>
  );
}

/** Admins : télécharger une sauvegarde complète. Super admin : restaurer (y compris une sauvegarde d'une autre installation). */
export function Sauvegarde() {
  const moi = utilisateur();
  const { data, refetch } = useQuery({
    queryKey: ["sauvegarde-infos"],
    queryFn: () => appelApi<{ compteurs: Compteurs; taille: { base: number; images: number } }>("/api/sauvegarde/infos"),
  });
  const [restauration, setRestauration] = useState(false);

  const restaurer = (fichier: File | null) => {
    if (!fichier) return;
    modals.openConfirmModal({
      title: "Remplacer toutes les données par cette sauvegarde ?",
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Toutes les données actuelles (documents, relevés, individus, recherches…) seront remplacées par celles de <b>{fichier.name}</b> (
            {formaterTaille(fichier.size)}).
          </Text>
          <Text size="sm" c="dimmed">
            La base actuelle est gardée sur le serveur (donnees.db.avant-restauration). Les comptes ne changent pas. Pensez à télécharger une
            sauvegarde avant, par précaution.
          </Text>
        </Stack>
      ),
      labels: { confirm: "Restaurer", cancel: "Annuler" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        setRestauration(true);
        try {
          const f = new FormData();
          f.append("fichier", fichier);
          const r = await fetch("/api/sauvegarde/restaurer", { method: "POST", body: f, headers: { "x-tabularium": "1" }, credentials: "same-origin" });
          const corps = await r.json().catch(() => ({}));
          if (!r.ok) throw new ErreurServeur(corps.erreur ?? `Erreur ${r.status}`, r.status);
          const c = corps.installe as Compteurs;
          notifications.show({
            color: "teal",
            title: "Sauvegarde restaurée",
            message: `${c.documents} documents, ${c.individus} individus, ${c.images} images. La page va se recharger.`,
          });
          setTimeout(() => location.assign("/"), 1500);
        } catch (e) {
          notifications.show({ color: "red", title: "Restauration impossible", message: e instanceof Error ? e.message : String(e) });
          setRestauration(false);
          refetch();
        }
      },
    });
  };

  return (
    <Stack p="lg" gap="lg" maw={900}>
      <Title order={2}>Sauvegarde</Title>

      <Paper withBorder p="md">
        <Stack>
          <Group gap="xs">
            <IconDatabaseExport size={20} />
            <Text fw={600}>Télécharger une sauvegarde</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Un fichier ZIP avec toute la base et toutes les images
            {data && ` (environ ${formaterTaille(data.taille.base + data.taille.images)})`}. À garder en lieu sûr, chez vous ou sur un disque externe.
          </Text>
          {data && <Chiffres c={data.compteurs} />}
          <Group>
            <Button component="a" href="/api/sauvegarde" download leftSection={<IconDatabaseExport size={16} />}>
              Télécharger la sauvegarde
            </Button>
          </Group>
        </Stack>
      </Paper>

      {moi?.super ? (
        <Paper withBorder p="md">
          <Stack>
            <Group gap="xs">
              <IconDatabaseImport size={20} />
              <Text fw={600}>Restaurer une sauvegarde</Text>
            </Group>
            <List size="sm" spacing={4}>
              <List.Item>Remplace toutes les données par celles du ZIP (sauvegarde de cette installation ou d'une autre installation de Tabularium).</List.Item>
              <List.Item>Les comptes et mots de passe ne changent pas.</List.Item>
              <List.Item>Pour passer d'une installation à une autre (ordinateur → serveur…) : télécharger la sauvegarde sur l'ancienne, puis la restaurer ici.</List.Item>
            </List>
            <Group>
              <FileButton onChange={restaurer} accept=".zip,application/zip">
                {(props) => (
                  <Button {...props} color="red" variant="light" loading={restauration} leftSection={<IconDatabaseImport size={16} />}>
                    Choisir une sauvegarde (.zip)…
                  </Button>
                )}
              </FileButton>
            </Group>
          </Stack>
        </Paper>
      ) : (
        <Alert color="gray" icon={<IconInfoCircle size={16} />}>
          Seul le super admin peut restaurer une sauvegarde.
        </Alert>
      )}
    </Stack>
  );
}
