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
  | "ghost"
  | "crane"
  | "submarine"
  | "soccer-ball"
  | "pretzel"
  // Two-colour origami sprites (body colour + a distinct accent colour),
  // backed by the layered sprite pipeline (see scripts/prep-sprite-2color.mjs
  // and game/sprites.ts).
  | "swan"
  | "swan2"
  | "envelope"
  | "rocket-origami"
  | "butterfly-origami"
  | "songbird"
  | "sparrow"
  | "heart-origami"
  | "dove"
  | "eagle"
  | "dove2"
  | "submarine-origami"
  | "leaf-origami";

/**
 * Visual-direction grouping ("Paper Sky"):
 *  - "paper": the core fleet — things that belong in a paper sky
 *    (folded paper, kites, petals, birds, weather…).
 *  - "contraband": off-vibe novelty shapes that have no business flying,
 *    kept around as a playful smugglers' section in the gallery.
 */
export type ShapeCategory = "paper" | "contraband";

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
  /** Gallery grouping — see {@link ShapeCategory}. Purely presentational. */
  category: ShapeCategory;
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
  /**
   * Optional sprite filename (without extension / `/sprites/` prefix) when the
   * shape is sprite-backed and its sprite name differs from its id (e.g. the
   * origami "rocket-origami" shape uses the "rocket" sprite). Defaults to the
   * shape id. See game/sprites.ts.
   */
  sprite?: string;
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
  // Four triangular panels alternating body/accent (a-b-a-b pinwheel) so the
  // two colors interleave around the diamond instead of splitting it in half.
  const top = -r * 0.95, bot = r * 0.95, right = r * 0.9, left = -r * 0.9;
  const body = rgbCss(skin.body);
  const accent = rgbCss(skin.accent);
  // Each panel is the triangle (apex)→(center)→(side).
  const panel = (apexY: number, sideX: number, fill: string): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, apexY);
    ctx.lineTo(0, 0);
    ctx.lineTo(sideX, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  // TL=accent, TR=body, BR=accent, BL=body (clockwise a-b-a-b).
  panel(top, left, accent);  // top-left
  panel(top, right, body);   // top-right
  panel(bot, right, accent); // bottom-right
  panel(bot, left, body);    // bottom-left
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
  // The butterfly is drawn top-down/symmetric; tilt it ~40° clockwise so it
  // reads as flying forward-right rather than facing the camera.
  ctx.save();
  ctx.rotate(Math.PI * 0.22); // ~40°
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
  ctx.restore();
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

// Polygon fallback for the sprite-backed toucan (used before the PNG loads
// or if image loading is unavailable). A chunky body + forward beak so it
// still reads as a bird.
function drawToucanFallback(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, 0, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Beak
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.25);
  ctx.lineTo(r * 1.5, -r * 0.05);
  ctx.lineTo(r * 0.55, r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Eye
  ctx.fillStyle = highContrast ? "#fff" : "#1a1a1a";
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

// Submarine — a rounded hull (body) with a conning tower + porthole (accent),
// nose to the right. Polygon-drawn, fully tintable; no sprite needed.
function drawSubmarine(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  outline(ctx, highContrast);
  // Hull
  ctx.fillStyle = rgbCss(skin.body);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Tail propeller fin
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, 0);
  ctx.lineTo(-r * 1.35, -r * 0.4);
  ctx.lineTo(-r * 1.35, r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Conning tower
  ctx.fillStyle = rgbCss(skin.accent);
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.5);
  ctx.lineTo(-r * 0.1, -r * 0.95);
  ctx.lineTo(r * 0.25, -r * 0.95);
  ctx.lineTo(r * 0.35, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Periscope
  ctx.beginPath();
  ctx.moveTo(r * 0.05, -r * 0.95);
  ctx.lineTo(r * 0.05, -r * 1.25);
  ctx.lineTo(r * 0.3, -r * 1.25);
  ctx.stroke();
  // Porthole
  ctx.fillStyle = highContrast ? "#fff" : "#1a1a1a";
  ctx.beginPath();
  ctx.arc(r * 0.45, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawSoccerBall(ctx: CanvasRenderingContext2D, r: number, _skin: SkinColors, highContrast: boolean): void {
  // Minimalist 1960s "Telstar" football: white ball, black pentagon panels.
  // Colours are fixed (not skin-tinted) so it always reads as the classic ball.
  const white = highContrast ? "#ffffff" : "#f4f4f4";
  const black = highContrast ? "#000000" : "#161616";
  const cR = r * 0.3;
  const oR = r * 0.23;
  const oRad = r * 0.7;
  // Ball
  ctx.fillStyle = white;
  ctx.strokeStyle = black;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Thin seams: centre→outer (offset 36°) and gap→rim (vertex angles).
  ctx.lineWidth = Math.max(0.6, r * 0.04);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * cR * 0.95, Math.sin(a) * cR * 0.95);
    ctx.lineTo(Math.cos(a) * (oRad - oR), Math.sin(a) * (oRad - oR));
    ctx.stroke();
  }
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * oRad, Math.sin(a) * oRad);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  // Panels.
  const fillPent = (cx: number, cy: number, rad: number, rot: number): void => {
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const a = rot + (j * 2 * Math.PI) / 5;
      const x = cx + rad * Math.cos(a);
      const y = cy + rad * Math.sin(a);
      j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = black;
  fillPent(0, 0, cR, -Math.PI / 2);
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    fillPent(Math.cos(a) * oRad, Math.sin(a) * oRad, oR, a);
  }
  ctx.lineWidth = 1.5;
}


function drawPretzel(ctx: CanvasRenderingContext2D, r: number, skin: SkinColors, highContrast: boolean): void {
  // Twisted dough drawn as thick rounded strokes; salt grains in the accent.
  ctx.strokeStyle = rgbCss(skin.body);
  ctx.lineWidth = r * 0.42;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const s = r / 14; // the path below was authored at r≈14
  const px = (x: number): number => x * s;
  ctx.beginPath();
  ctx.moveTo(px(-3), px(-8));
  ctx.bezierCurveTo(px(-19), px(-17), px(-22), px(3), px(-7), px(8));
  ctx.bezierCurveTo(px(-2), px(10), px(2), px(10), px(7), px(8));
  ctx.bezierCurveTo(px(22), px(3), px(19), px(-17), px(3), px(-8));
  ctx.stroke();
  // The two crossing strands at the top knot.
  ctx.beginPath();
  ctx.moveTo(px(-3), px(-8));
  ctx.lineTo(px(7), px(8));
  ctx.moveTo(px(3), px(-8));
  ctx.lineTo(px(-7), px(8));
  ctx.stroke();
  // Thin dark outline pass for definition.
  ctx.strokeStyle = highContrast ? "#ffffff" : "#1a1a1a";
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.moveTo(px(-3), px(-8));
  ctx.bezierCurveTo(px(-19), px(-17), px(-22), px(3), px(-7), px(8));
  ctx.bezierCurveTo(px(-2), px(10), px(2), px(10), px(7), px(8));
  ctx.bezierCurveTo(px(22), px(3), px(19), px(-17), px(3), px(-8));
  ctx.stroke();
  // Salt.
  ctx.fillStyle = rgbCss(skin.accent);
  for (const [dx, dy] of [[-9, -2], [9, -2], [0, 9], [-4, 3], [4, 3]] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(px(dx), px(dy), r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1.5;
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
    category: "paper",
    blurb: "the classic. starts unlocked.",
    unlock: () => ({ unlocked: true, hint: null }),
    draw: drawPaperPlaneClassic,
  },
  {
    id: "paper-plane-v2",
    name: "paper plane (refined)",
    category: "paper",
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
    category: "contraband",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "paper",
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
    category: "contraband",
    blurb: "a friendly ghost with a wavy hem.",
    unlock: ({ challengeWins }) => ({
      unlocked: (challengeWins ?? 0) >= 5,
      hint: "win 5 challenges",
    }),
    draw: drawGhost,
  },
  // NOTE: "toucan" shape removed for now — its source art has a baked
  // light-blue background (not transparent), so the tint filled the whole
  // square. On hold until we have a clean grayscale/transparent toucan.
  {
    id: "crane",
    name: "origami crane",
    category: "paper",
    blurb: "folded-paper crane — a real sprite, tinted to your color.",
    unlock: ({ streakDays }) => ({
      unlocked: streakDays >= 5,
      hint: "5-day streak",
    }),
    draw: drawToucanFallback,
  },
  {
    id: "submarine",
    name: "submarine",
    category: "contraband",
    blurb: "dive the deep — periscope up.",
    unlock: ({ totalGames }) => ({
      unlocked: totalGames >= 60,
      hint: "play 60 games",
    }),
    draw: drawSubmarine,
  },
  {
    id: "soccer-ball",
    name: "football",
    category: "contraband",
    blurb: "world-cup ready — score a goal.",
    unlock: ({ bestScore }) => ({
      unlocked: bestScore >= 20,
      hint: "score 20 in a single run",
    }),
    draw: drawSoccerBall,
  },
  {
    id: "pretzel",
    name: "pretzel",
    category: "contraband",
    blurb: "Brezel — a taste of Germany.",
    unlock: ({ totalGames }) => ({
      unlocked: totalGames >= 30,
      hint: "play 30 games",
    }),
    draw: drawPretzel,
  },
  // --- Two-colour origami sprites ---------------------------------------
  // Real layered sprites (body colour + a distinct accent colour). On THIS
  // inspection branch every one is force-unlocked so the owner can equip and
  // preview each; real unlock conditions land before merge. Fallback polygon
  // is the toucan body so they still read as a flyer pre-load / high-contrast.
  {
    id: "swan",
    name: "origami swan",
    category: "paper",
    sprite: "swan",
    blurb: "folded-paper swan, wings raised.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "swan2",
    name: "origami swan (gliding)",
    category: "paper",
    sprite: "swan2",
    blurb: "a second swan, mid-glide.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "envelope",
    name: "love letter",
    category: "paper",
    sprite: "envelope",
    blurb: "a sealed paper envelope.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "rocket-origami",
    name: "paper rocket",
    category: "contraband",
    sprite: "rocket",
    blurb: "folded rocket — contraband fuel.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "butterfly-origami",
    name: "origami butterfly",
    category: "paper",
    sprite: "butterfly",
    blurb: "a folded butterfly, wings spread.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "songbird",
    name: "origami songbird",
    category: "paper",
    sprite: "songbird",
    blurb: "a perched paper songbird.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "sparrow",
    name: "origami sparrow",
    category: "paper",
    sprite: "sparrow",
    blurb: "a plump folded sparrow.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "heart-origami",
    name: "origami heart",
    category: "paper",
    sprite: "heart",
    blurb: "a folded-paper heart.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "dove",
    name: "origami dove",
    category: "paper",
    sprite: "dove",
    blurb: "a folded dove in flight.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "eagle",
    name: "origami eagle",
    category: "paper",
    sprite: "eagle",
    blurb: "a sharp paper eagle, wing raised.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "dove2",
    name: "origami dove (gliding)",
    category: "paper",
    sprite: "dove2",
    blurb: "a second dove, beak forward.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "submarine-origami",
    name: "paper submarine",
    category: "contraband",
    sprite: "submarine",
    blurb: "a folded submarine — periscope up.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
  },
  {
    id: "leaf-origami",
    name: "origami leaf",
    category: "paper",
    sprite: "leaf",
    blurb: "a folded maple leaf.",
    unlock: () => ({ unlocked: true, hint: null }), // TODO real unlock pre-merge
    draw: drawToucanFallback,
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
