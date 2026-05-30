import { Sim } from "./sim";
import { type SimConfig } from "./config";
import { DEFAULT_SKIN, type SkinColors } from "./skin";
import { type GhostSim } from "./ghost";
import { DEFAULT_THEME_ID, getTheme, type ThemeId } from "./themes";
import { DEFAULT_SHAPE_ID, getShape, type ShapeId } from "./shapes";
import { getParticles, tickParticles } from "./flap-fx";

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

    // Horizon band (beach / ocean). Painted before skyline so a beach
    // theme could in principle stack both layers.
    if (!this.options.highContrast && theme.colors.horizonBand) {
      const h = theme.colors.horizonBand;
      const grad = ctx.createLinearGradient(0, h.topY, 0, cfg.worldHeight);
      grad.addColorStop(0, h.topColor);
      grad.addColorStop(1, h.bottomColor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, h.topY, cfg.worldWidth, cfg.worldHeight - h.topY);
      if (h.second) {
        const g2 = ctx.createLinearGradient(0, h.second.topY, 0, cfg.worldHeight);
        g2.addColorStop(0, h.second.topColor);
        g2.addColorStop(1, h.second.bottomColor);
        ctx.fillStyle = g2;
        ctx.fillRect(0, h.second.topY, cfg.worldWidth, cfg.worldHeight - h.second.topY);
      }
    }

    // Skyline backdrop (cyberpunk themes). Painted before pipes so they
    // sit visually in front. Buildings + neon-window dots are static
    // — the world drifts past via the pipes, not the skyline.
    if (!this.options.highContrast && theme.colors.cityLayer) {
      const city = theme.colors.cityLayer;
      ctx.fillStyle = city.silhouetteColor;
      for (const b of city.buildings) {
        ctx.fillRect(b.x, b.topY, b.w, cfg.worldHeight - b.topY);
        if (b.top === "antenna") {
          ctx.fillRect(b.x + b.w / 2 - 0.6, b.topY - 14, 1.2, 14);
        } else if (b.top === "step") {
          ctx.fillRect(b.x + 4, b.topY - 8, b.w - 8, 8);
        }
      }
      // Neon windows — a deterministic grid per building so the same
      // skyline looks the same on every redraw.
      for (let bi = 0; bi < city.buildings.length; bi++) {
        const b = city.buildings[bi];
        const accent = city.neonAccents[bi % city.neonAccents.length];
        ctx.fillStyle = accent;
        const cols = Math.max(2, Math.floor(b.w / 7));
        const rows = Math.max(3, Math.floor((cfg.worldHeight - b.topY) / 14));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            // Pseudorandom but deterministic mask so only some windows
            // glow — avoids one giant grid of dots.
            if (((bi * 13 + r * 7 + c * 5) % 6) >= 3) continue;
            const x = b.x + 3 + c * (b.w / cols);
            const y = b.topY + 4 + r * 14;
            ctx.fillRect(x, y, 2.2, 3.2);
          }
        }
      }
    }

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

    // Flap-FX particles. Painted after the bird so they trail behind it
    // visually. Tick happens on each draw call using a fixed assumed
    // dt — the sim is 60 Hz, render is whatever the browser gives us,
    // so we approximate via 1/60. Particles are visual-only and never
    // feed the sim back, so this is safe.
    if (!this.options.reducedMotion) {
      tickParticles(1 / 60);
      const particles = getParticles();
      if (particles.length > 0) {
        ctx.save();
        for (const p of particles) {
          const t = p.age / p.life;
          const alpha = Math.max(0, 1 - t);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.strokeStyle = p.color;
          const px = p.x + p.dx;
          const py = p.y + p.dy;
          switch (p.kind) {
            case "puff": {
              const r = 3 + t * 6;
              ctx.beginPath();
              ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.fill();
              break;
            }
            case "line": {
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px - 10 - t * 14, py);
              ctx.stroke();
              break;
            }
            case "sparkle": {
              const r = 1.4 + (1 - t) * 1.2;
              ctx.fillRect(px - r / 2, py - r / 2, r, r);
              break;
            }
            case "ring": {
              const r = 4 + t * 30;
              ctx.lineWidth = 2 * (1 - t);
              ctx.beginPath();
              ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.stroke();
              break;
            }
          }
        }
        ctx.restore();
      }
    }

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
      ctx.fillText("tap to lift", cfg.worldWidth / 2, cfg.worldHeight * 0.62);
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
