import { describe, expect, test } from "bun:test";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
const marie = await s.compte("marie@famille.fr", "ecriture");
const paul = await s.compte("paul@famille.fr", "ecriture");
const { cookie: admin } = await s.connexion(SUPER.email, SUPER.motDePasse);

const appel = async (nom: string, args: unknown[], cookie: string) => {
  const r = await s.rpc(nom, args, cookie);
  return { statut: r.status, corps: await r.json() };
};

describe("traçabilité", () => {
  test("créé par / modifié par / modifié le, remplis par le serveur", async () => {
    const { corps } = await appel("creerIndividu", [{ nom: "MARTIN" }], marie.cookie);
    const id = corps.resultat;
    let ind = (await appel("chargerIndividu", [id], marie.cookie)).corps.resultat;
    expect(ind).toMatchObject({ creePar: "marie@famille.fr", modifiePar: "marie@famille.fr" });
    expect(ind.modifieLe).toMatch(/^\d{4}-\d\d-\d\dT/);

    await appel("majIndividu", [id, { prenoms: "Jean" }], paul.cookie);
    ind = (await appel("chargerIndividu", [id], paul.cookie)).corps.resultat;
    expect(ind).toMatchObject({ creePar: "marie@famille.fr", modifiePar: "paul@famille.fr", prenoms: "Jean" });
  });

  test("les colonnes de traçabilité envoyées par le navigateur sont ignorées", async () => {
    const id = (await appel("creerIndividu", [{ nom: "X" }], marie.cookie)).corps.resultat;
    await appel("majIndividu", [id, { nom: "Y", modifiePar: "pirate", creePar: "pirate" }], marie.cookie);
    const ind = (await appel("chargerIndividu", [id], marie.cookie)).corps.resultat;
    expect(ind).toMatchObject({ nom: "Y", creePar: "marie@famille.fr", modifiePar: "marie@famille.fr" });
  });
});

describe("conflits", () => {
  test("version périmée et modification par quelqu'un d'autre : 409 avec qui et quand", async () => {
    const id = (await appel("creerIndividu", [{ nom: "DUPONT" }], marie.cookie)).corps.resultat;
    const version = (await appel("chargerIndividu", [id], marie.cookie)).corps.resultat.modifieLe;
    await Bun.sleep(5);
    // Paul modifie pendant que Marie a la fiche ouverte
    const parPaul = await appel("majIndividu", [id, { prenoms: "Paul" }, version], paul.cookie);
    expect(parPaul.statut).toBe(200);
    // Marie enregistre avec sa version : refusé
    const r = await appel("majIndividu", [id, { prenoms: "Marie" }, version], marie.cookie);
    expect(r.statut).toBe(409);
    expect(r.corps.details).toMatchObject({ par: "paul@famille.fr" });
    expect((await appel("chargerIndividu", [id], marie.cookie)).corps.resultat.prenoms).toBe("Paul");
  });

  test("ses propres modifications (autre formulaire) ne font pas conflit ; la version renvoyée sert ensuite", async () => {
    const id = (await appel("creerActe", [[], { titre: "Acte" }], marie.cookie)).corps.resultat;
    const v0 = (await appel("chargerActe", [id], marie.cookie)).corps.resultat.modifieLe;
    await Bun.sleep(5);
    const r1 = await appel("majActe", [id, { statut: "en_cours" }, v0], marie.cookie);
    expect(r1.statut).toBe(200);
    await Bun.sleep(5);
    // Même version de départ, mais c'est Marie qui a modifié : accepté
    expect((await appel("majActe", [id, { titre: "Titre" }, v0], marie.cookie)).statut).toBe(200);
    // Avec la version renvoyée, Paul peut écrire sans conflit
    const v = (await appel("chargerActe", [id], paul.cookie)).corps.resultat.modifieLe;
    expect((await appel("majActe", [id, { titre: "Par Paul" }, v], paul.cookie)).statut).toBe(200);
    expect(r1.corps.resultat.modifieLe).toMatch(/^\d{4}-/);
  });
});

describe("journal", () => {
  test("chaque écriture y figure (qui, fonction, fiche) ; réservé aux admins", async () => {
    const id = (await appel("creerLieu", ["Brissac", "49"], paul.cookie)).corps.resultat;
    const r = await s.requete("/api/journal?utilisateur=paul@famille.fr", { cookie: admin });
    const { lignes } = await r.json();
    expect(lignes[0]).toMatchObject({ utilisateur: "paul@famille.fr", fonction: "creerLieu", cible: id });
    expect(lignes[0].resume).toContain("Brissac");
    // Les lectures ne sont pas journalisées
    expect(lignes.some((l: { fonction: string }) => l.fonction.startsWith("charger"))).toBe(false);
    expect((await s.requete("/api/journal", { cookie: paul.cookie })).status).toBe(403);
  });
});

describe("mise à jour en direct", () => {
  test("une écriture est diffusée aux navigateurs connectés, avec l'onglet d'origine", async () => {
    const controle = new AbortController();
    const r = await s.app.handle(new Request("http://local/api/evenements", { headers: { cookie: paul.cookie }, signal: controle.signal }));
    expect(r.headers.get("content-type")).toBe("text/event-stream");
    const lecteur = r.body!.getReader();
    await lecteur.read(); // « connecté »

    await s.app.handle(
      new Request("http://local/api/rpc/creerIndividu", {
        method: "POST",
        headers: { "content-type": "application/json", "x-tabularium": "1", "x-client": "onglet-42", cookie: marie.cookie },
        body: JSON.stringify({ args: [{ nom: "DIRECT" }] }),
      }),
    );
    const { value } = await lecteur.read();
    const texte = new TextDecoder().decode(value);
    expect(JSON.parse(texte.replace(/^data: /, ""))).toEqual({
      type: "modification",
      par: "marie@famille.fr",
      fonction: "creerIndividu",
      client: "onglet-42",
    });
    controle.abort();
  });
});
