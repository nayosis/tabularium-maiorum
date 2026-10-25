import { useState } from "react";
import {
  ActionIcon, Anchor, Badge, Box, Button, Group, Menu, Modal, Paper, SegmentedControl, SimpleGrid, Stack, Text, Textarea, Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconAlertTriangle, IconArrowMerge, IconCheck, IconDots, IconListSearch, IconRefresh, IconTrash, IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { chargerIndividu } from "../data/individus";
import { creerDoute, creerRechercheDoute, doutesIndividu, listeDoutes, majDoute, supprimerDoute, type DouteDetaille, type FicheResumee } from "../data/doutes";
import { STATUTS_DOUTE } from "../lib/doutes";
import { nomComplet } from "../lib/libelles";
import { LECTURE_SEULE } from "../lib/mode";
import { ecrire } from "../lib/query";
import { STATUTS_RECHERCHE } from "../lib/recherches";
import { ModalFusion } from "../pages/ModalFusion";
import { Portrait } from "./Portrait";
import { IndividuSelect } from "./selects";

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const auteur = (email: string | null) => email?.split("@")[0];
/** cree_le est « AAAA-MM-JJ HH:MM:SS » (UTC), modifie_le en ISO : on compare les vraies dates. */
const date = (iso: string) => new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
const jour = (iso: string) => date(iso).toLocaleDateString("fr-FR");

export const useDoutesIndividu = (individuId: string) =>
  useQuery({ queryKey: ["doutes", individuId], queryFn: () => doutesIndividu(individuId) });

/** Une fiche en résumé : de quoi comparer d'un coup d'œil. */
function ResumeFiche({ f, lien = true }: { f: FicheResumee; lien?: boolean }) {
  const navigate = useNavigate();
  const nom = nomComplet(f);
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <Portrait portrait={null} taille={36} nom={f.nom} prenoms={f.prenoms} sexe={f.sexe} />
      <Box style={{ minWidth: 0 }}>
        {lien ? (
          <Anchor fw={600} size="sm" onClick={() => navigate({ to: "/individus/$individuId", params: { individuId: f.id } })}>
            {nom}
          </Anchor>
        ) : (
          <Text fw={600} size="sm">
            {nom}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {[f.naissance && `° ${f.naissance}${f.naissanceLieuNom ? ` · ${f.naissanceLieuNom}` : ""}`, f.deces && `† ${f.deces}${f.decesLieuNom ? ` · ${f.decesLieuNom}` : ""}`]
            .filter(Boolean)
            .join("   ") || "dates inconnues"}
        </Text>
        <Text size="xs" c="dimmed">
          {[f.profession, `${f.nbReleves} relevé${f.nbReleves > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
        </Text>
      </Box>
    </Group>
  );
}

/** Note du doute, modifiable sur place (enregistrée en quittant le champ). */
function NoteDoute({ d }: { d: DouteDetaille }) {
  const [note, setNote] = useState(d.note ?? "");
  if (LECTURE_SEULE)
    return d.note ? (
      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
        {d.note}
      </Text>
    ) : null;
  return (
    <Textarea
      size="sm"
      autosize
      minRows={1}
      placeholder="Pourquoi on hésite, ce qu'on a vérifié…"
      value={note}
      onChange={(e) => setNote(e.currentTarget.value)}
      onBlur={() => note !== (d.note ?? "") && ecrire(() => majDoute(d.id, { note: note || null }, d.modifieLe))}
    />
  );
}

/** Fusion depuis un doute : la fiche « a » reçoit la fiche « b ». */
function FusionDepuisDoute({ d, opened, onClose }: { d: DouteDetaille; opened: boolean; onClose: () => void }) {
  const { data: cible } = useQuery({ queryKey: ["individu", d.a.id], queryFn: () => chargerIndividu(d.a.id), enabled: opened });
  if (!cible) return null;
  return <ModalFusion cible={cible} opened={opened} onClose={onClose} doublonInitial={d.b.id} />;
}

/** Actions sur un doute : comparer et fusionner, différentes / rouvrir, recherche liée, retirer. */
function ActionsDoute({ d }: { d: DouteDetaille }) {
  const navigate = useNavigate();
  const [fusion, setFusion] = useState(false);
  const recherche = STATUTS_RECHERCHE.find((s) => s.value === d.tacheStatut);
  const ouvert = d.statut === "a_verifier";
  return (
    <Group gap="xs" wrap="wrap">
      {d.tacheId && (
        <Tooltip label={d.tacheTitre}>
          <Badge
            variant="light"
            color={recherche?.couleur}
            leftSection={<IconListSearch size={12} />}
            style={{ cursor: "pointer" }}
            onClick={() => d.tacheIndividuId && navigate({ to: "/individus/$individuId", params: { individuId: d.tacheIndividuId } })}
          >
            Recherche : {recherche?.label ?? d.tacheStatut}
          </Badge>
        </Tooltip>
      )}
      {!LECTURE_SEULE && (
        <>
          {ouvert && (
            <Button size="compact-sm" variant="light" leftSection={<IconArrowMerge size={14} />} onClick={() => setFusion(true)}>
              Comparer / fusionner
            </Button>
          )}
          {ouvert ? (
            <Button size="compact-sm" variant="default" leftSection={<IconCheck size={14} />} onClick={() => ecrire(() => majDoute(d.id, { statut: "differentes" }, d.modifieLe))}>
              Personnes différentes
            </Button>
          ) : (
            <Button size="compact-sm" variant="default" leftSection={<IconRefresh size={14} />} onClick={() => ecrire(() => majDoute(d.id, { statut: "a_verifier" }, d.modifieLe))}>
              Rouvrir
            </Button>
          )}
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Autres actions">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {!d.tacheId && (
                <Menu.Item leftSection={<IconListSearch size={14} />} onClick={() => ecrire(() => creerRechercheDoute(d.id))}>
                  Créer une recherche pour lever ce doute
                </Menu.Item>
              )}
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() =>
                  modals.openConfirmModal({
                    title: "Retirer ce doute ?",
                    children: <Text size="sm">À utiliser pour un doute signalé par erreur. Pour garder la trace d'une vérification, choisissez plutôt « Personnes différentes ».</Text>,
                    labels: { confirm: "Retirer", cancel: "Annuler" },
                    confirmProps: { color: "red" },
                    onConfirm: () => ecrire(() => supprimerDoute(d.id)),
                  })
                }
              >
                Retirer (signalé par erreur)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <FusionDepuisDoute d={d} opened={fusion} onClose={() => setFusion(false)} />
        </>
      )}
    </Group>
  );
}

const signature = (d: DouteDetaille) =>
  `Signalé le ${jour(d.creeLe)}${d.creePar ? ` par ${auteur(d.creePar)}` : ""}` +
  (d.modifieLe && d.modifiePar && date(d.modifieLe).getTime() - date(d.creeLe).getTime() > 60_000
    ? ` · modifié le ${jour(d.modifieLe)} par ${auteur(d.modifiePar)}`
    : "");

/** Sur la fiche : « Peut-être la même personne que… » (à vérifier), et les vérifications faites. */
export function DoutesFiche({ individuId }: { individuId: string }) {
  const { data: doutes = [] } = useDoutesIndividu(individuId);
  const ouverts = doutes.filter((d) => d.statut === "a_verifier");
  const verifies = doutes.filter((d) => d.statut === "differentes");
  if (!doutes.length) return null;
  return (
    <Stack gap="xs">
      {ouverts.length > 0 && (
        <Paper withBorder p="md" bg="orange.0" style={{ borderColor: "var(--mantine-color-orange-3)" }}>
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={18} color="var(--mantine-color-orange-7)" />
            <Text fw={600}>Peut-être la même personne que…</Text>
          </Group>
          <Stack gap="md">
            {ouverts.map((d) => (
              <Stack key={d.id} gap={6}>
                <ResumeFiche f={d.b} />
                <NoteDoute key={`${d.id}-${d.modifieLe}`} d={d} />
                <Group justify="space-between" gap="xs">
                  <Text size="xs" c="dimmed">
                    {signature(d)}
                  </Text>
                  <ActionsDoute d={d} />
                </Group>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
      {verifies.map((d) => (
        <Group key={d.id} gap="xs" wrap="nowrap">
          <IconCheck size={14} color="var(--mantine-color-gray-6)" />
          <Text size="sm" c="dimmed" style={{ flex: 1 }}>
            Vérifié : différent de <b>{nomComplet(d.b)}</b>
            {d.note && <> — {d.note.split("\n").at(-1)}</>}
          </Text>
          <ActionsDoute d={d} />
        </Group>
      ))}
    </Stack>
  );
}

/** Signaler un doute depuis une fiche. */
export function ModalNouveauDoute({ individuId, opened, onClose }: { individuId: string; opened: boolean; onClose: () => void }) {
  const [autre, setAutre] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const fermer = () => {
    setAutre(null);
    setNote("");
    onClose();
  };
  return (
    <Modal opened={opened} onClose={fermer} title="Peut-être la même personne…">
      <Stack>
        <Text size="sm" c="dimmed">
          Les deux fiches restent séparées. Le doute s'affiche sur chacune, jusqu'à ce qu'il soit levé : fusion si c'est la
          même personne, ou « personnes différentes ».
        </Text>
        <IndividuSelect label="Autre fiche" exclure={individuId} value={autre} onChange={setAutre} />
        <Textarea label="Pourquoi on hésite (facultatif)" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} placeholder="Même prénom et même année, mais pas le même village…" />
        <Group justify="flex-end">
          <Button variant="default" onClick={fermer}>
            Annuler
          </Button>
          <Button
            disabled={!autre}
            onClick={async () => {
              await ecrire(() => creerDoute(individuId, autre!, note.trim() || null));
              fermer();
            }}
          >
            Signaler le doute
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Onglet « Doutes » de la page Individus : toutes les paires, côte à côte. */
export function ListeDoutes({ recherche }: { recherche: string }) {
  const { data: doutes = [] } = useQuery({ queryKey: ["doutes"], queryFn: listeDoutes });
  const [filtre, setFiltre] = useState<string>("a_verifier");
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const liste = doutes.filter(
    (d) =>
      (filtre === "tous" || d.statut === filtre) &&
      mots.every((m) => sansAccents(`${nomComplet(d.a)} ${nomComplet(d.b)}`).includes(m)),
  );
  return (
    <Stack gap="sm">
      <SegmentedControl
        w="fit-content"
        size="xs"
        value={filtre}
        onChange={setFiltre}
        data={[...STATUTS_DOUTE.map((s) => ({ value: s.value, label: s.label })), { value: "tous", label: "Tous" }]}
      />
      {!liste.length && (
        <Text c="dimmed" size="sm">
          {doutes.length
            ? "Aucun doute ne correspond."
            : "Aucun doute. Depuis une fiche, « Peut-être la même personne… » signale deux fiches à comparer sans les fusionner."}
        </Text>
      )}
      {liste.map((d) => {
        const s = STATUTS_DOUTE.find((x) => x.value === d.statut);
        return (
          <Paper key={d.id} withBorder p="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="sm">
              <ResumeFiche f={d.a} />
              <ResumeFiche f={d.b} />
            </SimpleGrid>
            <NoteDoute key={`${d.id}-${d.modifieLe}`} d={d} />
            <Group justify="space-between" gap="xs" mt="xs">
              <Group gap="xs">
                <Badge size="sm" variant="light" color={s?.couleur} leftSection={<IconUsers size={12} />}>
                  {s?.label}
                </Badge>
                <Text size="xs" c="dimmed">
                  {signature(d)}
                </Text>
              </Group>
              <ActionsDoute d={d} />
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
