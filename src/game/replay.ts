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

export function validateInputCadence(inputs: readonly InputEvent[], tickHz: number, minMsBetween = 50): boolean {
  if (inputs.length < 2) return true;
  const minTicks = Math.ceil((minMsBetween / 1000) * tickHz);
  let total = 0;
  let prev = inputs[0].tick;
  for (let i = 1; i < inputs.length; i++) {
    total += inputs[i].tick - prev;
    prev = inputs[i].tick;
  }
  const avg = total / (inputs.length - 1);
  return avg >= minTicks;
}
