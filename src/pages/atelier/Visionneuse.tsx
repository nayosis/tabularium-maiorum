import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { ActionIcon, Box, Group, Menu, Paper, Popover, SegmentedControl, Slider, Stack, Text, Tooltip } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import {
  IconAdjustments, IconArrowNarrowRight, IconArrowsMaximize, IconCheck, IconEye, IconEyeOff, IconSquareMinus, IconSquarePlus, IconTrash, IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import type { Annotation, Page, Rect, Releve } from "../../db/schema";
import { urlImage } from "../../lib/images";
import { useEcran } from "../../lib/ecran";
import { LECTURE_SEULE } from "../../lib/mode";
import { creerPincement } from "../../lib/pincement";
import { calculerBulles, couleurAnnotation, metriques } from "./bulles";

export type Mode = "deplacer" | "personne" | "note" | "zone-releve";

type Vue = { x: number; y: number; s: number };

type Props = {
  page: Page;
  /** Annotations de cette page (y compris celles d'autres actes, affichées en retrait). */
  annotations: Annotation[];
  acteId: string;
  releves: Map<string, Partial<Releve>>;
  selectionId: string | null;
  mode: Mode;
  onMode: (m: Mode) => void;
  onSelect: (a: Annotation | null) => void;
  /** Rectangle tracé ; `ajout` = Maj enfoncée (ajouter à la zone sélectionnée). */
  onRect: (rect: Rect, ajout: boolean) => void;
  onRetirerRect: (a: Annotation, index: number) => void;
  onSupprimer: () => void;
  /** Photo : zones en simple contour, sans fond, pour voir l'image. */
  contour?: boolean;
};

const SEUIL_CLIC = 4; // px écran

/** Flèches zone → bulle : toutes, seulement sélection/survol, ou aucune (préférence mémorisée). */
type ModeFleches = "toutes" | "selection" | "aucune";
const CLE_FLECHES = "tabularium.fleches";
const MODES_FLECHES: { value: ModeFleches; label: string }[] = [
  { value: "toutes", label: "Toujours afficher" },
  { value: "selection", label: "Au survol et sur la sélection" },
  { value: "aucune", label: "Jamais" },
];
/** Pastilles numérotées sur les zones : masquables quand elles cachent du texte (préférence mémorisée). */
const CLE_NUMEROS = "tabularium.numerosSurZones";
function lireNumeros() {
  try {
    return localStorage.getItem(CLE_NUMEROS) !== "non";
  } catch {
    return true;
  }
}
/** Photos : cadres et flèches seulement au survol (préférence mémorisée, activée par défaut). */
const CLE_CADRES_SURVOL = "tabularium.photo.cadresAuSurvol";
function lireCadresAuSurvol() {
  try {
    return localStorage.getItem(CLE_CADRES_SURVOL) !== "non";
  } catch {
    return true;
  }
}

function lireModeFleches(): ModeFleches {
  try {
    const v = localStorage.getItem(CLE_FLECHES);
    return v === "toutes" || v === "aucune" ? v : "selection";
  } catch {
    return "selection";
  }
}

export function Visionneuse(p: Props) {
  const { ref, width: cw, height: ch } = useElementSize();
  const svgRef = useRef<SVGSVGElement>(null);
  const [vue, setVue] = useState<Vue>({ x: 0, y: 0, s: 0.2 });
  const [contraste, setContraste] = useState(100);
  const [luminosite, setLuminosite] = useState(100);
  const [fleches, setFleches] = useState<ModeFleches>(lireModeFleches);
  const [survol, setSurvol] = useState<string | null>(null);
  const [cadresAuSurvol, setCadresAuSurvol] = useState(lireCadresAuSurvol);
  const [numerosSurZones, setNumerosSurZones] = useState(lireNumeros);
  const basculerNumeros = () =>
    setNumerosSurZones((v) => {
      try {
        localStorage.setItem(CLE_NUMEROS, v ? "non" : "oui");
      } catch {
        // stockage indisponible : le choix vaut pour la session
      }
      return !v;
    });
  const basculerCadres = () =>
    setCadresAuSurvol((v) => {
      try {
        localStorage.setItem(CLE_CADRES_SURVOL, v ? "non" : "oui");
      } catch {
        // stockage indisponible : le choix vaut pour la session
      }
      return !v;
    });
  const changerFleches = (m: ModeFleches) => {
    setFleches(m);
    try {
      localStorage.setItem(CLE_FLECHES, m);
    } catch {
      // stockage indisponible : le choix vaut pour la session
    }
  };
  // Sans clavier (tablette) : Maj+tracé et Alt+clic deviennent des boutons bascule.
  const { tactile } = useEcran();
  const [ajoutRect, setAjoutRect] = useState(false);
  const [retraitRect, setRetraitRect] = useState(false);
  useEffect(() => {
    if (!p.selectionId) {
      setAjoutRect(false);
      setRetraitRect(false);
    }
  }, [p.selectionId]);
  const pincement = useRef(creerPincement()).current;
  const [trace, setTraceEtat] = useState<Rect | null>(null);
  // Copie synchrone : le relâchement peut arriver avant le rendu du dernier déplacement.
  const traceRef = useRef<Rect | null>(null);
  const setTrace = (r: Rect | null) => {
    traceRef.current = r;
    setTraceEtat(r);
  };
  const geste = useRef<{
    type: "pan" | "trace";
    depart: { cx: number; cy: number; ix: number; iy: number };
    vue: Vue;
    cible: Annotation | null;
    bouge: boolean;
    maj: boolean;
  } | null>(null);

  const { page } = p;
  const m = metriques(page);
  const bulles = calculerBulles(page, p.annotations.filter((a) => a.acteId === p.acteId || !a.acteId), p.releves);
  const largeurTotale = page.largeur + m.ecart + m.largeur + m.pad;
  const hauteurTotale = Math.max(page.hauteur, ...bulles.map((b) => b.y + b.h));

  const ajuster = useCallback(() => {
    if (!cw || !ch) return;
    const s = Math.min(cw / largeurTotale, ch / hauteurTotale) * 0.95;
    setVue({ s, x: -(cw / s - largeurTotale) / 2, y: -(ch / s - hauteurTotale) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cw, ch, page.id]);

  // Ajuste à l'ouverture d'une page et quand la taille de la zone change.
  useEffect(ajuster, [ajuster]);

  const versImage = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: vue.x + (clientX - r.left) / vue.s, y: vue.y + (clientY - r.top) / vue.s };
  };

  const zoomer = (facteur: number, cx = cw / 2, cy = ch / 2) =>
    setVue((v) => {
      const s = Math.min(Math.max(v.s * facteur, 0.02), 8);
      return { s, x: v.x + cx / v.s - cx / s, y: v.y + cy / v.s - cy / s };
    });

  const annotationSous = (e: RPointerEvent) => {
    const el = (e.target as Element).closest("[data-annotation]");
    const id = el?.getAttribute("data-annotation");
    // Le numéro du rectangle est porté par le rectangle lui-même, pas par le groupe de la zone.
    const rect = (e.target as Element).closest("[data-rect]")?.getAttribute("data-rect");
    return { a: p.annotations.find((a) => a.id === id) ?? null, rect };
  };

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    pincement.poser(e);
    if (pincement.actif()) {
      // Deuxième doigt : on zoome, le geste commencé par le premier est abandonné.
      geste.current = null;
      setTrace(null);
      return;
    }
    const { a, rect } = annotationSous(e);
    if (e.button === 0 && (e.altKey || retraitRect) && a && rect != null) {
      if (a.id === p.selectionId || !retraitRect) p.onRetirerRect(a, +rect);
      return;
    }
    if (e.button !== 0 && e.button !== 1) return;
    const img = versImage(e.clientX, e.clientY);
    const type = e.button === 1 || p.mode === "deplacer" ? "pan" : "trace";
    geste.current = {
      type,
      depart: { cx: e.clientX, cy: e.clientY, ix: img.x, iy: img.y },
      vue,
      cible: a,
      bouge: false,
      maj: e.shiftKey || ajoutRect,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointeur déjà relâché : sans importance.
    }
  };

  const onPointerMove = (e: RPointerEvent<SVGSVGElement>) => {
    const z = pincement.bouger(e);
    if (z) {
      const r = e.currentTarget.getBoundingClientRect();
      zoomer(z.facteur, z.cx - r.left, z.cy - r.top);
      return;
    }
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.depart.cx;
    const dy = e.clientY - g.depart.cy;
    if (!g.bouge && Math.hypot(dx, dy) < SEUIL_CLIC) return;
    g.bouge = true;
    if (g.type === "pan") {
      setVue({ ...g.vue, x: g.vue.x - dx / g.vue.s, y: g.vue.y - dy / g.vue.s });
    } else {
      const img = versImage(e.clientX, e.clientY);
      const x = Math.max(0, Math.min(g.depart.ix, img.x));
      const y = Math.max(0, Math.min(g.depart.iy, img.y));
      const x2 = Math.min(page.largeur, Math.max(g.depart.ix, img.x));
      const y2 = Math.min(page.hauteur, Math.max(g.depart.iy, img.y));
      setTrace({ x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) });
    }
  };

  const onPointerUp = (e: RPointerEvent<SVGSVGElement>) => {
    pincement.retirer(e);
    const g = geste.current;
    geste.current = null;
    if (!g) return;
    if (!g.bouge) {
      // Simple clic : sélection (ou désélection sur le fond).
      p.onSelect(g.cible);
    } else if (g.type === "trace" && traceRef.current && traceRef.current.w > 2 && traceRef.current.h > 2) {
      const t = traceRef.current;
      p.onRect(
        { x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h) },
        g.maj,
      );
    }
    setTrace(null);
  };

  // Clavier : Suppr = supprimer la zone sélectionnée, Échap = annuler.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, [contenteditable=true]")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && p.selectionId && !LECTURE_SEULE) p.onSupprimer();
      if (e.key === "Escape") {
        geste.current = null;
        setTrace(null);
        p.onSelect(null);
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [p]);

  // Molette : zoom autour du curseur (écouteur non passif pour bloquer le défilement).
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

  const trait = 1.5 / vue.s;
  const numeros = new Map(bulles.map((b, i) => [b.annotation.id, i + 1]));
  const rayon = m.fs * 0.5;
  // Photo en mode discret : rien sur l'image, sauf la personne survolée (sur la photo ou son étiquette) ou sélectionnée.
  const discret = !!p.contour && cadresAuSurvol;
  const enAvant = (id: string) => id === p.selectionId || id === survol;
  const cadreVisible = (id: string) => !discret || enAvant(id);
  const flecheVisible = (id: string) =>
    cadreVisible(id) && (fleches === "toutes" || (fleches === "selection" && enAvant(id)));
  const couleurs = [...new Set(bulles.map((b) => b.couleur))];
  const curseur = p.mode === "deplacer" ? (geste.current?.type === "pan" ? "grabbing" : "grab") : "crosshair";

  return (
    <Box ref={ref} pos="relative" flex={1} style={{ overflow: "hidden", background: "var(--mantine-color-gray-2)" }}>
      <svg
        ref={svgRef}
        width={cw}
        height={ch}
        viewBox={`${vue.x} ${vue.y} ${cw / vue.s || 1} ${ch / vue.s || 1}`}
        style={{ display: "block", cursor: curseur, userSelect: "none", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          pincement.retirer(e);
          geste.current = null;
          setTrace(null);
        }}
        onPointerOver={(e) => {
          const id = (e.target as Element).closest("[data-annotation]")?.getAttribute("data-annotation") ?? null;
          if (id !== survol) setSurvol(id);
        }}
        onPointerLeave={() => setSurvol(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          {couleurs.map((c) => (
            <marker
              key={c}
              id={`fleche-${c.slice(1)}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={c} />
            </marker>
          ))}
        </defs>

        <image
          href={urlImage(page.fichier)}
          width={page.largeur}
          height={page.hauteur}
          style={{ filter: `contrast(${contraste}%) brightness(${luminosite}%)` }}
        />

        {/* Zones surlignées */}
        {p.annotations.map((a) => {
          const autreActe = !!a.acteId && a.acteId !== p.acteId;
          const r = a.releveId ? p.releves.get(a.releveId) : undefined;
          const couleur = couleurAnnotation(a, r);
          const sel = a.id === p.selectionId;
          return (
            <g key={a.id} data-annotation={autreActe ? undefined : a.id} opacity={autreActe ? 0.25 : 1}>
              {a.rectangles.map((rc, i) => (
                <rect
                  key={i}
                  data-rect={i}
                  x={rc.x}
                  y={rc.y}
                  width={rc.w}
                  height={rc.h}
                  rx={rc.h * 0.15}
                  fill={p.contour ? "none" : couleur}
                  fillOpacity={sel || a.id === survol ? 0.35 : 0.22}
                  stroke={p.contour ? (cadreVisible(a.id) ? couleur : "transparent") : sel ? couleur : "none"}
                  strokeWidth={p.contour ? trait * (sel || a.id === survol ? 3 : 2) : trait * 1.5}
                  style={p.contour ? { pointerEvents: "all" } : { mixBlendMode: "multiply" }}
                />
              ))}
              {numerosSurZones &&
                numeros.has(a.id) &&
                cadreVisible(a.id) &&
                (() => {
                  // Pastille numérotée sur le coin haut-gauche de la zone (dans l'interligne) :
                  // relie zone et bulle sans trait, sans masquer le texte.
                  const haut = a.rectangles.reduce((h, rc) => (rc.y < h.y ? rc : h));
                  const cx = Math.max(rayon, haut.x);
                  const cy = Math.max(rayon, haut.y - rayon * 0.2);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={rayon} fill={couleur} stroke="white" strokeWidth={rayon * 0.15} />
                      <text x={cx} y={cy + rayon * 0.4} fontSize={rayon * 1.15} fontWeight={700} textAnchor="middle" fill="white">
                        {numeros.get(a.id)}
                      </text>
                    </g>
                  );
                })()}
            </g>
          );
        })}

        {/* Bulles + flèches */}
        {bulles.map((b) => {
          const sel = b.annotation.id === p.selectionId;
          const note = !b.annotation.releveId;
          return (
            <g key={b.annotation.id} data-annotation={b.annotation.id} style={{ cursor: "pointer" }}>
              {flecheVisible(b.annotation.id) && (
              <line
                x1={b.x}
                y1={b.y + b.h / 2}
                x2={b.cible.x}
                y2={b.cible.y}
                stroke={b.couleur}
                strokeWidth={m.fs * 0.12}
                markerEnd={`url(#fleche-${b.couleur.slice(1)})`}
              />
              )}
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={m.fs * 0.8}
                fill="white"
                stroke={b.couleur}
                strokeWidth={m.fs * (sel ? 0.25 : 0.1)}
                strokeDasharray={note ? `${m.fs * 0.5} ${m.fs * 0.3}` : undefined}
              />
              <circle cx={b.x} cy={b.y} r={rayon} fill={b.couleur} stroke="white" strokeWidth={rayon * 0.15} />
              <text x={b.x} y={b.y + rayon * 0.4} fontSize={rayon * 1.15} fontWeight={700} textAnchor="middle" fill="white">
                {numeros.get(b.annotation.id)}
              </text>
              <text x={b.x + b.w / 2} y={b.y + m.pad} fontSize={m.fs} textAnchor="middle" fill="#212529">
                {b.lignes.map((l, i) => (
                  <tspan key={i} x={b.x + b.w / 2} dy={i === 0 ? m.fs : m.lh} fontWeight={i === 0 && !note ? 600 : 400}>
                    {l}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}

        {trace && (
          <rect
            x={trace.x}
            y={trace.y}
            width={trace.w}
            height={trace.h}
            fill="#fab005"
            fillOpacity={0.3}
            stroke="#f08c00"
            strokeWidth={trait}
            strokeDasharray={`${trait * 4} ${trait * 3}`}
          />
        )}
      </svg>

      {/* Barre d'outils */}
      <Paper pos="absolute" top={10} left={10} maw="calc(100% - 20px)" shadow="sm" p={6} withBorder>
        <Group gap={6}>
          {!LECTURE_SEULE && (
          <SegmentedControl
            size={tactile ? "sm" : "xs"}
            value={p.mode === "zone-releve" ? "personne" : p.mode}
            onChange={(v) => p.onMode(v as Mode)}
            data={[
              { value: "deplacer", label: "Déplacer" },
              { value: "personne", label: p.contour ? "Entourer une personne" : "Surligner une personne" },
              { value: "note", label: p.contour ? "Entourer une note" : "Surligner une note" },
            ]}
          />
          )}
          {!LECTURE_SEULE && p.selectionId && (
            <Group gap={4} wrap="nowrap">
              <Tooltip label="Ajouter un rectangle à la zone sélectionnée (Maj + tracé)">
                <ActionIcon
                  size={tactile ? "lg" : "md"}
                  variant={ajoutRect ? "filled" : "default"}
                  onClick={() => {
                    setAjoutRect((v) => !v);
                    setRetraitRect(false);
                    if (p.mode === "deplacer") p.onMode("personne");
                  }}
                  aria-label="Ajouter un rectangle"
                >
                  <IconSquarePlus size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Retirer un rectangle : toucher le rectangle à retirer (Alt + clic)">
                <ActionIcon
                  size={tactile ? "lg" : "md"}
                  variant={retraitRect ? "filled" : "default"}
                  onClick={() => {
                    setRetraitRect((v) => !v);
                    setAjoutRect(false);
                  }}
                  aria-label="Retirer un rectangle"
                >
                  <IconSquareMinus size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Supprimer la zone (Suppr)">
                <ActionIcon size={tactile ? "lg" : "md"} variant="default" color="red" onClick={p.onSupprimer} aria-label="Supprimer la zone">
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
          <Tooltip label="Dézoomer">
            <ActionIcon size={tactile ? "lg" : "md"} variant="default" onClick={() => zoomer(1 / 1.25)}>
              <IconZoomOut size={16} />
            </ActionIcon>
          </Tooltip>
          <Text size="xs" w={40} ta="center">
            {Math.round(vue.s * 100)} %
          </Text>
          <Tooltip label="Zoomer">
            <ActionIcon size={tactile ? "lg" : "md"} variant="default" onClick={() => zoomer(1.25)}>
              <IconZoomIn size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Ajuster à la fenêtre">
            <ActionIcon size={tactile ? "lg" : "md"} variant="default" onClick={ajuster}>
              <IconArrowsMaximize size={16} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-start" shadow="md">
            <Menu.Target>
              <Tooltip label="Flèches et numéros">
                <ActionIcon size={tactile ? "lg" : "md"} variant={fleches === "toutes" ? "filled" : "default"} aria-label="Flèches et numéros">
                  <IconArrowNarrowRight size={16} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Flèches</Menu.Label>
              {MODES_FLECHES.map((f) => (
                <Menu.Item
                  key={f.value}
                  onClick={() => changerFleches(f.value)}
                  leftSection={fleches === f.value ? <IconCheck size={14} /> : <Box w={14} />}
                >
                  {f.label}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Label>Numéros</Menu.Label>
              <Menu.Item onClick={basculerNumeros} leftSection={numerosSurZones ? <IconCheck size={14} /> : <Box w={14} />}>
                Sur les zones (masquer s'ils cachent le texte)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {p.contour && (
            <Tooltip label={cadresAuSurvol ? "Cadres visibles seulement au survol (cliquer pour toujours les montrer)" : "Cadres toujours visibles (cliquer pour ne les montrer qu'au survol)"}>
              <ActionIcon size={tactile ? "lg" : "md"} variant={cadresAuSurvol ? "default" : "filled"} onClick={basculerCadres}>
                {cadresAuSurvol ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
          <Popover position="bottom-start" withArrow shadow="md">
            <Popover.Target>
              <Tooltip label="Contraste / luminosité">
                <ActionIcon size={tactile ? "lg" : "md"} variant="default">
                  <IconAdjustments size={16} />
                </ActionIcon>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack w={220} gap="xs">
                <Text size="xs">Contraste</Text>
                <Slider min={50} max={300} value={contraste} onChange={setContraste} label={(v) => `${v} %`} />
                <Text size="xs">Luminosité</Text>
                <Slider min={30} max={200} value={luminosite} onChange={setLuminosite} label={(v) => `${v} %`} />
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      </Paper>

      <Text pos="absolute" bottom={8} left={12} size="xs" c="dimmed" style={{ pointerEvents: "none" }}>
        {retraitRect
          ? "Touchez le rectangle à retirer de la zone sélectionnée"
          : ajoutRect
          ? "Tracez un rectangle : il s'ajoute à la zone sélectionnée"
          : tactile
          ? p.mode === "deplacer" || LECTURE_SEULE
            ? "Deux doigts : zoom · un doigt : déplacer · toucher une zone : la sélectionner"
            : p.mode === "zone-releve"
            ? "Tracez la zone du relevé sélectionné"
            : "Deux doigts : zoom · un doigt : tracer une zone · « Déplacer » pour faire glisser l'image"
          : LECTURE_SEULE
          ? "Molette : zoom · glisser : déplacer · clic sur une zone ou une bulle : voir le relevé"
          : p.mode === "zone-releve"
          ? "Tracez la zone du relevé sélectionné · Échap pour annuler"
          : "Molette : zoom · clic molette : déplacer · Maj+tracé : ajouter un rectangle à la zone sélectionnée · Alt+clic : retirer un rectangle · Suppr : supprimer la zone"}
      </Text>
    </Box>
  );
}
