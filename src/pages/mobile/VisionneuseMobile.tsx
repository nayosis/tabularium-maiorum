import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Badge, Button, Center, Group, Loader, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { IconArrowLeft, IconArrowsMaximize, IconChevronLeft, IconChevronRight, IconUser } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Rect } from "../../db/schema";
import { annotationsPages, chargerActe } from "../../data/actes";
import { relevesActe } from "../../data/releves";
import { urlImage } from "../../lib/images";
import { couleurRole, libelle, libelleType, NATURES } from "../../lib/libelles";
import { retour } from "../../lib/onglets";
import { creerPincement } from "../../lib/pincement";
import { texteAutoReleve } from "../atelier/bulles";
import { BoutonCitation } from "../../components/Citations";

type Vue = { x: number; y: number; s: number };

const englobant = (rects: Rect[]) => {
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.w));
  const y2 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};

/**
 * Téléphone : un document ou une photo en lecture — image (zoom à deux doigts, glisser),
 * personnes / relevés dessous ; toucher une personne montre sa zone. L'annotation se fait sur grand écran.
 */
export function VisionneuseMobile({ acteId, releveInitial }: { acteId: string; releveInitial?: string }) {
  const navigate = useNavigate();
  const acteQ = useQuery({ queryKey: ["acte", acteId], queryFn: () => chargerActe(acteId) });
  const { data: releves = [] } = useQuery({ queryKey: ["releves", acteId], queryFn: () => relevesActe(acteId) });
  const pageIds = acteQ.data?.pages.map((p) => p.id) ?? [];
  const { data: annotations = [] } = useQuery({
    queryKey: ["annotations", acteId, pageIds.join(",")],
    queryFn: () => annotationsPages(pageIds),
    enabled: !!acteQ.data,
  });
  const [indexPage, setIndexPage] = useState(0);
  const [selection, setSelection] = useState<string | null>(releveInitial ?? null);
  const { ref, width: cw, height: ch } = useElementSize();
  const [vue, setVue] = useState<Vue>({ x: 0, y: 0, s: 0.1 });
  const pincement = useRef(creerPincement()).current;
  const glisser = useRef<{ cx: number; cy: number; vue: Vue } | null>(null);

  const acte = acteQ.data;
  const page = acte?.pages[indexPage];
  const photo = acte?.nature === "photo";

  /** Cadre l'image entière, ou un rectangle (zone d'une personne) avec de la marge. */
  const cadrer = useCallback(
    (zone?: { x: number; y: number; w: number; h: number }) => {
      if (!page || !cw || !ch) return;
      const z = zone ?? { x: 0, y: 0, w: page.largeur, h: page.hauteur };
      const marge = zone ? 1.6 : 1.02;
      const s = Math.min(cw / (z.w * marge), ch / (z.h * marge));
      setVue({ s, x: z.x + z.w / 2 - cw / s / 2, y: z.y + z.h / 2 - ch / s / 2 });
    },
    [page, cw, ch],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => cadrer(), [page?.id, cw, ch]);

  const zonesPage = useMemo(() => annotations.filter((a) => a.pageId === page?.id && a.releveId), [annotations, page?.id]);

  // Personne choisie : on va sur sa page et on zoome sur sa zone.
  useEffect(() => {
    if (!selection || !acte) return;
    const zone = annotations.find((a) => a.releveId === selection);
    if (!zone) return;
    const i = acte.pages.findIndex((p) => p.id === zone.pageId);
    if (i >= 0 && i !== indexPage) {
      setIndexPage(i);
      return;
    }
    cadrer(englobant(zone.rectangles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, annotations, indexPage, cw, ch]);

  const zoomer = (f: number, cx: number, cy: number) =>
    setVue((v) => {
      const s = Math.min(Math.max(v.s * f, 0.01), 8);
      return { s, x: v.x + cx / v.s - cx / s, y: v.y + cy / v.s - cy / s };
    });

  if (acteQ.isLoading) return <Center h="100%"><Loader /></Center>;
  if (!acte) return <Center h="100%"><Text>Document introuvable.</Text></Center>;

  const nomReleve = (r: (typeof releves)[number]) =>
    photo
      ? texteAutoReleve(r).split("\n")[0]
      : [r.nomEcrit || r.nom, r.prenomsEcrits || r.prenoms].filter(Boolean).join(" ") || r.individuNom || "Personne ?";

  return (
    <Stack gap={0} h="100%">
      <Group gap="xs" px="xs" py={6} wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
        <ActionIcon variant="subtle" onClick={() => retour(photo ? "/photos" : "/documents")} aria-label="Retour">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} truncate>
            {acte.titre}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {[libelleType(acte.nature, acte.type) || libelle(NATURES, acte.nature), acte.date].filter(Boolean).join(" · ")}
          </Text>
        </Stack>
        {acte.pages.length > 1 && (
          <Group gap={0} wrap="nowrap">
            <ActionIcon variant="subtle" disabled={indexPage === 0} onClick={() => setIndexPage((i) => i - 1)} aria-label="Page précédente">
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Text size="xs">
              {indexPage + 1}/{acte.pages.length}
            </Text>
            <ActionIcon variant="subtle" disabled={indexPage >= acte.pages.length - 1} onClick={() => setIndexPage((i) => i + 1)} aria-label="Page suivante">
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        )}
        <BoutonCitation acteId={acte.id} />
      </Group>

      {/* Image : deux doigts pour zoomer, un doigt pour déplacer */}
      <div ref={ref} style={{ flex: "1 1 55%", minHeight: 0, position: "relative", background: "var(--mantine-color-dark-7)", overflow: "hidden" }}>
        {page && (
          <svg
            width={cw}
            height={ch}
            viewBox={`${vue.x} ${vue.y} ${cw / vue.s || 1} ${ch / vue.s || 1}`}
            style={{ display: "block", touchAction: "none", userSelect: "none" }}
            onPointerDown={(e) => {
              pincement.poser(e);
              glisser.current = pincement.actif() ? null : { cx: e.clientX, cy: e.clientY, vue };
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              const z = pincement.bouger(e);
              const r = e.currentTarget.getBoundingClientRect();
              if (z) return zoomer(z.facteur, z.cx - r.left, z.cy - r.top);
              const g = glisser.current;
              if (!g) return;
              setVue({ ...g.vue, x: g.vue.x - (e.clientX - g.cx) / g.vue.s, y: g.vue.y - (e.clientY - g.cy) / g.vue.s });
            }}
            onPointerUp={(e) => {
              pincement.retirer(e);
              glisser.current = null;
            }}
            onPointerCancel={(e) => {
              pincement.retirer(e);
              glisser.current = null;
            }}
            onWheel={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              zoomer(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
            }}
          >
            <image href={urlImage(page.fichier)} width={page.largeur} height={page.hauteur} />
            {zonesPage.map((a) => {
              const r = releves.find((x) => x.id === a.releveId);
              const sel = a.releveId === selection;
              // Photo : seule la personne choisie est entourée (la photo reste visible).
              if (photo && !sel) return null;
              const couleur = photo ? (r?.individuId ? "#0ca678" : "#f08c00") : couleurRole(r?.role);
              return a.rectangles.map((rc, i) => (
                <rect
                  key={`${a.id}-${i}`}
                  x={rc.x}
                  y={rc.y}
                  width={rc.w}
                  height={rc.h}
                  rx={rc.h * 0.15}
                  fill={photo ? "none" : couleur}
                  fillOpacity={sel ? 0.35 : 0.15}
                  stroke={photo || sel ? couleur : "none"}
                  strokeWidth={3 / vue.s}
                  onClick={() => setSelection(a.releveId)}
                />
              ));
            })}
          </svg>
        )}
        <ActionIcon variant="white" pos="absolute" top={8} right={8} onClick={() => cadrer()} aria-label="Image entière">
          <IconArrowsMaximize size={16} />
        </ActionIcon>
      </div>

      {/* Personnes / relevés */}
      <ScrollArea style={{ flex: "1 1 45%", minHeight: 0 }} p="sm">
        <Stack gap={6}>
          {photo && acte.notes && (
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {acte.notes}
            </Text>
          )}
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {photo ? "Personnes sur la photo" : "Personnes dans le document"} ({releves.length})
          </Text>
          {releves.map((r) => (
            <UnstyledButton
              key={r.id}
              onClick={() => setSelection(r.id === selection ? null : r.id)}
              p="xs"
              style={{
                borderRadius: 8,
                border: `1px solid ${r.id === selection ? "var(--mantine-color-teal-5)" : "var(--mantine-color-default-border)"}`,
              }}
            >
              <Group gap="xs" wrap="nowrap">
                {!photo && (
                  <Badge size="xs" variant="light" color={couleurRole(r.role)} miw={56}>
                    {r.role ?? "?"}
                  </Badge>
                )}
                <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }} truncate>
                  {nomReleve(r)}
                </Text>
                {r.individuId ? (
                  <Button
                    size="compact-xs"
                    variant="light"
                    leftSection={<IconUser size={12} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate({ to: "/individus/$individuId", params: { individuId: r.individuId! } });
                    }}
                  >
                    Fiche
                  </Button>
                ) : (
                  photo && (
                    <Badge size="xs" color="orange" variant="light">
                      à identifier
                    </Badge>
                  )
                )}
              </Group>
            </UnstyledButton>
          ))}
          {!photo && acte.transcription && (
            <>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="sm">
                Transcription
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {acte.transcription}
              </Text>
            </>
          )}
          <Text size="xs" c="dimmed" mt="sm">
            Pour annoter ce document, ouvrez-le sur un ordinateur ou une tablette.
          </Text>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
