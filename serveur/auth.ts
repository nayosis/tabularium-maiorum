/*
 * Authentification : cookie de session, droits par rôle, routes de connexion, liens et gestion des comptes.
 */
import { Elysia, t } from "elysia";
import {
  annulerLiens, changerMotDePasse, installerPremierAdmin, nbUtilisateurs, creerLien, creerSession, creerUtilisateur, DUREE_SESSION_LONGUE_MS, lireLien, lireSession,
  liensEnAttente, listeUtilisateurs, modifierUtilisateur, ROLES, supprimerSession, supprimerSessions, supprimerUtilisateur,
  utiliserLien, utilisateurParId, verifierIdentifiants, verifierLongueur, type Role, type Utilisateur,
} from "./comptes";
import { TUILES, VERSION } from "./config";
import { ErreurMetier } from "./erreurs";

export const COOKIE_SESSION = "tabularium_session";

/** Lecture < écriture < admin. Le super admin a tous les droits. */
const NIVEAU: Record<Role, number> = { lecture: 0, ecriture: 1, admin: 2 };

export function exiger(u: Utilisateur | null, role: Role): Utilisateur {
  if (!u) throw new ErreurMetier("Connexion requise", 401);
  if (!u.super && NIVEAU[u.role] < NIVEAU[role]) throw new ErreurMetier("Droits insuffisants", 403);
  return u;
}

/** Ce compte peut-il gérer celui-ci ? Super admin : tous sauf lui-même ; admin : lecture et écriture. */
function peutGerer(acteur: Utilisateur, cible: Utilisateur) {
  if (cible.super || cible.id === acteur.id) return false;
  return acteur.super || cible.role !== "admin";
}
const rolesAttribuables = (acteur: Utilisateur): Role[] => (acteur.super ? ROLES : ["lecture", "ecriture"]);

const estHttps = (request: Request) =>
  request.url.startsWith("https:") || request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";

const ipDe = (request: Request, ip?: string) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || ip || "?";

// Limitation des tentatives de connexion : 5 échecs par adresse et par IP en 15 minutes.
const ECHECS_MAX = 5;
const FENETRE_MS = 15 * 60 * 1000;
const echecs = new Map<string, { n: number; debut: number }>();
function tentativesEpuisees(cle: string) {
  const e = echecs.get(cle);
  if (!e) return false;
  if (Date.now() - e.debut > FENETRE_MS) {
    echecs.delete(cle);
    return false;
  }
  return e.n >= ECHECS_MAX;
}
function noterEchec(cle: string) {
  const e = echecs.get(cle);
  if (!e || Date.now() - e.debut > FENETRE_MS) echecs.set(cle, { n: 1, debut: Date.now() });
  else e.n++;
}
export const reinitialiserLimitation = () => echecs.clear();

/** Utilisateur connecté (ou null) pour toutes les routes ; refuse les écritures sans l'en-tête X-Tabularium. */
export const session = new Elysia({ name: "session" })
  .derive({ as: "global" }, ({ cookie }) => ({
    utilisateur: lireSession(cookie[COOKIE_SESSION]?.value as string | undefined),
  }))
  .onBeforeHandle({ as: "global" }, ({ request, set }) => {
    const url = new URL(request.url);
    // Protection CSRF : un autre site ne peut pas ajouter cet en-tête à une requête vers nous.
    if (request.method !== "GET" && url.pathname.startsWith("/api/") && request.headers.get("x-tabularium") !== "1") {
      set.status = 403;
      return { erreur: "Requête refusée" };
    }
  });

const publicUtilisateur = (u: Utilisateur) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  super: u.super,
  individuId: u.individuId,
});

/** Ouvre une session et pose le cookie (connexion, ou installation). */
function poserSession(cookie: Record<string, { set: (o: object) => void }>, request: Request, utilisateurId: string, souvenir: boolean) {
  const s = creerSession(utilisateurId, souvenir);
  cookie[COOKIE_SESSION].set({
    value: s.jeton,
    httpOnly: true,
    sameSite: "strict",
    secure: estHttps(request),
    path: "/",
    // Sans « se souvenir de moi » : cookie de session (effacé à la fermeture du navigateur).
    ...(souvenir ? { maxAge: DUREE_SESSION_LONGUE_MS / 1000 } : {}),
  });
}

export const routesAuth = new Elysia()
  .use(session)

  // --- Premier lancement : création du compte administrateur
  // Public : de quoi afficher la page de connexion (ou d'installation) et les cartes.
  .get("/api/auth/etat", () => ({ installe: nbUtilisateurs() > 0, version: VERSION, tuiles: TUILES }))
  .post(
    "/api/auth/installation",
    async ({ body, cookie, request, server }) => {
      const cle = `installation|${ipDe(request, server?.requestIP(request)?.address)}`;
      if (tentativesEpuisees(cle)) throw new ErreurMetier("Trop de tentatives : réessayez dans quelques minutes.", 429);
      if (nbUtilisateurs() > 0) {
        noterEchec(cle);
        throw new ErreurMetier("Tabularium est déjà installé.", 403);
      }
      let u: Utilisateur;
      try {
        u = await installerPremierAdmin(body.email, body.motDePasse);
      } catch (e) {
        throw new ErreurMetier((e as Error).message, 400);
      }
      poserSession(cookie, request, u.id, true);
      return { utilisateur: publicUtilisateur(u) };
    },
    { body: t.Object({ email: t.String({ maxLength: 200 }), motDePasse: t.String({ maxLength: 500 }) }) },
  )

  // --- Connexion, compte personnel
  .post(
    "/api/auth/connexion",
    async ({ body, cookie, request, server }) => {
      const cle = `${ipDe(request, server?.requestIP(request)?.address)}|${body.email.trim().toLowerCase()}`;
      if (tentativesEpuisees(cle)) throw new ErreurMetier("Trop de tentatives : réessayez dans quelques minutes.", 429);
      const u = await verifierIdentifiants(body.email, body.motDePasse);
      if (!u) {
        noterEchec(cle);
        throw new ErreurMetier("Adresse ou mot de passe incorrect.", 401);
      }
      echecs.delete(cle);
      poserSession(cookie, request, u.id, body.souvenir);
      return { utilisateur: publicUtilisateur(u) };
    },
    { body: t.Object({ email: t.String({ maxLength: 200 }), motDePasse: t.String({ maxLength: 500 }), souvenir: t.Boolean() }) },
  )
  .post("/api/auth/deconnexion", ({ cookie }) => {
    const jeton = cookie[COOKIE_SESSION]?.value as string | undefined;
    if (jeton) supprimerSession(jeton);
    cookie[COOKIE_SESSION].remove();
    return { ok: true };
  })
  .get("/api/auth/moi", ({ utilisateur }) => ({ utilisateur: publicUtilisateur(exiger(utilisateur, "lecture")) }))
  .post(
    "/api/auth/mot-de-passe",
    async ({ utilisateur, body }) => {
      const u = exiger(utilisateur, "lecture");
      if (!(await verifierIdentifiants(u.email, body.actuel))) throw new ErreurMetier("Mot de passe actuel incorrect.", 400);
      try {
        await changerMotDePasse(u.id, body.nouveau);
      } catch (e) {
        throw new ErreurMetier((e as Error).message);
      }
      return { ok: true };
    },
    { body: t.Object({ actuel: t.String(), nouveau: t.String({ maxLength: 500 }) }) },
  )

  // --- Liens (pages publiques : choisir son mot de passe)
  .get("/api/liens/:jeton", ({ params }) => {
    const l = lireLien(params.jeton);
    if (!l) throw new ErreurMetier("Ce lien n'est plus valable (déjà utilisé ou expiré). Demandez-en un nouveau.", 410);
    return { type: l.type, email: l.utilisateur.email };
  })
  .post(
    "/api/liens/:jeton",
    async ({ params, body }) => {
      try {
        verifierLongueur(body.motDePasse);
        const u = await utiliserLien(params.jeton, body.motDePasse);
        return { email: u.email };
      } catch (e) {
        throw new ErreurMetier((e as Error).message, 400);
      }
    },
    { body: t.Object({ motDePasse: t.String({ maxLength: 500 }) }) },
  )

  // --- Gestion des comptes (admins)
  .get("/api/comptes", ({ utilisateur }) => {
    const moi = exiger(utilisateur, "admin");
    const liens = liensEnAttente();
    return {
      comptes: listeUtilisateurs().map((u) => ({
        ...publicUtilisateur(u),
        actif: u.actif,
        aMotDePasse: u.aMotDePasse,
        creeLe: u.creeLe,
        derniereConnexion: u.derniereConnexion,
        lienEnAttente: liens.get(u.id) ?? null,
        gerable: peutGerer(moi, u),
      })),
      rolesAttribuables: rolesAttribuables(moi),
    };
  })
  .post(
    "/api/comptes",
    ({ utilisateur, body }) => {
      const moi = exiger(utilisateur, "admin");
      if (!rolesAttribuables(moi).includes(body.role as Role)) throw new ErreurMetier("Vous ne pouvez pas attribuer ce rôle.", 403);
      let u: Utilisateur;
      try {
        u = creerUtilisateur(body.email, body.role as Role, body.individuId ?? null);
      } catch (e) {
        throw new ErreurMetier((e as Error).message);
      }
      const lien = creerLien(u.id, "creation");
      return { utilisateur: publicUtilisateur(u), lien: `/lien/${lien.jeton}`, expire: lien.expire };
    },
    { body: t.Object({ email: t.String({ maxLength: 200 }), role: t.String(), individuId: t.Optional(t.Nullable(t.String())) }) },
  )
  .patch(
    "/api/comptes/:id",
    ({ utilisateur, params, body }) => {
      const moi = exiger(utilisateur, "admin");
      const cible = utilisateurParId(params.id);
      if (!cible) throw new ErreurMetier("Compte introuvable", 404);
      // Seule la fiche liée peut être changée sur son propre compte.
      const surSoi = cible.id === moi.id && body.role === undefined && body.actif === undefined;
      if (!surSoi && !peutGerer(moi, cible)) throw new ErreurMetier("Vous ne pouvez pas modifier ce compte.", 403);
      if (body.role !== undefined && !rolesAttribuables(moi).includes(body.role as Role)) {
        throw new ErreurMetier("Vous ne pouvez pas attribuer ce rôle.", 403);
      }
      return { utilisateur: modifierUtilisateur(cible.id, { role: body.role as Role | undefined, actif: body.actif, individuId: body.individuId }) };
    },
    { body: t.Object({ role: t.Optional(t.String()), actif: t.Optional(t.Boolean()), individuId: t.Optional(t.Nullable(t.String())) }) },
  )
  .post("/api/comptes/:id/lien", ({ utilisateur, params }) => {
    const moi = exiger(utilisateur, "admin");
    const cible = utilisateurParId(params.id);
    if (!cible) throw new ErreurMetier("Compte introuvable", 404);
    if (!peutGerer(moi, cible)) throw new ErreurMetier("Vous ne pouvez pas modifier ce compte.", 403);
    const lien = creerLien(cible.id, cible.aMotDePasse ? "reinitialisation" : "creation");
    return { lien: `/lien/${lien.jeton}`, expire: lien.expire };
  })
  .delete("/api/comptes/:id/lien", ({ utilisateur, params }) => {
    const moi = exiger(utilisateur, "admin");
    const cible = utilisateurParId(params.id);
    if (!cible || !peutGerer(moi, cible)) throw new ErreurMetier("Vous ne pouvez pas modifier ce compte.", 403);
    annulerLiens(cible.id);
    return { ok: true };
  })
  .post("/api/comptes/:id/deconnecter", ({ utilisateur, params }) => {
    const moi = exiger(utilisateur, "admin");
    const cible = utilisateurParId(params.id);
    if (!cible || !peutGerer(moi, cible)) throw new ErreurMetier("Vous ne pouvez pas modifier ce compte.", 403);
    supprimerSessions(cible.id);
    return { ok: true };
  })
  .delete("/api/comptes/:id", ({ utilisateur, params }) => {
    const moi = exiger(utilisateur, "admin");
    const cible = utilisateurParId(params.id);
    if (!cible) throw new ErreurMetier("Compte introuvable", 404);
    if (!peutGerer(moi, cible)) throw new ErreurMetier("Vous ne pouvez pas supprimer ce compte.", 403);
    supprimerUtilisateur(cible.id);
    return { ok: true };
  });
