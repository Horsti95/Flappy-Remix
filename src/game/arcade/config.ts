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
  /** Max vertical offset (world px) a coin drifts from the flight path. */
  coinSpread: number;
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
  /** World/bird time scale while slow-time is active (1 = normal). */
  slowTimeScale: number;
  /** Seconds the coin-magnet effect lasts. */
  magnetDuration: number;
  /** Radius (world px) within which the magnet pulls coins. */
  magnetRange: number;
  /** Magnet pull speed (world px/sec) toward the bird. */
  magnetPull: number;
  /** Seconds the mini (shrink) effect lasts. */
  miniDuration: number;
  /** Hitbox/visual scale while mini is active. */
  miniScale: number;
  /** Seconds the gravity-flip effect lasts. */
  gravityFlipDuration: number;
  /** Seconds the rocket boost lasts. */
  rocketDuration: number;
  /** Upward acceleration (world px/sec^2) applied while the rocket burns. */
  rocketThrust: number;
  /** Max upward speed (world px/sec) the rocket will climb at. */
  rocketMaxClimb: number;
  /** Seconds of invulnerability granted after a second-life revive. */
  reviveInvuln: number;
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
  coinSpread: 80,
  sawRadius: 18,
  sawRarity: 4,
  sawBobAmplitude: 70,
  sawBobSpeed: 1.6,
  powerUpRarity: 4,
  powerUpRadius: 14,
  slowTimeDuration: 4,
  slowTimeScale: 0.45,
  magnetDuration: 6,
  magnetRange: 150,
  magnetPull: 260,
  miniDuration: 7,
  miniScale: 0.55,
  gravityFlipDuration: 5,
  rocketDuration: 2.5,
  rocketThrust: 2600,
  rocketMaxClimb: 320,
  reviveInvuln: 1.6,
  perfectPassWindow: 22,
  maxMultiplier: 8,
};
