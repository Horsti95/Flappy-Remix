import type { PillarDrawCtx } from "./pillars";
import type { PaperPackId } from "./paper-packs";

/** Matte folded planes, not round glossy tubes. Decorations are clipped to
 * the existing solid bodies; gap/caps have exactly the legacy dimensions. */
export function drawPaperPillars(p: PillarDrawCtx, id: PaperPackId): void {
  const { ctx, x, pipeWidth: w, gapY, gapH, worldHeight, over } = p;
  const body = (y: number, h: number): void => {
    if (h <= 0) return;
    ctx.fillStyle = p.bodyColor;
    ctx.fillRect(x, y, w, h);
    if (p.highContrast) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(x, y, w * .3, h);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(x + w * .77, y, w * .23, h);
    ctx.strokeStyle = "rgba(255,255,255,.30)";
    ctx.lineWidth = 1;
    const line = (...points: number[]): void => {
      ctx.beginPath(); ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.stroke();
    };
    const cx = x + w / 2;
    for (let yy = Math.floor(y / 64) * 64; yy < y + h; yy += 64) {
      switch (id) {
        case "paper-germany":
          line(x, yy, x + w, yy + 64); line(x + w, yy, x, yy + 64); break;
        case "paper-cup":
          for (let k = 0; k < 4; k++) line(x + k * w / 3, yy, x + k * w / 3, yy + 64);
          line(x, yy + 20, x + w, yy + 20); line(x, yy + 42, x + w, yy + 42); break;
        case "paper-japan":
          for (let k = 0; k <= 4; k++) line(cx, yy + 52, x + k * w / 4, yy + 8);
          break;
        case "paper-northern-lights":
          line(x, yy, cx, yy + 44, x + w, yy); line(cx, yy, cx, yy + 64); break;
        case "paper-canada":
          line(cx, yy + 57, cx, yy + 10); line(cx, yy + 42, x + 8, yy + 27, x + 12, yy + 42, cx, yy + 48, x + w - 9, yy + 30);
          break;
        case "paper-russia":
          ctx.fillStyle = "rgba(15,32,49,.3)";
          ctx.fillRect(x, yy + 10, w * .38, 3); ctx.fillRect(x + w * .6, yy + 35, w * .4, 3);
          line(x + w * .55, yy, x + w * .45, yy + 64); break;
        case "paper-new-year":
          line(cx, yy + 12, cx, yy + 48); line(x + 10, yy + 30, x + w - 10, yy + 30);
          line(x + 15, yy + 18, x + w - 15, yy + 42); line(x + 15, yy + 42, x + w - 15, yy + 18); break;
        case "paper-cyberpunk":
          ctx.strokeStyle = "#75edf1"; ctx.lineWidth = 1.5;
          line(x + 6, yy, x + 6, yy + 36, cx, yy + 46, cx, yy + 64);
          ctx.fillStyle = p.capColor; ctx.fillRect(x + w - 11, yy + 15, 4, 23); break;
      }
    }
    ctx.restore();
  };
  body(-over, gapY + over);
  body(gapY + gapH, worldHeight - gapY - gapH + over);
  ctx.fillStyle = p.capColor;
  ctx.fillRect(x - 3, gapY - 14, w + 6, 14);
  ctx.fillRect(x - 3, gapY + gapH, w + 6, 14);
  if (!p.highContrast) {
    // Paper lip shadows lie inside the caps, never inside the opening.
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(x - 3, gapY - 2, w + 6, 2);
    ctx.fillRect(x - 3, gapY + gapH, w + 6, 2);
    ctx.fillStyle = "rgba(255,255,255,.3)";
    ctx.fillRect(x - 3, gapY - 14, w + 6, 2);
    ctx.fillRect(x - 3, gapY + gapH + 12, w + 6, 2);
  }
}
