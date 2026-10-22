import { Anchor, Button, Divider, Group, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArrowLeft, IconMarquee2, IconTrash, IconUserCircle, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { chargerIndividu, majIndividu } from "../../data/individus";
import type { Annotation, Releve } from "../../db/schema";
import { creerIndividuDepuisReleve, majReleve, rattacher, supprimerReleve, type ReleveActe } from "../../data/releves";
import { majAnnotation, supprimerAnnotation } from "../../data/actes";
import { IndividuSelect } from "../../components/selects";
import { AnchorLink } from "../../components/AnchorLink";
import { EnEdition, Lecture } from "../../components/Lecture";
import { useAutoSave } from "../../hooks/useAutoSave";
import { CONFIANCES, SEXES } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { ecrire } from "../../lib/query";
import { texteAutoReleve } from "./bulles";

type Props = {
  releve: ReleveActe;
  zone: Annotation | undefined;
  onRetour: () => void;
  onTracerZone: () => void;
};

/** La zone de cette personne devient le portrait de sa fiche (vignette sur la fiche, la liste, l'arbre). */
function BoutonPortrait({ individuId, annotationId }: { individuId: string; annotationId: string }) {
  const { data: ind } = useQuery({ queryKey: ["individu", individuId], queryFn: () => chargerIndividu(individuId) });
  const actuel = ind?.portraitAnnotationId === annotationId;
  return (
    <Button
      size="xs"
      variant={actuel ? "filled" : "light"}
      leftSection={<IconUserCircle size={14} />}
      onClick={() => ecrire(() => majIndividu(individuId, { portraitAnnotationId: actuel ? null : annotationId }))}
    >
      {actuel ? "Portrait de la fiche ✓" : "Utiliser comme portrait"}
    </Button>
  );
}

/**
 * Une personne sur une photo : rattachée à un individu, ou « inconnue à identifier »
 * (nom provisoire, note). Pas de rôle, de signature ni de lieux : ce n'est pas un acte.
 */
export function FormIdentification({ releve, zone, onRetour, onTracerZone }: Props) {
  const { valeurs: v, modifier, vider } = useAutoSave<Releve>(releve, (patch, version) => majReleve(releve.id, patch, version), {
    version: releve.modifieLe,
  });
  const t = (champ: keyof Releve) => ({
    value: (v[champ] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      modifier({ [champ]: e.currentTarget.value || null } as Partial<Releve>),
  });
  const zoneTexte = useAutoSave({ texteBulle: zone?.texteBulle ?? "" }, (p) =>
    zone ? majAnnotation(zone.id, { texteBulle: p.texteBulle || null }) : Promise.resolve(),
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Anchor component="button" size="sm" onClick={onRetour}>
          <Group gap={4}>
            <IconArrowLeft size={14} /> Toutes les personnes
          </Group>
        </Anchor>
        <Button
          display={LECTURE_SEULE ? "none" : undefined}
          size="compact-xs"
          color="red"
          variant="subtle"
          leftSection={<IconTrash size={14} />}
          onClick={() =>
            modals.openConfirmModal({
              title: "Retirer cette personne de la photo ?",
              children: <Text size="sm">L'identification et sa zone sur la photo seront supprimées.</Text>,
              labels: { confirm: "Supprimer", cancel: "Annuler" },
              confirmProps: { color: "red" },
              onConfirm: async () => {
                await ecrire(() => supprimerReleve(releve.id));
                onRetour();
              },
            })
          }
        >
          Supprimer
        </Button>
      </Group>

      <Divider label="Qui est-ce ?" labelPosition="left" />
      <Lecture>
        <IndividuSelect
          value={releve.individuId}
          onChange={(id) => ecrire(() => rattacher(releve.id, id))}
          description={releve.individuId ? undefined : "Personne non identifiée : laissez vide et décrivez-la ci-dessous"}
        />
      </Lecture>
      <Group>
        {releve.individuId ? (
          <AnchorLink to="/individus/$individuId" params={{ individuId: releve.individuId }} size="sm">
            Ouvrir la fiche
          </AnchorLink>
        ) : LECTURE_SEULE ? null : (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconUserPlus size={14} />}
            disabled={!v.nom && !v.prenoms}
            onClick={async () => {
              await vider();
              await ecrire(() => creerIndividuDepuisReleve(v));
            }}
          >
            Créer l'individu
          </Button>
        )}
        {releve.individuId && zone && !LECTURE_SEULE && <BoutonPortrait individuId={releve.individuId} annotationId={zone.id} />}
      </Group>

      <Lecture>
        <Stack gap="sm">
          {!releve.individuId && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <TextInput label="Nom (provisoire)" {...t("nom")} />
              <TextInput label="Prénoms (provisoires)" {...t("prenoms")} />
            </SimpleGrid>
          )}
          <Group gap="md" align="flex-end">
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Certitude
              </Text>
              <SegmentedControl size="xs" data={CONFIANCES} value={v.confiance ?? ""} onChange={(x) => modifier({ confiance: x })} />
            </Stack>
            {!releve.individuId && (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Sexe
                </Text>
                <SegmentedControl size="xs" data={SEXES} value={v.sexe ?? "?"} onChange={(x) => modifier({ sexe: x })} />
              </Stack>
            )}
          </Group>
          <TextInput label="Âge apparent" placeholder="≈ 30 ans, enfant, vieillard…" {...t("age")} />
          <Textarea
            label="Note"
            placeholder="2e rang à gauche, moustache, en uniforme… ; indices pour identifier ou dater"
            autosize
            minRows={2}
            {...t("notes")}
          />
        </Stack>
      </Lecture>

      <EnEdition>
        <Divider label="Zone sur la photo" labelPosition="left" />
        {zone ? (
          <Stack gap="xs">
            <Textarea
              label="Texte de l'étiquette"
              description="Laisser vide pour le texte automatique"
              placeholder={texteAutoReleve({ ...v, individuNom: releve.individuNom, individuPrenoms: releve.individuPrenoms })}
              autosize
              minRows={1}
              value={zoneTexte.valeurs.texteBulle}
              onChange={(e) => zoneTexte.modifier({ texteBulle: e.currentTarget.value })}
            />
            <Button size="xs" variant="subtle" color="red" onClick={() => ecrire(() => supprimerAnnotation(zone.id))}>
              Supprimer la zone (garder la personne)
            </Button>
          </Stack>
        ) : (
          <Button size="xs" variant="light" leftSection={<IconMarquee2 size={14} />} onClick={onTracerZone}>
            Entourer la personne sur la photo
          </Button>
        )}
      </EnEdition>
    </Stack>
  );
}
