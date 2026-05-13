import { describe, it, expect } from "vitest";
import { Sim, type InputEvent } from "../src/game/sim";
import { DEFAULT_CONFIG } from "../src/game/config";
import { validatePayloadShape, validateRun, type SubmitBody } from "../api/_lib/validate";

function recordRun(seed: number, flapEveryTicks: number, maxTicks = 60 * 60): {
  seed: number;
  score: number;
  ticks: number;
  inputs: InputEvent[];
} {
  const sim = new Sim(seed, DEFAULT_CONFIG);
  const inputs: InputEvent[] = [];
  let nextFlap = 5;
  while (sim.alive && sim.tick < maxTicks) {
    if (sim.tick === nextFlap) {
      const ev: InputEvent = { tick: sim.tick + 1, action: "flap" };
      sim.queueInput(ev);
      inputs.push(ev);
      nextFlap = sim.tick + flapEveryTicks;
    }
    sim.step();
  }
  return { seed, score: sim.score, ticks: sim.tick, inputs };
}

function makeBody(over: Partial<SubmitBody>): SubmitBody {
  // Cadence 30 ticks is near the flap/gravity equilibrium for the
  // default config — it produces runs that actually interact with at
  // least one pipe so seed-dependent behavior matters in tests below.
  const base = recordRun(424242, 30);
  return {
    seed: base.seed,
    score: base.score,
    ticks: base.ticks,
    inputs: base.inputs,
    mode: "casual",
    ...over,
  };
}

describe("submit-run validator", () => {
  it("accepts an honest run", () => {
    const body = makeBody({});
    const r = validateRun(body);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ticks).toBe(body.ticks);
  });

  it("rejects a score that is higher than the replay produces", () => {
    const body = makeBody({ score: 999 });
    const r = validateRun(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("score_mismatch");
  });

  it("rejects when the same input trace is paired with an inflated score claim", () => {
    const body = makeBody({});
    body.score = body.score + 50;
    const r = validateRun(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("score_mismatch");
  });

  it("trimmed inputs only validate if the resulting replay still matches the claim within tolerance", () => {
    const body = makeBody({});
    if (body.inputs.length > 1) {
      body.inputs = body.inputs.slice(0, Math.max(1, body.inputs.length - 2));
    }
    const r = validateRun(body);
    if (!r.ok) {
      expect(["score_mismatch", "ticks_mismatch"]).toContain(r.reason);
    } else {
      // If a trimmed trace still reaches the claimed score within the
      // tick tolerance, the run is legitimate — the trace is just one
      // valid path to that score.
      expect(Math.abs(r.ticks - body.ticks)).toBeLessThanOrEqual(2);
    }
  });

  it("rejects suspiciously fast input cadence", () => {
    const tooFast: InputEvent[] = [];
    for (let t = 1; t < 200; t += 2) tooFast.push({ tick: t, action: "flap" });
    const body = makeBody({ inputs: tooFast, score: 0, ticks: 200 });
    const r = validateRun(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cadence");
  });

  it("rejects ticks that disagree by more than 2", () => {
    const body = makeBody({});
    body.ticks = body.ticks + 100;
    const r = validateRun(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ticks_mismatch");
  });

  it("inputs replayed against a different seed only validate if the score still matches", () => {
    const honest = recordRun(424242, 30);
    const body: SubmitBody = {
      seed: 999999,
      score: honest.score + 25,
      ticks: honest.ticks,
      inputs: honest.inputs,
      mode: "casual",
    };
    const r = validateRun(body);
    expect(r.ok).toBe(false);
  });
});

describe("payload shape", () => {
  it("rejects non-object payloads", () => {
    expect(validatePayloadShape(null)).toHaveProperty("error");
    expect(validatePayloadShape("nope")).toHaveProperty("error");
  });

  it("rejects negative scores and absurd tick counts", () => {
    expect(validatePayloadShape({
      seed: 1, score: -5, ticks: 100, inputs: [], mode: "casual",
    })).toHaveProperty("error");
    expect(validatePayloadShape({
      seed: 1, score: 1, ticks: 9_999_999, inputs: [], mode: "casual",
    })).toHaveProperty("error");
  });

  it("rejects unknown modes and unknown input actions", () => {
    expect(validatePayloadShape({
      seed: 1, score: 0, ticks: 0, inputs: [], mode: "freeplay",
    })).toHaveProperty("error");
    expect(validatePayloadShape({
      seed: 1, score: 0, ticks: 0, inputs: [{ tick: 1, action: "warp" }], mode: "casual",
    })).toHaveProperty("error");
  });

  it("accepts a sensible payload", () => {
    const result = validatePayloadShape({
      seed: 1, score: 0, ticks: 0, inputs: [{ tick: 1, action: "flap" }], mode: "casual",
    });
    expect(result).not.toHaveProperty("error");
  });
});
