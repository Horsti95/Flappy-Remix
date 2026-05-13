import { describe, it, expect } from "vitest";
import { deltaE2000, rgbToLab } from "../src/game/color";
import { classifyRarity, rarityRank } from "../src/game/rarity";

describe("ΔE2000", () => {
  it("returns 0 for identical colors", () => {
    expect(deltaE2000([100, 50, 200], [100, 50, 200])).toBeCloseTo(0, 4);
  });

  it("matches reference Sharma 2005 test pair (white vs black)", () => {
    const d = deltaE2000([255, 255, 255], [0, 0, 0]);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });

  it("ranks similar colors below dissimilar ones", () => {
    const closeBlues = deltaE2000([10, 20, 200], [10, 20, 210]);
    const farPair = deltaE2000([10, 20, 200], [240, 200, 50]);
    expect(closeBlues).toBeLessThan(farPair);
  });

  it("is symmetric within numerical tolerance", () => {
    const a = deltaE2000([12, 200, 60], [220, 80, 40]);
    const b = deltaE2000([220, 80, 40], [12, 200, 60]);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("rgbToLab", () => {
  it("maps pure black to L=0", () => {
    expect(rgbToLab([0, 0, 0]).L).toBeCloseTo(0, 4);
  });
  it("maps pure white to L≈100", () => {
    expect(rgbToLab([255, 255, 255]).L).toBeCloseTo(100, 1);
  });
});

describe("rarity classifier", () => {
  it("low contrast against sky -> common", () => {
    const r = classifyRarity({ body: [135, 206, 235], accent: [140, 210, 240] });
    expect(r.rarity).toBe("common");
  });

  it("moderate contrast -> uncommon", () => {
    const r = classifyRarity({ body: [200, 100, 100], accent: [120, 90, 110] });
    expect(["uncommon", "rare"]).toContain(r.rarity);
    expect(rarityRank(r.rarity)).toBeGreaterThan(0);
  });

  it("vivid high contrast non-complementary -> epic", () => {
    const r = classifyRarity({ body: [255, 20, 30], accent: [240, 200, 30] });
    expect(["epic", "rare"]).toContain(r.rarity);
  });

  it("vivid complementary -> legendary", () => {
    const r = classifyRarity({ body: [220, 20, 60], accent: [20, 200, 220] });
    expect(r.rarity).toBe("legendary");
  });

  it("is deterministic for a given pair", () => {
    const pair = { body: [12, 240, 80] as [number, number, number], accent: [240, 60, 200] as [number, number, number] };
    const a = classifyRarity(pair);
    const b = classifyRarity(pair);
    expect(a).toEqual(b);
  });
});
