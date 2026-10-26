import {
  Accordion, ActionIcon, Anchor, Autocomplete, Button, Divider, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Textarea,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconArrowLeft, IconCalendarDown, IconMapPinDown, IconMarquee2, IconTrash, IconUserPlus } from "@tabler/icons-react";
import type { Acte, Annotation, Releve } from "../../db/schema";
import { creerIndividuDepuisReleve, majReleve, rattacher, supprimerReleve, type ReleveActe } from "../../data/releves";
import { majAnnotation, supprimerAnnotation } from "../../data/actes";
import { DateFloueInput, patchDate } from "../../components/DateFloueInput";
import { IndividuSelect, useLieux } from "../../components/selects";
import { AnchorLink } from "../../components/AnchorLink";
import { useAutoSave } from "../../hooks/useAutoSave";
import { analyserDate, naissanceDepuisAge } from "../../lib/dates";
import { CONFIANCES, rolesPour, SEXES, SIGNATURES } from "../../lib/libelles";
import { SectionMilitaire } from "./SectionMilitaire";
import { ecrire } from "../../lib/query";
import { texteAutoReleve } from "./bulles";
import { CandidatsRattachement } from "../../components/CandidatsRattachement";
import { LigneIndex } from "./LigneIndex";
import { LECTURE_SEULE } from "../../lib/mode";
import { EnEdition, Lecture } from "../../components/Lecture";

type Props = {
  releve: ReleveActe;
  acte: Acte;
  /** Zone de ce relevé sur la page affichée, s'il y en a une. */
  zone: Annotation | undefined;
  onRetour: () => void;
  onTracerZone: () => void;
  /** Tous les relevés de l'acte (pour les suggestions de rattachement). */
  autres: ReleveActe[];
};

/** Une naissance calculée depuis l'âge (« vers 1826 (71 ans…) ») peut être recalculée sans perte. */
const estCalculee = (n: string | null) => !n || /^vers \d+ \(.+\)$/.test(n);

type Evenement = "naissance" | "mariage" | "deces";
/** Événement principal d'un acte selon son type. */
const EVENEMENT_ACTE: Record<string, Evenement> = { naissance: "naissance", bapteme: "naissance", mariage: "mariage", deces: "deces", sepulture: "deces" };
/** Personnes que l'événement concerne directement. */
const ROLES_EVENEMENT: Record<Evenement, string[]> = { naissance: ["enfant"], mariage: ["époux", "épouse"], deces: ["défunt"] };
const LIBELLES_EVENEMENT = {
  naissance: { date: "Naissance", lieu: "Lieu de naissance", champLieu: "naissanceLieu" },
  mariage: { date: "Mariage", lieu: "Lieu du mariage", champLieu: "mariageLieu" },
  deces: { date: "Décès", lieu: "Lieu du décès", champLieu: "decesLieu" },
} as const;

export function FormReleve({ releve, acte, zone, onRetour, onTracerZone, autres }: Props) {
  const { valeurs: v, modifier, vider } = useAutoSave<Releve>(releve, (patch, version) => majReleve(releve.id, patch, version), {
    version: releve.modifieLe,
  });
  const t = (champ: keyof Releve) => ({
    value: (v[champ] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      modifier({ [champ]: e.currentTarget.value || null } as Partial<Releve>),
  });

  // Commune de l'acte, à recopier d'un clic dans les lieux du relevé.
  const { data: lieux = [] } = useLieux();
  const communeActe = lieux.find((l) => l.id === acte.lieuId)?.nom ?? null;
  const lieu = (champ: "naissanceLieu" | "mariageLieu" | "decesLieu") => ({
    ...t(champ),
    rightSection:
      communeActe && !LECTURE_SEULE && v[champ] !== communeActe ? (
        <ActionIcon variant="subtle" size="sm" title={`Recopier la commune de l'acte : ${communeActe}`} onClick={() => modifier({ [champ]: communeActe })}>
          <IconMapPinDown size={16} />
        </ActionIcon>
      ) : undefined,
  });

  // Date de l'acte, à recopier d'un clic dans les dates du relevé.
  const champDate = (champ: Evenement, label: string) => (
    <DateFloueInput
      label={label}
      value={v[champ]}
      onChange={(d) => modifier(patchDate(champ, d))}
      rightSection={
        acte.date && !LECTURE_SEULE && v[champ] !== acte.date ? (
          <ActionIcon
            variant="subtle"
            size="sm"
            title={`Recopier la date de l'acte : ${acte.date}`}
            onClick={() => modifier(patchDate(champ, { saisie: acte.date, min: acte.dateMin, max: acte.dateMax }))}
          >
            <IconCalendarDown size={16} />
          </ActionIcon>
        ) : undefined
      }
    />
  );

  // L'événement de l'acte passe en premier pour la personne qu'il concerne (le défunt d'un acte de décès,
  // les époux d'un mariage) ; les autres dates vont dans les mentions.
  const evenement = acte.nature === "index" ? undefined : EVENEMENT_ACTE[acte.type ?? ""];
  const role = (v.role ?? "").trim().toLowerCase();
  const enAvant: Evenement = evenement && (!role || ROLES_EVENEMENT[evenement].includes(role)) ? evenement : "naissance";
  const mentions = (["naissance", "mariage", "deces"] as const).filter((e) => e !== enAvant);

  const blocEvenement = (e: Evenement) => (
    <Stack key={e} gap="xs">
      {champDate(e, LIBELLES_EVENEMENT[e].date)}
      {e === "naissance" && !v.naissance && v.age && (
        <Button size="compact-xs" variant="subtle" onClick={() => changerAge(v.age ?? "")} disabled={!analyserDate(acte.date)}>
          {analyserDate(acte.date) ? "Calculer la naissance depuis l'âge" : "Renseignez la date de l'acte pour calculer la naissance"}
        </Button>
      )}
      <TextInput label={LIBELLES_EVENEMENT[e].lieu} {...lieu(LIBELLES_EVENEMENT[e].champLieu)} />
    </Stack>
  );

  const changerAge = (age: string) => {
    const patch: Partial<Releve> = { age: age || null };
    if (estCalculee(v.naissance)) {
      const n = naissanceDepuisAge(age, analyserDate(acte.date), acte.date);
      Object.assign(patch, n ? { naissance: n.saisie, naissanceMin: n.min, naissanceMax: n.max } : { naissance: null, naissanceMin: null, naissanceMax: null });
    }
    modifier(patch);
  };

  const zoneTexte = useAutoSave({ texteBulle: zone?.texteBulle ?? "" }, (p) =>
    zone ? majAnnotation(zone.id, { texteBulle: p.texteBulle || null }) : Promise.resolve(),
  );

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Anchor component="button" size="sm" onClick={onRetour}>
          <Group gap={4}>
            <IconArrowLeft size={14} /> Tous les relevés
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
              title: "Supprimer ce relevé ?",
              children: <Text size="sm">Le relevé et sa zone sur l'image seront supprimés.</Text>,
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

      <Lecture>
      <Stack gap="sm">
      <Autocomplete
        label={acte.nature === "index" ? "Rôle (événement de la ligne)" : "Rôle dans l'acte"}
        data={rolesPour(acte.nature, acte.type)}
        value={v.role ?? ""}
        onChange={(x) => modifier({ role: x || null })}
      />
      {acte.nature === "index" && <LigneIndex releve={releve} v={v} modifier={modifier} acte={acte} />}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <TextInput label="Nom (tel qu'écrit)" {...t("nomEcrit")} />
        <TextInput label="Prénoms (tels qu'écrits)" {...t("prenomsEcrits")} />
        <TextInput label="Nom normalisé" placeholder={v.nomEcrit ?? ""} {...t("nom")} />
        <TextInput label="Prénoms normalisés" placeholder={v.prenomsEcrits ?? ""} {...t("prenoms")} />
      </SimpleGrid>

      <Group grow align="flex-start">
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Sexe
          </Text>
          <SegmentedControl size="xs" data={SEXES} value={v.sexe ?? "?"} onChange={(x) => modifier({ sexe: x })} />
        </Stack>
        <TextInput label="Âge déclaré" placeholder="71 ans" value={v.age ?? ""} onChange={(e) => changerAge(e.currentTarget.value)} />
      </Group>

      {blocEvenement(enAvant)}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <TextInput label="Profession" {...t("profession")} />
        <TextInput label="Domicile" {...t("domicile")} />
        <TextInput label="Origine" {...t("origine")} />
        <Select label="Signature" data={SIGNATURES} value={v.signature} onChange={(x) => modifier({ signature: x })} clearable />
      </SimpleGrid>

      <Textarea
        label="Relations mentionnées"
        placeholder="grand-père de l'enfant, veuve de feu Jacques…"
        autosize
        minRows={1}
        {...t("relations")}
      />

      <Accordion
        key={`${releve.id}-${enAvant}`}
        variant="contained"
        chevronPosition="left"
        defaultValue={mentions.some((e) => v[e] || v[LIBELLES_EVENEMENT[e].champLieu]) ? "mentions" : null}
      >
        <Accordion.Item value="mentions">
          <Accordion.Control>
            <Text size="sm">Mentions ({mentions.map((e) => LIBELLES_EVENEMENT[e].date.toLowerCase()).join(", ")}…)</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">{mentions.map((e) => blocEvenement(e))}</Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {acte.type === "matricule" && <SectionMilitaire militaire={v.militaire} onChange={(m) => modifier({ militaire: m })} />}

      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Confiance
        </Text>
        <SegmentedControl size="xs" data={CONFIANCES} value={v.confiance ?? ""} onChange={(x) => modifier({ confiance: x })} />
      </Stack>
      <Textarea label="Notes" autosize minRows={2} {...t("notes")} />
      </Stack>
      </Lecture>

      <Divider label="Individu de l'arbre" labelPosition="left" />
      <Lecture>
        <IndividuSelect
          value={releve.individuId}
          onChange={(id) => ecrire(() => rattacher(releve.id, id))}
          description={releve.individuId ? undefined : "Relevé non rattaché"}
        />
      </Lecture>
      {!releve.individuId && (
        <CandidatsRattachement
          releve={{ ...v, id: releve.id }}
          // Sur un index, ni la date de la table ni les lignes voisines ne disent rien de la personne.
          contexte={acte.nature === "index" ? { dateMin: null, dateMax: null, autres: [] } : { dateMin: acte.dateMin, dateMax: acte.dateMax, autres }}
        />
      )}
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
            onClick={async () => {
              await vider();
              await ecrire(() => creerIndividuDepuisReleve(v));
            }}
          >
            Créer l'individu depuis ce relevé
          </Button>
        )}
      </Group>

      <EnEdition>
      <Divider label="Zone sur l'image" labelPosition="left" />
      {zone ? (
        <Stack gap="xs">
          <Text size="xs" c="dimmed">
            {zone.rectangles.length} rectangle{zone.rectangles.length > 1 ? "s" : ""} · Maj+tracé pour en ajouter
          </Text>
          <Textarea
            label="Texte de la bulle"
            description="Laisser vide pour le texte automatique"
            placeholder={texteAutoReleve(v)}
            autosize
            minRows={2}
            value={zoneTexte.valeurs.texteBulle}
            onChange={(e) => zoneTexte.modifier({ texteBulle: e.currentTarget.value })}
          />
          <Button size="xs" variant="subtle" color="red" onClick={() => ecrire(() => supprimerAnnotation(zone.id))}>
            Supprimer la zone (garder le relevé)
          </Button>
        </Stack>
      ) : (
        <Button size="xs" variant="light" leftSection={<IconMarquee2 size={14} />} onClick={onTracerZone}>
          Tracer sa zone sur cette page
        </Button>
      )}
      </EnEdition>
    </Stack>
  );
}

type NoteProps = { annotation: Annotation; onRetour: () => void };

export function FormNote({ annotation, onRetour }: NoteProps) {
  const { valeurs, modifier } = useAutoSave({ note: annotation.note ?? "" }, (p) => majAnnotation(annotation.id, p));
  return (
    <Stack gap="sm">
      <Anchor component="button" size="sm" onClick={onRetour}>
        <Group gap={4}>
          <IconArrowLeft size={14} /> Tous les relevés
        </Group>
      </Anchor>
      <Lecture>
      <Textarea
        label="Note"
        placeholder="illisible, à revoir, mention marginale…"
        autosize
        minRows={3}
        data-autofocus
        value={valeurs.note}
        onChange={(e) => modifier({ note: e.currentTarget.value })}
      />
      </Lecture>
      <Button
        display={LECTURE_SEULE ? "none" : undefined}
        size="xs"
        variant="subtle"
        color="red"
        leftSection={<IconTrash size={14} />}
        onClick={async () => {
          await ecrire(() => supprimerAnnotation(annotation.id));
          onRetour();
        }}
      >
        Supprimer la note
      </Button>
    </Stack>
  );
}
