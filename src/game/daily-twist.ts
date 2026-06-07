import { hashStringToSeed, Rng } from "./rng";
import { type SimConfig } from "./config";

/**
 * Daily twist — deterministic per UTC date.
 *
 * Every UTC date hashes to a difficulty tier (easy / medium / hard /
 * super_hard via 1/3/2/1 weighting) plus 1-2 modifiers from a fixed
 * registry. Same date = same pick across all clients worldwide.
 *
 * Shipped: physics + geometry modifiers (wider/tighter gaps,
 * floaty/heavy gravity, big flap, small/big size, faster scroll).
 * applyModifiers() composes their config overrides onto a base
 * SimConfig; both the client GameLoop and the server replay
 * validator run under the same overridden physics so daily replays
 * stay byte-identical.
 *
 * Not yet wired (visual / mechanical / geometric extras like fog,
 * night sky, sunset, blinding sun, rain, headwind, wind gusts,
 * tunnel, mirror): the registry doesn't include them today. They
 * land once the renderer grows a `theme` abstraction — tracked in
 * IDEAS.md under tech debt.
 */

export type ModifierKind = "physics" | "geometry" | "visual" | "mechanical";

export type Tier = "easy" | "medium" | "hard" | "super_hard" | "extreme";

/**
 * Visual overlay effects. Purely cosmetic — they never touch SimConfig,
 * so daily replays stay byte-identical regardless of which one is active.
 * The renderer paints them over the scene (see RenderOptions.visualEffect).
 * "blinding_sun" makes incoming pipes harder to read on the right; the
 * others are pure mood.
 */
export type VisualEffect = "night" | "sunset" | "blinding_sun" | "rain" | "fog";

export interface DailyModifier {
  id: string;
  name: string;
  kind: ModifierKind;
  /** Used to bucket into tiers when picking. */
  difficulty: "friendly" | "neutral" | "hostile";
  /** Overrides applied to SimConfig at run time. */
  configOverride: (cfg: SimConfig) => SimConfig;
  /** Short one-line copy for the pre-game screen. */
  blurb: string;
  /**
   * Difficulty multiplier for the day's overall "intensity". Modifiers
   * compound multiplicatively (1.2 × 1.2 = 1.44), >1 harder, <1 easier.
   * Defaults to 1 (neutral, e.g. cosmetic visuals) when omitted.
   */
  intensity?: number;
  /** For kind:"visual" — the overlay the renderer should paint. */
  visual?: VisualEffect;
}

/**
 * Friendly modifiers — easier than baseline. Rolled on Easy days.
 */
const FRIENDLY: DailyModifier[] = [
  {
    id: "wider_gaps",
    name: "wide gap day",
    kind: "geometry",
    difficulty: "friendly",
    configOverride: (c) => ({
      ...c,
      pipeGapBase: c.pipeGapBase + 20,
      pipeGapMin: c.pipeGapMin + 10,
    }),
    blurb: "gap +20px",
    intensity: 0.85,
  },
  {
    id: "floaty",
    name: "floaty day",
    kind: "physics",
    difficulty: "friendly",
    configOverride: (c) => ({ ...c, gravity: Math.round(c.gravity * 0.85) }),
    blurb: "gravity -15%",
    intensity: 1.1,
  },
  {
    id: "big_flap",
    name: "big flap day",
    kind: "physics",
    difficulty: "friendly",
    configOverride: (c) => ({ ...c, flapImpulse: Math.round(c.flapImpulse * 1.2) }),
    blurb: "flap +20%",
    intensity: 0.9,
  },
  {
    id: "small_hitbox",
    name: "small day",
    kind: "geometry",
    difficulty: "friendly",
    configOverride: (c) => ({ ...c, birdRadius: Math.round(c.birdRadius * 0.7) }),
    blurb: "size -30%",
    intensity: 0.85,
  },
];

/**
 * Neutral modifiers — different feel, not strictly easier or harder.
 * Rolled on Medium days. Visual ones are documented but commented
 * out until the renderer can render them.
 */
const NEUTRAL: DailyModifier[] = [
  {
    id: "mirror",
    name: "mirror day",
    kind: "geometry",
    difficulty: "neutral",
    // Mirror is applied in the renderer (RenderOptions.mirror); sim is
    // unchanged. Main.ts sets renderer.options.mirror when this modifier
    // is active.
    configOverride: (c) => c,
    blurb: "world flipped",
    intensity: 1.1,
  },
  {
    id: "flip_gravity",
    name: "upside down day",
    kind: "physics",
    difficulty: "neutral",
    configOverride: (c) => ({
      ...c,
      gravity: -Math.abs(c.gravity),
      // Sim applies flap as birdVY = -flapImpulse (negative = upward).
      // With gravity inverted (pulling up), we need flap to push DOWN
      // (+birdVY), so negate flapImpulse: -(-420) = +420.
      flapImpulse: -Math.abs(c.flapImpulse),
      birdStartY: c.worldHeight * 0.25,
    }),
    blurb: "gravity inverted — fall up, tap to go down",
    intensity: 1.25,
  },
];

/**
 * Hostile modifiers — harder than baseline. Rolled on Hard days,
 * and stacked in pairs on Super hard days.
 */
const HOSTILE: DailyModifier[] = [
  {
    id: "tight_gaps",
    name: "tight gap day",
    kind: "geometry",
    difficulty: "hostile",
    configOverride: (c) => ({
      ...c,
      pipeGapBase: c.pipeGapBase - 15,
      pipeGapMin: Math.max(80, c.pipeGapMin - 10),
    }),
    blurb: "gap -15px",
    intensity: 1.3,
  },
  {
    id: "faster",
    name: "rush day",
    kind: "physics",
    difficulty: "hostile",
    configOverride: (c) => ({ ...c, scrollSpeed: Math.round(c.scrollSpeed * 1.25) }),
    blurb: "speed +25%",
    intensity: 1.3,
  },
  {
    id: "heavy",
    name: "heavy day",
    kind: "physics",
    difficulty: "hostile",
    configOverride: (c) => ({ ...c, gravity: Math.round(c.gravity * 1.15) }),
    blurb: "gravity +15%",
    intensity: 1.15,
  },
  {
    id: "big_hitbox",
    name: "big day",
    kind: "geometry",
    difficulty: "hostile",
    configOverride: (c) => ({ ...c, birdRadius: Math.round(c.birdRadius * 1.25) }),
    blurb: "size +25%",
    intensity: 1.2,
  },
];

/**
 * Visual modifiers — cosmetic overlays only. They never change physics
 * (configOverride is identity), so they're safe to layer onto any tier
 * without affecting replay determinism. "blinding sun" is the one with a
 * mild gameplay edge (right-side glare), so it's tagged neutral; the rest
 * are pure mood and friendly.
 */
const VISUAL: DailyModifier[] = [
  {
    id: "night",
    name: "night day",
    kind: "visual",
    difficulty: "friendly",
    configOverride: (c) => c,
    blurb: "night sky",
    visual: "night",
  },
  {
    id: "sunset",
    name: "sunset day",
    kind: "visual",
    difficulty: "friendly",
    configOverride: (c) => c,
    blurb: "sunset glow",
    visual: "sunset",
  },
  {
    id: "rain",
    name: "rainy day",
    kind: "visual",
    difficulty: "friendly",
    configOverride: (c) => c,
    blurb: "light rain",
    visual: "rain",
  },
  {
    id: "blinding_sun",
    name: "blinding sun day",
    kind: "visual",
    difficulty: "hostile",
    configOverride: (c) => c,
    blurb: "blinding sun glare — pipes hard to read",
    intensity: 1.3,
    visual: "blinding_sun",
  },
  {
    id: "fog",
    name: "fog day",
    kind: "visual",
    difficulty: "hostile",
    configOverride: (c) => c,
    blurb: "thick fog — limited visibility",
    intensity: 1.4,
    visual: "fog",
  },
];

const ALL: DailyModifier[] = [...FRIENDLY, ...NEUTRAL, ...HOSTILE, ...VISUAL];
const BY_ID = new Map(ALL.map((m) => [m.id, m]));

export function getModifier(id: string): DailyModifier | null {
  return BY_ID.get(id) ?? null;
}

/** Intensity contribution of an active visual effect (1 = no effect). The
 *  daily rolls its visual separately from `modifiers`, so the landing folds
 *  this into the overall intensity. */
export function visualEffectIntensity(visual: VisualEffect | null): number {
  if (!visual) return 1;
  const m = VISUAL.find((v) => v.visual === visual);
  return m?.intensity ?? 1;
}

const TIER_WEIGHTS: Array<{ tier: Tier; weight: number }> = [
  { tier: "easy", weight: 1 },
  { tier: "medium", weight: 3 },
  { tier: "hard", weight: 2 },
  { tier: "super_hard", weight: 1 },
  { tier: "extreme", weight: 0.25 },
];

function pickWeighted<T extends { weight: number }>(items: T[], rng: Rng): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let pick = rng.next() * total;
  for (const it of items) {
    pick -= it.weight;
    if (pick <= 0) return it;
  }
  return items[items.length - 1];
}

function pickOne<T>(arr: readonly T[], rng: Rng): T {
  return arr[rng.nextInt(0, arr.length)];
}

export interface DailyPick {
  date: string;
  tier: Tier;
  modifiers: DailyModifier[];
  /** Cosmetic-only overlay for the day, or null. Independent of `modifiers`
   *  so it never affects physics, scoring, or replay determinism. */
  visualEffect: VisualEffect | null;
}

/** How often a day gets a visual overlay. Drawn from its own RNG draw so
 *  adding/removing visuals never shifts the tier/modifier picks above it. */
const VISUAL_CHANCE = 0.55;

export function pickDaily(dateUtc: string): DailyPick {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateUtc)) {
    throw new Error(`invalid date string: ${dateUtc}`);
  }
  // Distinct stream from the play seed so the modifier pick doesn't
  // change if we ever tweak the play-seed hash salt.
  const rng = new Rng(hashStringToSeed(`pflug-twist:${dateUtc}`));
  const tier = pickWeighted(TIER_WEIGHTS, rng).tier;
  let modifiers: DailyModifier[];
  switch (tier) {
    case "easy":
      modifiers = [pickOne(FRIENDLY, rng)];
      break;
    case "medium":
      modifiers = [pickOne(NEUTRAL.concat(FRIENDLY.slice(0, 1)), rng)];
      break;
    case "hard":
      modifiers = [pickOne(HOSTILE, rng)];
      break;
    case "super_hard": {
      const a = pickOne(HOSTILE, rng);
      // Pick a second hostile, distinct from the first.
      const others = HOSTILE.filter((m) => m.id !== a.id);
      const b = pickOne(others, rng);
      modifiers = [a, b];
      break;
    }
    case "extreme": {
      const a = pickOne(HOSTILE, rng);
      const others1 = HOSTILE.filter((m) => m.id !== a.id);
      const b = pickOne(others1, rng);
      const others2 = others1.filter((m) => m.id !== b.id);
      const c = pickOne(others2, rng);
      modifiers = [a, b, c];
      break;
    }
  }
  // Visual overlay rolled last, on the same deterministic stream. Cosmetic
  // only — keeps the daily fair worldwide while varying the mood.
  const visualMod = (tier === "extreme" || rng.next() < VISUAL_CHANCE) ? pickOne(VISUAL, rng) : null;
  return {
    date: dateUtc,
    tier,
    modifiers,
    visualEffect: visualMod?.visual ?? null,
  };
}

export function applyModifiers(cfg: SimConfig, modifiers: readonly DailyModifier[]): SimConfig {
  return modifiers.reduce((c, m) => m.configOverride(c), cfg);
}

/**
 * Overall difficulty "intensity" of a set of modifiers — multiplied so
 * stacking compounds (two +20% mods → 1.44, not 1.40). `extra` lets callers
 * fold in non-daily handicaps (e.g. equipped glass pillars). 1.0 = baseline.
 */
export function computeIntensity(modifiers: readonly DailyModifier[], extra = 1): number {
  return modifiers.reduce((acc, m) => acc * (m.intensity ?? 1), extra);
}

export type IntensityBand = "easy" | "normal" | "hard" | "super hard" | "extreme";

/** Map a multiplicative intensity to a named band for display. */
export function intensityBand(value: number): IntensityBand {
  if (value < 0.95) return "easy";
  if (value < 1.2) return "normal";
  if (value < 1.5) return "hard";
  if (value < 1.9) return "super hard";
  return "extreme";
}

export const INTENSITY_BAND_COLOR: Record<IntensityBand, string> = {
  easy: "#34d399",
  normal: "#60a5fa",
  hard: "#f59e0b",
  "super hard": "#ef4444",
  extreme: "#a855f7",
};

/** "+44%" / "−15%" style label for an intensity multiplier. */
export function intensityPercentLabel(value: number): string {
  const pct = Math.round((value - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

export const TIER_LABEL: Record<Tier, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  super_hard: "super hard",
  extreme: "extreme",
};

export const TIER_COLOR: Record<Tier, string> = {
  easy: "#34d399",      // green
  medium: "#60a5fa",    // blue
  hard: "#f59e0b",      // amber
  super_hard: "#ef4444", // red
  extreme: "#a855f7",   // purple
};

export function tierWarning(pick: DailyPick): string {
  const mods = pick.modifiers.map((m) => m.blurb).join(" + ");
  return `${TIER_LABEL[pick.tier].toUpperCase()} — ${mods}`;
}
