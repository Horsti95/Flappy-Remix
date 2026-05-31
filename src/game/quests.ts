import type { ShapeId } from "./shapes";
import type { ThemeId } from "./themes";

/**
 * Quest chains — ordered multi-step goals that teach the player the
 * game's systems and funnel them through unlocks. Each step has a
 * goal evaluated against a RunContext at the end of every run, and a
 * reward granted when the step completes. A chain advances one step
 * at a time; finishing the last step completes the chain.
 *
 * Entirely client-side: progress + granted rewards live in
 * localStorage. Rewards plug into the same equip plumbing as the
 * gallery (shape grants, theme unlocks, preset palettes) by writing
 * the relevant local keys.
 */

export interface RunContext {
  score: number;
  shapeId: ShapeId;
  themeId: ThemeId;
  /** Lifetime games (from profile). */
  totalGames: number;
  /** Current day streak (from profile). */
  streakDays: number;
}

export type QuestGoal =
  | { kind: "score"; min: number }
  | { kind: "score_with_shape"; min: number; shape: ShapeId }
  | { kind: "score_with_theme"; min: number; theme: ThemeId }
  | { kind: "play_with_shape"; times: number; shape: ShapeId }
  | { kind: "streak"; days: number };

export type QuestReward =
  | { kind: "shape"; shape: ShapeId; label: string }
  | { kind: "theme"; theme: ThemeId; label: string }
  | { kind: "preset"; preset: string; label: string };

export interface QuestStep {
  id: string;
  /** Short imperative copy: "Score 25". */
  title: string;
  goal: QuestGoal;
  reward: QuestReward;
}

export interface QuestChain {
  id: string;
  name: string;
  blurb: string;
  steps: QuestStep[];
}

// The shipped chains. Kept short (3 steps) so the loop reads quickly.
export const QUEST_CHAINS: QuestChain[] = [
  {
    id: "pilot-path",
    name: "pilot path",
    blurb: "learn the ropes, earn your wings.",
    steps: [
      {
        id: "pp-1",
        title: "Score 15 in a single run",
        goal: { kind: "score", min: 15 },
        reward: { kind: "shape", shape: "pixel-bird", label: "8-bit bird" },
      },
      {
        id: "pp-2",
        title: "Score 20 flying the 8-bit bird",
        goal: { kind: "score_with_shape", min: 20, shape: "pixel-bird" },
        reward: { kind: "theme", theme: "beach", label: "beach sky" },
      },
      {
        id: "pp-3",
        title: "Score 30 under the beach sky",
        goal: { kind: "score_with_theme", min: 30, theme: "beach" },
        reward: { kind: "preset", preset: "preset-gold", label: "gold palette" },
      },
    ],
  },
  {
    id: "neon-run",
    name: "neon run",
    blurb: "for the night-city flyers.",
    steps: [
      {
        id: "nr-1",
        title: "Play 3 runs with the cyber drone",
        goal: { kind: "play_with_shape", times: 3, shape: "cyber-plane" },
        reward: { kind: "theme", theme: "cyber_neon", label: "neo tokyo" },
      },
      {
        id: "nr-2",
        title: "Score 25 in neo tokyo",
        goal: { kind: "score_with_theme", min: 25, theme: "cyber_neon" },
        reward: { kind: "preset", preset: "preset-aurora", label: "aurora palette" },
      },
      {
        id: "nr-3",
        title: "Hold a 3-day streak",
        goal: { kind: "streak", days: 3 },
        reward: { kind: "shape", shape: "star", label: "star" },
      },
    ],
  },
];

// ---- progress state --------------------------------------------------------

interface QuestProgress {
  /** chainId -> index of the current (not-yet-complete) step. >= steps
   *  length means the chain is fully complete. */
  stepIndex: Record<string, number>;
  /** Counters for cumulative goals like play_with_shape. Keyed by
   *  step id. */
  counters: Record<string, number>;
  /** Rewards already granted, so we never double-apply. */
  granted: string[];
}

const KEY = "pflug.quests.v1";

function load(): QuestProgress {
  const empty: QuestProgress = { stepIndex: {}, counters: {}, granted: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<QuestProgress>) } as QuestProgress;
  } catch {
    return empty;
  }
}

function save(p: QuestProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* localStorage blocked */
  }
}

export function currentStepIndex(chainId: string): number {
  return load().stepIndex[chainId] ?? 0;
}

export interface ChainView {
  chain: QuestChain;
  /** Index of the active step (== steps.length when complete). */
  activeIndex: number;
  complete: boolean;
}

export function getChainViews(): ChainView[] {
  const p = load();
  return QUEST_CHAINS.map((chain) => {
    const activeIndex = p.stepIndex[chain.id] ?? 0;
    return { chain, activeIndex, complete: activeIndex >= chain.steps.length };
  });
}

function goalProgress(goal: QuestGoal, ctx: RunContext, counter: number): { done: boolean; counterDelta: number } {
  switch (goal.kind) {
    case "score":
      return { done: ctx.score >= goal.min, counterDelta: 0 };
    case "score_with_shape":
      return { done: ctx.shapeId === goal.shape && ctx.score >= goal.min, counterDelta: 0 };
    case "score_with_theme":
      return { done: ctx.themeId === goal.theme && ctx.score >= goal.min, counterDelta: 0 };
    case "play_with_shape": {
      const hit = ctx.shapeId === goal.shape;
      const next = counter + (hit ? 1 : 0);
      return { done: next >= goal.times, counterDelta: hit ? 1 : 0 };
    }
    case "streak":
      return { done: ctx.streakDays >= goal.days, counterDelta: 0 };
  }
}

export interface QuestCompletion {
  step: QuestStep;
  chain: QuestChain;
}

/**
 * Evaluate every chain's active step against a finished run. Advances
 * any steps whose goal is now met and returns the rewards to grant.
 * The caller applies each reward (shape/theme/preset) and can surface
 * a toast.
 */
export function evaluateRun(ctx: RunContext): QuestCompletion[] {
  const p = load();
  const completed: QuestCompletion[] = [];
  let dirty = false;

  for (const chain of QUEST_CHAINS) {
    let idx = p.stepIndex[chain.id] ?? 0;
    // A run can satisfy several sequential steps at once (e.g. a huge
    // score), so loop while the active step keeps completing.
    while (idx < chain.steps.length) {
      const step = chain.steps[idx];
      const counter = p.counters[step.id] ?? 0;
      const { done, counterDelta } = goalProgress(step.goal, ctx, counter);
      if (counterDelta !== 0) {
        p.counters[step.id] = counter + counterDelta;
        dirty = true;
      }
      if (!done) break;
      idx += 1;
      p.stepIndex[chain.id] = idx;
      dirty = true;
      if (!p.granted.includes(step.id)) {
        p.granted.push(step.id);
        completed.push({ step, chain });
      }
    }
  }

  if (dirty) save(p);
  return completed;
}

export function resetQuests(): void {
  save({ stepIndex: {}, counters: {}, granted: [] });
}
