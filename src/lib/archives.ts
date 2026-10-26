/*
 * Annuaire des archives : services d'archives départementales (site, état civil, registres matricules,
 * recensements, cadastre, notaires) et ressources nationales. Liste fournie avec Tabularium, vérifiée en octobre 2026 ;
 * chacun peut la corriger ou la compléter dans l'outil (page Archives), les corrections étant gardées en base.
 */

export const CATEGORIES_ARCHIVES = [
  { value: "site", label: "Site des archives" },
  { value: "etat_civil", label: "État civil" },
  { value: "matricules", label: "Registres matricules" },
  { value: "recensements", label: "Recensements" },
  { value: "cadastre", label: "Cadastre" },
  { value: "notaires", label: "Notaires" },
  { value: "autre", label: "Autre" },
] as const;
export type CategorieArchives = (typeof CATEGORIES_ARCHIVES)[number]["value"];

export type LienArchives = { categorie: CategorieArchives; libelle: string; url: string };
export type Departement = { code: string; nom: string; site: string | null };

/** Les 101 départements et le site de leurs archives (null : adresse à compléter). */
export const DEPARTEMENTS: Departement[] = [
  { code: "01", nom: "Ain", site: "https://www.archives.ain.fr" },
  { code: "02", nom: "Aisne", site: "https://archives.aisne.fr" },
  { code: "03", nom: "Allier", site: "https://archives.allier.fr" },
  { code: "04", nom: "Alpes-de-Haute-Provence", site: "https://www.archives04.fr" },
  { code: "05", nom: "Hautes-Alpes", site: "https://archives.hautes-alpes.fr" },
  { code: "06", nom: "Alpes-Maritimes", site: null },
  { code: "07", nom: "Ardèche", site: "https://archives.ardeche.fr" },
  { code: "08", nom: "Ardennes", site: "https://archives.cd08.fr" },
  { code: "09", nom: "Ariège", site: "https://archives.ariege.fr" },
  { code: "10", nom: "Aube", site: "https://www.archives-aube.fr" },
  { code: "11", nom: "Aude", site: "https://archivesdepartementales.aude.fr" },
  { code: "12", nom: "Aveyron", site: "https://archives.aveyron.fr" },
  { code: "13", nom: "Bouches-du-Rhône", site: "https://www.archives13.fr" },
  { code: "14", nom: "Calvados", site: "https://archives.calvados.fr" },
  { code: "15", nom: "Cantal", site: "https://archives.cantal.fr" },
  { code: "16", nom: "Charente", site: "https://archives.lacharente.fr" },
  { code: "17", nom: "Charente-Maritime", site: "https://archives.charente-maritime.fr" },
  { code: "18", nom: "Cher", site: "https://www.archives18.fr" },
  { code: "19", nom: "Corrèze", site: "https://www.archives.correze.fr" },
  { code: "2A", nom: "Corse-du-Sud", site: "https://archives.isula.corsica" },
  { code: "2B", nom: "Haute-Corse", site: "https://archives.isula.corsica" },
  { code: "21", nom: "Côte-d'Or", site: "https://archives.cotedor.fr" },
  { code: "22", nom: "Côtes-d'Armor", site: "https://archives.cotesdarmor.fr" },
  { code: "23", nom: "Creuse", site: "https://archives.creuse.fr" },
  { code: "24", nom: "Dordogne", site: "https://archives.dordogne.fr" },
  { code: "25", nom: "Doubs", site: "https://archives.doubs.fr" },
  { code: "26", nom: "Drôme", site: "https://archives.ladrome.fr" },
  { code: "27", nom: "Eure", site: "https://archives.eure.fr" },
  { code: "28", nom: "Eure-et-Loir", site: "https://archives28.fr" },
  { code: "29", nom: "Finistère", site: "https://archives.finistere.fr" },
  { code: "30", nom: "Gard", site: "https://archives.gard.fr" },
  { code: "31", nom: "Haute-Garonne", site: "https://archives.haute-garonne.fr" },
  { code: "32", nom: "Gers", site: "https://archives32.fr" },
  { code: "33", nom: "Gironde", site: "https://archives.gironde.fr" },
  { code: "34", nom: "Hérault", site: "https://archives-pierresvives.herault.fr" },
  { code: "35", nom: "Ille-et-Vilaine", site: "https://archives.ille-et-vilaine.fr" },
  { code: "36", nom: "Indre", site: "https://www.archives36.fr" },
  { code: "37", nom: "Indre-et-Loire", site: "https://archives.touraine.fr" },
  { code: "38", nom: "Isère", site: "https://archives.isere.fr" },
  { code: "39", nom: "Jura", site: "https://archives39.fr" },
  { code: "40", nom: "Landes", site: "https://archives.landes.fr" },
  { code: "41", nom: "Loir-et-Cher", site: "https://archives.culture41.fr" },
  { code: "42", nom: "Loire", site: "https://archives.loire.fr" },
  { code: "43", nom: "Haute-Loire", site: "https://www.archives43.fr" },
  { code: "44", nom: "Loire-Atlantique", site: "https://archives.loire-atlantique.fr" },
  { code: "45", nom: "Loiret", site: "https://archives-loiret.fr" },
  { code: "46", nom: "Lot", site: "https://archives.lot.fr" },
  { code: "47", nom: "Lot-et-Garonne", site: null },
  { code: "48", nom: "Lozère", site: "https://archives.lozere.fr" },
  { code: "49", nom: "Maine-et-Loire", site: "https://archives.maine-et-loire.fr" },
  { code: "50", nom: "Manche", site: "https://archives.manche.fr" },
  { code: "51", nom: "Marne", site: "https://archives.marne.fr" },
  { code: "52", nom: "Haute-Marne", site: "https://archives.haute-marne.fr" },
  { code: "53", nom: "Mayenne", site: "https://archives.lamayenne.fr" },
  { code: "54", nom: "Meurthe-et-Moselle", site: "https://archives.meurthe-et-moselle.fr" },
  { code: "55", nom: "Meuse", site: "https://archives.meuse.fr" },
  { code: "56", nom: "Morbihan", site: "https://archives.morbihan.fr" },
  { code: "57", nom: "Moselle", site: "https://archives57.com" },
  { code: "58", nom: "Nièvre", site: "https://archives.nievre.fr" },
  { code: "59", nom: "Nord", site: "https://archivesdepartementales.lenord.fr" },
  { code: "60", nom: "Oise", site: "https://archives.oise.fr" },
  { code: "61", nom: "Orne", site: "https://archives.orne.fr" },
  { code: "62", nom: "Pas-de-Calais", site: "https://www.archivespasdecalais.fr" },
  { code: "63", nom: "Puy-de-Dôme", site: "https://www.archivesdepartementales.puydedome.fr" },
  { code: "64", nom: "Pyrénées-Atlantiques", site: "https://archives.le64.fr" },
  { code: "65", nom: "Hautes-Pyrénées", site: "https://archivesenligne65.fr" },
  { code: "66", nom: "Pyrénées-Orientales", site: null },
  { code: "67", nom: "Bas-Rhin", site: "https://archives.alsace.eu" },
  { code: "68", nom: "Haut-Rhin", site: "https://archives.alsace.eu" },
  { code: "69", nom: "Rhône", site: "https://archives.rhone.fr" },
  { code: "70", nom: "Haute-Saône", site: "https://archives.haute-saone.fr" },
  { code: "71", nom: "Saône-et-Loire", site: "https://www.archives71.fr" },
  { code: "72", nom: "Sarthe", site: "https://archives.sarthe.fr" },
  { code: "73", nom: "Savoie", site: "https://www.savoie-archives.fr" },
  { code: "74", nom: "Haute-Savoie", site: "https://archives.hautesavoie.fr" },
  { code: "75", nom: "Paris", site: "https://archives.paris.fr" },
  { code: "76", nom: "Seine-Maritime", site: "https://www.archivesdepartementales76.net" },
  { code: "77", nom: "Seine-et-Marne", site: "https://archives.seine-et-marne.fr" },
  { code: "78", nom: "Yvelines", site: "https://archives.yvelines.fr" },
  { code: "79", nom: "Deux-Sèvres", site: "https://archives-deux-sevres-vienne.fr" },
  { code: "80", nom: "Somme", site: "https://archives.somme.fr" },
  { code: "81", nom: "Tarn", site: "https://archives.tarn.fr" },
  { code: "82", nom: "Tarn-et-Garonne", site: null },
  { code: "83", nom: "Var", site: "https://archives.var.fr" },
  { code: "84", nom: "Vaucluse", site: "https://archives.vaucluse.fr" },
  { code: "85", nom: "Vendée", site: "https://archives.vendee.fr" },
  { code: "86", nom: "Vienne", site: "https://archives-deux-sevres-vienne.fr" },
  { code: "87", nom: "Haute-Vienne", site: "https://archives.haute-vienne.fr" },
  { code: "88", nom: "Vosges", site: "https://archives.vosges.fr" },
  { code: "89", nom: "Yonne", site: "https://archives.yonne.fr" },
  { code: "90", nom: "Territoire de Belfort", site: "https://archives.territoiredebelfort.fr" },
  { code: "91", nom: "Essonne", site: "https://archives.essonne.fr" },
  { code: "92", nom: "Hauts-de-Seine", site: "https://archives.hauts-de-seine.fr" },
  { code: "93", nom: "Seine-Saint-Denis", site: "https://archives.seinesaintdenis.fr" },
  { code: "94", nom: "Val-de-Marne", site: "https://archives.valdemarne.fr" },
  { code: "95", nom: "Val-d'Oise", site: "https://archives.valdoise.fr" },
  { code: "971", nom: "Guadeloupe", site: "https://www.archivesguadeloupe.fr" },
  { code: "972", nom: "Martinique", site: null },
  { code: "973", nom: "Guyane", site: "https://archives.ctguyane.fr" },
  { code: "974", nom: "La Réunion", site: null },
  { code: "976", nom: "Mayotte", site: null },
];

/** Liens détaillés vérifiés (départements de l'auteur ; à compléter dans l'outil pour les autres). */
export const LIENS_DETAILLES: Record<string, LienArchives[]> = {
  "49": [
    { categorie: "etat_civil", libelle: "Archives numérisées (état civil, matricules, cadastre…)", url: "https://archives.maine-et-loire.fr/recherche-et-consulter/archives-numerisees" },
    { categorie: "autre", libelle: "État civil après 1902 (où le consulter)", url: "https://archives.maine-et-loire.fr/recherche-et-consulter/archives-consultables-en-ligne/etat-civil-apres-1902" },
  ],
  "37": [
    { categorie: "etat_civil", libelle: "Ressources en ligne (état civil, recensements, matricules, cadastre, notaires)", url: "https://archives.touraine.fr/document/ressources-en-ligne" },
    { categorie: "autre", libelle: "Des personnes et des familles", url: "https://archives.touraine.fr/page/des-personnes-et-des-familles" },
  ],
  "53": [
    { categorie: "etat_civil", libelle: "Recherches généalogiques (état civil, recensements)", url: "https://archives.lamayenne.fr/page/recherches-genealogiques" },
    { categorie: "matricules", libelle: "Rechercher une personne (conscrits…)", url: "https://archives.lamayenne.fr/page/rechercher-une-personne" },
  ],
  "44": [
    { categorie: "etat_civil", libelle: "Registres paroissiaux et d'état civil", url: "https://archives-numerisees.loire-atlantique.fr/chercher/etat-civil-et-registres-paroissiaux" },
    { categorie: "matricules", libelle: "Conscrits militaires (recherche nominative)", url: "https://archives-numerisees.loire-atlantique.fr/v2/ad44/conscrit_nominal.html?accepte=true&portal=c_5110" },
  ],
  "92": [
    { categorie: "etat_civil", libelle: "Archives en ligne (état civil, recensements, cadastre)", url: "https://archives.hauts-de-seine.fr/n/archives-en-ligne/n:89" },
    { categorie: "matricules", libelle: "Recrutement militaire", url: "https://archives.hauts-de-seine.fr/n/recrutement-militaire/n:250" },
    { categorie: "autre", libelle: "Généalogie", url: "https://archives.hauts-de-seine.fr/n/genealogie/n:245" },
  ],
};

export type Ressource = { libelle: string; url: string; description: string; payant?: boolean };

/** Ressources nationales utiles au généalogiste. */
export const RESSOURCES_NATIONALES: Ressource[] = [
  { libelle: "FranceArchives", url: "https://francearchives.gouv.fr", description: "Portail national des archives : recherche dans tous les services, annuaire, noms de personnes." },
  { libelle: "Annuaire des archives départementales", url: "https://francearchives.gouv.fr/fr/annuaire/departements", description: "Tous les services d'archives, département par département." },
  { libelle: "Mémoire des hommes", url: "https://www.memoiredeshommes.defense.gouv.fr/", description: "Morts pour la France, sépultures de guerre, journaux des unités." },
  { libelle: "Léonore", url: "https://www.leonore.archives-nationales.culture.gouv.fr", description: "Dossiers des membres de la Légion d'honneur." },
  { libelle: "Fichier des décès (INSEE)", url: "https://deces.matchid.io", description: "Décès en France depuis 1970." },
  { libelle: "Archives nationales d'outre-mer", url: "https://recherche-anom.culture.gouv.fr", description: "État civil des colonies, registres matricules d'Algérie, bagnes…" },
  { libelle: "Archives nationales", url: "https://www.siv.archives-nationales.culture.gouv.fr", description: "Minutier central des notaires de Paris, fonds nationaux." },
  { libelle: "Gallica", url: "https://gallica.bnf.fr", description: "Presse ancienne, annuaires, livres (Bibliothèque nationale de France)." },
  { libelle: "Geneanet", url: "https://www.geneanet.org", description: "Arbres et relevés partagés, registres indexés.", payant: true },
  { libelle: "FamilySearch", url: "https://www.familysearch.org/fr/", description: "Registres numérisés du monde entier (gratuit, compte requis)." },
  { libelle: "Filae", url: "https://www.filae.com", description: "État civil indexé, recensements.", payant: true },
];

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Département d'un lieu : « 49 », « 049 », « Maine-et-Loire » → la fiche du département. */
export function trouverDepartement(texte: string | null | undefined): Departement | null {
  const t = (texte ?? "").trim();
  if (!t) return null;
  const code = t.toUpperCase().replace(/^0(?=\d\d$)/, "");
  return DEPARTEMENTS.find((d) => d.code === code || normal(d.nom) === normal(t)) ?? null;
}

/** Lien affiché : fourni par Tabularium, corrigé, ou ajouté par l'utilisateur. */
export type LienAffiche = LienArchives & { origine: "fourni" | "corrige" | "ajoute"; id: string | null; defaut: string | null };
type LienPerso = { id: string; departement: string; categorie: string; libelle: string; url: string | null; defaut: string | null; masque: boolean };

/** Liens fournis d'un département (« national » : aucun ; les ressources nationales sont présentées à part). */
export function liensFournis(code: string): LienArchives[] {
  if (code === "national") return [];
  const d = DEPARTEMENTS.find((x) => x.code === code);
  return [...(d?.site ? [{ categorie: "site" as const, libelle: `Archives — ${d.nom}`, url: d.site }] : []), ...(LIENS_DETAILLES[code] ?? [])];
}

/** Liens fournis, corrigés ou masqués selon les choix de l'utilisateur, puis ses propres liens. */
export function liensAffiches(code: string, perso: LienPerso[]): LienAffiche[] {
  const siens = perso.filter((p) => p.departement === code);
  const parDefaut = new Map(siens.filter((p) => p.defaut).map((p) => [p.defaut!, p]));
  const fournis = liensFournis(code).flatMap((l): LienAffiche[] => {
    const p = parDefaut.get(l.url);
    if (!p) return [{ ...l, origine: "fourni", id: null, defaut: l.url }];
    if (p.masque || !p.url) return [];
    return [{ categorie: p.categorie as CategorieArchives, libelle: p.libelle, url: p.url, origine: "corrige", id: p.id, defaut: l.url }];
  });
  const ajoutes = siens
    .filter((p) => !p.defaut && !p.masque && p.url)
    .map((p): LienAffiche => ({ categorie: p.categorie as CategorieArchives, libelle: p.libelle, url: p.url!, origine: "ajoute", id: p.id, defaut: null }));
  const ordre = (c: string) => CATEGORIES_ARCHIVES.findIndex((x) => x.value === c);
  return [...fournis, ...ajoutes].sort((a, b) => ordre(a.categorie) - ordre(b.categorie));
}

/** Liens fournis masqués (pour pouvoir les rétablir). */
export const liensMasques = (code: string, perso: LienPerso[]) => perso.filter((p) => p.departement === code && p.masque);
