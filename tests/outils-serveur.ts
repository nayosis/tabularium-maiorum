/** Serveur de test : bases en mémoire, super admin, et petits outils pour appeler l'API avec un cookie. */
import { join } from "node:path";
import { ouvrirBase } from "../serveur/base";
import { installerSuperAdmin, ouvrirComptes } from "../serveur/comptes";

export const SUPER = { email: "super@tabularium.test", motDePasse: "super-mot-de-passe" };

export async function serveurDeTest({ superAdmin = true } = {}) {
  ouvrirBase(":memory:", join(import.meta.dir, "..", "drizzle"));
  ouvrirComptes(":memory:");
  if (superAdmin) await installerSuperAdmin(SUPER.email, SUPER.motDePasse);
  const { creerApp } = await import("../serveur/app");
  const app = creerApp();

  /** Requête vers l'API, avec le cookie de session donné. */
  const requete = (chemin: string, options: { methode?: string; corps?: unknown; cookie?: string; csrf?: boolean } = {}) =>
    app.handle(
      new Request(`http://local${chemin}`, {
        method: options.methode ?? (options.corps === undefined ? "GET" : "POST"),
        headers: {
          "content-type": "application/json",
          ...(options.csrf === false ? {} : { "x-tabularium": "1" }),
          ...(options.cookie ? { cookie: options.cookie } : {}),
        },
        body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      }),
    );

  /** Connexion ; renvoie le cookie à renvoyer ensuite. */
  const connexion = async (email: string, motDePasse: string, souvenir = false) => {
    const r = await requete("/api/auth/connexion", { corps: { email, motDePasse, souvenir } });
    const entete = r.headers.get("set-cookie") ?? "";
    return { r, cookie: entete.split(";")[0], entete };
  };

  /** Crée un compte (par le super admin) et lui donne un mot de passe via son lien. */
  const compte = async (email: string, role: string, motDePasse = "mot-de-passe-solide") => {
    const { cookie } = await connexion(SUPER.email, SUPER.motDePasse);
    const r = await requete("/api/comptes", { corps: { email, role }, cookie });
    const { lien, utilisateur } = await r.json();
    await requete(`/api${lien.replace("/lien/", "/liens/")}`, { corps: { motDePasse } });
    return { id: utilisateur.id as string, cookie: (await connexion(email, motDePasse)).cookie };
  };

  const rpc = (nom: string, args: unknown[], cookie?: string) => requete(`/api/rpc/${nom}`, { corps: { args }, cookie });

  return { app, requete, connexion, compte, rpc };
}
