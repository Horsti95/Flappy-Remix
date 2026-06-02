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
  /** Seeded +/- variance (px) on each gap's height, for run-to-run variety. */
  gapJitter: number;
  /** Max px the gap CENTER may step from the previous gap (keeps the path
   *  fair — no brutal top↔bottom zigzag). */
  maxGapStep: number;
  /** 1-in-N chance a gap ignores the step limit and jumps anywhere (variety). */
  maxGapJumpRarity: number;
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
  pipeGapMin: 110,
  pipeMargin: 56,
  speedScale: 1.04,
  gapShrinkPerStep: 8,
  difficultyStep: 10,
  gapJitter: 14,
  maxGapStep: 150,
  maxGapJumpRarity: 35,
};
