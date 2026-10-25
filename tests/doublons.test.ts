import { expect, test } from "bun:test";
import { clePaire, comparer, detecterDoublons, type FicheComparable } from "../src/lib/doublons";

const f = (id: string, nom: string, prenoms: string, autre: Partial<FicheComparable> = {}): FicheComparable => ({
  id, nom, prenoms, sexe: "M", naissanceMin: null, naissanceMax: null, naissanceLieuId: null, decesMin: null, decesMax: null,
  pereId: null, mereId: null, ...autre,
});
const ne = (an: number) => ({ naissanceMin: `${an}-01-01`, naissanceMax: `${an}-12-31` });

test("même personne probable : graphie ancienne, prénoms, naissance, lieu", () => {
  const a = f("a", "Gouadon", "Aimable René", { ...ne(1785), naissanceLieuId: "brissac" });
  const b = f("b", "Goüaddon", "Aimable", { ...ne(1785), naissanceLieuId: "brissac" });
  const r = comparer(a, b);
  expect(r.score).toBeGreaterThanOrEqual(70);
  expect(r.raisons).toEqual(["même premier prénom", "naissances compatibles", "même lieu de naissance"]);
});

test("écartés : autre nom, autre sexe, aucun prénom commun, naissances éloignées, parent et enfant", () => {
  const a = f("a", "Martin", "Jean", ne(1850));
  expect(comparer(a, f("b", "Durand", "Jean", ne(1850))).score).toBe(0);
  expect(comparer(a, f("b", "Martin", "Jean", { ...ne(1850), sexe: "F" })).score).toBe(0);
  expect(comparer(a, f("b", "Martin", "Pierre", ne(1850))).score).toBe(0);
  expect(comparer(a, f("b", "Martin", "Jean", ne(1860))).score).toBe(0);
  expect(comparer(a, f("b", "Martin", "Jean", { ...ne(1850), pereId: "a" })).score).toBe(0);
});

test("enfant mort jeune et frère du même prénom : naissances trop éloignées, pas proposés", () => {
  const p = { pereId: "pere", mereId: "mere" };
  expect(comparer(f("a", "Caduc", "Louis", { ...ne(1867), ...p }), f("b", "Caduc", "Louis", { ...ne(1874), ...p })).score).toBe(0);
});

test("sœurs « Marie Pauline » 30/04/1859 et « Marie Ursulle » 11/01/1858 : deux personnes", () => {
  const p = { pereId: "pere", mereId: "mere", sexe: "F" };
  const pauline = f("a", "Billerot", "Marie Pauline", { ...p, naissanceMin: "1859-04-30", naissanceMax: "1859-04-30" });
  const ursulle = f("b", "Billerot", "Marie Ursulle", { ...p, naissanceMin: "1858-01-11", naissanceMax: "1858-01-11" });
  expect(comparer(pauline, ursulle).score).toBe(0);
  // Sans date exacte, « Marie » seule face à « Marie Pauline » reste une piste.
  expect(comparer(f("c", "Billerot", "Marie", { ...p, ...ne(1859) }), pauline).score).toBeGreaterThan(0);
});

test("détection : triée par probabilité, sans les paires déjà vues", () => {
  const fiches = [
    f("a", "Martin", "Jean", ne(1850)),
    f("b", "Martin", "Jean", ne(1850)),
    f("c", "Martin", "Jean Baptiste", ne(1851)),
    f("d", "Durand", "Paul"),
  ];
  const tous = detecterDoublons(fiches);
  expect(tous.map((d) => clePaire(d.a.id, d.b.id))).toEqual(["a|b", "a|c", "b|c"]);
  expect(tous[0].score).toBeGreaterThan(tous[1].score);
  const restants = detecterDoublons(fiches, new Set(["a|b", clePaire("c", "b")]));
  expect(restants.map((d) => clePaire(d.a.id, d.b.id))).toEqual(["a|c"]);
});
