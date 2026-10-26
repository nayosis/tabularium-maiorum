/*
 * Parcours de vie d'une personne : naissance, mariage(s), naissance des enfants, décès,
 * dans l'ordre chronologique, chacune avec son lieu (et ses coordonnées si le lieu est placé).
 */
import { analyserDate } from "./dates";

export type LieuGps = { id: string; nom: string; departement: string | null; latitude: number | null; longitude: number | null };

export type QuoiEtape = "naissance" | "mariage" | "enfant" | "domicile" | "deces";

export type Etape = {
  quoi: QuoiEtape;
  libelle: string;
  date: string | null;
  lieu: LieuGps | null;
};

type Personne = {
  naissance: string | null;
  naissanceMin: string | null;
  naissanceLieuId: string | null;
  acteNaissanceId: string | null;
  deces: string | null;
  decesMin: string | null;
  decesLieuId: string | null;
  acteDecesId: string | null;
};

type Union = {
  date: string | null;
  dateMin: string | null;
  lieuId: string | null;
  acteId: string | null;
  conjointNom: string | null;
  conjointPrenoms: string | null;
};

type Enfant = Pick<Personne, "naissance" | "naissanceMin" | "naissanceLieuId" | "acteNaissanceId"> & {
  nom: string | null;
  prenoms: string | null;
  sexe: string | null;
};

/** Localité habitée à une date (registre matricule : localités successives). */
export type Domicile = { date: string | null; lieu: string };

export type SujetParcours = Personne & { couples: Union[]; enfants: Enfant[]; domiciles?: Domicile[] };

/** Ordre des étapes sans date : naissance d'abord, décès en dernier. */
const REPLI: Record<QuoiEtape, string> = { naissance: "0000", mariage: "5000", enfant: "5001", domicile: "5002", deces: "9999" };

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Commune connue dans un texte libre (« Angers, 12 rue Saint-Aubin », « à Brissac (49) ») : la plus longue trouvée. */
export function lieuDansTexte(texte: string, lieux: LieuGps[]): LieuGps | null {
  const t = ` ${normal(texte)} `;
  let meilleur: LieuGps | null = null;
  for (const l of lieux) {
    const n = normal(l.nom);
    if (n && t.includes(` ${n} `) && (!meilleur || n.length > normal(meilleur.nom).length)) meilleur = l;
  }
  return meilleur;
}

const nomCourt = (nom: string | null, prenoms: string | null) => [prenoms, nom?.toUpperCase()].filter(Boolean).join(" ") || "?";

/**
 * @param lieux     tous les lieux (pour nom et coordonnées)
 * @param lieuActe  lieu de chaque acte, utilisé quand la fiche n'indique pas de lieu
 */
export function etapesVie(p: SujetParcours, lieux: LieuGps[], lieuActe: Map<string, string | null>): Etape[] {
  const parId = new Map(lieux.map((l) => [l.id, l]));
  const lieu = (lieuId: string | null, acteId: string | null) => {
    const id = lieuId ?? (acteId ? lieuActe.get(acteId) ?? null : null);
    return id ? parId.get(id) ?? null : null;
  };

  const etapes: (Etape & { tri: string })[] = [];
  const ajouter = (e: Etape, tri: string | null) => etapes.push({ ...e, tri: tri ?? REPLI[e.quoi] });

  if (p.naissance || p.naissanceLieuId || p.acteNaissanceId) {
    ajouter({ quoi: "naissance", libelle: "Naissance", date: p.naissance, lieu: lieu(p.naissanceLieuId, p.acteNaissanceId) }, p.naissanceMin);
  }
  for (const u of p.couples) {
    const avec = u.conjointNom || u.conjointPrenoms ? ` avec ${nomCourt(u.conjointNom, u.conjointPrenoms)}` : "";
    ajouter({ quoi: "mariage", libelle: `Mariage${avec}`, date: u.date, lieu: lieu(u.lieuId, u.acteId) }, u.dateMin);
  }
  for (const e of p.enfants) {
    const quel = e.sexe === "F" ? "d'une fille" : e.sexe === "M" ? "d'un fils" : "d'un enfant";
    ajouter(
      { quoi: "enfant", libelle: `Naissance ${quel} : ${nomCourt(e.nom, e.prenoms)}`, date: e.naissance, lieu: lieu(e.naissanceLieuId, e.acteNaissanceId) },
      e.naissanceMin,
    );
  }
  for (const d of p.domiciles ?? []) {
    if (!d.lieu.trim()) continue;
    ajouter({ quoi: "domicile", libelle: `Domicile : ${d.lieu.trim()}`, date: d.date, lieu: lieuDansTexte(d.lieu, lieux) }, analyserDate(d.date)?.min ?? null);
  }
  if (p.deces || p.decesLieuId || p.acteDecesId) {
    ajouter({ quoi: "deces", libelle: "Décès", date: p.deces, lieu: lieu(p.decesLieuId, p.acteDecesId) }, p.decesMin);
  }

  // Tri stable : à date égale, l'ordre naturel (naissance, mariage, enfants, décès) est conservé.
  return etapes.sort((a, b) => (a.tri < b.tri ? -1 : a.tri > b.tri ? 1 : 0)).map(({ tri: _, ...e }) => e);
}

export const estPlacee = (e: Etape) => e.lieu?.latitude != null && e.lieu?.longitude != null;
