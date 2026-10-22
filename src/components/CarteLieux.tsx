import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Lieu } from "../db/schema";
import { ajouterFond } from "../lib/configuration";

const FRANCE: L.LatLngTuple = [46.6, 1.9];
const COULEUR = "#1c7ed6";
const COULEUR_SELECTION = "#0ca678";

type Props = {
  lieux: Lieu[];
  selectionId: string | null;
  onSelect: (id: string) => void;
  /** Clic sur la carte avec un lieu sélectionné : nouvelle position. Absent = carte en consultation. */
  onPlacer?: (lat: number, lng: number) => void;
};

/**
 * Carte des lieux (Leaflet, fond OpenStreetMap). Un point par lieu placé ;
 * cliquer sur la carte place le lieu sélectionné.
 */
export function CarteLieux({ lieux, selectionId, onSelect, onPlacer }: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const points = useRef<L.LayerGroup | null>(null);
  // Références à jour pour les écouteurs Leaflet (posés une seule fois).
  const rappels = useRef({ onSelect, onPlacer, selectionId });
  rappels.current = { onSelect, onPlacer, selectionId };

  // Création de la carte, une fois.
  useEffect(() => {
    if (!conteneur.current) return;
    const m = L.map(conteneur.current, { zoomControl: true }).setView(FRANCE, 6);
    ajouterFond(m);
    points.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      const { onPlacer: placer, selectionId: sel } = rappels.current;
      if (placer && sel) placer(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    });
    carte.current = m;
    // La carte doit connaître sa taille réelle quand le panneau change de dimensions.
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(conteneur.current);
    return () => {
      obs.disconnect();
      m.remove();
      carte.current = null;
    };
  }, []);

  // Points des lieux.
  useEffect(() => {
    const groupe = points.current;
    if (!groupe) return;
    groupe.clearLayers();
    for (const l of lieux) {
      if (l.latitude == null || l.longitude == null) continue;
      const sel = l.id === selectionId;
      L.circleMarker([l.latitude, l.longitude], {
        radius: sel ? 9 : 6,
        color: "white",
        weight: 2,
        fillColor: sel ? COULEUR_SELECTION : COULEUR,
        fillOpacity: 0.95,
      })
        .bindTooltip(l.departement ? `${l.nom} (${l.departement})` : l.nom, { direction: "top", offset: [0, -6] })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          rappels.current.onSelect(l.id);
        })
        .addTo(groupe);
    }
  }, [lieux, selectionId]);

  // Centrer sur le lieu sélectionné, s'il est placé.
  const selection = lieux.find((l) => l.id === selectionId);
  const lat = selection?.latitude;
  const lng = selection?.longitude;
  useEffect(() => {
    const m = carte.current;
    if (!m || lat == null || lng == null) return;
    m.setView([lat, lng], Math.max(m.getZoom(), 11));
  }, [selectionId, lat, lng]);

  // Ajuster la vue sur l'ensemble des lieux au premier affichage.
  const cadre = useRef(false);
  useEffect(() => {
    const m = carte.current;
    const places = lieux.filter((l) => l.latitude != null && l.longitude != null);
    if (!m || cadre.current || !places.length) return;
    cadre.current = true;
    m.fitBounds(L.latLngBounds(places.map((l) => [l.latitude!, l.longitude!] as L.LatLngTuple)), { padding: [30, 30], maxZoom: 11 });
  }, [lieux]);

  return (
    <div
      ref={conteneur}
      style={{ width: "100%", height: "100%", borderRadius: 8, cursor: onPlacer && selectionId ? "crosshair" : undefined }}
    />
  );
}

/**
 * Position d'une commune française, via le service de recherche d'OpenStreetMap (Nominatim).
 * N'envoie que le nom de la commune et le département.
 */
export async function trouverCommune(nom: string, departement?: string | null): Promise<{ lat: number; lng: number } | null> {
  // Seulement des localités (pas de rues « de Brissac » ailleurs), en France.
  const params = new URLSearchParams({
    format: "jsonv2",
    q: nom,
    countrycodes: "fr",
    featureType: "settlement",
    addressdetails: "1",
    limit: "10",
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Recherche impossible (${r.status})`);
  const res = (await r.json()) as { lat: string; lon: string; address?: Record<string, string> }[];
  // Le département désambiguïse les homonymes (Allonne 79 / Allonne 60). S'il est connu et qu'aucune
  // commune ne correspond (commune renommée, fusionnée…), mieux vaut « introuvable » qu'un point faux.
  const dept = departement?.trim().toUpperCase();
  const bon = dept
    ? res.find((x) => x.address?.["ISO3166-2-lvl6"] === `FR-${dept}` || (x.address?.postcode ?? "").startsWith(dept))
    : res[0];
  return bon ? { lat: +(+bon.lat).toFixed(6), lng: +(+bon.lon).toFixed(6) } : null;
}
