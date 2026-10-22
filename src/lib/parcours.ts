/*
 * Parcours de vie d'une personne : naissance, mariage(s), naissance des enfants, décès,
 * dans l'ordre chronologique, chacune avec son lieu (et ses coordonnées si le lieu est placé).
 */

export type LieuGps = { id: string; nom: string; departement: string | null; latitude: number | null; longitude: number | null };

export type QuoiEtape = "naissance" | "mariage" | "enfant" | "deces";

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

export type SujetParcours = Personne & { couples: Union[]; enfants: Enfant[] };

/** Ordre des étapes sans date : naissance d'abord, décès en dernier. */
const REPLI: Record<QuoiEtape, string> = { naissance: "0000", mariage: "5000", enfant: "5001", deces: "9999" };

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
  if (p.deces || p.decesLieuId || p.acteDecesId) {
    ajouter({ quoi: "deces", libelle: "Décès", date: p.deces, lieu: lieu(p.decesLieuId, p.acteDecesId) }, p.decesMin);
  }

  // Tri stable : à date égale, l'ordre naturel (naissance, mariage, enfants, décès) est conservé.
  return etapes.sort((a, b) => (a.tri < b.tri ? -1 : a.tri > b.tri ? 1 : 0)).map(({ tri: _, ...e }) => e);
}

export const estPlacee = (e: Etape) => e.lieu?.latitude != null && e.lieu?.longitude != null;
