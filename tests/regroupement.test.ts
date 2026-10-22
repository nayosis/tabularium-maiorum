import { describe, expect, test } from "bun:test";
import { comparerPages, extrairePage, prefixeCommun, suggestionsRegroupement, titreCourt } from "../src/lib/regroupement";

const T = "Allonne (Deux-Sèvres, France) - Tables décennales communales des Naissances, Mariages, Décès - (1803-1892)";

describe("extrairePage", () => {
  test.each([
    [`${T} page 159`, T, "159"],
    [`${T} - page 12`, T, "12"],
    ["Registre BMS Verruyes p. 4", "Registre BMS Verruyes", "4"],
    ["NMD Brissac 1897, vue 36", "NMD Brissac 1897", "36"],
    ["Registre paroissial folio 12v", "Registre paroissial", "12v"],
  ])("%s", (titre, prefixe, numero) => {
    expect(extrairePage(titre)).toEqual({ prefixe, numero });
  });

  test("sans numéro de page", () => {
    expect(extrairePage("Acte naissance Gouadon 1897")).toBeNull();
    expect(extrairePage("page 12")).toBeNull();
  });
});

describe("suggestionsRegroupement", () => {
  test("titres ne différant que par la page, documents sans registre seulement", () => {
    const s = suggestionsRegroupement([
      { id: "a", titre: `${T} page 159`, sourceId: null },
      { id: "b", titre: `${T} page 150`, sourceId: null },
      { id: "c", titre: `${T} page 12`, sourceId: "deja-range" },
      { id: "d", titre: "Registre BMS Verruyes p. 4", sourceId: null },
      { id: "e", titre: "Acte de naissance", sourceId: null },
    ]);
    expect(s).toEqual([{ titre: T, ids: ["a", "b"], numeros: { a: "159", b: "150" } }]);
  });
});

describe("affichage dans un groupe", () => {
  test("préfixe commun coupé sur un mot, titre court", () => {
    const titres = [`${T} page 159`, `${T} page 150`, `${T} page 12`];
    const p = prefixeCommun(titres);
    expect(titreCourt(titres[0], p)).toBe("page 159");
    expect(titreCourt(titres[2], p)).toBe("page 12");
    // « page 15x » : le préfixe ne doit pas couper le nombre.
    expect(titreCourt("Table p. 159", prefixeCommun(["Table p. 159", "Table p. 150"]))).toBe("p. 159");
  });

  test("un seul document : titre complet", () => {
    expect(titreCourt("Table p. 159", prefixeCommun(["Table p. 159"]))).toBe("Table p. 159");
  });

  test("tri naturel des pages", () => {
    const pages = ["159", "12", "103", null, "22"].map((n) => ({ numero: n, titre: n ? `p ${n}` : "sans numéro" }));
    expect(pages.sort(comparerPages).map((p) => p.numero)).toEqual(["12", "22", "103", "159", null]);
  });
});
