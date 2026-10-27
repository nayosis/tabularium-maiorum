import { useState } from "react";
import { Badge, Button, Center, Group, Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconLayoutGrid, IconSearch, IconTable, IconTimelineEvent, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { creerIndividu, type IndividuListe } from "../data/individus";
import { IconesActes } from "../components/IconesActes";
import { Portrait } from "../components/Portrait";
import { evenementsReleve } from "../lib/evenements";
import { creerIndividuDepuisReleve, evenementsIndividus, rattacher, relevesNonRattaches } from "../data/releves";
import { CandidatsRattachement } from "../components/CandidatsRattachement";
import { IndividuSelect, useIndividus, useNoms } from "../components/selects";
import { AnchorLink } from "../components/AnchorLink";
import { ecrire } from "../lib/query";
import { Frise } from "./frise/Frise";
import { LECTURE_SEULE } from "../lib/mode";
import { clicOuvrir, useDefilement, useMemoire } from "../lib/onglets";
import { ListeDoutes, useDoublonsPossibles } from "../components/Doutes";

const CLE_VUE = "tabularium.individus.vue";
const lireVue = () => {
  try {
    return localStorage.getItem(CLE_VUE) === "cartes" ? "cartes" : "tableau";
  } catch {
    return "tableau";
  }
};

function DateEtLieu({ date, lieu }: { date: string | null; lieu: string | null }) {
  return (
    <>
      <Text size="sm">{date}</Text>
      {lieu && (
        <Text size="xs" c="dimmed">
          {lieu}
        </Text>
      )}
    </>
  );
}

/** Fiche qui a un doute « peut-être la même personne » à vérifier. */
function IconeDoute() {
  return (
    <Tooltip label="Peut-être la même personne qu'une autre fiche (doute à vérifier)">
      <IconAlertTriangle size={16} color="var(--mantine-color-orange-6)" style={{ flexShrink: 0 }} />
    </Tooltip>
  );
}

const COULEUR_SEXE: Record<string, string> = { M: "var(--mantine-color-blue-5)", F: "var(--mantine-color-pink-5)" };

function CarteIndividu({ i, pere, mere, onOuvrir }: { i: IndividuListe; pere?: IndividuListe; mere?: IndividuListe; onOuvrir: (e: React.MouseEvent) => void }) {
  const { nom: nomComplet, mention } = useNoms();
  const distinction = mention(i.id);
  const naissance = [i.naissance, i.naissanceLieuNom].filter(Boolean).join(" · ");
  const deces = [i.deces, i.decesLieuNom].filter(Boolean).join(" · ");
  const parents = [pere && nomComplet(pere), mere && nomComplet(mere)].filter(Boolean);
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      className="ligne-cliquable"
      onClick={onOuvrir}
      onAuxClick={onOuvrir}
      style={{ borderLeft: `4px solid ${COULEUR_SEXE[i.sexe ?? ""] ?? "var(--mantine-color-gray-4)"}` }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
        <Portrait portrait={i.portrait} taille={40} nom={i.nom} prenoms={i.prenoms} sexe={i.sexe} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text fw={700} size="sm" truncate>
            {(i.nom ?? "?").toUpperCase()}
          </Text>
          <Text size="sm" truncate>
            {i.prenoms}
            {distinction && (
              <Text span size="sm" c="dimmed">
                {" "}
                ({distinction})
              </Text>
            )}
          </Text>
        </div>
        <Group gap={4} wrap="nowrap">
          {i.nbDoutes > 0 && <IconeDoute />}
          <IconesActes acteNaissanceId={i.acteNaissanceId} acteMariage={i.acteMariage} acteDecesId={i.acteDecesId} sansUnion={i.sansUnion} />
        </Group>
      </Group>
      <Stack gap={0} mt={6}>
        {naissance && (
          <Text size="xs" c="dimmed" truncate>
            ° {naissance}
          </Text>
        )}
        {deces && (
          <Text size="xs" c="dimmed" truncate>
            † {deces}
          </Text>
        )}
      </Stack>
      {parents.length > 0 && (
        <Text size="xs" mt={6} lineClamp={2}>
          {i.sexe === "F" ? "Fille" : i.sexe === "M" ? "Fils" : "Enfant"} de {parents.join(" et ")}
        </Text>
      )}
      {i.nbReleves > 0 && (
        <Badge size="xs" variant="light" color="gray" mt={8}>
          {i.nbReleves} relevé{i.nbReleves > 1 ? "s" : ""}
        </Badge>
      )}
    </Paper>
  );
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function Individus() {
  const navigate = useNavigate();
  const { data: individus = [] } = useIndividus();
  const { data: aRattacher = [] } = useQuery({ queryKey: ["releves-non-rattaches"], queryFn: relevesNonRattaches });
  // Relevés déjà rattachés, par acte : la structure des actes guide les suggestions.
  const { data: rattaches = [] } = useQuery({ queryKey: ["evenements-individus"], queryFn: evenementsIndividus });
  const autresParActe = Map.groupBy(
    rattaches.filter((e) => e.acteNature !== "index").map((e) => ({ id: e.releveId, role: e.role, individuId: e.individuId, acteId: e.acteId })),
    (e) => e.acteId,
  );
  const [recherche, setRecherche] = useMemoire("individus.recherche", "");
  const [ongletPage, setOngletPage] = useMemoire<string | null>("individus.onglet", "individus");
  const [vue, setVue] = useState(lireVue);
  const defilement = useDefilement(`individus.${vue}`, individus.length > 0);
  const changerVue = (v: string) => {
    setVue(v === "cartes" ? "cartes" : "tableau");
    try {
      localStorage.setItem(CLE_VUE, v);
    } catch {
      // préférence non mémorisée : sans importance
    }
  };
  const parId = new Map(individus.map((i) => [i.id, i]));
  // Chaque doute à vérifier concerne deux fiches.
  const nbDoutes = individus.reduce((n, i) => n + i.nbDoutes, 0) / 2;
  const doublons = useDoublonsPossibles();

  const { nom: nomDistinct, libelle } = useNoms();
  // Le nom distinctif permet aussi de chercher « Veillon Denault » ou « l'aîné ».
  const filtres = individus.filter((i) => !recherche || sansAccents(`${nomDistinct(i)} ${i.prenoms ?? ""} ${i.nom ?? ""}`).includes(sansAccents(recherche)));
  // Relevés à rattacher : nom et prénoms (écrits ou normalisés) et titre du document ; tous les mots doivent y être.
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const relevesFiltres = aRattacher.filter((r) => {
    const texte = sansAccents([r.nomEcrit, r.nom, r.prenomsEcrits, r.prenoms, r.acteTitre].filter(Boolean).join(" "));
    return mots.every((m) => texte.includes(m));
  });

  return (
    <Stack p="lg" gap="md" h="100%">
      <Group justify="space-between">
        <Title order={2}>Individus</Title>
        <Button
          display={LECTURE_SEULE ? "none" : undefined}
          leftSection={<IconUserPlus size={18} />}
          onClick={async () => {
            const id = await ecrire(() => creerIndividu());
            if (id) navigate({ to: "/individus/$individuId", params: { individuId: id } });
          }}
        >
          Nouvel individu
        </Button>
      </Group>

      <TextInput
        w={{ base: "100%", sm: 320 }}
        placeholder={ongletPage === "a-rattacher" ? "Nom, prénoms ou document" : ongletPage === "doutes" ? "Nom de l'une des deux fiches" : "Rechercher un nom"}
        leftSection={<IconSearch size={16} />}
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
      />

      <Tabs value={ongletPage} onChange={setOngletPage} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Tabs.List>
          <Tabs.Tab value="individus">Individus ({filtres.length})</Tabs.Tab>
          <Tabs.Tab value="frise" leftSection={<IconTimelineEvent size={16} />}>
            Frise chronologique
          </Tabs.Tab>
          <Tabs.Tab
            value="doutes"
            leftSection={<IconAlertTriangle size={16} />}
            rightSection={
              nbDoutes || doublons.length ? (
                <Group gap={4} wrap="nowrap">
                  {nbDoutes > 0 && <Badge size="xs" color="orange">{nbDoutes}</Badge>}
                  {doublons.length > 0 && (
                    <Tooltip label="Doublons possibles détectés">
                      <Badge size="xs" color="gray" variant="light">
                        +{doublons.length}
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              ) : null
            }
          >
            Doutes
          </Tabs.Tab>
          <Tabs.Tab value="a-rattacher" display={LECTURE_SEULE ? "none" : undefined} rightSection={
              aRattacher.length ? (
                <Badge size="xs">{mots.length ? `${relevesFiltres.length} / ${aRattacher.length}` : aRattacher.length}</Badge>
              ) : null
            }>
            Relevés à rattacher
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="individus" pt="md" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <SegmentedControl
            w="fit-content"
            size="xs"
            value={vue}
            onChange={changerVue}
            data={[
              { value: "tableau", label: <Center style={{ gap: 6 }}><IconTable size={14} /> Tableau</Center> },
              { value: "cartes", label: <Center style={{ gap: 6 }}><IconLayoutGrid size={14} /> Cartes</Center> },
            ]}
          />
          <ScrollArea flex={1} {...defilement}>
            {vue === "cartes" ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing="sm">
                {filtres.map((i) => (
                  <CarteIndividu
                    key={i.id}
                    i={i}
                    pere={i.pereId ? parId.get(i.pereId) : undefined}
                    mere={i.mereId ? parId.get(i.mereId) : undefined}
                    onOuvrir={(e) => clicOuvrir(e, `/individus/${i.id}`)}
                  />
                ))}
              </SimpleGrid>
            ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nom</Table.Th>
                  <Table.Th>Naissance</Table.Th>
                  <Table.Th>Décès</Table.Th>
                  <Table.Th>Père</Table.Th>
                  <Table.Th>Mère</Table.Th>
                  <Table.Th>Actes</Table.Th>
                  <Table.Th>Relevés</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtres.map((i) => {
                  const pere = i.pereId ? parId.get(i.pereId) : undefined;
                  const mere = i.mereId ? parId.get(i.mereId) : undefined;
                  return (
                    <Table.Tr
                      key={i.id}
                      className="ligne-cliquable"
                      onClick={(e) => clicOuvrir(e, `/individus/${i.id}`)}
                      onAuxClick={(e) => clicOuvrir(e, `/individus/${i.id}`)}
                    >
                      <Table.Td fw={500}>
                        <Group gap="xs" wrap="nowrap">
                          <Portrait portrait={i.portrait} taille={28} nom={i.nom} prenoms={i.prenoms} sexe={i.sexe} />
                          {nomDistinct(i)}
                          {i.nbDoutes > 0 && <IconeDoute />}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <DateEtLieu date={i.naissance} lieu={i.naissanceLieuNom} />
                      </Table.Td>
                      <Table.Td>
                        <DateEtLieu date={i.deces} lieu={i.decesLieuNom} />
                      </Table.Td>
                      <Table.Td>{pere && libelle(pere)}</Table.Td>
                      <Table.Td>{mere && libelle(mere)}</Table.Td>
                      <Table.Td>
                        <IconesActes acteNaissanceId={i.acteNaissanceId} acteMariage={i.acteMariage} acteDecesId={i.acteDecesId} sansUnion={i.sansUnion} />
                      </Table.Td>
                      <Table.Td>{i.nbReleves || ""}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
            )}
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="frise" pt="md" style={{ flex: 1, minHeight: 0 }}>
          <Frise personnes={filtres} />
        </Tabs.Panel>

        <Tabs.Panel value="doutes" pt="md" style={{ flex: 1, minHeight: 0 }}>
          <ScrollArea h="100%">
            <ListeDoutes recherche={recherche} />
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="a-rattacher" pt="md" style={{ flex: 1, minHeight: 0 }}>
          <ScrollArea h="100%">
            {aRattacher.length === 0 ? (
              <Text c="dimmed">Tous les relevés sont rattachés à un individu.</Text>
            ) : relevesFiltres.length === 0 ? (
              <Text c="dimmed">Aucun relevé ne correspond à « {recherche} ».</Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Relevé</Table.Th>
                    <Table.Th>Rôle</Table.Th>
                    <Table.Th>Événement</Table.Th>
                    <Table.Th>Document</Table.Th>
                    <Table.Th w={420}>Rattacher à</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {relevesFiltres.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {[r.nomEcrit || r.nom, r.prenomsEcrits || r.prenoms].filter(Boolean).join(" ") || "Personne ?"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {[r.age && (/^\d+$/.test(r.age.trim()) ? `${r.age.trim()} ans` : r.age), r.profession].filter(Boolean).join(" · ")}
                        </Text>
                      </Table.Td>
                      <Table.Td>{[r.role, r.relations].filter(Boolean).join(" · ")}</Table.Td>
                      <Table.Td>
                        {evenementsReleve(r).map((l, i) => (
                          <Text key={i} size={i === 0 ? "sm" : "xs"} c={i === 0 ? undefined : "dimmed"} style={{ whiteSpace: "nowrap" }}>
                            {l}
                          </Text>
                        ))}
                      </Table.Td>
                      <Table.Td>
                        <AnchorLink to="/actes/$acteId" params={{ acteId: r.acteId }} search={{ releve: r.id }} size="sm">
                          {r.acteTitre}
                        </AnchorLink>
                      </Table.Td>
                      <Table.Td>
                        <CandidatsRattachement
                          releve={r}
                          contexte={{ dateMin: r.acteDateMin, dateMax: r.acteDateMax, autres: autresParActe.get(r.acteId) ?? [] }}
                          max={1}
                        />
                        <Group gap="xs" wrap="nowrap" mt={4}>
                          <IndividuSelect size="xs" flex={1} value={null} onChange={(id) => id && ecrire(() => rattacher(r.id, id))} />
                          <Button size="xs" variant="light" onClick={() => ecrire(() => creerIndividuDepuisReleve(r))}>
                            Créer
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
