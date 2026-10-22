/*
 * Ce qui permet de juger un rapprochement relevé ↔ individu : l'événement daté du relevé
 * (selon le document et le rôle) et le résumé de vie d'un individu candidat.
 */
import { EVENEMENT_INDEX, libelleType } from "./libelles";

type ReleveDate = {
  role: string | null;
  acteNature: string;
  acteType: string | null;
  acteDate: string | null;
  acteLieuNom: string | null;
  naissance: string | null;
  naissanceLieu: string | null;
  mariage: string | null;
  mariageLieu: string | null;
  deces: string | null;
  decesLieu: string | null;
};

const avecLieu = (date: string | null, lieu: string | null) => [date, lieu].filter(Boolean).join(" · ");
const LIBELLE = { naissance: "Naissance", mariage: "Mariage", deces: "Décès" } as const;

/**
 * Lignes « événement » d'un relevé :
 * - ligne d'index : l'événement que la table indique (naissance d'un enfant, mariage d'un époux, décès d'un défunt) ;
 * - acte : son type, sa date et son lieu ;
 * puis les autres dates notées dans le relevé (naissance calculée depuis l'âge, mention de décès…).
 */
export function evenementsReleve(r: ReleveDate): string[] {
  const lignes: string[] = [];
  const quoiIndex = r.acteNature === "index" ? EVENEMENT_INDEX[(r.role ?? "").trim().toLowerCase()] : undefined;
  if (quoiIndex) {
    lignes.push(`${LIBELLE[quoiIndex]} · ${avecLieu(r[quoiIndex], r[`${quoiIndex}Lieu`]) || "date non notée"}`);
  } else if (r.acteNature !== "index") {
    const acte = [libelleType(r.acteNature, r.acteType) || "Acte", r.acteDate, r.acteLieuNom].filter(Boolean).join(" · ");
    lignes.push(acte);
  }
  if (quoiIndex !== "naissance" && r.naissance) lignes.push(`° ${avecLieu(r.naissance, r.naissanceLieu)}`);
  if (quoiIndex !== "mariage" && r.mariage) lignes.push(`∞ ${avecLieu(r.mariage, r.mariageLieu)}`);
  if (quoiIndex !== "deces" && r.deces) lignes.push(`† ${avecLieu(r.deces, r.decesLieu)}`);
  return lignes;
}

/** « ° 28/11/1897 · Brissac  † 5/9/1981 · Saumur » pour un individu ; vide si rien de connu. */
export function resumeVie(p: {
  naissance: string | null;
  naissanceLieu: string | null;
  deces: string | null;
  decesLieu: string | null;
}): string {
  const n = avecLieu(p.naissance, p.naissanceLieu);
  const d = avecLieu(p.deces, p.decesLieu);
  return [n && `° ${n}`, d && `† ${d}`].filter(Boolean).join("   ");
}
