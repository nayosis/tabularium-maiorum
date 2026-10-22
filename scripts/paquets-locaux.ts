/*
 * Paquets de la version ordinateur : un zip par système, avec l'exécutable autonome (serveur + Bun),
 * l'interface compilée et les migrations.
 *
 *   bun run paquets-locaux                       toutes les cibles
 *   bun run paquets-locaux windows-x64 linux-x64 certaines cibles
 *
 * Les binaires macOS doivent être fabriqués sur un Mac (signature ad hoc, sans quoi macOS refuse de les lancer) ;
 * l'icône de l'exécutable Windows ne peut être posée que depuis Windows. La publication (GitHub Actions)
 * fabrique donc chaque cible sur son système.
 */
import { $ } from "bun";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync, type Zippable } from "fflate";

const RACINE = join(import.meta.dir, "..");
const SORTIE = join(RACINE, "paquets");
const { version } = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8"));

const CIBLES = ["windows-x64", "linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64"] as const;
type Cible = (typeof CIBLES)[number];

const demandees = process.argv.slice(2) as Cible[];
for (const c of demandees) if (!CIBLES.includes(c)) throw new Error(`Cible inconnue : ${c} (possibles : ${CIBLES.join(", ")})`);
const cibles = demandees.length ? demandees : [...CIBLES];

console.log(`Tabularium ${version} : interface…`);
await $`bun run build`.cwd(RACINE).quiet();

rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });

for (const cible of cibles) {
  const windows = cible.startsWith("windows");
  const executable = windows ? "Tabularium.exe" : "tabularium";
  const dossier = join(SORTIE, `Tabularium-${cible}`, "Tabularium");
  mkdirSync(dossier, { recursive: true });

  console.log(`${cible} : compilation…`);
  const options = [`--target=bun-${cible}`, "--minify"];
  if (windows && process.platform === "win32")
    options.push(
      `--windows-icon=${join(import.meta.dir, "tabularium.ico")}`,
      "--windows-title=Tabularium",
      "--windows-description=Tabularium Maiorum — les archives des ancêtres",
      `--windows-version=${version}.0`,
    );
  await $`bun build ${join(RACINE, "serveur", "local.ts")} --compile ${options} --outfile ${join(dossier, executable)}`.cwd(RACINE).quiet();

  cpSync(join(RACINE, "dist"), join(dossier, "app", "dist"), { recursive: true });
  cpSync(join(RACINE, "drizzle"), join(dossier, "app", "drizzle"), { recursive: true });
  cpSync(join(RACINE, "LICENSE"), join(dossier, "LICENSE.txt"));
  const lisezmoi = readFileSync(join(import.meta.dir, "LISEZMOI.txt"), "utf8").replace("{VERSION}", version);
  // Bloc-notes de Windows : fins de ligne CRLF.
  writeFileSync(join(dossier, "LISEZMOI.txt"), windows ? lisezmoi.replace(/\r?\n/g, "\r\n") : lisezmoi);

  // Zip : l'exécutable garde ses droits d'exécution sous Linux / macOS.
  const fichiers: Zippable = {};
  const parcourir = (d: string) => {
    for (const nom of readdirSync(d)) {
      const chemin = join(d, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else {
        const nomZip = relative(join(dossier, ".."), chemin).replaceAll("\\", "/");
        const binaire = nom === executable;
        fichiers[nomZip] = [readFileSync(chemin), binaire && !windows ? { os: 3, attrs: 0o100755 << 16 } : {}];
      }
    }
  };
  parcourir(dossier);
  const zip = join(SORTIE, `Tabularium-${version}-${cible}.zip`);
  writeFileSync(zip, zipSync(fichiers, { level: 9 }));
  rmSync(join(SORTIE, `Tabularium-${cible}`), { recursive: true, force: true });
  console.log(`  → ${relative(RACINE, zip)} (${(statSync(zip).size / 1e6).toFixed(1)} Mo)`);
}


