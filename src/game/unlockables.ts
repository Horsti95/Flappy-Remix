import {
  ACHIEVEMENTS,
  loadAchievementStats,
  type AchievementDef,
  type AchievementStats,
} from "./achievements";
import { PRESET_SKINS, type PresetSkin } from "./preset-skins";
import { SHAPES, type ShapeMeta } from "./shapes";
import { THEMES, type Theme } from "./themes";
import { AURA_OPTIONS } from "./aura";
import { FLAP_FX_OPTIONS } from "./flap-fx";
import { PILLAR_STYLES } from "./pillars";
import { PILLAR_COLORS } from "./pillar-colors";
import { GATE_SOUNDS } from "./gate-sounds";
import { DEATH_SOUND_OPTIONS, FLAP_SOUND_OPTIONS } from "./sfx";

/**
 * Unified unlock registry.
 *
 * The game grew ~11 parallel unlock axes — achievements (color rewards),
 * preset palettes, shapes, themes, auras, flap FX, pillar styles, pillar
 * colours, gate/death/flap sounds — each with its own array and its own
 * `unlock(stats) → {unlocked, hint}` (achievements use `check(stats)` + a
 * reward). They all speak the same dialect ({@link UnlockResult}), so this
 * module normalizes all of them into ONE `Unlockable` shape with a single
 * evaluator + progress API.
 *
 * This is intentionally an ADDITIVE layer: the existing equip/render
 * plumbing (gallery cards, renderer, localStorage keys) keeps reading the
 * original arrays. Callers that just want "what's unlocked / what's the
 * overall progress / what unlocks next" can use this instead of
 * re-traversing four arrays. That removes the duplication that motivated
 * the unification without risking the unlock economy.
 */

export type UnlockKind =
  | "shape"
  | "theme"
  | "palette"
  | "achievement-color"
  | "aura"
  | "flap-fx"
  | "pillar"
  | "pillar-color"
  | "gate-sound"
  | "death-sound"
  | "flap-sound";

/**
 * The one unlock-evaluation result every cosmetic axis returns. Replaces ~10
 * structurally-identical inline copies across the axis modules.
 */
export interface UnlockResult {
  unlocked: boolean;
  hint?: string;
}

export interface Unlockable {
  /** Stable id, namespaced by kind to avoid collisions across sources. */
  uid: string;
  kind: UnlockKind;
  /** Source id within its own system (ShapeId, ThemeId, preset id, ach id). */
  sourceId: string;
  name: string;
  /** One-line description / unlock hint. */
  hint: string;
  unlocked: boolean;
  /** Prestige achievement colors keep their reward a surprise while locked. */
  secret: boolean;
}

/** The superset of counters every source's unlock check may read. */
export type UnlockStats = AchievementStats;

function shapeUnlockable(s: ShapeMeta, stats: UnlockStats): Unlockable {
  const u = s.unlock(stats);
  return {
    uid: `shape:${s.id}`,
    kind: "shape",
    sourceId: s.id,
    name: s.name,
    hint: u.hint ?? (u.unlocked ? "unlocked" : "locked"),
    unlocked: u.unlocked,
    secret: false,
  };
}

function themeUnlockable(t: Theme, stats: UnlockStats): Unlockable {
  const u = t.unlock(stats);
  return {
    uid: `theme:${t.id}`,
    kind: "theme",
    sourceId: t.id,
    name: t.name,
    hint: u.hint ?? (u.unlocked ? "unlocked" : "locked"),
    unlocked: u.unlocked,
    secret: false,
  };
}

function presetUnlockable(p: PresetSkin, stats: UnlockStats): Unlockable {
  const u = p.unlock(stats);
  return {
    uid: `palette:${p.id}`,
    kind: "palette",
    sourceId: p.id,
    name: p.name,
    hint: u.hint ?? (u.unlocked ? "unlocked" : "locked"),
    unlocked: u.unlocked,
    secret: false,
  };
}

/** Generic adapter for the option-list axes (auras, FX, pillars, sounds). */
function optionUnlockable(
  kind: UnlockKind,
  sourceId: string,
  name: string,
  u: UnlockResult,
): Unlockable {
  return {
    uid: `${kind}:${sourceId}`,
    kind,
    sourceId,
    name,
    hint: u.hint ?? (u.unlocked ? "unlocked" : "locked"),
    unlocked: u.unlocked,
    secret: false,
  };
}

function achievementUnlockable(a: AchievementDef, stats: UnlockStats): Unlockable {
  const unlocked = a.check(stats);
  return {
    uid: `ach:${a.id}`,
    kind: "achievement-color",
    sourceId: a.id,
    name: a.name,
    hint: a.blurb,
    unlocked,
    secret: a.secret === true,
  };
}

/** Build the full normalized list for the given stats. */
export function getUnlockables(stats: UnlockStats = loadAchievementStats()): Unlockable[] {
  return [
    // Hidden shapes (retired variants) and "pick 1 of 3" choice colours are not
    // part of the play-to-unlock collection: the former aren't pickable, the
    // latter can never be 100%-owned (you keep one per set, by design).
    ...SHAPES.filter((s) => !s.hidden).map((s) => shapeUnlockable(s, stats)),
    ...THEMES.map((t) => themeUnlockable(t, stats)),
    ...PRESET_SKINS.filter((p) => !p.choice).map((p) => presetUnlockable(p, stats)),
    ...ACHIEVEMENTS.map((a) => achievementUnlockable(a, stats)),
    // Option-list axes (same raw-predicate convention as above — lab-mode and
    // event-grant overlays stay a gallery concern, not a collection concern).
    ...AURA_OPTIONS.map((o) => optionUnlockable("aura", o.id, o.label, o.unlock(stats))),
    ...FLAP_FX_OPTIONS.map((o) => optionUnlockable("flap-fx", o.id, o.label, o.unlock(stats))),
    ...PILLAR_STYLES.map((o) => optionUnlockable("pillar", o.id, o.name, o.unlock(stats))),
    ...PILLAR_COLORS.map((o) => optionUnlockable("pillar-color", o.id, o.name, o.unlock(stats))),
    ...GATE_SOUNDS.map((o) => optionUnlockable("gate-sound", o.id, o.name, o.unlock(stats))),
    ...DEATH_SOUND_OPTIONS.map((o) => optionUnlockable("death-sound", o.id, o.label, o.unlock(stats))),
    ...FLAP_SOUND_OPTIONS.map((o) => optionUnlockable("flap-sound", o.id, o.label, o.unlock(stats))),
  ];
}

export interface UnlockProgress {
  unlocked: number;
  total: number;
  pct: number;
}

/** Overall unlock progress, optionally filtered to one kind. */
export function unlockProgress(
  kind?: UnlockKind,
  stats: UnlockStats = loadAchievementStats(),
): UnlockProgress {
  const list = getUnlockables(stats).filter((u) => !kind || u.kind === kind);
  const unlocked = list.filter((u) => u.unlocked).length;
  const total = list.length;
  return { unlocked, total, pct: total === 0 ? 0 : Math.round((unlocked / total) * 100) };
}

/** Items not yet unlocked, useful for a "what's next" surface. */
export function lockedUnlockables(stats: UnlockStats = loadAchievementStats()): Unlockable[] {
  return getUnlockables(stats).filter((u) => !u.unlocked);
}
