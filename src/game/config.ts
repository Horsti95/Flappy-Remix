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
};
