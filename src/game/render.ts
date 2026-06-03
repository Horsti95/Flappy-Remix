import { Sim } from "./sim";
import { type SimConfig } from "./config";
import { DEFAULT_SKIN, type SkinColors } from "./skin";
import { type GhostSim } from "./ghost";
import { DEFAULT_THEME_ID, getTheme, type ThemeId } from "./themes";
import { DEFAULT_SHAPE_ID, getShape, type ShapeId } from "./shapes";
import { getParticles, tickParticles } from "./flap-fx";
import { type VisualEffect } from "./daily-twist";
import { preloadSprites, hasSprite, getTintedSprite } from "./sprites";
import { getPillarStyle, type PillarStyleId } from "./pillars";
import { getPillarColor } from "./pillar-colors";
import { zoneFor } from "./depth-zones";
import { preloadBackgrounds, preloadBackgroundStages, hasBackgroundImage, getBackgroundImage } from "./backgrounds";

export interface RenderOptions {
  highContrast: boolean;
  skin: SkinColors;
  theme: ThemeId;
  shape: ShapeId;
  ghostSkin?: SkinColors;
  ghostShape?: ShapeId;
  reducedMotion: boolean;
  mirror?: boolean;
  /** Cosmetic daily overlay (night / sunset / blinding sun / rain). */
  visualEffect?: VisualEffect | null;
  /** Soft glow around the player's shape, tinted to the accent color.
   *  Auto-on for legendary skins; an unlockable FX can also drive it. */
  glow?: boolean;
  /** Player-picked pillar style (solid / glass / neon / stone). */
  pillarStyle?: PillarStyleId;
  /** Optional pillar colour id overriding the theme's pipe colours. */
  pillarColor?: string;
  /** Challenge-ghost opacity, 0..100 (%). */
  ghostOpacity?: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private cfg: SimConfig;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private overscanX = 0;
  private overscanY = 0;
  /** Interactive themes whose stage set we've already kicked off loading. */
  private stagesKicked = new Set<string>();
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
    preloadSprites();
    preloadBackgrounds();
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
    // Letterbox overscan in WORLD units: how far the visible canvas extends
    // past the world rect on each axis (contain-fit centers the world, so a
    // band appears top/bottom on tall screens, left/right on wide ones).
    // Used to bleed cosmetics (pillars) to the physical screen edge without
    // touching the fixed 360x640 sim — keeps runs deterministic + port-safe.
    this.overscanX = this.offsetX / this.scale;
    this.overscanY = this.offsetY / this.scale;
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

    // Full-art background image (cover-fit, centered) when the theme declares
    // one and its art has loaded. Painted over the fallback gradient; skipped
    // under high-contrast so the a11y palette stays clean. Cosmetic.
    // Interactive themes pick the stage for the highest score reached so the
    // backdrop "zooms out" as the run climbs.
    let bgId = theme.backgroundImage;
    if (theme.backgroundStages && theme.backgroundStages.length > 0) {
      // Kick off loading ALL stages the first time this theme renders, so later
      // stages are ready before the player climbs into them (no mid-run flash).
      if (!this.stagesKicked.has(theme.id)) {
        this.stagesKicked.add(theme.id);
        preloadBackgroundStages(theme.backgroundStages.map((s) => s.image));
      }
      let stageImg = theme.backgroundStages[0].image;
      for (const st of theme.backgroundStages) {
        if (sim.score >= st.fromScore) stageImg = st.image;
      }
      bgId = stageImg;
    }
    if (!this.options.highContrast && bgId && hasBackgroundImage(bgId)) {
      const img = getBackgroundImage(bgId);
      if (img && img.naturalWidth > 0) {
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      }
    }

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

    // Daily visual overlays — sky-tint pass, in screen space so it covers
    // the whole canvas (incl. letterbox bands). Cosmetic only.
    const fx = this.options.highContrast ? null : this.options.visualEffect;
    if (fx === "night" || fx === "sunset") {
      const tint = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      if (fx === "night") {
        tint.addColorStop(0, "rgba(8,12,40,0.62)");
        tint.addColorStop(1, "rgba(2,4,18,0.72)");
      } else {
        tint.addColorStop(0, "rgba(120,40,110,0.42)");
        tint.addColorStop(0.55, "rgba(240,120,50,0.30)");
        tint.addColorStop(1, "rgba(255,190,90,0.30)");
      }
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else if (fx === "blinding_sun") {
      // Bright bloom on the right where new pipes enter, making them hard
      // to read until close. A warm wash first so the glare reads as sun.
      ctx.fillStyle = "rgba(255,238,180,0.18)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const gx = this.offsetX + this.cfg.worldWidth * 0.92 * this.scale;
      const gy = this.offsetY + this.cfg.worldHeight * 0.3 * this.scale;
      const gr = this.cfg.worldWidth * 0.7 * this.scale;
      const glare = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      glare.addColorStop(0, "rgba(255,250,225,0.92)");
      glare.addColorStop(0.4, "rgba(255,245,205,0.45)");
      glare.addColorStop(1, "rgba(255,245,205,0)");
      ctx.fillStyle = glare;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Depth-zone tint — deepens the sky as the player advances through the
    // theme's zones (cosmetic; screen space so it covers the letterbox).
    const zone = this.options.highContrast ? null : zoneFor(this.options.theme, sim.score);
    if (zone?.tint) {
      ctx.fillStyle = zone.tint.color;
      ctx.globalAlpha = zone.tint.alpha;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
    }

    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    if (this.options.mirror) {
      ctx.translate(this.cfg.worldWidth / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-this.cfg.worldWidth / 2, 0);
    }

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

    // Bleed the pillar bodies into the top/bottom letterbox overscan so they
    // reach the physical screen edge instead of stopping at the world rect.
    // Purely cosmetic — the gap geometry (gapY..gapY+gapH) is untouched, so
    // collision + determinism are unchanged.
    const over = this.overscanY;
    const pillarStyle = getPillarStyle(this.options.pillarStyle);
    // Optional player colour override (ignored under high-contrast for a11y).
    const pc = this.options.highContrast ? null : getPillarColor(this.options.pillarColor);
    const pillarBody = pc ? pc.body : palette.pipeBody;
    const pillarCap = pc ? pc.cap : palette.pipeCap;
    for (const p of sim.pipes) {
      const prev = sim.prevPipeXs.get(p.id);
      const x = prev !== undefined ? prev + (p.x - prev) * alpha : p.x;
      pillarStyle.draw({
        ctx,
        x,
        gapY: p.gapY,
        gapH: p.gapH,
        worldHeight: cfg.worldHeight,
        pipeWidth: cfg.pipeWidth,
        over,
        bodyColor: pillarBody,
        capColor: pillarCap,
        highContrast: this.options.highContrast,
      });
    }

    const ghostAlpha = (this.options.ghostOpacity ?? 25) / 100;
    if (ghost && ghost.isAlive() && ghostAlpha > 0) {
      const gy = ghost.prevBirdY() + (ghost.birdY() - ghost.prevBirdY()) * alpha;
      ctx.globalAlpha = ghostAlpha;
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
    this.drawShape(cfg.birdX, by, tilt, this.options.skin, this.options.shape, sim.cfg.birdRadius, true);

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

    // Fog: a radial reveal around the bird. Driven by the fog THEME
    // (fogIntensity) or the fog daily VISUAL modifier (thicker).
    const fogAmount = this.options.highContrast
      ? 0
      : fx === "fog"
        ? 0.92
        : (theme.colors.fogIntensity ?? 0);
    if (fogAmount > 0) {
      const cx = cfg.birdX;
      const cy = by;
      const radius = cfg.worldWidth * 0.45;
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius);
      grad.addColorStop(0, `rgba(205, 214, 221, 0)`);
      grad.addColorStop(1, `rgba(205, 214, 221, ${fogAmount})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cfg.worldWidth, cfg.worldHeight);
    }

    // Ambient theme decoration — ocean bubbles / space stars. Decorative,
    // world-space, deterministic-lattice + wall-clock drift (never feeds the
    // sim). Static under reduced motion.
    if (!this.options.highContrast && (this.options.theme === "ocean" || this.options.theme === "space")) {
      const W = cfg.worldWidth;
      const H = cfg.worldHeight;
      const t = this.options.reducedMotion ? 0 : (performance.now() % 6000) / 6000;
      ctx.save();
      if (this.options.theme === "ocean") {
        // Warm yellow motes — read as shafts of sunlight filtering down.
        ctx.fillStyle = "rgba(255,224,130,0.28)";
        for (let i = 0; i < 18; i++) {
          const ph = (i * 0.6180339) % 1;
          const x = (ph * W + i * 13) % W;
          const y = H - ((t + ph) % 1) * (H + 20); // rise upward
          const r = 1.2 + (i % 3);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // starfield — twinkle via alpha, no movement needed
        for (let i = 0; i < 40; i++) {
          const ph = (i * 0.6180339) % 1;
          const x = (ph * W * 1.7) % W;
          const y = ((i * 0.39) % 1) * H;
          const tw = 0.35 + 0.45 * Math.abs(Math.sin((t * Math.PI * 2) + i));
          ctx.fillStyle = `rgba(255,255,255,${tw.toFixed(2)})`;
          ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
      }
      ctx.restore();
    }

    // Rain overlay — animated streaks in world space. Purely visual; a
    // fixed lattice scrolled by wall-clock time so it never feeds the sim.
    // Skipped under reduced motion (static dampening tint instead).
    if (fx === "rain") {
      if (this.options.reducedMotion) {
        ctx.fillStyle = "rgba(140,160,190,0.10)";
        ctx.fillRect(0, 0, cfg.worldWidth, cfg.worldHeight);
      } else {
        const W = cfg.worldWidth;
        const H = cfg.worldHeight;
        const t = (performance.now() % 1000) / 1000;
        ctx.save();
        ctx.strokeStyle = "rgba(190,205,225,0.35)";
        ctx.lineWidth = 1.2;
        const cols = 26;
        for (let i = 0; i < cols; i++) {
          // Deterministic-ish per-column offset so streaks don't align.
          const phase = (i * 0.61803) % 1;
          const x = ((i / cols) * W + phase * 14) % W;
          const yBase = ((t + phase) % 1) * (H + 40) - 40;
          ctx.beginPath();
          ctx.moveTo(x, yBase);
          ctx.lineTo(x - 3, yBase + 14);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Score counter — a rounded pill with a soft glow so it reads on any
    // background. Hidden in practice/no-fail mode (no score to chase there).
    if (!sim.noFail) {
      const txt = String(sim.score);
      const cx = cfg.worldWidth / 2;
      const cy = 38;
      ctx.save();
      ctx.font = "bold 34px system-ui,sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const w = Math.max(46, ctx.measureText(txt).width + 28);
      const h = 44;
      const rx = cx - w / 2;
      const ry = cy - h / 2;
      const rad = h / 2;
      // Pill background
      ctx.beginPath();
      ctx.moveTo(rx + rad, ry);
      ctx.arcTo(rx + w, ry, rx + w, ry + h, rad);
      ctx.arcTo(rx + w, ry + h, rx, ry + h, rad);
      ctx.arcTo(rx, ry + h, rx, ry, rad);
      ctx.arcTo(rx, ry, rx + w, ry, rad);
      ctx.closePath();
      if (this.options.highContrast) {
        ctx.fillStyle = "#000";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "rgba(20,20,28,0.55)";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.stroke();
        ctx.fillStyle = "#f4ead5";
      }
      ctx.fillText(txt, cx, cy + 1);
      // Depth-zone label under the score pill.
      if (zone) {
        ctx.font = "600 13px system-ui,sans-serif";
        ctx.fillStyle = this.options.highContrast ? "#fff" : "rgba(244,234,213,0.85)";
        ctx.fillText(zone.label, cx, cy + 34);
      }
      ctx.restore();
    }

    if (sim.startGrace && sim.alive) {
      ctx.fillStyle = this.options.highContrast ? "#fff" : "#1a1a1a";
      ctx.font = "16px system-ui,sans-serif";
      ctx.fillText("tap to lift", cfg.worldWidth / 2, cfg.worldHeight * 0.62);
    }

    // Letterbox frame: darken just the bands outside the world rect so they
    // read as an intentional frame instead of raw bright sky — important when
    // a dark theme meets a light-blue overscan. Screen space; cosmetic only.
    if (this.overscanX > 0.5 || this.overscanY > 0.5) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      const W = this.canvas.width;
      const H = this.canvas.height;
      if (this.offsetY > 0.5) {
        ctx.fillRect(0, 0, W, this.offsetY);
        ctx.fillRect(0, H - this.offsetY, W, this.offsetY);
      }
      if (this.offsetX > 0.5) {
        ctx.fillRect(0, 0, this.offsetX, H);
        ctx.fillRect(W - this.offsetX, 0, this.offsetX, H);
      }
    }

    ctx.restore();
  }

  private drawShape(x: number, y: number, tilt: number, skin: SkinColors, shapeId: ShapeId, radius?: number, isPlayer = false): void {
    const ctx = this.ctx;
    const r = radius ?? this.cfg.birdRadius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // Glow: a soft accent-tinted halo behind the player's shape. We used to
    // show this for every legendary skin, but the disc-behind-the-plane read
    // as a bug on dark skins (e.g. the black/pink legendary). Now it's gated
    // to the ocean theme only, where it reads naturally as a diver's light.
    // Player-only (never the ghost), off under reduced-motion/high-contrast.
    if (isPlayer && this.options.glow && this.options.theme === "ocean"
        && !this.options.highContrast && !this.options.reducedMotion) {
      ctx.save();
      ctx.shadowColor = `rgb(${skin.accent.join(",")})`;
      ctx.shadowBlur = r * 1.2;
      ctx.fillStyle = `rgb(${skin.accent.join(",")})`;
      // Two stacked discs build up a bloom via the shadow; the discs
      // themselves are tiny so they don't show, only their glow does.
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fill();
      ctx.restore();
    }
    // Sprite-backed shapes draw a tinted bitmap when it's loaded; otherwise
    // (offline / pre-load / high-contrast) fall back to the polygon draw.
    const tinted = !this.options.highContrast && hasSprite(shapeId)
      ? getTintedSprite(shapeId, skin)
      : null;
    if (tinted) {
      // The sprite art faces right; size it to ~the collision diameter so it
      // sits where the polygon would. Cosmetic only — hitbox is unchanged.
      const size = r * 3.0;
      ctx.drawImage(tinted, -size / 2, -size / 2, size, size);
    } else {
      getShape(shapeId).draw(ctx, r, skin, this.options.highContrast);
    }
    ctx.restore();
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale };
  }
}
