import { rgbCss, type SkinColors } from "./skin";

/**
 * Shape registry.
 *
 * A shape is the silhouette the player flies. Skins (body + accent
 * colors) apply to whichever shape is equipped — they're independent
 * axes. The renderer dispatches to the equipped shape's `draw` and
 * passes the skin colors and a normalized radius.
 *
 * Coordinates inside each draw function assume the canvas is already
 * translated to the bird's position and rotated by tilt; the function
 * just draws relative to (0, 0) at radius `r`.
 */

export type ShapeId =
  | "paper-plane"
  | "paper-plane-v2"
  | "dart"
  | "kite"
  | "paper-crane"
  | "butterfly";

export interface ShapeUnlock {
  // Computed unlock state for the current player.
  // `null` means "no condition; always available."
  hint: string | null;
  unlocked: boolean;
}

export interface ShapeMeta {
  id: ShapeId;
  name: string;
  /** Human-readable copy for the gallery. */
  blurb: string;
  /**
   * Returns the unlock state given the player's lifetime counters.
   * Pure function — no network. We pass total_games and best_score
   * because those are the cheap things we already have client-side.
   */
  unlock(input: {
    totalGames: number;
    bestScore: number;
    streakDays: number;
  }): ShapeUnlock;
  /**
   * Draw the shape at origin, given the bird radius and the skin
   * colors. Expected to be called inside an existing ctx.translate +
   * ctx.rotate transform.
   */
  draw(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void;
}

function outline(ctx: CanvasRenderingContext2D, highContrast: boolean): void {
  ctx.strokeStyle = highContrast ? "#ffffff" : "#1a1a1a";
  ctx.lineWidth = 1.5;
}

// --- shape draw helpers ---

function drawPaperPlaneClassic(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.45);
  ctx.lineTo(r * 1.05, -r * 0.35);
  ctx.lineTo(r * 0.05, 0);
  ctx.lineTo(r * 1.05, -r * 0.35);
  ctx.lineTo(-r * 0.05, r * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(r * 0.05, 0);
  ctx.lineTo(-r, r * 0.45);
  ctx.lineTo(-r * 0.05, r * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawPaperPlaneV2(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Underbelly accent (drawn first so the body overlaps)
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, r * 0.45);
  ctx.lineTo(-r * 0.1, r * 0.15);
  ctx.lineTo(r * 1.15, -r * 0.15);
  ctx.lineTo(r * 0.75, r * 0.1);
  ctx.lineTo(-r * 0.75, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cream body, two faces meeting at the nose
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, -r * 0.1);
  ctx.lineTo(r * 1.15, -r * 0.15);
  ctx.lineTo(-r * 0.15, r * 0.15);
  ctx.lineTo(r * 1.15, -r * 0.15);
  ctx.lineTo(-r * 1.05, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawDart(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Main pointed triangle
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.4);
  ctx.lineTo(r * 1.1, -r * 0.2);
  ctx.lineTo(-r * 0.75, r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Accent fold along the underside
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(r * 1.1, -r * 0.2);
  ctx.lineTo(-r * 0.75, r * 0.1);
  ctx.lineTo(-r * 0.9, r * 0.4);
  ctx.lineTo(-r * 0.1, r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Small tail kick
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.4);
  ctx.lineTo(-r * 1.05, r * 0.55);
  ctx.lineTo(-r * 0.7, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawKite(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Diamond body
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(r * 0.9, 0);
  ctx.lineTo(0, r * 0.95);
  ctx.lineTo(-r * 0.9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Center fold (the back half)
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(0, r * 0.95);
  ctx.lineTo(-r * 0.9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cross spar (decorative)
  ctx.strokeStyle = highContrast ? "#ffffff" : "#1a1a1a";
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Tail
  ctx.strokeStyle = rgbCss(skin.accent);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.95);
  ctx.quadraticCurveTo(r * 0.2, r * 1.15, -r * 0.1, r * 1.35);
  ctx.quadraticCurveTo(r * 0.2, r * 1.45, 0, r * 1.6);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = highContrast ? "#ffffff" : "#1a1a1a";
}

function drawPaperCrane(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Back wing (accent)
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, r * 0.2);
  ctx.lineTo(-r * 0.1, -r * 0.4);
  ctx.lineTo(r * 0.3, r * 0.1);
  ctx.lineTo(-r * 0.2, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Main body (cream)
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(r * 0.3, r * 0.1);
  ctx.lineTo(r * 1.1, -r * 0.2);
  ctx.lineTo(r * 0.9, r * 0.2);
  ctx.lineTo(r * 1.3, r * 0.4);
  ctx.lineTo(r * 1, r * 0.6);
  ctx.lineTo(r * 0.3, r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Front wing
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.4);
  ctx.lineTo(r * 0.7, -r * 0.6);
  ctx.lineTo(r * 0.3, r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Neck / head
  ctx.beginPath();
  ctx.moveTo(r * 1.1, -r * 0.2);
  ctx.lineTo(r * 1.4, -r * 0.5);
  ctx.lineTo(r * 1.5, -r * 0.2);
  ctx.lineTo(r * 1.2, -r * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawButterfly(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Antennae
  ctx.strokeStyle = highContrast ? "#ffffff" : "#3a3a3a";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.07, -r * 0.55);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.9, -r * 0.55, -r * 1.2);
  ctx.moveTo(r * 0.07, -r * 0.55);
  ctx.quadraticCurveTo(r * 0.4, -r * 0.9, r * 0.55, -r * 1.2);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = highContrast ? "#ffffff" : "#1a1a1a";
  // Upper wings (body color)
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.4);
  ctx.bezierCurveTo(-r * 0.9, -r * 0.9, -r * 1.25, -r * 0.45, -r * 1.1, -r * 0.05);
  ctx.bezierCurveTo(-r * 0.9, r * 0.15, -r * 0.25, -r * 0.05, 0, -r * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.4);
  ctx.bezierCurveTo(r * 0.9, -r * 0.9, r * 1.25, -r * 0.45, r * 1.1, -r * 0.05);
  ctx.bezierCurveTo(r * 0.9, r * 0.15, r * 0.25, -r * 0.05, 0, -r * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Lower wings (accent color)
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.05);
  ctx.bezierCurveTo(-r * 0.8, r * 0.3, -r * 0.9, r * 0.65, -r * 0.55, r * 0.8);
  ctx.bezierCurveTo(-r * 0.2, r * 0.8, -r * 0.05, r * 0.45, -r * 0.05, r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.1, r * 0.05);
  ctx.bezierCurveTo(r * 0.8, r * 0.3, r * 0.9, r * 0.65, r * 0.55, r * 0.8);
  ctx.bezierCurveTo(r * 0.2, r * 0.8, r * 0.05, r * 0.45, r * 0.05, r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Body
  ctx.fillStyle = highContrast ? "#ffffff" : "#3a3a3a";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.05, r * 0.09, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// --- registry ---

export const SHAPES: ShapeMeta[] = [
  {
    id: "paper-plane",
    name: "paper plane",
    blurb: "the classic. starts unlocked.",
    unlock: () => ({ unlocked: true, hint: null }),
    draw: drawPaperPlaneClassic,
  },
  {
    id: "paper-plane-v2",
    name: "paper plane (refined)",
    blurb: "longer dart proportions, cleaner fold.",
    unlock: ({ totalGames }) => ({
      unlocked: totalGames >= 10,
      hint: "play 10 games",
    }),
    draw: drawPaperPlaneV2,
  },
  {
    id: "dart",
    name: "dart",
    blurb: "sharp, racing feel.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 30,
      hint: "score 30 in a single run",
    }),
    draw: drawDart,
  },
  {
    id: "kite",
    name: "kite",
    blurb: "diamond proportion, with a tail.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 50,
      hint: "score 50 in a single run",
    }),
    draw: drawKite,
  },
  {
    id: "paper-crane",
    name: "paper crane",
    blurb: "folded crane silhouette. for the dedicated.",
    unlock: ({ totalGames }) => ({
      unlocked: totalGames >= 200,
      hint: "play 200 games",
    }),
    draw: drawPaperCrane,
  },
  {
    id: "butterfly",
    name: "butterfly",
    blurb: "front-view, two pairs of wings. legendary.",
    unlock: ({ totalGames, streakDays }) => ({
      unlocked: totalGames >= 500 || streakDays >= 14,
      hint: "play 500 games or hold a 14-day streak",
    }),
    draw: drawButterfly,
  },
];

const BY_ID = new Map<ShapeId, ShapeMeta>(SHAPES.map((s) => [s.id, s]));

export const DEFAULT_SHAPE_ID: ShapeId = "paper-plane";

export function getShape(id: ShapeId | string | null | undefined): ShapeMeta {
  if (!id) return BY_ID.get(DEFAULT_SHAPE_ID)!;
  return BY_ID.get(id as ShapeId) ?? BY_ID.get(DEFAULT_SHAPE_ID)!;
}

export function listUnlockedShapeIds(stats: {
  totalGames: number;
  bestScore: number;
  streakDays: number;
}): ShapeId[] {
  return SHAPES.filter((s) => s.unlock(stats).unlocked).map((s) => s.id);
}
