/**
 * "Pick 1 of 3" colour choices.
 *
 * At certain milestones the player is offered three colours and picks ONE.
 * The two they pass on are locked **forever** — that irreversibility is the
 * point: the choice means something, and your palette becomes a record of the
 * roads you took. Picked colours behave like any preset palette (they're merged
 * into PRESET_SKINS via {@link CHOICE_PRESETS}, so equip/preview just work).
 *
 * Triggers are evaluated from global state (level / lifetime stats / event
 * final day), so a set simply becomes "pending" once its condition is met and
 * stays pending until resolved — no need to catch the exact moment it fired.
 */
import type { PresetSkin } from "./preset-skins";
import type { AchievementStats } from "./achievements";

type RGB = [number, number, number];

export interface ChoiceColor {
  id: string;
  name: string;
  body: RGB;
  accent: RGB;
}

export type ChoiceTrigger =
  | { kind: "level"; level: number }
  | { kind: "goal"; stat: keyof AchievementStats; value: number }
  | { kind: "event"; eventId: string; finalDay?: boolean };

export interface ChoiceSet {
  id: string;
  /** One-line prompt shown above the three swatches. */
  prompt: string;
  trigger: ChoiceTrigger;
  options: [ChoiceColor, ChoiceColor, ChoiceColor];
}

export const CHOICE_SETS: ChoiceSet[] = [
  // Level milestones fire every 5 levels. The palette deliberately *escalates*:
  // early choices are harmonious tonals (a hue + its deeper shade) so a new
  // player can't go wrong, and later choices are bold, high-contrast "specials"
  // (black + yellow, white + black, neon) that read as a flex you earned.
  {
    id: "lvl5",
    prompt: "Level 5 — cool tones",
    trigger: { kind: "level", level: 5 },
    options: [
      { id: "choice-lvl5-sky", name: "sky", body: [125, 185, 235], accent: [38, 92, 150] },
      { id: "choice-lvl5-seafoam", name: "seafoam", body: [120, 210, 185], accent: [25, 105, 90] },
      { id: "choice-lvl5-lavender", name: "lavender", body: [180, 165, 225], accent: [85, 65, 145] },
    ],
  },
  {
    id: "lvl10",
    prompt: "Level 10 — warm tones",
    trigger: { kind: "level", level: 10 },
    options: [
      { id: "choice-lvl10-apricot", name: "apricot", body: [245, 180, 120], accent: [165, 85, 40] },
      { id: "choice-lvl10-honey", name: "honey", body: [240, 205, 110], accent: [150, 110, 30] },
      { id: "choice-lvl10-blush", name: "blush", body: [240, 160, 175], accent: [150, 60, 85] },
    ],
  },
  {
    id: "lvl15",
    prompt: "Level 15 — jewel tones",
    trigger: { kind: "level", level: 15 },
    options: [
      { id: "choice-lvl15-teal", name: "teal", body: [55, 165, 170], accent: [12, 78, 82] },
      { id: "choice-lvl15-fern", name: "fern", body: [110, 165, 80], accent: [40, 80, 30] },
      { id: "choice-lvl15-plum", name: "plum", body: [150, 95, 160], accent: [70, 35, 80] },
    ],
  },
  {
    id: "lvl20",
    prompt: "Level 20 — vivid duos",
    trigger: { kind: "level", level: 20 },
    options: [
      { id: "choice-lvl20-sunset", name: "sunset", body: [250, 140, 55], accent: [55, 45, 120] },
      { id: "choice-lvl20-aquapop", name: "aqua pop", body: [70, 200, 230], accent: [225, 70, 150] },
      { id: "choice-lvl20-limelight", name: "limelight", body: [185, 215, 70], accent: [110, 45, 150] },
    ],
  },
  {
    id: "lvl25",
    prompt: "Level 25 — high voltage",
    trigger: { kind: "level", level: 25 },
    options: [
      { id: "choice-lvl25-magenta", name: "hot magenta", body: [230, 55, 150], accent: [25, 200, 195] },
      { id: "choice-lvl25-volt", name: "volt", body: [200, 250, 60], accent: [35, 35, 55] },
      { id: "choice-lvl25-flame", name: "flame", body: [255, 95, 45], accent: [25, 20, 30] },
    ],
  },
  {
    id: "lvl30",
    prompt: "Level 30 — blackout specials",
    trigger: { kind: "level", level: 30 },
    options: [
      { id: "choice-lvl30-bumblebee", name: "bumblebee", body: [22, 22, 22], accent: [245, 205, 40] },
      { id: "choice-lvl30-inferno", name: "inferno", body: [22, 22, 22], accent: [225, 55, 45] },
      { id: "choice-lvl30-venom", name: "venom", body: [22, 22, 22], accent: [120, 235, 95] },
    ],
  },
  {
    id: "lvl35",
    prompt: "Level 35 — couture",
    trigger: { kind: "level", level: 35 },
    options: [
      { id: "choice-lvl35-ghost", name: "ghost", body: [238, 240, 245], accent: [24, 24, 30] },
      { id: "choice-lvl35-royale", name: "royale", body: [26, 22, 58], accent: [243, 196, 72] },
      { id: "choice-lvl35-crimson", name: "crimson court", body: [88, 12, 22], accent: [240, 224, 200] },
    ],
  },
  {
    id: "lvl40",
    prompt: "Level 40 — legendary",
    trigger: { kind: "level", level: 40 },
    options: [
      { id: "choice-lvl40-vaporwave", name: "vaporwave", body: [255, 110, 200], accent: [110, 230, 255] },
      { id: "choice-lvl40-noir", name: "neon noir", body: [12, 12, 18], accent: [255, 60, 140] },
      { id: "choice-lvl40-toxic", name: "toxic", body: [205, 255, 20], accent: [10, 10, 12] },
    ],
  },
  {
    id: "ace75",
    prompt: "Sharp shooter — score 75. Claim a colour.",
    trigger: { kind: "goal", stat: "bestScore", value: 75 },
    options: [
      { id: "choice-ace-blood", name: "blood orange", body: [233, 84, 32], accent: [60, 15, 5] },
      { id: "choice-ace-jade", name: "jade", body: [16, 185, 129], accent: [6, 60, 45] },
      { id: "choice-ace-ink", name: "indigo", body: [79, 70, 229], accent: [25, 20, 75] },
    ],
  },
  {
    id: "wc-finale",
    prompt: "World Cup finale — a colour to remember it by",
    trigger: { kind: "event", eventId: "worldcup-2026", finalDay: true },
    options: [
      { id: "choice-wc-trophy", name: "trophy gold", body: [240, 196, 70], accent: [95, 65, 10] },
      { id: "choice-wc-pitch", name: "pitch green", body: [46, 160, 84], accent: [12, 55, 30] },
      { id: "choice-wc-kit", name: "sky kit", body: [120, 195, 245], accent: [20, 60, 110] },
    ],
  },
];

// ---- Procedural choices beyond the hand-made milestones -------------------
// After the final fixed milestone, EVERY level offers a fresh "pick 1 of 3"
// with completely random colour combinations. They're generated
// *deterministically from the level number*, so a given level always yields the
// same three options — which means a picked id can be reconstructed back into a
// palette without ever persisting the RGB.

export const RANDOM_CHOICE_START_LEVEL = 41;

/** Tiny deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const HUE_NAMES: ReadonlyArray<readonly [number, string]> = [
  [15, "crimson"], [40, "amber"], [65, "gold"], [95, "lime"], [150, "emerald"],
  [185, "teal"], [205, "azure"], [240, "cobalt"], [275, "violet"], [305, "magenta"],
  [340, "rose"], [360, "crimson"],
];
function hueName(h: number): string {
  for (const [max, name] of HUE_NAMES) if (h <= max) return name;
  return "crimson";
}

/** One deterministic random colour for (level, slot). Body is always a vivid,
 *  visible mid-tone; the accent is either a deep shade of the same hue (tasteful
 *  tonal) or a fully independent hue (bold contrast) — so combos range from
 *  classy to genuinely wild. */
function genRandomColor(level: number, i: number): ChoiceColor {
  const rng = mulberry32(level * 2654435761 + i * 40503 + 1);
  const bodyHue = Math.floor(rng() * 360);
  const bodyS = 0.6 + rng() * 0.35;
  const bodyL = 0.5 + rng() * 0.14;
  const body = hslToRgb(bodyHue, bodyS, bodyL);
  const contrast = rng() < 0.5;
  const accHue = contrast ? Math.floor(rng() * 360) : bodyHue;
  const accS = 0.55 + rng() * 0.4;
  const accL = 0.16 + rng() * 0.15;
  const accent = hslToRgb(accHue, accS, accL);
  return { id: `choice-rng-${level}-${i}`, name: hueName(bodyHue), body, accent };
}

/** The procedurally-generated "pick 1 of 3" for a given level (>= 41). */
export function randomChoiceSet(level: number): ChoiceSet {
  return {
    id: `rng-lvl-${level}`,
    prompt: `Level ${level} — wildcard colours`,
    trigger: { kind: "level", level },
    options: [genRandomColor(level, 0), genRandomColor(level, 1), genRandomColor(level, 2)],
  };
}

const RNG_COLOR_RE = /^choice-rng-(\d+)-(\d+)$/;
const RNG_SET_RE = /^rng-lvl-(\d+)$/;

/** Reconstruct a procedural choice colour straight from its id. */
export function randomChoiceColor(id: string): ChoiceColor | null {
  const m = RNG_COLOR_RE.exec(id);
  return m ? genRandomColor(Number(m[1]), Number(m[2])) : null;
}

/** Resolve any choice set id — fixed milestone or procedural level. */
function getChoiceSet(setId: string): ChoiceSet | null {
  const fixed = CHOICE_SETS.find((s) => s.id === setId);
  if (fixed) return fixed;
  const m = RNG_SET_RE.exec(setId);
  return m ? randomChoiceSet(Number(m[1])) : null;
}

// ---- Persisted state ------------------------------------------------------

interface ChoiceState {
  picked: string[]; // colour ids the player chose (owned + equippable)
  rejected: string[]; // colour ids locked forever (the roads not taken)
  resolved: string[]; // set ids already decided
}

const KEY = "pflug.colorChoices.v1";

function load(): ChoiceState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { picked: [], rejected: [], resolved: [] };
    const p = JSON.parse(raw) as Partial<ChoiceState>;
    return {
      picked: Array.isArray(p.picked) ? p.picked : [],
      rejected: Array.isArray(p.rejected) ? p.rejected : [],
      resolved: Array.isArray(p.resolved) ? p.resolved : [],
    };
  } catch {
    return { picked: [], rejected: [], resolved: [] };
  }
}

function save(s: ChoiceState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* localStorage blocked — choices just won't persist */
  }
}

export function isChoicePicked(colorId: string): boolean {
  return load().picked.includes(colorId);
}

export function isChoiceRejected(colorId: string): boolean {
  return load().rejected.includes(colorId);
}

export function isChoiceSetResolved(setId: string): boolean {
  return load().resolved.includes(setId);
}

/** Commit a choice: own the picked colour, lock the other two FOREVER. */
export function resolveChoice(setId: string, pickedColorId: string): void {
  const set = getChoiceSet(setId);
  if (!set) return;
  const s = load();
  if (s.resolved.includes(setId)) return; // idempotent
  s.resolved.push(setId);
  for (const opt of set.options) {
    if (opt.id === pickedColorId) {
      if (!s.picked.includes(opt.id)) s.picked.push(opt.id);
    } else if (!s.rejected.includes(opt.id)) {
      s.rejected.push(opt.id);
    }
  }
  save(s);
}

export interface ChoiceContext {
  level: number;
  stats: AchievementStats;
  /** Whether the player played on the given event's final day. */
  eventFinalDay(eventId: string): boolean;
}

/** Unresolved sets whose trigger condition is now met. The fixed milestones can
 *  surface several at once (they're shown one at a time by the caller); beyond
 *  level 40 we append only the *next* unresolved procedural level, so the wild
 *  choices are worked through in order, one per level. */
export function pendingChoiceSets(ctx: ChoiceContext): ChoiceSet[] {
  const out = CHOICE_SETS.filter((set) => {
    if (isChoiceSetResolved(set.id)) return false;
    const t = set.trigger;
    if (t.kind === "level") return ctx.level >= t.level;
    if (t.kind === "goal") return (ctx.stats[t.stat] as number) >= t.value;
    if (t.kind === "event") return t.finalDay ? ctx.eventFinalDay(t.eventId) : true;
    return false;
  });
  for (let lvl = RANDOM_CHOICE_START_LEVEL; lvl <= ctx.level; lvl++) {
    if (isChoiceSetResolved(`rng-lvl-${lvl}`)) continue;
    out.push(randomChoiceSet(lvl));
    break; // one wildcard at a time; the next surfaces once this is resolved
  }
  return out;
}

// ---- Preset integration ---------------------------------------------------

/** Every choice colour as a preset, so picked ones equip/preview like any
 *  palette. They never unlock by stats — only by being picked (presetUnlock
 *  ORs isChoicePicked); rejected ones read "a road not taken". */
export const CHOICE_PRESETS: PresetSkin[] = CHOICE_SETS.flatMap((set) =>
  set.options.map((o) => ({
    id: o.id,
    name: o.name,
    body: o.body,
    accent: o.accent,
    choice: true,
    unlock: () =>
      isChoiceRejected(o.id)
        ? { unlocked: false, hint: "a road not taken — locked" }
        : { unlocked: false, hint: "a milestone choice" },
  })),
);

/** Reconstruct a procedural (level > 40) choice colour as an equippable preset.
 *  Used by getPreset so a picked wildcard always resolves, even though it isn't
 *  baked into PRESET_SKINS. */
export function randomChoicePreset(id: string): PresetSkin | null {
  const c = randomChoiceColor(id);
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    body: c.body,
    accent: c.accent,
    choice: true,
    unlock: () =>
      isChoiceRejected(c.id)
        ? { unlocked: false, hint: "a road not taken — locked" }
        : { unlocked: false, hint: "a wildcard choice" },
  };
}

/** Picked procedural colours as presets, so they appear in the gallery (the
 *  rejected ones stay out — there'd be endlessly many). */
export function pickedRandomChoicePresets(): PresetSkin[] {
  const out: PresetSkin[] = [];
  for (const id of load().picked) {
    const p = randomChoicePreset(id);
    if (p) out.push(p);
  }
  return out;
}
