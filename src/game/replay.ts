import { Sim, type InputEvent } from "./sim";
import { type SimConfig } from "./config";

export interface ReplayResult {
  score: number;
  alive: boolean;
  ticks: number;
  dieTick: number;
}

export function replayRun(
  seed: number,
  inputs: readonly InputEvent[],
  cfg: SimConfig,
  maxTicks = 60 * 60 * 5,
): ReplayResult {
  const sim = new Sim(seed, cfg);
  sim.queueInputs(inputs);
  while (sim.alive && sim.tick < maxTicks) {
    sim.step();
  }
  return { score: sim.score, alive: sim.alive, ticks: sim.tick, dieTick: sim.dieTick };
}

/**
 * Reject input streams no human hand could produce.
 *
 * This used to compare only the MEAN gap between taps, which is trivially
 * gamed: 200 taps inside a tenth of a second, then one tap a minute later,
 * averages out fine. A macro firing every tick passed as long as the run was
 * long enough. So we now check the distribution, not just its average:
 *
 *  1. the mean gap must clear the physiological floor (as before), and
 *  2. no WINDOW of consecutive taps may exceed the sustained-burst rate.
 *
 * The window check is what catches macros. `maxBurst` consecutive taps must
 * span at least `maxBurst - 1` minimum gaps; a real player who double-taps
 * occasionally stays well inside it, a script does not.
 *
 * Inputs are sorted defensively: callers may hand over unsorted arrays (the
 * simulator sorts too), and an unsorted stream would otherwise produce
 * negative gaps that mask a burst.
 */
export function validateInputCadence(
  inputs: readonly InputEvent[],
  tickHz: number,
  minMsBetween = 50,
  maxBurst = 8,
): boolean {
  if (inputs.length < 2) return true;
  const minTicks = Math.ceil((minMsBetween / 1000) * tickHz);
  const ticks = inputs
    .filter((e) => e.action === "flap")
    .map((e) => e.tick)
    .sort((a, b) => a - b);
  if (ticks.length < 2) return true;

  // 1. Mean gap over the whole run.
  const span = ticks[ticks.length - 1] - ticks[0];
  if (span / (ticks.length - 1) < minTicks) return false;

  // 2. Sliding window: any `maxBurst` consecutive taps must still respect the
  //    minimum gap on average within that window.
  const win = Math.min(maxBurst, ticks.length);
  for (let i = 0; i + win - 1 < ticks.length; i++) {
    const windowSpan = ticks[i + win - 1] - ticks[i];
    if (windowSpan < minTicks * (win - 1)) return false;
  }
  return true;
}
