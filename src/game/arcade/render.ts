import { type ArcadeConfig } from "./config";
import { ArcadeSim } from "./sim";
import { DEFAULT_SKIN, type SkinColors } from "../skin";
import { DEFAULT_SHAPE_ID, getShape, type ShapeId } from "../shapes";
import { DEFAULT_THEME_ID, getTheme, type ThemeId } from "../themes";

export interface ArcadeRenderOptions {
  skin: SkinColors;
  shape: ShapeId;
  theme: ThemeId;
  highContrast: boolean;
  reducedMotion: boolean;
}

/**
 * Standalone renderer for Arcade Mode. Intentionally NOT the shared `Renderer`
 * (which is coupled to the deterministic `Sim` and its cosmetics) — Arcade owns
 * its own draw layers for coins, saws, power-ups and the combo HUD so the core
 * renderer stays focused and untouched. Reuses the shared sky/theme + shape
 * drawing for a familiar look.
 */
export class ArcadeRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cfg: ArcadeConfig;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  options: ArcadeRenderOptions;

  constructor(canvas: HTMLCanvasElement, cfg: ArcadeConfig, options?: Partial<ArcadeRenderOptions>) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.cfg = cfg;
    this.options = {
      skin: DEFAULT_SKIN,
      shape: DEFAULT_SHAPE_ID,
      theme: DEFAULT_THEME_ID,
      highContrast: false,
      reducedMotion: false,
      ...options,
    };
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const sx = (cssW * dpr) / this.cfg.worldWidth;
    const sy = (cssH * dpr) / this.cfg.worldHeight;
    this.scale = Math.min(sx, sy);
    this.offsetX = (cssW * dpr - this.cfg.worldWidth * this.scale) / 2;
    this.offsetY = (cssH * dpr - this.cfg.worldHeight * this.scale) / 2;
  }

  draw(sim: ArcadeSim, alphaIn: number): void {
    const alpha = this.options.reducedMotion ? 0 : alphaIn;
    const ctx = this.ctx;
    const cfg = this.cfg;
    const theme = getTheme(this.options.theme);
    const palette = this.options.highContrast ? theme.colors.highContrast : theme.colors;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Sky.
    const grd = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grd.addColorStop(0, palette.skyTop);
    grd.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Slow-time wash — a cool tint so the effect reads instantly.
    if (sim.slowTimeRemaining > 0 && !this.options.highContrast) {
      ctx.fillStyle = "rgba(120,90,200,0.16)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Pipes.
    for (const p of sim.pipes) {
      const prev = sim.prevPipeXs.get(p.id);
      const x = prev !== undefined ? prev + (p.x - prev) * alpha : p.x;
      ctx.fillStyle = palette.pipeBody;
      ctx.fillRect(x, 0, cfg.pipeWidth, p.gapY);
      ctx.fillRect(x, p.gapY + p.gapH, cfg.pipeWidth, cfg.worldHeight - (p.gapY + p.gapH));
      ctx.fillStyle = palette.pipeCap;
      ctx.fillRect(x - 2, p.gapY - 10, cfg.pipeWidth + 4, 10);
      ctx.fillRect(x - 2, p.gapY + p.gapH, cfg.pipeWidth + 4, 10);
    }

    // Coins.
    for (const c of sim.coins) {
      const x = c.x;
      ctx.save();
      ctx.translate(x, c.y);
      ctx.fillStyle = "#ffd54f";
      ctx.strokeStyle = "#f9a825";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, cfg.coinRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff8e1";
      ctx.fillRect(-2, -cfg.coinRadius * 0.5, 4, cfg.coinRadius);
      ctx.restore();
    }

    // Power-ups.
    for (const pu of sim.powerUps) {
      ctx.save();
      ctx.translate(pu.x, pu.y);
      const color = pu.kind === "shield" ? "#4fc3f7" : "#b39ddb";
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, cfg.powerUpRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pu.kind === "shield" ? "🛡" : "⏱", 0, 1);
      ctx.restore();
    }

    // Saws — a spinning toothed disc.
    for (const s of sim.saws) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.options.reducedMotion ? 0 : s.spin);
      const R = cfg.sawRadius;
      ctx.fillStyle = this.options.highContrast ? "#fff" : "#cfd8dc";
      ctx.strokeStyle = "#455a64";
      ctx.lineWidth = 1.5;
      const teeth = 10;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const ang = (Math.PI * i) / teeth;
        const rad = i % 2 === 0 ? R : R * 0.74;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#607d8b";
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bird (with shield ring if held).
    const by = sim.alive ? sim.prevBirdY + (sim.birdY - sim.prevBirdY) * alpha : sim.birdY;
    const tilt = this.options.reducedMotion ? 0 : Math.max(-0.6, Math.min(1.0, sim.birdVY / 600));
    if (sim.hasShield) {
      ctx.save();
      ctx.strokeStyle = "rgba(79,195,247,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cfg.birdX, by, cfg.birdRadius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cfg.birdX, by);
    ctx.rotate(tilt);
    getShape(this.options.shape).draw(ctx, cfg.birdRadius, this.options.skin, this.options.highContrast);
    ctx.restore();

    // Floating text (perfect / pickups).
    if (!this.options.reducedMotion) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 14px system-ui,sans-serif";
      for (const f of sim.floats) {
        ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.restore();
    }

    ctx.restore();

    this.drawHud(sim);
  }

  private drawHud(sim: ArcadeSim): void {
    const ctx = this.ctx;
    const cfg = this.cfg;
    const left = this.offsetX + 12 * this.scale;
    const top = this.offsetY + 12 * this.scale;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Score (center pill).
    const cx = this.offsetX + (cfg.worldWidth / 2) * this.scale;
    ctx.font = `bold ${Math.round(34 * this.scale)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = this.options.highContrast ? "#fff" : "#f4ead5";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 4 * this.scale;
    ctx.strokeText(String(sim.score), cx, top);
    ctx.fillText(String(sim.score), cx, top);

    // Coins + combo (top-left).
    ctx.textAlign = "left";
    ctx.font = `bold ${Math.round(16 * this.scale)}px system-ui,sans-serif`;
    ctx.fillStyle = "#ffd54f";
    ctx.strokeText(`🪙 ${sim.coinBalance}`, left, top);
    ctx.fillText(`🪙 ${sim.coinBalance}`, left, top);
    if (sim.multiplier > 1) {
      ctx.fillStyle = "#ffe082";
      const my = top + 22 * this.scale;
      ctx.strokeText(`x${sim.multiplier}  combo ${sim.combo}`, left, my);
      ctx.fillText(`x${sim.multiplier}  combo ${sim.combo}`, left, my);
    }

    // Active effects (top-right).
    ctx.textAlign = "right";
    const right = this.offsetX + (cfg.worldWidth - 12) * this.scale;
    let ey = top;
    if (sim.hasShield) {
      ctx.fillStyle = "#4fc3f7";
      ctx.strokeText("🛡 shield", right, ey);
      ctx.fillText("🛡 shield", right, ey);
      ey += 22 * this.scale;
    }
    if (sim.slowTimeRemaining > 0) {
      ctx.fillStyle = "#b39ddb";
      ctx.strokeText(`⏱ ${sim.slowTimeRemaining.toFixed(1)}s`, right, ey);
      ctx.fillText(`⏱ ${sim.slowTimeRemaining.toFixed(1)}s`, right, ey);
    }

    if (sim.startGrace && sim.alive) {
      ctx.textAlign = "center";
      ctx.font = `${Math.round(16 * this.scale)}px system-ui,sans-serif`;
      ctx.fillStyle = this.options.highContrast ? "#fff" : "#1a1a1a";
      ctx.fillText("tap to lift", cx, this.offsetY + cfg.worldHeight * 0.62 * this.scale);
    }

    ctx.restore();
  }
}
