import { Fragment } from "react";
import { Alert, Badge, Button, Group, Paper, Stack, Table, Text, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconArrowBarToLeft, IconTimeline } from "@tabler/icons-react";
import type { Individu } from "../db/schema";
import type { ReleveAvecActe } from "../data/releves";
import { creerLieu } from "../data/lieux";
import { AnchorLink } from "../components/AnchorLink";
import { useLieux } from "../components/selects";
import { ecrire } from "../lib/query";
import { LECTURE_SEULE } from "../lib/mode";
import { LIBELLES_CHAMPS, cleTexte, croisementNaissance, dejaDansFiche, propositions, type Proposition } from "../lib/synthese";

type Props = {
  releves: ReleveAvecActe[];
  /** Valeurs actuelles du formulaire de la fiche. */
  fiche: Partial<Individu>;
  /** Modifie le formulaire (et l'enregistre). */
  modifier: (patch: Partial<Individu>) => void;
};

const MAX_SOURCES = 3;

/** « Ce que disent les relevés » : chaque valeur trouvée, ses sources, et un bouton pour la reporter dans la fiche. */
export function SyntheseReleves({ releves, fiche, modifier }: Props) {
  const { data: lieux = [] } = useLieux();
  const ps = propositions(releves);
  const croisement = croisementNaissance(releves);

  const champLieu = (p: Proposition) => (p.champ === "naissanceLieu" ? "naissanceLieuId" : "decesLieuId");

  const estDansFiche = (p: Proposition) => {
    if (!p.lieu) return dejaDansFiche(p, fiche);
    const actuel = lieux.find((l) => l.id === fiche[champLieu(p)]);
    return !!actuel && (actuel.id === p.lieu.id || cleTexte(actuel.nom) === cleTexte(p.lieu.nom));
  };

  const utiliser = async (p: Proposition) => {
    if (p.lieu) {
      // Lieu de l'acte (id connu), sinon lieu existant du même nom, sinon on le crée.
      const id =
        p.lieu.id ??
        lieux.find((l) => cleTexte(l.nom) === cleTexte(p.lieu!.nom))?.id ??
        (await ecrire(() => creerLieu(p.lieu!.nom)));
      if (id) modifier({ [champLieu(p)]: id });
    } else if (p.champ === "profession" && fiche.profession?.trim()) {
      modifier({ profession: `${fiche.profession.trim()}, ${p.valeur}` });
    } else if (p.patch) {
      modifier(p.patch);
    }
  };

  const parChamp = Map.groupBy(ps, (p) => p.champ);

  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb={4}>
        <IconTimeline size={18} />
        <Text fw={600}>Ce que disent les relevés</Text>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Toutes les valeurs trouvées dans les {releves.length} relevé{releves.length > 1 ? "s" : ""} rattaché{releves.length > 1 ? "s" : ""}. « Utiliser » les reporte dans la fiche ci-dessus.
      </Text>

      <Stack gap="sm">
        {croisement &&
          (croisement.contradiction ? (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />} title="Naissance : âges incompatibles">
              Les {croisement.nb} fourchettes de naissance des relevés ne se recoupent pas (au plus tôt le {croisement.min}, au plus tard le{" "}
              {croisement.max}). Un âge est peut-être mal lu, ou un relevé est rattaché à la mauvaise personne.
            </Alert>
          ) : (
            <Alert color="teal" variant="light" title={`Naissance : croisement de ${croisement.nb} relevés datés`}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm">
                  En recoupant les âges et dates déclarés : né(e) <b>{croisement.saisie}</b>.
                </Text>
                {fiche.naissanceMin === croisement.min && fiche.naissanceMax === croisement.max ? (
                  <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                    dans la fiche
                  </Badge>
                ) : LECTURE_SEULE ? null : (
                  <Button size="xs" leftSection={<IconArrowBarToLeft size={14} />} onClick={() => modifier(croisement.patch)}>
                    Utiliser
                  </Button>
                )}
              </Group>
            </Alert>
          ))}

        {ps.length === 0 ? (
          <Text size="sm" c="dimmed">
            Les relevés rattachés ne contiennent pas encore d'information à reporter.
          </Text>
        ) : (
          <Table verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={140}>Champ</Table.Th>
                <Table.Th>Valeur relevée</Table.Th>
                <Table.Th>Sources</Table.Th>
                <Table.Th w={150} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...parChamp.entries()].map(([champ, liste]) => (
                <Fragment key={champ}>
                  {liste.map((p, i) => {
                    const dedans = estDansFiche(p);
                    const plusieurs = liste.length > 1;
                    return (
                      <Table.Tr key={`${champ}-${i}`}>
                        <Table.Td fw={500} style={{ verticalAlign: "top" }}>
                          {i === 0 && (
                            <Group gap={4}>
                              {LIBELLES_CHAMPS[champ]}
                              {plusieurs && champ !== "profession" && (
                                <Tooltip label="Les relevés ne concordent pas : choisissez la bonne valeur">
                                  <IconAlertTriangle size={14} color="var(--mantine-color-orange-6)" />
                                </Tooltip>
                              )}
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{p.valeur}</Text>
                          {p.deduite && (
                            <Text size="xs" c="dimmed">
                              déduit : {p.deduite}
                            </Text>
                          )}
                          {p.incompatible && (
                            <Text size="xs" c="orange.8">
                              {p.incompatible}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            {p.sources.slice(0, MAX_SOURCES).map((s) => (
                              <AnchorLink key={s.releveId} to="/actes/$acteId" params={{ acteId: s.acteId }} search={{ releve: s.releveId }} size="xs">
                                {s.acteTitre}
                                {s.role ? ` (${s.role})` : ""}
                              </AnchorLink>
                            ))}
                            {p.sources.length > MAX_SOURCES && (
                              <Text size="xs" c="dimmed">
                                + {p.sources.length - MAX_SOURCES} autre{p.sources.length - MAX_SOURCES > 1 ? "s" : ""}
                              </Text>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td ta="right">
                          {dedans ? (
                            <Badge color="teal" variant="light" leftSection={<IconCheck size={12} />}>
                              dans la fiche
                            </Badge>
                          ) : LECTURE_SEULE ? null : (
                            <Button size="compact-xs" variant="light" leftSection={<IconArrowBarToLeft size={12} />} onClick={() => utiliser(p)}>
                              {p.champ === "profession" && fiche.profession?.trim() ? "Ajouter" : "Utiliser"}
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Fragment>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  );
}
