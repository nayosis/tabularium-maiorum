import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { ActionIcon, Box, Center, Drawer, Group, Paper, SegmentedControl, Select, Stack, Text, Tooltip } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconAdjustmentsHorizontal, IconArrowsMaximize, IconBinaryTree2, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { arbreRoute } from "../../router";
import { changerParent, creerIndividu, donneesArbre } from "../../data/individus";
import { IndividuSelect, useIndividus } from "../../components/selects";
import { nomComplet } from "../../lib/libelles";
import { ecrire } from "../../lib/query";
import { LECTURE_SEULE } from "../../lib/mode";
import { BOITE, couleurUnion, COULEURS_UNIONS, disposerArbre, ligneDeces, ligneNaissance, type Lien, type Noeud } from "./disposition";
import { disposerFamille, type LienCouple } from "./famille";
import { PanneauFiche } from "./PanneauFiche";
import { actesDeVie } from "../../components/IconesActes";
import { PortraitSvg } from "../../components/Portrait";
import { useMemoire } from "../../lib/onglets";
import { useEcran } from "../../lib/ecran";
import { creerPincement } from "../../lib/pincement";
import { utilisateur } from "../../lib/session";

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


const COULEUR_SEXE: Record<string, string> = { M: "#1c7ed6", F: "#d6336c" };
const GENERATIONS = ["1", "2", "3", "4", "5", "6", "7", "8"].map((v) => ({ value: v, label: v }));
/** Descendants : 0 pour ne montrer que l'ascendance. */
const GENERATIONS_DESC = [{ value: "0", label: "0" }, ...GENERATIONS];
const tronquer = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** En dessous de ce zoom, les cases ne montrent plus que le nom et les prénoms, en gros. */
const SEUIL_SIMPLE = 0.6;

/** Découpe un texte en lignes de `max` caractères au plus (mots entiers), `n` lignes au plus. */
function lignes(texte: string, max: number, n: number) {
  const res: string[] = [];
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const derniere = res[res.length - 1];
    if (derniere !== undefined && `${derniere} ${mot}`.length <= max) res[res.length - 1] = `${derniere} ${mot}`;
    else res.push(mot);
  }
  if (res.length > n) res.splice(n - 1, res.length - n + 1, tronquer(res.slice(n - 1).join(" "), max));
  return res.map((l) => tronquer(l, max));
}

type Vue = { x: number; y: number; s: number };

export function Arbre() {
  const navigate = useNavigate();
  const recherche = arbreRoute.useSearch();
  const { data: individus = [] } = useIndividus();
  const { data } = useQuery({ queryKey: ["arbre"], queryFn: donneesArbre });
  const [ascendants, setAscendants] = useMemoire("arbre.ascendants", "4");
  const [descendants, setDescendants] = useMemoire("arbre.descendants", "2");
  const [selection, setSelection] = useState<Noeud | null>(null);
  const { telephone } = useEcran();
  const [reglages, setReglages] = useState(false);

  // Par défaut : la dernière personne affichée, sinon la fiche liée au compte, sinon la première.
  const racineId = recherche.racine ?? lireRacine() ?? utilisateur()?.individuId ?? individus[0]?.id ?? null;
  useEffect(() => {
    if (racineId) ecrireRacine(racineId);
    setSelection(null);
  }, [racineId]);

  const [vueArbre, setVueArbre] = useMemoire<"sablier" | "famille">("arbre.vue", "sablier");
  const [remonter, setRemonter] = useMemoire("arbre.remonter", "2");
  const [descendre, setDescendre] = useMemoire("arbre.descendre", "1");
  const { noeuds, liens, couples } = useMemo(() => {
    if (!data || !racineId) return { noeuds: [], liens: [], couples: [] };
    if (vueArbre === "famille") return disposerFamille(data, racineId, { remonter: +remonter, descendre: +descendre });
    return { ...disposerArbre(data, racineId, { ascendants: +ascendants, descendants: +descendants }), couples: [] };
  }, [data, racineId, ascendants, descendants, vueArbre, remonter, descendre]);

  const changerRacine = (id: string | null) => id && navigate({ to: "/arbre", search: { racine: id } });
  const ouvrirFiche = (id: string) => navigate({ to: "/individus/$individuId", params: { individuId: id } });

  const ajouterParent = async (n: Noeud) => {
    if (!n.manquant || n.manquant.inconnu || !data) return;
    const enfant = data.personnes.find((p) => p.id === n.manquant!.enfantId);
    const sexe = n.manquant.role === "pere" ? "M" : "F";
    const id = await ecrire(async () => {
      const nouveau = await creerIndividu({ sexe, nom: sexe === "M" ? (enfant?.nom ?? null) : null });
      await changerParent(n.manquant!.enfantId, null, nouveau);
      return nouveau;
    });
    if (id) ouvrirFiche(id);
  };

  const reglagesArbre = (
    <>
        <SegmentedControl
            size="xs"
            value={vueArbre}
            onChange={(v) => setVueArbre(v as "sablier" | "famille")}
            data={[
              { value: "sablier", label: "Ascendants et descendants" },
              { value: "famille", label: "Famille élargie" },
            ]}
          />
          {vueArbre === "sablier" ? (
            <>
              <Select w={{ base: "100%", sm: 110 }} data={GENERATIONS} value={ascendants} onChange={(v) => v && setAscendants(v)} leftSection={<Text size="xs">↑</Text>} aria-label="Générations d'ascendants" allowDeselect={false} />
              <Select w={{ base: "100%", sm: 110 }} data={GENERATIONS_DESC} value={descendants} onChange={(v) => v && setDescendants(v)} leftSection={<Text size="xs">↓</Text>} aria-label="Générations de descendants" allowDeselect={false} />
              <Text size="xs" c="dimmed">
                générations ↑ ascendants · ↓ descendants
              </Text>
            </>
          ) : (
            <>
              <Select
                w={{ base: "100%", sm: 250 }}
                data={[
                  { value: "1", label: "Depuis les parents (frères, sœurs)" },
                  { value: "2", label: "Depuis les grands-parents (oncles, cousins)" },
                  { value: "3", label: "Depuis les arrière-grands-parents" },
                ]}
                value={remonter}
                onChange={(v) => v && setRemonter(v)}
                aria-label="Remonter jusqu'à"
                allowDeselect={false}
              />
              <Select
                w={{ base: "100%", sm: 230 }}
                data={[
                  { value: "0", label: "Jusqu'à sa génération" },
                  { value: "1", label: "+ enfants, neveux, nièces" },
                  { value: "2", label: "+ petits-enfants" },
                ]}
                value={descendre}
                onChange={(v) => v && setDescendre(v)}
                aria-label="Descendre jusqu'à"
                allowDeselect={false}
              />
            </>
          )}
    </>
  );

  const fiche = selection?.personne && (
    <PanneauFiche
      key={selection.personne.id}
      individuId={selection.personne.id}
      pleineLargeur={telephone}
      sousTitre={[selection.parente, selection.sosa && vueArbre === "sablier" ? `Sosa ${selection.sosa}` : null].filter(Boolean).join(" · ") || null}
      estRacine={!!selection.racine}
      onFermer={() => setSelection(null)}
      onCentrer={() => changerRacine(selection.personne!.id)}
      onChoisir={(id) => {
        // Dans l'arbre affiché : on la sélectionne ; sinon on recentre l'arbre sur elle.
        const n = noeuds.find((x) => x.personne?.id === id);
        if (n) setSelection(n);
        else changerRacine(id);
      }}
    />
  );

  return (
    <Stack gap={0} h="100%">
      <Group px={telephone ? "xs" : "md"} py="xs" gap={telephone ? "xs" : "md"} wrap={telephone ? "nowrap" : "wrap"} style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        {!telephone && (
          <Group gap={6}>
            <IconBinaryTree2 size={22} />
            <Text fw={600} size="lg">
              Arbre
            </Text>
          </Group>
        )}
        <IndividuSelect
          w={telephone ? undefined : 320}
          style={telephone ? { flex: 1 } : undefined}
          placeholder="Personne racine (Sosa 1)"
          value={racineId}
          onChange={changerRacine}
          clearable={false}
        />
        {telephone ? (
          <ActionIcon variant="default" size="lg" onClick={() => setReglages(true)} aria-label="Réglages de l'arbre">
            <IconAdjustmentsHorizontal size={18} />
          </ActionIcon>
        ) : (
          reglagesArbre
        )}
      </Group>

      {!racineId ? (
        <Center flex={1}>
          <Text c="dimmed">Créez un individu pour commencer l'arbre.</Text>
        </Center>
      ) : (
        <Group gap={0} wrap="nowrap" align="stretch" flex={1} style={{ minHeight: 0 }}>
        <Box pos="relative" flex={1} style={{ minHeight: 0, minWidth: 0 }}>
          <Dessin
            cle={`${racineId}-${vueArbre}-${ascendants}-${descendants}-${remonter}-${descendre}`}
            noeuds={noeuds}
            liens={liens}
            couples={couples}
            selection={selection}
            onSelect={(n) => (n?.manquant ? (LECTURE_SEULE ? null : ajouterParent(n)) : setSelection(n))}
            onOuvrir={(n) => n.personne && ouvrirFiche(n.personne.id)}
          />
        </Box>
          {!telephone && fiche}
        </Group>
      )}
      {telephone && (
        <Drawer opened={!!fiche} onClose={() => setSelection(null)} position="bottom" size="75%" withCloseButton={false} padding={0}>
          {fiche}
        </Drawer>
      )}
      <Drawer opened={reglages} onClose={() => setReglages(false)} position="bottom" size="auto" title="Réglages de l'arbre">
        <Stack gap="sm" pb="md">
          {reglagesArbre}
        </Stack>
      </Drawer>
    </Stack>
  );
}

type DessinProps = {
  /** Change quand l'arbre change : on recadre alors l'affichage. */
  cle: string;
  noeuds: Noeud[];
  liens: Lien[];
  /** Parents dessinés dans deux branches : reliés par un pointillé. */
  couples?: LienCouple[];
  selection: Noeud | null;
  onSelect: (n: Noeud | null) => void;
  onOuvrir: (n: Noeud) => void;
};

function Dessin({ cle, noeuds, liens, couples = [], selection, onSelect, onOuvrir }: DessinProps) {
  const { ref, width: cw, height: ch } = useElementSize();
  const svgRef = useRef<SVGSVGElement>(null);
  const [vue, setVue] = useState<Vue>({ x: 0, y: 0, s: 1 });
  const geste = useRef<{ cx: number; cy: number; vue: Vue; bouge: boolean; noeud: Noeud | null } | null>(null);
  const pincement = useRef(creerPincement()).current;
  const { tactile } = useEcran();

  const ajuster = useCallback(() => {
    if (!cw || !ch || !noeuds.length) return;
    const minX = Math.min(...noeuds.map((n) => n.x)) - BOITE.l / 2 - 20;
    const maxX = Math.max(...noeuds.map((n) => n.x)) + BOITE.l / 2 + 20;
    const minY = Math.min(...noeuds.map((n) => n.y)) - BOITE.h / 2 - 20;
    const maxY = Math.max(...noeuds.map((n) => n.y)) + BOITE.h / 2 + 20;
    const s = Math.min(cw / (maxX - minX), ch / (maxY - minY), 1.2);
    setVue({ s, x: (minX + maxX) / 2 - cw / s / 2, y: (minY + maxY) / 2 - ch / s / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cw, ch, cle, noeuds.length]);
  useEffect(ajuster, [ajuster]);

  const zoomer = (f: number, cx = cw / 2, cy = ch / 2) =>
    setVue((v) => {
      const s = Math.min(Math.max(v.s * f, 0.05), 4);
      return { s, x: v.x + cx / v.s - cx / s, y: v.y + cy / v.s - cy / s };
    });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const molette = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomer(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    svg.addEventListener("wheel", molette, { passive: false });
    return () => svg.removeEventListener("wheel", molette);
  });

  const noeudSous = (e: RPointerEvent) => {
    const c = (e.target as Element).closest("[data-noeud]")?.getAttribute("data-noeud");
    return noeuds.find((n) => n.cle === c) ?? null;
  };

  const h = BOITE.h;
  const l = BOITE.l;
  const simple = vue.s < SEUIL_SIMPLE;

  return (
    <Box ref={ref} h="100%" style={{ overflow: "hidden", background: "var(--mantine-color-gray-0)" }}>
      <svg
        ref={svgRef}
        width={cw}
        height={ch}
        viewBox={`${vue.x} ${vue.y} ${cw / vue.s || 1} ${ch / vue.s || 1}`}
        style={{ display: "block", cursor: geste.current?.bouge ? "grabbing" : "grab", userSelect: "none", touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          pincement.poser(e);
          // Deuxième doigt : c'est un zoom, pas un glisser ni un toucher de case.
          if (pincement.actif()) {
            geste.current = null;
            return;
          }
          geste.current = { cx: e.clientX, cy: e.clientY, vue, bouge: false, noeud: noeudSous(e) };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // sans importance
          }
        }}
        onPointerMove={(e) => {
          const z = pincement.bouger(e);
          if (z) {
            const r = e.currentTarget.getBoundingClientRect();
            zoomer(z.facteur, z.cx - r.left, z.cy - r.top);
            return;
          }
          const g = geste.current;
          if (!g) return;
          const dx = e.clientX - g.cx;
          const dy = e.clientY - g.cy;
          if (!g.bouge && Math.hypot(dx, dy) < 4) return;
          g.bouge = true;
          setVue({ ...g.vue, x: g.vue.x - dx / g.vue.s, y: g.vue.y - dy / g.vue.s });
        }}
        onPointerUp={(e) => {
          pincement.retirer(e);
          const g = geste.current;
          geste.current = null;
          if (g && !g.bouge) onSelect(g.noeud);
        }}
        onPointerCancel={(e) => {
          pincement.retirer(e);
          geste.current = null;
        }}
        onDoubleClick={(e) => {
          const n = noeudSous(e as unknown as RPointerEvent);
          if (n?.personne) onOuvrir(n);
        }}
      >
        {/* Couples dans deux branches : pointillé rose entre les deux cases, au-dessus. */}
        {couples.map((c, i) => {
          const [g, dr] = c.a.x < c.b.x ? [c.a, c.b] : [c.b, c.a];
          const yh = g.y - h / 2 - 18;
          return (
            <path
              key={`c${i}`}
              d={`M${g.x},${g.y - h / 2} V${yh} H${dr.x} V${dr.y - h / 2}`}
              fill="none"
              stroke="#e64980"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              opacity={0.7}
            />
          );
        })}
        {/* Liens en équerre : du bas du parent au haut de l'enfant. */}
        {liens.map((lk, i) => {
          const y1 = lk.parent.y + h / 2;
          const y2 = lk.enfant.y - h / 2;
          const ym = (y1 + y2) / 2;
          // Plusieurs unions : un départ décalé sous la case et une couleur par union.
          const u = lk.union;
          const decalage = u ? Math.min(48, (l - 60) / Math.max(1, u.total - 1)) : 0;
          const x1 = u ? lk.parent.x + (u.rang - (u.total - 1) / 2) * decalage : lk.parent.x;
          return (
            <path
              key={i}
              d={`M${x1},${y1} V${ym} H${lk.enfant.x} V${y2}`}
              fill="none"
              stroke={u ? couleurUnion(u) : "#adb5bd"}
              strokeWidth={u ? 2 : 1.5}
              strokeDasharray={lk.parent.manquant ? "4 4" : undefined}
            />
          );
        })}

        {noeuds.map((n) => {
          const x = n.x - l / 2;
          const y = n.y - h / 2;
          if (n.manquant?.inconnu) {
            return (
              <g key={n.cle}>
                <rect x={x} y={y} width={l} height={h} rx={10} fill="#f8f9fa" stroke="#ced4da" strokeDasharray="2 3" />
                <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={13} fontStyle="italic" fill="#868e96">
                  {n.manquant.role === "pere" ? "Père inconnu" : "Mère inconnue"}
                </text>
              </g>
            );
          }
          if (n.manquant) {
            return (
              <g key={n.cle} data-noeud={n.cle} style={{ cursor: "pointer" }}>
                <rect x={x} y={y} width={l} height={h} rx={10} fill="white" fillOpacity={0.6} stroke="#ced4da" strokeDasharray="6 4" />
                <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={14} fill="#868e96">
                  {LECTURE_SEULE ? "" : "+ "}
                  {n.manquant.role === "pere" ? "Père" : "Mère"}
                  {LECTURE_SEULE ? " ?" : ""}
                </text>
              </g>
            );
          }
          const p = n.personne!;
          const couleur = COULEUR_SEXE[p.sexe ?? ""] ?? "#adb5bd";
          const sel = selection?.cle === n.cle;
          return (
            <g key={n.cle} data-noeud={n.cle} style={{ cursor: "pointer" }}>
              <rect
                x={x}
                y={y}
                width={l}
                height={h}
                rx={10}
                fill={n.racine ? "#e6fcf5" : "white"}
                stroke={sel ? "#0ca678" : couleur}
                strokeWidth={sel || n.racine ? 3 : 1.5}
              />
              {n.parente && !simple && (
                <text x={n.x} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0ca678">
                  {n.parente}
                </text>
              )}
              <rect x={x} y={y + 8} width={4} height={h - 16} rx={2} fill={couleur} />
              {n.sosa && !simple && (
                <text x={x + l - 8} y={y + 16} textAnchor="end" fontSize={11} fill="#868e96">
                  {n.sosa}
                </text>
              )}
              {/* Actes reliés : naissance, mariage, décès (couleur = relié, gris = à trouver). */}
              {actesDeVie(p).map(({ Icone, couleur, quoi, relie, rang }) => (
                <g key={quoi}>
                  <title>{relie ? `Acte ${quoi} relié` : `Pas d'acte ${quoi} relié`}</title>
                  {simple ? (
                    <Icone x={x + l - 28} y={y + 14 + rang * 26} size={20} stroke={relie ? 2.2 : 1.5} color={relie ? couleur : "#dee2e6"} />
                  ) : (
                    <Icone x={x + l - 22} y={y + 24 + rang * 18} size={14} stroke={relie ? 2 : 1.5} color={relie ? couleur : "#dee2e6"} />
                  )}
                </g>
              ))}
              {simple ? (
                // Vue d'ensemble : nom et prénoms seulement, en gros.
                <>
                  {p.portrait && <PortraitSvg portrait={p.portrait} cx={x + 38} cy={n.y} r={26} couleur={couleur} />}
                  <text x={x + (p.portrait ? 72 : 14)} y={y + 34} fontSize={22} fontWeight={700} fill="#212529">
                    {tronquer((p.nom ?? "?").toUpperCase(), p.portrait ? 8 : 12)}
                  </text>
                  {lignes(p.prenoms ?? "", p.portrait ? 10 : 15, 2).map((ligne, k) => (
                    <text key={k} x={x + (p.portrait ? 72 : 14)} y={y + 62 + k * 22} fontSize={18} fill="#343a40">
                      {ligne}
                    </text>
                  ))}
                </>
              ) : (
                <>
                {/* Portrait en haut à gauche ; nom et prénoms décalés à sa droite. */}
                {p.portrait && <PortraitSvg portrait={p.portrait} cx={x + 32} cy={y + 30} r={20} couleur={couleur} />}
                <text x={x + (p.portrait ? 58 : 14)} y={y + 22} fontSize={14} fontWeight={700} fill="#212529">
                  {tronquer((p.nom ?? "?").toUpperCase(), p.portrait ? 11 : 16)}
                </text>
                <text x={x + (p.portrait ? 58 : 14)} y={y + 40} fontSize={13} fill="#343a40">
                  {tronquer(p.prenoms ?? "", p.portrait ? 15 : 21)}
                </text>
                <text x={x + 14} y={y + 60} fontSize={12} fill="#495057">
                  {tronquer(ligneNaissance(p), 24)}
                </text>
                <text x={x + 14} y={y + 77} fontSize={12} fill="#495057">
                  {tronquer(ligneDeces(p), 24)}
                </text>
                {!!n.conjoints?.length && (!n.sosa || n.racine) && (
                  <text x={x + 14} y={y + 96} fontSize={11} fill="#868e96">
                    {n.conjoints.length === 1 ? (
                      `∞ ${tronquer(nomComplet(n.conjoints[0]), 24)}`
                    ) : (
                      // Plusieurs unions : les noms, dans la couleur des traits de chaque union.
                      <>
                        ∞{" "}
                        {n.conjoints.slice(0, 3).map((c, k) => (
                          <tspan key={c.id} fill={COULEURS_UNIONS[k]} fontWeight={600}>
                            {k > 0 ? " · " : ""}
                            {tronquer(c.nom ?? c.prenoms ?? "?", n.conjoints!.length > 2 ? 9 : 13)}
                          </tspan>
                        ))}
                        {n.conjoints.length > 3 ? " …" : ""}
                      </>
                    )}
                  </text>
                )}
                </>
              )}
            </g>
          );
        })}
      </svg>

      <Paper pos="absolute" bottom={12} left={12} shadow="sm" p={6} withBorder>
        <Group gap={6}>
          <Tooltip label="Dézoomer">
            <ActionIcon variant="default" onClick={() => zoomer(1 / 1.25)}>
              <IconZoomOut size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Zoomer">
            <ActionIcon variant="default" onClick={() => zoomer(1.25)}>
              <IconZoomIn size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Tout afficher">
            <ActionIcon variant="default" onClick={ajuster}>
              <IconArrowsMaximize size={16} />
            </ActionIcon>
          </Tooltip>
          <Text size="xs" c="dimmed" px={4}>
            {tactile ? "Toucher : détails · deux doigts : zoom" : "Clic : détails · double-clic : fiche"}
            {LECTURE_SEULE ? "" : " · case pointillée : ajouter le parent"}
          </Text>
        </Group>
      </Paper>
    </Box>
  );
}
