import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Box, Group, Kbd, Modal, ScrollArea, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import {
  IconBook2, IconFileText, IconListSearch, IconMapPin, IconPhoto, IconSearch, IconUser, type Icon,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listeActes } from "../data/actes";
import { toutesRecherches } from "../data/recherches";
import { listeRegistres } from "../data/registres";
import { useIndividus, useLieux, useNoms } from "./selects";

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

type Resultat = { cle: string; genre: string; icone: Icon; titre: string; detail?: string; aller: () => void; score: number };

/** Pertinence : tous les mots doivent figurer ; bonus si le texte commence par le premier mot. */
function score(texte: string, mots: string[]) {
  const t = sansAccents(texte);
  if (!mots.every((m) => t.includes(m))) return 0;
  return 1 + (t.startsWith(mots[0]) ? 2 : 0) + (t.split(/\s+/).some((w) => w.startsWith(mots[0])) ? 1 : 0);
}

const PAR_GENRE = 6;

/**
 * Recherche globale (Ctrl+K ou ⌘K) : personnes, documents, registres, lieux, recherches et pages, depuis n'importe où.
 * Flèches pour choisir, Entrée pour ouvrir.
 */
export function RechercheGlobale({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [texte, setTexte] = useState("");
  const [actif, setActif] = useState(0);
  const liste = useRef<HTMLDivElement>(null);
  const { data: individus = [] } = useIndividus();
  const { nom, mention } = useNoms();
  const { data: lieux = [] } = useLieux();
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes, enabled: opened });
  const { data: registres = [] } = useQuery({ queryKey: ["registres"], queryFn: listeRegistres, enabled: opened });
  const { data: recherches = [] } = useQuery({ queryKey: ["toutes-recherches"], queryFn: toutesRecherches, enabled: opened });

  useEffect(() => {
    if (opened) {
      setTexte("");
      setActif(0);
    }
  }, [opened]);

  const resultats = useMemo<Resultat[]>(() => {
    const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
    if (!mots.length) return [];
    const aller = (to: string, params?: Record<string, string>) => () => navigate({ to, params } as never);
    const meilleurs = (r: Resultat[]) => r.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, PAR_GENRE);
    const pages = [
      ["Accueil", "/"], ["Documents", "/documents"], ["Photos", "/photos"], ["Individus", "/individus"], ["Arbre", "/arbre"],
      ["Cartographie", "/cartographie"], ["Recherches", "/recherches"], ["Lieux", "/lieux"], ["Présentation", "/presentation"],
    ];
    return [
      ...meilleurs(
        individus.map((i) => ({
          cle: `i-${i.id}`,
          genre: "Personnes",
          icone: IconUser,
          titre: nom(i),
          detail: [i.naissance && `° ${i.naissance}`, i.naissanceLieuNom, i.deces && `† ${i.deces}`].filter(Boolean).join(" · "),
          aller: aller("/individus/$individuId", { individuId: i.id }),
          // La mention des homonymes (« Denault », « l'aîné ») compte aussi : « veillon denault » trouve le bon François.
          score: score(`${i.nom ?? ""} ${i.prenoms ?? ""} ${i.prenoms ?? ""} ${i.nom ?? ""} ${mention(i.id) ?? ""}`, mots),
        })),
      ),
      ...meilleurs(
        actes.map((a) => ({
          cle: `a-${a.id}`,
          genre: "Documents",
          icone: a.nature === "photo" ? IconPhoto : IconFileText,
          titre: a.titre,
          detail: [a.date, a.lieuNom, a.sourceTitre].filter(Boolean).join(" · "),
          aller: aller("/actes/$acteId", { acteId: a.id }),
          score: score(`${a.titre} ${a.lieuNom ?? ""} ${a.date ?? ""}`, mots),
        })),
      ),
      ...meilleurs(
        registres.map((r) => ({
          cle: `r-${r.id}`,
          genre: "Registres et albums",
          icone: IconBook2,
          titre: r.titre,
          detail: [r.typeRegistre, r.periode, r.cote].filter(Boolean).join(" · "),
          aller: aller("/registres/$sourceId", { sourceId: r.id }),
          score: score(`${r.titre} ${r.cote ?? ""} ${r.lieuNom ?? ""}`, mots),
        })),
      ),
      ...meilleurs(
        lieux.map((l) => ({
          cle: `l-${l.id}`,
          genre: "Lieux",
          icone: IconMapPin,
          titre: l.departement ? `${l.nom} (${l.departement})` : l.nom,
          aller: aller("/lieux"),
          score: score(l.nom, mots),
        })),
      ),
      ...meilleurs(
        recherches.map((r) => ({
          cle: `t-${r.id}`,
          genre: "Recherches",
          icone: IconListSearch,
          titre: r.titre,
          detail: r.individuId ? nom({ id: r.individuId, nom: r.individuNom, prenoms: r.individuPrenoms }) : undefined,
          aller: r.individuId ? aller("/individus/$individuId", { individuId: r.individuId }) : aller("/recherches"),
          score: score(`${r.titre} ${r.individuNom ?? ""} ${r.individuPrenoms ?? ""}`, mots),
        })),
      ),
      ...meilleurs(pages.map(([titre, to]) => ({ cle: `p-${to}`, genre: "Pages", icone: IconSearch, titre, aller: aller(to), score: score(titre, mots) }))),
    ];
  }, [texte, individus, actes, registres, lieux, recherches, navigate, nom, mention]);

  useEffect(() => setActif(0), [texte]);
  useEffect(() => {
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  const ouvrir = (r: Resultat | undefined) => {
    if (!r) return;
    onClose();
    r.aller();
  };

  let index = -1;
  const groupes = Map.groupBy(resultats, (r) => r.genre);

  return (
    <Modal opened={opened} onClose={onClose} withCloseButton={false} size="lg" padding={0} yOffset="10vh" radius="md">
      <TextInput
        size="lg"
        variant="unstyled"
        px="md"
        placeholder="Rechercher une personne, un document, un lieu…"
        leftSection={<IconSearch size={20} />}
        value={texte}
        onChange={(e) => setTexte(e.currentTarget.value)}
        data-autofocus
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActif((a) => Math.min(a + 1, resultats.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActif((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            ouvrir(resultats[actif]);
          }
        }}
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
      />
      <ScrollArea.Autosize mah="60vh" viewportRef={liste}>
        {texte.trim() && !resultats.length && (
          <Text c="dimmed" size="sm" p="md">
            Rien ne correspond à « {texte} ».
          </Text>
        )}
        {!texte.trim() && (
          <Text c="dimmed" size="sm" p="md">
            Tapez un nom, un prénom, un titre de document, un lieu… <Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> pour choisir,{" "}
            <Kbd size="xs">Entrée</Kbd> pour ouvrir.
          </Text>
        )}
        <Stack gap={0} pb="xs">
          {[...groupes].map(([genre, rs]) => (
            <Box key={genre}>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" px="md" pt="sm" pb={4}>
                {genre}
              </Text>
              {rs.map((r) => {
                index++;
                const i = index;
                const choisi = i === actif;
                return (
                  <UnstyledButton
                    key={r.cle}
                    data-index={i}
                    w="100%"
                    px="md"
                    py={6}
                    onMouseEnter={() => setActif(i)}
                    onClick={() => ouvrir(r)}
                    style={{ background: choisi ? "var(--t-fond-accent)" : undefined }}
                  >
                    <Group gap="sm" wrap="nowrap">
                      <r.icone size={18} color="var(--mantine-color-teal-6)" style={{ flexShrink: 0 }} />
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={500} truncate>
                          {r.titre}
                        </Text>
                        {r.detail && (
                          <Text size="xs" c="dimmed" truncate>
                            {r.detail}
                          </Text>
                        )}
                      </Box>
                      {choisi && (
                        <Badge size="xs" variant="light">
                          Entrée
                        </Badge>
                      )}
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Box>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Modal>
  );
}

/** Raccourci clavier global et état d'ouverture. */
export function useRechercheGlobale() {
  const [ouverte, setOuverte] = useState(false);
  useHotkeys([
    ["mod+K", () => setOuverte(true)],
    ["/", () => setOuverte(true)],
  ]);
  return { ouverte, ouvrir: () => setOuverte(true), fermer: () => setOuverte(false) };
}
