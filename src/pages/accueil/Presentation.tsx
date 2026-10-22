import type { ReactNode } from "react";
import { Anchor, Box, Button, Divider, Group, List, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import {
  IconArrowRight, IconBinaryTree2, IconCamera, IconFileSearch, IconGitMerge, IconHeartHandshake, IconHighlight, IconLock, IconMap2,
  IconRoute, IconUsersGroup,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { tableauDeBord } from "../../data/statistiques";

const DEPOT = "https://github.com/nayosis/tabularium-maiorum";

function Section({ icone: Icone, titre, children }: { icone: typeof IconMap2; titre: string; children: ReactNode }) {
  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" size="lg" radius="md">
          <Icone size={20} />
        </ThemeIcon>
        <Title order={3}>{titre}</Title>
      </Group>
      {children}
    </Stack>
  );
}

const ETAPES = [
  {
    icone: IconFileSearch,
    titre: "Rassembler",
    texte:
      "Actes d'état civil et paroissiaux, tables décennales, photos de famille, papiers retrouvés dans un grenier : chaque document est rangé dans son registre ou son album, avec sa cote. Aux archives, le téléphone photographie un acte et l'envoie directement.",
  },
  {
    icone: IconHighlight,
    titre: "Relever",
    texte:
      "Sur l'image de l'acte, on surligne chaque personne et on note ce qui est écrit, tel quel : nom, âge, profession, domicile, liens. Sur une photo, on entoure les visages pour les identifier.",
  },
  {
    icone: IconGitMerge,
    titre: "Recouper",
    texte:
      "Une même personne apparaît dans plusieurs documents : son baptême, son mariage, la naissance de ses enfants, son décès. Tabularium rapproche ces relevés, propose des rattachements, montre ce qui concorde et ce qui se contredit.",
  },
  {
    icone: IconBinaryTree2,
    titre: "Reconstruire",
    texte:
      "Les fiches individuelles et l'arbre se construisent à partir des relevés. Chaque date, chaque lieu, chaque lien de parenté renvoie à l'acte qui le prouve : on sait toujours d'où vient une information.",
  },
];

/** Présentation de l'outil : pourquoi il existe, comment il fonctionne, ce qu'on y trouve. */
export function Presentation() {
  const navigate = useNavigate();
  const { data: d } = useQuery({ queryKey: ["tableauDeBord"], queryFn: tableauDeBord });
  const geo = d?.geographie;
  const lieux = d?.lieuxNaissance.slice(0, 5) ?? [];

  return (
    <Box h="100%" style={{ overflowY: "auto" }}>
      <Stack gap={36} p="md" maw={920} mx="auto" pb={48}>
        <Stack gap={6} pt="md">
          <Title order={1}>Tabularium Maiorum</Title>
          <Text size="xl" c="dimmed">
            Les archives des ancêtres
          </Text>
          <Text mt="sm">
            À Rome, le <i>tabularium</i> était le bâtiment où l'on conservait les archives publiques ; les <i>maiores</i>, ce sont
            les ancêtres. Tabularium Maiorum est l'atelier où l'on rassemble les traces laissées par les siens, où on les lit, où on
            les recoupe, et d'où l'on reconstruit leur histoire.
          </Text>
        </Stack>

        <Section icone={IconHeartHandshake} titre="Pourquoi cet outil">
          <Text>
            Une recherche généalogique commence toujours de la même façon : des dizaines d'actes téléchargés sur les sites des
            archives départementales, des photos de famille dont plus personne ne connaît tous les visages, des notes prises en salle
            de lecture, des tableaux qui se contredisent. Les logiciels de généalogie classiques partent de l'arbre : on y saisit des
            conclusions, et les documents qui les justifient restent ailleurs.
          </Text>
          <Text>
            Tabularium fait l'inverse : <b>il part des documents</b>. Une conclusion n'est jamais saisie à la main, elle se déduit de
            ce que disent les sources. On travaille comme un enquêteur : on relève, on compare, on vérifie, et l'arbre n'est que le
            résultat de ce travail. Quand deux actes ne disent pas la même chose, on le voit ; quand une branche ne repose sur aucune
            preuve, on le sait.
          </Text>
        </Section>

        <Section icone={IconRoute} titre="Comment ça marche">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            {ETAPES.map((e, i) => (
              <Paper key={e.titre} withBorder p="md">
                <Group gap="xs" mb="xs" wrap="nowrap">
                  <ThemeIcon variant="filled" radius="xl" size="md">
                    <e.icone size={16} />
                  </ThemeIcon>
                  <Text fw={700}>
                    {i + 1}. {e.titre}
                  </Text>
                  {i < ETAPES.length - 1 && <IconArrowRight size={16} color="var(--mantine-color-gray-5)" style={{ marginLeft: "auto" }} />}
                </Group>
                <Text size="sm" c="dimmed">
                  {e.texte}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
          <Text size="sm">
            Et pour ne rien oublier, chaque piste ouverte devient une <b>recherche</b> : ce qu'on cherche, où on a déjà regardé
            (registre, vues consultées), ce qu'on a trouvé — ou pas.
          </Text>
        </Section>

        <Section icone={IconMap2} titre="Une généalogie qui a une géographie">
          <Text>
            Nos ancêtres ne sont pas nés nulle part. Ils sont nés ici et là, dans un village, puis un autre ; ils se sont mariés dans la
            paroisse voisine ou à l'autre bout du pays, au gré du travail, des guerres, des rencontres. Tabularium place chaque lieu sur
            la carte pour rendre cette histoire visible :
          </Text>
          <List spacing={4} size="sm">
            <List.Item>
              la <b>cartographie</b> place l'ascendance ou la descendance d'une personne sur les lieux de naissance, génération par
              génération, et peut les faire apparaître une à une pour suivre les migrations au fil des siècles ;
            </List.Item>
            <List.Item>
              le <b>parcours de vie</b> de chaque individu relie sur une carte ses naissance, mariage, naissances de ses enfants et décès ;
            </List.Item>
            <List.Item>les lieux sont mutualisés : une commune n'existe qu'une fois, avec son département et sa position.</List.Item>
          </List>
          {geo && geo.communes > 0 && (
            <Paper withBorder p="md" bg="teal.0">
              <Text>
                Dans ce Tabularium, les ancêtres sont nés dans <b>{geo.communes}</b> commune{geo.communes > 1 ? "s" : ""}
                {geo.departements > 0 && (
                  <>
                    {" "}
                    de <b>{geo.departements}</b> département{geo.departements > 1 ? "s" : ""}
                  </>
                )}
                {lieux.length > 0 && <> — surtout à {lieux.map((l) => l.nom).join(", ")}</>}.
              </Text>
              <Button mt="sm" size="xs" leftSection={<IconMap2 size={14} />} onClick={() => navigate({ to: "/cartographie" })}>
                Voir la carte
              </Button>
            </Paper>
          )}
        </Section>

        <Section icone={IconUsersGroup} titre="En famille">
          <Text>
            La généalogie se fait rarement seul. Un cousin a les photos, une tante se souvient des prénoms, un autre fait les
            déplacements aux archives. Chacun a son compte : en <b>lecture</b> pour consulter l'arbre et les photos, en{" "}
            <b>écriture</b> pour participer. Les modifications apparaissent en direct chez tous, on sait qui a modifié quoi, et deux
            personnes ne peuvent pas s'écraser l'une l'autre sans s'en apercevoir.
          </Text>
          <Group gap="xs" c="dimmed">
            <IconCamera size={16} />
            <Text size="sm">Sur téléphone : consulter l'arbre, retrouver quelqu'un, photographier un acte aux archives.</Text>
          </Group>
        </Section>

        <Section icone={IconLock} titre="Vos données restent chez vous">
          <Text>
            Tabularium est un <b>logiciel libre</b> (licence AGPL-3.0) : gratuit, sans publicité, sans abonnement. Il s'installe sur
            votre ordinateur ou sur votre propre serveur ; vos documents et votre arbre ne sont envoyés à aucun service. Une
            sauvegarde complète se télécharge en un clic.
          </Text>
        </Section>

        <Divider />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Code source, aide et nouvelles versions :{" "}
            <Anchor href={DEPOT} target="_blank" rel="noopener noreferrer">
              {DEPOT.replace("https://", "")}
            </Anchor>
          </Text>
          <Button variant="light" onClick={() => navigate({ to: "/" })}>
            Retour à l'accueil
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
