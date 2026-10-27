import { Badge, Group, Paper, Stack, Text, TextInput, Title, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listeActes } from "../../data/actes";
import { libelle, libelleType, NATURES, STATUTS_ACTE } from "../../lib/libelles";
import { useMemoire } from "../../lib/onglets";
import { afficherDate } from "../../lib/dates";

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Documents sur téléphone : une liste simple pour retrouver et consulter un document. */
export function DocumentsMobile() {
  const navigate = useNavigate();
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const [recherche, setRecherche] = useMemoire("documents.mobile.recherche", "");
  const mots = sansAccents(recherche).split(/\s+/).filter(Boolean);
  const filtres = actes
    .filter((a) => {
      const texte = sansAccents(`${a.titre} ${a.lieuNom ?? ""} ${a.date ?? ""} ${a.sourceTitre ?? ""}`);
      return mots.every((m) => texte.includes(m));
    })
    .slice(0, 150);

  return (
    <Stack gap="sm" p="md" h="100%" style={{ overflowY: "auto" }}>
      <Title order={2}>Documents</Title>
      <TextInput
        size="md"
        placeholder="Titre, lieu, date, registre…"
        leftSection={<IconSearch size={18} />}
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
      />
      <Text size="xs" c="dimmed">
        {filtres.length === 150 ? "150 premiers documents : précisez la recherche." : `${filtres.length} document${filtres.length > 1 ? "s" : ""}`}
      </Text>
      {filtres.map((a) => {
        const s = STATUTS_ACTE.find((x) => x.value === a.statut);
        return (
          <UnstyledButton key={a.id} onClick={() => navigate({ to: "/actes/$acteId", params: { acteId: a.id } })}>
              <Paper withBorder p="sm">
            <Stack gap={4}>
              <Text size="sm" fw={600} lineClamp={2}>
                {a.titre}
              </Text>
              <Group gap={6}>
                <Badge size="xs" variant="outline" color={a.nature === "photo" ? "cyan" : a.nature === "index" ? "grape" : "gray"}>
                  {libelleType(a.nature, a.type) || libelle(NATURES, a.nature)}
                </Badge>
                {s && (
                  <Badge size="xs" variant="light" color={s.couleur}>
                    {s.label}
                  </Badge>
                )}
                <Text size="xs" c="dimmed">
                  {[afficherDate(a.date), a.lieuNom].filter(Boolean).join(" · ")}
                </Text>
              </Group>
              {a.sourceTitre && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {a.sourceTitre}
                </Text>
              )}
            </Stack>
          </Paper>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}
