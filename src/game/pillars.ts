import type { AchievementStats } from "./achievements";

/**
 * Pillar (pipe) styles — a player-pickable cosmetic axis, like shapes/themes.
 *
 * The gap geometry is NEVER touched by a style (collision + determinism stay
 * identical); a style only changes how the two pillar rectangles are painted.
 * "glass" is deliberately see-through, which makes pillars harder to read —
 * so on the DAILY it counts as an extra difficulty modifier (readability
 * only, never the hitbox).
 */

export type PillarStyleId = "solid" | "glass" | "neon" | "stone";

export interface PillarDrawCtx {
  ctx: CanvasRenderingContext2D;
  x: number;
  gapY: number;
  gapH: number;
  worldHeight: number;
  pipeWidth: number;
  /** Letterbox overscan in world units (bleed to the screen edge). */
  over: number;
  /** Theme pillar colors. */
  bodyColor: string;
  capColor: string;
  highContrast: boolean;
}

export interface PillarStyle {
  id: PillarStyleId;
  name: string;
  blurb: string;
  /** See-through styles add a difficulty level when used on the daily. */
  hardensDaily: boolean;
  unlock(stats: AchievementStats): { unlocked: boolean; hint?: string };
  draw(p: PillarDrawCtx): void;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillRect(x, y, w, h);
}

/** Shared: paint top + bottom pillar bodies with the current fillStyle. */
function bodies(p: PillarDrawCtx): void {
  const { ctx, x, gapY, gapH, worldHeight, pipeWidth, over } = p;
  rect(ctx, x, -over, pipeWidth, gapY + over);
  rect(ctx, x, gapY + gapH, pipeWidth, worldHeight - (gapY + gapH) + over);
}

/** Shared: paint the two caps with the current fillStyle. */
function caps(p: PillarDrawCtx): void {
  const { ctx, x, gapY, gapH, pipeWidth } = p;
  rect(ctx, x - 3, gapY - 14, pipeWidth + 6, 14);
  rect(ctx, x - 3, gapY + gapH, pipeWidth + 6, 14);
}

const drawSolid = (p: PillarDrawCtx): void => {
  p.ctx.fillStyle = p.bodyColor;
  bodies(p);
  p.ctx.fillStyle = p.capColor;
  caps(p);
};

const drawGlass = (p: PillarDrawCtx): void => {
  const { ctx } = p;
  // See-through body: low-alpha fill + a bright edge so the silhouette still
  // reads. High contrast bumps the alpha so it stays fair for low vision.
  ctx.save();
  ctx.globalAlpha = p.highContrast ? 0.55 : 0.32;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  ctx.globalAlpha = 1;
  // Glassy vertical highlight strip.
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffffff";
  rect(ctx, p.x + 3, -p.over, 3, p.gapY + p.over);
  rect(ctx, p.x + 3, p.gapY + p.gapH, 3, p.worldHeight - (p.gapY + p.gapH) + p.over);
  ctx.globalAlpha = 1;
  ctx.restore();
  // Solid caps keep the gap edges legible.
  ctx.fillStyle = p.capColor;
  caps(p);
};

const drawNeon = (p: PillarDrawCtx): void => {
  const { ctx } = p;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  if (!p.highContrast) {
    ctx.save();
    ctx.shadowColor = p.capColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = p.capColor;
    caps(p);
    ctx.restore();
  } else {
    ctx.fillStyle = p.capColor;
    caps(p);
  }
};

const drawStone = (p: PillarDrawCtx): void => {
  const { ctx } = p;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  // Horizontal "block" seams via darker lines across each pillar.
  if (!p.highContrast) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000000";
    const seam = 22;
    for (let y = -p.over; y < p.gapY; y += seam) rect(ctx, p.x, y, p.pipeWidth, 2);
    for (let y = p.gapY + p.gapH; y < p.worldHeight + p.over; y += seam) rect(ctx, p.x, y, p.pipeWidth, 2);
    ctx.restore();
  }
  ctx.fillStyle = p.capColor;
  caps(p);
};

export const PILLAR_STYLES: PillarStyle[] = [
  {
    id: "solid",
    name: "solid",
    blurb: "the classic painted pillar.",
    hardensDaily: false,
    unlock: () => ({ unlocked: true }),
    draw: drawSolid,
  },
  {
    id: "stone",
    name: "stone",
    blurb: "blocky carved seams.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.totalGames >= 20, hint: "play 20 games" }),
    draw: drawStone,
  },
  {
    id: "neon",
    name: "neon",
    blurb: "glowing caps for night flights.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.bestScore >= 30, hint: "score 30 in a single run" }),
    draw: drawNeon,
  },
  {
    id: "glass",
    name: "glass",
    blurb: "see-through — harder to read (adds a difficulty level on the daily).",
    hardensDaily: true,
    unlock: (s) => ({ unlocked: s.bestScore >= 60, hint: "score 60 in a single run" }),
    draw: drawGlass,
  },
];

const BY_ID = new Map<PillarStyleId, PillarStyle>(PILLAR_STYLES.map((s) => [s.id, s]));

export const DEFAULT_PILLAR_STYLE: PillarStyleId = "solid";

export function getPillarStyle(id: PillarStyleId | string | null | undefined): PillarStyle {
  return BY_ID.get(id as PillarStyleId) ?? BY_ID.get(DEFAULT_PILLAR_STYLE)!;
}

const KEY = "pflug.pillarStyle.v1";

export function getEquippedPillarLocal(): PillarStyleId {
  try {
    const v = localStorage.getItem(KEY);
    return v && BY_ID.has(v as PillarStyleId) ? (v as PillarStyleId) : DEFAULT_PILLAR_STYLE;
  } catch {
    return DEFAULT_PILLAR_STYLE;
  }
}

export function setEquippedPillarLocal(id: PillarStyleId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage blocked */
  }
}
