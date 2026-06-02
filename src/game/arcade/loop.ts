import { ArcadeSim } from "./sim";
import { type ArcadeConfig } from "./config";

export interface ArcadeLoopHandlers {
  render(sim: ArcadeSim, alpha: number): void;
  onDeath?(sim: ArcadeSim): void;
}

/**
 * Fixed-timestep loop for Arcade Mode — a trimmed sibling of `GameLoop` that
 * drives `ArcadeSim` instead of the deterministic `Sim`. Kept separate so the
 * scored loop is never touched. No replay recording (Arcade isn't validated).
 */
export class ArcadeLoop {
  sim: ArcadeSim;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private paused = false;
  private dtMs: number;
  private rafId = 0;
  private maxFrameMs = 100;
  private handlers: ArcadeLoopHandlers;
  private notifiedDeath = false;

  constructor(seed: number, cfg: ArcadeConfig, handlers: ArcadeLoopHandlers) {
    this.sim = new ArcadeSim(seed, cfg);
    this.dtMs = 1000 / cfg.tickHz;
    this.handlers = handlers;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.lastTime = performance.now();
  }

  isPaused(): boolean {
    return this.paused;
  }

  flap(): void {
    if (!this.sim.alive) return;
    this.sim.flap();
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    if (this.paused) {
      this.lastTime = now;
      this.handlers.render(this.sim, 0);
      return;
    }
    let frameMs = now - this.lastTime;
    if (frameMs > this.maxFrameMs) frameMs = this.maxFrameMs;
    this.lastTime = now;
    this.accumulator += frameMs;
    while (this.accumulator >= this.dtMs) {
      this.sim.step();
      this.accumulator -= this.dtMs;
      if (!this.sim.alive && !this.notifiedDeath) {
        this.notifiedDeath = true;
        this.handlers.onDeath?.(this.sim);
        break;
      }
    }
    const alpha = this.sim.alive ? this.accumulator / this.dtMs : 0;
    this.handlers.render(this.sim, alpha);
  };
}
