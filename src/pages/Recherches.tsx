import { ActionIcon, Badge, Group, Paper, ScrollArea, SegmentedControl, Stack, Table, Tabs, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconExternalLink, IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "../lib/liens";
import { sourcesEtConsultations, toutesRecherches } from "../data/recherches";
import { RESULTATS, STATUTS_RECHERCHE } from "../lib/recherches";
import { AnchorLink } from "../components/AnchorLink";
import { useNoms } from "../components/selects";
import { useMemoire } from "../lib/onglets";
import { useEcran } from "../lib/ecran";

const dateFr = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function Recherches() {
  const { telephone } = useEcran();
  const navigate = useNavigate();
  const { nom } = useNoms();
  const { data: recherches = [] } = useQuery({ queryKey: ["toutes-recherches"], queryFn: toutesRecherches });
  const { data: sources = [] } = useQuery({ queryKey: ["sources-consultations"], queryFn: sourcesEtConsultations });
  const [filtre, setFiltre] = useMemoire("recherches.filtre", "ouvertes");
  const [texte, setTexte] = useMemoire("recherches.texte", "");
  const [ongletPage, setOngletPage] = useMemoire<string | null>("recherches.onglet", "recherches");

  const correspond = (s: string) => !texte || sansAccents(s).includes(sansAccents(texte));
  const liste = recherches.filter(
    (r) =>
      (filtre === "toutes" || (filtre === "ouvertes" ? r.statut === "a_faire" || r.statut === "en_cours" : r.statut === filtre)) &&
      correspond(`${r.titre} ${r.description ?? ""} ${r.individuNom ?? ""} ${r.individuPrenoms ?? ""}`),
  );
  const sourcesConsultees = sources.filter(
    (s) => s.consultations.length > 0 && correspond(`${s.titre} ${s.lieuNom ?? ""} ${s.cote ?? ""} ${s.typeRegistre ?? ""}`),
  );

  return (
    <Stack p="lg" gap="md" h="100%">
      <Title order={2}>Recherches</Title>
      <TextInput
        w={{ base: "100%", sm: 360 }}
        placeholder="Filtrer (personne, recherche, source, lieu…)"
        leftSection={<IconSearch size={16} />}
        value={texte}
        onChange={(e) => setTexte(e.currentTarget.value)}
      />

      <Tabs value={ongletPage} onChange={setOngletPage} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Tabs.List>
          <Tabs.Tab value="recherches">Recherches</Tabs.Tab>
          <Tabs.Tab value="sources">Sources consultées ({sourcesConsultees.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="recherches" pt="md" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <SegmentedControl
            w="fit-content"
            value={filtre}
            onChange={setFiltre}
            data={[
              { value: "ouvertes", label: "En cours et à faire" },
              ...STATUTS_RECHERCHE.filter((s) => s.value === "trouve" || s.value === "abandonne").map((s) => ({ value: s.value, label: s.label })),
              { value: "toutes", label: "Toutes" },
            ]}
          />
          <ScrollArea flex={1}>
            {liste.length === 0 ? (
              <Text size="sm" c="dimmed">
                Aucune recherche. Elles se créent depuis la fiche d'une personne (bloc « Recherches »).
              </Text>
            ) : (
              telephone ? (
                <Stack gap="xs">
                  {liste.map((r) => {
                    const s = STATUTS_RECHERCHE.find((x) => x.value === r.statut);
                    return (
                      <Paper
                        key={r.id}
                        withBorder
                        p="sm"
                        onClick={() => r.individuId && navigate({ to: "/individus/$individuId", params: { individuId: r.individuId } })}
                      >
                        <Group justify="space-between" wrap="nowrap" mb={4}>
                          <Text size="sm" fw={600} truncate>
                            {r.individuId ? nom({ id: r.individuId, nom: r.individuNom, prenoms: r.individuPrenoms }) : "(personne supprimée)"}
                          </Text>
                          <Badge size="sm" variant="light" color={s?.couleur}>
                            {s?.label ?? r.statut}
                          </Badge>
                        </Group>
                        <Text size="sm">{r.titre}</Text>
                        <Text size="xs" c="dimmed">
                          {[r.nbConsultations ? `${r.nbConsultations} consultation${r.nbConsultations > 1 ? "s" : ""}` : null, dateFr(r.derniere)]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </Paper>
                    );
                  })}
                </Stack>
              ) : (
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={120}>Statut</Table.Th>
                    <Table.Th>Personne</Table.Th>
                    <Table.Th>Recherche</Table.Th>
                    <Table.Th>Consultations</Table.Th>
                    <Table.Th>Dernière</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {liste.map((r) => {
                    const s = STATUTS_RECHERCHE.find((x) => x.value === r.statut);
                    return (
                      <Table.Tr
                        key={r.id}
                        className="ligne-cliquable"
                        onClick={() => r.individuId && navigate({ to: "/individus/$individuId", params: { individuId: r.individuId } })}
                      >
                        <Table.Td>
                          <Badge variant="light" color={s?.couleur}>
                            {s?.label ?? r.statut}
                          </Badge>
                        </Table.Td>
                        <Table.Td fw={500}>{r.individuId ? nom({ id: r.individuId, nom: r.individuNom, prenoms: r.individuPrenoms }) : "(personne supprimée)"}</Table.Td>
                        <Table.Td>
                          <Text size="sm">{r.titre}</Text>
                          {r.description && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {r.description}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>{r.nbConsultations || ""}</Table.Td>
                        <Table.Td>{dateFr(r.derniere)}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              )
            )}
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="sources" pt="md" style={{ flex: 1, minHeight: 0 }}>
          <ScrollArea h="100%">
            {sourcesConsultees.length === 0 ? (
              <Text size="sm" c="dimmed">
                Aucune source consultée pour l'instant.
              </Text>
            ) : (
              <Stack gap="sm">
                {sourcesConsultees.map((s) => (
                  <Paper key={s.id} withBorder p="sm">
                    <Group gap={6} wrap="nowrap">
                      <Text fw={600}>{s.titre}</Text>
                      {s.url && (
                        <Tooltip label="Ouvrir la source en ligne">
                          <ActionIcon variant="subtle" size="sm" onClick={() => openUrl(s.url!)}>
                            <IconExternalLink size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" mb={6}>
                      {[s.typeRegistre, s.lieuNom, s.periode, s.cote && `cote ${s.cote}`, s.serviceArchives].filter(Boolean).join(" · ")}
                    </Text>
                    <Table verticalSpacing={4}>
                      <Table.Tbody>
                        {s.consultations.map((c) => {
                          const res = RESULTATS.find((x) => x.value === c.resultat) ?? RESULTATS[0];
                          return (
                            <Table.Tr key={c.id}>
                              <Table.Td w={110}>
                                <Text size="xs">{dateFr(c.date)}</Text>
                              </Table.Td>
                              <Table.Td w={120}>
                                <Badge size="xs" variant="light" color={res.couleur}>
                                  {res.label}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {c.individuId ? (
                                  <AnchorLink to="/individus/$individuId" params={{ individuId: c.individuId }} size="xs">
                                    {nom({ id: c.individuId, nom: c.individuNom, prenoms: c.individuPrenoms })}
                                  </AnchorLink>
                                ) : (
                                  <Text size="xs">(personne supprimée)</Text>
                                )}
                                <Text size="xs" c="dimmed" span>
                                  {" "}
                                  — {c.tacheTitre}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed" lineClamp={2}>
                                  {[c.vues && `vue ${c.vues}`, c.notes].filter(Boolean).join(" · ")}
                                </Text>
                              </Table.Td>
                              <Table.Td w={40}>
                                {c.permalien && (
                                  <Tooltip label="Ouvrir la vue consultée (permalien)">
                                    <ActionIcon variant="subtle" size="sm" onClick={() => openUrl(c.permalien!)}>
                                      <IconExternalLink size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                ))}
              </Stack>
            )}
          </ScrollArea>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
