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
  {
    id: "lvl5",
    prompt: "Level 5 — choose your colours",
    trigger: { kind: "level", level: 5 },
    options: [
      { id: "choice-lvl5-ember", name: "ember", body: [239, 108, 60], accent: [70, 20, 10] },
      { id: "choice-lvl5-tide", name: "tide", body: [56, 178, 172], accent: [10, 60, 60] },
      { id: "choice-lvl5-orchid", name: "orchid", body: [192, 110, 224], accent: [55, 20, 75] },
    ],
  },
  {
    id: "lvl10",
    prompt: "Level 10 — pick a livery",
    trigger: { kind: "level", level: 10 },
    options: [
      { id: "choice-lvl10-ash", name: "ash", body: [120, 130, 140], accent: [25, 30, 35] },
      { id: "choice-lvl10-marigold", name: "marigold", body: [245, 180, 40], accent: [90, 55, 5] },
      { id: "choice-lvl10-cobalt", name: "cobalt", body: [40, 90, 220], accent: [10, 25, 80] },
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
  const set = CHOICE_SETS.find((s) => s.id === setId);
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

/** Unresolved sets whose trigger condition is now met. */
export function pendingChoiceSets(ctx: ChoiceContext): ChoiceSet[] {
  return CHOICE_SETS.filter((set) => {
    if (isChoiceSetResolved(set.id)) return false;
    const t = set.trigger;
    if (t.kind === "level") return ctx.level >= t.level;
    if (t.kind === "goal") return (ctx.stats[t.stat] as number) >= t.value;
    if (t.kind === "event") return t.finalDay ? ctx.eventFinalDay(t.eventId) : true;
    return false;
  });
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
