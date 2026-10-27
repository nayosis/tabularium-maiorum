import {
  ActionIcon, Button, Center, Checkbox, Divider, Group, Loader, Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Table,
  Text, TextInput, Textarea, Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { useEffect, useState } from "react";
import { IconArrowLeft, IconArrowMerge, IconBinaryTree2, IconUsers, IconHeartPlus, IconMap2, IconTrash, IconUnlink, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ficheIndividuRoute } from "../router";
import type { Individu } from "../db/schema";
import {
  changerParent, chargerIndividu, creerCouple, creerIndividu, majCouple, majFiliation, majIndividu, supprimerCouple,
  supprimerIndividu, type IndividuComplet, type IndividuListe,
} from "../data/individus";
import { rattacher, relevesDesActes, relevesIndividu, type ReleveAvecActe } from "../data/releves";
import { DateFloueInput, patchDate } from "../components/DateFloueInput";
import { IndividuSelect, LieuSelect, useLieux, useNoms } from "../components/selects";
import { IconesActes } from "../components/IconesActes";
import { AnchorLink } from "../components/AnchorLink";
import { useAutoSave } from "../hooks/useAutoSave";
import { SEXES, SIGNATURES, TYPES_FILIATION, libelle, nomComplet } from "../lib/libelles";
import { ecrire } from "../lib/query";
import { ModalFusion } from "./ModalFusion";
import { DoutesFiche, ModalNouveauDoute } from "../components/Doutes";
import { SyntheseReleves } from "./SyntheseReleves";
import { JournalRecherches } from "./JournalRecherches";
import { ParcoursVie } from "../components/ParcoursVie";
import { PhotosPersonne } from "../components/PhotosPersonne";
import { Portrait } from "../components/Portrait";
import { LECTURE_SEULE } from "../lib/mode";
import { Lecture } from "../components/Lecture";
import { suggestionsFamille, type Suggestion } from "../lib/suggestions";
import {
  ActeSelect, LigneSuggestion, appliquerActeFiliation, appliquerActeUnion, appliquerParent, appliquerUnion, nomDuReleve, origine,
} from "./liensActes";
import { retour } from "../lib/onglets";
import { useDefilement } from "../lib/onglets";
import { Trace } from "../components/Trace";
import { useEcran } from "../lib/ecran";
import { ajouterRecent } from "../lib/recents";
import { FicheMobile } from "./mobile/FicheMobile";
import { SourcesFiche } from "../components/Citations";
import { domicilesMilitaires, ServiceMilitaire } from "../components/ServiceMilitaire";

/** Fiche individu : complète sur ordinateur et tablette, en sections repliables sur téléphone. */
export function FicheIndividu() {
  const { individuId } = ficheIndividuRoute.useParams();
  const { telephone } = useEcran();
  useEffect(() => ajouterRecent(individuId), [individuId]);
  return telephone ? <FicheMobile individuId={individuId} /> : <FicheComplete />;
}

function FicheComplete() {
  const { individuId } = ficheIndividuRoute.useParams();
  const navigate = useNavigate();
  const { data: ind, isLoading } = useQuery({ queryKey: ["individu", individuId], queryFn: () => chargerIndividu(individuId) });
  const { data: releves = [] } = useQuery({ queryKey: ["releves-individu", individuId], queryFn: () => relevesIndividu(individuId) });
  // Les autres personnes citées dans les mêmes actes : source des suggestions père / mère / union.
  const acteIds = [...new Set(releves.map((r) => r.acteId))];
  const { data: relevesActes = [] } = useQuery({
    queryKey: ["releves-actes", individuId, acteIds.join(",")],
    queryFn: () => relevesDesActes(acteIds),
  });
  const [fusion, setFusion] = useState(false);
  const [nouveauDoute, setNouveauDoute] = useState(false);
  // Après une fusion, le formulaire est réinitialisé avec les valeurs retenues.
  const [version, setVersion] = useState(0);
  const defilement = useDefilement(`fiche.${individuId}`, !!ind);
  const noms = useNoms();

  if (isLoading) return <Center h="100%"><Loader /></Center>;
  if (!ind) return <Center h="100%"><Text>Individu introuvable.</Text></Center>;

  const suggestions = suggestionsFamille(
    {
      id: ind.id,
      pereId: ind.pere?.id ?? null,
      mereId: ind.mere?.id ?? null,
      acteNaissanceId: ind.acteNaissanceId,
      acteDecesId: ind.acteDecesId,
      liens: {
        pere: ind.pere ? { filiationId: ind.pere.filiationId, acteId: ind.pere.filiationActeId } : null,
        mere: ind.mere ? { filiationId: ind.mere.filiationId, acteId: ind.mere.filiationActeId } : null,
      },
      couples: ind.couples.map((c) => ({ id: c.id, conjointId: c.conjointId, acteId: c.acteId })),
    },
    releves,
    relevesActes,
  );

  return (
    <ScrollArea h="100%" {...defilement}>
      <Stack p="lg" gap="lg" maw={1100}>
        <Group justify="space-between">
          <Group align="flex-start" wrap="nowrap">
            <ActionIcon variant="subtle" onClick={() => retour("/individus")} mt={6} title="Retour">
              <IconArrowLeft size={18} />
            </ActionIcon>
            {ind.portrait && <Portrait portrait={ind.portrait} taille={72} sexe={ind.sexe} />}
            <Stack gap={4}>
              <Title order={2}>{noms.nom(ind)}</Title>
              <ResumeIndividu ind={ind} nbReleves={releves.length} />
              <Homonymes autres={noms.homonymes(ind)} libelle={noms.libelle} />
            </Stack>
          </Group>
          <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconBinaryTree2 size={16} />}
            onClick={() => navigate({ to: "/arbre", search: { racine: ind.id } })}
          >
            Voir dans l'arbre
          </Button>
          <Button
            variant="default"
            leftSection={<IconMap2 size={16} />}
            onClick={() => navigate({ to: "/cartographie", search: { racine: ind.id } })}
          >
            Cartographie
          </Button>
          <Button display={LECTURE_SEULE ? "none" : undefined} variant="default" leftSection={<IconUsers size={16} />} onClick={() => setNouveauDoute(true)}>
            Peut-être la même personne…
          </Button>
          <Button display={LECTURE_SEULE ? "none" : undefined} variant="default" leftSection={<IconArrowMerge size={16} />} onClick={() => setFusion(true)}>
            Fusionner un doublon
          </Button>
          <Button
            display={LECTURE_SEULE ? "none" : undefined}
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() =>
              modals.openConfirmModal({
                title: "Supprimer cet individu ?",
                children: <Text size="sm">Ses relevés restent dans les documents, mais ne lui seront plus rattachés.</Text>,
                labels: { confirm: "Supprimer", cancel: "Annuler" },
                confirmProps: { color: "red" },
                onConfirm: async () => {
                  await ecrire(() => supprimerIndividu(ind.id));
                  navigate({ to: "/individus" });
                },
              })
            }
          >
            Supprimer
          </Button>
          </Group>
        </Group>
        <DoutesFiche individuId={ind.id} />
        <ModalNouveauDoute individuId={ind.id} opened={nouveauDoute} onClose={() => setNouveauDoute(false)} />
        <ModalFusion
          cible={ind}
          opened={fusion}
          onClose={() => {
            setFusion(false);
            setVersion((v) => v + 1);
          }}
        />

        <FormIndividu
          key={`${ind.id}-${version}`}
          ind={ind}
          releves={releves}
          suggestions={suggestions}
          acteIds={acteIds}
          journal={
            <>
              <SourcesFiche ind={ind} acteIds={acteIds} roles={new Map(releves.map((r) => [r.acteId, r.role]))} />
              <ServiceMilitaire releves={releves} nom={ind.nom} prenoms={ind.prenoms} />
              <PhotosPersonne ind={ind} />
              <ParcoursVie personne={{ ...ind, domiciles: domicilesMilitaires(releves) }} />
              <JournalRecherches ind={ind} acteIds={acteIds} />
            </>
          }
        >
          <Stack>
            <Parents ind={ind} suggestions={suggestions} acteIds={acteIds} />
            <Couples ind={ind} suggestions={suggestions} acteIds={acteIds} />
            <Paper withBorder p="md">
              <Text fw={600} mb="xs">
                Enfants
              </Text>
              {ind.enfants.length === 0 && (
                <Text size="sm" c="dimmed">
                  Aucun (ajoutez-les en choisissant cet individu comme père ou mère sur leur fiche).
                </Text>
              )}
              {ind.enfants.map((e) => (
                <AnchorLink key={e.id} to="/individus/$individuId" params={{ individuId: e.id }} display="block" size="sm">
                  {noms.libelle(e)}
                </AnchorLink>
              ))}
            </Paper>
          </Stack>
        </FormIndividu>

        <Paper withBorder p="md">
          <Text fw={600} mb="xs">
            Relevés rattachés ({releves.length})
          </Text>
          {releves.length === 0 ? (
            <Text size="sm" c="dimmed">
              Aucun relevé. Rattachez des relevés depuis un document ou depuis « Relevés à rattacher ».
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Document</Table.Th>
                  <Table.Th>Rôle</Table.Th>
                  <Table.Th>Tel qu'écrit</Table.Th>
                  <Table.Th>Infos</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {releves.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Text size="sm">{r.acteDate}</Text>
                    </Table.Td>
                    <Table.Td>
                      <AnchorLink to="/actes/$acteId" params={{ acteId: r.acteId }} search={{ releve: r.id }} size="sm">
                        {r.acteTitre}
                      </AnchorLink>
                    </Table.Td>
                    <Table.Td>{[r.role, r.relations].filter(Boolean).join(" · ")}</Table.Td>
                    <Table.Td>{[r.nomEcrit, r.prenomsEcrits].filter(Boolean).join(" ")}</Table.Td>
                    <Table.Td>
                      <Text size="xs">{infosReleve(r).join(" · ")}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon display={LECTURE_SEULE ? "none" : undefined} variant="subtle" title="Détacher" onClick={() => ecrire(() => rattacher(r.id, null))}>
                        <IconUnlink size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>
    </ScrollArea>
  );
}

/** Tout ce qu'un relevé dit d'autre de la personne. */
function infosReleve(r: ReleveAvecActe) {
  const age = r.age?.trim();
  return [
    age && (/^\d+$/.test(age) ? `${age} ans` : age),
    r.naissance && `né(e) ${r.naissance}${r.naissanceLieu ? ` à ${r.naissanceLieu}` : ""}`,
    r.profession,
    r.domicile && `domicile : ${r.domicile}`,
    r.origine && `originaire de ${r.origine}`,
    r.signature && libelle(SIGNATURES, r.signature).toLowerCase(),
    r.mariage && `mariage : ${r.mariage}${r.mariageLieu ? ` à ${r.mariageLieu}` : ""}`,
    r.deces && `† ${r.deces}${r.decesLieu ? ` à ${r.decesLieu}` : ""}`,
    r.notes,
  ].filter(Boolean) as string[];
}

type PropsForm = {
  ind: IndividuComplet;
  releves: ReleveAvecActe[];
  suggestions: Suggestion[];
  acteIds: string[];
  children: React.ReactNode;
  /** Affiché sous le bloc principal, avant la synthèse des relevés. */
  journal: React.ReactNode;
};

/** Sous le nom : actes reliés, naissance et décès avec leur commune, nombre de relevés. */
function ResumeIndividu({ ind, nbReleves }: { ind: IndividuComplet; nbReleves: number }) {
  const { data: lieux = [] } = useLieux();
  const commune = (id: string | null) => lieux.find((l) => l.id === id)?.nom;
  const naissance = [ind.naissance, commune(ind.naissanceLieuId)].filter(Boolean).join(" · ");
  const deces = [ind.deces, commune(ind.decesLieuId)].filter(Boolean).join(" · ");
  return (
    <Group gap="lg">
      <IconesActes
        acteNaissanceId={ind.acteNaissanceId}
        acteMariage={ind.couples.some((c) => c.acteId)}
        sansUnion={ind.sansUnion}
        acteDecesId={ind.acteDecesId}
        taille={18}
      />
      {naissance && (
        <Text size="sm" c="dimmed">
          ° {naissance}
        </Text>
      )}
      {deces && (
        <Text size="sm" c="dimmed">
          † {deces}
        </Text>
      )}
      {nbReleves > 0 && (
        <Text size="sm" c="dimmed">
          {nbReleves} relevé{nbReleves > 1 ? "s" : ""}
        </Text>
      )}
      <Trace creePar={ind.creePar} modifiePar={ind.modifiePar} modifieLe={ind.modifieLe} />
    </Group>
  );
}

/** « Même nom : VEILLON François (Denault, 1742–1801), … » : les homonymes, pour ne pas se tromper de personne. */
function Homonymes({ autres, libelle }: { autres: IndividuListe[]; libelle: (p: IndividuListe) => string }) {
  if (!autres.length) return null;
  return (
    <Text size="xs" c="dimmed">
      {autres.length > 1 ? `${autres.length} homonymes` : "Un homonyme"} :{" "}
      {autres.map((a, k) => (
        <span key={a.id}>
          {k > 0 && ", "}
          <AnchorLink to="/individus/$individuId" params={{ individuId: a.id }} size="xs">
            {libelle(a)}
          </AnchorLink>
        </span>
      ))}
    </Text>
  );
}

function FormIndividu({ ind, releves, suggestions, acteIds, children, journal }: PropsForm) {
  const { valeurs: v, modifier } = useAutoSave<Individu>(ind, (patch, version) => majIndividu(ind.id, patch, version), { version: ind.modifieLe });
  const t = (champ: keyof Individu) => ({
    value: (v[champ] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      modifier({ [champ]: e.currentTarget.value || null } as Partial<Individu>),
  });
  const suggestionsActe = (quoi: "naissance" | "deces") =>
    suggestions.map((s) =>
      s.type === "acte" && s.quoi === quoi && s.source.acteId !== (quoi === "naissance" ? v.acteNaissanceId : v.acteDecesId) ? (
        <LigneSuggestion
          key={s.source.acteId}
          texte={<>Acte probable : <b>{s.source.acteTitre}</b></>}
          detail={`${quoi === "naissance" ? "enfant" : "défunt"} dans cet acte`}
          bouton="Associer"
          onClick={() => modifier(quoi === "naissance" ? { acteNaissanceId: s.source.acteId } : { acteDecesId: s.source.acteId })}
        />
      ) : null,
    );
  return (
    <>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
    <Paper withBorder p="md">
    <Lecture>
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <TextInput label="Nom" {...t("nom")} data-autofocus />
        <TextInput label="Prénoms" {...t("prenoms")} />
      </SimpleGrid>
      <TextInput
        label="Qualificatif"
        placeholder="l'aîné, le jeune, dit Gros-Jean…"
        description="Distingue des homonymes : remplace la mention automatique (nom de la mère, année de naissance)."
        {...t("qualificatif")}
      />
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Sexe
        </Text>
        <SegmentedControl data={SEXES} value={v.sexe ?? "?"} onChange={(x) => modifier({ sexe: x })} />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <DateFloueInput label="Naissance" value={v.naissance} onChange={(d) => modifier(patchDate("naissance", d))} />
        <LieuSelect label="Lieu de naissance" value={v.naissanceLieuId} onChange={(id) => modifier({ naissanceLieuId: id })} />
      </SimpleGrid>
      <ActeSelect label="Acte de naissance / baptême" value={v.acteNaissanceId} onChange={(id) => modifier({ acteNaissanceId: id })} prioritaires={acteIds} />
      {suggestionsActe("naissance")}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <DateFloueInput label="Décès" value={v.deces} onChange={(d) => modifier(patchDate("deces", d))} />
        <LieuSelect label="Lieu de décès" value={v.decesLieuId} onChange={(id) => modifier({ decesLieuId: id })} />
      </SimpleGrid>
      <ActeSelect label="Acte de décès / sépulture" value={v.acteDecesId} onChange={(id) => modifier({ acteDecesId: id })} prioritaires={acteIds} />
      {suggestionsActe("deces")}
      <TextInput label="Profession(s)" {...t("profession")} />
      <Textarea label="Notes" autosize minRows={3} {...t("notes")} />
    </Stack>
    </Lecture>
    </Paper>
    {children}
    </SimpleGrid>
    {journal}
    {releves.length > 0 && <SyntheseReleves releves={releves} fiche={v} modifier={modifier} />}
    </>
  );
}

function Parents({ ind, suggestions, acteIds }: { ind: IndividuComplet; suggestions: Suggestion[]; acteIds: string[] }) {
  const navigate = useNavigate();
  const ligne = (role: "pere" | "mere") => {
    const parent = role === "pere" ? ind.pere : ind.mere;
    const sexe = role === "pere" ? "M" : "F";
    const champInconnu = role === "pere" ? "pereInconnu" : "mereInconnue";
    const inconnu = role === "pere" ? ind.pereInconnu : ind.mereInconnue;
    return (
      <Stack gap={4}>
        <Group gap="xs" wrap="nowrap" align="flex-end">
          <IndividuSelect
            flex={1}
            label={role === "pere" ? "Père" : "Mère"}
            sexe={sexe}
            exclure={ind.id}
            value={parent?.id ?? null}
            onChange={(id) =>
              ecrire(async () => {
                await changerParent(ind.id, parent?.id ?? null, id);
                if (id && inconnu) await majIndividu(ind.id, { [champInconnu]: false });
              })
            }
          />
          {parent ? (
            <Select
              w={150}
              data={TYPES_FILIATION}
              value={parent.type}
              onChange={(t) => t && ecrire(() => majFiliation(parent.filiationId, { type: t }))}
              allowDeselect={false}
            />
          ) : LECTURE_SEULE ? null : (
            <Button
              variant="light"
              leftSection={<IconUserPlus size={16} />}
              onClick={async () => {
                const id = await ecrire(async () => {
                  const nouveau = await creerIndividu({ sexe, nom: role === "pere" ? ind.nom : null });
                  await changerParent(ind.id, null, nouveau);
                  return nouveau;
                });
                if (id) navigate({ to: "/individus/$individuId", params: { individuId: id } });
              }}
            >
              Créer
            </Button>
          )}
        </Group>
        {parent && (
          <>
            <ActeSelect
              label="Acte qui établit ce lien"
              value={parent.filiationActeId}
              onChange={(acteId) => ecrire(() => majFiliation(parent.filiationId, { acteId }))}
              prioritaires={acteIds}
            />
            <AnchorLink to="/individus/$individuId" params={{ individuId: parent.id }} size="xs">
              Ouvrir la fiche
            </AnchorLink>
          </>
        )}
        {!parent && (
          <Checkbox
            size="xs"
            label={role === "pere" ? "Père inconnu (déclaré ainsi dans les actes)" : "Mère inconnue (déclarée ainsi dans les actes)"}
            checked={inconnu}
            onChange={(e) => {
              const valeur = e.currentTarget.checked;
              ecrire(() => majIndividu(ind.id, { [champInconnu]: valeur }));
            }}
          />
        )}
        {suggestions.map((s) =>
          s.type === "acteFiliation" && s.role === role ? (
            <LigneSuggestion
              key={`${s.filiationId}-${s.source.acteId}`}
              texte={<>Acte de {s.source.acteType === "legitimation" ? "légitimation" : "reconnaissance"} : <b>{s.source.acteTitre}</b></>}
              detail="à associer comme acte qui établit ce lien"
              bouton="Associer"
              onClick={() => ecrire(() => appliquerActeFiliation(s))}
            />
          ) : null,
        )}
        {suggestions.map((s) =>
          s.type === "parent" && s.role === role ? (
            <LigneSuggestion
              key={s.releve.id}
              texte={<>{role === "pere" ? "Père" : "Mère"} d'après un acte : <b>{nomDuReleve(s.releve)}</b></>}
              detail={origine(s)}
              bouton={s.releve.individuId ? (s.remplace ? "Remplacer" : "Lier") : "Créer et lier"}
              onClick={() => ecrire(() => appliquerParent(ind, s))}
            />
          ) : null,
        )}
      </Stack>
    );
  };
  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="xs">
        Parents
      </Text>
      <Lecture>
      <Stack gap="sm">
        {ligne("pere")}
        {ligne("mere")}
        {ind.autresParents.length > 0 && (
          <Text size="xs" c="orange">
            Parent(s) de sexe inconnu : {ind.autresParents.map((p) => nomComplet(p)).join(", ")} — précisez leur sexe sur leur fiche.
          </Text>
        )}
      </Stack>
      </Lecture>
    </Paper>
  );
}

function Couples({ ind, suggestions, acteIds }: { ind: IndividuComplet; suggestions: Suggestion[]; acteIds: string[] }) {
  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Unions</Text>
        <Button
          display={LECTURE_SEULE ? "none" : undefined}
          size="xs"
          variant="light"
          leftSection={<IconHeartPlus size={14} />}
          onClick={() =>
            ecrire(async () => {
              // Une union ajoutée contredit « aucune union ».
              if (ind.sansUnion) await majIndividu(ind.id, { sansUnion: false });
              await creerCouple(ind.id, null);
            })
          }
        >
          Ajouter
        </Button>
      </Group>
      <Lecture>
      <Stack gap="sm">
        {ind.couples.length === 0 && (
          <Checkbox
            label="Aucune union (célibataire, mort jeune…) : pas d'acte de mariage à chercher"
            checked={ind.sansUnion}
            onChange={(e) => {
              const sansUnion = e.currentTarget.checked;
              ecrire(() => majIndividu(ind.id, { sansUnion }));
            }}
          />
        )}
        {ind.couples.map((c, i) => (
          <Stack key={c.id} gap="xs">
            {i > 0 && <Divider />}
            <LigneCouple key={`${c.id}-${c.acteId}`} ind={ind} couple={c} acteIds={acteIds} />
            {suggestions.map((s) =>
              s.type === "acteUnion" && s.coupleId === c.id ? (
                <LigneSuggestion
                  key={s.source.acteId}
                  texte={<>Acte de mariage probable : <b>{s.source.acteTitre}</b></>}
                  detail="date et lieu repris de l'acte s'ils manquent"
                  bouton="Associer"
                  onClick={() => ecrire(() => appliquerActeUnion(ind, s))}
                />
              ) : null,
            )}
          </Stack>
        ))}
        {suggestions.map((s) =>
          s.type === "union" ? (
            <LigneSuggestion
              key={s.releve.id}
              texte={<>Union d'après un acte : <b>{nomDuReleve(s.releve)}</b></>}
              detail={`${origine(s)}${s.acteMariage ? " · avec l'acte de mariage" : ""}`}
              bouton={s.releve.individuId ? "Ajouter l'union" : "Créer et unir"}
              onClick={() => ecrire(() => appliquerUnion(ind, s))}
            />
          ) : null,
        )}
      </Stack>
      </Lecture>
    </Paper>
  );
}

function LigneCouple({ ind, couple, acteIds }: { ind: IndividuComplet; couple: IndividuComplet["couples"][number]; acteIds: string[] }) {
  const { valeurs, modifier } = useAutoSave(
    { date: couple.date, dateMin: couple.dateMin, dateMax: couple.dateMax, lieuId: couple.lieuId, type: couple.type, acteId: couple.acteId },
    (p) => majCouple(couple.id, p),
  );
  // Le conjoint est « l'autre » membre du couple.
  const champConjoint = couple.individu1Id === ind.id ? "individu2Id" : "individu1Id";
  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <IndividuSelect
          flex={1}
          label="Conjoint"
          exclure={ind.id}
          value={couple.conjointId}
          onChange={(id) => ecrire(() => majCouple(couple.id, { [champConjoint]: id }))}
        />
        <ActionIcon display={LECTURE_SEULE ? "none" : undefined} variant="subtle" color="red" mb={4} onClick={() => ecrire(() => supprimerCouple(couple.id))}>
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
      <SimpleGrid cols={3} spacing="xs">
        <Select
          label="Type"
          data={[
            { value: "mariage", label: "Mariage" },
            { value: "union_libre", label: "Union libre" },
            { value: "inconnu", label: "Inconnu" },
          ]}
          value={valeurs.type}
          onChange={(t) => modifier({ type: t })}
        />
        <DateFloueInput label="Date" value={valeurs.date} onChange={(d) => modifier(patchDate("date", d))} />
        <LieuSelect label="Lieu" value={valeurs.lieuId} onChange={(id) => modifier({ lieuId: id })} />
      </SimpleGrid>
      <ActeSelect label="Acte de mariage" value={valeurs.acteId} onChange={(id) => modifier({ acteId: id })} prioritaires={acteIds} />
      {couple.conjointId && (
        <AnchorLink to="/individus/$individuId" params={{ individuId: couple.conjointId }} size="xs">
          Ouvrir la fiche du conjoint
        </AnchorLink>
      )}
    </Stack>
  );
}
