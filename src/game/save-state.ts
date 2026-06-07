import type { InputEvent } from "./sim";

/**
 * Resumable casual run.
 *
 * Casual is the only mode that can be paused, left, and resumed later — a
 * quality-of-life fit for "20 minutes a day" play. Daily and ranked are
 * deliberately excluded: resuming them would let a player study the seed or
 * game the fairness model.
 *
 * The save is tiny and deterministic: just the seed + the input history so
 * far + the tick we stopped at. On resume the sim replays those inputs to
 * reconstruct the exact position (see GameLoop.prime), so there's no physics
 * snapshot to serialize.
 */
export interface SavedRun {
  seed: number;
  inputs: InputEvent[];
  tick: number;
  score: number;
  savedAt: number;
}

const KEY = "pflug.savedCasual.v1";

export function saveCasualRun(run: SavedRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    /* localStorage blocked — resume just won't be offered */
  }
}

export function loadSavedCasualRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as SavedRun;
    if (typeof r.seed !== "number" || !Array.isArray(r.inputs)) return null;
    return r;
  } catch {
    return null;
  }
}

export function clearSavedCasualRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasSavedCasualRun(): boolean {
  return loadSavedCasualRun() !== null;
}
