import { useMemo, useState } from "react";
import { Box, Group, ScrollArea, SegmentedControl, Slider, Stack, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { evenementsIndividus } from "../../data/releves";
import { useNoms } from "../../components/selects";
import { anneeFloue } from "../arbre/disposition";
import { anneeEvenement, construireFrise, pasGraduation, type PersonneFrise, type Tri } from "./calculFrise";

const LIGNE = 26;
const BARRE = 12;
const NOMS = 250;
const AXE = 28;
const COULEURS: Record<string, string> = { M: "#1c7ed6", F: "#d6336c" };
const couleur = (sexe: string | null) => COULEURS[sexe ?? ""] ?? "#868e96";

const tronquer = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Props = { personnes: PersonneFrise[] };

/** Frise des vies : une ligne par individu, de la naissance au décès, avec un point par acte. */
export function Frise({ personnes }: Props) {
  const navigate = useNavigate();
  const { nom: nomComplet } = useNoms();
  const { ref, width } = useElementSize();
  const [tri, setTri] = useState<Tri>("naissance");
  const [zoom, setZoom] = useState(1);
  const [survol, setSurvol] = useState<string | null>(null);
  const { data: evenements = [] } = useQuery({ queryKey: ["evenements-individus"], queryFn: evenementsIndividus });

  const { periodes, sansDates, debut, fin } = useMemo(() => construireFrise(personnes, tri), [personnes, tri]);
  const parIndividu = useMemo(() => Map.groupBy(evenements, (e) => e.individuId!), [evenements]);

  const largeurFrise = Math.max(200, (width - NOMS - 16) * zoom);
  const pxParAn = largeurFrise / Math.max(1, fin - debut);
  const X = (an: number) => NOMS + (an - debut) * pxParAn;
  const pas = pasGraduation(pxParAn);
  const graduations: number[] = [];
  for (let a = Math.ceil(debut / pas) * pas; a <= fin; a += pas) graduations.push(a);
  const largeurTotale = NOMS + largeurFrise + 16;
  const hauteur = periodes.length * LIGNE + 8;

  const ouvrir = (id: string) => navigate({ to: "/individus/$individuId", params: { individuId: id } });

  if (!personnes.length) return <Text c="dimmed">Aucun individu.</Text>;

  return (
    <Stack gap="sm" h="100%" ref={ref}>
      <Group gap="lg">
        <Group gap="xs">
          <Text size="sm">Tri</Text>
          <SegmentedControl
            size="xs"
            value={tri}
            onChange={(v) => setTri(v as Tri)}
            data={[
              { value: "naissance", label: "Par naissance" },
              { value: "nom", label: "Par nom" },
            ]}
          />
        </Group>
        <Group gap="xs" w={260}>
          <Text size="sm">Échelle</Text>
          <Slider flex={1} min={1} max={6} step={0.5} value={zoom} onChange={setZoom} label={(v) => `×${v}`} />
        </Group>
        <Group gap={6}>
          <Box w={28} h={8} style={{ borderRadius: 4, background: "linear-gradient(to right, transparent, #868e96)" }} />
          <Text size="xs" c="dimmed">
            date approximative
          </Text>
          <Box w={28} h={8} ml="sm" style={{ borderRadius: 4, border: "1px dashed #868e96" }} />
          <Text size="xs" c="dimmed">
            date inconnue (estimée)
          </Text>
          <Box w={9} h={9} ml="sm" style={{ borderRadius: 9, border: "2px solid var(--t-texte-doux)", background: "var(--t-case)" }} />
          <Text size="xs" c="dimmed">
            acte
          </Text>
        </Group>
      </Group>

      <ScrollArea flex={1} type="auto">
        <svg width={largeurTotale} height={AXE + hauteur} style={{ display: "block" }} onPointerLeave={() => setSurvol(null)}>
          <defs>
            {Object.entries({ ...COULEURS, x: "#868e96" }).map(([k, c]) => (
              <g key={k}>
                <linearGradient id={`entree-${k}`}>
                  <stop offset="0" stopColor={c} stopOpacity={0} />
                  <stop offset="1" stopColor={c} stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id={`sortie-${k}`}>
                  <stop offset="0" stopColor={c} stopOpacity={0.85} />
                  <stop offset="1" stopColor={c} stopOpacity={0} />
                </linearGradient>
              </g>
            ))}
          </defs>

          {/* Graduations */}
          {graduations.map((a) => (
            <g key={a}>
              <line x1={X(a)} x2={X(a)} y1={AXE - 6} y2={AXE + hauteur} stroke="var(--t-trait-leger)" />
              <text x={X(a)} y={AXE - 10} fontSize={11} textAnchor="middle" fill="var(--t-texte-doux)">
                {a}
              </text>
            </g>
          ))}

          {periodes.map((per, i) => {
            const p = per.personne;
            const y = AXE + i * LIGNE;
            const cy = y + LIGNE / 2;
            const c = couleur(p.sexe);
            const k = COULEURS[p.sexe ?? ""] ? p.sexe! : "x";
            const actif = survol === p.id;
            const libelleDates = `${anneeFloue(p.naissanceMin, p.naissanceMax) || "?"} – ${anneeFloue(p.decesMin, p.decesMax) || "?"}`;
            return (
              <g
                key={p.id}
                onPointerEnter={() => setSurvol(p.id)}
                onClick={() => ouvrir(p.id)}
                style={{ cursor: "pointer" }}
              >
                <rect x={0} y={y} width={largeurTotale} height={LIGNE} fill={actif ? "var(--t-ligne-active)" : i % 2 ? "var(--t-ligne-paire)" : "var(--t-case)"} />
                <title>{`${nomComplet(p)} (${libelleDates})`}</title>
                <text x={8} y={cy + 4} fontSize={12} fontWeight={actif ? 700 : 500} fill="var(--t-texte)">
                  {tronquer(nomComplet(p), 28)}
                </text>
                <text x={NOMS - 8} y={cy + 4} fontSize={11} textAnchor="end" fill="var(--t-texte-doux)">
                  {libelleDates}
                </text>

                {/* Naissance (fondu), vie, décès (fondu) ; pointillés si la date est estimée */}
                <rect
                  x={X(per.x0)}
                  y={cy - BARRE / 2}
                  width={Math.max(0, X(per.x1) - X(per.x0))}
                  height={BARRE}
                  fill={`url(#entree-${k})`}
                  stroke={per.naissanceEstimee ? c : "none"}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                />
                <rect
                  x={X(per.x1)}
                  y={cy - BARRE / 2}
                  width={Math.max(1, X(per.x2) - X(per.x1))}
                  height={BARRE}
                  fill={c}
                  fillOpacity={per.naissanceEstimee || per.decesEstime ? 0.45 : 0.85}
                />
                <rect
                  x={X(per.x2)}
                  y={cy - BARRE / 2}
                  width={Math.max(0, X(per.x3) - X(per.x2))}
                  height={BARRE}
                  fill={`url(#sortie-${k})`}
                  stroke={per.decesEstime ? c : "none"}
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                />

                {/* Un point par acte où la personne apparaît */}
                {(parIndividu.get(p.id) ?? []).map((e) => {
                  const an = anneeEvenement(e);
                  if (an === null) return null;
                  const x = X(an);
                  return (
                    <circle
                      key={e.releveId}
                      cx={x}
                      cy={cy}
                      r={actif ? 5.5 : 4.5}
                      fill="var(--t-case)"
                      stroke={c}
                      strokeWidth={2}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        navigate({ to: "/actes/$acteId", params: { acteId: e.acteId }, search: { releve: e.releveId } });
                      }}
                    >
                      <title>{`${e.acteDate ?? ""} · ${e.acteTitre}${e.role ? ` (${e.role})` : ""}`}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </ScrollArea>

      {sansDates.length > 0 && (
        <Text size="xs" c="dimmed">
          Sans aucune date, absents de la frise ({sansDates.length}) : {sansDates.map((p) => nomComplet(p)).join(", ")}
        </Text>
      )}
    </Stack>
  );
}
