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
 * floaty/heavy gravity, big flap, small/big hitbox, faster scroll).
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

export type Tier = "easy" | "medium" | "hard" | "super_hard";

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
    blurb: "+20px gap",
  },
  {
    id: "floaty",
    name: "floaty day",
    kind: "physics",
    difficulty: "friendly",
    configOverride: (c) => ({ ...c, gravity: Math.round(c.gravity * 0.85) }),
    blurb: "softer gravity",
  },
  {
    id: "big_flap",
    name: "big flap day",
    kind: "physics",
    difficulty: "friendly",
    configOverride: (c) => ({ ...c, flapImpulse: Math.round(c.flapImpulse * 1.2) }),
    blurb: "stronger taps",
  },
  {
    id: "small_hitbox",
    name: "lean day",
    kind: "geometry",
    difficulty: "friendly",
    configOverride: (c) => ({ ...c, birdRadius: Math.round(c.birdRadius * 0.7) }),
    blurb: "smaller plane",
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
    // Mirror is implemented client-side in the renderer; sim is
    // unchanged. We mark it neutral but it'll feel hard the first
    // time you play it.
    configOverride: (c) => c,
    blurb: "world flipped",
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
    blurb: "-15px gap",
  },
  {
    id: "faster",
    name: "rush day",
    kind: "physics",
    difficulty: "hostile",
    configOverride: (c) => ({ ...c, scrollSpeed: Math.round(c.scrollSpeed * 1.25) }),
    blurb: "1.25x scroll",
  },
  {
    id: "heavy",
    name: "heavy day",
    kind: "physics",
    difficulty: "hostile",
    configOverride: (c) => ({ ...c, gravity: Math.round(c.gravity * 1.15) }),
    blurb: "heavier gravity",
  },
  {
    id: "big_hitbox",
    name: "wide load day",
    kind: "geometry",
    difficulty: "hostile",
    configOverride: (c) => ({ ...c, birdRadius: Math.round(c.birdRadius * 1.25) }),
    blurb: "bigger plane",
  },
];

const ALL: DailyModifier[] = [...FRIENDLY, ...NEUTRAL, ...HOSTILE];
const BY_ID = new Map(ALL.map((m) => [m.id, m]));

export function getModifier(id: string): DailyModifier | null {
  return BY_ID.get(id) ?? null;
}

const TIER_WEIGHTS: Array<{ tier: Tier; weight: number }> = [
  { tier: "easy", weight: 1 },
  { tier: "medium", weight: 3 },
  { tier: "hard", weight: 2 },
  { tier: "super_hard", weight: 1 },
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
}

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
  }
  return { date: dateUtc, tier, modifiers };
}

export function applyModifiers(cfg: SimConfig, modifiers: readonly DailyModifier[]): SimConfig {
  return modifiers.reduce((c, m) => m.configOverride(c), cfg);
}

export const TIER_LABEL: Record<Tier, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  super_hard: "super hard",
};

export const TIER_COLOR: Record<Tier, string> = {
  easy: "#34d399",      // green
  medium: "#60a5fa",    // blue
  hard: "#f59e0b",      // amber
  super_hard: "#ef4444", // red
};

export function tierWarning(pick: DailyPick): string {
  const mods = pick.modifiers.map((m) => m.blurb).join(" + ");
  return `${TIER_LABEL[pick.tier].toUpperCase()} — ${mods}`;
}
