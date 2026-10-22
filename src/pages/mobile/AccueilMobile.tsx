import { useState } from "react";
import { Anchor, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title, UnstyledButton } from "@mantine/core";
import { IconBinaryTree2, IconCamera, IconMap2, IconPhoto, IconSearch, IconUser } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useIndividus } from "../../components/selects";
import { Portrait } from "../../components/Portrait";
import type { IndividuListe } from "../../data/individus";
import { nomComplet } from "../../lib/libelles";
import { LECTURE_SEULE } from "../../lib/mode";
import { lireRecents } from "../../lib/recents";
import { utilisateur } from "../../lib/session";
import { anneeFloue } from "../arbre/disposition";

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const annees = (i: IndividuListe) => {
  const n = anneeFloue(i.naissanceMin, i.naissanceMax);
  const d = anneeFloue(i.decesMin, i.decesMax);
  return n || d ? `${n || "?"} – ${d}` : "";
};

function LignePersonne({ i }: { i: IndividuListe }) {
  const navigate = useNavigate();
  return (
    <UnstyledButton onClick={() => navigate({ to: "/individus/$individuId", params: { individuId: i.id } })} py={8}>
      <Group wrap="nowrap" gap="sm">
        <Portrait portrait={i.portrait} taille={40} nom={i.nom} prenoms={i.prenoms} sexe={i.sexe} />
        <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={600} truncate>
            {nomComplet(i)}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {[annees(i), i.naissanceLieuNom].filter(Boolean).join(" · ")}
          </Text>
        </Stack>
      </Group>
    </UnstyledButton>
  );
}

/** Accueil du téléphone : trouver quelqu'un, et les raccourcis utiles. */
export function AccueilMobile() {
  const navigate = useNavigate();
  const { data: individus = [] } = useIndividus();
  const [recherche, setRecherche] = useState("");
  const moi = utilisateur();
  const parId = new Map(individus.map((i) => [i.id, i]));
  const recents = lireRecents()
    .map((id) => parId.get(id))
    .filter((i): i is IndividuListe => !!i);

  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const trouves = mots.length
    ? individus.filter((i) => {
        const texte = sansAccents(`${i.nom ?? ""} ${i.prenoms ?? ""}`);
        return mots.every((m) => texte.includes(m));
      })
    : [];

  const raccourcis = [
    ...(moi?.individuId ? [{ label: "Ma fiche", icone: IconUser, aller: () => navigate({ to: "/individus/$individuId", params: { individuId: moi.individuId! } }) }] : []),
    { label: "Arbre", icone: IconBinaryTree2, aller: () => navigate({ to: "/arbre" }) },
    { label: "Photos", icone: IconPhoto, aller: () => navigate({ to: "/photos" }) },
    { label: "Carte", icone: IconMap2, aller: () => navigate({ to: "/cartographie" }) },
    ...(!LECTURE_SEULE ? [{ label: "Capturer", icone: IconCamera, aller: () => navigate({ to: "/capturer" }) }] : []),
  ];

  return (
    <Stack gap="md" p="md" style={{ overflowY: "auto" }} h="100%">
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>Tabularium</Title>
        <Anchor size="sm" onClick={() => navigate({ to: "/presentation" })}>
          Présentation
        </Anchor>
      </Group>
      <TextInput
        size="md"
        placeholder="Chercher une personne…"
        leftSection={<IconSearch size={18} />}
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
      />

      {mots.length > 0 ? (
        <Paper withBorder px="sm" py={4}>
          {trouves.length === 0 && (
            <Text size="sm" c="dimmed" py="sm">
              Personne ne correspond.
            </Text>
          )}
          {trouves.slice(0, 40).map((i) => (
            <LignePersonne key={i.id} i={i} />
          ))}
          {trouves.length > 40 && (
            <Text size="xs" c="dimmed" py="xs">
              {trouves.length - 40} autres : précisez la recherche.
            </Text>
          )}
        </Paper>
      ) : (
        <>
          <SimpleGrid cols={raccourcis.length > 4 ? 3 : 2} spacing="sm">
            {raccourcis.map((r) => (
              <UnstyledButton key={r.label} onClick={r.aller}>
              <Paper withBorder p="md">
                <Stack align="center" gap={6}>
                  <r.icone size={28} color="var(--mantine-color-teal-7)" />
                  <Text size="sm" fw={500}>
                    {r.label}
                  </Text>
                </Stack>
              </Paper>
              </UnstyledButton>
            ))}
          </SimpleGrid>
          {recents.length > 0 && (
            <Stack gap={4}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                Consultées récemment
              </Text>
              <Paper withBorder px="sm" py={4}>
                {recents.map((i) => (
                  <LignePersonne key={i.id} i={i} />
                ))}
              </Paper>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
