import { describe, it, expect } from "vitest";
import { ArcadeSim } from "../src/game/arcade/sim";
import { ARCADE_CONFIG } from "../src/game/arcade/config";
import { DEFAULT_CONFIG } from "../src/game/config";

describe("arcade sim", () => {
  it("does not mutate the shared DEFAULT_CONFIG", () => {
    // Arcade tunes its own config; the deterministic default must be untouched.
    expect(ARCADE_CONFIG).not.toBe(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG.pipeGapBase).toBe(170);
    expect(DEFAULT_CONFIG.pipeSpacing).toBe(200);
  });

  it("starts alive in grace and falls once flapped", () => {
    const sim = new ArcadeSim(123, ARCADE_CONFIG);
    expect(sim.alive).toBe(true);
    expect(sim.startGrace).toBe(true);
    sim.step();
    expect(sim.birdY).toBe(ARCADE_CONFIG.birdStartY);
    sim.flap();
    sim.step();
    expect(sim.startGrace).toBe(false);
    expect(sim.birdVY).toBeLessThan(0);
  });

  it("difficulty tracks pipes cleared, not the inflated score", () => {
    // Regression: score is inflated by coins/combos, so speed must NOT key off
    // it or the run would accelerate absurdly fast.
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.score = 9999; // huge score, but no pipes cleared yet
    // currentScrollSpeed is private; assert via observable pipe motion instead.
    sim.startGrace = false;
    const x0 = sim.pipes[0].x;
    sim.step();
    const moved = x0 - sim.pipes[0].x;
    // At level 0 the per-step move is scrollSpeed/tickHz.
    const expected = ARCADE_CONFIG.scrollSpeed / ARCADE_CONFIG.tickHz;
    expect(moved).toBeCloseTo(expected, 5);
  });

  it("a held shield absorbs a fatal hit instead of dying", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.hasShield = true;
    sim.startGrace = false;
    sim.birdY = ARCADE_CONFIG.worldHeight + 50;
    sim.step();
    expect(sim.alive).toBe(true);
    expect(sim.hasShield).toBe(false);
  });

  it("second-life revives once, with brief invulnerability", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.hasSecondLife = true;
    sim.startGrace = false;
    sim.birdY = ARCADE_CONFIG.worldHeight + 50;
    sim.step();
    expect(sim.alive).toBe(true);
    expect(sim.hasSecondLife).toBe(false);
    expect(sim.invulnRemaining).toBeGreaterThan(0);
    // A second fatal situation during invuln does not kill.
    sim.birdY = ARCADE_CONFIG.worldHeight + 50;
    sim.step();
    expect(sim.alive).toBe(true);
  });

  it("dies on an out-of-bounds hit with no saves", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.startGrace = false;
    sim.birdY = ARCADE_CONFIG.worldHeight + 50;
    sim.step();
    expect(sim.alive).toBe(false);
  });

  it("slow-time scales world motion and counts down", () => {
    const sim = new ArcadeSim(7, ARCADE_CONFIG);
    sim.startGrace = false;
    sim.slowTimeRemaining = ARCADE_CONFIG.slowTimeDuration;
    const before = sim.pipes[0].x;
    sim.step();
    const slowDelta = before - sim.pipes[0].x;

    const sim2 = new ArcadeSim(7, ARCADE_CONFIG);
    sim2.startGrace = false;
    const before2 = sim2.pipes[0].x;
    sim2.step();
    const normalDelta = before2 - sim2.pipes[0].x;

    expect(slowDelta).toBeLessThan(normalDelta);
    expect(slowDelta).toBeCloseTo(normalDelta * ARCADE_CONFIG.slowTimeScale, 5);
    expect(sim.slowTimeRemaining).toBeLessThan(ARCADE_CONFIG.slowTimeDuration);
  });

  it("mini shrinks the effective hitbox", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    expect(sim.effectiveRadius()).toBe(ARCADE_CONFIG.birdRadius);
    sim.miniRemaining = ARCADE_CONFIG.miniDuration;
    expect(sim.effectiveRadius()).toBeCloseTo(ARCADE_CONFIG.birdRadius * ARCADE_CONFIG.miniScale, 5);
  });

  it("gravity-flip inverts the flap direction", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.startGrace = false;
    sim.gravityFlipRemaining = ARCADE_CONFIG.gravityFlipDuration;
    expect(sim.gravityDir()).toBe(-1);
    sim.flap();
    sim.step();
    // Flap pushes toward the floor (positive vy) while flipped.
    expect(sim.birdVY).toBeGreaterThan(0);
  });

  it("magnet pulls a nearby coin toward the bird", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.startGrace = false;
    sim.magnetRemaining = ARCADE_CONFIG.magnetDuration;
    sim.coins = [{ id: 999, x: ARCADE_CONFIG.birdX + 100, y: sim.birdY, collected: false }];
    const before = sim.coins[0].x;
    sim.step();
    // It moved left both from world scroll and the magnet pull — net closer in x.
    expect(sim.coins[0].x).toBeLessThan(before);
  });

  it("is reproducible for a given seed", () => {
    const run = (seed: number) => {
      const sim = new ArcadeSim(seed, ARCADE_CONFIG);
      sim.startGrace = false;
      for (let i = 0; i < 200; i++) {
        if (i % 20 === 0) sim.flap();
        sim.step();
      }
      return { score: sim.score, y: sim.birdY, pipes: sim.pipes.length };
    };
    expect(run(42)).toEqual(run(42));
  });
});
