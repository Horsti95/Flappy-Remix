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

export type PillarStyleId = "solid" | "og" | "glass" | "neon" | "stone" | "stadium" | "bamboo" | "brick" | "candy" | "ice";

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

/** Shared "HD" cylinder shading — a horizontal light→dark gradient painted
 *  over the bodies so a flat pillar reads as a rounded tube. Alpha-only, so it
 *  tints whatever the theme's body colour is. */
function cylinderShade(p: PillarDrawCtx): void {
  const { ctx, x, pipeWidth } = p;
  const g = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
  g.addColorStop(0, "rgba(0,0,0,0.34)");
  g.addColorStop(0.16, "rgba(255,255,255,0.14)");
  g.addColorStop(0.4, "rgba(255,255,255,0.28)");
  g.addColorStop(0.62, "rgba(255,255,255,0.04)");
  g.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = g;
  bodies(p);
}

/** Shared: a thin bright highlight along the OUTER lip of each cap — the rim
 *  furthest from the gap. The top cap glints along its top edge and the bottom
 *  cap along its bottom edge, so both read "dark near the gap, bright at the
 *  rim". (The bottom lip used to sit on the gap side, mirroring the wrong way.) */
function capGloss(p: PillarDrawCtx): void {
  const { ctx, x, gapY, gapH, pipeWidth } = p;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  rect(ctx, x - 3, gapY - 14, pipeWidth + 6, 3);
  rect(ctx, x - 3, gapY + gapH + 14 - 3, pipeWidth + 6, 3);
}

const drawSolid = (p: PillarDrawCtx): void => {
  p.ctx.fillStyle = p.bodyColor;
  bodies(p);
  // HD pass: rounded-tube shading + glossy cap lip. Skipped under high
  // contrast so the a11y palette stays flat and legible.
  if (!p.highContrast) cylinderShade(p);
  p.ctx.fillStyle = p.capColor;
  caps(p);
  if (!p.highContrast) capGloss(p);
};

// OG legacy: the original launch look — flat body + flat caps, no HD cylinder
// shading or cap gloss. Pure nostalgia.
const drawOg = (p: PillarDrawCtx): void => {
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

const drawStadium = (p: PillarDrawCtx): void => {
  const { ctx } = p;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  // Goal-net: a faint white diagonal mesh clipped to each pillar body.
  if (!p.highContrast) {
    const net = (y0: number, y1: number): void => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, y0, p.pipeWidth, y1 - y0);
      ctx.clip();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      const span = y1 - y0;
      const step = 7;
      for (let d = -p.pipeWidth; d < span + p.pipeWidth; d += step) {
        ctx.beginPath();
        ctx.moveTo(p.x, y0 + d);
        ctx.lineTo(p.x + p.pipeWidth, y0 + d - p.pipeWidth);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, y0 + d);
        ctx.lineTo(p.x + p.pipeWidth, y0 + d + p.pipeWidth);
        ctx.stroke();
      }
      ctx.restore();
    };
    net(-p.over, p.gapY);
    net(p.gapY + p.gapH, p.worldHeight + p.over);
  }
  // Bold caps read as the goal crossbar / posts.
  ctx.fillStyle = p.capColor;
  caps(p);
};

const drawBamboo = (p: PillarDrawCtx): void => {
  const { ctx, x, pipeWidth, gapY, gapH, worldHeight, over } = p;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  if (!p.highContrast) {
    cylinderShade(p);
    // Node rings every ~46px: a dark seam with a bright lip just below it.
    const seg = 46;
    const ring = (y0: number, y1: number): void => {
      for (let y = y0; y < y1; y += seg) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        rect(ctx, x, y, pipeWidth, 3);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        rect(ctx, x, y + 3, pipeWidth, 1.5);
      }
    };
    ring(-over, gapY);
    ring(gapY + gapH, worldHeight + over);
  }
  ctx.fillStyle = p.capColor;
  caps(p);
};

const drawBrick = (p: PillarDrawCtx): void => {
  const { ctx, x, pipeWidth, gapY, gapH, worldHeight, over } = p;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  if (!p.highContrast) {
    cylinderShade(p);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    const bh = 11;
    const half = pipeWidth / 2;
    const courses = (y0: number, y1: number): void => {
      let row = 0;
      for (let y = y0; y < y1; y += bh) {
        rect(ctx, x, y, pipeWidth, 1.5); // horizontal mortar
        // vertical mortar, offset every other course (running bond)
        const off = row % 2 ? half : 0;
        rect(ctx, x + off, y, 1.5, bh);
        rect(ctx, x + ((off + half) % pipeWidth), y, 1.5, bh);
        row++;
      }
    };
    courses(-over, gapY);
    courses(gapY + gapH, worldHeight + over);
  }
  ctx.fillStyle = p.capColor;
  caps(p);
};

const drawCandy = (p: PillarDrawCtx): void => {
  const { ctx, x, pipeWidth, gapY, gapH, worldHeight, over } = p;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  if (!p.highContrast) {
    const stripes = (y0: number, y1: number): void => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y0, pipeWidth, y1 - y0);
      ctx.clip();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const w = 10;
      const gap = 20;
      const span = y1 - y0 + pipeWidth;
      for (let d = -pipeWidth; d < span; d += gap) {
        ctx.beginPath();
        ctx.moveTo(x, y0 + d);
        ctx.lineTo(x + pipeWidth, y0 + d - pipeWidth);
        ctx.lineTo(x + pipeWidth, y0 + d - pipeWidth + w);
        ctx.lineTo(x, y0 + d + w);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    stripes(-over, gapY);
    stripes(gapY + gapH, worldHeight + over);
    cylinderShade(p);
  }
  ctx.fillStyle = p.capColor;
  caps(p);
};

const drawIce = (p: PillarDrawCtx): void => {
  const { ctx } = p;
  // Translucent like glass (so it's harder to read → hardens the daily), but
  // with a cold sheen + a bright frozen edge.
  ctx.save();
  ctx.globalAlpha = p.highContrast ? 0.6 : 0.5;
  ctx.fillStyle = p.bodyColor;
  bodies(p);
  ctx.globalAlpha = 1;
  if (!p.highContrast) {
    cylinderShade(p);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#e6fbff";
    rect(ctx, p.x + 4, -p.over, 3, p.gapY + p.over);
    rect(ctx, p.x + 4, p.gapY + p.gapH, 3, p.worldHeight - (p.gapY + p.gapH) + p.over);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
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
  {
    id: "stadium",
    name: "stadium",
    blurb: "goal-net mesh — match day.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.bestScore >= 40, hint: "score 40 in a single run" }),
    draw: drawStadium,
  },
  {
    id: "bamboo",
    name: "bamboo",
    blurb: "rounded green stalks with node rings.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.totalGames >= 40, hint: "play 40 games" }),
    draw: drawBamboo,
  },
  {
    id: "brick",
    name: "brick",
    blurb: "running-bond brickwork.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.bestScore >= 45, hint: "score 45 in a single run" }),
    draw: drawBrick,
  },
  {
    id: "candy",
    name: "candy cane",
    blurb: "diagonal sugar stripes.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.streakDays >= 5, hint: "5-day streak" }),
    draw: drawCandy,
  },
  {
    id: "ice",
    name: "ice",
    blurb: "frozen + see-through — adds a difficulty level on the daily.",
    hardensDaily: true,
    unlock: (s) => ({
      unlocked: s.hardDailyBest >= 40 || s.bestScore >= 80,
      hint: "score 40+ on a hard daily (or 80 in any run)",
    }),
    draw: drawIce,
  },
  {
    id: "og",
    name: "OG legacy",
    blurb: "the original launch look — flat, no HD shading.",
    hardensDaily: false,
    unlock: (s) => ({ unlocked: s.totalGames >= 100, hint: "play 100 games — for the veterans" }),
    draw: drawOg,
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
