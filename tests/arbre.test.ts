import { describe, expect, test } from "bun:test";
import { BOITE, anneeFloue, disposerArbre, ligneDeces, ligneNaissance, type Personne } from "../src/pages/arbre/disposition";
import type { DonneesArbre } from "../src/data/individus";

const p = (id: string, sexe: string | null = null, naissanceMin: string | null = null): Personne => ({
  id, nom: id, prenoms: null, sexe, naissance: null, naissanceMin, naissanceMax: naissanceMin, deces: null, decesMin: null, decesMax: null,
  pereInconnu: false, mereInconnue: false, sansUnion: false, naissanceLieu: null, naissanceLieuId: null, decesLieu: null,
  acteNaissanceId: null, acteDecesId: null, acteMariage: 0, portrait: null,
});

// Henri ← Ernest (père) + Louise (mère) ; Louise ← Louis Henri (père) ; Henri → 2 enfants.
const donnees: DonneesArbre = {
  personnes: [
    p("henri", "M"), p("ernest", "M"), p("louise", "F"), p("louisHenri", "M"),
    p("enfant2", "F", "1925-01-01"), p("enfant1", "M", "1920-01-01"), p("epouse", "F"),
  ],
  filiations: [
    { enfantId: "henri", parentId: "ernest", type: "biologique" },
    { enfantId: "henri", parentId: "louise", type: "biologique" },
    { enfantId: "louise", parentId: "louisHenri", type: "biologique" },
    { enfantId: "enfant1", parentId: "henri", type: "biologique" },
    { enfantId: "enfant2", parentId: "henri", type: "biologique" },
  ],
  couples: [{ a: "henri", b: "epouse", dateMin: "1919-01-01" }],
};

const trouver = (noeuds: ReturnType<typeof disposerArbre>["noeuds"], id: string) => noeuds.find((n) => n.personne?.id === id)!;

describe("disposerArbre", () => {
  const { noeuds, liens } = disposerArbre(donnees, "henri", { ascendants: 2, descendants: 1 });

  test("racine au centre, Sosa des ancêtres", () => {
    const r = trouver(noeuds, "henri");
    expect(r).toMatchObject({ racine: true, sosa: 1, x: 0, y: 0 });
    expect(r.conjoints?.map((c) => c.id)).toEqual(["epouse"]);
    expect(trouver(noeuds, "ernest").sosa).toBe(2);
    expect(trouver(noeuds, "louise").sosa).toBe(3);
    expect(trouver(noeuds, "louisHenri").sosa).toBe(6);
  });

  test("cases vides pour les parents manquants, limitées aux générations demandées", () => {
    const vides = noeuds.filter((n) => n.manquant).map((n) => n.sosa).sort();
    // Parents d'Ernest (4, 5) et mère de Louise (7) ; rien au-delà de 2 générations.
    expect(vides).toEqual([4, 5, 7]);
  });

  test("ancêtres au-dessus, descendants en dessous, enfants triés par naissance", () => {
    expect(trouver(noeuds, "ernest").y).toBeLessThan(0);
    const e1 = trouver(noeuds, "enfant1");
    const e2 = trouver(noeuds, "enfant2");
    expect(e1.y).toBeGreaterThan(0);
    expect(e1.x).toBeLessThan(e2.x);
    // La racine est centrée entre ses deux enfants.
    expect((e1.x + e2.x) / 2).toBe(0);
  });

  test("aucun chevauchement sur une même ligne", () => {
    const parLigne = Map.groupBy(noeuds, (n) => n.y);
    for (const ligne of parLigne.values()) {
      const xs = ligne.map((n) => n.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(BOITE.l);
    }
  });

  test("un lien par parent affiché", () => {
    expect(liens).toHaveLength(2 + 2 + 2 + 2); // henri→2 parents, ernest→2 vides, louise→2, henri→2 enfants
  });

  test("père déclaré inconnu : case « inconnu », pas « + Père »", () => {
    const d = { ...donnees, personnes: donnees.personnes.map((x) => (x.id === "louise" ? { ...x, mereInconnue: true } : x)) };
    const { noeuds: ns } = disposerArbre(d, "henri", { ascendants: 2, descendants: 0 });
    expect(ns.find((n) => n.sosa === 7)?.manquant).toMatchObject({ role: "mere", inconnu: true });
    expect(ns.find((n) => n.sosa === 4)?.manquant).toMatchObject({ role: "pere", inconnu: false });
  });

  test("racine inconnue : arbre vide", () => {
    expect(disposerArbre(donnees, "personne", { ascendants: 3, descendants: 3 }).noeuds).toEqual([]);
  });
});

describe("anneeFloue", () => {
  test("formats", () => {
    expect(anneeFloue("1897-11-28", "1897-11-28")).toBe("1897");
    expect(anneeFloue("1825-11-30", "1826-11-29")).toBe("~1826");
    expect(anneeFloue(null, "1790-01-01")).toBe("<1790");
    expect(anneeFloue(null, null)).toBe("");
  });
});

test("lignes naissance / décès des cases : année floue et commune", () => {
  const base = p("x");
  expect(ligneNaissance({ ...base, naissanceMin: "1897-11-28", naissanceMax: "1897-11-28", naissanceLieu: "Brissac" })).toBe("° 1897 · Brissac");
  expect(ligneNaissance({ ...base, naissanceMin: "1825-11-30", naissanceMax: "1826-11-29" })).toBe("° ~1826");
  expect(ligneDeces({ ...base, decesLieu: "Saumur" })).toBe("† Saumur");
  expect(ligneDeces(base)).toBe("");
});

describe("enfants de plusieurs unions", () => {
  // Victor ∞ Eugénie (1864) puis ∞ Flavide (1872) ; un enfant né avant le 1er mariage, de mère inconnue.
  const d: DonneesArbre = {
    personnes: [
      p("victor", "M"), p("eugenie", "F"), p("flavide", "F"),
      p("louis", "M", "1867-01-01"), p("leontine", "F", "1871-01-01"),
      p("casimir", "M", "1876-01-01"), p("helene", "F", "1874-01-01"), p("naturel", "M", "1860-01-01"),
    ],
    filiations: [
      ...["louis", "leontine"].flatMap((e) => [{ enfantId: e, parentId: "victor", type: "biologique" }, { enfantId: e, parentId: "eugenie", type: "biologique" }]),
      ...["casimir", "helene"].flatMap((e) => [{ enfantId: e, parentId: "victor", type: "biologique" }, { enfantId: e, parentId: "flavide", type: "biologique" }]),
      { enfantId: "naturel", parentId: "victor", type: "biologique" },
    ],
    // Deuxième mariage saisi en premier : l'ordre suit les dates.
    couples: [{ a: "victor", b: "flavide", dateMin: "1872-06-25" }, { a: "victor", b: "eugenie", dateMin: "1864-07-04" }],
  };
  const { noeuds, liens } = disposerArbre(d, "victor", { ascendants: 0, descendants: 1 });
  const ordre = liens.filter((l) => l.parent.racine).sort((a, b) => a.enfant.x - b.enfant.x);

  test("regroupés par union, dans l'ordre des mariages, parent inconnu à la fin", () => {
    expect(ordre.map((l) => l.enfant.personne!.id)).toEqual(["louis", "leontine", "helene", "casimir", "naturel"]);
    expect(ordre.map((l) => l.union!.conjointId)).toEqual(["eugenie", "eugenie", "flavide", "flavide", null]);
    expect(ordre.map((l) => l.union!.rang)).toEqual([0, 0, 1, 1, 2]);
    expect(ordre.every((l) => l.union!.total === 3)).toBe(true);
    expect(trouver(noeuds, "victor").conjoints!.map((c) => c.id)).toEqual(["eugenie", "flavide"]);
  });

  test("une seule union : pas de regroupement", () => {
    const r = disposerArbre(donnees, "henri", { ascendants: 0, descendants: 1 });
    expect(r.liens.every((l) => !l.union)).toBe(true);
  });
});
