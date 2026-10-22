import { describe, expect, test } from "bun:test";
import { dimensionsReduites } from "../src/lib/reduireImage";

describe("réduction des photos de téléphone", () => {
  test("le plus grand côté ramené à 4000 px, proportions gardées", () => {
    expect(dimensionsReduites(8000, 6000)).toEqual({ largeur: 4000, hauteur: 3000, reduite: true });
    expect(dimensionsReduites(3024, 4032)).toEqual({ largeur: 3000, hauteur: 4000, reduite: true });
  });
  test("image déjà assez petite : inchangée", () => {
    expect(dimensionsReduites(4000, 3000)).toEqual({ largeur: 4000, hauteur: 3000, reduite: false });
    expect(dimensionsReduites(1200, 800, 4000).reduite).toBe(false);
  });
});
