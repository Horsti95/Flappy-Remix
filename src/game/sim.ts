import { Rng } from "./rng";
import { type SimConfig } from "./config";

export type InputAction = "flap";
export interface InputEvent {
  tick: number;
  action: InputAction;
}

export interface Pipe {
  id: number;
  x: number;
  gapY: number;
  gapH: number;
  passed: boolean;
}

export interface SimSnapshot {
  birdY: number;
  birdVY: number;
  pipes: Pipe[];
  score: number;
  alive: boolean;
}

export class Sim {
  readonly cfg: SimConfig;
  readonly seed: number;
  private rng: Rng;
  tick = 0;
  birdY: number;
  birdVY = 0;
  pipes: Pipe[] = [];
  private nextPipeId = 0;
  private inputs: InputEvent[] = [];
  private inputIdx = 0;
  score = 0;
  alive = true;
  dieTick = -1;
  startGrace = true;
  prevBirdY: number;
  prevPipeXs = new Map<number, number>();

  constructor(seed: number, cfg: SimConfig) {
    this.seed = seed >>> 0;
    this.cfg = cfg;
    this.rng = new Rng(this.seed);
    this.birdY = cfg.birdStartY;
    this.prevBirdY = cfg.birdStartY;
    this.spawnInitialPipes();
  }

  queueInputs(inputs: readonly InputEvent[]): void {
    for (const ev of inputs) {
      if (ev.action === "flap") this.inputs.push({ tick: ev.tick, action: ev.action });
    }
    this.inputs.sort((a, b) => a.tick - b.tick);
  }

  queueInput(ev: InputEvent): void {
    this.inputs.push({ tick: ev.tick, action: ev.action });
  }

  snapshot(): SimSnapshot {
    return {
      birdY: this.birdY,
      birdVY: this.birdVY,
      pipes: this.pipes.map((p) => ({ ...p })),
      score: this.score,
      alive: this.alive,
    };
  }

  step(): void {
    if (!this.alive) return;
    const dt = 1 / this.cfg.tickHz;
    this.prevBirdY = this.birdY;
    this.prevPipeXs.clear();
    for (const p of this.pipes) this.prevPipeXs.set(p.id, p.x);

    while (this.inputIdx < this.inputs.length && this.inputs[this.inputIdx].tick <= this.tick) {
      const ev = this.inputs[this.inputIdx++];
      if (ev.action === "flap") {
        this.birdVY = -this.cfg.flapImpulse;
        this.startGrace = false;
      }
    }

    if (this.startGrace) {
      this.birdVY = 0;
    } else {
      this.birdVY += this.cfg.gravity * dt;
      this.birdY += this.birdVY * dt;
    }

    const speed = this.currentScrollSpeed();
    for (const p of this.pipes) p.x -= speed * dt;

    while (this.pipes.length > 0 && this.pipes[0].x + this.cfg.pipeWidth < 0) {
      this.pipes.shift();
    }
    const lastPipe = this.pipes[this.pipes.length - 1];
    if (!lastPipe || lastPipe.x < this.cfg.worldWidth - this.cfg.pipeSpacing) {
      this.spawnPipe(lastPipe ? lastPipe.x + this.cfg.pipeSpacing : this.cfg.worldWidth);
    }

    for (const p of this.pipes) {
      if (!p.passed && p.x + this.cfg.pipeWidth < this.cfg.birdX) {
        p.passed = true;
        this.score++;
      }
    }

    this.checkCollisions();
    this.tick++;
  }

  private currentScrollSpeed(): number {
    const level = Math.floor(this.score / this.cfg.difficultyStep);
    return this.cfg.scrollSpeed * Math.pow(this.cfg.speedScale, level);
  }

  private currentGapH(): number {
    const level = Math.floor(this.score / this.cfg.difficultyStep);
    return Math.max(this.cfg.pipeGapMin, this.cfg.pipeGapBase - level * this.cfg.gapShrinkPerStep);
  }

  private spawnInitialPipes(): void {
    const startX = this.cfg.worldWidth + this.cfg.pipeWidth;
    const count = Math.ceil(this.cfg.worldWidth / this.cfg.pipeSpacing) + 1;
    for (let i = 0; i < count; i++) this.spawnPipe(startX + i * this.cfg.pipeSpacing);
  }

  private spawnPipe(x: number): void {
    const gapH = this.currentGapH();
    const minY = this.cfg.pipeMargin;
    const maxY = this.cfg.worldHeight - this.cfg.pipeMargin - gapH;
    const gapY = this.rng.nextFloat(minY, maxY);
    this.pipes.push({ id: this.nextPipeId++, x, gapY, gapH, passed: false });
  }

  private checkCollisions(): void {
    const r = this.cfg.birdRadius;
    if (this.birdY - r < 0 || this.birdY + r > this.cfg.worldHeight) {
      this.kill();
      return;
    }
    const bx = this.cfg.birdX;
    const by = this.birdY;
    for (const p of this.pipes) {
      if (p.x + this.cfg.pipeWidth < bx - r) continue;
      if (p.x > bx + r) break;
      if (this.circleRect(bx, by, r, p.x, 0, this.cfg.pipeWidth, p.gapY)) {
        this.kill();
        return;
      }
      const bottomY = p.gapY + p.gapH;
      if (this.circleRect(bx, by, r, p.x, bottomY, this.cfg.pipeWidth, this.cfg.worldHeight - bottomY)) {
        this.kill();
        return;
      }
    }
  }

  private circleRect(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
    const nx = Math.max(rx, Math.min(cx, rx + rw));
    const ny = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
  }

  private kill(): void {
    this.alive = false;
    this.dieTick = this.tick;
  }
}
