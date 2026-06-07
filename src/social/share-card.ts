import { DEFAULT_SKIN, type SkinColors } from "../game/skin";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { TIER_COLOR, TIER_LABEL, type Tier } from "../game/daily-twist";
import { DEFAULT_SHAPE_ID, getShape, type ShapeId } from "../game/shapes";
import { DEFAULT_THEME_ID, getTheme, type ThemeId } from "../game/themes";
import { hasBackgroundImage, getBackgroundImage } from "../game/backgrounds";

export interface ShareCardData {
  shape?: ShapeId;
  themeId?: ThemeId;
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
  // Dark overlay so text stays legible against any sky/art.
  ctx.fillStyle = "rgba(10,10,20,0.45)";
  ctx.fillRect(0, 0, W, H);

  // Soft horizon arc
  ctx.fillStyle = "#87ceeb22";
  ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.62, W * 0.9, H * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

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

  // Skin preview
  drawShareShape(ctx, W / 2, H * 0.42, 260, data.skin, data.shape ?? DEFAULT_SHAPE_ID);

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
  ctx.fillText("pflug.app", W / 2, H - 92);
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

function drawShareShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  skin: SkinColors,
  shapeId: ShapeId,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  // The shape draw functions are radius-based; size ≈ 2r so we feed
  // r = size/2 and the existing canvas math takes care of the rest.
  // Strokes inside scale uniformly with the transform.
  const s = size / 28;
  ctx.scale(s, s);
  ctx.lineWidth = 1.5 / s;
  getShape(shapeId).draw(ctx, 14, skin, false);
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
