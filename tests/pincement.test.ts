import { describe, expect, test } from "bun:test";
import { creerPincement } from "../src/lib/pincement";

const p = (pointerId: number, clientX: number, clientY: number) => ({ pointerId, clientX, clientY });

describe("pincement", () => {
  test("un seul doigt : pas de zoom", () => {
    const z = creerPincement();
    z.poser(p(1, 0, 0));
    expect(z.actif()).toBe(false);
    expect(z.bouger(p(1, 50, 0))).toBeNull();
  });

  test("deux doigts qui s'écartent : zoom avant, centré entre les doigts", () => {
    const z = creerPincement();
    z.poser(p(1, 100, 100));
    z.poser(p(2, 200, 100));
    expect(z.actif()).toBe(true);
    const r = z.bouger(p(2, 300, 100))!;
    expect(r.facteur).toBeCloseTo(2);
    expect(r).toMatchObject({ cx: 200, cy: 100 });
    // Mouvement suivant : relatif au précédent
    expect(z.bouger(p(1, 200, 100))!.facteur).toBeCloseTo(0.5);
  });

  test("un doigt levé : fin du pincement", () => {
    const z = creerPincement();
    z.poser(p(1, 0, 0));
    z.poser(p(2, 100, 0));
    z.retirer({ pointerId: 2 });
    expect(z.actif()).toBe(false);
    expect(z.bouger(p(1, 10, 0))).toBeNull();
    expect(z.bouger(p(9, 10, 0))).toBeNull();
  });
});
