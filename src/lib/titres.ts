/*
 * Titre automatique d'un document (bouton « Générer le titre » de l'atelier), à partir de sa nature,
 * de son type, de ses relevés, de son lieu et de son registre.
 */
import { libelle, libelleType, nomComplet, ROLES_PRINCIPAUX, TYPES_ACTE } from "./libelles";

type ActeTitre = { nature: string; type: string | null; date: string | null; pages: { numeroVue: string | null }[] };
type ReleveTitre = {
  role: string | null;
  nom: string | null;
  nomEcrit: string | null;
  prenoms: string | null;
  prenomsEcrits: string | null;
  naissance: string | null;
  deces: string | null;
  mariage: string | null;
  age: string | null;
  individuId: string | null;
  individuNom: string | null;
  individuPrenoms: string | null;
};
type LieuTitre = { nom: string; departement: string | null };

const nomReleve = (r: ReleveTitre | undefined) =>
  r ? [r.nom || r.nomEcrit, r.prenoms || r.prenomsEcrits].filter(Boolean).join(" ") : "";
const role = (r: ReleveTitre) => (r.role ?? "").toLowerCase();

/**
 * « Acte naissance Gouadon Henry Louis René 28/11/1897 @ Brissac 49 »
 * « Acte mariage Caduc Victor et Pinsard Flavide Alexandrine 25/06/1872 @ Saint Cassien 86 »
 * « Photo — MARTIN Jean, DUPONT Marie (+2) — vers 1920 »
 * « Tables décennales NMD Verruyes 1803-1892 — p. 172 »
 */
export function titreAuto(acte: ActeTitre, releves: ReleveTitre[], lieu: LieuTitre | undefined, registre: string | undefined) {
  const ou = lieu ? [lieu.nom, lieu.departement].filter(Boolean).join(" ") : "";
  if (acte.nature === "photo") {
    const noms = releves.filter((r) => r.individuId).map((r) => nomComplet({ nom: r.individuNom, prenoms: r.individuPrenoms }));
    const qui = noms.length > 3 ? `${noms.slice(0, 3).join(", ")} (+${noms.length - 3})` : noms.join(", ");
    return ["Photo", qui, acte.date].filter(Boolean).join(" — ");
  }
  if (acte.nature === "index") {
    const vue = acte.pages[0]?.numeroVue;
    const quoi = registre ?? [libelleType("index", acte.type), ou].filter(Boolean).join(" ");
    return [quoi || "Index", vue && `p. ${vue}`].filter(Boolean).join(" — ");
  }

  const type = acte.type ? libelle(TYPES_ACTE, acte.type).toLowerCase() : "";
  const lieuTexte = ou && `@ ${ou}`;

  // Mariage : les deux époux, l'époux d'abord.
  if (acte.type === "mariage") {
    const epoux = releves.find((r) => role(r) === "époux");
    const epouse = releves.find((r) => role(r) === "épouse");
    const noms = [nomReleve(epoux), nomReleve(epouse)].filter(Boolean).join(" et ");
    const date = acte.date || epoux?.mariage || epouse?.mariage;
    return ["Acte", type, noms, date, lieuTexte].filter(Boolean).join(" ");
  }

  const principal = releves.find((r) => ROLES_PRINCIPAUX.includes(role(r)));
  const date =
    (acte.type === "naissance" || acte.type === "bapteme") && principal?.naissance && !principal.age
      ? principal.naissance
      : acte.type === "deces" && principal?.deces
        ? principal.deces
        : acte.date;
  return ["Acte", type, nomReleve(principal), date, lieuTexte].filter(Boolean).join(" ");
}
