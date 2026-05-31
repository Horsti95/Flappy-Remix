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
  | "pixel-bird"
  | "kite"
  | "cyber-plane"
  | "butterfly"
  | "rocket"
  | "heart"
  | "star"
  | "flower"
  | "vector-bird"
  | "leaf"
  | "lightning"
  | "ghost";

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
   * Pure function — no network. Extra optional counters give variety
   * to unlock conditions (challenge wins, late-night plays, etc.).
   */
  unlock(input: {
    totalGames: number;
    bestScore: number;
    streakDays: number;
    challengeWins?: number;
    lateNightGames?: number;
    morningGames?: number;
    dailyStreakDays?: number;
    friendCount?: number;
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

function drawPixelBird(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  // 8-bit silhouette. Each "pixel" is a unit cell of size px = r/8.
  // Layout is a hand-painted bitmap so the proportions read tight at
  // any radius. Body uses skin.body, accent uses skin.accent for
  // beak + eye.
  const px = r / 8;
  const body = rgbCss(skin.body);
  const accent = rgbCss(skin.accent);
  const outlineCol = highContrast ? "#ffffff" : "#1a1a1a";

  // bitmap rows (top-to-bottom). x range [-7, +7]
  // 1 = body, 2 = accent, 0 = empty
  const bmp: number[][] = [
    [0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,1,1,1,1,2,2,1,1,1,1,1,0,0,0],
    [1,1,1,1,1,2,2,1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,2,2,2,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
  ];
  const offX = -7;
  const offY = -4;
  for (let row = 0; row < bmp.length; row++) {
    for (let col = 0; col < bmp[row].length; col++) {
      const v = bmp[row][col];
      if (v === 0) continue;
      ctx.fillStyle = v === 2 ? accent : body;
      ctx.fillRect((offX + col) * px, (offY + row) * px, px + 0.5, px + 0.5);
    }
  }
  // Single pixel eye in outline color for character.
  ctx.fillStyle = outlineCol;
  ctx.fillRect((offX + 9) * px, (offY + 3) * px, px, px);
}

function drawCyberPlane(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Sharp, angular sci-fi craft.
  // Main fuselage — long arrowhead.
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(r * 1.2, 0);
  ctx.lineTo(r * 0.2, -r * 0.45);
  ctx.lineTo(-r * 0.9, -r * 0.25);
  ctx.lineTo(-r * 1.05, 0);
  ctx.lineTo(-r * 0.9, r * 0.25);
  ctx.lineTo(r * 0.2, r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Bottom wing slash — accent color.
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(r * 0.4, r * 0.15);
  ctx.lineTo(-r * 0.7, r * 0.7);
  ctx.lineTo(-r * 1.0, r * 0.55);
  ctx.lineTo(-r * 0.6, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cockpit glow strip — small bright accent slash near nose.
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(r * 0.55, -r * 0.18);
  ctx.lineTo(r * 0.9, -r * 0.08);
  ctx.lineTo(r * 0.8, 0);
  ctx.lineTo(r * 0.45, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Twin engine notches at the tail.
  ctx.fillStyle = highContrast ? "#000000" : "#1a1a1a";
  ctx.fillRect(-r * 1.05, -r * 0.12, r * 0.18, r * 0.08);
  ctx.fillRect(-r * 1.05,  r * 0.04, r * 0.18, r * 0.08);
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

function drawFlower(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  ctx.fillStyle = rgbCss(skin.body);
  const petalW = r * 0.45;
  const petalH = r * 0.95;
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.ellipse(0, -petalH * 0.5, petalW * 0.5, petalH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Center circle
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawVectorBird(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Body ellipse — elongated, facing right
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Wing arc — swept back from top-center
  ctx.strokeStyle = rgbCss(skin.accent);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.55);
  ctx.quadraticCurveTo(-r * 0.8, -r * 1.1, -r * 1.2, -r * 0.6);
  ctx.stroke();
  outline(ctx, highContrast);
  // Beak triangle pointing right
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(r * 1.3, 0);
  ctx.lineTo(r * 1.8, -r * 0.15);
  ctx.lineTo(r * 1.8, r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Eye
  ctx.fillStyle = highContrast ? "#ffffff" : "#1a1a1a";
  ctx.beginPath();
  ctx.arc(r * 0.75, -r * 0.2, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawLeaf(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Teardrop: round left, pointed right
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(-r * 1.1, 0);
  ctx.bezierCurveTo(-r * 1.1, -r * 0.8, r * 0.6, -r * 0.8, r * 1.1, 0);
  ctx.bezierCurveTo(r * 0.6, r * 0.8, -r * 1.1, r * 0.8, -r * 1.1, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Center vein
  ctx.strokeStyle = rgbCss(skin.accent);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, 0);
  ctx.lineTo(r * 1.0, 0);
  ctx.stroke();
  // A couple small side veins
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, 0);
  ctx.lineTo(-r * 0.05, -r * 0.45);
  ctx.moveTo(r * 0.2, 0);
  ctx.lineTo(r * 0.5, -r * 0.45);
  ctx.stroke();
  outline(ctx, highContrast);
}

function drawLightning(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Classic ⚡ filled polygon: top-right → mid-left → step right → bottom-right
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(r * 0.4, -r * 1.2);
  ctx.lineTo(-r * 0.55, r * 0.05);
  ctx.lineTo(r * 0.1, r * 0.05);
  ctx.lineTo(-r * 0.4, r * 1.2);
  ctx.lineTo(r * 0.55, -r * 0.05);
  ctx.lineTo(r * 0.0, -r * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Inner highlight stripe using accent
  ctx.strokeStyle = rgbCss(skin.accent);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r * 0.25, -r * 0.95);
  ctx.lineTo(-r * 0.3, r * 0.0);
  ctx.lineTo(r * 0.05, r * 0.0);
  ctx.lineTo(-r * 0.25, r * 0.95);
  ctx.stroke();
  outline(ctx, highContrast);
}

function drawGhost(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  const top = -r * 1.1;
  const bottom = r * 0.9;
  const left = -r * 0.85;
  const right = r * 0.85;
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  // Top semicircle
  ctx.arc(0, top + r * 0.85, r * 0.85, Math.PI, 0, false);
  // Right side straight down
  ctx.lineTo(right, bottom);
  // Wavy bottom — 3 bumps going left
  const bumpW = (right - left) / 3;
  ctx.arc(right - bumpW * 0.5, bottom, bumpW * 0.5, 0, Math.PI, false);
  ctx.arc(left + bumpW * 1.5, bottom, bumpW * 0.5, 0, Math.PI, false);
  ctx.arc(left + bumpW * 0.5, bottom, bumpW * 0.5, 0, Math.PI, false);
  // Left side back up
  ctx.lineTo(left, top + r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Eyes
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.18, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.3, -r * 0.35, r * 0.18, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- registry ---


function drawRocket(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // body — capsule pointing right
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.moveTo(r * 1.2, 0);
  ctx.lineTo(r * 0.2, -r * 0.5);
  ctx.lineTo(-r * 0.9, -r * 0.5);
  ctx.lineTo(-r * 0.9, r * 0.5);
  ctx.lineTo(r * 0.2, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // fins (accent)
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.5);
  ctx.lineTo(-r * 1.1, -r * 0.95);
  ctx.lineTo(-r * 0.6, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.5);
  ctx.lineTo(-r * 1.1, r * 0.95);
  ctx.lineTo(-r * 0.6, r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // window
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.arc(r * 0.35, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawHeart(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  // two lobes + point, drawn nose-right so motion reads forward
  ctx.moveTo(r * 0.9, 0);
  ctx.bezierCurveTo(r * 0.2, -r * 0.9, -r * 1.1, -r * 0.5, -r * 0.2, r * 0.05);
  ctx.bezierCurveTo(-r * 1.1, r * 0.5, r * 0.2, r * 0.9, r * 0.9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // accent notch
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.arc(-r * 0.15, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  ctx.fillStyle = rgbCss(skin.body);
  const spikes = 5;
  const outer = r * 1.05;
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const ang = (Math.PI / spikes) * i - Math.PI / 2;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // accent core
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

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
    id: "pixel-bird",
    name: "8-bit bird",
    blurb: "retro pixel silhouette, beak forward.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 30,
      hint: "score 30 in a single run",
    }),
    draw: drawPixelBird,
  },
  {
    id: "kite",
    name: "kite",
    blurb: "diamond proportion, with a tail.",
    unlock: ({ streakDays }) => ({
      unlocked: streakDays >= 3,
      hint: "3-day streak",
    }),
    draw: drawKite,
  },
  {
    id: "cyber-plane",
    name: "cyber drone",
    blurb: "angular sci-fi craft with engine notches.",
    unlock: ({ challengeWins, totalGames }) => ({
      unlocked: (challengeWins ?? 0) >= 3 || totalGames >= 200,
      hint: "win 3 challenges or play 200 games",
    }),
    draw: drawCyberPlane,
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
  {
    id: "rocket",
    name: "rocket",
    blurb: "finned capsule with a porthole.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 25,
      hint: "score 25 in a single run",
    }),
    draw: drawRocket,
  },
  {
    id: "heart",
    name: "heart",
    blurb: "for the ones you challenge.",
    unlock: ({ challengeWins }) => ({
      unlocked: (challengeWins ?? 0) >= 1,
      hint: "win a challenge",
    }),
    draw: drawHeart,
  },
  {
    id: "star",
    name: "star",
    blurb: "five points, glowing core.",
    unlock: ({ totalGames, streakDays }) => ({
      unlocked: totalGames >= 300 || streakDays >= 20,
      hint: "play 300 games or hold a 20-day streak",
    }),
    draw: drawStar,
  },
  {
    id: "flower",
    name: "petal",
    blurb: "six petals in bloom.",
    unlock: ({ streakDays }) => ({
      unlocked: streakDays >= 7,
      hint: "7-day streak",
    }),
    draw: drawFlower,
  },
  {
    id: "vector-bird",
    name: "birdie",
    blurb: "a side-profile bird, mid-flight.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 40,
      hint: "score 40 in one run",
    }),
    draw: drawVectorBird,
  },
  {
    id: "leaf",
    name: "leaf",
    blurb: "a simple leaf with a vein.",
    unlock: ({ totalGames }) => ({
      unlocked: totalGames >= 50,
      hint: "play 50 games",
    }),
    draw: drawLeaf,
  },
  {
    id: "lightning",
    name: "bolt",
    blurb: "a classic lightning bolt.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 55,
      hint: "score 55 in one run",
    }),
    draw: drawLightning,
  },
  {
    id: "ghost",
    name: "ghost",
    blurb: "a friendly ghost with a wavy hem.",
    unlock: ({ challengeWins }) => ({
      unlocked: (challengeWins ?? 0) >= 5,
      hint: "win 5 challenges",
    }),
    draw: drawGhost,
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
  challengeWins?: number;
  lateNightGames?: number;
  morningGames?: number;
  dailyStreakDays?: number;
  friendCount?: number;
}): ShapeId[] {
  return SHAPES.filter((s) => s.unlock(stats).unlocked).map((s) => s.id);
}
