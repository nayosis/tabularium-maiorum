import { useState, type ReactNode } from "react";
import {
  ActionIcon, Anchor, Badge, Box, Button, Center, Grid, Group, Loader, Paper, Progress, SimpleGrid, Stack, Text, ThemeIcon, Title, Tooltip, UnstyledButton,
} from "@mantine/core";
import {
  IconBinaryTree2, IconBook2, IconCamera, IconFileText, IconInfoCircle, IconListSearch, IconMapPin, IconPhoto, IconPlus, IconUser,
  IconUsers, IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { IndividuSelect } from "../../components/selects";
import { tableauDeBord, type TableauDeBord as Donnees } from "../../data/statistiques";
import { nomComplet, STATUTS_ACTE } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { STATUTS_RECHERCHE } from "../../lib/recherches";
import { utilisateur } from "../../lib/session";
import { memoriser } from "../../lib/onglets";
import { AvisMiseAJour } from "../../components/MiseAJour";

const fr = (n: number) => n.toLocaleString("fr-FR");
const pourcent = (n: number, total: number) => (total ? Math.round((100 * n) / total) : 0);

const ROMAINS: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
/** 17 → « XVIIe siècle ». */
export function siecleRomain(n: number) {
  let r = "";
  for (let reste = n, i = 0; reste > 0; ) {
    const [v, s] = ROMAINS[i];
    if (reste >= v) {
      r += s;
      reste -= v;
    } else i++;
  }
  return `${r}${n === 1 ? "er" : "e"} siècle`;
}

/** « il y a 3 heures », « hier »… */
const relatif = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
export function depuis(iso: string, maintenant = Date.now()) {
  const s = (new Date(iso).getTime() - maintenant) / 1000;
  const pas: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unite, duree] of pas) if (Math.abs(s) >= duree) return relatif.format(Math.round(s / duree), unite);
  return "à l'instant";
}

function Carte({ titre, action, children }: { titre: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper withBorder p="md" h="100%">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Title order={4}>{titre}</Title>
        {action}
      </Group>
      {children}
    </Paper>
  );
}

function Tuile({ icone: Icone, valeur, libelle, detail, onClick }: { icone: typeof IconUsers; valeur: number; libelle: string; detail?: string; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick}>
      <Paper withBorder p="md" h="100%" className="tuile-accueil">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon variant="light" size="lg" radius="md">
            <Icone size={20} />
          </ThemeIcon>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fz={26} fw={700} lh={1.1}>
              {fr(valeur)}
            </Text>
            <Text size="sm" c="dimmed">
              {libelle}
            </Text>
            {detail && (
              <Text size="xs" c="dimmed">
                {detail}
              </Text>
            )}
          </Stack>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

/** Barres horizontales d'une seule couleur : libellé, barre proportionnelle, valeur. */
function Barres({ elements, vide }: { elements: { cle: string; libelle: string; n: number; onClick?: () => void }[]; vide: string }) {
  if (!elements.length)
    return (
      <Text size="sm" c="dimmed">
        {vide}
      </Text>
    );
  const max = Math.max(...elements.map((e) => e.n));
  return (
    <Stack gap={6}>
      {elements.map((e) => (
        <Tooltip key={e.cle} label={`${e.libelle} : ${fr(e.n)}`} position="top-start" openDelay={200}>
          <UnstyledButton onClick={e.onClick} style={{ cursor: e.onClick ? "pointer" : "default" }}>
            <Group gap="sm" wrap="nowrap">
              <Text size="sm" w="38%" truncate>
                {e.libelle}
              </Text>
              <Box style={{ flex: 1 }}>
                <Box h={12} bg="teal.6" style={{ width: `${Math.max(2, (100 * e.n) / max)}%`, borderRadius: 4 }} />
              </Box>
              <Text size="sm" c="dimmed" w={36} ta="right">
                {fr(e.n)}
              </Text>
            </Group>
          </UnstyledButton>
        </Tooltip>
      ))}
    </Stack>
  );
}

/** Naissances par siècle : colonnes dans l'ordre chronologique. */
function Siecles({ parSiecle }: { parSiecle: Donnees["parSiecle"] }) {
  if (!parSiecle.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune date de naissance connue pour l'instant.
      </Text>
    );
  const max = Math.max(...parSiecle.map((s) => s.n));
  return (
    <Group gap={8} align="flex-end" wrap="nowrap" h={170} pt="md">
      {parSiecle.map((s) => (
        <Tooltip key={s.siecle} label={`${siecleRomain(s.siecle)} : ${fr(s.n)} naissance${s.n > 1 ? "s" : ""}`}>
          <Stack gap={4} align="center" justify="flex-end" h="100%" style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" c="dimmed">
              {fr(s.n)}
            </Text>
            <Box bg="teal.6" w="70%" maw={56} style={{ height: `${Math.max(3, (100 * s.n) / max)}%`, borderRadius: "4px 4px 0 0" }} />
            <Text size="xs" fw={600}>
              {siecleRomain(s.siecle).replace(" siècle", "")}
            </Text>
          </Stack>
        </Tooltip>
      ))}
    </Group>
  );
}

function Completude({ d }: { d: Donnees }) {
  const total = d.totaux.individus;
  const lignes = [
    { libelle: "Date de naissance", n: d.completude.avecNaissance },
    { libelle: "Lieu de naissance", n: d.completude.avecLieuNaissance },
    { libelle: "Acte de naissance (preuve)", n: d.completude.avecActeNaissance },
    { libelle: "Parents connus", n: d.completude.avecParents },
    { libelle: "Décès renseigné", n: d.completude.avecDeces },
  ];
  return (
    <Stack gap="sm">
      {lignes.map((l) => (
        <Box key={l.libelle}>
          <Group justify="space-between" mb={2}>
            <Text size="sm">{l.libelle}</Text>
            <Text size="sm" c="dimmed">
              {pourcent(l.n, total)} % · {fr(l.n)} / {fr(total)}
            </Text>
          </Group>
          <Progress value={pourcent(l.n, total)} color="teal" size="md" radius="sm" />
        </Box>
      ))}
    </Stack>
  );
}

/** État des documents : une barre segmentée par statut, légende et nombres dessous. */
function Avancement({ d, aller }: { d: Donnees; aller: (to: string) => void }) {
  const total = STATUTS_ACTE.reduce((t, s) => t + (d.statuts[s.value] ?? 0), 0);
  return (
    <Stack gap="md">
      {total > 0 ? (
        <>
          <Progress.Root size={22} radius="sm">
            {STATUTS_ACTE.map((s) => {
              const n = d.statuts[s.value] ?? 0;
              return n ? (
                <Tooltip key={s.value} label={`${s.label} : ${fr(n)}`}>
                  <Progress.Section value={(100 * n) / total} color={s.couleur} style={{ borderRight: "2px solid var(--mantine-color-body)" }} />
                </Tooltip>
              ) : null;
            })}
          </Progress.Root>
          <SimpleGrid cols={2} spacing={6}>
            {STATUTS_ACTE.map((s) => (
              <Group key={s.value} gap={6} wrap="nowrap">
                <Box w={10} h={10} bg={`${s.couleur}.6`} style={{ borderRadius: 3, flexShrink: 0 }} />
                <Text size="sm">{s.label}</Text>
                <Text size="sm" c="dimmed">
                  {fr(d.statuts[s.value] ?? 0)}
                </Text>
              </Group>
            ))}
          </SimpleGrid>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Aucun document pour l'instant.
        </Text>
      )}
      <Stack gap={4}>
        <Anchor size="sm" onClick={() => aller("/individus")}>
          {fr(d.aFaire.relevesARattacher)} relevé{d.aFaire.relevesARattacher > 1 ? "s" : ""} à rattacher à un individu
        </Anchor>
        <Anchor size="sm" onClick={() => aller("/photos")}>
          {fr(d.aFaire.personnesAIdentifier)} personne{d.aFaire.personnesAIdentifier > 1 ? "s" : ""} à identifier sur les photos
        </Anchor>
        {d.aFaire.doutes > 0 && (
          <Anchor
            size="sm"
            c="orange.8"
            onClick={() => {
              memoriser("individus.onglet", "doutes");
              aller("/individus");
            }}
          >
            {fr(d.aFaire.doutes)} doute{d.aFaire.doutes > 1 ? "s" : ""} « peut-être la même personne » à lever
          </Anchor>
        )}
      </Stack>
    </Stack>
  );
}

/** Encart de présentation de l'outil ; masquable (choix mémorisé sur l'appareil). */
const CLE_PRESENTATION = "tabularium.accueil.presentationMasquee";
function EncartPresentation({ aller }: { aller: (to: string) => void }) {
  const [masque, setMasque] = useState(() => {
    try {
      return localStorage.getItem(CLE_PRESENTATION) === "oui";
    } catch {
      return false;
    }
  });
  if (masque) return null;
  const masquer = () => {
    setMasque(true);
    try {
      localStorage.setItem(CLE_PRESENTATION, "oui");
    } catch {
      // stockage indisponible : masqué pour cette visite
    }
  };
  return (
    <Paper withBorder p="md" bg="teal.0">
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" size="lg" radius="md">
          <IconInfoCircle size={20} />
        </ThemeIcon>
        <Box style={{ flex: 1 }}>
          <Text fw={600}>Rassembler, relever, recouper, reconstruire</Text>
          <Text size="sm" c="dimmed">
            Tabularium part des documents — actes, registres, photos de famille — pour reconstruire l'arbre, chaque information
            renvoyant à sa preuve. Et il place vos ancêtres sur la carte : nés ici, et là.
          </Text>
          <Button mt="sm" size="xs" variant="light" onClick={() => aller("/presentation")}>
            Lire la présentation
          </Button>
        </Box>
        <ActionIcon variant="subtle" color="gray" onClick={masquer} aria-label="Masquer cet encart" title="Masquer (la présentation reste dans le menu du compte)">
          <IconX size={16} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}

/** Premier lancement : par où commencer. */
function Bienvenue({ aller }: { aller: (to: string) => void }) {
  const etapes = [
    { titre: "Ajoutez un document", texte: "Le scan ou la photo d'un acte, rangé dans son registre.", to: "/documents", bouton: "Documents" },
    { titre: "Relevez les personnes", texte: "Surlignez chaque personne sur l'acte et notez ce qui est écrit.", to: "/documents", bouton: "Documents" },
    { titre: "L'arbre se construit", texte: "Rattachez les relevés aux individus : fiches, arbre et cartes suivent.", to: "/arbre", bouton: "Arbre" },
  ];
  return (
    <Paper withBorder p="lg">
      <Title order={3} mb={4}>
        Bienvenue !
      </Title>
      <Text c="dimmed" mb="md">
        Votre Tabularium est vide. Trois étapes pour commencer —{" "}
        <Anchor onClick={() => aller("/presentation")}>ou découvrir d'abord l'outil</Anchor> :
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {etapes.map((e, i) => (
          <Paper key={e.titre} bg="gray.0" p="md">
            <Text fw={700} mb={4}>
              {i + 1}. {e.titre}
            </Text>
            <Text size="sm" c="dimmed" mb="sm">
              {e.texte}
            </Text>
            <Button size="xs" variant="light" onClick={() => aller(e.to)}>
              {e.bouton}
            </Button>
          </Paper>
        ))}
      </SimpleGrid>
    </Paper>
  );
}

/** Accueil sur ordinateur et tablette : l'état de la recherche en un coup d'œil. */
export function TableauDeBord() {
  const navigate = useNavigate();
  const { data: d } = useQuery({ queryKey: ["tableauDeBord"], queryFn: tableauDeBord });
  const moi = utilisateur();
  const aller = (to: string) => navigate({ to });
  const fiche = (individuId: string) => navigate({ to: "/individus/$individuId", params: { individuId } });

  if (!d)
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );

  const t = d.totaux;
  const vide = t.individus + t.documents + t.index + t.photos === 0;
  const rechercheStatut = (s: string) => STATUTS_RECHERCHE.find((x) => x.value === s);

  return (
    <Box h="100%" style={{ overflowY: "auto" }}>
      <Stack gap="md" p="md" maw={1400} mx="auto">
        <Group justify="space-between" align="flex-end" gap="md">
          <Box>
            <Title order={2}>Tabularium Maiorum</Title>
            <Text c="dimmed">Les archives des ancêtres</Text>
          </Box>
          <Group gap="sm">
            <IndividuSelect
              w={{ base: "100%", sm: 300 }}
              placeholder="Aller à la fiche de…"
              value={null}
              onChange={(id) => id && fiche(id)}
            />
            {moi?.individuId && (
              <Button variant="default" leftSection={<IconUser size={16} />} onClick={() => fiche(moi.individuId!)}>
                Ma fiche
              </Button>
            )}
            {!LECTURE_SEULE && (
              <Button leftSection={<IconPlus size={16} />} onClick={() => aller("/documents")}>
                Ajouter un document
              </Button>
            )}
          </Group>
        </Group>

        <AvisMiseAJour />
        {vide && !LECTURE_SEULE ? <Bienvenue aller={aller} /> : <EncartPresentation aller={aller} />}

        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
          <Tuile icone={IconUsers} valeur={t.individus} libelle="Individus" onClick={() => aller("/individus")} />
          <Tuile
            icone={IconFileText}
            valeur={t.documents}
            libelle="Actes"
            detail={t.index ? `+ ${fr(t.index)} page${t.index > 1 ? "s" : ""} d'index` : undefined}
            onClick={() => aller("/documents")}
          />
          <Tuile icone={IconBook2} valeur={t.releves} libelle="Relevés" detail={`dans ${fr(t.registres)} registre${t.registres > 1 ? "s" : ""}`} onClick={() => aller("/documents")} />
          <Tuile icone={IconPhoto} valeur={t.photos} libelle="Photos" onClick={() => aller("/photos")} />
          <Tuile icone={IconMapPin} valeur={t.lieux} libelle="Lieux" onClick={() => aller("/lieux")} />
          <Tuile icone={IconListSearch} valeur={t.recherches} libelle="Recherches" onClick={() => aller("/recherches")} />
        </SimpleGrid>

        <Grid gap="md">
          <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
            <Carte titre="Avancement des documents">
              <Avancement d={d} aller={aller} />
            </Carte>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
            <Carte titre="Complétude des fiches">
              {t.individus ? (
                <Completude d={d} />
              ) : (
                <Text size="sm" c="dimmed">
                  Aucun individu pour l'instant.
                </Text>
              )}
            </Carte>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Carte
              titre="Naissances par siècle"
              action={
                <Button size="compact-sm" variant="subtle" leftSection={<IconBinaryTree2 size={14} />} onClick={() => aller("/arbre")}>
                  Arbre
                </Button>
              }
            >
              <Siecles parSiecle={d.parSiecle} />
              {d.plusAncien && (
                <Text size="sm" mt="sm">
                  Le plus ancien :{" "}
                  <Anchor onClick={() => fiche(d.plusAncien!.id)}>{nomComplet(d.plusAncien)}</Anchor>
                  {d.plusAncien.naissance && <Text span c="dimmed">{`, né${d.plusAncien.sexe === "F" ? "e" : ""} ${d.plusAncien.naissance}`}</Text>}
                </Text>
              )}
            </Carte>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Carte titre="Patronymes les plus fréquents">
              <Barres vide="Aucun nom pour l'instant." elements={d.patronymes.map((p) => ({ cle: p.nom, libelle: p.nom, n: p.n }))} />
            </Carte>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Carte
              titre="Lieux de naissance"
              action={
                <Button size="compact-sm" variant="subtle" onClick={() => aller("/cartographie")}>
                  Carte
                </Button>
              }
            >
              <Barres
                vide="Aucun lieu de naissance renseigné."
                elements={d.lieuxNaissance.map((l) => ({ cle: l.id, libelle: l.departement ? `${l.nom} (${l.departement})` : l.nom, n: l.n }))}
              />
            </Carte>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Carte
              titre="Recherches à mener"
              action={
                <Button size="compact-sm" variant="subtle" onClick={() => aller("/recherches")}>
                  Toutes
                </Button>
              }
            >
              {d.recherchesOuvertes.length ? (
                <Stack gap={6}>
                  {d.recherchesOuvertes.map((r) => {
                    const s = rechercheStatut(r.statut);
                    return (
                      <UnstyledButton key={r.id} onClick={() => r.individuId && fiche(r.individuId)}>
                        <Group gap="sm" wrap="nowrap">
                          <Badge size="sm" variant="light" color={s?.couleur} miw={70}>
                            {s?.label ?? r.statut}
                          </Badge>
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" truncate>
                              {r.titre}
                            </Text>
                            {r.individuId && (
                              <Text size="xs" c="dimmed" truncate>
                                {nomComplet({ nom: r.nom, prenoms: r.prenoms })}
                              </Text>
                            )}
                          </Box>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Aucune recherche en cours. On en crée une depuis la fiche d'un individu.
                </Text>
              )}
            </Carte>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Carte titre="Activité récente">
              {d.activite.length ? (
                <Stack gap={6}>
                  {d.activite.map((a) => {
                    const Icone = a.genre === "individu" ? IconUser : IconFileText;
                    return (
                      <UnstyledButton
                        key={`${a.genre}-${a.id}`}
                        onClick={() => (a.genre === "individu" ? fiche(a.id) : navigate({ to: "/actes/$acteId", params: { acteId: a.id } }))}
                      >
                        <Group gap="sm" wrap="nowrap">
                          <Icone size={16} color="var(--mantine-color-gray-6)" style={{ flexShrink: 0 }} />
                          <Text size="sm" truncate style={{ flex: 1 }}>
                            {a.libelle}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                            {depuis(a.quand)}
                            {a.par && ` · ${a.par.split("@")[0]}`}
                          </Text>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Rien pour l'instant.
                </Text>
              )}
            </Carte>
          </Grid.Col>
        </Grid>

        {!LECTURE_SEULE && (
          <Group gap="xs" justify="center" c="dimmed">
            <IconCamera size={14} />
            <Text size="xs">Aux archives, depuis un téléphone : « Capturer » photographie un acte et l'envoie directement ici.</Text>
          </Group>
        )}
      </Stack>
    </Box>
  );
}
