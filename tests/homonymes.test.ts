import { expect, test } from "bun:test";
import { cleHomonyme, distinctions, groupesHomonymes, suffixe, type PersonneHomonyme } from "../src/lib/homonymes";

const p = (id: string, nom: string | null, prenoms: string | null, autre: Partial<PersonneHomonyme> = {}): PersonneHomonyme => ({
  id, nom, prenoms, naissanceMin: null, naissanceMax: null, ...autre,
});

test("homonymes : même nom et même premier prénom, sans accents ni casse", () => {
  expect(cleHomonyme(p("a", "Veillon", "François Pierre"))).toBe(cleHomonyme(p("b", "VEILLON", "Francois")));
  expect(cleHomonyme(p("a", "Veillon", "François"))).not.toBe(cleHomonyme(p("c", "Veillon", "Jean")));
  expect(cleHomonyme(p("d", null, "François"))).toBeNull();
  const groupes = groupesHomonymes([p("a", "Veillon", "François Pierre"), p("b", "VEILLON", "Francois"), p("c", "Veillon", "Jean")]);
  expect([...groupes.values()]).toEqual([["a", "b"]]);
});

test("mention : nom de la mère et année de naissance", () => {
  const personnes = [
    p("pere", "Veillon", "François", { naissanceMin: "1712-03-02", naissanceMax: "1712-03-02" }),
    p("fils", "Veillon", "François", { mereId: "marie", naissanceMin: "1742-05-10", naissanceMax: "1742-05-10" }),
    p("cousin", "Veillon", "François", { naissanceMin: "1740-01-01", naissanceMax: "1744-12-31" }),
    p("inconnu", "Veillon", "François"),
    p("marie", "Denault", "Marie"),
  ];
  const d = distinctions(personnes);
  expect(suffixe(d.get("fils"))).toBe(" (Denault, °1742)");
  expect(suffixe(d.get("pere"))).toBe(" (°1712)");
  expect(suffixe(d.get("cousin"))).toBe(" (°v. 1742)");
  expect(suffixe(d.get("inconnu"))).toBe("");
  // Marie Denault n'a pas d'homonyme : pas de mention.
  expect(d.has("marie")).toBe(false);
  // Menus de choix : les dates remplacent l'année.
  expect(suffixe(d.get("fils"), "1742–1801")).toBe(" (Denault, 1742–1801)");
});

test("qualificatif : remplace la mention automatique, même sans homonyme", () => {
  const d = distinctions([
    p("aine", "Veillon", "François", { qualificatif: "l'aîné", mereId: "marie", naissanceMin: "1742", naissanceMax: "1742" }),
    p("autre", "Veillon", "François"),
    p("seul", "Martin", "Jean", { qualificatif: "dit Gros-Jean" }),
    p("marie", "Denault", "Marie"),
  ]);
  expect(suffixe(d.get("aine"))).toBe(" (l'aîné)");
  expect(suffixe(d.get("seul"))).toBe(" (dit Gros-Jean)");
  expect(suffixe(d.get("aine"), "1742–1801")).toBe(" (l'aîné, 1742–1801)");
});
