import { describe, it, expect } from "vitest";
import { Rng, hashStringToSeed } from "../src/game/rng";

describe("Rng (Mulberry32)", () => {
  it("produces the same sequence for the same seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("diverges for different seeds within 4 draws", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let diverged = false;
    for (let i = 0; i < 4; i++) {
      if (a.next() !== b.next()) {
        diverged = true;
        break;
      }
    }
    expect(diverged).toBe(true);
  });

  it("nextFloat stays inside the given range", () => {
    const r = new Rng(123);
    for (let i = 0; i < 500; i++) {
      const v = r.nextFloat(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it("nextInt is uniformly bounded", () => {
    const r = new Rng(777);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10000; i++) {
      const v = r.nextInt(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      buckets[v]++;
    }
    for (const b of buckets) expect(b).toBeGreaterThan(800);
  });

  it("hashStringToSeed is stable", () => {
    expect(hashStringToSeed("daily-2025-01-01")).toBe(hashStringToSeed("daily-2025-01-01"));
    expect(hashStringToSeed("daily-2025-01-01")).not.toBe(hashStringToSeed("daily-2025-01-02"));
  });
});
