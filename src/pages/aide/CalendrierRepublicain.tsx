import { useState } from "react";
import { Alert, Badge, Box, Code, List, Paper, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { IconCalendarRepeat, IconInfoCircle } from "@tabler/icons-react";
import { conversionCalendrier, formaterIso } from "../../lib/dates";
import { ANNEES_REPUBLICAINES, MOIS_REPUBLICAINS } from "../../lib/republicain";

const JOURS_COMPLEMENTAIRES = ["de la Vertu", "du Génie", "du Travail", "de l'Opinion", "des Récompenses", "de la Révolution (années sextiles)"];

/** Convertisseur dans les deux sens, comme dans la recherche Ctrl+K. */
function Convertisseur() {
  const [texte, setTexte] = useState("3 brumaire an IV");
  const conversion = conversionCalendrier(texte);
  return (
    <Paper withBorder p="md">
      <Stack gap="xs">
        <TextInput
          label="Convertir une date"
          description="Une date républicaine (« 18 brumaire an VIII ») ou grégorienne entre 1792 et 1805 (« 09/11/1799 »)"
          leftSection={<IconCalendarRepeat size={16} />}
          value={texte}
          onChange={(e) => setTexte(e.currentTarget.value)}
        />
        {texte.trim() &&
          (conversion ? (
            <Text>
              <b>{conversion.resultat}</b>{" "}
              <Text span c="dimmed" size="sm">
                {conversion.detail}
              </Text>
            </Text>
          ) : (
            <Text c="dimmed" size="sm">
              Pas de conversion : date non reconnue, ou hors de la période du calendrier (22/09/1792 – 31/12/1805).
            </Text>
          ))}
      </Stack>
    </Paper>
  );
}

/** Aide : le calendrier républicain, ses mois, ses années, et comment saisir ses dates. */
export function CalendrierRepublicain() {
  return (
    <Box h="100%" style={{ overflowY: "auto" }}>
      <Stack gap="lg" p="md" maw={920} mx="auto" pb={48}>
        <Stack gap={4} pt="md">
          <Text size="sm" c="dimmed">
            Aide
          </Text>
          <Title order={2}>Le calendrier républicain</Title>
        </Stack>

        <Text>
          De la fin de 1793 à la fin de 1805, les actes d'état civil sont datés selon le calendrier républicain : « le trois
          brumaire de l'an quatre de la République française ». Tabularium comprend ces dates : <b>saisissez la date telle
          qu'elle est écrite dans l'acte</b>, l'application calcule la date grégorienne pour le tri, l'arbre, les âges et la
          recherche des doublons, et l'affiche à côté : « 25/10/1795 (3 brumaire an IV) ».
        </Text>

        <Convertisseur />

        <Title order={3}>En bref</Title>
        <List spacing={4}>
          <List.Item>
            Adopté par la Convention à l'automne 1793, avec effet rétroactif : l'an I commence le 22 septembre 1792, au lendemain de
            la proclamation de la République, jour de l'équinoxe d'automne.
          </List.Item>
          <List.Item>
            Chaque année commence à l'équinoxe d'automne, le 22, 23 ou 24 septembre selon l'année : une année républicaine
            est donc à cheval sur deux années grégoriennes (l'an IV va du 23/09/1795 au 21/09/1796).
          </List.Item>
          <List.Item>
            12 mois de 30 jours, chacun divisé en 3 décades de 10 jours (primidi, duodi… décadi, jour de repos), puis 5 jours
            complémentaires — 6 les années sextiles (an III, an VII, an XI).
          </List.Item>
          <List.Item>
            Abandonné par Napoléon : le 10 nivôse an XIV (31 décembre 1805) est le dernier jour ; le lendemain est le
            1er janvier 1806.
          </List.Item>
          <List.Item>
            Les années s'écrivent en chiffres romains (an IV), parfois en toutes lettres (« l'an quatre ») ou en chiffres arabes.
          </List.Item>
        </List>

        <Title order={3}>Les mois</Title>
        <Text size="sm" c="dimmed">
          Les noms, inventés par Fabre d'Églantine, évoquent la saison : -aire en automne, -ôse en hiver, -al au printemps,
          -idor en été. La date grégorienne du 1er du mois varie d'un jour selon l'année.
        </Text>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Mois</Table.Th>
              <Table.Th>Abréviation</Table.Th>
              <Table.Th>Saison</Table.Th>
              <Table.Th>Évoque</Table.Th>
              <Table.Th>Commence vers le</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {MOIS_REPUBLICAINS.map((m, i) => (
              <Table.Tr key={m.nom}>
                <Table.Td fw={600}>
                  {i + 1}. {m.nom}
                </Table.Td>
                <Table.Td>
                  <Code>{m.abreviation}</Code>
                </Table.Td>
                <Table.Td>{m.saison}</Table.Td>
                <Table.Td>{m.sens}</Table.Td>
                <Table.Td>{m.debut}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="sm">
          <b>Abréviations</b> : les greffiers abrègent souvent les mois. Tabularium accepte le début du nom, avec ou sans point,
          dès les 3 ou 4 premières lettres (« brum. », « frim », « fructid. ») — 4 lettres pour distinguer <i>vend</i>émiaire
          de <i>vent</i>ôse.
        </Text>
        <Text size="sm">
          <b>Jours complémentaires</b> (ou « sans-culottides », leur premier nom), après le 30 fructidor : jour{" "}
          {JOURS_COMPLEMENTAIRES.join(", jour ")}.
        </Text>

        <Title order={3}>Les années</Title>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Année</Table.Th>
              <Table.Th>1er vendémiaire</Table.Th>
              <Table.Th>Dernier jour</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ANNEES_REPUBLICAINES.map((a) => (
              <Table.Tr key={a.an}>
                <Table.Td fw={600}>
                  an {a.romain} <Text span c="dimmed" size="xs">({a.an})</Text>
                </Table.Td>
                <Table.Td>{formaterIso(a.debut)}</Table.Td>
                <Table.Td>{formaterIso(a.fin)}</Table.Td>
                <Table.Td>
                  {a.sextile && (
                    <Badge size="xs" variant="light">
                      sextile : 6 jours complémentaires
                    </Badge>
                  )}
                  {a.an === ANNEES_REPUBLICAINES.length && (
                    <Badge size="xs" variant="light" color="gray">
                      s'arrête le 10 nivôse
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Title order={3}>Saisir une date dans Tabularium</Title>
        <Table withTableBorder>
          <Table.Tbody>
            {[
              ["3 brumaire an IV", "le jour (aussi « an 4 », « 1er » ou « premier »)"],
              ["3 brum. an IV", "mois abrégé"],
              ["brumaire an IV", "le mois entier (du 23/10 au 21/11/1795)"],
              ["an IV", "l'année entière (du 23/09/1795 au 21/09/1796)"],
              ["2e jour complémentaire an VII", "jours complémentaires (aussi « 2e sans-culottide »)"],
              ["jour de la Révolution an III", "6e jour complémentaire d'une année sextile"],
              ["vers brumaire an IV", "comme les autres dates : vers, avant, après, entre … et …"],
            ].map(([exemple, sens]) => (
              <Table.Tr key={exemple}>
                <Table.Td>
                  <Code>{exemple}</Code>
                </Table.Td>
                <Table.Td>{sens}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Text size="sm">
          Sous le champ, Tabularium affiche la date comprise (« 25 octobre 1795 ») : si rien n'apparaît, la forme n'est pas
          reconnue — la saisie est gardée telle quelle mais n'est ni triée ni comparée. Les années en toutes lettres
          (« l'an quatre ») ne sont pas comprises : écrivez « an IV ».
        </Text>

        <Title order={3}>Pièges</Title>
        <List spacing={4}>
          <List.Item>
            <b>L'année change en septembre</b>, pas en janvier : un enfant né en nivôse an IV (décembre 1795 – janvier 1796) peut
            être de 1795 ou de 1796.
          </List.Item>
          <List.Item>
            <b>Un jour d'écart avec un autre convertisseur ?</b> Tabularium suit les débuts d'année officiels (22, 23 ou 24
            septembre, tableau ci-dessus) ; un outil qui calcule par formule peut différer d'un jour certaines années.
          </List.Item>
          <List.Item>
            <b>Les âges</b> déclarés dans un acte républicain se calculent comme les autres : saisissez la date de l'acte en
            républicain, la naissance estimée sera juste.
          </List.Item>
          <List.Item>
            <b>Les registres paroissiaux</b> de la période (baptêmes clandestins, registres tenus par les curés) restent souvent
            en calendrier grégorien : saisissez la date comme elle est écrite.
          </List.Item>
        </List>

        <Alert icon={<IconInfoCircle size={18} />} variant="light" color="gray">
          En 1871, la Commune de Paris a brièvement daté ses actes officiels en calendrier républicain (an LXXIX) ; ces dates ne
          sont pas converties.
        </Alert>
      </Stack>
    </Box>
  );
}
