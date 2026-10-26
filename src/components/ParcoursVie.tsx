import { useEffect, useMemo, useRef } from "react";
import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import { IconRoute } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listeActes } from "../data/actes";
import { estPlacee, etapesVie, type Etape, type QuoiEtape, type SujetParcours } from "../lib/parcours";
import { AnchorLink } from "./AnchorLink";
import { useLieux } from "./selects";
import { ajouterFond } from "../lib/configuration";

const COULEURS: Record<QuoiEtape, string> = {
  naissance: "#12b886",
  mariage: "#e64980",
  enfant: "#1c7ed6",
  domicile: "#f08c00",
  deces: "#495057",
};

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Carte : un point numéroté par lieu (plusieurs étapes au même endroit = un seul point), un trait d'étape en étape. */
/** `cle` résume étapes et coordonnées : la carte n'est recréée que si elle change. */
function Carte({ etapes, cle }: { etapes: { etape: Etape; numero: number }[]; cle: string }) {
  const conteneur = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conteneur.current || !etapes.length) return;
    const m = L.map(conteneur.current, { scrollWheelZoom: false });
    ajouterFond(m);

    const points = etapes.map(({ etape }) => [etape.lieu!.latitude!, etape.lieu!.longitude!] as L.LatLngTuple);
    // Le trait suit l'ordre chronologique.
    if (points.length > 1) {
      L.polyline(points, { color: "#868e96", weight: 3, opacity: 0.8, dashArray: "6 6" }).addTo(m);
    }

    // Un marqueur par lieu, avec les numéros des étapes qui s'y sont passées.
    const parLieu = Map.groupBy(etapes, ({ etape }) => etape.lieu!.id);
    for (const groupe of parLieu.values()) {
      const { etape } = groupe[0];
      const numeros = groupe.map((g) => g.numero).join("·");
      const couleur = groupe.length > 1 ? "#7048e8" : COULEURS[etape.quoi];
      const largeur = Math.max(24, 10 + numeros.length * 8);
      L.marker([etape.lieu!.latitude!, etape.lieu!.longitude!], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:${couleur};color:white;border:2px solid white;border-radius:12px;height:24px;min-width:24px;width:${largeur}px;display:flex;align-items:center;justify-content:center;font:600 12px system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)">${numeros}</div>`,
          iconSize: [largeur, 24],
          iconAnchor: [largeur / 2, 12],
        }),
      })
        .bindTooltip(
          `<b>${echapper(etape.lieu!.nom)}</b><br>` +
            groupe.map((g) => `${g.numero}. ${echapper(g.etape.libelle)}${g.etape.date ? ` · ${echapper(g.etape.date)}` : ""}`).join("<br>"),
          { direction: "top", offset: [0, -12] },
        )
        .addTo(m);
    }

    if (points.length === 1) m.setView(points[0], 11);
    else m.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });

    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(conteneur.current);
    return () => {
      obs.disconnect();
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return <div ref={conteneur} style={{ height: 320, borderRadius: 8 }} />;
}

/** Fiche individu : les étapes de la vie sur une carte, dans l'ordre. */
export function ParcoursVie({ personne }: { personne: SujetParcours }) {
  const { data: lieux = [] } = useLieux();
  const { data: actes = [] } = useQuery({ queryKey: ["actes"], queryFn: listeActes });
  const lieuActe = useMemo(() => new Map(actes.map((a) => [a.id, a.lieuId])), [actes]);
  const etapes = useMemo(() => etapesVie(personne, lieux, lieuActe), [personne, lieux, lieuActe]);
  const numerotees = etapes.map((etape, i) => ({ etape, numero: i + 1 }));
  const placees = numerotees.filter(({ etape }) => estPlacee(etape));
  const cle = placees
    .map(({ etape: e, numero }) => `${numero}|${e.lieu!.id}|${e.lieu!.latitude}|${e.lieu!.longitude}|${e.libelle}|${e.date ?? ""}`)
    .join(";");

  if (!etapes.length) return null;

  return (
    <Paper withBorder p="md">
      <Group gap="xs" mb="sm">
        <IconRoute size={18} />
        <Text fw={600}>Parcours de vie</Text>
        <Text size="xs" c="dimmed">
          naissance, mariage, enfants, domiciles, décès — dans l'ordre
        </Text>
      </Group>
      {placees.length > 0 ? (
        <Carte etapes={placees} cle={cle} />
      ) : (
        <Text size="sm" c="dimmed" mb="sm">
          Aucun lieu de cette vie n'est encore placé sur la carte.
        </Text>
      )}
      <Stack gap={4} mt="sm">
        {numerotees.map(({ etape, numero }) => (
          <Group key={numero} gap="xs" wrap="nowrap">
            <Badge size="sm" circle color={COULEURS[etape.quoi]} variant="filled">
              {numero}
            </Badge>
            <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
              {etape.libelle}
              <Text span c="dimmed" size="sm">
                {[etape.date, etape.lieu && (etape.lieu.departement ? `${etape.lieu.nom} (${etape.lieu.departement})` : etape.lieu.nom)]
                  .filter(Boolean)
                  .map((x) => ` · ${x}`)
                  .join("")}
              </Text>
            </Text>
            {!etape.lieu ? (
              <Text size="xs" c="dimmed">
                lieu inconnu
              </Text>
            ) : (
              !estPlacee(etape) && (
                <AnchorLink to="/lieux" size="xs" c="orange.8">
                  lieu à placer sur la carte
                </AnchorLink>
              )
            )}
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
