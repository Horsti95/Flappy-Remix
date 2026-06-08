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

// ── Flap-FX color ──────────────────────────────────────────────────────────
// A basic 16-color palette the player can tint their flap effect with. null =
// "default" (the original per-effect colors).
export interface FxColor {
  id: string;
  name: string;
  rgb: [number, number, number];
  /** Light unlock gate. default/white are always free. */
  unlock(stats: AchievementStats): { unlocked: boolean; hint?: string };
}
const free = () => ({ unlocked: true });
export const FX_COLORS: FxColor[] = [
  { id: "default", name: "default", rgb: [244, 234, 213], unlock: free },
  { id: "white",   name: "white",   rgb: [255, 255, 255], unlock: free },
  { id: "red",     name: "red",     rgb: [255, 70, 70],   unlock: (s) => ({ unlocked: s.totalGames >= 5,  hint: "play 5 games" }) },
  { id: "orange",  name: "orange",  rgb: [255, 150, 40],  unlock: (s) => ({ unlocked: s.totalGames >= 10, hint: "play 10 games" }) },
  { id: "yellow",  name: "yellow",  rgb: [255, 220, 60],  unlock: (s) => ({ unlocked: s.totalGames >= 20, hint: "play 20 games" }) },
  { id: "lime",    name: "lime",    rgb: [160, 230, 60],  unlock: (s) => ({ unlocked: s.bestScore >= 15,  hint: "score 15 in a single run" }) },
  { id: "green",   name: "green",   rgb: [60, 210, 110],  unlock: (s) => ({ unlocked: s.bestScore >= 25,  hint: "score 25 in a single run" }) },
  { id: "teal",    name: "teal",    rgb: [50, 210, 200],  unlock: (s) => ({ unlocked: s.bestScore >= 35,  hint: "score 35 in a single run" }) },
  { id: "cyan",    name: "cyan",    rgb: [70, 200, 255],  unlock: (s) => ({ unlocked: s.bestScore >= 50,  hint: "score 50 in a single run" }) },
  { id: "blue",    name: "blue",    rgb: [80, 130, 255],  unlock: (s) => ({ unlocked: s.totalScore >= 500,  hint: "score 500 lifetime points" }) },
  { id: "indigo",  name: "indigo",  rgb: [120, 90, 235],  unlock: (s) => ({ unlocked: s.totalScore >= 1500, hint: "score 1500 lifetime points" }) },
  { id: "purple",  name: "purple",  rgb: [180, 90, 235],  unlock: (s) => ({ unlocked: s.totalScore >= 3000, hint: "score 3000 lifetime points" }) },
  { id: "pink",    name: "pink",    rgb: [255, 110, 200], unlock: (s) => ({ unlocked: s.streakDays >= 3,  hint: "3-day streak" }) },
  { id: "magenta", name: "magenta", rgb: [235, 40, 160],  unlock: (s) => ({ unlocked: s.streakDays >= 7,  hint: "7-day streak" }) },
  { id: "brown",   name: "brown",   rgb: [165, 110, 70],  unlock: (s) => ({ unlocked: s.totalGames >= 50, hint: "play 50 games" }) },
  { id: "gray",    name: "gray",    rgb: [150, 150, 150], unlock: (s) => ({ unlocked: s.totalGames >= 30, hint: "play 30 games" }) },
];

let fxColorLabMode = false;
export function setFxColorLabMode(on: boolean): void { fxColorLabMode = on; }
export function isFxColorLabMode(): boolean { return fxColorLabMode; }

/** Evaluate an FX colour's unlock, honouring lab mode. */
export function fxColorUnlocked(
  color: FxColor,
  stats: AchievementStats,
): { unlocked: boolean; hint?: string } {
  if (fxColorLabMode) return { unlocked: true };
  return color.unlock(stats);
}

const FX_COLOR_KEY = "pflug.flapFxColor.v1";

export function getFlapFxColor(): string {
  try {
    const v = localStorage.getItem(FX_COLOR_KEY);
    return v && FX_COLORS.some((c) => c.id === v) ? v : "default";
  } catch {
    return "default";
  }
}
export function setFlapFxColor(id: string): void {
  try { localStorage.setItem(FX_COLOR_KEY, id); } catch { /* ignore */ }
}
/** rgba() for the current FX color at a given alpha, or null when "default". */
function fxColorRgba(alpha: number): string | null {
  const id = getFlapFxColor();
  if (id === "default") return null;
  const c = FX_COLORS.find((x) => x.id === id);
  if (!c) return null;
  return `rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},${alpha})`;
}

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
          age: 0, life: 0.55, kind: "puff", color: fxColorRgba(0.7) ?? "rgba(244,234,213,0.7)",
        });
      }
      break;
    }
    case "speed_lines": {
      for (let i = 0; i < 4; i++) {
        const yOff = (i - 1.5) * 5;
        PARTICLES.push({
          x: x - 14, y: y + yOff, dx: 0, dy: 0, vx: -220, vy: 0,
          age: 0, life: 0.32, kind: "line", color: fxColorRgba(0.85) ?? "rgba(244,234,213,0.85)",
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
          age: 0, life: 0.5, kind: "sparkle", color: fxColorRgba(0.9) ?? "rgba(255,235,150,0.9)",
        });
      }
      break;
    }
    case "ring_pulse": {
      PARTICLES.push({
        x, y, dx: 0, dy: 0, vx: 0, vy: 0,
        age: 0, life: 0.35, kind: "ring", color: fxColorRgba(0.7) ?? "rgba(244,234,213,0.7)",
      });
      break;
    }
  }
}
