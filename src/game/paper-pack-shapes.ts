import { rgbCss, type SkinColors } from "./skin";
import type { PaperPackShapeId } from "./paper-packs";
import { SPRITE_FOOTPRINT } from "./sprite-layout";

/** Small, centered paper silhouettes used before bitmaps load / in contrast mode.
 * All coordinates fit the same normalized envelope. Never read by the sim. */
export function drawPaperPackShape(id: PaperPackShapeId, ctx: CanvasRenderingContext2D,
  r: number, skin: SkinColors, hc: boolean): void {
  ctx.save();
  const scale = r * SPRITE_FOOTPRINT;
  ctx.scale(scale, scale);
  ctx.lineWidth = 1 / scale;
  ctx.lineJoin = "round";
  ctx.strokeStyle = hc ? "#ffffff" : "#242733";
  const polygon = (points: number[], accent = false): void => {
    ctx.fillStyle = hc ? (accent ? "#444444" : "#111111") : rgbCss(accent ? skin.accent : skin.body);
    ctx.beginPath(); ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  if (id === "pack-trophy") {
    polygon([-0.95,-0.6,-0.5,-0.6,-0.4,0,-0.8,-0.15]);
    polygon([0.95,-0.6,0.5,-0.6,0.4,0,0.8,-0.15]);
    polygon([-0.6,-0.85,0.6,-0.85,0.45,-0.05,0,0.3,-0.45,-0.05]);
    polygon([-0.14,0.2,0.14,0.2,0.14,0.65,0.55,0.85,-0.55,0.85,-0.14,0.65], true);
    polygon([0,-0.85,0.6,-0.85,0.45,-0.05,0,0.3], true);
  } else if (id === "pack-koi") {
    polygon([-0.5,0,-0.98,-0.5,-0.83,0,-0.98,0.5], true);
    polygon([-0.6,0,-0.15,-0.48,0.55,-0.4,0.98,0,0.55,0.4,-0.15,0.48]);
    polygon([-0.2,-0.45,0.35,-0.3,0.15,0.28,-0.35,0.12], true);
  } else if (id === "pack-lantern") {
    polygon([-0.65,-0.55,-0.4,-0.85,0.4,-0.85,0.65,-0.55,0.55,0.65,-0.55,0.65]);
    polygon([-0.16,-0.85,0.16,-0.85,0.27,0.65,-0.27,0.65], true);
    polygon([-0.42,0.65,0.42,0.65,0.3,0.9,-0.3,0.9], true);
  } else {
    const compact = id === "pack-puffin" || id === "pack-bullfinch";
    polygon([-0.45,0.15,-0.95,-0.25,-0.8,0.45,0.05,0.52]);
    polygon([-0.62,0.1,-0.35,-0.32,0.4,-0.52,0.75,-0.23,0.65,0.36,0.02,0.6]);
    polygon([-0.5,0.04,compact ? -0.12 : -0.38,compact ? -0.62 : -0.95,0.26,-0.12,0.03,0.38], id === "pack-raven");
    polygon([0.62,-0.32,0.98,-0.08,0.65,0.08], true);
    if (id === "pack-bullfinch") polygon([0.03,0.02,0.64,0.04,0.5,0.4,0.02,0.6], true);
  }
  ctx.restore();
}
