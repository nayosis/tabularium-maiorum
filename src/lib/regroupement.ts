/*
 * Regroupement des documents par registre : reconnaissance du numéro de page dans un titre
 * (« … (1803-1892) page 159 »), suggestions de regroupement pour les documents sans registre,
 * et affichage court des titres à l'intérieur d'un groupe.
 */

const RE_PAGE = /^(.*?)[\s,;:–—-]*\b(?:page|p\.|vue|folio|f°|f\.)\s*(\d+[a-z]?)\s*$/i;

/** « Allonne … (1803-1892) page 159 » → { prefixe: "Allonne … (1803-1892)", numero: "159" }. */
export function extrairePage(titre: string): { prefixe: string; numero: string } | null {
  const m = titre.trim().match(RE_PAGE);
  if (!m || !m[1].trim()) return null;
  return { prefixe: m[1].trim().replace(/[\s,;:–—-]+$/, ""), numero: m[2] };
}

type DocTitre = { id: string; titre: string; sourceId: string | null };

export type SuggestionRegroupement = {
  /** Titre proposé pour le registre. */
  titre: string;
  ids: string[];
  /** Numéro de page extrait de chaque titre. */
  numeros: Record<string, string>;
};

/** Documents sans registre dont les titres ne diffèrent que par le numéro de page (au moins 2). */
export function suggestionsRegroupement(docs: DocTitre[]): SuggestionRegroupement[] {
  const groupes = new Map<string, SuggestionRegroupement>();
  for (const d of docs) {
    if (d.sourceId) continue;
    const e = extrairePage(d.titre);
    if (!e) continue;
    const cle = e.prefixe.toLowerCase();
    const g = groupes.get(cle) ?? { titre: e.prefixe, ids: [], numeros: {} };
    g.ids.push(d.id);
    g.numeros[d.id] = e.numero;
    groupes.set(cle, g);
  }
  return [...groupes.values()].filter((g) => g.ids.length >= 2).sort((a, b) => b.ids.length - a.ids.length);
}

/** Plus long début commun (coupé sur un mot) à tous les titres d'un groupe. */
export function prefixeCommun(titres: string[]): string {
  if (titres.length < 2) return "";
  let p = titres[0];
  for (const t of titres.slice(1)) {
    let i = 0;
    while (i < p.length && i < t.length && p[i] === t[i]) i++;
    p = p.slice(0, i);
  }
  // Ne pas couper au milieu d'un mot ou d'un nombre.
  const coupe = p.search(/[\s,;:–—-]+[^\s,;:–—-]*$/);
  if (coupe > 0 && !/[\s,;:–—-]$/.test(p)) p = p.slice(0, coupe + 1);
  // Garder « page 159 » entier : le mot « page » / « p. » / « vue » reste dans le titre court.
  return p.replace(/(?<=^|[\s,;:–—-])(?:page|p\.|vue|folio|f°|f\.)\s*$/i, "");
}

/** Titre affiché dans un groupe : sans le préfixe commun (« page 159 »), sinon le titre complet. */
export function titreCourt(titre: string, prefixe: string) {
  if (!prefixe || !titre.startsWith(prefixe)) return titre;
  const reste = titre.slice(prefixe.length).replace(/^[\s,;:–—-]+/, "");
  return reste || titre;
}

/** Tri naturel des pages : 12 avant 103, puis ordre alphabétique. */
export function comparerPages(a: { numero: string | null; titre: string }, b: { numero: string | null; titre: string }) {
  const na = a.numero ? parseInt(a.numero, 10) : NaN;
  const nb = b.numero ? parseInt(b.numero, 10) : NaN;
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  if (!isNaN(na) !== !isNaN(nb)) return isNaN(na) ? 1 : -1;
  return a.titre.localeCompare(b.titre, "fr", { numeric: true });
}

/** Numéro de page d'un document : celui saisi sur l'image, sinon celui du titre. */
export const numeroDe = (a: { numeroPage: string | null; titre: string }) => a.numeroPage || extrairePage(a.titre)?.numero || null;

/** Documents d'un registre dans l'ordre des pages. */
export const trierParPage = <T extends { numeroPage: string | null; titre: string }>(docs: T[]) =>
  [...docs].sort((a, b) => comparerPages({ numero: numeroDe(a), titre: a.titre }, { numero: numeroDe(b), titre: b.titre }));

/**
 * Numéro de page deviné depuis un nom de fichier :
 * « … page 172.jpg » → 172, « FRAD079_3E12_0172.jpg » → 172 (dernier nombre, sans zéros de tête).
 */
export function numeroDepuisNomFichier(nom: string | undefined): string | null {
  if (!nom) return null;
  const base = nom.replace(/\.[a-z0-9]+$/i, "");
  const explicite = base.match(/(?:page|p\.|vue|folio|f°)\s*0*(\d+[a-z]?)\s*$/i);
  if (explicite) return explicite[1];
  const nombres = base.match(/\d+/g);
  if (!nombres) return null;
  const dernier = nombres[nombres.length - 1];
  // Une année (1803) ou un nombre trop long n'est probablement pas une page.
  if (dernier.length > 5 || (dernier.length === 4 && /^1[5-9]\d\d$/.test(dernier))) return null;
  return String(parseInt(dernier, 10));
}
