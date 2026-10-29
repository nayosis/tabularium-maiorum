import { useState } from "react";
import {
  ActionIcon, Badge, Button, Group, Paper, ScrollArea, Select, Stack, Table, Text, TextInput, Title, Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconCurrentLocation, IconFileText, IconHeart, IconId, IconMapPin, IconMapPinOff, IconPlus, IconSearch, IconTrash, IconUser, IconBook2,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { Lieu } from "../db/schema";
import { creerLieu, majLieu, rattachementsLieu, supprimerLieu, usagesLieux, type UsagesLieu } from "../data/lieux";
import { useLieux } from "../components/selects";
import { CarteLieux, trouverCommune } from "../components/CarteLieux";
import { AnchorLink } from "../components/AnchorLink";
import { useAutoSave } from "../hooks/useAutoSave";
import { ecrire } from "../lib/query";
import { LECTURE_SEULE } from "../lib/mode";
import { Lecture } from "../components/Lecture";
import { nomComplet } from "../lib/libelles";
import { afficherDate } from "../lib/dates";
import { chercherCommunes, communeCorrespondante, libelleCommune, type CommuneOfficielle } from "../lib/communes";
import { lieuxRoute, type FiltreLieux } from "../router";

const FILTRES: { value: FiltreLieux; label: string }[] = [
  { value: "tous", label: "Tous les lieux" },
  { value: "personnes", label: "Liés à une personne" },
  { value: "actes", label: "Liés à un document" },
  { value: "registres", label: "Liés à un registre" },
  { value: "inutilises", label: "Rattachés à rien" },
  { value: "non-places", label: "Pas placés sur la carte" },
  { value: "sans-insee", label: "Sans code INSEE" },
];

const AUCUN: UsagesLieu = { personnes: 0, unions: 0, actes: 0, registres: 0 };
const total = (u: UsagesLieu) => u.personnes + u.unions + u.actes + u.registres;
const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function garder(f: FiltreLieux, l: Lieu, u: UsagesLieu) {
  switch (f) {
    case "personnes":
      return u.personnes + u.unions > 0;
    case "actes":
      return u.actes > 0;
    case "registres":
      return u.registres > 0;
    case "inutilises":
      return total(u) === 0;
    case "non-places":
      return l.latitude == null || l.longitude == null;
    case "sans-insee":
      return !l.codeInsee?.trim();
    default:
      return true;
  }
}

/** « 3 pers. · 1 union · 2 doc. · 1 reg. » */
function resumeUsages(u: UsagesLieu) {
  const parties = [
    u.personnes && `${u.personnes} pers.`,
    u.unions && `${u.unions} union${u.unions > 1 ? "s" : ""}`,
    u.actes && `${u.actes} doc.`,
    u.registres && `${u.registres} reg.`,
  ].filter(Boolean);
  return parties.join(" · ");
}

/** Code INSEE, département (s'il manque) et point sur la carte (s'il manque) depuis la commune officielle. */
const patchCommune = (l: Lieu, c: CommuneOfficielle): Partial<Lieu> => ({
  codeInsee: c.code,
  ...(!l.departement?.trim() && { departement: c.departement }),
  ...((l.latitude == null || l.longitude == null) && c.lat != null && { latitude: c.lat, longitude: c.lng }),
});

export function Lieux() {
  const recherche = lieuxRoute.useSearch();
  const { data: lieux = [] } = useLieux();
  const { data: usages = {} } = useQuery({ queryKey: ["lieux-usages"], queryFn: usagesLieux });
  const [nom, setNom] = useState("");
  const [filtre, setFiltre] = useState<FiltreLieux>(recherche.filtre ?? "tous");
  const [texte, setTexte] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(recherche.lieu ?? null);
  const [enCours, setEnCours] = useState(false);
  const [candidats, setCandidats] = useState<{ lieuId: string; communes: CommuneOfficielle[] } | null>(null);
  const [completion, setCompletion] = useState<string | null>(null);
  const selection = lieux.find((l) => l.id === selectionId);
  const places = lieux.filter((l) => l.latitude != null && l.longitude != null).length;
  const sansInsee = lieux.filter((l) => !l.codeInsee?.trim());
  const usage = (id: string) => usages[id] ?? AUCUN;
  const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
  const affiches = lieux.filter(
    (l) => garder(filtre, l, usage(l.id)) && mots.every((m) => sansAccents(`${l.nom} ${l.departement ?? ""} ${l.codeInsee ?? ""}`).includes(m)),
  );

  const choisir = (id: string | null) => {
    setSelectionId(id);
    setCandidats(null);
  };

  const ajouter = async () => {
    if (!nom.trim()) return;
    const id = await ecrire(() => creerLieu(nom.trim()));
    setNom("");
    if (id) choisir(id);
  };

  const placer = (lieuId: string, lat: number | null, lng: number | null) => ecrire(() => majLieu(lieuId, { latitude: lat, longitude: lng }));

  const appliquer = async (l: Lieu, c: CommuneOfficielle) => {
    await ecrire(() => majLieu(l.id, patchCommune(l, c)));
    setCandidats(null);
    notifications.show({ color: "teal", message: `${l.nom} : ${libelleCommune(c)}` });
  };

  /** Commune officielle : appliquée si elle est sans ambiguïté, sinon proposée au choix ; à défaut, OpenStreetMap pour le point. */
  const trouver = async () => {
    if (!selection) return;
    setEnCours(true);
    setCandidats(null);
    try {
      const communes = await chercherCommunes(selection.nom, selection.departement);
      const bonne = communeCorrespondante(selection.nom, selection.departement, communes);
      if (bonne) return await appliquer(selection, bonne);
      if (communes.length) return setCandidats({ lieuId: selection.id, communes });
      const pos = selection.latitude == null ? await trouverCommune(selection.nom, selection.departement) : null;
      if (pos) {
        await placer(selection.id, pos.lat, pos.lng);
        notifications.show({ color: "yellow", message: `Pas de code INSEE pour « ${selection.nom} » (commune disparue ?) ; point placé d'après OpenStreetMap.` });
      } else
        notifications.show({
          color: "yellow",
          message: `« ${selection.nom} »${selection.departement ? ` (${selection.departement})` : ""} introuvable (orthographe, commune renommée ou absorbée ?) : complétez à la main, et placez le point sur la carte.`,
        });
    } catch (e) {
      notifications.show({ color: "red", title: "Recherche impossible", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnCours(false);
    }
  };

  /** Tous les lieux sans code INSEE : seulement les correspondances sans ambiguïté ; les autres restent à choisir à la main. */
  const completerTout = async () => {
    let faits = 0;
    let erreurs = 0;
    setEnCours(true);
    try {
      for (const [k, l] of sansInsee.entries()) {
        setCompletion(`${k + 1} / ${sansInsee.length}`);
        try {
          const bonne = communeCorrespondante(l.nom, l.departement, await chercherCommunes(l.nom, l.departement));
          if (bonne) {
            await majLieu(l.id, patchCommune(l, bonne));
            faits++;
          }
        } catch {
          erreurs++;
        }
      }
    } finally {
      await ecrire(async () => undefined);
      setEnCours(false);
      setCompletion(null);
    }
    const restent = sansInsee.length - faits;
    notifications.show({
      color: restent ? "yellow" : "teal",
      autoClose: 10000,
      message:
        `${faits} code${faits > 1 ? "s" : ""} INSEE complété${faits > 1 ? "s" : ""}.` +
        (restent ? ` ${restent} lieu${restent > 1 ? "x" : ""} à choisir à la main (filtre « Sans code INSEE », puis « Trouver la commune »).` : "") +
        (erreurs ? ` ${erreurs} recherche${erreurs > 1 ? "s" : ""} en erreur.` : ""),
    });
    if (restent) setFiltre("sans-insee");
  };

  const supprimer = (l: Lieu) => {
    const u = usage(l.id);
    if (!total(u)) return ecrire(() => supprimerLieu(l.id));
    modals.openConfirmModal({
      title: `Supprimer « ${l.nom} » ?`,
      children: (
        <Text size="sm">
          Ce lieu est encore utilisé ({resumeUsages(u)}). Ces fiches, documents et registres n'auront plus de lieu. Pour une faute
          d'orthographe, mieux vaut corriger le nom.
        </Text>
      ),
      labels: { confirm: "Supprimer quand même", cancel: "Annuler" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        if (selectionId === l.id) choisir(null);
        ecrire(() => supprimerLieu(l.id));
      },
    });
  };

  return (
    <Stack p="lg" gap="md" h="100%">
      <Group justify="space-between">
        <Group gap="xs">
          <Title order={2}>Lieux</Title>
          <Badge variant="light">
            {places} / {lieux.length} placés sur la carte
          </Badge>
          {sansInsee.length > 0 && (
            <Badge variant="light" color="gray">
              {sansInsee.length} sans code INSEE
            </Badge>
          )}
        </Group>
        <Group display={LECTURE_SEULE ? "none" : undefined}>
          {sansInsee.length > 0 && (
            <Tooltip label="Interroge le service officiel des communes (geo.api.gouv.fr) ; n'applique que les correspondances sans ambiguïté">
              <Button variant="default" leftSection={<IconId size={16} />} loading={enCours && !!completion} onClick={completerTout}>
                {completion ?? "Compléter les codes INSEE"}
              </Button>
            </Tooltip>
          )}
          <TextInput placeholder="Nom de la commune" value={nom} onChange={(e) => setNom(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && ajouter()} />
          <Button leftSection={<IconPlus size={16} />} onClick={ajouter} disabled={!nom.trim()}>
            Ajouter
          </Button>
        </Group>
      </Group>

      <Group align="stretch" gap="md" wrap="nowrap" flex={1} style={{ minHeight: 0 }}>
        <Stack w="50%" miw={480} gap="xs" style={{ minHeight: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Select data={FILTRES} value={filtre} onChange={(v) => setFiltre((v as FiltreLieux) ?? "tous")} allowDeselect={false} w={220} />
            <TextInput
              placeholder="Chercher un lieu"
              leftSection={<IconSearch size={14} />}
              value={texte}
              onChange={(e) => setTexte(e.currentTarget.value)}
              flex={1}
            />
            <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {affiches.length} / {lieux.length}
            </Text>
          </Group>
          <ScrollArea flex={1}>
            <Lecture>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={28} />
                    <Table.Th>Commune</Table.Th>
                    <Table.Th w={60}>Dépt</Table.Th>
                    <Table.Th w={80}>INSEE</Table.Th>
                    <Table.Th w={90}>Latitude</Table.Th>
                    <Table.Th w={90}>Longitude</Table.Th>
                    <Table.Th w={120}>Rattaché à</Table.Th>
                    {!LECTURE_SEULE && <Table.Th w={40} />}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {affiches.map((l) => (
                    // Remonté quand la base change (carte, commune officielle) : champs à jour.
                    <LigneLieu
                      key={`${l.id}-${l.latitude}-${l.longitude}-${l.codeInsee}-${l.departement}`}
                      lieu={l}
                      usages={usage(l.id)}
                      selectionne={l.id === selectionId}
                      onSelect={() => choisir(l.id)}
                      onSupprimer={() => supprimer(l)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
              {!affiches.length && (
                <Text size="sm" c="dimmed" ta="center" p="md">
                  Aucun lieu ne correspond.
                </Text>
              )}
            </Lecture>
          </ScrollArea>
        </Stack>

        <Stack gap="xs" flex={1} style={{ minWidth: 0 }}>
          <Paper withBorder p="xs">
            {selection ? (
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">
                    <b>{selection.departement ? `${selection.nom} (${selection.departement})` : selection.nom}</b>
                    {selection.codeInsee && (
                      <Text span c="dimmed" size="sm">
                        {" "}
                        · INSEE {selection.codeInsee}
                      </Text>
                    )}
                    {!LECTURE_SEULE && (
                      <Text span c="dimmed" size="sm">
                        {" "}
                        — cliquez sur la carte pour {selection.latitude != null ? "déplacer" : "placer"} son point
                      </Text>
                    )}
                  </Text>
                  {!LECTURE_SEULE && (
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Code INSEE, département et point, depuis le service officiel des communes">
                        <Button size="xs" variant="light" leftSection={<IconCurrentLocation size={14} />} loading={enCours && !completion} onClick={trouver}>
                          Trouver la commune
                        </Button>
                      </Tooltip>
                      {selection.latitude != null && (
                        <Tooltip label="Retirer le point">
                          <ActionIcon variant="subtle" color="red" onClick={() => placer(selection.id, null, null)}>
                            <IconMapPinOff size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  )}
                </Group>
                {candidats?.lieuId === selection.id && (
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      Plusieurs communes possibles (ou un nom proche) : choisissez la bonne.
                    </Text>
                    {candidats.communes.map((c) => (
                      <Group key={`${c.type}-${c.code}-${c.nom}`} justify="space-between" wrap="nowrap">
                        <Text size="sm">{libelleCommune(c)}</Text>
                        <Button size="compact-xs" variant="subtle" onClick={() => appliquer(selection, c)}>
                          Utiliser
                        </Button>
                      </Group>
                    ))}
                  </Stack>
                )}
                <Rattachements lieuId={selection.id} />
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {LECTURE_SEULE
                  ? "Cliquez sur un lieu ou un point pour le voir sur la carte."
                  : "Choisissez un lieu dans la liste (ou un point sur la carte) : vous verrez ce qui s'y rattache, et pourrez placer son point."}
              </Text>
            )}
          </Paper>
          <div style={{ flex: 1, minHeight: 300 }}>
            <CarteLieux
              lieux={lieux}
              selectionId={selectionId}
              onSelect={choisir}
              onPlacer={LECTURE_SEULE ? undefined : (lat, lng) => selection && placer(selection.id, lat, lng)}
            />
          </div>
        </Stack>
      </Group>
    </Stack>
  );
}

/** Ce qui renvoie au lieu : personnes, unions, documents, registres, avec un lien vers chacun. */
function Rattachements({ lieuId }: { lieuId: string }) {
  const { data: r } = useQuery({ queryKey: ["lieu-rattachements", lieuId], queryFn: () => rattachementsLieu(lieuId) });
  if (!r) return null;
  const vide = !r.personnes.length && !r.unions.length && !r.actes.length && !r.registres.length;
  if (vide)
    return (
      <Text size="xs" c="dimmed">
        Rattaché à rien : ni personne, ni union, ni document, ni registre.
      </Text>
    );
  const titre = (Icone: typeof IconUser, libelle: string, n: number) => (
    <Group gap={4} mt={4}>
      <Icone size={14} color="var(--mantine-color-teal-6)" />
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">
        {libelle} ({n})
      </Text>
    </Group>
  );
  return (
    <ScrollArea.Autosize mah={220}>
      <Stack gap={2}>
        {!!r.personnes.length && titre(IconUser, "Personnes", r.personnes.length)}
        {r.personnes.map((p) => (
          <Text key={p.id} size="sm">
            <AnchorLink to="/individus/$individuId" params={{ individuId: p.id }} size="sm">
              {nomComplet(p)}
            </AnchorLink>{" "}
            <Text span size="xs" c="dimmed">
              {[p.nee && "naissance", p.decedee && "décès"].filter(Boolean).join(" et ")}
            </Text>
          </Text>
        ))}
        {!!r.unions.length && titre(IconHeart, "Unions", r.unions.length)}
        {r.unions.map((u) => (
          <Text key={u.id} size="sm">
            {u.conjoints.map((c, k) => (
              <span key={c.id}>
                {k > 0 && " ∞ "}
                <AnchorLink to="/individus/$individuId" params={{ individuId: c.id }} size="sm">
                  {nomComplet(c)}
                </AnchorLink>
              </span>
            ))}
            {u.date && (
              <Text span size="xs" c="dimmed">
                {" "}
                {afficherDate(u.date)}
              </Text>
            )}
          </Text>
        ))}
        {!!r.actes.length && titre(IconFileText, "Documents", r.actes.length)}
        {r.actes.map((a) => (
          <AnchorLink key={a.id} to="/actes/$acteId" params={{ acteId: a.id }} size="sm" display="block">
            {a.titre}
          </AnchorLink>
        ))}
        {!!r.registres.length && titre(IconBook2, "Registres", r.registres.length)}
        {r.registres.map((s) => (
          <AnchorLink key={s.id} to="/registres/$sourceId" params={{ sourceId: s.id }} size="sm" display="block">
            {s.titre}
          </AnchorLink>
        ))}
      </Stack>
    </ScrollArea.Autosize>
  );
}

const nombre = (s: string) => (s.trim() === "" || isNaN(+s.replace(",", ".")) ? null : +s.replace(",", "."));

function LigneLieu({
  lieu,
  usages,
  selectionne,
  onSelect,
  onSupprimer,
}: {
  lieu: Lieu;
  usages: UsagesLieu;
  selectionne: boolean;
  onSelect: () => void;
  onSupprimer: () => void;
}) {
  const { valeurs, modifier } = useAutoSave(
    {
      nom: lieu.nom,
      departement: lieu.departement ?? "",
      codeInsee: lieu.codeInsee ?? "",
      latitude: lieu.latitude?.toString() ?? "",
      longitude: lieu.longitude?.toString() ?? "",
    },
    (p) =>
      majLieu(lieu.id, {
        ...(p.nom !== undefined && { nom: p.nom }),
        ...(p.departement !== undefined && { departement: p.departement || null }),
        ...(p.codeInsee !== undefined && { codeInsee: p.codeInsee || null }),
        ...(p.latitude !== undefined && { latitude: nombre(p.latitude) }),
        ...(p.longitude !== undefined && { longitude: nombre(p.longitude) }),
      }),
  );
  const champ = (k: keyof typeof valeurs) => ({
    size: "xs" as const,
    value: valeurs[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => modifier({ [k]: e.currentTarget.value }),
  });
  const place = lieu.latitude != null && lieu.longitude != null;
  const resume = resumeUsages(usages);
  return (
    <Table.Tr onClick={onSelect} bg={selectionne ? "var(--t-fond-accent)" : undefined} style={{ cursor: "pointer" }}>
      <Table.Td>
        <IconMapPin size={16} color={place ? "var(--mantine-color-blue-6)" : "var(--t-inactif)"} />
      </Table.Td>
      <Table.Td><TextInput {...champ("nom")} /></Table.Td>
      <Table.Td><TextInput {...champ("departement")} /></Table.Td>
      <Table.Td><TextInput {...champ("codeInsee")} /></Table.Td>
      <Table.Td><TextInput {...champ("latitude")} /></Table.Td>
      <Table.Td><TextInput {...champ("longitude")} /></Table.Td>
      <Table.Td>
        <Text size="xs" c={resume ? undefined : "dimmed"}>
          {resume || "rien"}
        </Text>
      </Table.Td>
      {!LECTURE_SEULE && (
        <Table.Td>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onSupprimer();
            }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Table.Td>
      )}
    </Table.Tr>
  );
}
