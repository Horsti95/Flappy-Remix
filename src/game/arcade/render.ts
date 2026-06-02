import { type ArcadeConfig } from "./config";
import { ArcadeSim, EVENT_LABEL, type PowerUpKind } from "./sim";
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

/** Per-power-up colour + glyph, shared by the world token and the HUD. */
const POWERUP_STYLE: Record<PowerUpKind, { color: string; glyph: string }> = {
  shield: { color: "#4fc3f7", glyph: "🛡" },
  "slow-time": { color: "#b39ddb", glyph: "⏱" },
  magnet: { color: "#ff8a65", glyph: "🧲" },
  mini: { color: "#81d4fa", glyph: "▾" },
  giant: { color: "#ffab40", glyph: "▴" },
  "second-life": { color: "#69f0ae", glyph: "❤" },
  "gravity-flip": { color: "#f48fb1", glyph: "⇅" },
  rocket: { color: "#ffd54f", glyph: "🚀" },
  ghost: { color: "#e0f7fa", glyph: "👻" },
  frenzy: { color: "#ffee58", glyph: "2x" },
};

/**
 * Standalone renderer for Arcade Mode. Intentionally NOT the shared `Renderer`
 * (which is coupled to the deterministic `Sim` and its cosmetics) — Arcade owns
 * its own draw layers for coins, saws, portals, power-ups and the combo HUD so
 * the core renderer stays focused and untouched. Reuses the shared sky/theme +
 * shape drawing for a familiar look.
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

    // Full-screen effect washes so active power-ups/events read instantly.
    if (!this.options.highContrast) {
      if (sim.slowTimeRemaining > 0) this.wash("rgba(120,90,200,0.16)");
      if (sim.gravityFlipRemaining > 0) this.wash("rgba(244,143,177,0.12)");
      if (sim.frenzyRemaining > 0) this.wash("rgba(255,238,88,0.10)");
      if (sim.activeEvent === "low-gravity") this.wash("rgba(120,200,255,0.10)");
      if (sim.activeEvent === "coin-rush") this.wash("rgba(255,213,79,0.08)");
    }

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Pipes (solid segments include the double-gate mid bar).
    for (const p of sim.pipes) {
      const prev = sim.prevPipeXs.get(p.id);
      const x = prev !== undefined ? prev + (p.x - prev) * alpha : p.x;
      for (const seg of sim.solidSegments(p)) {
        ctx.fillStyle = palette.pipeBody;
        ctx.fillRect(x, seg.y0, cfg.pipeWidth, seg.y1 - seg.y0);
        ctx.fillStyle = palette.pipeCap;
        ctx.fillRect(x - 2, seg.y0, cfg.pipeWidth + 4, 6);
        ctx.fillRect(x - 2, seg.y1 - 6, cfg.pipeWidth + 4, 6);
      }
    }

    // Portals — swirled ring; linked pairs share a hue.
    for (const pt of sim.portals) {
      if (pt.used) continue;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      const rot = this.options.reducedMotion ? 0 : (performance.now() / 400) % (Math.PI * 2);
      ctx.rotate(rot);
      ctx.strokeStyle = pt.hue;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, cfg.portalRadius * 0.6, cfg.portalRadius, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, cfg.portalRadius * 0.3, cfg.portalRadius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Coins.
    for (const c of sim.coins) {
      ctx.save();
      ctx.translate(c.x, c.y);
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
      const style = POWERUP_STYLE[pu.kind];
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.fillStyle = style.color;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, cfg.powerUpRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(style.glyph, 0, 1);
      ctx.restore();
    }

    // Saws.
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

    // Bird.
    const by = sim.alive ? sim.prevBirdY + (sim.birdY - sim.prevBirdY) * alpha : sim.birdY;
    const r = sim.effectiveRadius();
    const tilt = this.options.reducedMotion ? 0 : Math.max(-0.6, Math.min(1.0, sim.birdVY / 600));

    if (sim.magnetRemaining > 0 && !this.options.reducedMotion) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,138,101,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cfg.birdX, by, cfg.magnetRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (sim.hasShield || sim.hasSecondLife) {
      ctx.save();
      ctx.strokeStyle = sim.hasShield ? "rgba(79,195,247,0.9)" : "rgba(105,240,174,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cfg.birdX, by, r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (sim.rocketRemaining > 0 && !this.options.reducedMotion) {
      ctx.save();
      ctx.translate(cfg.birdX - r, by);
      ctx.fillStyle = "rgba(255,179,0,0.9)";
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(-12 - Math.random() * 8, 0);
      ctx.lineTo(0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Invuln (post-revive / post-warp) blink, plus ghost translucency.
    const blink = sim.invulnRemaining > 0 && Math.floor(performance.now() / 100) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(cfg.birdX, by);
      ctx.rotate(tilt);
      if (sim.ghostRemaining > 0) ctx.globalAlpha = 0.45;
      getShape(this.options.shape).draw(ctx, r, this.options.skin, this.options.highContrast);
      ctx.restore();
    }

    // Floating text.
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

  private wash(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawHud(sim: ArcadeSim): void {
    const ctx = this.ctx;
    const cfg = this.cfg;
    const s = this.scale;
    const left = this.offsetX + 12 * s;
    const top = this.offsetY + 12 * s;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const cx = this.offsetX + (cfg.worldWidth / 2) * s;
    ctx.font = `bold ${Math.round(34 * s)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 4 * s;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.fillStyle = this.options.highContrast ? "#fff" : "#f4ead5";
    ctx.strokeText(String(sim.score), cx, top);
    ctx.fillText(String(sim.score), cx, top);

    // Event banner under the score.
    if (sim.activeEvent) {
      ctx.font = `bold ${Math.round(15 * s)}px system-ui,sans-serif`;
      ctx.fillStyle = "#fff";
      const label = `${EVENT_LABEL[sim.activeEvent]} · ${sim.eventRemaining.toFixed(0)}s`;
      ctx.strokeText(label, cx, top + 40 * s);
      ctx.fillText(label, cx, top + 40 * s);
    }

    // Coins + combo (top-left).
    ctx.textAlign = "left";
    ctx.font = `bold ${Math.round(16 * s)}px system-ui,sans-serif`;
    ctx.fillStyle = "#ffd54f";
    const coinLine = `🪙 ${sim.coinBalance}`;
    ctx.strokeText(coinLine, left, top);
    ctx.fillText(coinLine, left, top);
    if (sim.multiplier > 1) {
      ctx.fillStyle = "#ffe082";
      const my = top + 22 * s;
      const comboLine = `x${sim.multiplier}  combo ${sim.combo}`;
      ctx.strokeText(comboLine, left, my);
      ctx.fillText(comboLine, left, my);
    }

    // Active effects (top-right).
    ctx.textAlign = "right";
    const right = this.offsetX + (cfg.worldWidth - 12) * s;
    let ey = top;
    const eff = (kind: PowerUpKind, text: string): void => {
      ctx.fillStyle = POWERUP_STYLE[kind].color;
      ctx.strokeText(text, right, ey);
      ctx.fillText(text, right, ey);
      ey += 22 * s;
    };
    if (sim.hasShield) eff("shield", "🛡 shield");
    if (sim.hasSecondLife) eff("second-life", "❤ 1-up");
    if (sim.slowTimeRemaining > 0) eff("slow-time", `⏱ ${sim.slowTimeRemaining.toFixed(1)}`);
    if (sim.magnetRemaining > 0) eff("magnet", `🧲 ${sim.magnetRemaining.toFixed(1)}`);
    if (sim.miniRemaining > 0) eff("mini", `▾ ${sim.miniRemaining.toFixed(1)}`);
    if (sim.giantRemaining > 0) eff("giant", `▴ ${sim.giantRemaining.toFixed(1)}`);
    if (sim.gravityFlipRemaining > 0) eff("gravity-flip", `⇅ ${sim.gravityFlipRemaining.toFixed(1)}`);
    if (sim.rocketRemaining > 0) eff("rocket", `🚀 ${sim.rocketRemaining.toFixed(1)}`);
    if (sim.ghostRemaining > 0) eff("ghost", `👻 ${sim.ghostRemaining.toFixed(1)}`);
    if (sim.frenzyRemaining > 0) eff("frenzy", `2x ${sim.frenzyRemaining.toFixed(1)}`);

    if (sim.startGrace && sim.alive) {
      ctx.textAlign = "center";
      ctx.font = `${Math.round(16 * s)}px system-ui,sans-serif`;
      ctx.fillStyle = this.options.highContrast ? "#fff" : "#1a1a1a";
      ctx.fillText("tap to lift", cx, this.offsetY + cfg.worldHeight * 0.62 * s);
    }

    ctx.restore();
  }
}
