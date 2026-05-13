import { describe, it, expect } from "vitest";
import { Sim, type InputEvent } from "../src/game/sim";
import { DEFAULT_CONFIG } from "../src/game/config";
import { replayRun } from "../src/game/replay";

function flapEvery(start: number, end: number, every: number): InputEvent[] {
  const out: InputEvent[] = [];
  for (let t = start; t <= end; t += every) out.push({ tick: t, action: "flap" });
  return out;
}

function runToEnd(seed: number, inputs: readonly InputEvent[]) {
  const sim = new Sim(seed, DEFAULT_CONFIG);
  sim.queueInputs(inputs);
  while (sim.alive && sim.tick < 60 * 60) sim.step();
  return { score: sim.score, alive: sim.alive, dieTick: sim.dieTick };
}

describe("Sim determinism", () => {
  it("same seed + no inputs falls identically twice", () => {
    const a = runToEnd(12345, []);
    const b = runToEnd(12345, []);
    expect(a).toEqual(b);
    expect(a.alive).toBe(false);
  });

  it("same seed + same inputs yields byte-identical result", () => {
    const inputs = flapEvery(20, 600, 18);
    const a = runToEnd(7777777, inputs);
    const b = runToEnd(7777777, inputs);
    expect(a).toEqual(b);
  });

  it("different seeds produce different pipe layouts", () => {
    const a = new Sim(1, DEFAULT_CONFIG);
    const b = new Sim(2, DEFAULT_CONFIG);
    const aGaps = a.pipes.map((p) => p.gapY);
    const bGaps = b.pipes.map((p) => p.gapY);
    expect(aGaps).not.toEqual(bGaps);
  });

  it("replayRun matches a live Sim run for the same input trace", () => {
    const inputs = flapEvery(10, 400, 22);
    const live = runToEnd(42, inputs);
    const replay = replayRun(42, inputs, DEFAULT_CONFIG);
    expect(replay.score).toBe(live.score);
    expect(replay.alive).toBe(live.alive);
    expect(replay.dieTick).toBe(live.dieTick);
  });

  it("tampering with one input changes the outcome", () => {
    const inputs = flapEvery(10, 400, 22);
    const tampered = inputs.map((i, idx) => (idx === 5 ? { ...i, tick: i.tick + 3 } : i));
    const a = replayRun(42, inputs, DEFAULT_CONFIG);
    const b = replayRun(42, tampered, DEFAULT_CONFIG);
    expect(a).not.toEqual(b);
  });

  it("inputs at the same tick as another are still ordered deterministically", () => {
    const inputs: InputEvent[] = [
      { tick: 30, action: "flap" },
      { tick: 30, action: "flap" },
      { tick: 60, action: "flap" },
    ];
    const a = replayRun(99, inputs, DEFAULT_CONFIG);
    const b = replayRun(99, inputs, DEFAULT_CONFIG);
    expect(a).toEqual(b);
  });
});
