import type { AchievementStats } from "./achievements";

export type FlapFxId = "off" | "wind_puff" | "speed_lines" | "sparkle" | "ring_pulse";

export interface FlapFxOption {
  id: FlapFxId;
  label: string;
  blurb: string;
  unlock(stats: AchievementStats): { unlocked: boolean; hint?: string };
}

export const FLAP_FX_OPTIONS: FlapFxOption[] = [
  { id: "off",          label: "Off",            blurb: "no effect on flap — default",
    unlock: () => ({ unlocked: true }) },
  { id: "wind_puff",    label: "Wind puff",      blurb: "soft cloud puff drifts down",
    unlock: (s) => ({ unlocked: s.totalGames >= 10, hint: "play 10 games" }) },
  { id: "speed_lines",  label: "Speed lines",    blurb: "anime speed streaks behind the plane",
    unlock: (s) => ({ unlocked: s.bestScore >= 40, hint: "score 40 in a single run" }) },
  { id: "sparkle",      label: "Sparkle trail",  blurb: "tiny glittering dots",
    unlock: (s) => ({ unlocked: s.streakDays >= 5, hint: "5-day streak" }) },
  { id: "ring_pulse",   label: "Ring pulse",     blurb: "expanding shockwave ring",
    unlock: (s) => ({ unlocked: s.challengeWins >= 3, hint: "win 3 challenges" }) },
];

export function flapFxUnlock(id: FlapFxId, stats: AchievementStats): { unlocked: boolean; hint?: string } {
  return FLAP_FX_OPTIONS.find((o) => o.id === id)?.unlock(stats) ?? { unlocked: false };
}

const FX_KEY = "pflug.flapFx.v1";

export function getActiveFlapFx(): FlapFxId {
  try {
    const stored = localStorage.getItem(FX_KEY) as FlapFxId | null;
    if (stored && FLAP_FX_OPTIONS.some((o) => o.id === stored)) return stored;
  } catch {
    /* localStorage blocked */
  }
  return "off";
}

export function setActiveFlapFx(id: FlapFxId): void {
  try {
    localStorage.setItem(FX_KEY, id);
  } catch {
    /* ignore */
  }
}

let labMode = false;
export function setFxLabMode(on: boolean): void { labMode = on; }
export function isFxLabMode(): boolean { return labMode; }

// ---- Particle store --------------------------------------------------------
// Particles are visual-only — they never feed the sim, so they're safe
// to spawn outside the deterministic loop.

export interface Particle {
  /** World x at spawn (constant — particles drift relative to it). */
  x: number;
  /** World y at spawn. */
  y: number;
  /** Live offsets relative to spawn point. */
  dx: number;
  dy: number;
  /** Velocity (units per second). */
  vx: number;
  vy: number;
  /** Age in seconds. */
  age: number;
  /** Lifetime in seconds — when age >= lifetime the particle is removed. */
  life: number;
  /** Render hint chosen by the effect type. */
  kind: "puff" | "line" | "sparkle" | "ring";
  /** Initial colour (fades to transparent). */
  color: string;
}

const PARTICLES: Particle[] = [];

export function getParticles(): readonly Particle[] {
  return PARTICLES;
}

export function clearParticles(): void {
  PARTICLES.length = 0;
}

export function tickParticles(dtSeconds: number): void {
  for (let i = PARTICLES.length - 1; i >= 0; i--) {
    const p = PARTICLES[i];
    p.age += dtSeconds;
    if (p.age >= p.life) {
      PARTICLES.splice(i, 1);
      continue;
    }
    p.dx += p.vx * dtSeconds;
    p.dy += p.vy * dtSeconds;
  }
}

export function spawnFlapFx(id: FlapFxId, x: number, y: number): void {
  switch (id) {
    case "off":
      return;
    case "wind_puff": {
      for (let i = 0; i < 6; i++) {
        const spread = (i - 2.5) * 4;
        PARTICLES.push({
          x, y, dx: spread, dy: 8, vx: spread * 1.2, vy: 80 + Math.random() * 20,
          age: 0, life: 0.55, kind: "puff", color: "rgba(244,234,213,0.7)",
        });
      }
      break;
    }
    case "speed_lines": {
      for (let i = 0; i < 4; i++) {
        const yOff = (i - 1.5) * 5;
        PARTICLES.push({
          x: x - 14, y: y + yOff, dx: 0, dy: 0, vx: -220, vy: 0,
          age: 0, life: 0.32, kind: "line", color: "rgba(244,234,213,0.85)",
        });
      }
      break;
    }
    case "sparkle": {
      for (let i = 0; i < 8; i++) {
        const ang = (Math.random() * Math.PI) + Math.PI; // emit downward hemisphere
        const speed = 40 + Math.random() * 50;
        PARTICLES.push({
          x, y, dx: 0, dy: 4,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          age: 0, life: 0.5, kind: "sparkle", color: "rgba(255,235,150,0.9)",
        });
      }
      break;
    }
    case "ring_pulse": {
      PARTICLES.push({
        x, y, dx: 0, dy: 0, vx: 0, vy: 0,
        age: 0, life: 0.35, kind: "ring", color: "rgba(244,234,213,0.7)",
      });
      break;
    }
  }
}
