export interface SimConfig {
  worldWidth: number;
  worldHeight: number;
  tickHz: number;
  gravity: number;
  flapImpulse: number;
  scrollSpeed: number;
  birdX: number;
  birdStartY: number;
  birdRadius: number;
  pipeWidth: number;
  pipeSpacing: number;
  pipeGapBase: number;
  pipeGapMin: number;
  pipeMargin: number;
  speedScale: number;
  gapShrinkPerStep: number;
  difficultyStep: number;
  /**
   * Difficulty stops compounding past this level (level = score /
   * difficultyStep). Two reasons, both permanent:
   *  - rhythm: uncapped 1.04^level turns into chaos around score 200+ and
   *    players lose the tap cadence;
   *  - physics: by roughly level 90 a pipe would cross the bird's collision
   *    window inside a single 60 Hz tick and the swept check tunnels.
   * DETERMINISM: this is part of the replay contract. It was chosen while
   * no recorded run had ever reached the cap (score 400); changing it later
   * would invalidate stored replays above the cap. Do not retune casually.
   */
  maxDifficultyLevel: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  worldWidth: 360,
  worldHeight: 640,
  tickHz: 60,
  gravity: 1500,
  flapImpulse: 420,
  scrollSpeed: 140,
  birdX: 96,
  birdStartY: 280,
  birdRadius: 14,
  pipeWidth: 56,
  pipeSpacing: 200,
  pipeGapBase: 170,
  pipeGapMin: 100,
  pipeMargin: 56,
  speedScale: 1.04,
  gapShrinkPerStep: 4,
  difficultyStep: 20,
  // Level 20 = score 400: speed tops out at ~2.19× (≈307 world px/s,
  // ~5 px/tick — far from tunneling); the gap floor (100) is already
  // reached at level 17.5, so gaps are unaffected by the cap.
  maxDifficultyLevel: 20,
};
