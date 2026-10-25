/*
 * Version ordinateur : un exécutable autonome (bun build --compile), livré dans un dossier avec l'interface
 * compilée (app/dist) et les migrations (app/drizzle). Double-clic → le navigateur s'ouvre sur Tabularium.
 *
 * Réglages facultatifs dans tabularium.ini, à côté de l'exécutable :
 *   dossier=D:\Généalogie     (où ranger les données ; par défaut Documents/Tabularium)
 *   reseau=oui                (accessible depuis les autres appareils de la maison)
 *   port=3210
 *   verifier_mises_a_jour=non (ne pas vérifier sur GitHub qu'une nouvelle version existe)
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { dirname, join } from "node:path";

const PORT_PAR_DEFAUT = 3210;
const ESSAIS_PORT = 10;

/** Exécutable compilé : le code est embarqué ; sinon (développement), lancé depuis les sources. */
const compile = import.meta.path.includes("$bunfs") || import.meta.path.includes("~BUN");
const dossierProgramme = compile ? dirname(process.execPath) : join(import.meta.dir, "..");
const dossierApp = compile ? join(dossierProgramme, "app") : dossierProgramme;

/** tabularium.ini : lignes « clé=valeur », commentaires après # ou ;. */
export function lireReglages(texte: string) {
  const r: Record<string, string> = {};
  for (const ligne of texte.split(/\r?\n/)) {
    const propre = ligne.replace(/^\uFEFF/, "").trim();
    if (!propre || propre.startsWith("#") || propre.startsWith(";")) continue;
    const i = propre.indexOf("=");
    if (i > 0) r[propre.slice(0, i).trim().toLowerCase()] = propre.slice(i + 1).trim();
  }
  return r;
}

/** Dossier des données par défaut : Documents/Tabularium (Linux : ~/Tabularium). */
export function dossierDonneesParDefaut(systeme = process.platform, maison = homedir()) {
  const documents = join(maison, "Documents");
  return systeme !== "linux" && existsSync(documents) ? join(documents, "Tabularium") : join(maison, "Tabularium");
}

const oui = (v: string | undefined) => !!v && ["oui", "yes", "1", "true", "vrai"].includes(v.toLowerCase());

function adressesReseau() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
}

function ouvrirNavigateur(url: string) {
  if (process.env.TABULARIUM_SANS_NAVIGATEUR) return; // essais automatisés
  const commande =
    process.platform === "win32" ? ["cmd", "/c", "start", "", url] : process.platform === "darwin" ? ["open", url] : ["xdg-open", url];
  try {
    Bun.spawn(commande, { stdout: "ignore", stderr: "ignore" });
  } catch {
    // Pas de navigateur trouvé : l'adresse est affichée dans la fenêtre.
  }
}

/** Tabularium tourne-t-il déjà sur ce port ? */
async function dejaLancee(port: number) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/sante`, { signal: AbortSignal.timeout(800) });
    return r.ok && !!(await r.json()).version;
  } catch {
    return false;
  }
}

async function attendreEntree(message: string) {
  console.log(`\n${message}`);
  for await (const _ of console) break;
}

async function demarrer() {
  const fichierIni = join(dossierProgramme, "tabularium.ini");
  const reglages = existsSync(fichierIni) ? lireReglages(readFileSync(fichierIni, "utf8")) : {};
  const reseau = oui(reglages.reseau);
  const portVoulu = Number(reglages.port) || PORT_PAR_DEFAUT;

  // Déjà lancée (second double-clic) : on ouvre seulement le navigateur.
  if (await dejaLancee(portVoulu)) {
    console.log("Tabularium est déjà lancé : ouverture du navigateur.");
    ouvrirNavigateur(`http://localhost:${portVoulu}`);
    return;
  }

  // La configuration du serveur se lit dans l'environnement : à fixer avant de charger le serveur.
  process.env.DOSSIER_DONNEES = reglages.dossier || process.env.DOSSIER_DONNEES || dossierDonneesParDefaut();
  process.env.DOSSIER_CLIENT = join(dossierApp, "dist");
  process.env.DOSSIER_MIGRATIONS = join(dossierApp, "drizzle");
  process.env.TABULARIUM_INSTALLATION = compile ? "ordinateur" : "source";
  if (reglages.verifier_mises_a_jour) process.env.TABULARIUM_VERIFIER_MISES_A_JOUR = reglages.verifier_mises_a_jour;

  const { BASE_COMPTES, BASE_DONNEES, DOSSIER_DONNEES, DOSSIER_MIGRATIONS, VERSION, preparerDossiers } = await import("./config");
  const { ouvrirBase } = await import("./base");
  const { ouvrirComptes } = await import("./comptes");
  const { creerApp } = await import("./app");

  console.log(`Tabularium ${VERSION}`);
  preparerDossiers();
  const { appliquees } = ouvrirBase(BASE_DONNEES, DOSSIER_MIGRATIONS);
  if (appliquees.length) console.log(`Base de données mise à jour (${appliquees.length} étape${appliquees.length > 1 ? "s" : ""}).`);
  ouvrirComptes(BASE_COMPTES);

  // Port voulu, ou le suivant s'il est pris par un autre programme.
  let port = 0;
  for (let p = portVoulu; p < portVoulu + ESSAIS_PORT && !port; p++) {
    try {
      creerApp().listen({ port: p, hostname: reseau ? "0.0.0.0" : "127.0.0.1" });
      port = p;
    } catch {
      // Port occupé : on essaie le suivant.
    }
  }
  if (!port) throw new Error(`Aucun port libre entre ${portVoulu} et ${portVoulu + ESSAIS_PORT - 1}.`);

  const url = `http://localhost:${port}`;
  console.log("");
  console.log("  Tabularium est lancé.");
  console.log(`  Adresse : ${url}`);
  if (reseau) for (const a of adressesReseau()) console.log(`  Depuis une tablette ou un autre ordinateur de la maison : http://${a}:${port}`);
  console.log(`  Données : ${DOSSIER_DONNEES}`);
  console.log("");
  console.log("  Laissez cette fenêtre ouverte pendant que vous utilisez Tabularium ; la fermer arrête Tabularium.");
  ouvrirNavigateur(url);
}

if (import.meta.main) {
  try {
    await demarrer();
  } catch (e) {
    console.error(`\nTabularium n'a pas pu démarrer : ${e instanceof Error ? e.message : e}`);
    // Sous Windows, la fenêtre se fermerait aussitôt : on laisse le temps de lire.
    await attendreEntree("Appuyez sur Entrée pour fermer.");
    process.exit(1);
  }
}
