import { describe, it, expect } from "vitest";
import { canonicalInputTicks, validatePayloadShape } from "../api/_lib/validate";
import { validateInputCadence } from "../src/game/replay";
import { replayRun } from "../src/game/replay";
import { DEFAULT_CONFIG } from "../src/game/config";
import type { InputEvent } from "../src/game/sim";
import { dailySeed } from "../src/game/daily";

const flap = (tick: number): InputEvent => ({ tick, action: "flap" });

describe("canonicalInputTicks — replay identity", () => {
  it("is order-independent (the replay-theft bypass)", () => {
    const original = [flap(10), flap(25), flap(40), flap(55)];
    const shuffled = [flap(40), flap(10), flap(55), flap(25)];
    expect(canonicalInputTicks(shuffled)).toEqual(canonicalInputTicks(original));
  });

  it("de-duplicates repeated ticks", () => {
    expect(canonicalInputTicks([flap(5), flap(5), flap(9)])).toEqual([5, 9]);
  });

  it("agrees with what the simulator actually replays", () => {
    // The simulator sorts before stepping, so a shuffled payload must produce
    // an identical run. If the canonical form is order-independent AND the
    // replays match, then hashing the canonical form cannot be bypassed by
    // reordering.
    const original = [flap(8), flap(20), flap(33), flap(47), flap(61)];
    const shuffled = [flap(47), flap(8), flap(61), flap(33), flap(20)];
    const a = replayRun(1234, original, DEFAULT_CONFIG);
    const b = replayRun(1234, shuffled, DEFAULT_CONFIG);
    expect(b).toEqual(a);
    expect(canonicalInputTicks(shuffled).join(",")).toBe(canonicalInputTicks(original).join(","));
  });

  it("ignores non-flap events", () => {
    const mixed = [flap(3), { tick: 4, action: "pause" } as unknown as InputEvent, flap(9)];
    expect(canonicalInputTicks(mixed)).toEqual([3, 9]);
  });
});

describe("validateInputCadence — burst detection", () => {
  const hz = DEFAULT_CONFIG.tickHz;
  // 50ms floor at tickHz -> minimum gap in ticks.
  const minGap = Math.ceil((50 / 1000) * hz);

  it("accepts a normal human run", () => {
    const inputs = Array.from({ length: 40 }, (_, i) => flap(i * (minGap + 4)));
    expect(validateInputCadence(inputs, hz)).toBe(true);
  });

  it("accepts an occasional fast double-tap", () => {
    const inputs: InputEvent[] = [];
    let t = 0;
    for (let i = 0; i < 30; i++) {
      inputs.push(flap(t));
      t += i % 10 === 0 ? minGap : minGap + 6; // one tight tap per 10
    }
    expect(validateInputCadence(inputs, hz)).toBe(true);
  });

  it("rejects a macro firing every tick", () => {
    const inputs = Array.from({ length: 60 }, (_, i) => flap(i));
    expect(validateInputCadence(inputs, hz)).toBe(false);
  });

  it("THE BUG: rejects a tight burst hidden by a long tail", () => {
    // Mean-only checking passed this: 30 taps in 30 ticks, then one tap far
    // away drags the average over the floor.
    const burst = Array.from({ length: 30 }, (_, i) => flap(i));
    const inputs = [...burst, flap(100_000)];
    expect(validateInputCadence(inputs, hz)).toBe(false);
  });

  it("is order-independent (sorts defensively)", () => {
    const good = Array.from({ length: 20 }, (_, i) => flap(i * (minGap + 4)));
    const shuffled = [...good].reverse();
    expect(validateInputCadence(shuffled, hz)).toBe(validateInputCadence(good, hz));
  });

  it("permits trivially short runs", () => {
    expect(validateInputCadence([], hz)).toBe(true);
    expect(validateInputCadence([flap(0)], hz)).toBe(true);
  });
});

describe("validatePayloadShape — integer discipline", () => {
  const base = {
    seed: 42,
    score: 10,
    ticks: 500,
    inputs: [flap(10), flap(30)],
    mode: "casual" as const,
  };
  const ok = (o: object) => !("error" in (validatePayloadShape(o) as object));

  it("accepts a well-formed payload", () => {
    expect(ok(base)).toBe(true);
  });

  it("rejects fractional seed / score / ticks", () => {
    expect(ok({ ...base, seed: 42.5 })).toBe(false);
    expect(ok({ ...base, score: 10.1 })).toBe(false);
    expect(ok({ ...base, ticks: 500.7 })).toBe(false);
  });

  it("rejects fractional input ticks", () => {
    expect(ok({ ...base, inputs: [{ tick: 10.5, action: "flap" }] })).toBe(false);
  });

  it("rejects non-finite values", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(ok({ ...base, seed: bad })).toBe(false);
      expect(ok({ ...base, score: bad })).toBe(false);
    }
  });

  it("rejects a seed outside uint32", () => {
    expect(ok({ ...base, seed: -1 })).toBe(false);
    expect(ok({ ...base, seed: 0x1_0000_0000 })).toBe(false);
    expect(ok({ ...base, seed: 0xffffffff })).toBe(true);
  });
});

describe("seed range contract", () => {
  // validatePayloadShape now rejects seeds outside uint32. That is only safe
  // because every seed the game can produce IS a uint32:
  //   daily  -> hashStringToSeed() ends in `h >>> 0`
  //   casual -> (Math.random() * 0xffffffff) >>> 0
  //   resume -> opts.resume.seed >>> 0
  // If a future seed source breaks that, this fails instead of silently
  // rejecting legitimate runs at the API.
  it("every daily seed over six years is a uint32", () => {
    for (let y = 2025; y <= 2031; y++) {
      for (let m = 1; m <= 12; m++) {
        for (const d of [1, 15, 28]) {
          const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const seed = dailySeed(date);
          expect(Number.isInteger(seed)).toBe(true);
          expect(seed).toBeGreaterThanOrEqual(0);
          expect(seed).toBeLessThanOrEqual(0xffffffff);
        }
      }
    }
  });

  it("a real daily seed passes payload validation", () => {
    const seed = dailySeed("2026-09-12");
    const res = validatePayloadShape({
      seed,
      score: 10,
      ticks: 500,
      inputs: [flap(10), flap(30)],
      mode: "daily",
    });
    expect("error" in (res as object)).toBe(false);
  });
});
