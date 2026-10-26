import { useState } from "react";
import {
  Accordion, ActionIcon, Box, Badge, Button, Center, Drawer, Group, Loader, SegmentedControl, Stack, Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { IconArrowLeft, IconBinaryTree2, IconMap2, IconPencil } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Individu } from "../../db/schema";
import { chargerIndividu, majIndividu, type IndividuComplet } from "../../data/individus";
import { relevesIndividu } from "../../data/releves";
import { AnchorLink } from "../../components/AnchorLink";
import { DateFloueInput, patchDate } from "../../components/DateFloueInput";
import { IconesActes } from "../../components/IconesActes";
import { ParcoursVie } from "../../components/ParcoursVie";
import { PhotosPersonne } from "../../components/PhotosPersonne";
import { Portrait } from "../../components/Portrait";
import { LieuSelect, useLieux } from "../../components/selects";
import { Trace } from "../../components/Trace";
import { useAutoSave } from "../../hooks/useAutoSave";
import { couleurRole, nomComplet, SEXES } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { retour } from "../../lib/onglets";
import { anneeFloue } from "../arbre/disposition";
import { JournalRecherches } from "../JournalRecherches";
import { DoutesFiche } from "../../components/Doutes";
import { SourcesFiche } from "../../components/Citations";
import { domicilesMilitaires, relevesMilitaires, ServiceMilitaire } from "../../components/ServiceMilitaire";

type Proche = { id: string; nom: string | null; prenoms: string | null; naissanceMin?: string | null; naissanceMax?: string | null; decesMin?: string | null; decesMax?: string | null };

/** Lien tactile vers une autre fiche, avec les années. */
function LienPersonne({ p, precision }: { p: Proche; precision?: string | null }) {
  const n = anneeFloue(p.naissanceMin ?? null, p.naissanceMax ?? null);
  const d = anneeFloue(p.decesMin ?? null, p.decesMax ?? null);
  return (
    <AnchorLink to="/individus/$individuId" params={{ individuId: p.id }} py={6} display="block">
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={500} truncate>
          {nomComplet(p)}
        </Text>
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {[n || d ? `${n || "?"} – ${d}` : null, precision].filter(Boolean).join(" · ")}
        </Text>
      </Group>
    </AnchorLink>
  );
}

/** Petites corrections depuis le téléphone : les champs simples, enregistrés au fil de la saisie (avec détection de conflit). */
function FormRapide({ ind }: { ind: IndividuComplet }) {
  const { valeurs: v, modifier } = useAutoSave<Individu>(ind, (patch, version) => majIndividu(ind.id, patch, version), { version: ind.modifieLe });
  const t = (champ: "nom" | "prenoms" | "profession" | "notes") => ({
    value: v[champ] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => modifier({ [champ]: e.currentTarget.value || null }),
  });
  return (
    <Stack gap="sm">
      <TextInput label="Nom" {...t("nom")} />
      <TextInput label="Prénoms" {...t("prenoms")} />
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Sexe
        </Text>
        <SegmentedControl data={SEXES} value={v.sexe ?? "?"} onChange={(x) => modifier({ sexe: x })} />
      </Stack>
      <DateFloueInput label="Naissance" value={v.naissance} onChange={(d) => modifier(patchDate("naissance", d))} />
      <LieuSelect label="Lieu de naissance" value={v.naissanceLieuId} onChange={(id) => modifier({ naissanceLieuId: id })} />
      <DateFloueInput label="Décès" value={v.deces} onChange={(d) => modifier(patchDate("deces", d))} />
      <LieuSelect label="Lieu de décès" value={v.decesLieuId} onChange={(id) => modifier({ decesLieuId: id })} />
      <TextInput label="Profession(s)" {...t("profession")} />
      <Textarea label="Notes" autosize minRows={3} {...t("notes")} />
      <Text size="xs" c="dimmed">
        Enregistré automatiquement. Les actes, filiations et unions se modifient sur ordinateur ou tablette.
      </Text>
    </Stack>
  );
}

/** Fiche individu sur téléphone : une colonne, des sections repliables. */
export function FicheMobile({ individuId }: { individuId: string }) {
  const { data: ind, isLoading } = useQuery({ queryKey: ["individu", individuId], queryFn: () => chargerIndividu(individuId) });
  const { data: releves = [] } = useQuery({ queryKey: ["releves-individu", individuId], queryFn: () => relevesIndividu(individuId) });
  const { data: lieux = [] } = useLieux();
  const [edition, setEdition] = useState(false);
  const navigate = useNavigate();

  if (isLoading) return <Center h="100%"><Loader /></Center>;
  if (!ind) return <Center h="100%"><Text>Individu introuvable.</Text></Center>;

  const commune = (id: string | null) => lieux.find((l) => l.id === id)?.nom;
  const naissance = [ind.naissance, commune(ind.naissanceLieuId)].filter(Boolean).join(" · ");
  const deces = [ind.deces, commune(ind.decesLieuId)].filter(Boolean).join(" · ");
  const acteIds = [...new Set(releves.map((r) => r.acteId))];

  return (
    <Stack gap={0} h="100%" style={{ overflowY: "auto" }}>
      <Stack gap="xs" p="md" pb="sm">
        <Group justify="space-between" wrap="nowrap">
          <ActionIcon variant="subtle" onClick={() => retour("/individus")} aria-label="Retour">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Group gap="xs">
            <ActionIcon variant="light" size="lg" onClick={() => navigate({ to: "/arbre", search: { racine: ind.id } })} aria-label="Voir dans l'arbre">
              <IconBinaryTree2 size={18} />
            </ActionIcon>
            <ActionIcon variant="light" size="lg" onClick={() => navigate({ to: "/cartographie", search: { racine: ind.id } })} aria-label="Cartographie">
              <IconMap2 size={18} />
            </ActionIcon>
            {!LECTURE_SEULE && (
              <Button size="xs" leftSection={<IconPencil size={14} />} onClick={() => setEdition(true)}>
                Modifier
              </Button>
            )}
          </Group>
        </Group>
        <Group wrap="nowrap" align="center">
          <Portrait portrait={ind.portrait} taille={64} nom={ind.nom} prenoms={ind.prenoms} sexe={ind.sexe} />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Title order={3} lh={1.2}>
              {nomComplet(ind)}
            </Title>
            {ind.profession && (
              <Text size="sm" c="dimmed">
                {ind.profession}
              </Text>
            )}
            <IconesActes acteNaissanceId={ind.acteNaissanceId} acteMariage={ind.couples.some((c) => c.acteId)} acteDecesId={ind.acteDecesId} sansUnion={ind.sansUnion} />
          </Stack>
        </Group>
        {naissance && <Text size="sm">° {naissance}</Text>}
        {deces && <Text size="sm">† {deces}</Text>}
        <Trace creePar={ind.creePar} modifiePar={ind.modifiePar} modifieLe={ind.modifieLe} />
      </Stack>

      <Box px="sm" pb="sm">
        <DoutesFiche individuId={ind.id} />
      </Box>

      <Accordion multiple defaultValue={["famille"]} variant="separated" px="sm" pb="md" chevronPosition="right">
        <Accordion.Item value="famille">
          <Accordion.Control>Famille</Accordion.Control>
          <Accordion.Panel>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Parents
            </Text>
            {ind.pere ? <LienPersonne p={ind.pere} precision="père" /> : <Text size="sm" c="dimmed" py={6}>{ind.pereInconnu ? "Père inconnu" : "Père non renseigné"}</Text>}
            {ind.mere ? <LienPersonne p={ind.mere} precision="mère" /> : <Text size="sm" c="dimmed" py={6}>{ind.mereInconnue ? "Mère inconnue" : "Mère non renseignée"}</Text>}
            {ind.couples.length > 0 && (
              <>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="sm">
                  {ind.couples.length > 1 ? "Unions" : "Union"}
                </Text>
                {ind.couples.map((c) =>
                  c.conjointId ? (
                    <LienPersonne
                      key={c.id}
                      p={{ id: c.conjointId, nom: c.conjointNom, prenoms: c.conjointPrenoms }}
                      precision={[c.date && `∞ ${c.date}`, c.lieuNom].filter(Boolean).join(" ") || null}
                    />
                  ) : null,
                )}
              </>
            )}
            {ind.sansUnion && ind.couples.length === 0 && (
              <Text size="sm" c="dimmed" mt="sm">
                Aucune union
              </Text>
            )}
            {ind.enfants.length > 0 && (
              <>
                <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="sm">
                  Enfants ({ind.enfants.length})
                </Text>
                {ind.enfants.map((e) => (
                  <LienPersonne key={e.id} p={e} />
                ))}
              </>
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="photos">
          <Accordion.Control>Photos</Accordion.Control>
          <Accordion.Panel>
            <PhotosPersonne ind={ind} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="parcours">
          <Accordion.Control>Parcours de vie</Accordion.Control>
          <Accordion.Panel>
            <ParcoursVie personne={{ ...ind, domiciles: domicilesMilitaires(releves) }} />
          </Accordion.Panel>
        </Accordion.Item>

        {relevesMilitaires(releves).length > 0 && (
          <Accordion.Item value="militaire">
            <Accordion.Control>Service militaire</Accordion.Control>
            <Accordion.Panel>
              <ServiceMilitaire releves={releves} nom={ind.nom} prenoms={ind.prenoms} />
            </Accordion.Panel>
          </Accordion.Item>
        )}

        <Accordion.Item value="releves">
          <Accordion.Control>
            Documents{" "}
            <Badge size="sm" variant="light" ml={4}>
              {releves.length}
            </Badge>
          </Accordion.Control>
          <Accordion.Panel>
            {releves.length === 0 && (
              <Text size="sm" c="dimmed">
                Aucun document rattaché.
              </Text>
            )}
            {releves.map((r) => (
              <AnchorLink key={r.id} to="/actes/$acteId" params={{ acteId: r.acteId }} search={{ releve: r.id }} display="block" py={6}>
                <Group gap={6} wrap="nowrap" align="flex-start">
                  <Badge size="xs" variant="light" color={couleurRole(r.role)} miw={60} mt={3}>
                    {r.role ?? "?"}
                  </Badge>
                  <Text size="sm" style={{ flex: 1, minWidth: 0 }} lineClamp={2}>
                    {r.acteTitre}
                    {r.acteDate && (
                      <Text span size="xs" c="dimmed">
                        {" "}
                        · {r.acteDate}
                      </Text>
                    )}
                  </Text>
                </Group>
              </AnchorLink>
            ))}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="sources">
          <Accordion.Control>Sources</Accordion.Control>
          <Accordion.Panel>
            <SourcesFiche ind={ind} acteIds={acteIds} roles={new Map(releves.map((r) => [r.acteId, r.role]))} />
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="recherches">
          <Accordion.Control>Recherches</Accordion.Control>
          <Accordion.Panel>
            <JournalRecherches ind={ind} acteIds={acteIds} />
          </Accordion.Panel>
        </Accordion.Item>

        {ind.notes && (
          <Accordion.Item value="notes">
            <Accordion.Control>Notes</Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {ind.notes}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>

      <Drawer opened={edition} onClose={() => setEdition(false)} position="bottom" size="100%" title={`Modifier — ${nomComplet(ind)}`}>
        {edition && <FormRapide key={ind.id} ind={ind} />}
      </Drawer>
    </Stack>
  );
}
