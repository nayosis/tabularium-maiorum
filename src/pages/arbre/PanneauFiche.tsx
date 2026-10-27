import { ActionIcon, Anchor, Badge, Button, Divider, Group, Loader, ScrollArea, Stack, Text } from "@mantine/core";
import { IconMap2, IconTarget, IconUser, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { chargerIndividu } from "../../data/individus";
import { relevesIndividu } from "../../data/releves";
import { recherchesIndividu } from "../../data/recherches";
import { STATUTS_RECHERCHE } from "../../lib/recherches";
import { IconesActes } from "../../components/IconesActes";
import { Portrait } from "../../components/Portrait";
import { useLieux, useNoms } from "../../components/selects";
import { couleurRole } from "../../lib/libelles";
import { clicOuvrir } from "../../lib/onglets";
import { anneeFloue } from "./disposition";

type Props = {
  individuId: string;
  /** Sosa ou lien de parenté avec la personne racine. */
  sousTitre?: string | null;
  estRacine: boolean;
  onFermer: () => void;
  /** Clic sur un parent, conjoint ou enfant : le sélectionner dans l'arbre. */
  onChoisir: (id: string) => void;
  onCentrer: () => void;
  /** Téléphone : dans un tiroir, sur toute la largeur. */
  pleineLargeur?: boolean;
};

const COULEUR_SEXE: Record<string, string> = { M: "#1c7ed6", F: "#d6336c" };

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        {titre}
      </Text>
      {children}
    </Stack>
  );
}

/** Lien vers une autre personne de la famille, avec ses années. */
function Personne({ p, onChoisir }: { p: { id: string; nom: string | null; prenoms: string | null; naissanceMin?: string | null; naissanceMax?: string | null; decesMin?: string | null; decesMax?: string | null }; onChoisir: (id: string) => void }) {
  const n = anneeFloue(p.naissanceMin ?? null, p.naissanceMax ?? null);
  const d = anneeFloue(p.decesMin ?? null, p.decesMax ?? null);
  const { nom } = useNoms();
  return (
    <Group gap={6} wrap="nowrap">
      <Anchor size="sm" onClick={() => onChoisir(p.id)} style={{ flex: 1, minWidth: 0 }} truncate>
        {nom(p)}
      </Anchor>
      {(n || d) && (
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {n || "?"} – {d}
        </Text>
      )}
    </Group>
  );
}

/** Colonne de droite de l'arbre : l'essentiel de la fiche de la personne sélectionnée. */
export function PanneauFiche({ individuId, sousTitre, estRacine, onFermer, onChoisir, onCentrer, pleineLargeur }: Props) {
  const { data: ind } = useQuery({ queryKey: ["individu", individuId], queryFn: () => chargerIndividu(individuId) });
  const { data: releves = [] } = useQuery({ queryKey: ["releves-individu", individuId], queryFn: () => relevesIndividu(individuId) });
  const { data: recherches = [] } = useQuery({ queryKey: ["recherches", individuId], queryFn: () => recherchesIndividu(individuId) });
  const { data: lieux = [] } = useLieux();
  const { nom } = useNoms();
  const commune = (id: string | null) => {
    const l = lieux.find((x) => x.id === id);
    return l ? (l.departement ? `${l.nom} (${l.departement})` : l.nom) : null;
  };

  return (
    <Stack
      gap={0}
      w={pleineLargeur ? "100%" : 340}
      h="100%"
      style={{ borderLeft: pleineLargeur ? undefined : "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      bg="var(--t-surface)"
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        align="flex-start"
        p="md"
        pb="sm"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", borderTop: `4px solid ${COULEUR_SEXE[ind?.sexe ?? ""] ?? "var(--mantine-color-gray-4)"}` }}
      >
        {ind?.portrait && <Portrait portrait={ind.portrait} taille={56} sexe={ind.sexe} />}
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={700} size="lg" lh={1.2}>
            {ind ? nom(ind) : "…"}
          </Text>
          {sousTitre && (
            <Text size="xs" c="teal.8">
              {sousTitre}
            </Text>
          )}
          {ind?.profession && (
            <Text size="sm" c="dimmed">
              {ind.profession}
            </Text>
          )}
        </Stack>
        <ActionIcon variant="subtle" size="sm" onClick={onFermer} title="Fermer">
          <IconX size={14} />
        </ActionIcon>
      </Group>

      {!ind ? (
        <Group justify="center" p="xl">
          <Loader size="sm" />
        </Group>
      ) : (
        <ScrollArea style={{ flex: 1 }}>
          <Stack gap="md" p="md">
            <Group gap="xs">
              <Button
                size="xs"
                leftSection={<IconUser size={14} />}
                onClick={(e) => clicOuvrir(e, `/individus/${ind.id}`)}
                onAuxClick={(e) => clicOuvrir(e, `/individus/${ind.id}`)}
              >
                Ouvrir la fiche
              </Button>
              {!estRacine && (
                <Button size="xs" variant="light" leftSection={<IconTarget size={14} />} onClick={onCentrer}>
                  Centrer ici
                </Button>
              )}
              <ActionIcon
                variant="light"
                size="md"
                title="Cartographie"
                onClick={(e) => clicOuvrir(e, `/cartographie?racine=${ind.id}`)}
              >
                <IconMap2 size={16} />
              </ActionIcon>
            </Group>

            <Section titre="Vie">
              <Group gap="xs">
                <IconesActes acteNaissanceId={ind.acteNaissanceId} acteMariage={ind.couples.some((c) => c.acteId)} acteDecesId={ind.acteDecesId} sansUnion={ind.sansUnion} />
              </Group>
              <Text size="sm">
                <b>°</b> {[ind.naissance || anneeFloue(ind.naissanceMin, ind.naissanceMax), commune(ind.naissanceLieuId)].filter(Boolean).join(" · ") || <Text span c="dimmed" size="sm">naissance inconnue</Text>}
              </Text>
              {(ind.deces || ind.decesMin || ind.decesMax || ind.decesLieuId) && (
                <Text size="sm">
                  <b>†</b> {[ind.deces || anneeFloue(ind.decesMin, ind.decesMax), commune(ind.decesLieuId)].filter(Boolean).join(" · ")}
                </Text>
              )}
            </Section>

            <Section titre="Parents">
              {ind.pere ? <Personne p={ind.pere} onChoisir={onChoisir} /> : <Text size="sm" c="dimmed">{ind.pereInconnu ? "Père inconnu" : "Père non renseigné"}</Text>}
              {ind.mere ? <Personne p={ind.mere} onChoisir={onChoisir} /> : <Text size="sm" c="dimmed">{ind.mereInconnue ? "Mère inconnue" : "Mère non renseignée"}</Text>}
            </Section>

            {ind.sansUnion && ind.couples.length === 0 && (
              <Section titre="Union">
                <Text size="sm" c="dimmed">
                  Aucune union
                </Text>
              </Section>
            )}

            {ind.couples.length > 0 && (
              <Section titre={ind.couples.length > 1 ? "Unions" : "Union"}>
                {ind.couples.map((c) => (
                  <Stack key={c.id} gap={0}>
                    {c.conjointId ? (
                      <Personne p={{ id: c.conjointId, nom: c.conjointNom, prenoms: c.conjointPrenoms }} onChoisir={onChoisir} />
                    ) : (
                      <Text size="sm" c="dimmed">Conjoint inconnu</Text>
                    )}
                    {(c.date || c.lieuNom) && (
                      <Text size="xs" c="dimmed">
                        ∞ {[c.date, c.lieuNom].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                  </Stack>
                ))}
              </Section>
            )}

            {ind.enfants.length > 0 && (
              <Section titre={`Enfants (${ind.enfants.length})`}>
                {ind.enfants.map((e) => (
                  <Personne key={e.id} p={e} onChoisir={onChoisir} />
                ))}
              </Section>
            )}

            <Section titre={`Relevés (${releves.length})`}>
              {releves.length === 0 && (
                <Text size="sm" c="dimmed">
                  Aucun document rattaché.
                </Text>
              )}
              {releves.map((r) => (
                <Group key={r.id} gap={6} wrap="nowrap" align="flex-start">
                  <Badge size="xs" variant="light" color={couleurRole(r.role)} miw={60} mt={3}>
                    {r.role ?? "?"}
                  </Badge>
                  <Anchor
                    size="sm"
                    href={`/actes/${r.acteId}?releve=${r.id}`}
                    style={{ flex: 1, minWidth: 0 }}
                    lineClamp={2}
                  >
                    {r.acteTitre}
                    {r.acteDate && (
                      <Text span size="xs" c="dimmed">
                        {" "}
                        · {r.acteDate}
                      </Text>
                    )}
                  </Anchor>
                </Group>
              ))}
            </Section>

            {recherches.length > 0 && (
              <Section titre={`Recherches (${recherches.length})`}>
                {recherches.map((r) => {
                  const s = STATUTS_RECHERCHE.find((x) => x.value === r.statut);
                  return (
                    <Group key={r.id} gap={6} wrap="nowrap">
                      <Badge size="xs" variant="light" color={s?.couleur ?? "gray"} miw={70}>
                        {s?.label ?? r.statut}
                      </Badge>
                      <Text size="sm" truncate style={{ flex: 1 }}>
                        {r.titre}
                      </Text>
                    </Group>
                  );
                })}
              </Section>
            )}

            {ind.notes && (
              <>
                <Divider />
                <Section titre="Notes">
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {ind.notes}
                  </Text>
                </Section>
              </>
            )}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}
