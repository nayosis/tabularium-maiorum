/** Développement : serveur (API, port 3210) et Vite (interface, port 5173) ensemble. */
import { join } from "node:path";

const racine = join(import.meta.dir, "..");
// Le port de l'API est fixé ici : la variable PORT de l'environnement vise Vite.
const serveur = Bun.spawn(["bun", "--watch", "serveur/index.ts"], {
  cwd: racine,
  env: { ...process.env, PORT: "3210" },
  stdout: "inherit",
  stderr: "inherit",
});
const client = Bun.spawn(["bunx", "vite"], { cwd: racine, stdout: "inherit", stderr: "inherit" });
const arreter = () => {
  serveur.kill();
  client.kill();
  process.exit(0);
};
process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
await Promise.race([serveur.exited, client.exited]);
arreter();
