import { describe, it, expect } from "vitest";
import { Sim } from "../src/game/sim";
import { DEFAULT_CONFIG } from "../src/game/config";

// The difficulty cap is part of the replay/determinism contract (see the
// maxDifficultyLevel comment in config.ts) — these tests pin it down.
describe("difficulty cap", () => {
  // currentScrollSpeed/currentGapH are private; poke them via a cast — the
  // alternative (simulating to score 400+) would make the test minutes long.
  const probe = (score: number) => {
    const sim = new Sim(1234, DEFAULT_CONFIG) as unknown as {
      score: number;
      currentScrollSpeed(): number;
      currentGapH(): number;
    };
    sim.score = score;
    return { speed: sim.currentScrollSpeed(), gap: sim.currentGapH() };
  };

  it("speed compounds up to the cap, then stays flat forever", () => {
    expect(probe(100).speed).toBeGreaterThan(probe(0).speed);
    const atCap = probe(DEFAULT_CONFIG.maxDifficultyLevel * DEFAULT_CONFIG.difficultyStep).speed;
    expect(probe(2000).speed).toBe(atCap);
    expect(probe(100000).speed).toBe(atCap);
  });

  it("capped speed can never tunnel through a pipe in one tick", () => {
    const perTick = probe(100000).speed / DEFAULT_CONFIG.tickHz;
    const collisionWindow = DEFAULT_CONFIG.pipeWidth + DEFAULT_CONFIG.birdRadius * 2;
    expect(perTick).toBeLessThan(collisionWindow / 4);
  });

  it("gap floor is unaffected by the cap (already reached below it)", () => {
    expect(probe(100000).gap).toBe(DEFAULT_CONFIG.pipeGapMin);
    expect(probe(DEFAULT_CONFIG.maxDifficultyLevel * DEFAULT_CONFIG.difficultyStep).gap).toBe(
      DEFAULT_CONFIG.pipeGapMin,
    );
  });
});
