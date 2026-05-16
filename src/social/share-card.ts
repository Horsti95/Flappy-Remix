import { DEFAULT_SKIN, type SkinColors } from "../game/skin";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { TIER_COLOR, TIER_LABEL, type Tier } from "../game/daily-twist";

export interface ShareCardData {
  score: number;
  username: string | null;
  skin: SkinColors;
  rarity?: Rarity;
  streakDays: number;
  friendCode: string | null;
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
  brand?: string;
}

const W = 1080;
const H = 1920;

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("2d context unavailable");

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1a1a1a");
  grad.addColorStop(1, "#3a4d6b");
  ctx.fillStyle = grad;
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
  ctx.fillText(data.brand ?? "Pflug", 96, 96);

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
  drawPlane(ctx, W / 2, H * 0.42, 260, data.skin);

  // Score
  ctx.fillStyle = "#f4ead5";
  ctx.textAlign = "center";
  ctx.font = "900 360px system-ui,sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(data.score), W / 2, H * 0.74);
  ctx.font = "500 36px system-ui,sans-serif";
  ctx.fillStyle = "#f4ead5cc";
  ctx.fillText("score", W / 2, H * 0.74 + 60);

  // Rarity / username band
  ctx.font = "700 44px system-ui,sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4ead5";
  const left = 96;
  const baselineY = H - 280;
  const handle = data.username ? `@${data.username}` : "anon";
  ctx.fillText(handle, left, baselineY);

  if (data.rarity) {
    ctx.font = "500 28px system-ui,sans-serif";
    ctx.fillStyle = RARITY_COLOR[data.rarity];
    ctx.fillText(`${data.rarity} skin`, left, baselineY + 44);
  }

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

  // Friend code line + CTA
  ctx.textAlign = "center";
  ctx.font = "500 32px system-ui,sans-serif";
  ctx.fillStyle = "#f4ead5aa";
  ctx.fillText("can you beat it?", W / 2, H - 160);
  if (data.friendCode) {
    ctx.font = "800 56px ui-monospace,Menlo,monospace";
    ctx.fillStyle = "#f4ead5";
    ctx.fillText(data.friendCode, W / 2, H - 92);
  } else {
    ctx.font = "500 28px system-ui,sans-serif";
    ctx.fillStyle = "#f4ead588";
    ctx.fillText("play at pflug.app", W / 2, H - 92);
  }
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

function drawPlane(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  skin: SkinColors,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  const s = size / 30;
  ctx.scale(s, s);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#1a1a1a";
  // Top body
  ctx.fillStyle = `rgb(${skin.body.join(",")})`;
  ctx.beginPath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(14, -6);
  ctx.lineTo(1, 0);
  ctx.lineTo(14, -6);
  ctx.lineTo(-1, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Accent fold
  ctx.fillStyle = `rgb(${skin.accent.join(",")})`;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(-14, 6);
  ctx.lineTo(-1, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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
