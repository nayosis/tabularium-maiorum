import { describe, expect, test } from "bun:test";
import { cadrePortrait, lirePortrait } from "../src/lib/portrait";

describe("cadrage du portrait", () => {
  test("carré centré sur la zone, avec marge", () => {
    const c = cadrePortrait([{ x: 100, y: 200, w: 100, h: 200 }], 1000, 1000, 0.1);
    expect(c.w).toBe(240);
    expect(c.h).toBe(240);
    expect(c.x).toBe(30);
    expect(c.y).toBe(180);
  });

  test("plusieurs rectangles : rectangle englobant", () => {
    const c = cadrePortrait([{ x: 100, y: 100, w: 50, h: 50 }, { x: 300, y: 120, w: 50, h: 30 }], 1000, 1000, 0);
    expect(c).toEqual({ x: 100, y: 0, w: 250, h: 250 });
  });

  test("reste dans l'image (zone au bord, image plus petite que le cadre)", () => {
    const bord = cadrePortrait([{ x: 0, y: 0, w: 100, h: 100 }], 1000, 800, 0.2);
    expect(bord.x).toBe(0);
    expect(bord.y).toBe(0);
    const petite = cadrePortrait([{ x: 0, y: 0, w: 900, h: 900 }], 600, 400, 0);
    expect(petite.w).toBe(400);
    expect(petite.x).toBeGreaterThanOrEqual(0);
    expect(petite.x + petite.w).toBeLessThanOrEqual(600);
  });

  test("lecture du JSON SQL", () => {
    expect(lirePortrait(null)).toBeNull();
    expect(lirePortrait('{"fichier":"a.jpg","rects":[]}')).toBeNull();
    expect(lirePortrait('{"annotationId":"z","fichier":"a.jpg","largeur":10,"hauteur":10,"rects":[{"x":1,"y":1,"w":2,"h":2}]}')?.fichier).toBe("a.jpg");
  });
});
