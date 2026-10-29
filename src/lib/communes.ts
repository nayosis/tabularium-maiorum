/*
 * Communes françaises officielles, via l'API Découpage administratif de l'État (geo.api.gouv.fr, sans clé) :
 * code INSEE, département et centre. On interroge aussi les communes déléguées et associées (anciennes communes
 * fusionnées : Brissac-Quincé dans Brissac Loire Aubance). N'envoie que le nom de la commune et le département.
 */

export type CommuneOfficielle = {
  nom: string;
  code: string;
  departement: string;
  /** « actuelle », ou ancienne commune devenue « déléguée » / « associée » d'une commune nouvelle. */
  type: "actuelle" | "deleguee" | "associee";
  lat: number | null;
  lng: number | null;
};

const API = "https://geo.api.gouv.fr";
type Brut = { nom: string; code: string; codeDepartement: string; type?: string; centre?: { coordinates: [number, number] } };

/** « St-Martin-d'Ars » → « saint martin d ars » : pour comparer les noms sans se soucier de l'écriture. */
export const normaliserCommune = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-'’_.]/g, " ")
    .replace(/\bste\b/g, "sainte")
    .replace(/\bst\b/g, "saint")
    .replace(/\s+/g, " ")
    .trim();

const depuisBrut = (c: Brut): CommuneOfficielle => ({
  nom: c.nom,
  code: c.code,
  departement: c.codeDepartement,
  type: c.type === "commune-deleguee" ? "deleguee" : c.type === "commune-associee" ? "associee" : "actuelle",
  lat: c.centre ? +c.centre.coordinates[1].toFixed(6) : null,
  lng: c.centre ? +c.centre.coordinates[0].toFixed(6) : null,
});

/** Communes actuelles et anciennes dont le nom ressemble, filtrées par département s'il est connu. */
export async function chercherCommunes(nom: string, departement?: string | null): Promise<CommuneOfficielle[]> {
  const params = (fields: string) => {
    const p = new URLSearchParams({ nom, fields, limit: "10" });
    if (departement?.trim()) p.set("codeDepartement", departement.trim().toUpperCase());
    return p;
  };
  const lire = async (url: string) => {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`Service des communes indisponible (${r.status})`);
    return ((await r.json()) as Brut[]).map(depuisBrut);
  };
  const [actuelles, anciennes] = await Promise.all([
    lire(`${API}/communes?${params("nom,code,codeDepartement,centre")}&boost=population`),
    lire(`${API}/communes_associees_deleguees?${params("nom,code,codeDepartement,type,centre")}`),
  ]);
  return [...actuelles, ...anciennes];
}

/**
 * La commune qui correspond sans ambiguïté au lieu : même nom (écriture comparée sans accents ni tirets) et même
 * département s'il est connu. Une ancienne commune passe avant la commune nouvelle qui porte son code.
 * Null s'il n'y en a aucune, ou plusieurs (homonymes dans des départements différents) : à choisir à la main.
 */
export function communeCorrespondante(nom: string, departement: string | null | undefined, candidats: CommuneOfficielle[]) {
  const n = normaliserCommune(nom);
  const dept = departement?.trim().toUpperCase();
  const memes = candidats.filter((c) => normaliserCommune(c.nom) === n && (!dept || c.departement === dept));
  const codes = new Set(memes.map((c) => `${c.departement}|${c.code}`));
  if (codes.size !== 1) return null;
  return memes.find((c) => c.type !== "actuelle") ?? memes[0];
}

export const libelleCommune = (c: CommuneOfficielle) =>
  `${c.nom} (${c.departement}) — ${c.code}${c.type === "deleguee" ? ", commune déléguée" : c.type === "associee" ? ", commune associée" : ""}`;
