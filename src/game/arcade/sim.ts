import { Rng } from "../rng";
import { type ArcadeConfig } from "./config";

/**
 * ArcadeSim — the beating heart of Arcade Mode.
 *
 * This is a DELIBERATELY SEPARATE simulation from `src/game/sim.ts`. The core
 * `Sim` must stay byte-deterministic so server-side replay validation works for
 * casual/daily/ranked/challenge. Arcade is for-fun only: non-deterministic by
 * design (real-time effects, no replay), never submitted, never on a board.
 * Keeping it in its own class means we can add chaos here without any chance of
 * perturbing the scored loop.
 *
 * It is still SEEDED so tests can pin behaviour; the live loop just seeds it
 * from the wall clock.
 */

export type PowerUpKind = "shield" | "slow-time";

export interface ArcadePipe {
  id: number;
  x: number;
  gapY: number;
  gapH: number;
  passed: boolean;
}

export interface Coin {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

export interface Saw {
  id: number;
  x: number;
  /** Bob anchor (gap center it oscillates around). */
  baseY: number;
  /** Current resolved y (updated each step). */
  y: number;
  phase: number;
  /** Visual spin angle (radians), advanced each step. */
  spin: number;
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  kind: PowerUpKind;
  collected: boolean;
}

/** A short-lived floating label ("PERFECT", "+5") for juice. Visual only. */
export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  life: number;
}

export interface ArcadeSnapshot {
  score: number;
  coins: number;
  combo: number;
  multiplier: number;
  shield: boolean;
  slowTimeRemaining: number;
  alive: boolean;
}

export class ArcadeSim {
  readonly cfg: ArcadeConfig;
  readonly seed: number;
  private rng: Rng;

  tick = 0;
  birdY: number;
  birdVY = 0;
  prevBirdY: number;

  pipes: ArcadePipe[] = [];
  coins: Coin[] = [];
  saws: Saw[] = [];
  powerUps: PowerUp[] = [];
  floats: FloatText[] = [];
  prevPipeXs = new Map<number, number>();

  score = 0;
  coinBalance = 0;
  combo = 0;
  multiplier = 1;

  /** One free hit. Consumed instead of dying on the next lethal collision. */
  hasShield = false;
  /** Seconds remaining of the slow-time effect (0 = inactive). */
  slowTimeRemaining = 0;

  alive = true;
  dieTick = -1;
  startGrace = true;

  private nextPipeId = 0;
  private nextEntityId = 0;
  private lastGapCenter = -1;
  private nextCoinX: number;
  private pendingFlap = false;

  constructor(seed: number, cfg: ArcadeConfig) {
    this.seed = seed >>> 0;
    this.cfg = cfg;
    this.rng = new Rng(this.seed);
    this.birdY = cfg.birdStartY;
    this.prevBirdY = cfg.birdStartY;
    this.nextCoinX = cfg.worldWidth + cfg.coinSpacing;
    this.spawnInitialPipes();
  }

  /** Queue a flap; applied on the next step (mirrors the core loop's cadence). */
  flap(): void {
    this.pendingFlap = true;
  }

  snapshot(): ArcadeSnapshot {
    return {
      score: this.score,
      coins: this.coinBalance,
      combo: this.combo,
      multiplier: this.multiplier,
      shield: this.hasShield,
      slowTimeRemaining: this.slowTimeRemaining,
      alive: this.alive,
    };
  }

  step(): void {
    if (!this.alive) return;
    const baseDt = 1 / this.cfg.tickHz;
    // Slow-time scales the WORLD, not the input — the bird still responds
    // crisply while pipes/saws/coins crawl. Pure arcade juice.
    const timeScale = this.slowTimeRemaining > 0 ? this.cfg.slowTimeScale : 1;
    const dt = baseDt * timeScale;

    this.prevBirdY = this.birdY;
    this.prevPipeXs.clear();
    for (const p of this.pipes) this.prevPipeXs.set(p.id, p.x);

    if (this.pendingFlap) {
      this.pendingFlap = false;
      this.birdVY = -this.cfg.flapImpulse;
      this.startGrace = false;
    }

    if (this.startGrace) {
      this.birdVY = 0;
    } else {
      // Gravity uses the unscaled dt so the bird's arc feels the same; only
      // its forward progress through the world slows under slow-time.
      this.birdVY += this.cfg.gravity * baseDt;
      this.birdY += this.birdVY * baseDt;
    }

    // World displacement this step (world px). `dt` already folds in slow-time,
    // so pipes and every other entity share the exact same scaled motion.
    const speed = this.currentScrollSpeed();
    const dx = speed * dt;
    for (const p of this.pipes) p.x -= dx;
    this.advanceEntities(dx);

    // Cull + spawn pipes.
    while (this.pipes.length > 0 && this.pipes[0].x + this.cfg.pipeWidth < 0) {
      this.pipes.shift();
    }
    const lastPipe = this.pipes[this.pipes.length - 1];
    if (!lastPipe || lastPipe.x < this.cfg.worldWidth - this.cfg.pipeSpacing) {
      this.spawnPipe(lastPipe ? lastPipe.x + this.cfg.pipeSpacing : this.cfg.worldWidth);
    }

    // Score + perfect-pass combo.
    for (const p of this.pipes) {
      if (!p.passed && p.x + this.cfg.pipeWidth < this.cfg.birdX) {
        p.passed = true;
        this.onPipePassed(p);
      }
    }

    this.collectCoins();
    this.collectPowerUps();

    if (this.slowTimeRemaining > 0) {
      this.slowTimeRemaining = Math.max(0, this.slowTimeRemaining - baseDt);
    }
    this.tickFloats(baseDt);

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

  /** Move every non-pipe entity left by `dx` world px (already time-scaled). */
  private advanceEntities(dx: number): void {
    // Saw bob/spin advance is tied to dx so slow-time also slows their motion.
    const motion = dx / (this.cfg.scrollSpeed / this.cfg.tickHz);
    for (const c of this.coins) c.x -= dx;
    for (const pu of this.powerUps) pu.x -= dx;
    for (const s of this.saws) {
      s.x -= dx;
      s.phase += (this.cfg.sawBobSpeed / this.cfg.tickHz) * motion;
      s.y = s.baseY + Math.sin(s.phase) * this.cfg.sawBobAmplitude;
      s.spin += 0.35 * motion;
    }
    // Cull off-screen entities.
    this.coins = this.coins.filter((c) => c.x + this.cfg.coinRadius > 0);
    this.powerUps = this.powerUps.filter((p) => p.x + this.cfg.powerUpRadius > 0);
    this.saws = this.saws.filter((s) => s.x + this.cfg.sawRadius > 0);

    // Spawn a steady trickle of coins across the world, biased into open sky.
    while (this.nextCoinX < this.cfg.worldWidth) {
      this.spawnCoin(this.cfg.worldWidth + this.cfg.coinRadius);
      this.nextCoinX = this.cfg.worldWidth + this.cfg.coinSpacing;
    }
    this.nextCoinX -= dx;
  }

  private spawnInitialPipes(): void {
    const startX = this.cfg.worldWidth + this.cfg.pipeWidth;
    const count = Math.ceil(this.cfg.worldWidth / this.cfg.pipeSpacing) + 1;
    for (let i = 0; i < count; i++) this.spawnPipe(startX + i * this.cfg.pipeSpacing);
  }

  private spawnPipe(x: number): void {
    const baseGap = this.currentGapH();
    const jitter = this.rng.nextFloat(-this.cfg.gapJitter, this.cfg.gapJitter);
    const gapH = Math.max(this.cfg.pipeGapMin, baseGap + jitter);
    const minY = this.cfg.pipeMargin;
    const maxY = this.cfg.worldHeight - this.cfg.pipeMargin - gapH;
    const center = (lo: number, hi: number, c: number) => Math.max(lo, Math.min(hi, c));
    let gapTop: number;
    const fullJump = this.lastGapCenter < 0 || this.rng.nextInt(0, this.cfg.maxGapJumpRarity) === 0;
    if (fullJump) {
      gapTop = this.rng.nextFloat(minY, maxY);
    } else {
      const step = this.cfg.maxGapStep;
      const targetCenter = this.lastGapCenter + this.rng.nextFloat(-step, step);
      const clampedCenter = center(minY + gapH / 2, maxY + gapH / 2, targetCenter);
      gapTop = clampedCenter - gapH / 2;
    }
    const gapY = center(minY, maxY, gapTop);
    const gapCenter = gapY + gapH / 2;
    this.lastGapCenter = gapCenter;
    this.pipes.push({ id: this.nextPipeId++, x, gapY, gapH, passed: false });

    // Arcade extras ride in with the pipe so they cluster around the action.
    if (this.rng.nextInt(0, this.cfg.sawRarity) === 0) {
      this.spawnSaw(x + this.cfg.pipeSpacing / 2, gapCenter);
    }
    if (this.rng.nextInt(0, this.cfg.powerUpRarity) === 0) {
      const kind: PowerUpKind = this.rng.next() < 0.5 ? "shield" : "slow-time";
      this.powerUps.push({
        id: this.nextEntityId++,
        x: x + this.cfg.pipeWidth / 2,
        y: gapCenter,
        kind,
        collected: false,
      });
    }
  }

  private spawnSaw(x: number, gapCenter: number): void {
    this.saws.push({
      id: this.nextEntityId++,
      x,
      baseY: gapCenter,
      y: gapCenter,
      phase: this.rng.nextFloat(0, Math.PI * 2),
      spin: 0,
    });
  }

  private spawnCoin(x: number): void {
    const margin = this.cfg.pipeMargin;
    const y = this.rng.nextFloat(margin, this.cfg.worldHeight - margin);
    this.coins.push({ id: this.nextEntityId++, x, y, collected: false });
  }

  private onPipePassed(p: ArcadePipe): void {
    // Base point for the pass.
    let gained = 1;
    const edgeDist = Math.min(
      Math.abs(this.birdY - p.gapY),
      Math.abs(p.gapY + p.gapH - this.birdY),
    );
    if (edgeDist <= this.cfg.perfectPassWindow) {
      // Threaded the needle — bump combo + multiplier, award bonus.
      this.combo++;
      this.multiplier = Math.min(this.cfg.maxMultiplier, 1 + Math.floor(this.combo / 2));
      gained += 1;
      this.spawnFloat(this.cfg.birdX, this.birdY - 26, `PERFECT x${this.multiplier}`, "#ffe082");
    } else {
      // Clean but not close — combo decays gently rather than hard-resetting.
      this.combo = Math.max(0, this.combo - 1);
      this.multiplier = Math.min(this.cfg.maxMultiplier, 1 + Math.floor(this.combo / 2));
    }
    this.score += gained * this.multiplier;
  }

  private collectCoins(): void {
    const r = this.cfg.birdRadius + this.cfg.coinRadius;
    for (const c of this.coins) {
      if (c.collected) continue;
      if (this.dist2(this.cfg.birdX, this.birdY, c.x, c.y) <= r * r) {
        c.collected = true;
        this.coinBalance++;
        this.score += this.cfg.coinScore * this.multiplier;
        this.spawnFloat(c.x, c.y, `+${this.cfg.coinScore * this.multiplier}`, "#ffd54f");
      }
    }
    this.coins = this.coins.filter((c) => !c.collected);
  }

  private collectPowerUps(): void {
    const r = this.cfg.birdRadius + this.cfg.powerUpRadius;
    for (const pu of this.powerUps) {
      if (pu.collected) continue;
      if (this.dist2(this.cfg.birdX, this.birdY, pu.x, pu.y) <= r * r) {
        pu.collected = true;
        this.applyPowerUp(pu.kind);
      }
    }
    this.powerUps = this.powerUps.filter((p) => !p.collected);
  }

  private applyPowerUp(kind: PowerUpKind): void {
    if (kind === "shield") {
      this.hasShield = true;
      this.spawnFloat(this.cfg.birdX, this.birdY - 26, "SHIELD", "#4fc3f7");
    } else {
      this.slowTimeRemaining = this.cfg.slowTimeDuration;
      this.spawnFloat(this.cfg.birdX, this.birdY - 26, "SLOW-MO", "#b39ddb");
    }
  }

  private checkCollisions(): void {
    const r = this.cfg.birdRadius;
    // World bounds.
    if (this.birdY - r < 0 || this.birdY + r > this.cfg.worldHeight) {
      if (!this.consumeShield()) {
        this.kill();
        return;
      }
      // Bounce back into bounds so the shield save reads cleanly.
      this.birdY = Math.max(r, Math.min(this.cfg.worldHeight - r, this.birdY));
      this.birdVY = 0;
    }

    const bx = this.cfg.birdX;
    const by = this.birdY;

    for (const p of this.pipes) {
      if (p.x + this.cfg.pipeWidth < bx - r) continue;
      if (p.x > bx + r) break;
      const top = this.circleRect(bx, by, r, p.x, 0, this.cfg.pipeWidth, p.gapY);
      const bottomY = p.gapY + p.gapH;
      const bottom = this.circleRect(bx, by, r, p.x, bottomY, this.cfg.pipeWidth, this.cfg.worldHeight - bottomY);
      if (top || bottom) {
        if (!this.consumeShield()) {
          this.kill();
          return;
        }
        // Nudge the bird to the gap center so it survives the frame.
        this.birdY = p.gapY + p.gapH / 2;
        this.birdVY = 0;
        return;
      }
    }

    for (const s of this.saws) {
      const rr = r + this.cfg.sawRadius;
      if (this.dist2(bx, by, s.x, s.y) <= rr * rr) {
        if (!this.consumeShield()) {
          this.kill();
          return;
        }
        // Shield pops the saw so we don't instantly re-collide.
        this.saws = this.saws.filter((o) => o.id !== s.id);
        return;
      }
    }
  }

  /** Spend the shield if held; returns true if a hit was absorbed. */
  private consumeShield(): boolean {
    if (!this.hasShield) return false;
    this.hasShield = false;
    this.combo = 0;
    this.multiplier = 1;
    this.spawnFloat(this.cfg.birdX, this.birdY - 26, "BLOCKED!", "#4fc3f7");
    return true;
  }

  private spawnFloat(x: number, y: number, text: string, color: string): void {
    this.floats.push({ id: this.nextEntityId++, x, y, text, color, age: 0, life: 0.9 });
  }

  private tickFloats(dt: number): void {
    for (const f of this.floats) {
      f.age += dt;
      f.y -= 22 * dt;
    }
    this.floats = this.floats.filter((f) => f.age < f.life);
  }

  private dist2(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
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
