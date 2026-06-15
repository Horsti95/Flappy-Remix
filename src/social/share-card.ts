import { DEFAULT_SKIN, type SkinColors } from "../game/skin";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { TIER_COLOR, TIER_LABEL, type Tier } from "../game/daily-twist";
import { DEFAULT_SHAPE_ID, getShape, type ShapeId } from "../game/shapes";
import { DEFAULT_THEME_ID, getTheme, type Theme, type ThemeId } from "../game/themes";
import { hasBackgroundImage, getBackgroundImage } from "../game/backgrounds";
import { hasSprite, getTintedSprite, getSpriteContentBox } from "../game/sprites";
import { getPillarStyle, type PillarStyleId } from "../game/pillars";
import { getPillarColor } from "../game/pillar-colors";
import { auraColor, type AuraId } from "../game/aura";

export interface ShareCardData {
  shape?: ShapeId;
  themeId?: ThemeId;
  /** Equipped pillar style/colour + aura, so the card mirrors the actual run. */
  pillarStyleId?: PillarStyleId;
  pillarColorId?: string;
  auraId?: AuraId;
  score: number;
  username: string | null;
  skin: SkinColors;
  rarity?: Rarity;
  streakDays: number;
  mode: "casual" | "daily" | "challenge" | "ranked";
  dailyDate?: string | null;
  dailyRank?: number | null;
  totalPlayed?: number | null;
  dailyTier?: Tier | null;
  dailyModifierLabel?: string | null;
  topRank?: number | null;
  /** When this share card targets a specific friend (e.g. via the
   *  'Challenge a friend' flow), include their handle so the copy
   *  can say "for @lennart". Null for open challenges. */
  addressedTo?: string | null;
  /** Challenge short id for the 'Challenge a friend' flow. When set, the
   *  share link routes the recipient straight into the ghost run; without
   *  it the link can't find the challenge. */
  challengeShortId?: string | null;
  brand?: string;
}

const W = 1080;
const H = 1920;

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2d context unavailable");

  // Background gradient — pulls from the equipped theme so a share
  // looks like the world the player was actually flying through.
  // Wrapped in a dark overlay so text + score still read clearly.
  const theme = getTheme(data.themeId ?? DEFAULT_THEME_ID);
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme.colors.skyTop);
  grad.addColorStop(1, theme.colors.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // If the theme has full-art backdrop loaded, paint it (cover-fit) so the
  // share actually looks like the world the player flew — gradient is the
  // fallback for image themes whose art hasn't loaded. Interactive themes use
  // a representative middle stage.
  const bgId =
    theme.backgroundImage ??
    theme.backgroundStages?.[Math.floor((theme.backgroundStages.length - 1) / 2)]?.image;
  if (bgId && hasBackgroundImage(bgId)) {
    const img = getBackgroundImage(bgId);
    if (img && img.naturalWidth > 0) {
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
  }
  // Uniform — but lighter — dark wash so text stays legible against any
  // sky/art while the equipped world still reads in colour.
  ctx.fillStyle = "rgba(10,10,20,0.30)";
  ctx.fillRect(0, 0, W, H);

  // Soft horizon arc
  ctx.fillStyle = "#87ceeb22";
  ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.62, W * 0.9, H * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gameplay diorama: a pair of pillars in the equipped style + colour with a
  // gap the bird is gliding through — so the card looks like an actual moment
  // from the run, not a static badge. Drawn before the bird so it sits in front.
  drawPillarScene(ctx, data, theme);

  // Vignette — darken the edges so the eye lands on the bird + score.
  const vg = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.22, W / 2, H * 0.5, H * 0.64);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Brand watermark top
  ctx.fillStyle = "#f4ead5";
  ctx.font = "600 56px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(data.brand ?? "Glide", 96, 96);

  ctx.font = "500 28px system-ui,sans-serif";
  ctx.fillStyle = "#f4ead5aa";
  const sub = data.mode === "daily"
    ? `daily · ${data.dailyDate ?? "today"}`
    : data.mode === "challenge"
      ? "challenge"
      : data.mode === "ranked"
        ? "ranked"
        : "casual run";
  ctx.fillText(sub, 96, 168);

  // Tier + modifier subline on daily share cards.
  if (data.mode === "daily" && data.dailyTier) {
    ctx.font = "700 24px system-ui,sans-serif";
    ctx.fillStyle = TIER_COLOR[data.dailyTier];
    ctx.fillText(TIER_LABEL[data.dailyTier].toUpperCase(), 96, 210);
    if (data.dailyModifierLabel) {
      ctx.font = "500 22px system-ui,sans-serif";
      ctx.fillStyle = "#f4ead588";
      ctx.fillText(data.dailyModifierLabel, 96 + 130, 212);
    }
  }

  // Streak + ranked-badge chips top-right
  let chipY = 96;
  if (data.topRank && data.topRank <= 100) {
    drawChip(ctx, W - 96 - 280, chipY, 280, 88, `top ${data.topRank}`, "#facc15");
    chipY += 100;
  }
  if (data.streakDays > 0) {
    drawChip(ctx, W - 96 - 280, chipY, 280, 88, `streak ${data.streakDays}`);
  }

  // Motion: speed streaks + soft puffs trailing the bird (drawn first, so the
  // bird sits on top). Then the bird with its aura glow, gliding through the gap.
  drawSpeedTrail(ctx, W / 2, H * 0.42, 240, data.skin, data.auraId);
  drawShareShape(ctx, W / 2, H * 0.42, 240, data.skin, data.shape ?? DEFAULT_SHAPE_ID, data.auraId);

  // Score
  ctx.fillStyle = "#f4ead5";
  ctx.textAlign = "center";
  ctx.font = "900 360px system-ui,sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(data.score), W / 2, H * 0.74);
  ctx.font = "500 36px system-ui,sans-serif";
  ctx.fillStyle = "#f4ead5cc";
  ctx.fillText("score", W / 2, H * 0.74 + 60);

  // Rarity label — centered below the skin preview
  if (data.rarity) {
    ctx.font = "700 32px system-ui,sans-serif";
    ctx.fillStyle = RARITY_COLOR[data.rarity];
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`${data.rarity} skin`, W / 2, H * 0.42 + 155);
  }

  // Rarity / username band
  ctx.font = "700 44px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4ead5";
  const left = 96;
  const baselineY = H - 280;
  const handle = data.username ? `@${data.username}` : "anon";
  ctx.fillText(handle, left, baselineY);

  // Daily rank
  if (data.mode === "daily" && data.dailyRank) {
    ctx.font = "700 44px system-ui,sans-serif";
    ctx.fillStyle = "#facc15";
    ctx.textAlign = "right";
    ctx.fillText(`#${data.dailyRank}`, W - 96, baselineY);
    ctx.font = "500 28px system-ui,sans-serif";
    ctx.fillStyle = "#f4ead5cc";
    ctx.fillText(
      data.totalPlayed ? `of ${data.totalPlayed}` : "today",
      W - 96,
      baselineY + 44,
    );
    ctx.textAlign = "left";
  }

  // CTA line — invite via the player's handle (friend codes are retired;
  // friends are added by @username now).
  ctx.textAlign = "center";
  ctx.font = "500 32px system-ui,sans-serif";
  ctx.fillStyle = "#f4ead5aa";
  ctx.fillText("can you beat it?", W / 2, H - 160);
  ctx.font = "500 28px system-ui,sans-serif";
  ctx.fillStyle = "#f4ead588";
  ctx.fillText("glide.uno", W / 2, H - 92);
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  color = "#f4ead5",
): void {
  ctx.fillStyle = color === "#f4ead5" ? "#f4ead51a" : color + "22";
  roundRect(ctx, x, y, w, h, 44);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = "700 36px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * The equipped pillar pair, drawn into a band of the card in the player's
 * pillar style + colour. Three pillars (centre gap aligned to the bird, sides
 * offset) give a real "scrolling field" feel. Uses the pillar draw functions
 * verbatim — their numeric args double as canvas coords, so we translate to the
 * scene's top and treat `worldHeight` as the band height.
 */
function drawPillarScene(ctx: CanvasRenderingContext2D, data: ShareCardData, theme: Theme): void {
  const style = getPillarStyle(data.pillarStyleId ?? "solid");
  const pc = data.pillarColorId ? getPillarColor(data.pillarColorId) : null;
  const bodyColor = pc && pc.body ? pc.body : theme.colors.pipeBody;
  const capColor = pc && pc.cap ? pc.cap : theme.colors.pipeCap;

  const sceneTop = H * 0.14;
  const sceneH = H * 0.50; // band: 0.14H .. 0.64H
  const over = 60;
  const pipeWidth = 168;
  const gapH = 360;
  const birdSceneY = H * 0.42 - sceneTop; // bird sits at H*0.42 on the card
  const clampGap = (gy: number): number => Math.max(over, Math.min(gy, sceneH - gapH - over));
  // [left-edge x, gap-centre] — `x` is the pillar's LEFT edge (see bodies()),
  // so the centre pillar is offset by half its width to sit under the bird.
  // Its gap holds the bird; the side pillars vary for a real scrolling field.
  const pillars: Array<[number, number]> = [
    [W * 0.02, birdSceneY - 150],
    [W / 2 - pipeWidth / 2, birdSceneY],
    [W * 0.76, birdSceneY + 120],
  ];
  ctx.save();
  ctx.translate(0, sceneTop);
  // Parallax back layer — a dimmer, slimmer pillar row set further back for depth.
  ctx.save();
  ctx.globalAlpha = 0.32;
  for (const [x, gapCentre] of [[W * 0.32, birdSceneY - 250], [W * 0.68, birdSceneY + 230]] as Array<[number, number]>) {
    style.draw({
      ctx, x, gapY: clampGap(gapCentre - (gapH + 90) / 2), gapH: gapH + 90,
      worldHeight: sceneH, pipeWidth: pipeWidth * 0.62, over, bodyColor, capColor, highContrast: false,
    });
  }
  ctx.restore();
  // Foreground pillars.
  for (const [x, gapCentre] of pillars) {
    style.draw({
      ctx,
      x,
      gapY: clampGap(gapCentre - gapH / 2),
      gapH,
      worldHeight: sceneH,
      pipeWidth,
      over,
      bodyColor,
      capColor,
      highContrast: false,
    });
  }
  ctx.restore();
}

/** Anime-style motion behind the bird: tapered speed streaks + a couple of soft
 *  puffs, tinted by the equipped aura (or the skin accent). Pure flair. */
function drawSpeedTrail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  skin: SkinColors,
  auraId?: AuraId,
): void {
  const tint = (auraId ? auraColor(auraId) : null) ?? skin.accent;
  const col = `rgb(${tint.join(",")})`;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  // Soft puffs drifting back.
  ctx.fillStyle = col;
  for (let i = 1; i <= 3; i++) {
    ctx.globalAlpha = 0.2 - i * 0.045;
    ctx.beginPath();
    ctx.arc(-size * (0.5 + i * 0.4), size * 0.05 * i, Math.max(8, size * (0.24 - i * 0.05)), 0, Math.PI * 2);
    ctx.fill();
  }
  // Tapered speed streaks extending left from the bird.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  const streaks: Array<[number, number, number]> = [
    [-size * 0.28, size * 1.5, 10],
    [-size * 0.06, size * 2.1, 15],
    [size * 0.14, size * 1.8, 12],
    [size * 0.32, size * 1.2, 8],
  ];
  for (const [y, len, w] of streaks) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, y);
    ctx.lineTo(-size * 0.5 - len, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShareShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  skin: SkinColors,
  shapeId: ShapeId,
  auraId?: AuraId,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  // Earned aura: a soft halo in the aura's colour behind the bird — mirrors the
  // in-game render (radius ≈ 0.55r, blur ≈ 1.5r; size ≈ 2r here).
  const aura = auraId ? auraColor(auraId) : null;
  if (aura) {
    ctx.save();
    ctx.shadowColor = `rgb(${aura.join(",")})`;
    ctx.shadowBlur = size * 0.75;
    ctx.fillStyle = `rgb(${aura.join(",")})`;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fill();
    ctx.restore();
  }
  ctx.rotate(-0.18);
  // Sprite-backed shapes (origami swan/dove/butterfly/…) must paint their PNG
  // sprite — the same path the in-game renderer uses. Their `.draw` is only a
  // polygon FALLBACK, so calling it directly rendered the wrong silhouette on
  // the share card. The sprite filename can differ from the shape id (e.g.
  // "rocket-origami" → "rocket"), so resolve it via the optional `sprite` field.
  const spriteId = getShape(shapeId).sprite ?? shapeId;
  const tinted = hasSprite(spriteId) ? getTintedSprite(spriteId, skin) : null;
  if (tinted) {
    // Normalise to the same footprint as in-game: trim transparent padding via
    // the content box and scale the longer content side to 1.25× the nominal
    // size (≈ SPRITE_FOOTPRINT × hitbox diameter in render.ts).
    const target = size * 1.25;
    const box = getSpriteContentBox(spriteId);
    if (box) {
      const sw = tinted.width, sh = tinted.height;
      const sx = box.x * sw, sy = box.y * sh, srcW = box.w * sw, srcH = box.h * sh;
      const scl = target / Math.max(srcW, srcH);
      const dw = srcW * scl, dh = srcH * scl;
      ctx.drawImage(tinted, sx, sy, srcW, srcH, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.drawImage(tinted, -target / 2, -target / 2, target, target);
    }
  } else {
    // Vector shapes (and the offline/not-yet-loaded sprite fallback): the draw
    // functions are radius-based; size ≈ 2r so we feed r = size/2 and the
    // existing canvas math takes care of the rest. Strokes scale with the
    // transform.
    const s = size / 28;
    ctx.scale(s, s);
    ctx.lineWidth = 1.5 / s;
    getShape(shapeId).draw(ctx, 14, skin, false);
  }
  ctx.restore();
}

export async function shareCardBlob(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawShareCard(canvas, data);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
      0.92,
    ),
  );
}

export { DEFAULT_SKIN };
