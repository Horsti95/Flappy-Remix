import { PAPER_PACKS } from "../../src/game/paper-packs";
import { DEFAULT_CONFIG } from "../../src/game/config";
import { getTheme, setEquippedThemeLocal } from "../../src/game/themes";
import { getShape } from "../../src/game/shapes";
import { getPillarStyle, setEquippedPillarLocal } from "../../src/game/pillars";
import { setEquippedPillarColorLocal } from "../../src/game/pillar-colors";
import { getBackgroundImage } from "../../src/game/backgrounds";
import { preloadSprites, getTintedSprite, getSpriteContentBox } from "../../src/game/sprites";
import { getSpriteFrame } from "../../src/game/sprite-layout";
import { setEquippedPresetLocal } from "../../src/game/preset-skins";
import { setEquippedShapeLocal } from "../../src/social/skins";
import { setEquippedAchievementColorLocal } from "../../src/game/achievement-equip";
import type { SkinColors } from "../../src/game/skin";

const descriptions = ["Salbeigrüne Falten, Fachwerk-Kreuze & ruhiger Papierwald.",
  "Ein eigener Papierpokal — ohne Verbandslogos oder offizielle Turniermarken.",
  "Washi-Fächer, Kirschblüten und ein Koi für den Papierhimmel.",
  "Kristallfalten, ein stiller Fjord und Aurora-Bänder aus Papier.",
  "Ahornfarbene Säulen, Herbstwald und eine gefaltete Kanadagans.",
  "Birkenfalten, Schnee und der rote Akzent eines Wintervogels.",
  "Goldene Papiersterne und eine Wunschlaterne. Ohne blinkende Effekte.",
  "Neon-Kanten auf mattem Papier. Kein Glow, der die Fluglücke verdeckt."];
const hitbox = document.querySelector<HTMLInputElement>("#hitbox")!;
const contrast = document.querySelector<HTMLInputElement>("#contrast")!;
const tilt = document.querySelector<HTMLInputElement>("#tilt")!;
const status = document.querySelector<HTMLElement>("#status")!;
const cards = PAPER_PACKS.map((pack, i) => {
  const article = document.createElement("article");
  article.innerHTML = `<canvas class="scene" width="360" height="640" aria-label="${pack.name} Spielvorschau"></canvas>
    <div class="details"><div class="meta"><canvas class="icon" width="128" height="128" aria-label="${pack.shapeName}"></canvas>
    <div><div class="tag">0${i + 1} / Paper World</div><h2>${pack.name.split(" — ")[0]}</h2><p class="figure-name">${pack.shapeName}</p></div></div>
    <p class="caption">${descriptions[i]}</p><button disabled>Set lokal testen · ${pack.name.split(" — ")[0]}</button></div>`;
  const button = article.querySelector<HTMLButtonElement>("button")!;
  button.addEventListener("click", () => {
    setEquippedShapeLocal(pack.shapeId);
    setEquippedThemeLocal(pack.id);
    setEquippedPillarLocal(pack.id);
    setEquippedPillarColorLocal("theme");
    setEquippedPresetLocal(pack.presetId);
    setEquippedAchievementColorLocal(null);
    window.location.assign("/");
  });
  document.querySelector("#cards")!.append(article);
  return { pack, article, button, scene: article.querySelector<HTMLCanvasElement>(".scene")!, icon: article.querySelector<HTMLCanvasElement>(".icon")! };
});
preloadSprites();

function draw(): boolean {
  let ready = 0;
  for (const {pack, article, button, scene, icon} of cards) {
    const skin: SkinColors = { body: [...pack.body], accent: [...pack.accent] };
    const bg = getBackgroundImage(pack.id);
    const sprite = getTintedSprite(pack.shapeId, skin);
    const box = getSpriteContentBox(pack.shapeId);
    const loaded = !!(bg && sprite && box);
    ready += Number(loaded); button.disabled = !loaded;
    article.dataset.assets = loaded ? "ready" : "loading";
    const theme = getTheme(pack.id);
    const colors = contrast.checked ? theme.colors.highContrast : theme.colors;
    const ctx = scene.getContext("2d")!;
    ctx.clearRect(0, 0, 360, 640);
    const grad = ctx.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, colors.skyTop); grad.addColorStop(1, colors.skyBottom);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 360, 640);
    if (bg && !contrast.checked) {
      const scale = Math.max(360 / bg.naturalWidth, 640 / bg.naturalHeight);
      const w = bg.naturalWidth * scale, h = bg.naturalHeight * scale;
      ctx.drawImage(bg, (360-w)/2, (640-h)/2, w, h);
    }
    getPillarStyle(pack.id).draw({ctx, x:240, gapY:225, gapH:DEFAULT_CONFIG.pipeGapBase,
      worldHeight:640, pipeWidth:DEFAULT_CONFIG.pipeWidth, over:0,
      bodyColor:colors.pipeBody, capColor:colors.pipeCap, highContrast:contrast.checked });
    const bird = (c: CanvasRenderingContext2D): void => {
      c.save(); c.rotate(Number(tilt.value) * Math.PI / 180);
      if (!contrast.checked && sprite && box) {
        const f = getSpriteFrame(sprite.width, sprite.height, box, DEFAULT_CONFIG.birdRadius);
        c.drawImage(sprite, f.sx, f.sy, f.sw, f.sh, f.dx, f.dy, f.dw, f.dh);
      } else getShape(pack.shapeId).draw(c, DEFAULT_CONFIG.birdRadius, skin, contrast.checked);
      c.restore();
      if (hitbox.checked) {
        c.strokeStyle = "#f44f69"; c.lineWidth = .8; c.beginPath();
        c.arc(0, 0, DEFAULT_CONFIG.birdRadius, 0, Math.PI*2); c.stroke();
      }
    };
    ctx.save(); ctx.translate(DEFAULT_CONFIG.birdX, 310); bird(ctx); ctx.restore();
    const ic = icon.getContext("2d")!; ic.clearRect(0,0,128,128);
    ic.save(); ic.translate(64,64); ic.scale(2.5,2.5); bird(ic); ic.restore();
  }
  document.querySelector("#angle")!.textContent = `${tilt.value}°`;
  status.textContent = ready === 8 ? "8 / 8 Sets geladen · lokal spielbar · Freischaltideen noch nicht aktiviert" : `${ready} / 8 Sets geladen…`;
  return ready === 8;
}
for (const input of [hitbox, contrast, tilt]) input.addEventListener("input", draw);
let attempts = 0;
const timer = window.setInterval(() => {
  if (draw()) window.clearInterval(timer);
  else if (++attempts > 150) {
    window.clearInterval(timer);
    status.textContent = "Nicht alle Bilder konnten geladen werden. Bitte Seite neu laden; noch ladende Sets bleiben deaktiviert.";
  }
}, 200);
draw();
