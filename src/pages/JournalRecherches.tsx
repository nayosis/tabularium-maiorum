import { useState } from "react";
import {
  ActionIcon, Anchor, Badge, Button, Group, Menu, Paper, Select, Stack, Text, TextInput, Textarea, Timeline, Tooltip, UnstyledButton,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconChevronDown, IconChevronRight, IconDots, IconExternalLink, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { openUrl } from "../lib/liens";
import type { IndividuComplet } from "../data/individus";
import { creerRecherche, majRecherche, recherchesIndividu, supprimerRecherche, type ConsultationDetaillee, type Recherche } from "../data/recherches";
import { RESULTATS, STATUTS_RECHERCHE, TYPES_RECHERCHE } from "../lib/recherches";
import { ModalConsultation } from "../components/ModalConsultation";
import { useAutoSave } from "../hooks/useAutoSave";
import { ecrire } from "../lib/query";
import { ActeSelect } from "./liensActes";
import { LECTURE_SEULE } from "../lib/mode";
import { Lecture } from "../components/Lecture";
import { anneeFloue } from "./arbre/disposition";
import { memoriser, useMemoire } from "../lib/onglets";

const cleOuverte = (id: string) => `recherche.ouverte.${id}`;

const dateFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const infoResultat = (v: string) => RESULTATS.find((r) => r.value === v) ?? RESULTATS[0];

const vers = (min: string | null, max: string | null) => {
  const a = anneeFloue(min, max);
  return a ? ` — ${a.replace("~", "vers ").replace("<", "avant ").replace(">", "après ")}` : "";
};

/** Titre et raisonnement proposés pour une nouvelle recherche, d'après ce que la fiche sait déjà. */
function propose(type: string, ind: IndividuComplet) {
  if (type === "naissance")
    return { titre: `Acte de naissance${vers(ind.naissanceMin, ind.naissanceMax)}`, description: ind.naissance ? `Naissance connue : ${ind.naissance}` : null };
  if (type === "deces")
    return { titre: `Acte de décès${vers(ind.decesMin, ind.decesMax)}`, description: ind.deces ? `Décès connu : ${ind.deces}` : null };
  if (type === "mariage") return { titre: "Acte de mariage", description: null };
  return { titre: "Recherche", description: null };
}

type Props = { ind: IndividuComplet; acteIds: string[] };

export function JournalRecherches({ ind, acteIds }: Props) {
  const { data: recherches = [] } = useQuery({ queryKey: ["recherches", ind.id], queryFn: () => recherchesIndividu(ind.id) });
  const ouvertes = recherches.filter((r) => r.statut === "a_faire" || r.statut === "en_cours").length;

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconSearch size={18} />
          <Text fw={600}>Recherches</Text>
          {ouvertes > 0 && (
            <Badge size="sm" variant="light">
              {ouvertes} en cours
            </Badge>
          )}
        </Group>
        <Menu position="bottom-end">
          <Menu.Target>
            <Button display={LECTURE_SEULE ? "none" : undefined} size="xs" variant="light" leftSection={<IconPlus size={14} />}>
              Nouvelle recherche
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {TYPES_RECHERCHE.map((t) => (
              <Menu.Item
                key={t.value}
                onClick={async () => {
                  const id = await ecrire(() => creerRecherche(ind.id, { type: t.value, ...propose(t.value, ind) }));
                  // La recherche qu'on vient de créer s'ouvre, prête à être remplie.
                  if (id) memoriser(cleOuverte(id), true);
                }}
              >
                {t.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      {recherches.length === 0 ? (
        <Text size="sm" c="dimmed">
          Notez ici ce que vous cherchez pour cette personne et les sources déjà fouillées, même sans résultat : cela évite de refaire deux fois
          la même recherche.
        </Text>
      ) : (
        <Stack gap="md">
          {recherches.map((r) => (
            <CarteRecherche key={r.id} r={r} acteIds={acteIds} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function CarteRecherche({ r, acteIds }: { r: Recherche; acteIds: string[] }) {
  const { valeurs, modifier } = useAutoSave(
    { titre: r.titre, description: r.description ?? "" },
    (p, version) => majRecherche(r.id, { ...p, ...(p.description !== undefined && { description: p.description || null }) }, version),
    { version: r.modifieLe },
  );
  const [modal, setModal] = useState<{ consultation: ConsultationDetaillee | null } | null>(null);
  const statut = STATUTS_RECHERCHE.find((s) => s.value === r.statut);
  const close = r.statut === "trouve" || r.statut === "abandonne";
  const [ouverte, setOuverte] = useMemoire(cleOuverte(r.id), false);

  // Repliée : une ligne résumant la recherche ; un clic la déplie.
  if (!ouverte) {
    const derniere = r.consultations.at(-1);
    return (
      <UnstyledButton
        onClick={() => setOuverte(true)}
        p="xs"
        style={{ borderRadius: 8, border: "1px solid var(--mantine-color-gray-3)", background: close ? "var(--mantine-color-gray-0)" : undefined }}
      >
        <Group gap="xs" wrap="nowrap">
          <IconChevronRight size={16} color="var(--mantine-color-gray-6)" />
          <Badge size="sm" variant="light" color={statut?.couleur ?? "gray"} miw={90}>
            {statut?.label ?? r.statut}
          </Badge>
          <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
            {r.titre}
          </Text>
          {derniere && (
            <Badge size="xs" variant="dot" color={infoResultat(derniere.resultat).couleur}>
              {infoResultat(derniere.resultat).label}
            </Badge>
          )}
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {r.consultations.length ? `${r.consultations.length} consultation${r.consultations.length > 1 ? "s" : ""}` : "aucune consultation"}
          </Text>
        </Group>
      </UnstyledButton>
    );
  }

  return (
    <Paper p="sm" radius="md" bg={close ? "gray.0" : undefined} style={{ border: "1px solid var(--mantine-color-gray-3)" }}>
      <Lecture>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <ActionIcon variant="subtle" color="gray" size="sm" mt={4} onClick={() => setOuverte(false)} title="Replier">
          <IconChevronDown size={16} />
        </ActionIcon>
        <Select
          w={130}
          size="xs"
          data={STATUTS_RECHERCHE}
          value={r.statut}
          onChange={(s) => s && ecrire(() => majRecherche(r.id, { statut: s }))}
          allowDeselect={false}
          styles={{ input: { color: `var(--mantine-color-${statut?.couleur ?? "gray"}-7)`, fontWeight: 600 } }}
        />
        <TextInput
          flex={1}
          size="sm"
          variant="unstyled"
          styles={{ input: { fontWeight: 600 } }}
          value={valeurs.titre}
          onChange={(e) => modifier({ titre: e.currentTarget.value })}
        />
        <Menu position="bottom-end">
          <Menu.Target>
            <ActionIcon display={LECTURE_SEULE ? "none" : undefined} variant="subtle" size="sm">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() =>
                modals.openConfirmModal({
                  title: "Supprimer cette recherche et ses consultations ?",
                  labels: { confirm: "Supprimer", cancel: "Annuler" },
                  confirmProps: { color: "red" },
                  onConfirm: () => ecrire(() => supprimerRecherche(r.id)),
                })
              }
            >
              Supprimer la recherche
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Textarea
        mt={4}
        size="xs"
        autosize
        minRows={1}
        placeholder="Raisonnement, zone et période : ex. 34 ans à la naissance de sa fille en 1911 → née vers 1877 ; chercher autour d'Allonne"
        value={valeurs.description}
        onChange={(e) => modifier({ description: e.currentTarget.value })}
      />
      </Lecture>

      {r.consultations.length > 0 && (
        <Timeline mt="sm" bulletSize={14} lineWidth={2}>
          {r.consultations.map((c) => {
            const res = infoResultat(c.resultat);
            return (
              <Timeline.Item
                key={c.id}
                color={res.couleur}
                title={
                  <Group gap={6} wrap="nowrap">
                    <Anchor size="sm" fw={500} onClick={() => setModal({ consultation: c })}>
                      {c.sourceTitre ?? "Source non précisée"}
                    </Anchor>
                    {(c.permalien || c.sourceUrl) && (
                      <Tooltip label={c.permalien ? "Ouvrir la vue consultée (permalien)" : "Ouvrir la source en ligne"}>
                        <ActionIcon variant="subtle" size="xs" onClick={() => openUrl((c.permalien || c.sourceUrl)!)}>
                          <IconExternalLink size={12} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    <Badge size="xs" color={res.couleur} variant="light">
                      {res.label}
                    </Badge>
                  </Group>
                }
              >
                <Text size="xs" c="dimmed">
                  {[dateFr(c.date), c.sourceType, c.sourceLieuNom, c.sourcePeriode, c.sourceCote && `cote ${c.sourceCote}`, c.vues && `vue ${c.vues}`, c.sourceArchives]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {c.notes && (
                  <Text size="xs" mt={2} style={{ whiteSpace: "pre-wrap" }}>
                    {c.notes}
                  </Text>
                )}
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}

      <Group mt="sm" gap="xs" align="flex-end">
        <Button display={LECTURE_SEULE ? "none" : undefined} size="compact-xs" variant="light" leftSection={<IconPlus size={12} />} onClick={() => setModal({ consultation: null })}>
          Consultation
        </Button>
        {r.statut === "trouve" && (
          <div style={{ flex: 1 }}>
            <Lecture>
            <ActeSelect
              label="Acte trouvé"
              value={r.acteId}
              onChange={(acteId) => ecrire(() => majRecherche(r.id, { acteId }))}
              prioritaires={acteIds}
            />
            </Lecture>
          </div>
        )}
      </Group>

      <ModalConsultation
        opened={!!modal}
        onClose={() => setModal(null)}
        tacheId={r.id}
        consultation={modal?.consultation}
        deja={r.consultations}
      />
    </Paper>
  );
}
