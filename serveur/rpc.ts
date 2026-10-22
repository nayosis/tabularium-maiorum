/*
 * Fonctions métier appelables par le navigateur : POST /api/rpc/:nom { args }.
 * Ce sont les fonctions exportées de src/data/ (le navigateur en reçoit des talons, cf. vite.config.ts).
 * Lecture : tout compte connecté. Écriture : rôles écriture, admin, super admin. Inconnue : refusée.
 */
import * as actes from "../src/data/actes";
import * as individus from "../src/data/individus";
import * as lieux from "../src/data/lieux";
import * as photos from "../src/data/photos";
import * as recherches from "../src/data/recherches";
import * as registres from "../src/data/registres";
import * as releves from "../src/data/releves";
import * as statistiques from "../src/data/statistiques";

/** Modules exposés (même liste que le plugin Vite qui génère les talons). */
export const MODULES_RPC = { actes, individus, lieux, photos, recherches, registres, releves, statistiques };

export type Droit = "lecture" | "ecriture";

/** Fonctions qui ne modifient rien. Toute autre fonction exposée exige le droit d'écriture. */
const LECTURE = new Set([
  "listeActes", "chargerActe", "voisinsDansLaLiasse", "annotationsPages", "listeSources",
  "listeIndividus", "chargerIndividu", "donneesArbre",
  "listeLieux",
  "listePhotos", "photosIndividu",
  "recherchesIndividu", "toutesRecherches", "sourcesEtConsultations", "chargerSource",
  "relevesActe", "relevesIndividu", "evenementsIndividus", "relevesDesActes", "relevesNonRattaches",
  "listeRegistres",
  "tableauDeBord",
]);

type Fonction = (...args: unknown[]) => unknown;

export const FONCTIONS = new Map<string, { fn: Fonction; droit: Droit }>();
for (const [module, contenu] of Object.entries(MODULES_RPC)) {
  for (const [nom, valeur] of Object.entries(contenu)) {
    if (typeof valeur !== "function") continue;
    if (FONCTIONS.has(nom)) throw new Error(`Fonction RPC en double : ${nom} (${module})`);
    FONCTIONS.set(nom, { fn: valeur as Fonction, droit: LECTURE.has(nom) ? "lecture" : "ecriture" });
  }
}
for (const nom of LECTURE) if (!FONCTIONS.has(nom)) throw new Error(`Fonction de lecture inconnue : ${nom}`);

/** Exécute une fonction RPC (droits déjà vérifiés par l'appelant). */
export async function executerRpc(nom: string, args: unknown[]) {
  const f = FONCTIONS.get(nom);
  if (!f) throw new Error(`Fonction inconnue : ${nom}`);
  // Certaines fonctions renvoient une requête Drizzle (« thenable ») : await l'exécute.
  const resultat = await f.fn(...args);
  return resultat === undefined ? null : resultat;
}
