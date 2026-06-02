import { DEFAULT_CONFIG, type SimConfig } from "../config";

/**
 * Arcade Mode config. Arcade is a SEPARATE, non-deterministic, non-leaderboard
 * sandbox — it never feeds the scored sim, so we can tune freely here without
 * touching `DEFAULT_CONFIG`. We borrow the core world dimensions / physics so
 * the renderer + feel stay familiar, then layer arcade-only spawn rules on top.
 */
export interface ArcadeConfig extends SimConfig {
  /** Radius (world px) of a collectible coin. */
  coinRadius: number;
  /** Score awarded per coin (before multiplier). */
  coinScore: number;
  /** Average horizontal gap (world px) between coin spawns. */
  coinSpacing: number;
  /** Radius (world px) of a spinning-saw hazard. */
  sawRadius: number;
  /** 1-in-N chance (per pipe spawn) that a saw rides along with the pipe. */
  sawRarity: number;
  /** Vertical travel amplitude (world px) of a moving saw. */
  sawBobAmplitude: number;
  /** Saw vertical bob speed (radians/sec). */
  sawBobSpeed: number;
  /** 1-in-N chance (per pipe spawn) that a power-up spawns in the gap. */
  powerUpRarity: number;
  /** Radius (world px) of a floating power-up token. */
  powerUpRadius: number;
  /** Seconds the slow-time effect lasts. */
  slowTimeDuration: number;
  /** World time scale while slow-time is active (1 = normal). */
  slowTimeScale: number;
  /** Distance (world px) from a pipe edge that counts as a "perfect pass". */
  perfectPassWindow: number;
  /** Score multiplier cap from the combo meter. */
  maxMultiplier: number;
}

export const ARCADE_CONFIG: ArcadeConfig = {
  ...DEFAULT_CONFIG,
  // Arcade leans a touch roomier than ranked so the chaos stays fun, not brutal.
  pipeGapBase: 185,
  pipeGapMin: 130,
  pipeSpacing: 220,
  coinRadius: 9,
  coinScore: 5,
  coinSpacing: 150,
  sawRadius: 18,
  sawRarity: 4,
  sawBobAmplitude: 70,
  sawBobSpeed: 1.6,
  powerUpRarity: 5,
  powerUpRadius: 14,
  slowTimeDuration: 4,
  slowTimeScale: 0.5,
  perfectPassWindow: 22,
  maxMultiplier: 8,
};
