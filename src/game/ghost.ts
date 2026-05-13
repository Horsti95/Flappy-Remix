import { Sim, type InputEvent } from "./sim";
import { type SimConfig } from "./config";

/**
 * GhostSim runs deterministically alongside the live sim so the
 * renderer can draw a translucent overlay where the challenge
 * creator was at tick N. Driven by tick(), one call per live tick.
 */
export class GhostSim {
  private sim: Sim;
  private done = false;
  private dieTick = -1;

  constructor(seed: number, inputs: readonly InputEvent[], cfg: SimConfig) {
    this.sim = new Sim(seed, cfg);
    this.sim.queueInputs(inputs);
  }

  step(): void {
    if (this.done) return;
    this.sim.step();
    if (!this.sim.alive) {
      this.done = true;
      this.dieTick = this.sim.dieTick;
    }
  }

  syncTo(tick: number): void {
    while (!this.done && this.sim.tick < tick) this.step();
  }

  isAlive(): boolean {
    return this.sim.alive;
  }

  birdY(): number {
    return this.sim.birdY;
  }

  prevBirdY(): number {
    return this.sim.prevBirdY;
  }

  score(): number {
    return this.sim.score;
  }

  diedAt(): number {
    return this.dieTick;
  }

  tick(): number {
    return this.sim.tick;
  }

  pipeGapYs(): number[] {
    return this.sim.pipes.map((p) => p.gapY);
  }
}
