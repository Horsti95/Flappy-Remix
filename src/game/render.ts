import { Sim } from "./sim";
import { type SimConfig } from "./config";
import { DEFAULT_SKIN, type SkinColors } from "./skin";
import { type GhostSim } from "./ghost";
import { DEFAULT_THEME_ID, getTheme, type ThemeId } from "./themes";
import { DEFAULT_SHAPE_ID, getShape, type ShapeId } from "./shapes";

export interface RenderOptions {
  highContrast: boolean;
  skin: SkinColors;
  theme: ThemeId;
  shape: ShapeId;
  ghostSkin?: SkinColors;
  ghostShape?: ShapeId;
  reducedMotion: boolean;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cfg: SimConfig;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  options: RenderOptions;

  constructor(canvas: HTMLCanvasElement, cfg: SimConfig, options?: Partial<RenderOptions>) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.cfg = cfg;
    this.options = {
      highContrast: false,
      skin: DEFAULT_SKIN,
      theme: DEFAULT_THEME_ID,
      shape: DEFAULT_SHAPE_ID,
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

  draw(sim: Sim, alphaIn: number, ghost?: GhostSim | null): void {
    const alpha = this.options.reducedMotion ? 0 : alphaIn;
    const ctx = this.ctx;
    const cfg = this.cfg;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const theme = getTheme(this.options.theme);
    const palette = this.options.highContrast ? theme.colors.highContrast : theme.colors;
    const grd = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grd.addColorStop(0, palette.skyTop);
    grd.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.options.highContrast && theme.colors.sunSpot) {
      const s = theme.colors.sunSpot;
      const sxPx = this.offsetX + s.x * this.scale;
      const syPx = this.offsetY + s.y * this.scale;
      const rPx = s.r * this.scale;
      const radial = ctx.createRadialGradient(sxPx, syPx, 0, sxPx, syPx, rPx);
      radial.addColorStop(0, s.color);
      radial.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = radial;
      ctx.globalAlpha = s.opacity;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    for (const p of sim.pipes) {
      const prev = sim.prevPipeXs.get(p.id);
      const x = prev !== undefined ? prev + (p.x - prev) * alpha : p.x;
      ctx.fillStyle = palette.pipeBody;
      ctx.fillRect(x, 0, cfg.pipeWidth, p.gapY);
      ctx.fillRect(x, p.gapY + p.gapH, cfg.pipeWidth, cfg.worldHeight - (p.gapY + p.gapH));
      ctx.fillStyle = palette.pipeCap;
      ctx.fillRect(x - 3, p.gapY - 14, cfg.pipeWidth + 6, 14);
      ctx.fillRect(x - 3, p.gapY + p.gapH, cfg.pipeWidth + 6, 14);
    }

    if (ghost && ghost.isAlive()) {
      const gy = ghost.prevBirdY() + (ghost.birdY() - ghost.prevBirdY()) * alpha;
      ctx.globalAlpha = 0.25;
      this.drawShape(
        cfg.birdX,
        gy,
        0,
        this.options.ghostSkin ?? { body: [200, 200, 200], accent: [80, 80, 80] },
        this.options.ghostShape ?? this.options.shape,
        sim.cfg.birdRadius,
      );
      ctx.globalAlpha = 1;
    }

    const by = sim.alive ? sim.prevBirdY + (sim.birdY - sim.prevBirdY) * alpha : sim.birdY;
    const tilt = this.options.reducedMotion ? 0 : Math.max(-0.6, Math.min(1.0, sim.birdVY / 600));
    this.drawShape(cfg.birdX, by, tilt, this.options.skin, this.options.shape, sim.cfg.birdRadius);

    if (!this.options.highContrast && theme.colors.fogIntensity) {
      const cx = cfg.birdX;
      const cy = by;
      const radius = cfg.worldWidth * 0.45;
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
      grad.addColorStop(0, `rgba(205, 214, 221, 0)`);
      grad.addColorStop(1, `rgba(205, 214, 221, ${theme.colors.fogIntensity})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cfg.worldWidth, cfg.worldHeight);
    }

    ctx.fillStyle = this.options.highContrast ? "#fff" : "#1a1a1a";
    ctx.font = "bold 36px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(String(sim.score), cfg.worldWidth / 2, 24);

    if (sim.startGrace && sim.alive) {
      ctx.fillStyle = this.options.highContrast ? "#fff" : "#1a1a1a";
      ctx.font = "16px system-ui,sans-serif";
      ctx.fillText("tap to flap", cfg.worldWidth / 2, cfg.worldHeight * 0.62);
    }

    ctx.restore();
  }

  private drawShape(x: number, y: number, tilt: number, skin: SkinColors, shapeId: ShapeId, radius?: number): void {
    const ctx = this.ctx;
    const r = radius ?? this.cfg.birdRadius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    getShape(shapeId).draw(ctx, r, skin, this.options.highContrast);
    ctx.restore();
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale };
  }
}
