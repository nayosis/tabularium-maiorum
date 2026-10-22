import { beforeEach, expect, test } from "bun:test";
import { reinitialiserLimitation } from "../serveur/auth";
import { serveurDeTest } from "./outils-serveur";

// Premier lancement, sans variables d'environnement : aucun compte.
const s = await serveurDeTest({ superAdmin: false });
beforeEach(() => reinitialiserLimitation());

const etat = async () => (await (await s.requete("/api/auth/etat")).json()).installe as boolean;

test("premier lancement : création du compte administrateur, une seule fois", async () => {
  expect(await etat()).toBe(false);

  const court = await s.requete("/api/auth/installation", { corps: { email: "moi@exemple.fr", motDePasse: "court" } });
  expect(court.status).toBe(400);
  expect(await etat()).toBe(false);

  const r = await s.requete("/api/auth/installation", { corps: { email: "Moi@Exemple.fr", motDePasse: "mot-de-passe-solide" } });
  expect(r.status).toBe(200);
  // Connecté directement, en super admin.
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  const moi = await (await s.requete("/api/auth/moi", { cookie })).json();
  expect(moi.utilisateur).toMatchObject({ email: "moi@exemple.fr", role: "admin", super: true });
  expect(await etat()).toBe(true);

  const encore = await s.requete("/api/auth/installation", { corps: { email: "autre@exemple.fr", motDePasse: "mot-de-passe-solide" } });
  expect(encore.status).toBe(403);
  expect((await s.connexion("autre@exemple.fr", "mot-de-passe-solide")).r.status).toBe(401);
});

test("installation : protégée contre les requêtes d'un autre site", async () => {
  const r = await s.requete("/api/auth/installation", { corps: { email: "x@exemple.fr", motDePasse: "mot-de-passe-solide" }, csrf: false });
  expect(r.status).toBe(403);
});
