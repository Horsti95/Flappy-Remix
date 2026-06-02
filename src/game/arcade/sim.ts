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

export type PowerUpKind =
  | "shield"
  | "slow-time"
  | "magnet"
  | "mini"
  | "second-life"
  | "gravity-flip"
  | "rocket";

/** Spawn weights — common defensive pickups, rarer flashy ones. */
const POWERUP_WEIGHTS: ReadonlyArray<readonly [PowerUpKind, number]> = [
  ["shield", 5],
  ["slow-time", 4],
  ["magnet", 4],
  ["mini", 3],
  ["second-life", 2],
  ["gravity-flip", 2],
  ["rocket", 2],
];

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
  secondLife: boolean;
  slowTimeRemaining: number;
  magnetRemaining: number;
  miniRemaining: number;
  gravityFlipRemaining: number;
  rocketRemaining: number;
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
  bestCombo = 0;
  multiplier = 1;
  /** Pipes cleared — drives DIFFICULTY (kept distinct from the flashy score,
   *  which coins/combos inflate, so speed ramps with distance not pickups). */
  pipesCleared = 0;

  // Active effects.
  hasShield = false;
  hasSecondLife = false;
  slowTimeRemaining = 0;
  magnetRemaining = 0;
  miniRemaining = 0;
  gravityFlipRemaining = 0;
  rocketRemaining = 0;
  /** Post-revive grace where lethal hits are ignored. */
  invulnRemaining = 0;

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
    this.lastGapCenter = cfg.birdStartY;
    this.nextCoinX = cfg.worldWidth + cfg.coinSpacing;
    this.spawnInitialPipes();
  }

  /** Queue a flap; applied on the next step (mirrors the core loop's cadence). */
  flap(): void {
    this.pendingFlap = true;
  }

  /** Collision/visual radius — shrinks while the mini power-up is active. */
  effectiveRadius(): number {
    return this.cfg.birdRadius * (this.miniRemaining > 0 ? this.cfg.miniScale : 1);
  }

  /** +1 while gravity is normal, -1 while flipped. */
  gravityDir(): number {
    return this.gravityFlipRemaining > 0 ? -1 : 1;
  }

  snapshot(): ArcadeSnapshot {
    return {
      score: this.score,
      coins: this.coinBalance,
      combo: this.combo,
      multiplier: this.multiplier,
      shield: this.hasShield,
      secondLife: this.hasSecondLife,
      slowTimeRemaining: this.slowTimeRemaining,
      magnetRemaining: this.magnetRemaining,
      miniRemaining: this.miniRemaining,
      gravityFlipRemaining: this.gravityFlipRemaining,
      rocketRemaining: this.rocketRemaining,
      alive: this.alive,
    };
  }

  step(): void {
    if (!this.alive) return;
    const baseDt = 1 / this.cfg.tickHz;
    // Slow-time is true bullet-time: it scales the WORLD *and* the bird equally,
    // so the player gets more reaction time (flap impulses, being velocities,
    // still land instantly). Scaling only the world would make slow-time HARDER
    // vertically — the opposite of the intent.
    const timeScale = this.slowTimeRemaining > 0 ? this.cfg.slowTimeScale : 1;
    const dt = baseDt * timeScale;

    this.prevBirdY = this.birdY;
    this.prevPipeXs.clear();
    for (const p of this.pipes) this.prevPipeXs.set(p.id, p.x);

    const dir = this.gravityDir();
    if (this.pendingFlap) {
      this.pendingFlap = false;
      // Flap pushes "away from the floor" — flips with gravity so the control
      // stays intuitive (tap to escape whichever way you're falling).
      this.birdVY = -this.cfg.flapImpulse * dir;
      this.startGrace = false;
    }

    if (this.startGrace) {
      this.birdVY = 0;
    } else if (this.rocketRemaining > 0) {
      // Rocket: steady thrust toward the ceiling, capped, gravity-independent.
      this.birdVY -= this.cfg.rocketThrust * dt;
      if (this.birdVY < -this.cfg.rocketMaxClimb) this.birdVY = -this.cfg.rocketMaxClimb;
      this.birdY += this.birdVY * dt;
    } else {
      this.birdVY += this.cfg.gravity * dir * dt;
      this.birdY += this.birdVY * dt;
    }

    // World displacement this step (world px). `dt` already folds in slow-time,
    // so pipes and every other entity share the exact same scaled motion.
    const dx = this.currentScrollSpeed() * dt;
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
        this.pipesCleared++;
        this.onPipePassed(p);
      }
    }

    if (this.magnetRemaining > 0) this.applyMagnet(baseDt);
    this.collectCoins();
    this.collectPowerUps();

    this.decayTimers(baseDt);
    this.tickFloats(baseDt);

    this.checkCollisions();
    this.tick++;
  }

  private decayTimers(dt: number): void {
    this.slowTimeRemaining = Math.max(0, this.slowTimeRemaining - dt);
    this.magnetRemaining = Math.max(0, this.magnetRemaining - dt);
    this.miniRemaining = Math.max(0, this.miniRemaining - dt);
    this.gravityFlipRemaining = Math.max(0, this.gravityFlipRemaining - dt);
    this.rocketRemaining = Math.max(0, this.rocketRemaining - dt);
    this.invulnRemaining = Math.max(0, this.invulnRemaining - dt);
  }

  private currentScrollSpeed(): number {
    const level = Math.floor(this.pipesCleared / this.cfg.difficultyStep);
    return this.cfg.scrollSpeed * Math.pow(this.cfg.speedScale, level);
  }

  private currentGapH(): number {
    const level = Math.floor(this.pipesCleared / this.cfg.difficultyStep);
    return Math.max(this.cfg.pipeGapMin, this.cfg.pipeGapBase - level * this.cfg.gapShrinkPerStep);
  }

  /** Move every non-pipe entity left by `dx` world px (already time-scaled). */
  private advanceEntities(dx: number): void {
    // Per-step "motion" is 1 at base speed/no-slow, so saw bob/spin scale with
    // both difficulty speed-up and slow-time.
    const motion = dx / (this.cfg.scrollSpeed / this.cfg.tickHz);
    for (const c of this.coins) c.x -= dx;
    for (const pu of this.powerUps) pu.x -= dx;
    for (const s of this.saws) {
      s.x -= dx;
      s.phase += (this.cfg.sawBobSpeed / this.cfg.tickHz) * motion;
      s.y = s.baseY + Math.sin(s.phase) * this.cfg.sawBobAmplitude;
      s.spin += 0.35 * motion;
    }
    this.coins = this.coins.filter((c) => c.x + this.cfg.coinRadius > 0);
    this.powerUps = this.powerUps.filter((p) => p.x + this.cfg.powerUpRadius > 0);
    this.saws = this.saws.filter((s) => s.x + this.cfg.sawRadius > 0);

    // Steady coin trickle, biased onto the flight path (around the last gap)
    // so coins are actually reachable rather than buried inside pipe bodies.
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
      this.powerUps.push({
        id: this.nextEntityId++,
        x: x + this.cfg.pipeWidth / 2,
        y: gapCenter,
        kind: this.pickPowerUp(),
        collected: false,
      });
    }
  }

  private pickPowerUp(): PowerUpKind {
    const total = POWERUP_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let roll = this.rng.nextFloat(0, total);
    for (const [kind, w] of POWERUP_WEIGHTS) {
      roll -= w;
      if (roll < 0) return kind;
    }
    return "shield";
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
    const spread = this.rng.nextFloat(-this.cfg.coinSpread, this.cfg.coinSpread);
    const y = Math.max(margin, Math.min(this.cfg.worldHeight - margin, this.lastGapCenter + spread));
    this.coins.push({ id: this.nextEntityId++, x, y, collected: false });
  }

  private onPipePassed(p: ArcadePipe): void {
    let gained = 1;
    const edgeDist = Math.min(
      Math.abs(this.birdY - p.gapY),
      Math.abs(p.gapY + p.gapH - this.birdY),
    );
    if (edgeDist <= this.cfg.perfectPassWindow) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
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

  private applyMagnet(dt: number): void {
    const range2 = this.cfg.magnetRange * this.cfg.magnetRange;
    const pull = this.cfg.magnetPull * dt;
    for (const c of this.coins) {
      const dx = this.cfg.birdX - c.x;
      const dy = this.birdY - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > range2 || d2 < 1) continue;
      const d = Math.sqrt(d2);
      c.x += (dx / d) * pull;
      c.y += (dy / d) * pull;
    }
  }

  private collectCoins(): void {
    const r = this.effectiveRadius() + this.cfg.coinRadius;
    const r2 = r * r;
    for (const c of this.coins) {
      if (c.collected) continue;
      if (this.dist2(this.cfg.birdX, this.birdY, c.x, c.y) <= r2) {
        c.collected = true;
        this.coinBalance++;
        this.score += this.cfg.coinScore * this.multiplier;
        this.spawnFloat(c.x, c.y, `+${this.cfg.coinScore * this.multiplier}`, "#ffd54f");
      }
    }
    this.coins = this.coins.filter((c) => !c.collected);
  }

  private collectPowerUps(): void {
    const r = this.effectiveRadius() + this.cfg.powerUpRadius;
    const r2 = r * r;
    for (const pu of this.powerUps) {
      if (pu.collected) continue;
      if (this.dist2(this.cfg.birdX, this.birdY, pu.x, pu.y) <= r2) {
        pu.collected = true;
        this.applyPowerUp(pu.kind);
      }
    }
    this.powerUps = this.powerUps.filter((p) => !p.collected);
  }

  private applyPowerUp(kind: PowerUpKind): void {
    const x = this.cfg.birdX;
    const y = this.birdY - 26;
    switch (kind) {
      case "shield":
        this.hasShield = true;
        this.spawnFloat(x, y, "SHIELD", "#4fc3f7");
        break;
      case "second-life":
        this.hasSecondLife = true;
        this.spawnFloat(x, y, "1-UP", "#69f0ae");
        break;
      case "slow-time":
        this.slowTimeRemaining = this.cfg.slowTimeDuration;
        this.spawnFloat(x, y, "SLOW-MO", "#b39ddb");
        break;
      case "magnet":
        this.magnetRemaining = this.cfg.magnetDuration;
        this.spawnFloat(x, y, "MAGNET", "#ff8a65");
        break;
      case "mini":
        this.miniRemaining = this.cfg.miniDuration;
        this.spawnFloat(x, y, "MINI", "#81d4fa");
        break;
      case "gravity-flip":
        this.gravityFlipRemaining = this.cfg.gravityFlipDuration;
        this.spawnFloat(x, y, "FLIP!", "#f48fb1");
        break;
      case "rocket":
        this.rocketRemaining = this.cfg.rocketDuration;
        this.birdVY = Math.min(this.birdVY, 0);
        this.spawnFloat(x, y, "ROCKET", "#ffd54f");
        break;
    }
  }

  private checkCollisions(): void {
    const r = this.effectiveRadius();
    const bx = this.cfg.birdX;
    const by = this.birdY;

    // During post-revive grace, clamp inside the world but ignore hazards.
    if (this.invulnRemaining > 0) {
      if (by - r < 0) {
        this.birdY = r;
        if (this.birdVY < 0) this.birdVY = 0;
      } else if (by + r > this.cfg.worldHeight) {
        this.birdY = this.cfg.worldHeight - r;
        if (this.birdVY > 0) this.birdVY = 0;
      }
      return;
    }

    // World bounds.
    if (by - r < 0 || by + r > this.cfg.worldHeight) {
      if (this.resolveHit()) {
        this.birdY = Math.max(r, Math.min(this.cfg.worldHeight - r, this.birdY));
        this.birdVY = 0;
      }
      return;
    }

    // Pipes.
    for (const p of this.pipes) {
      if (p.x + this.cfg.pipeWidth < bx - r) continue;
      if (p.x > bx + r) break;
      const top = this.circleRect(bx, by, r, p.x, 0, this.cfg.pipeWidth, p.gapY);
      const bottomY = p.gapY + p.gapH;
      const bottom = this.circleRect(bx, by, r, p.x, bottomY, this.cfg.pipeWidth, this.cfg.worldHeight - bottomY);
      if (top || bottom) {
        if (this.resolveHit()) {
          this.birdY = p.gapY + p.gapH / 2;
          this.birdVY = 0;
        }
        return;
      }
    }

    // Saws.
    for (const s of this.saws) {
      const rr = r + this.cfg.sawRadius;
      if (this.dist2(bx, by, s.x, s.y) <= rr * rr) {
        if (this.resolveHit()) {
          // Pop the saw so the save doesn't instantly re-collide.
          this.saws = this.saws.filter((o) => o.id !== s.id);
        }
        return;
      }
    }
  }

  /**
   * Resolve a lethal collision. Returns true if the bird SURVIVED (caller then
   * repositions it to safety), false if it died. Priority: shield → second-life
   * → death. Either save resets the combo.
   */
  private resolveHit(): boolean {
    if (this.hasShield) {
      this.hasShield = false;
      this.resetCombo();
      this.spawnFloat(this.cfg.birdX, this.birdY - 26, "BLOCKED!", "#4fc3f7");
      return true;
    }
    if (this.hasSecondLife) {
      this.hasSecondLife = false;
      this.resetCombo();
      this.birdY = this.cfg.worldHeight / 2;
      this.birdVY = 0;
      this.invulnRemaining = this.cfg.reviveInvuln;
      this.gravityFlipRemaining = 0;
      this.spawnFloat(this.cfg.birdX, this.birdY - 26, "REVIVE!", "#69f0ae");
      return true;
    }
    this.kill();
    return false;
  }

  private resetCombo(): void {
    this.combo = 0;
    this.multiplier = 1;
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
