import { useMemo, useState } from "react";
import {
  Accordion, ActionIcon, Alert, Anchor, Badge, Box, Button, Group, Menu, Modal, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconDots, IconEyeOff, IconPencil, IconPlus, IconRestore, IconSearch, IconTrash, IconWorld } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { enregistrerLienArchives, liensArchivesPerso, masquerLienArchives, supprimerLienArchives } from "../data/archives";
import { useLieux } from "../components/selects";
import {
  CATEGORIES_ARCHIVES, DEPARTEMENTS, liensAffiches, liensMasques, RESSOURCES_NATIONALES, trouverDepartement, type LienAffiche,
} from "../lib/archives";
import { LECTURE_SEULE } from "../lib/mode";
import { ecrire } from "../lib/query";

type Perso = Awaited<ReturnType<typeof liensArchivesPerso>>;
const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const libelleCategorie = (c: string) => CATEGORIES_ARCHIVES.find((x) => x.value === c)?.label ?? c;

type Edition = { departement: string; lien: LienAffiche | null };

/** Ajouter un lien, ou corriger un lien (fourni ou ajouté). */
function ModalLien({ edition, onClose }: { edition: Edition | null; onClose: () => void }) {
  const [categorie, setCategorie] = useState<string | null>(null);
  const [libelle, setLibelle] = useState("");
  const [url, setUrl] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<Edition | null>(null);
  if (edition !== ouverte) {
    setOuverte(edition);
    setCategorie(edition?.lien?.categorie ?? "etat_civil");
    setLibelle(edition?.lien?.libelle ?? "");
    setUrl(edition?.lien?.url ?? "");
    setErreur(null);
  }
  const enregistrer = async () => {
    if (!edition || !categorie) return;
    try {
      await ecrire(() =>
        enregistrerLienArchives({
          id: edition.lien?.origine === "fourni" ? null : edition.lien?.id,
          departement: edition.departement,
          categorie,
          libelle: libelle || libelleCategorie(categorie),
          url,
          defaut: edition.lien?.defaut ?? null,
        }),
      );
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Modal opened={!!edition} onClose={onClose} title={edition?.lien ? "Corriger le lien" : "Ajouter un lien"}>
      <Stack>
        <Select label="Catégorie" data={CATEGORIES_ARCHIVES.map((c) => ({ value: c.value, label: c.label }))} value={categorie} onChange={setCategorie} allowDeselect={false} />
        <TextInput label="Libellé" placeholder="Registres matricules (classes 1867-1921)" value={libelle} onChange={(e) => setLibelle(e.currentTarget.value)} />
        <TextInput label="Adresse" placeholder="https://…" value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
        {edition?.lien?.origine === "fourni" && (
          <Text size="xs" c="dimmed">
            Le lien fourni par Tabularium est remplacé par le vôtre ; « Rétablir » le remet.
          </Text>
        )}
        {erreur && <Alert color="red">{erreur}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!url.trim()} onClick={enregistrer}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Les liens d'un département (ou des ressources nationales), modifiables. */
function Liens({ code, perso, onEditer }: { code: string; perso: Perso; onEditer: (e: Edition) => void }) {
  const liens = liensAffiches(code, perso);
  const masques = liensMasques(code, perso);
  return (
    <Stack gap={6}>
      {liens.map((l) => (
        <Group key={`${l.origine}-${l.url}`} gap="xs" wrap="nowrap">
          <Badge size="xs" variant="light" color={l.categorie === "site" ? "teal" : "gray"} w={130} style={{ flexShrink: 0 }}>
            {libelleCategorie(l.categorie)}
          </Badge>
          <Anchor href={l.url} target="_blank" rel="noopener noreferrer" size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
            {l.libelle}
          </Anchor>
          {l.origine !== "fourni" && (
            <Text size="xs" c="dimmed">
              {l.origine === "corrige" ? "corrigé" : "ajouté"}
            </Text>
          )}
          {!LECTURE_SEULE && (
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Actions sur le lien">
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => onEditer({ departement: code, lien: l })}>
                  Corriger
                </Menu.Item>
                {l.origine === "fourni" && (
                  <Menu.Item leftSection={<IconEyeOff size={14} />} onClick={() => ecrire(() => masquerLienArchives(code, l.url, l.categorie))}>
                    Masquer (lien faux ou inutile)
                  </Menu.Item>
                )}
                {l.origine === "corrige" && (
                  <Menu.Item leftSection={<IconRestore size={14} />} onClick={() => ecrire(() => supprimerLienArchives(l.id!))}>
                    Rétablir le lien fourni
                  </Menu.Item>
                )}
                {l.origine === "ajoute" && (
                  <Menu.Item
                    color="red"
                    leftSection={<IconTrash size={14} />}
                    onClick={() =>
                      modals.openConfirmModal({
                        title: "Supprimer ce lien ?",
                        labels: { confirm: "Supprimer", cancel: "Annuler" },
                        confirmProps: { color: "red" },
                        onConfirm: () => ecrire(() => supprimerLienArchives(l.id!)),
                      })
                    }
                  >
                    Supprimer
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      ))}
      {!LECTURE_SEULE && (
        <Group gap="xs">
          <Button size="compact-xs" variant="subtle" leftSection={<IconPlus size={12} />} onClick={() => onEditer({ departement: code, lien: null })}>
            Ajouter un lien
          </Button>
          {masques.length > 0 && (
            <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconRestore size={12} />} onClick={() => masques.forEach((m) => ecrire(() => supprimerLienArchives(m.id)))}>
              Rétablir {masques.length} lien{masques.length > 1 ? "s" : ""} masqué{masques.length > 1 ? "s" : ""}
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}

function CarteDepartement({ code, nom, nbLieux, perso, onEditer }: { code: string; nom: string; nbLieux?: number; perso: Perso; onEditer: (e: Edition) => void }) {
  const sansSite = !liensAffiches(code, perso).some((l) => l.categorie === "site");
  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Badge size="lg" variant="filled">
            {code}
          </Badge>
          <Title order={4}>{nom}</Title>
        </Group>
        {nbLieux != null && (
          <Text size="xs" c="dimmed">
            {nbLieux} lieu{nbLieux > 1 ? "x" : ""} dans votre arbre
          </Text>
        )}
      </Group>
      {sansSite && (
        <Alert variant="light" color="orange" p="xs" mb="sm">
          <Text size="xs">
            Adresse du site à compléter : cherchez-la dans l'
            <Anchor href="https://francearchives.gouv.fr/fr/annuaire/departements" target="_blank" rel="noopener noreferrer" size="xs">
              annuaire de FranceArchives
            </Anchor>
            , puis « Ajouter un lien ».
          </Text>
        </Alert>
      )}
      <Liens code={code} perso={perso} onEditer={onEditer} />
    </Paper>
  );
}

/** Annuaire des archives : ressources nationales, départements de l'arbre en premier, puis tous les autres. */
export function Archives() {
  const { data: perso = [] } = useQuery({ queryKey: ["liens-archives"], queryFn: liensArchivesPerso });
  const { data: lieux = [] } = useLieux();
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<Edition | null>(null);

  // Départements de l'arbre, d'après les lieux.
  const vos = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of lieux) {
      const d = trouverDepartement(l.departement);
      if (d) n.set(d.code, (n.get(d.code) ?? 0) + 1);
    }
    return [...n].sort((a, b) => b[1] - a[1]).map(([code, nb]) => ({ ...DEPARTEMENTS.find((d) => d.code === code)!, nb }));
  }, [lieux]);

  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const correspond = (code: string, nom: string) => !mots.length || mots.every((m) => sansAccents(`${code} ${nom}`).includes(m));
  const tous = DEPARTEMENTS.filter((d) => correspond(d.code, d.nom));

  return (
    <Box h="100%" style={{ overflowY: "auto" }}>
      <Stack gap="lg" p="md" maw={1200} mx="auto">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Title order={2}>Archives</Title>
            <Text c="dimmed">Les services d'archives à consulter : registres, état civil, matricules, recensements, cadastre, notaires.</Text>
          </Box>
          <TextInput w={{ base: "100%", sm: 280 }} placeholder="Département (49, Vienne…)" leftSection={<IconSearch size={16} />} value={recherche} onChange={(e) => setRecherche(e.currentTarget.value)} />
        </Group>

        {!mots.length && (
          <Stack gap="sm">
            <Group gap="xs">
              <IconWorld size={20} />
              <Title order={3}>Ressources nationales</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {RESSOURCES_NATIONALES.map((r) => (
                <Paper key={r.url} withBorder p="sm">
                  <Group justify="space-between" wrap="nowrap" mb={2}>
                    <Anchor href={r.url} target="_blank" rel="noopener noreferrer" fw={600}>
                      {r.libelle}
                    </Anchor>
                    {r.payant && (
                      <Badge size="xs" variant="light" color="gray">
                        en partie payant
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {r.description}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>
            <Paper withBorder p="sm">
              <Text size="sm" fw={600} mb={6}>
                Vos liens nationaux
              </Text>
              <Liens code="national" perso={perso} onEditer={setEdition} />
            </Paper>
          </Stack>
        )}

        {vos.length > 0 && !mots.length && (
          <Stack gap="sm">
            <Title order={3}>Vos départements</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {vos.map((d) => (
                <CarteDepartement key={d.code} code={d.code} nom={d.nom} nbLieux={d.nb} perso={perso} onEditer={setEdition} />
              ))}
            </SimpleGrid>
          </Stack>
        )}

        <Stack gap="sm">
          <Title order={3}>{mots.length ? `Départements (${tous.length})` : "Tous les départements"}</Title>
          {mots.length ? (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
              {tous.map((d) => (
                <CarteDepartement key={d.code} code={d.code} nom={d.nom} perso={perso} onEditer={setEdition} />
              ))}
            </SimpleGrid>
          ) : (
            <Accordion variant="separated" chevronPosition="left">
              {tous.map((d) => (
                <Accordion.Item key={d.code} value={d.code}>
                  <Accordion.Control>
                    <Group gap="xs">
                      <Badge variant="light" w={44}>
                        {d.code}
                      </Badge>
                      <Text size="sm">{d.nom}</Text>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <CarteDepartement code={d.code} nom={d.nom} perso={perso} onEditer={setEdition} />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Stack>
      </Stack>
      <ModalLien edition={edition} onClose={() => setEdition(null)} />
    </Box>
  );
}
