import { Sim, type InputEvent } from "./sim";
import { type SimConfig } from "./config";
import { GhostSim } from "./ghost";

export interface LoopHandlers {
  render(sim: Sim, alpha: number, ghost: GhostSim | null): void;
  onDeath?(sim: Sim): void;
  /** Fired (visual/audio only) whenever the score increases. */
  onScore?(score: number): void;
}

export class GameLoop {
  sim: Sim;
  ghost: GhostSim | null = null;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private paused = false;
  private dtMs: number;
  private rafId = 0;
  private maxFrameMs = 100;
  private handlers: LoopHandlers;
  private inputBuffer: InputEvent[] = [];
  private notifiedDeath = false;
  private prevScore = 0;

  constructor(seed: number, cfg: SimConfig, handlers: LoopHandlers, ghost?: GhostSim, noFail = false) {
    this.sim = new Sim(seed, cfg, noFail);
    this.dtMs = 1000 / cfg.tickHz;
    this.handlers = handlers;
    this.ghost = ghost ?? null;
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
    this.inputBuffer.push({ tick: this.sim.tick + 1, action: "flap" });
  }

  getRecordedInputs(): InputEvent[] {
    return [...this.recordedInputs];
  }

  private recordedInputs: InputEvent[] = [];

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    if (this.paused) {
      this.lastTime = now;
      this.handlers.render(this.sim, 0, this.ghost);
      return;
    }
    let frameMs = now - this.lastTime;
    if (frameMs > this.maxFrameMs) frameMs = this.maxFrameMs;
    this.lastTime = now;
    this.accumulator += frameMs;
    while (this.accumulator >= this.dtMs) {
      if (this.inputBuffer.length > 0) {
        const pending = this.inputBuffer.splice(0, this.inputBuffer.length);
        for (const ev of pending) {
          const stamped = { tick: this.sim.tick + 1, action: ev.action };
          this.sim.queueInput(stamped);
          this.recordedInputs.push(stamped);
        }
      }
      this.sim.step();
      if (this.ghost) this.ghost.step();
      if (this.sim.score > this.prevScore) {
        this.prevScore = this.sim.score;
        this.handlers.onScore?.(this.sim.score);
      }
      this.accumulator -= this.dtMs;
      if (!this.sim.alive && !this.notifiedDeath) {
        this.notifiedDeath = true;
        this.handlers.onDeath?.(this.sim);
        break;
      }
    }
    const alpha = this.sim.alive ? this.accumulator / this.dtMs : 0;
    this.handlers.render(this.sim, alpha, this.ghost);
  };
}
