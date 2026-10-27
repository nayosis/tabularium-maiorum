import { useState } from "react";
import {
  ActionIcon, Anchor, Autocomplete, Badge, Button, Center, Group, Menu, Modal, MultiSelect, Overlay, Paper, ScrollArea, SimpleGrid, Stack,
  Table, Text, TextInput, Textarea, Title, Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArrowLeft, IconDots, IconExternalLink, IconFolders, IconPhotoPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "../../lib/liens";
import { registreRoute } from "../../router";
import type { Source } from "../../db/schema";
import { creerActe, listeActes, majSource, regrouperDansRegistre, type ActeListe } from "../../data/actes";
import { listeRegistres, supprimerRegistre } from "../../data/registres";
import { numeroDepuisNomFichier } from "../../lib/regroupement";
import { sourcesEtConsultations } from "../../data/recherches";
import { RESULTATS, TYPES_SOURCE } from "../../lib/recherches";
import { LieuSelect } from "../../components/selects";
import { AnchorLink } from "../../components/AnchorLink";
import { Lecture } from "../../components/Lecture";
import { useAutoSave } from "../../hooks/useAutoSave";
import { useImportImages } from "../../hooks/useImportImages";
import { choisirImages, importerFichier, type ImageEnregistree } from "../../lib/images";
import { STATUTS_ACTE, libelleType, nomComplet } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { ecrire } from "../../lib/query";
import { comparerPages, extrairePage } from "../../lib/regroupement";
import { clicOuvrir, retour, useDefilement } from "../../lib/onglets";
import { Trace } from "../../components/Trace";
import { afficherDate } from "../../lib/dates";

const numeroDe = (a: ActeListe) => a.numeroPage || extrairePage(a.titre)?.numero || null;
const dateFr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Nature et type des nouveaux documents : ceux qui dominent déjà dans le registre, sinon d'après le type de registre. */
function modele(docs: ActeListe[], typeRegistre: string | null): { nature: string; type: string | null } {
  if (docs.length) {
    const compte = Map.groupBy(docs, (d) => `${d.nature}|${d.type ?? ""}`);
    const [cle] = [...compte.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const [nature, type] = cle.split("|");
    return { nature, type: type || null };
  }
  const t = (typeRegistre ?? "").toLowerCase();
  if (t.includes("album")) return { nature: "photo", type: null };
  if (t.includes("table décennale")) return { nature: "index", type: "table_decennale" };
  if (t.includes("table")) return { nature: "index", type: "table_alphabetique" };
  if (t.includes("notari")) return { nature: "acte", type: "notarie" };
  if (t.includes("recensement")) return { nature: "acte", type: "recensement" };
  if (t.includes("matricule")) return { nature: "acte", type: "matricule" };
  return { nature: "acte", type: null };
}

export function Registre() {
  const { sourceId } = registreRoute.useParams();
  const navigate = useNavigate();
  const { data: registres, isLoading } = useQuery({ queryKey: ["registres"], queryFn: listeRegistres });
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const { data: sources = [] } = useQuery({ queryKey: ["sources-consultations"], queryFn: sourcesEtConsultations });
  const [ranger, setRanger] = useState(false);
  const reg = registres?.find((r) => r.id === sourceId);
  const defilement = useDefilement(`registre.${sourceId}`, !!reg && actes.length > 0);

  const docs = actes
    .filter((a) => a.sourceId === sourceId)
    .sort((a, b) => comparerPages({ numero: numeroDe(a), titre: a.titre }, { numero: numeroDe(b), titre: b.titre }));
  const consultations = sources.find((s) => s.id === sourceId)?.consultations ?? [];

  // Chaque image déposée devient un document (une page) déjà rangé dans ce registre.
  const ajouter = async (images: ImageEnregistree[]) => {
    if (!reg) return;
    const { nature, type } = modele(docs, reg.typeRegistre);
    const ids: string[] = [];
    for (const img of images) {
      const numero = numeroDepuisNomFichier(img.nomOrigine);
      const id = await ecrire(() =>
        creerActe(
          [img],
          {
            sourceId,
            lieuId: reg.lieuId,
            cote: reg.cote,
            nature,
            type,
            // Une photo d'album n'a pas de « page » : titre provisoire, à générer depuis les personnes identifiées.
            titre: nature === "photo" ? "Photo" : `${reg.titre} — p. ${numero ?? "?"}`,
          },
          numero,
        ),
      );
      if (id) ids.push(id);
    }
    if (ids.length === 1) navigate({ to: "/actes/$acteId", params: { acteId: ids[0] } });
  };
  const { survol } = useImportImages(ajouter, !!reg);

  if (isLoading) return null;
  if (!reg) return <Center h="100%"><Text>Registre introuvable.</Text></Center>;

  return (
    <ScrollArea h="100%" {...defilement}>
      <Stack p="lg" gap="lg" maw={1100} pos="relative">
        {survol && (
          <Overlay color="var(--mantine-color-teal-1)" backgroundOpacity={0.9} zIndex={10} fixed>
            <Center h="100%">
              <Stack align="center">
                <IconUpload size={48} />
                <Text size="xl">Déposer pour ajouter ces pages au registre</Text>
                <Text c="dimmed">Une image = un document, rangé dans « {reg.titre} »</Text>
              </Stack>
            </Center>
          </Overlay>
        )}

        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Group gap="xs" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
            <ActionIcon variant="subtle" onClick={() => retour("/documents")} mt={8} title="Retour">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <FormRegistre key={reg.id} source={reg} />
          </Group>
          {!LECTURE_SEULE && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" mt={8}>
                  <IconDots size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() =>
                    modals.openConfirmModal({
                      title: "Supprimer ce registre ?",
                      children: <Text size="sm">Ses {docs.length} documents et les consultations restent, simplement « sans registre ».</Text>,
                      labels: { confirm: "Supprimer", cancel: "Annuler" },
                      confirmProps: { color: "red" },
                      onConfirm: async () => {
                        await ecrire(() => supprimerRegistre(reg.id));
                        navigate({ to: "/documents" });
                      },
                    })
                  }
                >
                  Supprimer le registre
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        <Paper withBorder p="md">
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <Text fw={600}>Documents</Text>
              <Badge variant="light">{docs.length}</Badge>
            </Group>
            {!LECTURE_SEULE && (
              <Group gap="xs">
                <Text size="xs" c="dimmed">
                  Glissez des images ici (une image = une page)
                </Text>
                <Button
                  size="xs"
                  leftSection={<IconPhotoPlus size={14} />}
                  onClick={async () => {
                    const chemins = await choisirImages();
                    if (chemins.length) await ajouter(await Promise.all(chemins.map(importerFichier)));
                  }}
                >
                  Ajouter des pages…
                </Button>
                <Button size="xs" variant="default" leftSection={<IconFolders size={14} />} onClick={() => setRanger(true)}>
                  Ranger des documents existants…
                </Button>
              </Group>
            )}
          </Group>
          {docs.length === 0 ? (
            <Text size="sm" c="dimmed">
              Aucun document dans ce registre.
            </Text>
          ) : (
            <Table highlightOnHover verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Document</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Relevés</Table.Th>
                  <Table.Th>Statut</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {docs.map((a) => {
                  const s = STATUTS_ACTE.find((x) => x.value === a.statut);
                  return (
                    <Table.Tr
                      key={a.id}
                      className="ligne-cliquable"
                      onClick={(e) => clicOuvrir(e, `/actes/${a.id}`)}
                      onAuxClick={(e) => clicOuvrir(e, `/actes/${a.id}`)}
                    >
                      <Table.Td fw={500} style={{ wordBreak: "break-word" }}>{a.titre}</Table.Td>
                      <Table.Td>{libelleType(a.nature, a.type)}</Table.Td>
                      <Table.Td>{afficherDate(a.date)}</Table.Td>
                      <Table.Td>
                        {a.nbReleves > 0 && (
                          <Text size="sm">
                            {a.nbReleves}{" "}
                            <Text span size="xs" c="dimmed">
                              ({a.nbRattaches} rattaché{a.nbRattaches > 1 ? "s" : ""})
                            </Text>
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={s?.couleur} variant="light" styles={{ label: { overflow: "visible" } }}>
                          {s?.label ?? a.statut}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {consultations.length > 0 && (
          <Paper withBorder p="md">
            <Text fw={600} mb="sm">
              Recherches faites dans ce registre
            </Text>
            <Table verticalSpacing={4}>
              <Table.Tbody>
                {consultations.map((c) => {
                  const res = RESULTATS.find((x) => x.value === c.resultat) ?? RESULTATS[0];
                  return (
                    <Table.Tr key={c.id}>
                      <Table.Td w={110}>
                        <Text size="xs">{dateFr(c.date)}</Text>
                      </Table.Td>
                      <Table.Td w={130}>
                        <Badge size="xs" variant="light" color={res.couleur}>
                          {res.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {c.individuId ? (
                          <AnchorLink to="/individus/$individuId" params={{ individuId: c.individuId }} size="xs">
                            {nomComplet({ nom: c.individuNom, prenoms: c.individuPrenoms })}
                          </AnchorLink>
                        ) : (
                          <Text size="xs">(personne supprimée)</Text>
                        )}
                        <Text size="xs" c="dimmed" span>
                          {" "}
                          — {c.tacheTitre}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {[c.vues && `vue ${c.vues}`, c.notes].filter(Boolean).join(" · ")}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}

        <ModalRanger
          opened={ranger}
          onClose={() => setRanger(false)}
          sourceId={reg.id}
          candidats={actes.filter((a) => a.sourceId !== reg.id)}
        />
      </Stack>
    </ScrollArea>
  );
}

function FormRegistre({ source }: { source: Source }) {
  const { valeurs: v, modifier } = useAutoSave<Source>(source, (patch, version) => majSource(source.id, patch, version), { version: source.modifieLe });
  const t = (champ: "periode" | "cote" | "serviceArchives" | "url") => ({
    value: v[champ] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => modifier({ [champ]: e.currentTarget.value || null }),
  });
  return (
    <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
      {LECTURE_SEULE ? (
        <Title order={2}>{source.titre}</Title>
      ) : (
        <TextInput
          variant="unstyled"
          styles={{ input: { fontSize: 24, fontWeight: 700 } }}
          value={v.titre}
          onChange={(e) => modifier({ titre: e.currentTarget.value })}
        />
      )}
      <Lecture>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <Autocomplete label="Type" data={TYPES_SOURCE} value={v.typeRegistre ?? ""} onChange={(x) => modifier({ typeRegistre: x || null })} />
            <LieuSelect label="Commune" value={v.lieuId} onChange={(id) => modifier({ lieuId: id })} />
            <TextInput label="Période" placeholder="1803-1892" {...t("periode")} />
            <TextInput label="Cote" {...t("cote")} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <TextInput label="Service d'archives" placeholder="AD79" {...t("serviceArchives")} />
            <Group gap={4} align="flex-end" wrap="nowrap">
              <TextInput flex={1} label="Permalien (page 1 du registre)" placeholder="https://…" {...t("url")} />
              {v.url && !LECTURE_SEULE && (
                <Tooltip label="Ouvrir le permalien">
                  <ActionIcon variant="subtle" mb={4} onClick={() => openUrl(v.url!)}>
                    <IconExternalLink size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </SimpleGrid>
          <Textarea label="Notes" autosize minRows={1} value={v.notes ?? ""} onChange={(e) => modifier({ notes: e.currentTarget.value || null })} />
        </Stack>
      </Lecture>
      {LECTURE_SEULE && v.url && (
        <Anchor href={v.url} target="_blank" rel="noopener" size="sm">
          Ouvrir le registre en ligne (permalien)
        </Anchor>
      )}
      <Trace creePar={source.creePar} modifiePar={source.modifiePar} modifieLe={source.modifieLe} />
    </Stack>
  );
}

function ModalRanger({ opened, onClose, sourceId, candidats }: { opened: boolean; onClose: () => void; sourceId: string; candidats: ActeListe[] }) {
  const [ids, setIds] = useState<string[]>([]);
  // D'abord les documents sans registre, puis ceux d'autres registres.
  const data = [
    { group: "Sans registre", items: candidats.filter((a) => !a.sourceId).map((a) => ({ value: a.id, label: a.titre })) },
    { group: "Déjà dans un autre registre", items: candidats.filter((a) => a.sourceId).map((a) => ({ value: a.id, label: `${a.titre} (${a.sourceTitre})` })) },
  ].filter((g) => g.items.length);

  const valider = async () => {
    const numeros = Object.fromEntries(
      ids.map((id) => [id, extrairePage(candidats.find((a) => a.id === id)?.titre ?? "")?.numero]).filter(([, n]) => n),
    ) as Record<string, string>;
    const ok = await ecrire(async () => {
      await regrouperDansRegistre(ids, sourceId, numeros);
      return true;
    });
    if (ok) {
      setIds([]);
      onClose();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Ranger des documents dans ce registre" size="lg">
      <Stack>
        <MultiSelect
          label="Documents"
          placeholder="Chercher un document"
          searchable
          data={data}
          value={ids}
          onChange={setIds}
          nothingFoundMessage="Aucun document"
          maxDropdownHeight={320}
        />
        <Text size="xs" c="dimmed">
          Le numéro de page est repris du titre (« … page 172 ») quand il y figure.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={!ids.length}>
            Ranger {ids.length || ""}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
