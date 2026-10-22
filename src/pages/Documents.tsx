import { Fragment, useMemo, useState } from "react";
import {
  ActionIcon, Alert, Badge, Button, Center, Checkbox, Group, Menu, Modal, Overlay, Paper, ScrollArea, SegmentedControl, Select, Stack,
  Switch, Table, Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import {
  IconBooks, IconChevronDown, IconChevronRight, IconExternalLink, IconFolderPlus, IconFolders, IconPhotoPlus, IconSearch, IconUpload,
  IconX,
} from "@tabler/icons-react";
import { openUrl } from "../lib/liens";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { creerActe, creerSource, listeActes, majSource, majStatutActes, regrouperDansRegistre, type ActeListe } from "../data/actes";
import { creerRegistre, listeRegistres } from "../data/registres";
import { SourceSelect } from "../components/selects";
import { clicOuvrir, useDefilement, useMemoire } from "../lib/onglets";
import { useImportImages } from "../hooks/useImportImages";
import { choisirImages, importerFichier, type ImageEnregistree } from "../lib/images";
import { STATUTS_ACTE, TYPES_ACTE, TYPES_INDEX, libelleType } from "../lib/libelles";
import { ecrire } from "../lib/query";
import { LECTURE_SEULE } from "../lib/mode";
import {
  comparerPages, extrairePage, suggestionsRegroupement, type SuggestionRegroupement,
} from "../lib/regroupement";
import { useEcran } from "../lib/ecran";
import { AccueilMobile } from "./mobile/AccueilMobile";
import { DocumentsMobile } from "./mobile/DocumentsMobile";
import { TableauDeBord } from "./accueil/TableauDeBord";

/** Cases à cocher (actions en lot) : seulement dans l'application. */
const CASES = !LECTURE_SEULE;

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const CLE_OUVERTS = "tabularium.documents.registresOuverts";
const lireOuverts = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(CLE_OUVERTS) ?? "[]"));
  } catch {
    return new Set<string>();
  }
};

/** Numéro de page d'un document : celui saisi sur l'image, sinon celui du titre. */
const numeroDe = (a: ActeListe) => a.numeroPage || extrairePage(a.titre)?.numero || null;

/** Accueil : documents et registres sur grand écran ; sur téléphone, l'accueil mobile (recherche de personnes). */
export function Accueil() {
  const { telephone } = useEcran();
  return telephone ? <AccueilMobile /> : <TableauDeBord />;
}

export function Documents() {
  const { telephone } = useEcran();
  if (telephone) return <DocumentsMobile />;
  return <DocumentsComplets />;
}

function DocumentsComplets() {
  const navigate = useNavigate();
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const { data: listeReg = [], isSuccess: registresCharges } = useQuery({ queryKey: ["registres"], queryFn: listeRegistres });
  const [recherche, setRecherche] = useMemoire("documents.recherche", "");
  const [statut, setStatut] = useMemoire("documents.statut", "tous");
  const [type, setType] = useMemoire<string | null>("documents.type", null);
  const [nature, setNature] = useMemoire("documents.nature", "toutes");
  const [registre, setRegistre] = useMemoire<string | null>("documents.registre", null);
  const [grouper, setGrouper] = useMemoire("documents.grouper", true);
  const defilement = useDefilement("documents", actes.length > 0 && registresCharges);
  const [ouverts, setOuverts] = useState(lireOuverts);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [ignorees, setIgnorees] = useState<Set<string>>(new Set());
  const [ranger, setRanger] = useState(false);

  const registres = listeReg.map((r) => ({ value: r.id, label: r.titre }));
  const infosRegistre = new Map(listeReg.map((r) => [r.id, r]));

  // Une image = un nouveau document ; plusieurs images d'un coup = un document de plusieurs pages.
  const nouveau = async (images: ImageEnregistree[]) => {
    const id = await ecrire(() => creerActe(images));
    if (id) navigate({ to: "/actes/$acteId", params: { acteId: id } });
  };
  const { survol } = useImportImages(nouveau);

  const filtres = actes.filter(
    (a) =>
      (statut === "tous" || a.statut === statut) &&
      (nature === "toutes" || a.nature === nature) &&
      (!type || a.type === type) &&
      (!registre || a.sourceId === registre) &&
      (!recherche ||
        sansAccents(`${a.titre} ${a.lieuNom ?? ""} ${a.date ?? ""} ${a.cote ?? ""} ${a.sourceTitre ?? ""}`).includes(sansAccents(recherche)) ||
        (!!a.sourceId && correspondRegistre(a.sourceId))),
  );

  function correspondRegistre(id: string) {
    const r = infosRegistre.get(id);
    return !!r && sansAccents(`${r.titre} ${r.typeRegistre ?? ""} ${r.lieuNom ?? ""} ${r.periode ?? ""} ${r.cote ?? ""}`).includes(sansAccents(recherche));
  }
  const filtreActif = statut !== "tous" || nature !== "toutes" || !!type;

  const suggestions = useMemo(() => suggestionsRegroupement(actes).filter((s) => !ignorees.has(s.titre)), [actes, ignorees]);

  // Groupes par registre (triés par titre), puis documents sans registre.
  // Sans filtre sur les documents, les registres encore vides apparaissent aussi.
  const groupes = useMemo(() => {
    const m = Map.groupBy(
      filtres.filter((a) => a.sourceId),
      (a) => a.sourceId!,
    );
    return listeReg
      .filter((r) => m.has(r.id) || (!filtreActif && (!registre || registre === r.id) && (!recherche || correspondRegistre(r.id))))
      .map((r) => {
        const docs = m.get(r.id) ?? [];
        return {
          sourceId: r.id,
          titre: r.titre,
          infos: r,
          docs: [...docs].sort((a, b) => comparerPages({ numero: numeroDe(a), titre: a.titre }, { numero: numeroDe(b), titre: b.titre })),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres, listeReg, filtreActif, registre, recherche]);
  const sansRegistre = filtres.filter((a) => !a.sourceId);

  const basculerOuvert = (id: string) =>
    setOuverts((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      try {
        localStorage.setItem(CLE_OUVERTS, JSON.stringify([...n]));
      } catch {
        // mémorisation impossible : sans importance
      }
      return n;
    });

  const basculer = (ids: string[], coche: boolean) =>
    setSelection((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (coche) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  const creerEtRegrouper = async (s: SuggestionRegroupement) => {
    const docs = actes.filter((a) => s.ids.includes(a.id));
    const lieux = new Set(docs.map((d) => d.lieuId));
    const types = new Set(docs.map((d) => libelleType(d.nature, d.type)));
    const id = await ecrire(async () => {
      const sourceId = await creerSource(s.titre);
      await majSource(sourceId, {
        ...(lieux.size === 1 && docs[0].lieuId && { lieuId: docs[0].lieuId }),
        ...(types.size === 1 && [...types][0] && { typeRegistre: [...types][0] }),
      });
      await regrouperDansRegistre(s.ids, sourceId, s.numeros);
      return sourceId;
    });
    if (id && !ouverts.has(id)) basculerOuvert(id);
  };

  const ligne = (a: ActeListe, titre: string, avecRegistre: boolean, retrait = false) => {
    const s = STATUTS_ACTE.find((x) => x.value === a.statut);
    return (
      <Table.Tr
        key={a.id}
        className="ligne-cliquable"
        onClick={(e) => clicOuvrir(e, `/actes/${a.id}`)}
        onAuxClick={(e) => clicOuvrir(e, `/actes/${a.id}`)}
      >
        {CASES && (
          <Table.Td w={36} onClick={(e) => e.stopPropagation()}>
            <Checkbox size="xs" checked={selection.has(a.id)} onChange={(e) => basculer([a.id], e.currentTarget.checked)} />
          </Table.Td>
        )}
        <Table.Td fw={500} pl={retrait ? 36 : undefined} style={{ wordBreak: "break-word" }}>
          {titre}
        </Table.Td>
        <Table.Td>
          {a.nature !== "acte" && (
            <Badge size="xs" variant="outline" color={a.nature === "photo" ? "cyan" : "grape"} mr={6}>
              {a.nature}
            </Badge>
          )}
          {libelleType(a.nature, a.type)}
        </Table.Td>
        <Table.Td>{a.date}</Table.Td>
        <Table.Td>{a.lieuNom}</Table.Td>
        {avecRegistre && (
          <Table.Td>
            <Text size="xs" c="dimmed" style={{ wordBreak: "break-word" }}>
              {a.sourceTitre}
            </Text>
          </Table.Td>
        )}
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
  };

  const nbColonnes = (grouper ? 7 : 8) - (CASES ? 0 : 1);
  const ids = [...selection];

  return (
    <Stack p="lg" gap="md" h="100%" pos="relative">
      {survol && (
        <Overlay color="var(--mantine-color-teal-1)" backgroundOpacity={0.85} zIndex={10}>
          <Center h="100%">
            <Stack align="center">
              <IconUpload size={48} />
              <Text size="xl">Déposer pour créer un document</Text>
            </Stack>
          </Center>
        </Overlay>
      )}

      <Group justify="space-between">
        <Title order={2}>Documents et registres</Title>
        <Group display={LECTURE_SEULE ? "none" : undefined}>
          <Text size="sm" c="dimmed">
            Glissez une image ici ou collez-la (Ctrl+V)
          </Text>
          <Button
            variant="default"
            leftSection={<IconFolderPlus size={18} />}
            onClick={async () => {
              const id = await ecrire(() => creerRegistre());
              if (id) navigate({ to: "/registres/$sourceId", params: { sourceId: id } });
            }}
          >
            Nouveau registre
          </Button>
          <Button
            leftSection={<IconPhotoPlus size={18} />}
            onClick={async () => {
              const chemins = await choisirImages();
              if (chemins.length) await nouveau(await Promise.all(chemins.map(importerFichier)));
            }}
          >
            Nouveau document
          </Button>
        </Group>
      </Group>

      <Group>
        <TextInput
          placeholder="Rechercher (titre, lieu, date, cote, registre)"
          leftSection={<IconSearch size={16} />}
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
          w={280}
        />
        <SegmentedControl
          value={nature}
          onChange={(v) => {
            setNature(v);
            setType(null);
          }}
          data={[
            { value: "toutes", label: "Tout" },
            { value: "acte", label: "Actes" },
            { value: "index", label: "Index" },
            { value: "photo", label: "Photos" },
          ]}
        />
        <Select
          display={nature === "photo" ? "none" : undefined}
          placeholder="Type"
          data={
            nature === "acte"
              ? TYPES_ACTE
              : nature === "index"
                ? TYPES_INDEX
                : [
                    { group: "Actes", items: TYPES_ACTE },
                    { group: "Index", items: TYPES_INDEX },
                  ]
          }
          value={type}
          onChange={setType}
          clearable
          w={180}
        />
        <Select placeholder="Registre" data={registres} value={registre} onChange={setRegistre} clearable searchable w={{ base: "100%", sm: 240 }} />
        <SegmentedControl
          value={statut}
          onChange={setStatut}
          data={[{ value: "tous", label: "Tous" }, ...STATUTS_ACTE.map((s) => ({ value: s.value, label: s.label }))]}
        />
        <Switch label="Regrouper par registre" checked={grouper} onChange={(e) => setGrouper(e.currentTarget.checked)} />
      </Group>

      {!LECTURE_SEULE && suggestions.map((s) => (
        <Alert key={s.titre} color="teal" variant="light" icon={<IconFolders size={18} />} p="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              <b>{s.ids.length} documents</b> ne diffèrent que par le numéro de page et ne sont rangés dans aucun registre :
              <br />« {s.titre} »
            </Text>
            <Group gap="xs" wrap="nowrap">
              <Button size="xs" leftSection={<IconFolderPlus size={14} />} onClick={() => creerEtRegrouper(s)}>
                Créer ce registre et les y ranger
              </Button>
              <Button size="xs" variant="subtle" color="gray" onClick={() => setIgnorees((i) => new Set(i).add(s.titre))}>
                Ignorer
              </Button>
            </Group>
          </Group>
        </Alert>
      ))}

      {selection.size > 0 && (
        <Paper withBorder p="xs" bg="teal.0">
          <Group gap="sm">
            <Text size="sm" fw={600}>
              {selection.size} sélectionné{selection.size > 1 ? "s" : ""}
            </Text>
            <Button size="xs" leftSection={<IconFolders size={14} />} onClick={() => setRanger(true)}>
              Ranger dans un registre…
            </Button>
            <Button size="xs" variant="default" onClick={() => ecrire(() => regrouperDansRegistre(ids, null))}>
              Retirer du registre
            </Button>
            <Menu>
              <Menu.Target>
                <Button size="xs" variant="default">
                  Statut…
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {STATUTS_ACTE.map((s) => (
                  <Menu.Item key={s.value} onClick={() => ecrire(() => majStatutActes(ids, s.value))}>
                    {s.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <ActionIcon variant="subtle" ml="auto" onClick={() => setSelection(new Set())} title="Tout désélectionner">
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Paper>
      )}

      <ScrollArea flex={1} {...defilement}>
        {actes.length === 0 && listeReg.length === 0 ? (
          <Center h={300}>
            <Stack align="center" c="dimmed">
              <IconPhotoPlus size={48} />
              <Text>Aucun document. Glissez un scan d'acte ou collez une capture pour commencer.</Text>
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                {CASES && (
                  <Table.Th w={36}>
                    <Checkbox
                      size="xs"
                      checked={filtres.length > 0 && filtres.every((a) => selection.has(a.id))}
                      indeterminate={filtres.some((a) => selection.has(a.id)) && !filtres.every((a) => selection.has(a.id))}
                      onChange={(e) => basculer(filtres.map((a) => a.id), e.currentTarget.checked)}
                    />
                  </Table.Th>
                )}
                <Table.Th>Titre</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Lieu</Table.Th>
                {!grouper && <Table.Th>Registre</Table.Th>}
                <Table.Th>Relevés</Table.Th>
                <Table.Th>Statut</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {grouper ? (
                <>
                  {groupes.map((g) => {
                    const ouvert = ouverts.has(g.sourceId);
                    const nbReleves = g.docs.reduce((n, d) => n + d.nbReleves, 0);
                    const nbRattaches = g.docs.reduce((n, d) => n + d.nbRattaches, 0);
                    const idsGroupe = g.docs.map((d) => d.id);
                    const parStatut = Map.groupBy(g.docs, (d) => d.statut);
                    return (
                      <Fragment key={g.sourceId}>
                        <Table.Tr bg="gray.0" className="ligne-cliquable" onClick={() => basculerOuvert(g.sourceId)}>
                          {CASES && (
                            <Table.Td onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                size="xs"
                                checked={idsGroupe.every((id) => selection.has(id))}
                                indeterminate={idsGroupe.some((id) => selection.has(id)) && !idsGroupe.every((id) => selection.has(id))}
                                onChange={(e) => basculer(idsGroupe, e.currentTarget.checked)}
                              />
                            </Table.Td>
                          )}
                          <Table.Td colSpan={nbColonnes - (CASES ? 1 : 0)}>
                            <Group gap="xs" wrap="nowrap">
                              {ouvert ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                              <IconFolders size={16} color="var(--mantine-color-gray-6)" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <Text fw={600} size="sm" style={{ wordBreak: "break-word" }}>
                                  {g.titre}
                                </Text>
                                {(g.infos.typeRegistre || g.infos.lieuNom || g.infos.periode || g.infos.cote) && (
                                  <Text size="xs" c="dimmed">
                                    {[g.infos.typeRegistre, g.infos.lieuNom, g.infos.periode, g.infos.cote && `cote ${g.infos.cote}`]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </Text>
                                )}
                              </div>
                              <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                {g.docs.length} document{g.docs.length > 1 ? "s" : ""}
                                {nbReleves > 0 && ` · ${nbReleves} relevé${nbReleves > 1 ? "s" : ""} (${nbRattaches} rattaché${nbRattaches > 1 ? "s" : ""})`}
                                {g.infos.nbConsultations > 0 && ` · ${g.infos.nbConsultations} recherche${g.infos.nbConsultations > 1 ? "s" : ""}`}
                              </Text>
                              {STATUTS_ACTE.filter((s) => parStatut.has(s.value)).map((s) => (
                                <Badge key={s.value} size="xs" variant="light" color={s.couleur}>
                                  {parStatut.get(s.value)!.length} {s.label.toLowerCase()}
                                </Badge>
                              ))}
                              <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                                {g.infos.url && (
                                  <Tooltip label="Ouvrir le permalien (page 1)">
                                    <ActionIcon variant="subtle" size="sm" onClick={() => openUrl(g.infos.url!)}>
                                      <IconExternalLink size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                                <Tooltip label="Fiche du registre : description, ajout de pages, recherches faites">
                                  <Button size="compact-xs" variant="light" leftSection={<IconBooks size={14} />} component="a" href={`/registres/${g.sourceId}`}>
                                    Fiche
                                  </Button>
                                </Tooltip>
                              </Group>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                        {ouvert && g.docs.map((a) => ligne(a, a.titre, false, true))}
                      </Fragment>
                    );
                  })}
                  {groupes.length > 0 && sansRegistre.length > 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={nbColonnes}>
                        <Text size="xs" c="dimmed" fw={600} tt="uppercase" mt="sm">
                          Sans registre ({sansRegistre.length})
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {sansRegistre.map((a) => ligne(a, a.titre, false))}
                </>
              ) : (
                filtres.map((a) => ligne(a, a.titre, true))
              )}
            </Table.Tbody>
          </Table>
        )}
      </ScrollArea>

      <ModalRanger
        opened={ranger}
        onClose={() => setRanger(false)}
        documents={actes.filter((a) => selection.has(a.id))}
        onFait={(sourceId) => {
          setSelection(new Set());
          if (!ouverts.has(sourceId)) basculerOuvert(sourceId);
        }}
      />
    </Stack>
  );
}

function ModalRanger({
  opened, onClose, documents, onFait,
}: {
  opened: boolean;
  onClose: () => void;
  documents: ActeListe[];
  onFait: (sourceId: string) => void;
}) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [numeros, setNumeros] = useState(true);
  const avecNumero = documents.filter((d) => extrairePage(d.titre));

  const ranger = async () => {
    if (!sourceId) return;
    const n = numeros ? Object.fromEntries(avecNumero.map((d) => [d.id, extrairePage(d.titre)!.numero])) : {};
    const ok = await ecrire(async () => {
      await regrouperDansRegistre(
        documents.map((d) => d.id),
        sourceId,
        n,
      );
      return true;
    });
    if (ok) {
      onFait(sourceId);
      onClose();
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`Ranger ${documents.length} document${documents.length > 1 ? "s" : ""} dans un registre`}>
      <Stack>
        <SourceSelect label="Registre" value={sourceId} onChange={setSourceId} />
        <Text size="xs" c="dimmed">
          Tapez le nom d'un nouveau registre pour le créer (ex. « Tables décennales NMD Allonne 1803-1892 »).
        </Text>
        {avecNumero.length > 0 && (
          <Checkbox
            label={`Reprendre le numéro de page indiqué dans le titre (${avecNumero.length} document${avecNumero.length > 1 ? "s" : ""})`}
            checked={numeros}
            onChange={(e) => setNumeros(e.currentTarget.checked)}
          />
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={ranger} disabled={!sourceId}>
            Ranger
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
