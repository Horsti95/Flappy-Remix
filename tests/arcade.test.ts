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
    // During grace the bird holds position.
    sim.step();
    expect(sim.birdY).toBe(ARCADE_CONFIG.birdStartY);
    sim.flap();
    sim.step();
    expect(sim.startGrace).toBe(false);
    expect(sim.birdVY).toBeLessThan(0);
  });

  it("a held shield absorbs a fatal hit instead of dying", () => {
    const sim = new ArcadeSim(1, ARCADE_CONFIG);
    sim.hasShield = true;
    sim.startGrace = false;
    // Drive the bird out the bottom of the world.
    sim.birdY = ARCADE_CONFIG.worldHeight + 50;
    sim.step();
    expect(sim.alive).toBe(true);
    expect(sim.hasShield).toBe(false);
  });

  it("dies on an out-of-bounds hit with no shield", () => {
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
    expect(sim.slowTimeRemaining).toBeLessThan(ARCADE_CONFIG.slowTimeDuration);
  });

  it("is reproducible for a given seed (seeded, even if live-mode is real-time)", () => {
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
