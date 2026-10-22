/*
 * Synthèse des relevés d'un individu : ce que les documents disent de lui, champ par champ,
 * pour remplir sa fiche. Valeurs identiques regroupées (avec toutes leurs sources),
 * déductions depuis le type d'acte, croisement des fourchettes de naissance.
 */
import type { ReleveAvecActe } from "../data/releves";
import type { Individu } from "../db/schema";
import { analyserDate } from "./dates";
import { SEXES, libelle } from "./libelles";

export type Source = { releveId: string; acteId: string; acteTitre: string; role: string | null };

export type Champ = "nom" | "prenoms" | "sexe" | "naissance" | "naissanceLieu" | "deces" | "decesLieu" | "profession";

export const LIBELLES_CHAMPS: Record<Champ, string> = {
  nom: "Nom",
  prenoms: "Prénoms",
  sexe: "Sexe",
  naissance: "Naissance",
  naissanceLieu: "Lieu de naissance",
  deces: "Décès",
  decesLieu: "Lieu de décès",
  profession: "Profession",
};

export type Proposition = {
  champ: Champ;
  valeur: string;
  /** Champs de la fiche à écrire (sauf lieux, résolus à l'application). */
  patch?: Partial<Individu>;
  /** Lieu : id connu (lieu de l'acte) ou seulement un nom écrit dans le relevé. */
  lieu?: { id: string | null; nom: string };
  /** Explication quand la valeur est déduite et non lue dans le relevé. */
  deduite?: string;
  /** La valeur contredit une source plus sûre (ex. âge déclaré vs acte de naissance). */
  incompatible?: string;
  sources: Source[];
};

export const cleTexte = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const role = (r: ReleveAvecActe) => (r.role ?? "").toLowerCase();
const estEnfant = (r: ReleveAvecActe) => role(r) === "enfant" && (r.acteType === "naissance" || r.acteType === "bapteme");
const estDefunt = (r: ReleveAvecActe) => role(r) === "défunt" && (r.acteType === "deces" || r.acteType === "sepulture");

const dateFloue = (nom: "naissance" | "deces", saisie: string) => {
  const b = analyserDate(saisie);
  return { [nom]: saisie, [`${nom}Min`]: b?.min ?? null, [`${nom}Max`]: b?.max ?? null } as Partial<Individu>;
};

export function propositions(releves: ReleveAvecActe[]): Proposition[] {
  const parCle = new Map<string, Proposition>();
  const ajouter = (p: Omit<Proposition, "sources">, cle: string, r: ReleveAvecActe) => {
    const source = { releveId: r.id, acteId: r.acteId, acteTitre: r.acteTitre, role: r.role };
    const k = `${p.champ}|${cle}`;
    const existante = parCle.get(k);
    if (existante) existante.sources.push(source);
    else parCle.set(k, { ...p, sources: [source] });
  };

  for (const r of releves) {
    const nom = r.nom || r.nomEcrit;
    if (nom) ajouter({ champ: "nom", valeur: nom, patch: { nom } }, cleTexte(nom), r);
    const prenoms = r.prenoms || r.prenomsEcrits;
    if (prenoms) ajouter({ champ: "prenoms", valeur: prenoms, patch: { prenoms } }, cleTexte(prenoms), r);
    if (r.sexe === "M" || r.sexe === "F") ajouter({ champ: "sexe", valeur: libelle(SEXES, r.sexe), patch: { sexe: r.sexe } }, r.sexe, r);

    // Naissance : lue dans le relevé, sinon déduite d'un acte de naissance / baptême.
    if (r.naissance) {
      ajouter({ champ: "naissance", valeur: r.naissance, patch: { naissance: r.naissance, naissanceMin: r.naissanceMin, naissanceMax: r.naissanceMax } }, `${r.naissanceMin}|${r.naissanceMax}|${cleTexte(r.naissance)}`, r);
    } else if (estEnfant(r) && r.acteDate) {
      const saisie = `avant le ${r.acteDate}`;
      ajouter({ champ: "naissance", valeur: saisie, patch: dateFloue("naissance", saisie), deduite: `acte de ${r.acteType === "bapteme" ? "baptême" : "naissance"} daté du ${r.acteDate}` }, cleTexte(saisie), r);
    }
    if (r.naissanceLieu) {
      ajouter({ champ: "naissanceLieu", valeur: r.naissanceLieu, lieu: { id: null, nom: r.naissanceLieu } }, cleTexte(r.naissanceLieu), r);
    } else if (estEnfant(r) && r.acteLieuId && r.acteLieuNom) {
      ajouter({ champ: "naissanceLieu", valeur: r.acteLieuNom, lieu: { id: r.acteLieuId, nom: r.acteLieuNom }, deduite: "lieu de l'acte" }, cleTexte(r.acteLieuNom), r);
    }

    // Décès : lu dans le relevé (mention marginale…), sinon déduit d'un acte de décès / sépulture.
    if (r.deces) {
      ajouter({ champ: "deces", valeur: r.deces, patch: { deces: r.deces, decesMin: r.decesMin, decesMax: r.decesMax } }, `${r.decesMin}|${r.decesMax}|${cleTexte(r.deces)}`, r);
    } else if (estDefunt(r) && r.acteDate) {
      const saisie = `avant le ${r.acteDate}`;
      ajouter({ champ: "deces", valeur: saisie, patch: dateFloue("deces", saisie), deduite: `acte de ${r.acteType === "sepulture" ? "sépulture" : "décès"} daté du ${r.acteDate}` }, cleTexte(saisie), r);
    }
    if (r.decesLieu) {
      ajouter({ champ: "decesLieu", valeur: r.decesLieu, lieu: { id: null, nom: r.decesLieu } }, cleTexte(r.decesLieu), r);
    } else if (estDefunt(r) && r.acteLieuId && r.acteLieuNom) {
      ajouter({ champ: "decesLieu", valeur: r.acteLieuNom, lieu: { id: r.acteLieuId, nom: r.acteLieuNom }, deduite: "lieu de l'acte" }, cleTexte(r.acteLieuNom), r);
    }

    if (r.profession) ajouter({ champ: "profession", valeur: r.profession, patch: { profession: r.profession } }, cleTexte(r.profession), r);
  }

  // L'acte de naissance fait foi : les naissances déduites d'un âge qui le contredisent sont signalées.
  const etablie = naissanceEtablie(releves);
  if (etablie) {
    const parId = new Map(releves.map((r) => [r.id, r]));
    for (const p of parCle.values()) {
      if (p.champ !== "naissance" || p.sources.some((s) => estEnfant(parId.get(s.releveId)!))) continue;
      if (disjointes(etablie, { min: p.patch?.naissanceMin ?? null, max: p.patch?.naissanceMax ?? null })) {
        p.incompatible = "incompatible avec l'acte de naissance (âge mal déclaré ?)";
      }
    }
  }

  const ordre = Object.keys(LIBELLES_CHAMPS);
  return [...parCle.values()].sort((a, b) => ordre.indexOf(a.champ) - ordre.indexOf(b.champ));
}

type Bornes = { min: string | null; max: string | null };

const disjointes = (a: Bornes, b: Bornes) => (!!a.max && !!b.min && b.min > a.max) || (!!a.min && !!b.max && b.max < a.min);

/**
 * Naissance établie par un acte de naissance / baptême où la personne est « enfant » :
 * date lue dans le relevé, sinon « avant ou le » jour de l'acte. Null s'il n'y en a pas.
 */
export function naissanceEtablie(releves: ReleveAvecActe[]): Bornes | null {
  const bornes = releves
    .filter(estEnfant)
    .map((r): Bornes => (r.naissanceMin || r.naissanceMax ? { min: r.naissanceMin, max: r.naissanceMax } : { min: null, max: r.acteDateMax }))
    .filter((b) => b.min || b.max);
  if (!bornes.length) return null;
  const mins = bornes.map((b) => b.min).filter((d): d is string => !!d);
  const maxs = bornes.map((b) => b.max).filter((d): d is string => !!d);
  return {
    min: mins.length ? mins.reduce((a, b) => (a > b ? a : b)) : null,
    max: maxs.length ? maxs.reduce((a, b) => (a < b ? a : b)) : null,
  };
}

const fr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Croise les fourchettes de naissance de tous les relevés (âges déclarés à différentes dates,
 * date d'un acte de naissance) :
 * la naissance est dans l'intersection. Null s'il y a moins de deux relevés datés.
 */
export function croisementNaissance(releves: ReleveAvecActe[]) {
  // Avec un acte de naissance, le croisement des âges n'a plus d'intérêt : l'acte fait foi.
  if (naissanceEtablie(releves)) return null;
  // Bornes de chaque relevé, lues ou déduites (ex. « avant le » date de l'acte de naissance).
  const bornes = releves
    .map((r) => propositions([r]).find((p) => p.champ === "naissance")?.patch)
    .filter((b): b is Partial<Individu> => !!b && !!(b.naissanceMin || b.naissanceMax));
  if (bornes.length < 2) return null;
  const dates = bornes;
  const mins = dates.map((b) => b.naissanceMin).filter((d): d is string => !!d);
  const maxs = dates.map((b) => b.naissanceMax).filter((d): d is string => !!d);
  const min = mins.length ? mins.reduce((a, b) => (a > b ? a : b)) : null;
  const max = maxs.length ? maxs.reduce((a, b) => (a < b ? a : b)) : null;
  if (min && max && min > max) return { contradiction: true as const, nb: dates.length, min, max };
  const saisie =
    min && max ? (min === max ? fr(min) : `entre le ${fr(min)} et le ${fr(max)}`) : max ? `avant le ${fr(max)}` : `après le ${fr(min!)}`;
  return { contradiction: false as const, nb: dates.length, min, max, saisie, patch: { naissance: saisie, naissanceMin: min, naissanceMax: max } };
}

/** La valeur est-elle déjà celle de la fiche ? */
export function dejaDansFiche(p: Proposition, fiche: Partial<Individu>): boolean {
  switch (p.champ) {
    case "naissance":
      return !!fiche.naissance && fiche.naissanceMin === p.patch?.naissanceMin && fiche.naissanceMax === p.patch?.naissanceMax;
    case "deces":
      return !!fiche.deces && fiche.decesMin === p.patch?.decesMin && fiche.decesMax === p.patch?.decesMax;
    case "naissanceLieu":
    case "decesLieu":
      return false; // comparé côté écran (il faut les noms des lieux)
    case "profession":
      return cleTexte(fiche.profession ?? "").includes(cleTexte(p.valeur));
    default:
      return cleTexte(String(fiche[p.champ] ?? "")) === cleTexte(p.valeur) || fiche[p.champ] === p.patch?.[p.champ];
  }
}
