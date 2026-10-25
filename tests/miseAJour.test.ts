import { beforeEach, expect, test } from "bun:test";
import { comparerVersions } from "../src/lib/versions";
import { derniereVersion, etatMiseAJour, viderCacheMiseAJour } from "../serveur/miseAJour";
import { VERSION } from "../serveur/config";

test("comparaison des versions", () => {
  expect(comparerVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
  expect(comparerVersions("v1.10.0", "1.9.3")).toBeGreaterThan(0);
  expect(comparerVersions("1.1.0", "v1.1.0")).toBe(0);
  expect(comparerVersions("1.2.0-beta", "1.2.0")).toBeLessThan(0);
  expect(comparerVersions("1.0", "1.0.1")).toBeLessThan(0);
});

beforeEach(() => viderCacheMiseAJour());

const reponse = (corps: unknown, statut = 200) => (async () => new Response(JSON.stringify(corps), { status: statut })) as unknown as typeof fetch;

test("nouvelle version publiée sur GitHub : disponible", async () => {
  const etat = await etatMiseAJour(reponse({ tag_name: "v99.0.0", html_url: "https://github.com/x/releases/tag/v99.0.0", published_at: "2027-01-01T00:00:00Z" }));
  expect(etat).toMatchObject({ actuelle: VERSION, verifiee: true, derniere: "99.0.0", disponible: true, url: "https://github.com/x/releases/tag/v99.0.0" });
});

test("déjà à jour ; GitHub injoignable : rien d'affiché ; résultat mis en cache", async () => {
  expect((await etatMiseAJour(reponse({ tag_name: `v${VERSION}` }))).disponible).toBe(false);
  viderCacheMiseAJour();
  expect(await etatMiseAJour(reponse({ message: "rate limited" }, 403))).toMatchObject({ verifiee: false, disponible: false });
  viderCacheMiseAJour();
  let appels = 0;
  const compte = (async () => {
    appels++;
    return new Response(JSON.stringify({ tag_name: "v1.0.0" }));
  }) as unknown as typeof fetch;
  await derniereVersion(compte);
  await derniereVersion(compte);
  expect(appels).toBe(1);
});
