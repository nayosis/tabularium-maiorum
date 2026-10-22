/** Dernières fiches consultées sur cet appareil (accueil du téléphone). */
const CLE = "tabularium.recents";
const MAX = 8;

export function lireRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function ajouterRecent(id: string) {
  try {
    localStorage.setItem(CLE, JSON.stringify([id, ...lireRecents().filter((x) => x !== id)].slice(0, MAX)));
  } catch {
    // stockage indisponible : pas de liste des récents
  }
}
