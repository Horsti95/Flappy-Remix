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
  | "giant"
  | "second-life"
  | "gravity-flip"
  | "rocket"
  | "ghost"
  | "frenzy";

/** Spawn weights — common defensive pickups, rarer flashy ones. */
const POWERUP_WEIGHTS: ReadonlyArray<readonly [PowerUpKind, number]> = [
  ["shield", 5],
  ["slow-time", 4],
  ["magnet", 4],
  ["mini", 3],
  ["giant", 2],
  ["second-life", 2],
  ["gravity-flip", 2],
  ["rocket", 2],
  ["ghost", 2],
  ["frenzy", 3],
];

export type ArcadeEvent = "coin-rush" | "low-gravity" | "saw-storm" | "portal-storm";

const EVENTS: readonly ArcadeEvent[] = ["coin-rush", "low-gravity", "saw-storm", "portal-storm"];

export const EVENT_LABEL: Record<ArcadeEvent, string> = {
  "coin-rush": "COIN RUSH",
  "low-gravity": "LOW GRAVITY",
  "saw-storm": "SAW STORM",
  "portal-storm": "PORTAL STORM",
};

/** A solid vertical span of a pillar (world-space y range). */
export interface Segment {
  y0: number;
  y1: number;
}

export interface ArcadePipe {
  id: number;
  x: number;
  /** Live top of the primary gap (updated each step for movers). */
  gapY: number;
  gapH: number;
  /** Bob anchor for moving pillars; equals the spawn gapY for static ones. */
  baseGapY: number;
  /** 0 = static pillar; >0 = moving pillar amplitude (world px). */
  bobAmp: number;
  bobPhase: number;
  /** A double-gate's dividing bar (world-space), or null for a plain pipe. */
  midBar: Segment | null;
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
  baseY: number;
  y: number;
  phase: number;
  spin: number;
}

export interface PowerUp {
  id: number;
  x: number;
  y: number;
  kind: PowerUpKind;
  collected: boolean;
}

export interface Portal {
  id: number;
  pairId: number;
  x: number;
  y: number;
  used: boolean;
  hue: string;
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
  portals: Portal[] = [];
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
  giantRemaining = 0;
  gravityFlipRemaining = 0;
  rocketRemaining = 0;
  ghostRemaining = 0;
  frenzyRemaining = 0;
  /** Post-revive / post-warp grace where lethal hits are ignored. */
  invulnRemaining = 0;

  // Special events.
  activeEvent: ArcadeEvent | null = null;
  eventRemaining = 0;
  private nextEventIn: number;

  alive = true;
  dieTick = -1;
  startGrace = true;

  private nextPipeId = 0;
  private nextEntityId = 0;
  private nextPortalPair = 0;
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
    this.nextEventIn = cfg.eventFirstDelay;
    this.spawnInitialPipes();
  }

  /** Queue a flap; applied on the next step (mirrors the core loop's cadence). */
  flap(): void {
    this.pendingFlap = true;
  }

  /** Collision/visual radius — shrinks with mini, grows with giant. */
  effectiveRadius(): number {
    let r = this.cfg.birdRadius;
    if (this.giantRemaining > 0) r *= this.cfg.giantScale;
    else if (this.miniRemaining > 0) r *= this.cfg.miniScale;
    return r;
  }

  /** +1 while gravity is normal, -1 while flipped. */
  gravityDir(): number {
    return this.gravityFlipRemaining > 0 ? -1 : 1;
  }

  /** Solid spans of a pillar: top, bottom, and (double-gate) the mid bar. */
  solidSegments(p: ArcadePipe): Segment[] {
    const segs: Segment[] = [
      { y0: 0, y1: p.gapY },
      { y0: p.gapY + p.gapH, y1: this.cfg.worldHeight },
    ];
    if (p.midBar) segs.push(p.midBar);
    return segs;
  }

  snapshot(): ArcadeSnapshot {
    return {
      score: this.score,
      coins: this.coinBalance,
      combo: this.combo,
      multiplier: this.multiplier,
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
    const gravity = this.cfg.gravity * (this.activeEvent === "low-gravity" ? this.cfg.lowGravityScale : 1);
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
      this.birdVY -= this.cfg.rocketThrust * dt;
      if (this.birdVY < -this.cfg.rocketMaxClimb) this.birdVY = -this.cfg.rocketMaxClimb;
      this.birdY += this.birdVY * dt;
    } else {
      this.birdVY += gravity * dir * dt;
      this.birdY += this.birdVY * dt;
    }

    // World displacement this step (world px). `dt` already folds in slow-time,
    // so pipes and every other entity share the exact same scaled motion.
    const dx = this.currentScrollSpeed() * dt;
    for (const p of this.pipes) {
      p.x -= dx;
      if (p.bobAmp > 0) {
        p.bobPhase += (this.cfg.pipeBobSpeed * dt);
        this.updateMovingPipe(p);
      }
    }
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

    this.checkPortals();
    if (this.magnetRemaining > 0) this.applyMagnet(baseDt);
    this.collectCoins();
    this.collectPowerUps();

    this.tickEvents(baseDt);
    this.decayTimers(baseDt);
    this.tickFloats(baseDt);

    this.checkCollisions();
    this.tick++;
  }

  private decayTimers(dt: number): void {
    this.slowTimeRemaining = Math.max(0, this.slowTimeRemaining - dt);
    this.magnetRemaining = Math.max(0, this.magnetRemaining - dt);
    this.miniRemaining = Math.max(0, this.miniRemaining - dt);
    this.giantRemaining = Math.max(0, this.giantRemaining - dt);
    this.gravityFlipRemaining = Math.max(0, this.gravityFlipRemaining - dt);
    this.rocketRemaining = Math.max(0, this.rocketRemaining - dt);
    this.ghostRemaining = Math.max(0, this.ghostRemaining - dt);
    this.frenzyRemaining = Math.max(0, this.frenzyRemaining - dt);
    this.invulnRemaining = Math.max(0, this.invulnRemaining - dt);
  }

  private tickEvents(dt: number): void {
    if (this.activeEvent) {
      this.eventRemaining -= dt;
      if (this.eventRemaining <= 0) {
        this.activeEvent = null;
        this.nextEventIn = this.rng.nextFloat(this.cfg.eventIntervalMin, this.cfg.eventIntervalMax);
      }
      return;
    }
    this.nextEventIn -= dt;
    if (this.nextEventIn <= 0) {
      this.activeEvent = EVENTS[this.rng.nextInt(0, EVENTS.length)];
      this.eventRemaining = this.cfg.eventDuration;
      this.spawnFloat(this.cfg.worldWidth / 2, this.cfg.worldHeight * 0.4, `${EVENT_LABEL[this.activeEvent]}!`, "#fff");
    }
  }

  private currentScrollSpeed(): number {
    const level = Math.floor(this.pipesCleared / this.cfg.difficultyStep);
    return this.cfg.scrollSpeed * Math.pow(this.cfg.speedScale, level);
  }

  private currentGapH(): number {
    const level = Math.floor(this.pipesCleared / this.cfg.difficultyStep);
    return Math.max(this.cfg.pipeGapMin, this.cfg.pipeGapBase - level * this.cfg.gapShrinkPerStep);
  }

  /** Recompute a moving pillar's live gapY (and mid bar) from its bob phase. */
  private updateMovingPipe(p: ArcadePipe): void {
    const minY = this.cfg.pipeMargin;
    const maxY = this.cfg.worldHeight - this.cfg.pipeMargin - p.gapH;
    const raw = p.baseGapY + Math.sin(p.bobPhase) * p.bobAmp;
    p.gapY = Math.max(minY, Math.min(maxY, raw));
    if (p.midBar) {
      const h = p.midBar.y1 - p.midBar.y0;
      const y0 = p.gapY + p.gapH / 2 - h / 2;
      p.midBar = { y0, y1: y0 + h };
    }
  }

  /** Move every non-pipe entity left by `dx` world px (already time-scaled). */
  private advanceEntities(dx: number): void {
    const motion = dx / (this.cfg.scrollSpeed / this.cfg.tickHz);
    for (const c of this.coins) c.x -= dx;
    for (const pu of this.powerUps) pu.x -= dx;
    for (const pt of this.portals) pt.x -= dx;
    for (const s of this.saws) {
      s.x -= dx;
      s.phase += (this.cfg.sawBobSpeed / this.cfg.tickHz) * motion;
      s.y = s.baseY + Math.sin(s.phase) * this.cfg.sawBobAmplitude;
      s.spin += 0.35 * motion;
    }
    this.coins = this.coins.filter((c) => c.x + this.cfg.coinRadius > 0);
    this.powerUps = this.powerUps.filter((p) => p.x + this.cfg.powerUpRadius > 0);
    this.portals = this.portals.filter((p) => p.x + this.cfg.portalRadius > 0);
    this.saws = this.saws.filter((s) => s.x + this.cfg.sawRadius > 0);

    // Steady coin trickle, biased onto the flight path (Coin Rush packs more in).
    const spacing = this.cfg.coinSpacing * (this.activeEvent === "coin-rush" ? this.cfg.coinRushSpacingScale : 1);
    while (this.nextCoinX < this.cfg.worldWidth) {
      this.spawnCoin(this.cfg.worldWidth + this.cfg.coinRadius);
      this.nextCoinX = this.cfg.worldWidth + spacing;
    }
    this.nextCoinX -= dx;
  }

  private spawnInitialPipes(): void {
    const startX = this.cfg.worldWidth + this.cfg.pipeWidth;
    const count = Math.ceil(this.cfg.worldWidth / this.cfg.pipeSpacing) + 1;
    for (let i = 0; i < count; i++) this.spawnPipe(startX + i * this.cfg.pipeSpacing);
  }

  private spawnPipe(x: number): void {
    // Pick a pillar variant. Double-gate and moving are mutually exclusive so
    // a split gate stays readable. The opening grace pipes stay plain.
    const isDoubleGate = this.tick > 0 && this.rng.nextInt(0, this.cfg.doubleGateRarity) === 0;
    const isMoving = !isDoubleGate && this.tick > 0 && this.rng.nextInt(0, this.cfg.movingPipeRarity) === 0;

    const baseGap = this.currentGapH();
    const jitter = this.rng.nextFloat(-this.cfg.gapJitter, this.cfg.gapJitter);
    let gapH = Math.max(this.cfg.pipeGapMin, baseGap + jitter);
    if (isDoubleGate) gapH = gapH * this.cfg.doubleGateGapScale;

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

    let midBar: Segment | null = null;
    if (isDoubleGate) {
      const h = this.cfg.doubleGateBarH;
      const y0 = gapCenter - h / 2;
      midBar = { y0, y1: y0 + h };
    }

    const pipe: ArcadePipe = {
      id: this.nextPipeId++,
      x,
      gapY,
      gapH,
      baseGapY: gapY,
      bobAmp: isMoving ? this.cfg.pipeBobAmplitude : 0,
      bobPhase: isMoving ? this.rng.nextFloat(0, Math.PI * 2) : 0,
      midBar,
      passed: false,
    };
    if (pipe.bobAmp > 0) this.updateMovingPipe(pipe);
    this.pipes.push(pipe);

    // Arcade extras ride in with the pipe so they cluster around the action.
    const sawRarity = this.activeEvent === "saw-storm" ? this.cfg.sawStormRarity : this.cfg.sawRarity;
    if (this.tick > 0 && this.rng.nextInt(0, sawRarity) === 0) {
      this.spawnSaw(x + this.cfg.pipeSpacing / 2, gapCenter);
    }
    const portalRarity = this.activeEvent === "portal-storm" ? this.cfg.portalStormRarity : this.cfg.portalRarity;
    if (this.tick > 0 && this.rng.nextInt(0, portalRarity) === 0) {
      this.spawnPortalPair(x, gapCenter);
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

  private spawnPortalPair(x: number, entryY: number): void {
    const pairId = this.nextPortalPair++;
    const hue = `hsl(${this.rng.nextInt(0, 360)},85%,62%)`;
    const margin = this.cfg.pipeMargin;
    const exitY = this.rng.nextFloat(margin, this.cfg.worldHeight - margin);
    // Entry rides just past the pipe; exit is further down the track.
    this.portals.push({ id: this.nextEntityId++, pairId, x: x + this.cfg.pipeWidth + 30, y: entryY, used: false, hue });
    this.portals.push({ id: this.nextEntityId++, pairId, x: x + this.cfg.pipeSpacing * 1.6, y: exitY, used: false, hue });
  }

  private spawnCoin(x: number): void {
    const margin = this.cfg.pipeMargin;
    const spread = this.rng.nextFloat(-this.cfg.coinSpread, this.cfg.coinSpread);
    const y = Math.max(margin, Math.min(this.cfg.worldHeight - margin, this.lastGapCenter + spread));
    this.coins.push({ id: this.nextEntityId++, x, y, collected: false });
  }

  private onPipePassed(p: ArcadePipe): void {
    let gained = 1;
    const edgeDist = this.nearestEdgeDist(p, this.birdY);
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
    this.addScore(gained * this.multiplier);
  }

  /** Nearest distance from y to any solid edge of the pillar (rewards threading
   *  next to a wall or the double-gate bar). */
  private nearestEdgeDist(p: ArcadePipe, y: number): number {
    let best = Infinity;
    for (const seg of this.solidSegments(p)) {
      best = Math.min(best, Math.abs(y - seg.y0), Math.abs(y - seg.y1));
    }
    return best;
  }

  private addScore(n: number): void {
    this.score += n * (this.frenzyRemaining > 0 ? 2 : 1);
  }

  private checkPortals(): void {
    const r = this.effectiveRadius();
    for (const pt of this.portals) {
      if (pt.used) continue;
      const rr = r + this.cfg.portalRadius;
      if (this.dist2(this.cfg.birdX, this.birdY, pt.x, pt.y) > rr * rr) continue;
      const partner = this.portals.find((o) => o.pairId === pt.pairId && o.id !== pt.id);
      if (!partner) continue;
      // Warp vertically to the partner's mouth; brief grace so we don't clip.
      this.birdY = partner.y;
      this.birdVY = 0;
      pt.used = true;
      partner.used = true;
      this.invulnRemaining = Math.max(this.invulnRemaining, this.cfg.portalGrace);
      this.spawnFloat(this.cfg.birdX, this.birdY - 26, "WARP", pt.hue);
      break;
    }
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
        const gain = this.cfg.coinScore * this.multiplier;
        this.addScore(gain);
        this.spawnFloat(c.x, c.y, `+${gain * (this.frenzyRemaining > 0 ? 2 : 1)}`, "#ffd54f");
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
        this.giantRemaining = 0;
        this.miniRemaining = this.cfg.miniDuration;
        this.spawnFloat(x, y, "MINI", "#81d4fa");
        break;
      case "giant":
        this.miniRemaining = 0;
        this.giantRemaining = this.cfg.giantDuration;
        this.spawnFloat(x, y, "GIANT", "#ffab40");
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
      case "ghost":
        this.ghostRemaining = this.cfg.ghostDuration;
        this.spawnFloat(x, y, "GHOST", "#e0f7fa");
        break;
      case "frenzy":
        this.frenzyRemaining = this.cfg.frenzyDuration;
        this.spawnFloat(x, y, "2x SCORE", "#ffee58");
        break;
    }
  }

  private checkCollisions(): void {
    const r = this.effectiveRadius();
    const bx = this.cfg.birdX;
    const by = this.birdY;

    // During post-revive / post-warp grace, clamp inside the world but ignore
    // hazards entirely.
    if (this.invulnRemaining > 0) {
      this.clampToWorld(r);
      return;
    }

    // World bounds are lethal even while ghosting.
    if (by - r < 0 || by + r > this.cfg.worldHeight) {
      if (this.resolveHit()) {
        this.clampToWorld(r);
        this.birdVY = 0;
      }
      return;
    }

    const phasing = this.ghostRemaining > 0;

    // Pipes (skipped while ghosting).
    if (!phasing) {
      for (const p of this.pipes) {
        if (p.x + this.cfg.pipeWidth < bx - r) continue;
        if (p.x > bx + r) break;
        let hit = false;
        for (const seg of this.solidSegments(p)) {
          if (this.circleRect(bx, by, r, p.x, seg.y0, this.cfg.pipeWidth, seg.y1 - seg.y0)) {
            hit = true;
            break;
          }
        }
        if (hit) {
          if (this.resolveHit()) {
            this.birdY = p.gapY + p.gapH / 2;
            this.birdVY = 0;
          }
          return;
        }
      }
    }

    // Saws — giant smashes them for points; ghost phases; otherwise lethal.
    for (const s of this.saws) {
      const rr = r + this.cfg.sawRadius;
      if (this.dist2(bx, by, s.x, s.y) > rr * rr) continue;
      if (this.giantRemaining > 0) {
        this.saws = this.saws.filter((o) => o.id !== s.id);
        this.addScore(this.cfg.sawSmashScore);
        this.spawnFloat(s.x, s.y, "SMASH!", "#ffab40");
        return;
      }
      if (phasing) continue;
      if (this.resolveHit()) {
        this.saws = this.saws.filter((o) => o.id !== s.id);
      }
      return;
    }
  }

  private clampToWorld(r: number): void {
    if (this.birdY - r < 0) {
      this.birdY = r;
      if (this.birdVY < 0) this.birdVY = 0;
    } else if (this.birdY + r > this.cfg.worldHeight) {
      this.birdY = this.cfg.worldHeight - r;
      if (this.birdVY > 0) this.birdVY = 0;
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
