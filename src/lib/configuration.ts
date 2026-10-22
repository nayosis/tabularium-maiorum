import L from "leaflet";
import { appelApi } from "./rpc";

/** Ce que le serveur dit de lui-même, lu au démarrage : installation faite, version, fond de carte. */
type Configuration = { installe: boolean; version: string; tuiles: { url: string; attribution: string } };

let config: Configuration = {
  installe: true,
  version: "",
  tuiles: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
};

export async function chargerConfiguration() {
  config = await appelApi<Configuration>("/api/auth/etat", { silencieux: true });
  return config;
}
export const configuration = () => config;

/** Fond de carte configuré (OpenStreetMap par défaut). */
export const ajouterFond = (carte: L.Map) =>
  L.tileLayer(config.tuiles.url, { maxZoom: 18, attribution: config.tuiles.attribution }).addTo(carte);
