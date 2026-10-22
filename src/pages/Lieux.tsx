import { useState } from "react";
import { ActionIcon, Badge, Button, Group, Paper, ScrollArea, Stack, Table, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCurrentLocation, IconMapPin, IconMapPinOff, IconPlus, IconTrash } from "@tabler/icons-react";
import type { Lieu } from "../db/schema";
import { creerLieu, majLieu, supprimerLieu } from "../data/lieux";
import { useLieux } from "../components/selects";
import { CarteLieux, trouverCommune } from "../components/CarteLieux";
import { useAutoSave } from "../hooks/useAutoSave";
import { ecrire } from "../lib/query";
import { LECTURE_SEULE } from "../lib/mode";
import { Lecture } from "../components/Lecture";

export function Lieux() {
  const { data: lieux = [] } = useLieux();
  const [nom, setNom] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [recherche, setRecherche] = useState(false);
  const selection = lieux.find((l) => l.id === selectionId);
  const places = lieux.filter((l) => l.latitude != null && l.longitude != null).length;

  const ajouter = async () => {
    if (!nom.trim()) return;
    const id = await ecrire(() => creerLieu(nom.trim()));
    setNom("");
    if (id) setSelectionId(id);
  };

  const placer = (lieuId: string, lat: number | null, lng: number | null) =>
    ecrire(() => majLieu(lieuId, { latitude: lat, longitude: lng }));

  const trouver = async () => {
    if (!selection) return;
    setRecherche(true);
    try {
      const pos = await trouverCommune(selection.nom, selection.departement);
      if (pos) await placer(selection.id, pos.lat, pos.lng);
      else
        notifications.show({
          color: "yellow",
          message: `« ${selection.nom} »${selection.departement ? ` (${selection.departement})` : ""} introuvable (commune renommée ou fusionnée ?) : placez le point à la main sur la carte.`,
        });
    } catch (e) {
      notifications.show({ color: "red", title: "Recherche impossible", message: String(e) });
    } finally {
      setRecherche(false);
    }
  };

  return (
    <Stack p="lg" gap="md" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={2}>Lieux</Title>
          <Badge variant="light">
            {places} / {lieux.length} placés sur la carte
          </Badge>
        </Group>
        <Group display={LECTURE_SEULE ? "none" : undefined}>
          <TextInput
            placeholder="Nom de la commune"
            value={nom}
            onChange={(e) => setNom(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && ajouter()}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={ajouter} disabled={!nom.trim()}>
            Ajouter
          </Button>
        </Group>
      </Group>

      <Group align="stretch" gap="md" wrap="nowrap" flex={1} style={{ minHeight: 0 }}>
        <ScrollArea w="46%" miw={430}>
          <Lecture>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={28} />
                  <Table.Th>Commune</Table.Th>
                  <Table.Th w={70}>Dépt</Table.Th>
                  <Table.Th w={100}>Code INSEE</Table.Th>
                  <Table.Th w={100}>Latitude</Table.Th>
                  <Table.Th w={100}>Longitude</Table.Th>
                  {!LECTURE_SEULE && <Table.Th w={40} />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lieux.map((l) => (
                  // Remonté quand ses coordonnées changent (placement sur la carte) : champs à jour.
                  <LigneLieu
                    key={`${l.id}-${l.latitude}-${l.longitude}`}
                    lieu={l}
                    selectionne={l.id === selectionId}
                    onSelect={() => setSelectionId(l.id)}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </Lecture>
        </ScrollArea>

        <Stack gap="xs" flex={1} style={{ minWidth: 0 }}>
          <Paper withBorder p="xs">
            {selection ? (
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm">
                  <b>{selection.departement ? `${selection.nom} (${selection.departement})` : selection.nom}</b>
                  {!LECTURE_SEULE && (
                    <Text span c="dimmed" size="sm">
                      {" "}
                      — cliquez sur la carte pour {selection.latitude != null ? "déplacer" : "placer"} son point
                    </Text>
                  )}
                </Text>
                {!LECTURE_SEULE && (
                  <Group gap={4} wrap="nowrap">
                    <Button size="xs" variant="light" leftSection={<IconCurrentLocation size={14} />} loading={recherche} onClick={trouver}>
                      Trouver la commune
                    </Button>
                    {selection.latitude != null && (
                      <Tooltip label="Retirer le point">
                        <ActionIcon variant="subtle" color="red" onClick={() => placer(selection.id, null, null)}>
                          <IconMapPinOff size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                )}
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                {LECTURE_SEULE
                  ? "Cliquez sur un lieu ou un point pour le voir sur la carte."
                  : "Choisissez un lieu dans la liste (ou un point sur la carte), puis cliquez sur la carte pour placer son point."}
              </Text>
            )}
          </Paper>
          <div style={{ flex: 1, minHeight: 300 }}>
            <CarteLieux
              lieux={lieux}
              selectionId={selectionId}
              onSelect={setSelectionId}
              onPlacer={LECTURE_SEULE ? undefined : (lat, lng) => selection && placer(selection.id, lat, lng)}
            />
          </div>
        </Stack>
      </Group>
    </Stack>
  );
}

const nombre = (s: string) => (s.trim() === "" || isNaN(+s.replace(",", ".")) ? null : +s.replace(",", "."));

function LigneLieu({ lieu, selectionne, onSelect }: { lieu: Lieu; selectionne: boolean; onSelect: () => void }) {
  const { valeurs, modifier } = useAutoSave(
    {
      nom: lieu.nom,
      departement: lieu.departement ?? "",
      codeInsee: lieu.codeInsee ?? "",
      latitude: lieu.latitude?.toString() ?? "",
      longitude: lieu.longitude?.toString() ?? "",
    },
    (p) =>
      majLieu(lieu.id, {
        ...(p.nom !== undefined && { nom: p.nom }),
        ...(p.departement !== undefined && { departement: p.departement || null }),
        ...(p.codeInsee !== undefined && { codeInsee: p.codeInsee || null }),
        ...(p.latitude !== undefined && { latitude: nombre(p.latitude) }),
        ...(p.longitude !== undefined && { longitude: nombre(p.longitude) }),
      }),
  );
  const champ = (k: keyof typeof valeurs) => ({
    size: "xs" as const,
    value: valeurs[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => modifier({ [k]: e.currentTarget.value }),
  });
  const place = lieu.latitude != null && lieu.longitude != null;
  return (
    <Table.Tr onClick={onSelect} bg={selectionne ? "teal.0" : undefined} style={{ cursor: "pointer" }}>
      <Table.Td>
        {place ? <IconMapPin size={16} color="var(--mantine-color-blue-6)" /> : <IconMapPin size={16} color="var(--mantine-color-gray-3)" />}
      </Table.Td>
      <Table.Td><TextInput {...champ("nom")} /></Table.Td>
      <Table.Td><TextInput {...champ("departement")} /></Table.Td>
      <Table.Td><TextInput {...champ("codeInsee")} /></Table.Td>
      <Table.Td><TextInput {...champ("latitude")} /></Table.Td>
      <Table.Td><TextInput {...champ("longitude")} /></Table.Td>
      {!LECTURE_SEULE && (
        <Table.Td>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              ecrire(() => supprimerLieu(lieu.id));
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Table.Td>
      )}
    </Table.Tr>
  );
}
