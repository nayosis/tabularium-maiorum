import { describe, expect, test } from "bun:test";
import { FONCTIONS } from "../serveur/rpc";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);

describe("RPC", () => {
  test("droits : lectures et écritures repérées, toutes les fonctions de src/data/ exposées", () => {
    expect(FONCTIONS.get("listeIndividus")?.droit).toBe("lecture");
    expect(FONCTIONS.get("chargerActe")?.droit).toBe("lecture");
    expect(FONCTIONS.get("creerIndividu")?.droit).toBe("ecriture");
    expect(FONCTIONS.get("supprimerActe")?.droit).toBe("ecriture");
    expect(FONCTIONS.get("doutesIndividu")?.droit).toBe("lecture");
    expect(FONCTIONS.get("listeDoutes")?.droit).toBe("lecture");
    expect(FONCTIONS.get("creerDoute")?.droit).toBe("ecriture");
    expect(FONCTIONS.get("majDoute")?.droit).toBe("ecriture");
    expect(FONCTIONS.size).toBeGreaterThan(60);
  });

  test("écriture puis lecture ; paramètres par défaut quand l'argument est omis", async () => {
    const r = await s.rpc("creerIndividu", [{ nom: "MARTIN", prenoms: "Jean" }], cookie);
    expect(r.status).toBe(200);
    const { resultat: id } = await r.json();
    expect(typeof id).toBe("string");
    const liste = await (await s.rpc("listeIndividus", [], cookie)).json();
    expect(liste.resultat.map((i: { id: string }) => i.id)).toContain(id);
    // creerRegistre(titre = "Nouveau registre")
    const reg = await (await s.rpc("creerRegistre", [], cookie)).json();
    const registres = await (await s.rpc("listeRegistres", [], cookie)).json();
    expect(registres.resultat.find((x: { id: string }) => x.id === reg.resultat).titre).toBe("Nouveau registre");
  });

  test("fonction inconnue : 404 ; arguments invalides : 422", async () => {
    expect((await s.rpc("dropTable", [], cookie)).status).toBe(404);
    expect((await s.requete("/api/rpc/listeIndividus", { corps: {}, cookie })).status).toBe(422);
  });
});
