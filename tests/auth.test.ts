import { beforeEach, describe, expect, test } from "bun:test";
import { reinitialiserLimitation } from "../serveur/auth";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
beforeEach(() => reinitialiserLimitation());

describe("connexion", () => {
  test("super admin défini par l'environnement ; mauvais mot de passe refusé", async () => {
    const ok = await s.connexion(SUPER.email, SUPER.motDePasse);
    expect(ok.r.status).toBe(200);
    expect(ok.entete).toContain("HttpOnly");
    expect(ok.entete).toContain("SameSite=Strict");
    const moi = await (await s.requete("/api/auth/moi", { cookie: ok.cookie })).json();
    expect(moi.utilisateur).toMatchObject({ email: SUPER.email, role: "admin", super: true });

    expect((await s.connexion(SUPER.email, "pas le bon")).r.status).toBe(401);
    expect((await s.requete("/api/auth/moi")).status).toBe(401);
  });

  test("« se souvenir de moi » : cookie de 30 jours ; sinon cookie de session", async () => {
    const court = await s.connexion(SUPER.email, SUPER.motDePasse, false);
    expect(court.entete).not.toContain("Max-Age");
    const long = await s.connexion(SUPER.email, SUPER.motDePasse, true);
    expect(long.entete).toContain(`Max-Age=${30 * 24 * 3600}`);
  });

  test("déconnexion : la session ne vaut plus rien", async () => {
    const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
    await s.requete("/api/auth/deconnexion", { corps: {}, cookie });
    expect((await s.requete("/api/auth/moi", { cookie })).status).toBe(401);
  });

  test("trop de tentatives : bloqué même avec le bon mot de passe", async () => {
    for (let i = 0; i < 5; i++) await s.connexion(SUPER.email, "faux");
    expect((await s.connexion(SUPER.email, SUPER.motDePasse)).r.status).toBe(429);
  });

  test("protection CSRF : écriture sans l'en-tête X-Tabularium refusée", async () => {
    const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
    const r = await s.requete("/api/rpc/creerIndividu", { corps: { args: [{}] }, cookie, csrf: false });
    expect(r.status).toBe(403);
  });
});

describe("liens et comptes", () => {
  test("création : lien à usage unique, mot de passe trop court refusé", async () => {
    const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
    const r = await s.requete("/api/comptes", { corps: { email: "Marie@Famille.fr", role: "ecriture" }, cookie });
    const { lien } = await r.json();
    const api = `/api${lien.replace("/lien/", "/liens/")}`;
    expect(await (await s.requete(api)).json()).toEqual({ type: "creation", email: "marie@famille.fr" });
    expect((await s.requete(api, { corps: { motDePasse: "court" } })).status).toBe(400);
    expect((await s.requete(api, { corps: { motDePasse: "un-bon-mot-de-passe" } })).status).toBe(200);
    // Déjà utilisé
    expect((await s.requete(api)).status).toBe(410);
    expect((await s.requete(api, { corps: { motDePasse: "un-autre-mot-de-passe" } })).status).toBe(400);
    expect((await s.connexion("marie@famille.fr", "un-bon-mot-de-passe")).r.status).toBe(200);
  });

  test("réinitialisation : le nouveau lien remplace l'ancien et ferme les sessions", async () => {
    const marie = await s.compte("reinit@famille.fr", "lecture");
    const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
    const premier = (await (await s.requete(`/api/comptes/${marie.id}/lien`, { corps: {}, cookie })).json()).lien;
    const second = (await (await s.requete(`/api/comptes/${marie.id}/lien`, { corps: {}, cookie })).json()).lien;
    expect((await s.requete(`/api${premier.replace("/lien/", "/liens/")}`)).status).toBe(410);
    expect(await (await s.requete(`/api${second.replace("/lien/", "/liens/")}`)).json()).toMatchObject({ type: "reinitialisation" });
    await s.requete(`/api${second.replace("/lien/", "/liens/")}`, { corps: { motDePasse: "nouveau-mot-de-passe" } });
    expect((await s.requete("/api/auth/moi", { cookie: marie.cookie })).status).toBe(401);
  });

  test("rôles : lecture ne peut pas écrire ; écriture ne gère pas les comptes", async () => {
    const lecteur = await s.compte("lecteur@famille.fr", "lecture");
    const ecrivain = await s.compte("ecrivain@famille.fr", "ecriture");
    expect((await s.rpc("listeIndividus", [], lecteur.cookie)).status).toBe(200);
    expect((await s.rpc("creerIndividu", [{ nom: "X" }], lecteur.cookie)).status).toBe(403);
    expect((await s.rpc("creerIndividu", [{ nom: "X" }], ecrivain.cookie)).status).toBe(200);
    expect((await s.requete("/api/comptes", { cookie: ecrivain.cookie })).status).toBe(403);
    expect((await s.rpc("listeIndividus", [])).status).toBe(401);
    // Image : lecture seule → envoi refusé
    const f = new FormData();
    f.append("fichier", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    const r = await s.app.handle(
      new Request("http://local/api/images", { method: "POST", body: f, headers: { "x-tabularium": "1", cookie: lecteur.cookie } }),
    );
    expect(r.status).toBe(403);
  });

  test("admin : gère lecture et écriture, pas les admins ni le super admin ; ne crée pas d'admin", async () => {
    const admin = await s.compte("admin@famille.fr", "admin");
    const autreAdmin = await s.compte("admin2@famille.fr", "admin");
    const lecteur = await s.compte("lecteur2@famille.fr", "lecture");
    const liste = (await (await s.requete("/api/comptes", { cookie: admin.cookie })).json()) as {
      comptes: { email: string; gerable: boolean }[];
      rolesAttribuables: string[];
    };
    expect(liste.rolesAttribuables).toEqual(["lecture", "ecriture"]);
    const gerable = Object.fromEntries(liste.comptes.map((c) => [c.email, c.gerable]));
    expect(gerable[SUPER.email]).toBe(false);
    expect(gerable["admin2@famille.fr"]).toBe(false);
    expect(gerable["lecteur2@famille.fr"]).toBe(true);

    expect((await s.requete("/api/comptes", { corps: { email: "x@f.fr", role: "admin" }, cookie: admin.cookie })).status).toBe(403);
    expect((await s.requete(`/api/comptes/${autreAdmin.id}`, { methode: "DELETE", cookie: admin.cookie })).status).toBe(403);
    const r = await s.requete(`/api/comptes/${lecteur.id}`, { methode: "PATCH", corps: { role: "ecriture" }, cookie: admin.cookie });
    expect(r.status).toBe(200);
    // Désactiver ferme les sessions
    await s.requete(`/api/comptes/${lecteur.id}`, { methode: "PATCH", corps: { actif: false }, cookie: admin.cookie });
    expect((await s.requete("/api/auth/moi", { cookie: lecteur.cookie })).status).toBe(401);
  });

  test("super admin : intouchable, même par lui-même", async () => {
    const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
    const { comptes } = await (await s.requete("/api/comptes", { cookie })).json();
    const sup = comptes.find((c: { super: boolean }) => c.super);
    expect((await s.requete(`/api/comptes/${sup.id}`, { methode: "DELETE", cookie })).status).toBe(403);
    expect((await s.requete(`/api/comptes/${sup.id}`, { methode: "PATCH", corps: { role: "lecture" }, cookie })).status).toBe(403);
  });
});
