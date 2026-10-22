import { useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Badge, Box, Button, Drawer, Group, Paper, ScrollArea, SegmentedControl, Select, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconGenderFemale, IconGenderMale, IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cartographieRoute } from "../../router";
import { donneesArbre } from "../../data/individus";
import { listeActes } from "../../data/actes";
import { IndividuSelect, useIndividus, useLieux } from "../../components/selects";
import { AnchorLink } from "../../components/AnchorLink";
import { nomComplet } from "../../lib/libelles";
import {
  couleurGeneration, estPlace, lieuNaissance, lignee, pointsAscendance, pointsDescendance, regrouperParLieu, texteSur, type PointCarte,
} from "../../lib/cartographie";
import { dates } from "../arbre/disposition";
import { useMemoire } from "../../lib/onglets";
import { utilisateur } from "../../lib/session";
import { useEcran } from "../../lib/ecran";
import { ajouterFond } from "../../lib/configuration";

const CLE_RACINE = "tabularium.arbre.racine";
const lireRacine = () => {
  try {
    return localStorage.getItem(CLE_RACINE);
  } catch {
    return null;
  }
};
const ecrireRacine = (id: string) => {
  try {
    localStorage.setItem(CLE_RACINE, id);
  } catch {
    // stockage indisponible : sans importance
  }
};

type Sens = "ascendance" | "descendance";

const GENERATIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "10", "12"].map((v) => ({ value: v, label: `${v} générations` }));
const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Délai entre deux générations pendant l'animation. */
const PAS_ANIMATION = 1200;

const libelleGeneration = (g: number, sens: Sens) => {
  if (g === 0) return "Personne choisie";
  if (sens === "ascendance") return g === 1 ? "Génération 1 · parents" : g === 2 ? "Génération 2 · grands-parents" : g === 3 ? "Génération 3 · arrière-grands-parents" : `Génération ${g}`;
  return g === 1 ? "Génération 1 · enfants" : g === 2 ? "Génération 2 · petits-enfants" : g === 3 ? "Génération 3 · arrière-petits-enfants" : `Génération ${g}`;
};
const libelleCourt = (g: number, sens: Sens) => {
  if (g === 0) return "Personne";
  const noms = sens === "ascendance" ? ["Parents", "Grands-parents", "Arrière-grands-parents"] : ["Enfants", "Petits-enfants", "Arrière-petits-enfants"];
  return noms[g - 1] ?? `Génération ${g}`;
};

const lieuTexte = (l: NonNullable<PointCarte["lieu"]>) => `${echapper(l.nom)}${l.departement ? ` (${echapper(l.departement)})` : ""}`;
const puce = (g: number) =>
  `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${couleurGeneration(g)};margin-right:5px;vertical-align:-1px"></span>`;

/** Pastille d'un lieu : la personne (couleur et étiquette de sa génération), ou un anneau coloré « ×n » s'il y en a plusieurs. */
function iconeLieu(pts: PointCarte[], estompe: boolean) {
  const racine = pts.some((p) => p.generation === 0);
  const anneau = racine ? "box-shadow:0 0 0 3px #fab005,0 1px 4px rgba(0,0,0,.45)" : "box-shadow:0 1px 4px rgba(0,0,0,.45)";
  const opacite = estompe ? "opacity:.3;" : "";
  if (pts.length === 1) {
    const p = pts[0];
    const fond = couleurGeneration(p.generation);
    const largeur = Math.max(24, 10 + p.etiquette.length * 7);
    return L.divIcon({
      className: "carto-marqueur",
      html: `<div style="${opacite}background:${fond};color:${texteSur(fond)};border:2px solid white;border-radius:12px;height:24px;width:${largeur}px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:600 12px system-ui,sans-serif;${anneau}">${echapper(p.etiquette)}</div>`,
      iconSize: [largeur, 24],
      iconAnchor: [largeur / 2, 12],
    });
  }
  const part = 100 / pts.length;
  const parts = pts.map((p, i) => `${couleurGeneration(p.generation)} ${i * part}% ${(i + 1) * part}%`).join(",");
  const taille = pts.length > 9 ? 40 : 34;
  return L.divIcon({
    className: "carto-marqueur",
    html: `<div style="${opacite}width:${taille}px;height:${taille}px;border-radius:50%;background:conic-gradient(${parts});border:2px solid white;box-sizing:border-box;display:flex;align-items:center;justify-content:center;${anneau}"><div style="background:white;border-radius:50%;width:${taille - 14}px;height:${taille - 14}px;display:flex;align-items:center;justify-content:center;font:700 10px system-ui,sans-serif;color:#212529">×${pts.length}</div></div>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
}

type PropsCarte = {
  /** Points affichés (filtres et animation appliqués). */
  points: PointCarte[];
  /** Tous les points : la carte n'est recadrée que quand ils changent. */
  tous: PointCarte[];
  selection: string | null;
  onSelect: (id: string) => void;
  survolPersonne: string | null;
  onSurvolLieu: (lieuId: string | null) => void;
  focus: { id: string; n: number } | null;
};

/** Carte : une pastille par lieu de naissance, traits discrets ; la lignée de la personne sélectionnée mise en avant. */
function Carte({ points, tous, selection, onSelect, survolPersonne, onSurvolLieu, focus }: PropsCarte) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const calque = useRef<L.LayerGroup | null>(null);
  /** Marqueur par lieu, et lieu de chaque personne placée. */
  const marqueurs = useRef(new Map<string, L.Marker>());
  const lieuDe = useRef(new Map<string, string>());
  // Les rappels changent à chaque rendu : on garde les derniers sans redessiner la carte.
  const rappels = useRef({ onSelect, onSurvolLieu });
  rappels.current = { onSelect, onSurvolLieu };

  useEffect(() => {
    if (!conteneur.current) return;
    const m = L.map(conteneur.current).setView([46.6, 2.4], 6);
    ajouterFond(m);
    carte.current = m;
    calque.current = L.layerGroup().addTo(m);
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(conteneur.current);
    return () => {
      obs.disconnect();
      m.remove();
      carte.current = null;
    };
  }, []);

  // Cadrage : seulement quand l'ensemble des personnes change (pas pendant l'animation ni au filtrage).
  const signature = tous.filter(estPlace).map((p) => p.personne.id).join(",");
  useEffect(() => {
    const m = carte.current;
    if (!m) return;
    const tousPlaces = tous.filter(estPlace).map((p) => [p.lieu!.latitude!, p.lieu!.longitude!] as L.LatLngTuple);
    if (tousPlaces.length === 1) m.setView(tousPlaces[0], 10);
    else if (tousPlaces.length > 1) m.fitBounds(L.latLngBounds(tousPlaces), { padding: [50, 50], maxZoom: 11 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const c = calque.current;
    if (!c) return;
    c.clearLayers();
    marqueurs.current.clear();
    lieuDe.current.clear();
    const parId = new Map(points.map((p) => [p.personne.id, p]));
    const position = (id: string | null) => {
      const p = id ? parId.get(id) : undefined;
      return p && estPlace(p) ? ([p.lieu!.latitude!, p.lieu!.longitude!] as L.LatLngTuple) : null;
    };
    const chaine = new Set(selection ? lignee(points, selection) : []);

    // Traits parent–enfant : gris et discrets ; ceux de la lignée sélectionnée, épais et colorés.
    for (const p of points) {
      const a = position(p.personne.id);
      const b = position(p.relieA);
      if (!a || !b) continue;
      const enLignee = chaine.has(p.personne.id) && chaine.has(p.relieA!);
      if (!enLignee) L.polyline([a, b], { color: "#495057", weight: 1.5, opacity: selection ? 0.12 : 0.3, interactive: false }).addTo(c);
    }
    for (const p of points) {
      const a = position(p.personne.id);
      const b = position(p.relieA);
      if (a && b && chaine.has(p.personne.id) && chaine.has(p.relieA!))
        L.polyline([a, b], { color: couleurGeneration(p.generation), weight: 5, opacity: 0.9, interactive: false }).addTo(c);
    }

    for (const { lieu, points: pts } of regrouperParLieu(points)) {
      const estompe = chaine.size > 0 && !pts.some((p) => chaine.has(p.personne.id));
      const lignes = pts
        .slice(0, 12)
        .map((p) => `${puce(p.generation)}<b>${echapper(p.etiquette)}</b> · ${echapper(nomComplet(p.personne))}${dates(p.personne) ? ` <span style="color:#868e96">${echapper(dates(p.personne))}</span>` : ""}`)
        .join("<br>");
      const reste = pts.length > 12 ? `<br><i>… et ${pts.length - 12} autres</i>` : "";
      const marqueur = L.marker([lieu.latitude!, lieu.longitude!], {
        icon: iconeLieu(pts, estompe),
        zIndexOffset: pts.some((p) => p.generation === 0) ? 1000 : estompe ? -1000 : 0,
      })
        .bindTooltip(`<b>${lieuTexte(lieu)}</b><br>${lignes}${reste}`, { direction: "top", offset: [0, -14] })
        .on("mouseover", () => rappels.current.onSurvolLieu(lieu.id))
        .on("mouseout", () => rappels.current.onSurvolLieu(null))
        .addTo(c);

      if (pts.length === 1) {
        marqueur.on("click", () => rappels.current.onSelect(pts[0].personne.id));
      } else {
        // Plusieurs personnes : une liste où choisir.
        const menu = L.DomUtil.create("div");
        menu.innerHTML = `<div style="font-weight:700;margin-bottom:4px">Nés à ${lieuTexte(lieu)}</div>`;
        for (const p of pts) {
          const bouton = L.DomUtil.create("div", "", menu);
          bouton.style.cssText = "cursor:pointer;padding:2px 4px;border-radius:4px;white-space:nowrap";
          bouton.innerHTML = `${puce(p.generation)}<b>${echapper(p.etiquette)}</b> · ${echapper(nomComplet(p.personne))}`;
          bouton.onmouseenter = () => (bouton.style.background = "#f1f3f5");
          bouton.onmouseleave = () => (bouton.style.background = "");
          bouton.onclick = () => {
            marqueur.closePopup();
            rappels.current.onSelect(p.personne.id);
          };
        }
        marqueur.bindPopup(menu, { maxHeight: 280, offset: [0, -10] });
        marqueur.on("popupopen", () => marqueur.closeTooltip());
      }
      marqueurs.current.set(lieu.id, marqueur);
      for (const p of pts) lieuDe.current.set(p.personne.id, lieu.id);
    }
  }, [points, selection]);

  // Survol d'une personne dans la liste : sa pastille pulse.
  useEffect(() => {
    const lieuId = survolPersonne ? lieuDe.current.get(survolPersonne) : undefined;
    const el = lieuId ? marqueurs.current.get(lieuId)?.getElement() : undefined;
    el?.classList.add("carto-pulse");
    return () => el?.classList.remove("carto-pulse");
  }, [survolPersonne, points, selection]);

  useEffect(() => {
    if (!focus) return;
    const lieuId = lieuDe.current.get(focus.id);
    const mq = lieuId ? marqueurs.current.get(lieuId) : undefined;
    if (!mq || !carte.current) return;
    carte.current.setView(mq.getLatLng(), Math.max(carte.current.getZoom(), 9));
  }, [focus]);

  return <div ref={conteneur} style={{ height: "100%", width: "100%" }} />;
}

/** Légende des générations : un clic masque / réaffiche ; lecture pour les faire apparaître une à une. */
function Legende({
  generations, sens, masquees, onBasculer, jusqua, lecture, onLecture, onPause, onArret,
}: {
  generations: [number, number][];
  sens: Sens;
  masquees: number[];
  onBasculer: (g: number) => void;
  jusqua: number | null;
  lecture: boolean;
  onLecture: () => void;
  onPause: () => void;
  onArret: () => void;
}) {
  return (
    <Paper
      pos="absolute"
      bottom={8}
      left={8}
      right={8}
      p={6}
      shadow="sm"
      withBorder
      style={{ zIndex: 1, background: "rgba(255,255,255,.92)" }}
      onClick={(e) => e.stopPropagation()}
    >
      <Group gap={6} wrap="nowrap">
        <Group gap={2} wrap="nowrap">
          <Tooltip label={lecture ? "Pause" : "Faire apparaître les générations une à une"}>
            <ActionIcon variant="filled" onClick={lecture ? onPause : onLecture} aria-label={lecture ? "Pause" : "Lecture"}>
              {lecture ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            </ActionIcon>
          </Tooltip>
          {jusqua !== null && (
            <Tooltip label="Arrêter et tout afficher">
              <ActionIcon variant="default" onClick={onArret} aria-label="Arrêter">
                <IconPlayerStop size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        {jusqua !== null && (
          <Text size="sm" fw={600} style={{ whiteSpace: "nowrap" }}>
            {libelleGeneration(jusqua, sens)}
          </Text>
        )}
        <ScrollArea type="never" style={{ flex: 1 }}>
          <Group gap={4} wrap="nowrap">
            {generations.map(([g, n]) => {
              const masquee = masquees.includes(g) || (jusqua !== null && g > jusqua);
              return (
                <UnstyledButton
                  key={g}
                  onClick={() => onBasculer(g)}
                  px={8}
                  py={2}
                  style={{ borderRadius: 12, border: "1px solid var(--mantine-color-gray-3)", opacity: masquee ? 0.4 : 1, whiteSpace: "nowrap" }}
                  title={masquees.includes(g) ? "Afficher cette génération" : "Masquer cette génération"}
                >
                  <Group gap={5} wrap="nowrap">
                    <Box w={12} h={12} style={{ borderRadius: "50%", background: couleurGeneration(g), flexShrink: 0 }} />
                    <Text size="xs" td={masquees.includes(g) ? "line-through" : undefined}>
                      {g > 0 && <b>{g} · </b>}
                      {libelleCourt(g, sens)} ({n})
                    </Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Group>
        </ScrollArea>
      </Group>
    </Paper>
  );
}

export function Cartographie() {
  const { telephone } = useEcran();
  const [listeOuverte, setListeOuverte] = useState(false);
  const navigate = useNavigate();
  const recherche = cartographieRoute.useSearch();
  const { data: individus = [] } = useIndividus();
  const { data } = useQuery({ queryKey: ["arbre"], queryFn: donneesArbre });
  const { data: lieux = [] } = useLieux();
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const [sens, setSens] = useMemoire<Sens>("cartographie.sens", "ascendance");
  const [genAsc, setGenAsc] = useMemoire("cartographie.ascendance", "6");
  const [genDesc, setGenDesc] = useMemoire("cartographie.descendance", "4");
  const [masquees, setMasquees] = useMemoire<number[]>(`cartographie.masquees.${sens}`, []);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [survolPersonne, setSurvolPersonne] = useState<string | null>(null);
  const [survolLieu, setSurvolLieu] = useState<string | null>(null);
  const [jusqua, setJusqua] = useState<number | null>(null);
  const [lecture, setLecture] = useState(false);
  const listeRef = useRef<HTMLDivElement>(null);

  // Par défaut : la dernière personne affichée, sinon la fiche liée au compte, sinon la première.
  const racineId = recherche.racine ?? lireRacine() ?? utilisateur()?.individuId ?? individus[0]?.id ?? null;
  useEffect(() => {
    if (racineId) ecrireRacine(racineId);
  }, [racineId]);

  const points = useMemo(() => {
    if (!data || !racineId) return [];
    const parLieu = new Map(lieux.map((l) => [l.id, l]));
    const lieuActe = new Map(actes.map((a) => [a.id, a.lieuId]));
    const lieu = (p: PointCarte["personne"]) => lieuNaissance(p, parLieu, lieuActe);
    return sens === "ascendance" ? pointsAscendance(data, racineId, +genAsc, lieu) : pointsDescendance(data, racineId, +genDesc, lieu);
  }, [data, racineId, lieux, actes, sens, genAsc, genDesc]);

  const visible = (p: PointCarte) => !masquees.includes(p.generation) && (jusqua === null || p.generation <= jusqua);
  const visibles = useMemo(() => points.filter(visible), [points, masquees, jusqua]); // eslint-disable-line react-hooks/exhaustive-deps
  const places = points.filter(estPlace).length;
  const parGeneration = Map.groupBy(points, (p) => p.generation);
  const generations = [...parGeneration].map(([g, pts]) => [g, pts.length] as [number, number]);
  const maxGeneration = Math.max(0, ...points.map((p) => p.generation));
  const chaine = useMemo(() => new Set(selection ? lignee(points, selection) : []), [points, selection]);
  const selectionnee = selection ? points.find((p) => p.personne.id === selection) : undefined;

  // Nouvelle personne ou autre sens : on repart de zéro.
  useEffect(() => {
    setSelection(null);
    setJusqua(null);
    setLecture(false);
  }, [racineId, sens]);

  // Échap : désélectionner.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, []);

  // Animation : une génération de plus à chaque pas ; à la fin, tout réapparaît.
  useEffect(() => {
    if (!lecture) return;
    const t = setInterval(() => setJusqua((j) => ((j ?? 0) >= maxGeneration ? null : (j ?? 0) + 1)), PAS_ANIMATION);
    return () => clearInterval(t);
  }, [lecture, maxGeneration]);
  useEffect(() => {
    if (jusqua === null) setLecture(false);
  }, [jusqua]);

  // Survol d'une pastille : les personnes de ce lieu sont surlignées et amenées en vue dans la liste.
  useEffect(() => {
    if (!survolLieu) return;
    listeRef.current?.querySelector(`[data-lieu="${survolLieu}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [survolLieu]);

  const selectionner = (id: string) => {
    setSelection((s) => (s === id ? null : id));
    setFocus({ id, n: Date.now() });
    setListeOuverte(false);
  };
  const basculer = (g: number) => setMasquees(masquees.includes(g) ? masquees.filter((x) => x !== g) : [...masquees, g]);

  const liste = (
    <ScrollArea style={{ flex: 1 }} p="sm" viewportRef={listeRef}>
      {!points.length && (
        <Text size="sm" c="dimmed">
          Choisissez une personne.
        </Text>
      )}
      <Stack gap="md">
        {[...parGeneration].map(([g, pts]) => (
          <Box key={g} style={{ opacity: masquees.includes(g) ? 0.45 : 1 }}>
            <Group gap={6} mb={4} wrap="nowrap">
              <Box w={10} h={10} style={{ borderRadius: "50%", background: couleurGeneration(g), flexShrink: 0 }} />
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                {libelleGeneration(g, sens)} · {pts.length}
                {masquees.includes(g) && " · masquée"}
              </Text>
            </Group>
            <Stack gap={2}>
              {pts.map((p) => {
                const fond = couleurGeneration(p.generation);
                const enAvant = p.personne.id === selection || (!!p.lieu && p.lieu.id === survolLieu);
                const IconeSexe = p.personne.sexe === "M" ? IconGenderMale : p.personne.sexe === "F" ? IconGenderFemale : null;
                return (
                  <UnstyledButton
                    key={p.personne.id}
                    data-lieu={p.lieu?.id}
                    onClick={() => estPlace(p) && selectionner(p.personne.id)}
                    onMouseEnter={() => setSurvolPersonne(p.personne.id)}
                    onMouseLeave={() => setSurvolPersonne(null)}
                    px={4}
                    py={2}
                    style={{
                      borderRadius: 6,
                      cursor: estPlace(p) ? "pointer" : "default",
                      background: enAvant ? "var(--mantine-color-teal-0)" : undefined,
                      outline: p.personne.id === selection ? "2px solid var(--mantine-color-teal-5)" : undefined,
                      opacity: chaine.size && !chaine.has(p.personne.id) ? 0.55 : 1,
                    }}
                  >
                    <Group gap={8} wrap="nowrap">
                      <Badge color={fond} c={texteSur(fond)} variant="filled" size="sm" miw={34}>
                        {p.etiquette}
                      </Badge>
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" truncate>
                            {nomComplet(p.personne)}
                          </Text>
                          {IconeSexe && <IconeSexe size={13} color="var(--mantine-color-gray-6)" style={{ flexShrink: 0 }} />}
                        </Group>
                        <Text size="xs" c="dimmed" truncate>
                          {[dates(p.personne), p.lieu?.nom].filter(Boolean).join(" · ")}
                        </Text>
                      </Box>
                      {!p.lieu ? (
                        <Text size="xs" c="dimmed">
                          lieu inconnu
                        </Text>
                      ) : (
                        !estPlace(p) && (
                          <AnchorLink to="/lieux" size="xs" c="orange.8" onClick={(e) => e.stopPropagation()}>
                            à placer
                          </AnchorLink>
                        )
                      )}
                    </Group>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );

  return (
    <Stack h="100%" gap="sm" p="md" style={{ minHeight: 0 }}>
      <Group gap="sm">
        <IndividuSelect
          w={{ base: "100%", sm: 320 }}
          placeholder="Personne"
          value={racineId}
          onChange={(id) => id && navigate({ to: "/cartographie", search: { racine: id } })}
          clearable={false}
        />
        <SegmentedControl
          value={sens}
          onChange={(v) => setSens(v as Sens)}
          data={[
            { value: "ascendance", label: "Ascendance" },
            { value: "descendance", label: "Descendance" },
          ]}
        />
        <Select
          w={{ base: "100%", sm: 160 }}
          data={GENERATIONS}
          value={sens === "ascendance" ? genAsc : genDesc}
          onChange={(v) => v && (sens === "ascendance" ? setGenAsc(v) : setGenDesc(v))}
          allowDeselect={false}
        />
        <Text size="sm" c="dimmed">
          {places} / {points.length} placé{places > 1 ? "s" : ""} sur la carte · lieu de naissance
        </Text>
      </Group>

      <Group align="stretch" gap="sm" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
        <Paper withBorder style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <Carte
            points={visibles}
            tous={points}
            selection={selection}
            onSelect={selectionner}
            survolPersonne={survolPersonne}
            onSurvolLieu={setSurvolLieu}
            focus={focus}
          />
          {selectionnee && (
            <Paper pos="absolute" top={8} right={8} px="sm" py={6} shadow="sm" withBorder style={{ zIndex: 1, maxWidth: "calc(100% - 70px)" }}>
              <Group gap="xs" wrap="nowrap">
                <Box w={12} h={12} style={{ borderRadius: "50%", background: couleurGeneration(selectionnee.generation), flexShrink: 0 }} />
                <Text size="sm" truncate>
                  Lignée de <b>{nomComplet(selectionnee.personne)}</b> · {chaine.size - 1} génération{chaine.size > 2 ? "s" : ""}
                </Text>
                <ActionIcon variant="subtle" size="sm" onClick={() => setSelection(null)} aria-label="Désélectionner">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Paper>
          )}
          {generations.length > 1 && (
            <Legende
              generations={generations}
              sens={sens}
              masquees={masquees}
              onBasculer={basculer}
              jusqua={jusqua}
              lecture={lecture}
              onLecture={() => {
                if (jusqua === null) setJusqua(0);
                setLecture(true);
              }}
              onPause={() => setLecture(false)}
              onArret={() => setJusqua(null)}
            />
          )}
          {telephone && points.length > 0 && (
            <Button pos="absolute" bottom={58} left="50%" style={{ transform: "translateX(-50%)", zIndex: 1 }} onClick={() => setListeOuverte(true)}>
              Liste ({points.length})
            </Button>
          )}
        </Paper>
        {!telephone && (
          <Paper withBorder w={340} style={{ display: "flex", flexDirection: "column" }}>
            {liste}
          </Paper>
        )}
      </Group>
      {telephone && (
        <Drawer opened={listeOuverte} onClose={() => setListeOuverte(false)} position="bottom" size="60%" title="Personnes">
          {liste}
        </Drawer>
      )}
    </Stack>
  );
}
