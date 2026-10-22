import { useState } from "react";
import { Button, Code, Group, ScrollArea, SegmentedControl, Select, Stack, Table, Text, Title } from "@mantine/core";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { appelApi } from "../../lib/rpc";

type Ligne = { id: number; quand: string; utilisateur: string; fonction: string; cible: string | null; resume: string | null };

/** Libellés lisibles des fonctions d'écriture ; les autres sont affichées telles quelles. */
const LIBELLES: Record<string, string> = {
  creerActe: "Nouveau document",
  majActe: "Document modifié",
  supprimerActe: "Document supprimé",
  ajouterPages: "Pages ajoutées",
  retirerPage: "Page retirée",
  creerActeSurPages: "Nouvel acte sur une image",
  lierPage: "Page liée",
  majStatutActes: "Statut de documents",
  regrouperDansRegistre: "Documents rangés dans un registre",
  creerZonePersonne: "Personne surlignée",
  creerZoneNote: "Note surlignée",
  creerZonePourReleve: "Zone tracée",
  majAnnotation: "Zone modifiée",
  supprimerAnnotation: "Zone supprimée",
  creerReleve: "Nouveau relevé",
  majReleve: "Relevé modifié",
  supprimerReleve: "Relevé supprimé",
  rattacher: "Relevé rattaché",
  creerIndividuDepuisReleve: "Individu créé depuis un relevé",
  creerIndividu: "Nouvel individu",
  majIndividu: "Individu modifié",
  supprimerIndividu: "Individu supprimé",
  fusionnerIndividus: "Individus fusionnés",
  changerParent: "Parent changé",
  majFiliation: "Filiation modifiée",
  creerCouple: "Nouvelle union",
  majCouple: "Union modifiée",
  supprimerCouple: "Union supprimée",
  creerLieu: "Nouveau lieu",
  majLieu: "Lieu modifié",
  supprimerLieu: "Lieu supprimé",
  creerRegistre: "Nouveau registre",
  creerSource: "Nouveau registre",
  majSource: "Registre modifié",
  supprimerRegistre: "Registre supprimé",
  creerRecherche: "Nouvelle recherche",
  majRecherche: "Recherche modifiée",
  supprimerRecherche: "Recherche supprimée",
  enregistrerConsultation: "Consultation notée",
  supprimerConsultation: "Consultation supprimée",
  ajouterLien: "Lien ajouté",
  majLien: "Lien modifié",
  supprimerLien: "Lien supprimé",
};

const PERIODES = [
  { value: "1", label: "24 h" },
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "tout", label: "Tout" },
];

const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Qui a modifié quoi, et quand (admins). */
export function Journal() {
  const [personne, setPersonne] = useState<string | null>(null);
  const [periode, setPeriode] = useState("7");
  const { data: comptes } = useQuery({ queryKey: ["comptes"], queryFn: () => appelApi<{ comptes: { email: string }[] }>("/api/comptes") });

  const depuis = periode === "tout" ? undefined : new Date(Date.now() - Number(periode) * 86400_000).toISOString();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["journal", personne, periode],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams();
      if (personne) p.set("utilisateur", personne);
      if (depuis) p.set("depuis", depuis);
      if (pageParam) p.set("avant", String(pageParam));
      return appelApi<{ lignes: Ligne[] }>(`/api/journal?${p}`);
    },
    getNextPageParam: (derniere) => (derniere.lignes.length === 200 ? derniere.lignes[derniere.lignes.length - 1].id : undefined),
  });
  const lignes = data?.pages.flatMap((p) => p.lignes) ?? [];

  return (
    <Stack p="lg" gap="md" h="100%">
      <Title order={2}>Journal des modifications</Title>
      <Group>
        <Select
          w={{ base: "100%", sm: 280 }}
          placeholder="Toutes les personnes"
          data={(comptes?.comptes ?? []).map((c) => c.email)}
          value={personne}
          onChange={setPersonne}
          clearable
          searchable
        />
        <SegmentedControl data={PERIODES} value={periode} onChange={setPeriode} />
        <Text size="sm" c="dimmed">
          {lignes.length} modification{lignes.length > 1 ? "s" : ""}
          {hasNextPage ? " (et plus)" : ""}
        </Text>
      </Group>
      <ScrollArea flex={1}>
        <Table verticalSpacing={6} highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={190}>Quand</Table.Th>
              <Table.Th w={220}>Qui</Table.Th>
              <Table.Th w={230}>Action</Table.Th>
              <Table.Th>Détail</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lignes.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Text size="xs">{dateHeure(l.quand)}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{l.utilisateur}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {LIBELLES[l.fonction] ?? l.fonction}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {l.resume && l.resume !== "[]" && (
                    <Code fz="xs" style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                      {l.resume}
                    </Code>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {hasNextPage && (
          <Group justify="center" my="md">
            <Button variant="default" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
              Plus ancien
            </Button>
          </Group>
        )}
      </ScrollArea>
    </Stack>
  );
}
