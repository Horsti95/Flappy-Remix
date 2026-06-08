import { listOwnedSkins, getCachedOwnedSkins, type SkinRow } from "../social/skins";
import { unlockProgress } from "../game/unlockables";
import { tierForUnlock, tierRank, TIER_COLOR, TIER_LABEL, type Tier } from "../game/tiers";
import { RARITY_COLOR, rarityRank } from "../game/rarity";
import { SHAPES, type ShapeId, type ShapeMeta } from "../game/shapes";
import { soccerBallSvg } from "./shape-svg";
import { DEFAULT_SKIN } from "../game/skin";
import {
  ACHIEVEMENTS,
  loadAchievementStats,
  type AchievementDef,
  type AchievementStats,
} from "../game/achievements";
import {
  FLAP_SOUND_OPTIONS,
  getActiveFlapSound,
  playFlap,
  setActiveFlapSound,
  flapSoundUnlock,
  type FlapSoundId,
} from "../game/sfx";
import { THEMES, isThemesLabMode, type Theme, type ThemeId } from "../game/themes";
import { hasZones } from "../game/depth-zones";
import { getGrantedShapesLocal } from "../social/grants";
import { PRESET_SKINS, presetUnlock, type PresetSkin } from "../game/preset-skins";
import { evaluateCriteria, isEventActive, type CriterionDef } from "../game/unlock-criteria";
import { PILLAR_STYLES, getEquippedPillarLocal, setEquippedPillarLocal, type PillarStyle } from "../game/pillars";
import { PILLAR_COLORS, getPillarColor, getEquippedPillarColorLocal, setEquippedPillarColorLocal, pillarColorUnlocked } from "../game/pillar-colors";
import { setEquippedAchievementColorLocal } from "../game/achievement-equip";
import {
  FLAP_FX_OPTIONS,
  FX_COLORS,
  flapFxUnlock,
  fxColorUnlocked,
  getActiveFlapFx,
  getFlapFxColor,
  isFxLabMode,
  setActiveFlapFx,
  setFlapFxColor,
  spawnFlapFx,
  type FlapFxId,
} from "../game/flap-fx";
import { getChainViews, type QuestChain, type QuestStep } from "../game/quests";
import { listMyBadges, getCachedBadges, isDeveloper, type SeasonBadge } from "../social/badges";
import { authState } from "../social/auth";
import { isPlaytester } from "../game/playtester";

export interface GalleryCallbacks {
  onEquipSkin(skinId: string | null): void;
  onEquipShape(shapeId: ShapeId): void;
  onEquipTheme(themeId: ThemeId): void;
  onEquipColorPreset(presetId: string | null): void;
  onEquipAchievementColor(achId: string | null): void;
  onClose(): void;
}

export interface GalleryEquipped {
  skinId: string | null;
  shapeId: ShapeId;
  themeId: ThemeId;
  presetId: string | null;
  achColorId: string | null;
}

export interface GalleryStats {
  totalGames: number;
  bestScore: number;
  streakDays: number;
  lateNightGames: number;
  morningGames: number;
  dailyStreakDays: number;
  challengeWins: number;
}

export function renderGallery(
  host: HTMLElement,
  equipped: GalleryEquipped,
  stats: GalleryStats,
  cbs: GalleryCallbacks,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  // Unified collection progress across shapes + themes + palettes +
  // achievement colors (one registry — see game/unlockables.ts).
  const collection = unlockProgress();
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-2 flex items-baseline justify-between">
      <h2 class="text-xl font-bold">gallery <span class="text-[11px] font-normal opacity-50 ml-1 tabular-nums">${collection.unlocked}/${collection.total}</span></h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-next class="px-5 pb-2"></div>
    <div data-loadout class="flex items-stretch gap-1 px-2 py-2 border-b border-white/10"></div>
    <div data-body class="mt-2 px-3 flex-1 overflow-y-auto pb-28"></div>
  `;
  host.appendChild(wrap);

  // "What's next" — the 3 nearest locked cosmetics (easiest tier first), so the
  // gallery points you at an attainable goal instead of a wall of locks.
  (() => {
    const aStats = loadAchievementStats();
    const granted = new Set(getGrantedShapesLocal());
    type Next = { name: string; where: string; hint: string; tier: Tier };
    const next: Next[] = [];
    const add = (name: string, where: string, u: { unlocked: boolean; hint?: string | null }, unlock: (s: never) => { unlocked: boolean }, already = false): void => {
      if (!already && !u.unlocked && u.hint) next.push({ name, where, hint: u.hint, tier: tierForUnlock(unlock) });
    };
    // Secrets (obscure-gated items) are excluded — you can't guide toward them.
    for (const sh of SHAPES) if (!isSecretHint(sh.unlock(aStats).hint)) add(sh.name, "Player · shape", sh.unlock(aStats), sh.unlock, granted.has(sh.id));
    for (const t of THEMES) if (!isSecretHint(t.unlock(aStats).hint)) add(t.name, "World · backgrounds", t.unlock(aStats), t.unlock);
    for (const p of PILLAR_STYLES) if (!isSecretHint(p.unlock(aStats).hint)) add(p.name, "World · pillars", p.unlock(aStats), p.unlock);
    next.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
    const top = next.slice(0, 3);
    const el = wrap.querySelector("[data-next]") as HTMLDivElement;
    if (top.length === 0) { el.remove(); return; }
    let open = false;
    try { open = localStorage.getItem("pflug.nextOpen.v1") === "1"; } catch { /* ignore */ }
    const rows = top
      .map((n) => {
        const prog = hintProgress(n.hint, aStats);
        const progHtml = prog
          ? `<span class="tabular-nums opacity-80 shrink-0">${prog.cur}/${prog.target}</span>`
          : `<span class="opacity-50 truncate">${escapeHtml(n.hint)}</span>`;
        return `<div class="flex items-center gap-2 text-[11px] py-0.5">
            <span class="opacity-40 text-[10px] shrink-0">${n.where} ›</span>
            <span class="font-bold shrink-0">${escapeHtml(n.name)}</span>
            ${progHtml}
          </div>`;
      })
      .join("");
    const render = (): void => {
      el.innerHTML = `<button data-next-toggle class="text-[10px] uppercase tracking-wider opacity-50 flex items-center gap-1">what's next <span>${open ? "▾" : "▸"}</span></button>${open ? `<div class="mt-1">${rows}</div>` : ""}`;
      el.querySelector("[data-next-toggle]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        open = !open;
        try { localStorage.setItem("pflug.nextOpen.v1", open ? "1" : "0"); } catch { /* ignore */ }
        render();
      });
    };
    render();
  })();

  type Tab = "shapes" | "skins" | "backgrounds" | "effects" | "quests" | "badges" | "pillars";
  let activeTab: Tab = "shapes";
  let currentEquipped = { ...equipped, achColorId: equipped.achColorId };
  let cancelled = false;

  const close = () => {
    cancelled = true;
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  // If a server skin is equipped but the owned-skins cache hasn't been populated
  // yet (gallery opened before ever visiting the skins tab), fetch it now so the
  // shape box shows the right colours immediately without waiting for a tab tap.
  if (currentEquipped.skinId && !getCachedOwnedSkins()) {
    listOwnedSkins().then(() => { if (!cancelled) renderLoadout(); }).catch(() => {});
  }

  function resolveEquippedColors(): { body: [number,number,number]; accent: [number,number,number] } {
    if (currentEquipped.presetId) {
      const preset = PRESET_SKINS.find(p => p.id === currentEquipped.presetId);
      if (preset) return { body: preset.body, accent: preset.accent };
    }
    if (currentEquipped.achColorId) {
      const ach = ACHIEVEMENTS.find(a => a.id === currentEquipped.achColorId);
      if (ach) return { body: ach.reward.body, accent: ach.reward.accent };
    }
    if (currentEquipped.skinId) {
      const cached = getCachedOwnedSkins();
      const skin = cached?.find(s => s.id === currentEquipped.skinId);
      if (skin) return { body: skin.body, accent: skin.accent };
    }
    return { body: DEFAULT_SKIN.body, accent: DEFAULT_SKIN.accent };
  }

  // Single navigation row: 7 equal-width boxes that double as tabs AND as a
  // live "loadout" preview of what you're flying. flex-1 + min-w-0 guarantees
  // all seven fit the viewport width with no horizontal scroll.
  function renderLoadout(): void {
    const strip = wrap.querySelector("[data-loadout]") as HTMLDivElement;
    strip.innerHTML = "";

    const addBox = (labelText: string, tab: Tab, content: HTMLElement | string): void => {
      const btn = document.createElement("button");
      btn.dataset.noFlap = "true";
      btn.className = "flex flex-col items-center gap-0.5 flex-1 min-w-0";
      const isActive = activeTab === tab;
      const preview = document.createElement("div");
      // Every box is the same rounded plate (darker than the strip so the tile
      // reads clearly), with an inset edge ring; the active one gets a paper ring.
      preview.className = `w-full aspect-square rounded-lg flex items-center justify-center overflow-hidden relative bg-white/[0.13] ${
        isActive ? "ring-2 ring-paper" : "ring-1 ring-white/15"
      }`;
      if (typeof content === "string") {
        preview.innerHTML = content;
        const svgEl = preview.querySelector("svg");
        if (svgEl) { svgEl.style.cssText = "display:block;width:80%;height:80%"; svgEl.removeAttribute("class"); }
      } else {
        content.style.width = "100%";
        content.style.height = "100%";
        preview.appendChild(content);
      }
      const lbl = document.createElement("div");
      lbl.className = `text-[8px] leading-none truncate w-full text-center ${isActive ? "text-paper font-bold" : "text-paper/45"}`;
      lbl.textContent = labelText;
      btn.appendChild(preview);
      btn.appendChild(lbl);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        activeTab = tab;
        renderLoadout();
        render();
      });
      strip.appendChild(btn);
    };

    // 1) Shape — drawn in the currently-equipped colours, so this box is a true
    //    mini of what you fly with (shape + skin combined).
    const { body, accent } = resolveEquippedColors();
    addBox("shape", "shapes", shapeSvgWithColors(currentEquipped.shapeId, body, accent));

    // 2) Colors — diagonal body/accent split swatch.
    const colorDiv = document.createElement("div");
    colorDiv.style.cssText = `width:100%;height:100%;background:linear-gradient(135deg,rgb(${body.join(",")}) 55%,rgb(${accent.join(",")}) 55%)`;
    addBox("colors", "skins", colorDiv);

    // 3) Effects — a drawn spark/sparkle (matches the in-game flap FX) rather
    //    than a stock emoji.
    addBox("effects", "effects", sparkIcon());

    // 4) World — sky gradient + pipe stubs, matching the mini preview in the
    //    backgrounds tab so the box reads as the actual world at a glance.
    const theme = THEMES.find(t => t.id === currentEquipped.themeId) ?? THEMES[0];
    const worldEl = document.createElement("div");
    worldEl.style.cssText = `position:relative;background:linear-gradient(180deg,${theme.colors.skyTop},${theme.colors.skyBottom})`;
    const topPipe = document.createElement("div");
    topPipe.style.cssText = `position:absolute;left:20%;right:20%;top:0;height:30%;border-radius:0 0 2px 2px;background:${theme.colors.pipeBody}`;
    const botPipe = document.createElement("div");
    botPipe.style.cssText = `position:absolute;left:20%;right:20%;bottom:0;height:36%;border-radius:2px 2px 0 0;background:${theme.colors.pipeBody}`;
    worldEl.appendChild(topPipe);
    worldEl.appendChild(botPipe);
    addBox("world", "backgrounds", worldEl);

    // 5) Pillar — the equipped style rendered in its equipped colour, over a
    //    sky-tinted plate so the pillars read as a scene (not floating shapes).
    const pillarCv = document.createElement("canvas");
    pillarCv.width = 44; pillarCv.height = 44;
    const equippedPillarId = getEquippedPillarLocal();
    const pillarStyle = PILLAR_STYLES.find(p => p.id === equippedPillarId) ?? PILLAR_STYLES[0];
    const pc = getPillarColor(getEquippedPillarColorLocal());
    const pillarBodyColor = pc?.body ?? "#3d8b58";
    const pillarCapColor = pc?.cap ?? "#2b6f4d";
    const pcx = pillarCv.getContext("2d");
    if (pcx) {
      // Fill a soft sky behind the pillars so the tile isn't transparent.
      const grad = pcx.createLinearGradient(0, 0, 0, 44);
      grad.addColorStop(0, theme.colors.skyTop);
      grad.addColorStop(1, theme.colors.skyBottom);
      pcx.fillStyle = grad;
      pcx.fillRect(0, 0, 44, 44);
      pillarStyle.draw({ ctx: pcx, x: 22, gapY: 18, gapH: 10, worldHeight: 44, pipeWidth: 14, over: 0, bodyColor: pillarBodyColor, capColor: pillarCapColor, highContrast: false });
    }
    addBox("pillar", "pillars", pillarCv);

    // 6) Goals — a circular progress ring instead of plain "n / n".
    const results = evaluateCriteria(loadAchievementStats());
    const goalsDone = results.filter(r => r.unlocked).length;
    addBox("goals", "quests", progressRing(goalsDone, results.length));

    // 7) Badges — a drawn medal rather than a stock emoji.
    addBox("badges", "badges", medalIcon());
  }
  renderLoadout();

  function render(): void {
    if (cancelled) return;
    if (activeTab === "shapes") renderShapes();
    else if (activeTab === "skins") void renderSkins();
    else if (activeTab === "backgrounds") renderBackgrounds();
    else if (activeTab === "effects") renderEffects();
    else if (activeTab === "quests") renderQuestsTab();
    else if (activeTab === "badges") void renderBadges();
    else if (activeTab === "pillars") renderPillars();
  }

  function renderPillars(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="text-[11px] opacity-70 px-2 mb-3">pick your pillar look. glass is see-through — it adds a difficulty level on the daily.</div>`;
    const stats = loadAchievementStats();
    const equippedPillar = getEquippedPillarLocal();
    // Resolve the chosen pillar colour for the previews ("theme" → default green).
    const pc = getPillarColor(getEquippedPillarColorLocal());
    const previewBody = pc ? pc.body : "#3d8b58";
    const previewCap = pc ? pc.cap : "#2b6f4d";

    // Pillar colour picker — sits at the TOP of the section, right under the
    // intro, so it reads as a property of the pillars you're choosing rather
    // than a stray row at the bottom. Overrides the theme's pipe colours.
    const colHeader = document.createElement("div");
    colHeader.className = "px-3 mt-1 mb-2 text-[10px] uppercase tracking-wider opacity-60 font-bold";
    colHeader.textContent = "pillar colour";
    body.appendChild(colHeader);
    const colDesc = document.createElement("div");
    colDesc.className = "px-2 mb-2 text-[10px] opacity-60";
    colDesc.textContent = "recolour your pillars — or keep the theme's colours. unlock more by playing.";
    body.appendChild(colDesc);
    const swatches = document.createElement("div");
    swatches.className = "flex flex-wrap gap-2 px-2 mb-4";
    const activeColor = getEquippedPillarColorLocal();
    for (const c of PILLAR_COLORS) {
      const u = pillarColorUnlocked(c, stats);
      const bg =
        c.id === "theme"
          ? "linear-gradient(135deg, #87ceeb 0 50%, #3d8b58 50% 100%)"
          : `linear-gradient(135deg, ${c.body} 0 60%, ${c.cap} 60% 100%)`;
      swatches.appendChild(
        colorSwatch(c.id, c.name, bg, c.id === activeColor, u, () => {
          setEquippedPillarColorLocal(c.id);
          renderLoadout();
          renderPillars();
        }),
      );
    }
    body.appendChild(swatches);

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-2 gap-4 px-2 pt-1";
    body.appendChild(grid);
    const sorted = byTier(PILLAR_STYLES, (p) => p.unlock(stats).unlocked, (p) => tierForUnlock(p.unlock));
    for (const style of sorted) {
      const st = style.unlock(stats);
      grid.appendChild(
        pillarCard(style, equippedPillar === style.id, st.unlocked, st.hint, () => {
          if (!st.unlocked) return;
          setEquippedPillarLocal(style.id);
          renderLoadout();
          renderPillars();
        }, tierForUnlock(style.unlock), previewBody, previewCap),
      );
    }
  }

  async function renderBadges(): Promise<void> {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    // Local-first: paint the last-known badges instantly (no spinner), then
    // revalidate against the server and repaint if it changed.
    const cached = getCachedBadges();
    if (cached) paintBadges(cached);
    else body.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">loading…</div>`;
    const badges = await listMyBadges();
    if (cancelled || activeTab !== "badges") return;
    paintBadges(badges);
  }

  function paintBadges(badges: SeasonBadge[]): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = "";
    const playtester = isPlaytester(authState().profile?.created_at);
    const developer = isDeveloper(authState().profile?.username);
    if (badges.length === 0 && !playtester && !developer) {
      const empty = document.createElement("div");
      empty.className = "px-4 mt-8 text-center text-[12px] opacity-60 leading-relaxed";
      empty.textContent =
        "No badges yet — finish top-100 in a ranked season to earn one.";
      body.appendChild(empty);
      return;
    }
    const desc = document.createElement("div");
    desc.className = "text-[11px] opacity-70 px-2 mb-3";
    desc.textContent = "your badges — keepsakes you carry on your profile forever.";
    body.appendChild(desc);
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-2 gap-4 px-2 pt-1";
    body.appendChild(grid);
    if (playtester) grid.appendChild(playtesterCard());
    if (developer) grid.appendChild(devBadgeCard());
    const sorted = [...badges].sort((a, b) => b.season_id - a.season_id);
    const bestRank = sorted.length ? Math.min(...sorted.map((b) => b.rank)) : 0;
    for (const badge of sorted) {
      grid.appendChild(badgeCard(badge, badge.rank === bestRank));
    }
  }

  function renderEffects(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = "";
    // Sounds section
    const soundsHeader = document.createElement("div");
    soundsHeader.className = "px-3 mt-1 mb-2 text-[10px] uppercase tracking-wider opacity-60 font-bold";
    soundsHeader.textContent = "sounds";
    body.appendChild(soundsHeader);
    const soundsDesc = document.createElement("div");
    soundsDesc.className = "px-2 mb-3 text-[10px] opacity-60";
    soundsDesc.textContent = "your tap sound. tap any unlocked row to preview; pick to set it for runs.";
    body.appendChild(soundsDesc);
    const soundsList = document.createElement("div");
    soundsList.className = "space-y-2 px-2";
    const achStats = loadAchievementStats();
    const activeSound = getActiveFlapSound();
    for (const opt of FLAP_SOUND_OPTIONS) {
      soundsList.appendChild(soundCard(opt.id, opt.label, opt.blurb, achStats, activeSound === opt.id, (id) => {
        setActiveFlapSound(id);
        renderEffects();
      }));
    }
    body.appendChild(soundsList);
    // Separator
    const sep = document.createElement("div");
    sep.className = "my-4 border-t border-white/10";
    body.appendChild(sep);
    // FX section
    const fxHeader = document.createElement("div");
    fxHeader.className = "px-3 mt-1 mb-2 text-[10px] uppercase tracking-wider opacity-60 font-bold";
    fxHeader.textContent = "effects";
    body.appendChild(fxHeader);
    const fxDesc = document.createElement("div");
    fxDesc.className = "px-2 mb-3 text-[10px] opacity-60";
    fxDesc.textContent = "visual burst when you tap. preview the unlocked ones — your pick fires every flap mid-run.";
    body.appendChild(fxDesc);
    const activeFx = getActiveFlapFx();

    // FX colour picker — tints whichever effect is active, so it sits at the
    // TOP of the FX section (right under the intro, above the effect list) to
    // read as a property of the effect you're picking. Hidden when "off".
    if (activeFx !== "off") {
      const colHeader = document.createElement("div");
      colHeader.className = "px-3 mt-1 mb-2 text-[10px] uppercase tracking-wider opacity-60 font-bold";
      colHeader.textContent = "effect colour";
      body.appendChild(colHeader);
      const colDesc = document.createElement("div");
      colDesc.className = "px-2 mb-2 text-[10px] opacity-60";
      colDesc.textContent = "tint your flap effect — pick a swatch or keep the default. unlock more by playing.";
      body.appendChild(colDesc);
      const swatches = document.createElement("div");
      swatches.className = "flex flex-wrap gap-2 px-2 mb-4";
      const activeColor = getFlapFxColor();
      for (const c of FX_COLORS) {
        const u = fxColorUnlocked(c, achStats);
        const bg =
          c.id === "default"
            ? "linear-gradient(135deg, #888 0 50%, #ddd 50% 100%)"
            : `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})`;
        swatches.appendChild(
          colorSwatch(c.id, c.name, bg, c.id === activeColor, u, () => {
            setFlapFxColor(c.id);
            renderEffects();
          }),
        );
      }
      body.appendChild(swatches);
    }

    const fxList = document.createElement("div");
    fxList.className = "space-y-2 px-2";
    for (const opt of FLAP_FX_OPTIONS) {
      fxList.appendChild(fxCard(opt.id, opt.label, opt.blurb, achStats, activeFx === opt.id, (id) => {
        setActiveFlapFx(id);
        renderEffects();
      }));
    }
    body.appendChild(fxList);
  }

  function renderQuestsTab(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div data-quests-body class="space-y-3 px-2 pb-2"></div>`;
    const questsBody = body.querySelector("[data-quests-body]") as HTMLDivElement;

    // Goals catalog leads — the single, unified place for things to chase.
    const achStats = loadAchievementStats();
    const results = evaluateCriteria(achStats);
    const got = results.filter((r) => r.unlocked).length;
    questsBody.appendChild(headerLabel(`goals — ${got} / ${results.length}`));
    const intro = document.createElement("div");
    intro.className = "text-[10px] opacity-60 px-2 mb-2";
    intro.textContent = "every achievement & goal in one place — finish them to unlock shapes, colors, worlds & more.";
    questsBody.appendChild(intro);
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 gap-2";
    for (const { def, unlocked } of results) grid.appendChild(criterionCard(def, unlocked));
    questsBody.appendChild(grid);

    // The legacy guided chains live below as "starter paths" — they still
    // grant their rewards (handled in main.ts), kept as a gentle intro.
    const views = getChainViews();
    if (views.length > 0) {
      questsBody.appendChild(headerLabel("starter paths"));
      for (const v of views) questsBody.appendChild(chainCard(v.chain, v.activeIndex, v.complete));
    }
  }

  function renderBackgrounds(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="grid grid-cols-2 gap-4 px-2 pt-1"></div>`;
    const grid = body.firstElementChild as HTMLDivElement;
    const themeUnlocked = (t: Theme): boolean => isThemesLabMode() || t.unlock(stats).unlocked;
    const sorted = byTier(THEMES, themeUnlocked, (t) => tierForUnlock(t.unlock));
    for (const theme of sorted) {
      grid.appendChild(
        themeCard(theme, currentEquipped.themeId === theme.id, stats, () => {
          if (!themeUnlocked(theme)) return;
          currentEquipped.themeId = theme.id;
          cbs.onEquipTheme(theme.id);
          renderLoadout();
          renderBackgrounds();
        }, tierForUnlock(theme.unlock)),
      );
    }
  }

  function renderShapes(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="grid grid-cols-2 gap-4 px-2 pt-1"></div>`;
    const grid = body.firstElementChild as HTMLDivElement;
    const granted = new Set(getGrantedShapesLocal());
    const isUnlocked = (sh: ShapeMeta): boolean => granted.has(sh.id) || sh.unlock(stats).unlocked;
    const sorted = byTier(SHAPES, isUnlocked, (sh) => tierForUnlock(sh.unlock));
    for (const shape of sorted) {
      const unlocked = isUnlocked(shape);
      grid.appendChild(
        shapeCard(shape, currentEquipped.shapeId === shape.id, stats, () => {
          if (!unlocked) return;
          currentEquipped.shapeId = shape.id;
          cbs.onEquipShape(shape.id);
          renderLoadout();
          renderShapes();
        }, unlocked, tierForUnlock(shape.unlock)),
      );
    }
  }

  async function renderSkins(): Promise<void> {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    // Local-first: paint the last-known owned skins instantly (no spinner),
    // then revalidate against the server and repaint if it changed.
    const cached = getCachedOwnedSkins();
    if (cached) paintSkins(cached);
    else body.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">loading…</div>`;
    const rows = await listOwnedSkins();
    if (cancelled || activeTab !== "skins") return;
    paintSkins(rows);
  }

  function paintSkins(rows: SkinRow[]): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = "";
    const achStats = loadAchievementStats();

    // Owned + default card. We always show the default-paper card so
    // the player can revert; achievement-locked rewards live in a
    // separate section underneath.
    const ownedGrid = document.createElement("div");
    ownedGrid.className = "grid grid-cols-3 gap-3.5 px-2 pt-1";
    body.appendChild(headerLabel("owned"));
    body.appendChild(ownedGrid);
    ownedGrid.appendChild(
      defaultSkinCard(currentEquipped.skinId === null, currentEquipped.shapeId, () => {
        currentEquipped.skinId = null;
        currentEquipped.presetId = null;
        cbs.onEquipColorPreset(null);
        cbs.onEquipSkin(null);
        renderLoadout();
        void renderSkins();
      }),
    );
    rows.sort(
      (a, b) =>
        rarityRank(b.rarity) - rarityRank(a.rarity) || b.unlocked_at_games - a.unlocked_at_games,
    );
    for (const row of rows) {
      ownedGrid.appendChild(
        skinCard(row, row.id === currentEquipped.skinId, currentEquipped.shapeId, () => {
          const newId = row.id === currentEquipped.skinId ? null : row.id;
          currentEquipped.skinId = newId;
          currentEquipped.presetId = null;
          cbs.onEquipColorPreset(null);
          cbs.onEquipSkin(newId);
          renderLoadout();
          void renderSkins();
        }),
      );
    }

    // Preset palettes — hand-picked colours with their own unlock
    // criteria. Equipping one is local-only (no DB skin row).
    body.appendChild(headerLabel("palettes"));
    const presetGrid = document.createElement("div");
    presetGrid.className = "grid grid-cols-3 gap-3.5 px-2 pt-1";
    body.appendChild(presetGrid);
    for (const p of PRESET_SKINS) {
      presetGrid.appendChild(
        presetCard(p, currentEquipped.presetId === p.id, achStats, currentEquipped.shapeId, () => {
          if (!presetUnlock(p, achStats).unlocked) return;
          currentEquipped.presetId = p.id;
          currentEquipped.skinId = null;
          cbs.onEquipColorPreset(p.id);
          renderLoadout();
          void renderSkins();
        }),
      );
    }

    // Achievement-rewarded colors. Show their reward palette painted
    // on the equipped shape. Cards stay locked until the player
    // crosses the threshold — at which point they'll appear in the
    // owned grid too once the server mints the skin row.
    const ach = ACHIEVEMENTS;
    const unlockedN = ach.filter((a) => a.check(achStats)).length;
    const pct = Math.round((unlockedN / ach.length) * 100);
    body.appendChild(headerLabel(`achievement colors — ${unlockedN} / ${ach.length}`));
    const progress = document.createElement("div");
    progress.className = "px-3 mb-2";
    progress.innerHTML = `<div class="h-1.5 bg-white/10 rounded-full overflow-hidden"><div class="h-full bg-paper transition-all" style="width:${pct}%"></div></div>`;
    const achDesc = document.createElement("div");
    achDesc.className = "px-3 mb-3 text-[10px] opacity-60";
    achDesc.textContent = "tap an unlocked color to equip it — preview shown while locked; ??? are secret.";
    body.appendChild(progress);
    body.appendChild(achDesc);
    const achGrid = document.createElement("div");
    achGrid.className = "grid grid-cols-3 gap-3.5 px-2 pt-1";
    body.appendChild(achGrid);
    for (const a of ach) {
      const isEquipped = currentEquipped.achColorId === a.id;
      achGrid.appendChild(
        achievementColorCard(a, achStats, currentEquipped.shapeId, isEquipped, () => {
          const newId = isEquipped ? null : a.id;
          currentEquipped.achColorId = newId;
          currentEquipped.skinId = null;
          currentEquipped.presetId = null;
          setEquippedAchievementColorLocal(newId);
          cbs.onEquipAchievementColor(newId);
          renderLoadout();
          void renderSkins();
        }),
      );
    }
  }

  render();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

/** Best-effort numeric progress for an unlock hint, e.g. "7-day streak" with
 *  streakDays 6 → {cur:6, target:7}. Returns null if the hint has no number or
 *  no recognised stat (then the caller just shows the hint text). */
function hintProgress(hint: string, s: AchievementStats): { cur: number; target: number } | null {
  const m = hint.match(/(\d+)/);
  if (!m) return null;
  const target = parseInt(m[1], 10);
  const h = hint.toLowerCase();
  let cur: number | null = null;
  if (h.includes("daily streak")) cur = s.dailyStreakDays;
  else if (h.includes("streak")) cur = s.streakDays;
  else if (h.includes("score")) cur = s.bestScore;
  else if (h.includes("game")) cur = s.totalGames;
  else if (h.includes("friend")) cur = s.friendCount;
  else if (h.includes("challenge")) cur = s.challengeWins;
  else if (h.includes("morning")) cur = s.morningGames;
  else if (h.includes("night")) cur = s.lateNightGames;
  if (cur == null) return null;
  return { cur: Math.min(cur, target), target };
}

/** Obscure / easter-egg unlock conditions (time-of-day, friend counts, daily
 *  streaks) read better as hidden "secrets" than as chores. Detected from the
 *  hint text; the condition itself is unchanged. */
function isSecretHint(hint?: string | null): boolean {
  if (!hint) return false;
  return /morning|friend|daily streak|\d\d:\d\d/i.test(hint);
}

/** What to show on a LOCKED card: a secret label for obscure gates, else the
 *  real hint. */
function displayHint(hint?: string | null): string {
  return isSecretHint(hint) ? "🔒 secret" : (hint ?? "locked");
}

/** A small tier badge (top-left of a card). */
function tierChip(tier: Tier): string {
  return `<div class="absolute top-1 left-1 text-[8px] uppercase tracking-wider rounded px-1 py-0.5 font-bold" style="background:${TIER_COLOR[tier]}22;color:${TIER_COLOR[tier]}">${TIER_LABEL[tier]}</div>`;
}

/** Sort a list unlocked-first, then easiest tier first. Stable on ties. */
function byTier<T>(items: T[], unlockedOf: (t: T) => boolean, tierOf: (t: T) => Tier): T[] {
  return items
    .map((item, i) => ({ item, i, unlocked: unlockedOf(item), tier: tierOf(item) }))
    .sort((a, b) =>
      a.unlocked !== b.unlocked ? (a.unlocked ? -1 : 1) : tierRank(a.tier) - tierRank(b.tier) || a.i - b.i,
    )
    .map((x) => x.item);
}

function shapeCard(
  shape: ShapeMeta,
  equipped: boolean,
  stats: GalleryStats,
  onTap: () => void,
  unlockedOverride?: boolean,
  tier?: Tier,
): HTMLElement {
  const state = shape.unlock(stats);
  const unlocked = unlockedOverride ?? state.unlocked;
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[11px] gap-2 border-2 ${
    equipped ? "border-paper" : unlocked ? "border-white/10" : "border-white/5"
  } bg-white/5 ${unlocked ? "active:scale-95" : "opacity-50 cursor-not-allowed"} transition`;
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl">
      ${shapeSvg(shape.id, unlocked)}
    </div>
    <div class="font-bold">${shape.name}</div>
    <div class="opacity-60 text-[10px] text-center leading-tight">${
      unlocked ? shape.blurb : displayHint(state.hint)
    }</div>
    ${tier ? tierChip(tier) : ""}
    ${
      equipped
        ? `<div class="absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1.5 py-0.5">equipped</div>`
        : !unlocked
          ? `<div class="absolute top-1 right-1 text-[9px] bg-white/15 rounded-full px-1.5 py-0.5">locked</div>`
          : ""
    }
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!unlocked) return;
    onTap();
  });
  return el;
}

function skinCard(
  row: SkinRow,
  equipped: boolean,
  shapeId: ShapeId,
  onTap: () => void,
): HTMLElement {
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 ${
    equipped ? "border-paper" : "border-white/10"
  } bg-white/5 active:scale-95 transition`;
  el.style.setProperty("--ring", RARITY_COLOR[row.rarity]);
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl">
      ${shapeSvgWithColors(shapeId, row.body, row.accent)}
    </div>
    <div class="font-bold capitalize" style="color: var(--ring)">${row.rarity}</div>
    <div class="opacity-50">@${row.unlocked_at_games}</div>
    ${equipped ? `<div class="absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1.5 py-0.5">equipped</div>` : ""}
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onTap();
  });
  return el;
}

function defaultSkinCard(equipped: boolean, shapeId: ShapeId, onTap: () => void): HTMLElement {
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 ${
    equipped ? "border-paper" : "border-white/10"
  } bg-white/5 active:scale-95 transition`;
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl">
      ${shapeSvgWithColors(shapeId, DEFAULT_SKIN.body, DEFAULT_SKIN.accent)}
    </div>
    <div class="font-bold opacity-70">default</div>
    <div class="opacity-50">cream + ink</div>
    ${equipped ? `<div class="absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1.5 py-0.5">equipped</div>` : ""}
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onTap();
  });
  return el;
}

// --- SVG previews ---

// Tiny canvas-backed previews for the gallery. We could call the real
// `getShape().draw(ctx, ...)` from shapes.ts, but for static previews
// inline SVG is lighter (no canvas per card). The proportions match
// the in-game render closely enough for selection.

function shapeSvgWithColors(
  shapeId: ShapeId,
  body: [number, number, number],
  accent: [number, number, number],
): string {
  const b = `rgb(${body.join(",")})`;
  const a = `rgb(${accent.join(",")})`;
  switch (shapeId) {
    case "paper-plane":
      return svg(
        `<polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="1,0 -14,6 -1,11" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>`,
      );
    case "paper-plane-v2":
      return svg(
        `<polygon points="-15,5 -3,2 15,-2 12,1 -10,8" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="-15,-1 15,-2 -2,2 15,-2 -15,5" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>`,
      );
    case "pixel-bird":
      return svg(
        `<g fill="${b}" stroke="#1a1a1a" stroke-width="0.4">
           <rect x="-9" y="-7" width="2" height="2"/><rect x="-7" y="-7" width="2" height="2"/><rect x="-5" y="-7" width="2" height="2"/><rect x="-3" y="-7" width="2" height="2"/>
           <rect x="-11" y="-5" width="14" height="2"/>
           <rect x="-13" y="-3" width="18" height="2"/>
           <rect x="-13" y="-1" width="20" height="2"/>
           <rect x="-13" y="1" width="22" height="2"/>
           <rect x="-13" y="3" width="20" height="2"/>
           <rect x="-11" y="5" width="14" height="2"/>
         </g>
         <g fill="${a}" stroke="#1a1a1a" stroke-width="0.4">
           <rect x="3" y="-3" width="4" height="2"/>
           <rect x="5" y="-1" width="6" height="2"/>
         </g>
         <rect x="3" y="-5" width="2" height="2" fill="#1a1a1a"/>`,
      );
    case "kite":
      // Four triangular panels alternating body/accent (a-b-a-b pinwheel),
      // not split down the middle (which read as a-a-b-b).
      return svg(
        `<polygon points="0,-13 0,0 -12,0" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="0,-13 0,0 12,0" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="0,13 0,0 12,0" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="0,13 0,0 -12,0" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <line x1="-12" y1="0" x2="12" y2="0" stroke="#1a1a1a" stroke-width="0.4" opacity="0.5"/>
         <line x1="0" y1="-13" x2="0" y2="13" stroke="#1a1a1a" stroke-width="0.4" opacity="0.5"/>`,
      );
    case "soccer-ball":
      return svg(soccerBallSvg());
    case "pretzel":
      return svg(
        `<g fill="none" stroke="${b}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M -3,-8 C -19,-17 -22,3 -7,8 C -2,10 2,10 7,8 C 22,3 19,-17 3,-8"/>
           <path d="M -3,-8 L 7,8"/>
           <path d="M 3,-8 L -7,8"/>
         </g>
         <g fill="${a}"><circle cx="-9" cy="-2" r="1"/><circle cx="9" cy="-2" r="1"/><circle cx="0" cy="9" r="1"/></g>`,
      );
    case "cyber-plane":
      return svg(
        `<polygon points="14,0 2,-6 -11,-3 -13,0 -11,3 2,6" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="4,2 -9,9 -12,7 -7,3" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="7,-2 11,-1 10,0 6,-0.5" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>
         <rect x="-13" y="-2" width="2.5" height="1.2" fill="#1a1a1a"/>
         <rect x="-13" y="0.6" width="2.5" height="1.2" fill="#1a1a1a"/>`,
      );
    case "rocket":
      return svg(
        `<polygon points="14,0 2,-6 -11,-6 -11,6 2,6" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="-7,-6 -13,-11 -7,-2" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="-7,6 -13,11 -7,2" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <circle cx="4" cy="0" r="2.6" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`,
      );
    case "heart":
      return svg(
        `<path d="M 11 0 C 2 -11 -13 -6 -2 0.6 C -13 6 2 11 11 0 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <circle cx="-2" cy="0" r="2.6" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`,
      );
    case "star":
      return svg(
        `<polygon points="0,-13 3,-4 12,-4 5,2 7,11 0,6 -7,11 -5,2 -12,-4 -3,-4" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <circle cx="0" cy="0" r="4" fill="${a}" stroke="#1a1a1a" stroke-width="0.6"/>`,
      );
    case "butterfly":
      return svg(
        `<path d="M -1 -7 Q -4 -11 -5 -14" stroke="#3a3a3a" stroke-width="0.8" fill="none"/>
         <path d="M 1 -7 Q 4 -11 5 -14" stroke="#3a3a3a" stroke-width="0.8" fill="none"/>
         <path d="M 0 -5 C -10 -10 -14 -5 -13 -1 C -10 2 -3 0 0 -2 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <path d="M 0 -5 C 10 -10 14 -5 13 -1 C 10 2 3 0 0 -2 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <path d="M -1 0 C -8 3 -9 8 -6 9 C -3 9 -1 5 -1 3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <path d="M 1 0 C 8 3 9 8 6 9 C 3 9 1 5 1 3 Z" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="0" cy="-1" rx="0.8" ry="7" fill="#3a3a3a" stroke="#1a1a1a" stroke-width="0.4"/>`,
      );
    case "flower":
      return svg(
        `<ellipse cx="0" cy="-7" rx="3.5" ry="6.5" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="0" cy="-7" rx="3.5" ry="6.5" transform="rotate(60)" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="0" cy="-7" rx="3.5" ry="6.5" transform="rotate(120)" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="0" cy="-7" rx="3.5" ry="6.5" transform="rotate(180)" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="0" cy="-7" rx="3.5" ry="6.5" transform="rotate(240)" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="0" cy="-7" rx="3.5" ry="6.5" transform="rotate(300)" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <circle cx="0" cy="0" r="4" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>`,
      );
    case "vector-bird":
      return svg(
        `<ellipse cx="0" cy="0" rx="13" ry="7" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <path d="M -2 -5 Q -8 -11 -12 -6" stroke="${a}" stroke-width="2" fill="none" stroke-linecap="round"/>
         <polygon points="13,0 18,-1.5 18,1.5" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <circle cx="7" cy="-2" r="1.2" fill="#1a1a1a"/>`,
      );
    case "leaf":
      return svg(
        `<path d="M -12 0 C -12 -9 8 -9 12 0 C 8 9 -12 9 -12 0 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <line x1="-11" y1="0" x2="11" y2="0" stroke="${a}" stroke-width="1.2"/>
         <line x1="-2" y1="0" x2="1" y2="-5" stroke="${a}" stroke-width="0.8"/>
         <line x1="4" y1="0" x2="7" y2="-5" stroke="${a}" stroke-width="0.8"/>`,
      );
    case "lightning":
      return svg(
        `<polygon points="5,-14 -6,1 1,1 -5,14 7,-1 0,-1" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polyline points="3,-11 -3,0 1,0 -3,11" stroke="${a}" stroke-width="1" fill="none"/>`,
      );
    case "ghost":
      return svg(
        `<path d="M -10 4 A 10 10 0 0 1 10 4 L 10 10 A 3.3 3 0 0 1 3.4 10 A 3.3 3 0 0 1 -3.4 10 A 3.3 3 0 0 1 -10 10 Z" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <ellipse cx="-3.5" cy="-1" rx="2" ry="3" fill="${a}"/>
         <ellipse cx="3.5" cy="-1" rx="2" ry="3" fill="${a}"/>`,
      );
    case "crane":
      return spriteSwatch("crane", body);
    case "submarine":
      return svg(
        `<ellipse cx="0" cy="0" rx="13" ry="6.5" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="-12,0 -16,-5 -16,5" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="-3,-6 -1,-11 3,-11 4,-6" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <circle cx="5" cy="0" r="2.2" fill="#1a1a1a"/>`,
      );
  }
}

// Sprite-backed gallery swatch: PNG flat-tinted to the body color, unique
// filter id per sprite.
function spriteSwatch(id: string, body: [number, number, number]): string {
  const fid = `sw-${id}`;
  return svg(
    `<defs><filter id="${fid}"><feColorMatrix type="matrix" values="0 0 0 0 ${(body[0] / 255).toFixed(3)}  0 0 0 0 ${(body[1] / 255).toFixed(3)}  0 0 0 0 ${(body[2] / 255).toFixed(3)}  0 0 0 1 0"/></filter></defs>
     <image href="/sprites/${id}.png" x="-16" y="-16" width="32" height="32" filter="url(#${fid})"/>`,
  );
}

function shapeSvg(shapeId: ShapeId, unlocked: boolean): string {
  const body: [number, number, number] = unlocked ? [244, 234, 213] : [120, 120, 120];
  const accent: [number, number, number] = unlocked ? [26, 26, 26] : [60, 60, 60];
  return shapeSvgWithColors(shapeId, body, accent);
}

function svg(inner: string): string {
  return `<svg viewBox="-20 -16 40 32" class="w-3/4 h-3/4">${inner}</svg>`;
}

// --- Loadout-box icons (drawn, not emoji) ---

/** A soft cloud puff with drifting trails — mirrors the "wind puff" flap FX
 *  (the default effect), rather than a stock emoji. */
function sparkIcon(): string {
  return `<svg viewBox="-12 -12 24 24" fill="#f4ead5">
    <g opacity="0.95">
      <circle cx="-4" cy="-3" r="4.2"/>
      <circle cx="2" cy="-5" r="5"/>
      <circle cx="6" cy="-1.5" r="3.8"/>
      <circle cx="0" cy="0" r="5.2"/>
    </g>
    <g stroke="#f4ead5" stroke-width="1.4" stroke-linecap="round" opacity="0.7">
      <line x1="-5" y1="6" x2="-7" y2="9.5"/>
      <line x1="0" y1="6.5" x2="-1.5" y2="10"/>
      <line x1="5" y1="6" x2="3.5" y2="9.5"/>
    </g>
  </svg>`;
}

/** A medal/coin on a ribbon — drawn replacement for the 🏅 emoji. */
function medalIcon(): string {
  return `<svg viewBox="-12 -12 24 24">
    <path d="M-5,-11 L-2,-1 L-6,1 Z" fill="#d94f4f"/>
    <path d="M5,-11 L2,-1 L6,1 Z" fill="#4f7fd9"/>
    <circle cx="0" cy="3" r="7.5" fill="#f5c542" stroke="#caa028" stroke-width="1.2"/>
    <circle cx="0" cy="3" r="4.2" fill="none" stroke="#caa028" stroke-width="0.8" opacity="0.7"/>
    <path d="M0,-0.5 L1.3,2 L4,2.3 L2,4.2 L2.5,7 L0,5.6 L-2.5,7 L-2,4.2 L-4,2.3 L-1.3,2 Z" fill="#fff3c4"/>
  </svg>`;
}

/** A circular progress ring with the done-count in the middle. */
function progressRing(done: number, total: number): string {
  const pct = total > 0 ? done / total : 0;
  const r = 8.5;
  const c = 2 * Math.PI * r;
  const dash = (pct * c).toFixed(2);
  return `<svg viewBox="-12 -12 24 24">
    <circle cx="0" cy="0" r="${r}" fill="none" stroke="rgba(244,234,213,0.18)" stroke-width="2.4"/>
    <circle cx="0" cy="0" r="${r}" fill="none" stroke="#4ade80" stroke-width="2.4" stroke-linecap="round"
      stroke-dasharray="${dash} ${(c - pct * c).toFixed(2)}" transform="rotate(-90)"/>
    <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
      fill="#f4ead5" font-size="9" font-weight="bold" font-family="inherit">${done}</text>
  </svg>`;
}

function headerLabel(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "px-3 mt-1 mb-2 text-[10px] uppercase tracking-wider opacity-60 font-bold";
  el.textContent = text;
  return el;
}

function themeCard(theme: Theme, equipped: boolean, stats: GalleryStats, onTap: () => void, tier?: Tier): HTMLElement {
  const realState = theme.unlock(stats);
  const state = isThemesLabMode() ? { unlocked: true, hint: realState.hint } : realState;
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[11px] gap-2 border-2 ${
    equipped ? "border-paper" : state.unlocked ? "border-white/10" : "border-white/5"
  } bg-white/5 ${state.unlocked ? "active:scale-95" : "opacity-50 cursor-not-allowed"} transition`;
  const c = theme.colors;
  el.innerHTML = `
    <div class="w-full aspect-square rounded-xl overflow-hidden relative" style="background: linear-gradient(180deg, ${c.skyTop} 0%, ${c.skyBottom} 100%)">
      ${c.horizonBand ? `
        <div class="absolute left-0 right-0" style="top:${(c.horizonBand.topY/640)*100}%;bottom:0;background:linear-gradient(180deg,${c.horizonBand.topColor} 0%,${c.horizonBand.bottomColor} 100%)"></div>
        ${c.horizonBand.second ? `<div class="absolute left-0 right-0" style="top:${(c.horizonBand.second.topY/640)*100}%;bottom:0;background:linear-gradient(180deg,${c.horizonBand.second.topColor} 0%,${c.horizonBand.second.bottomColor} 100%)"></div>` : ""}
      ` : ""}
      <div class="absolute left-3 right-3 top-3 h-8 rounded" style="background:${c.pipeBody}"></div>
      <div class="absolute left-3 right-3 bottom-3 h-12 rounded" style="background:${c.pipeBody}"></div>
      ${c.fogIntensity ? `<div class="absolute inset-0" style="background: radial-gradient(circle at 45% 55%, transparent 25%, rgba(205,214,221,${c.fogIntensity}) 80%)"></div>` : ""}
    </div>
    <div class="font-bold flex items-center gap-1">${escapeHtml(theme.name)}${hasZones(theme.id) || theme.backgroundStages ? `<span class="text-[8px] uppercase tracking-wider rounded px-1 py-0.5" style="background:#a855f733;color:#c79bff">interactive</span>` : ""}</div>
    <div class="opacity-60 text-[10px] text-center leading-tight">${state.unlocked ? escapeHtml(theme.blurb) : escapeHtml(displayHint(state.hint))}</div>
    ${tier ? tierChip(tier) : ""}
    ${
      equipped
        ? `<div class="absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1.5 py-0.5">equipped</div>`
        : !state.unlocked
          ? `<div class="absolute top-1 right-1 text-[9px] bg-white/15 rounded-full px-1.5 py-0.5">locked</div>`
          : ""
    }
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!state.unlocked) return;
    onTap();
  });
  return el;
}

function achievementColorCard(
  a: AchievementDef,
  stats: AchievementStats,
  shapeId: ShapeId,
  equipped: boolean,
  onEquip: () => void,
): HTMLElement {
  const got = a.check(stats);
  // Locked cards preview their real reward color so players can see what
  // they're working toward — EXCEPT prestige (secret) rewards, which stay a
  // blacked-out mystery to keep them aspirational.
  const mystery = !got && a.secret === true;
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 bg-white/5 ${
    equipped ? "border-paper" : got ? "border-emerald-400/40" : mystery ? "border-white/10" : "border-white/5 opacity-80"
  }${got ? " active:scale-95 transition" : ""}`;
  const body = mystery ? ([18, 18, 22] as [number, number, number]) : a.reward.body;
  const accent = mystery ? ([10, 10, 12] as [number, number, number]) : a.reward.accent;
  const preview = mystery
    ? `<div class="w-full aspect-square flex items-center justify-center bg-black/40 rounded-xl text-2xl font-black opacity-70">?</div>`
    : `<div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl ${got ? "" : "opacity-90"}">
         ${shapeSvgWithColors(shapeId, body, accent)}
       </div>`;
  const stateLabel = got && equipped ? "equipped" : got ? "unlocked" : mystery ? "secret" : "preview · locked";
  el.innerHTML = `
    ${preview}
    <div class="font-bold capitalize leading-tight text-center">${mystery ? "???" : escapeHtml(a.name)}</div>
    <div class="opacity-60 text-[10px] text-center leading-snug">${escapeHtml(a.blurb)}</div>
    <div class="text-[9px] uppercase tracking-wider font-bold ${got ? "text-emerald-300" : "opacity-50"}">${stateLabel}</div>
  `;
  if (got) {
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onEquip();
    });
  }
  return el;
}

function fxCard(
  id: FlapFxId,
  label: string,
  blurb: string,
  stats: AchievementStats,
  active: boolean,
  onPick: (id: FlapFxId) => void,
): HTMLElement {
  const realState = flapFxUnlock(id, stats);
  const state = isFxLabMode() ? { unlocked: true, hint: realState.hint } : realState;
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = `rounded-2xl p-3 border-2 ${active ? "border-paper bg-paper/10" : state.unlocked ? "border-white/10 bg-white/5" : "border-white/5 bg-white/5 opacity-60"}`;
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="text-left flex-1 min-w-0">
        <div class="text-sm font-bold truncate">${escapeHtml(label)}</div>
        <div class="text-[11px] opacity-70 mt-0.5 truncate">${state.unlocked ? escapeHtml(blurb) : escapeHtml(state.hint ?? "locked")}</div>
      </div>
      ${state.unlocked
        ? `<button data-preview class="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold">▶</button>
           <button data-pick class="rounded-full ${active ? "bg-emerald-400/30 text-emerald-100" : "bg-paper text-ink"} px-3 py-1.5 text-[11px] font-bold">${active ? "active" : "pick"}</button>`
        : `<div class="text-[10px] uppercase tracking-wider opacity-50 font-bold">locked</div>`
      }
    </div>
  `;
  if (state.unlocked) {
    el.querySelector("[data-preview]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      // Spawn into the live particle system. The renderer is paused
      // (we're on the menu/gallery), so the particle list will hold
      // the burst until the player starts a run — that's not ideal
      // for preview. For now, fire a one-shot visual via a small
      // throwaway canvas painted into a temporary node.
      previewFxBurst(id, el);
    });
    el.querySelector("[data-pick]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(id);
    });
  }
  return el;
}

function previewFxBurst(id: FlapFxId, anchor: HTMLElement): void {
  // 80×80 ad-hoc canvas dropped over the preview button. Spawn the
  // burst into a local particle buffer, animate via rAF, remove on
  // completion. Keeps preview self-contained vs. polluting the main
  // particle list while no run is active.
  const c = document.createElement("canvas");
  c.width = 160; c.height = 160;
  c.style.cssText = "position:absolute;pointer-events:none;z-index:50;";
  const rect = anchor.getBoundingClientRect();
  c.style.left = `${rect.right - 100}px`;
  c.style.top = `${rect.top + rect.height / 2 - 40}px`;
  c.style.width = "80px"; c.style.height = "80px";
  document.body.appendChild(c);
  const ctx2 = c.getContext("2d")!;
  // Local mini-particle buffer for this preview only.
  type P = { dx: number; dy: number; vx: number; vy: number; age: number; life: number; kind: "puff" | "line" | "sparkle" | "ring"; color: string };
  const ps: P[] = [];
  const cx = 80, cy = 80;
  const seed = (kind: P["kind"], color: string, n: number, factory: (i: number) => Partial<P>) => {
    for (let i = 0; i < n; i++) ps.push({ dx: 0, dy: 0, vx: 0, vy: 0, age: 0, life: 0.5, kind, color, ...factory(i) });
  };
  if (id === "wind_puff") seed("puff", "rgba(244,234,213,0.9)", 6, (i) => ({ vx: (i - 2.5) * 16, vy: 70 + Math.random() * 16, life: 0.55 }));
  else if (id === "speed_lines") seed("line", "rgba(244,234,213,0.95)", 4, (i) => ({ dx: 8, dy: (i - 1.5) * 5, vx: -220, life: 0.32 }));
  else if (id === "sparkle") seed("sparkle", "rgba(255,235,150,0.95)", 8, () => { const ang = Math.random() * Math.PI + Math.PI; const sp = 40 + Math.random() * 50; return { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.5 }; });
  else if (id === "ring_pulse") seed("ring", "rgba(244,234,213,0.8)", 1, () => ({ life: 0.35 }));
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx2.clearRect(0, 0, 160, 160);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps.splice(i, 1); continue; }
      p.dx += p.vx * dt; p.dy += p.vy * dt;
      const t = p.age / p.life;
      ctx2.globalAlpha = Math.max(0, 1 - t);
      ctx2.fillStyle = p.color;
      ctx2.strokeStyle = p.color;
      const px = cx + p.dx, py = cy + p.dy;
      if (p.kind === "puff") { ctx2.beginPath(); ctx2.arc(px, py, 4 + t * 8, 0, Math.PI * 2); ctx2.fill(); }
      else if (p.kind === "line") { ctx2.lineWidth = 2; ctx2.beginPath(); ctx2.moveTo(px, py); ctx2.lineTo(px - 20 - t * 28, py); ctx2.stroke(); }
      else if (p.kind === "sparkle") { const r = 2 + (1 - t) * 2; ctx2.fillRect(px - r / 2, py - r / 2, r, r); }
      else if (p.kind === "ring") { ctx2.lineWidth = 3 * (1 - t); ctx2.beginPath(); ctx2.arc(px, py, 6 + t * 60, 0, Math.PI * 2); ctx2.stroke(); }
    }
    if (ps.length > 0) requestAnimationFrame(tick);
    else c.remove();
  };
  requestAnimationFrame(tick);
  // Reference the imported spawn so it isn't tree-shaken — keeps the
  // sim+lab spawn flow alive even if no run has run yet.
  void spawnFlapFx;
}

function soundCard(
  id: FlapSoundId,
  label: string,
  blurb: string,
  stats: AchievementStats,
  active: boolean,
  onPick: (id: FlapSoundId) => void,
): HTMLElement {
  const state = flapSoundUnlock(id, stats);
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = `rounded-2xl p-3 border-2 ${active ? "border-paper bg-paper/10" : state.unlocked ? "border-white/10 bg-white/5" : "border-white/5 bg-white/5 opacity-60"}`;
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="text-left flex-1 min-w-0">
        <div class="text-sm font-bold truncate">${escapeHtml(label)}</div>
        <div class="text-[11px] opacity-70 mt-0.5 truncate">${state.unlocked ? escapeHtml(blurb) : escapeHtml(state.hint ?? "locked")}</div>
      </div>
      ${state.unlocked
        ? `<button data-preview class="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold">▶</button>
           <button data-pick class="rounded-full ${active ? "bg-emerald-400/30 text-emerald-100" : "bg-paper text-ink"} px-3 py-1.5 text-[11px] font-bold">${active ? "active" : "pick"}</button>`
        : `<div class="text-[10px] uppercase tracking-wider opacity-50 font-bold">locked</div>`
      }
    </div>
  `;
  if (state.unlocked) {
    el.querySelector("[data-preview]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      playFlap(id);
    });
    el.querySelector("[data-pick]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(id);
    });
  }
  return el;
}

function presetCard(
  p: PresetSkin,
  equipped: boolean,
  stats: AchievementStats,
  shapeId: ShapeId,
  onTap: () => void,
): HTMLElement {
  const state = presetUnlock(p, stats);
  // Chameleon has no fixed colour — it rolls a new vivid pair every run. Paint
  // its swatch as a rainbow so it reads as "random / legendary" at a glance.
  const isChameleon = p.id === "chameleon";
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 ${
    equipped ? "border-paper" : isChameleon && state.unlocked ? "border-fuchsia-400/50" : state.unlocked ? "border-white/10" : "border-white/5"
  } bg-white/5 ${state.unlocked ? "active:scale-95" : "opacity-50 cursor-not-allowed"} transition`;
  const swatch = isChameleon
    ? `<div class="w-full aspect-square flex items-center justify-center rounded-xl" style="background:conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #a855f7, #ef4444)">
         <div class="w-[78%] h-[78%] flex items-center justify-center rounded-lg bg-black/35">${shapeSvgWithColors(shapeId, p.body, p.accent)}</div>
       </div>`
    : `<div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl">
         ${shapeSvgWithColors(shapeId, p.body, p.accent)}
       </div>`;
  el.innerHTML = `
    ${swatch}
    <div class="font-bold">${escapeHtml(p.name)}</div>
    <div class="opacity-60 text-[10px] text-center leading-tight">${state.unlocked ? (isChameleon ? "random every run" : "ready") : escapeHtml(state.hint ?? "locked")}</div>
    ${isChameleon ? `<div class="text-[8px] uppercase tracking-wider rounded px-1 py-0.5 font-bold" style="background:#a855f733;color:#d8b4fe">legendary</div>` : ""}
    ${
      equipped
        ? `<div class="absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1.5 py-0.5">equipped</div>`
        : !state.unlocked
          ? `<div class="absolute top-1 right-1 text-[9px] bg-white/15 rounded-full px-1.5 py-0.5">locked</div>`
          : ""
    }
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!state.unlocked) return;
    onTap();
  });
  return el;
}

function chainCard(chain: QuestChain, activeIndex: number, complete: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = "rounded-2xl bg-white/5 p-4 mb-3";
  const completed = Math.min(activeIndex, chain.steps.length);
  const pct = Math.round((completed / chain.steps.length) * 100);
  const stepRows = chain.steps
    .map((step, i) => {
      const done = i < activeIndex;
      const active = i === activeIndex;
      return stepRow(step, done, active);
    })
    .join("");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <div class="text-base font-bold capitalize">${escapeHtml(chain.name)}</div>
        <div class="text-[11px] opacity-70 mt-0.5">${escapeHtml(chain.blurb)}</div>
      </div>
      ${complete
        ? `<span class="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">complete</span>`
        : `<span class="text-[10px] opacity-60">${completed} / ${chain.steps.length}</span>`}
    </div>
    <div class="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div class="h-full bg-paper transition-all" style="width:${pct}%"></div>
    </div>
    <div class="mt-3 space-y-1.5">${stepRows}</div>
  `;
  return el;
}

function stepRow(step: QuestStep, done: boolean, active: boolean): string {
  const icon = done
    ? `<span class="text-emerald-300">✓</span>`
    : active
      ? `<span class="text-paper">●</span>`
      : `<span class="opacity-40">○</span>`;
  const titleCls = done ? "opacity-50 line-through" : active ? "font-bold" : "opacity-60";
  return `
    <div class="flex items-start gap-2 text-[12px]">
      <div class="w-4 text-center mt-0.5">${icon}</div>
      <div class="flex-1">
        <div class="${titleCls}">${escapeHtml(step.title)}</div>
        <div class="text-[10px] opacity-50">reward: ${escapeHtml(step.reward.label)}</div>
      </div>
    </div>
  `;
}

function playtesterCard(): HTMLElement {
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className =
    "relative rounded-2xl p-3 flex flex-col items-center text-[11px] gap-2 border-2 border-emerald-300/50 bg-emerald-300/10";
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl text-4xl">🧪</div>
    <div class="font-bold">Playtester</div>
    <div class="opacity-70 text-[12px] text-center leading-tight">here before launch</div>
    <div class="absolute top-1 right-1 text-[9px] bg-emerald-300 text-ink rounded-full px-1.5 py-0.5">forever</div>
  `;
  return el;
}

function devBadgeCard(): HTMLElement {
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = "rounded-2xl bg-white/5 border-2 border-accent-ranked/30 p-4 flex flex-col items-center gap-2 text-center";
  el.innerHTML = `
    <div class="text-3xl">⚡</div>
    <div class="font-bold text-sm">Developer</div>
    <div class="text-[10px] opacity-60 leading-snug">made this game</div>
    <div class="text-[9px] uppercase tracking-wider font-bold" style="color:#c084fc">dev badge</div>
  `;
  return el;
}

function badgeCard(badge: SeasonBadge, isBest: boolean): HTMLElement {
  const medal = badge.rank === 1 ? "🥇" : badge.rank <= 3 ? "🥈" : "🏅";
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[11px] gap-2 border-2 ${
    isBest ? "border-amber-300/60 bg-amber-300/10" : "border-white/10 bg-white/5"
  }`;
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl text-4xl">${medal}</div>
    <div class="font-bold">Season ${badge.season_id}</div>
    <div class="opacity-70 text-[12px]">Rank #${badge.rank}</div>
    <div class="opacity-50 text-[10px]">Rating ${badge.rating}</div>
    ${isBest ? `<div class="absolute top-1 right-1 text-[9px] bg-amber-300 text-ink rounded-full px-1.5 py-0.5">best</div>` : ""}
  `;
  return el;
}

const REWARD_ICON: Record<string, string> = {
  skin: "🎨",
  shape: "✈️",
  background: "🌅",
  pillar: "🏛️",
  sound: "🔊",
  fx: "✨",
  badge: "🏅",
};

function criterionCard(def: CriterionDef, unlocked: boolean): HTMLElement {
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  // Secret + locked stays a mystery; everything else shows its goal + the
  // (TBA) reward slot it will fill once the art lands.
  const mystery = def.secret && !unlocked;
  const eventLive = def.event ? isEventActive(def) : false;
  el.className = `rounded-xl p-3 border ${
    unlocked ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/5"
  }`;
  const title = mystery ? "??? secret goal" : escapeHtml(def.name);
  const hint = mystery ? "keep playing to discover this one." : escapeHtml(def.hint);
  const icon = REWARD_ICON[def.plannedReward.kind] ?? "🎁";
  const rewardLabel = mystery ? "secret reward" : escapeHtml(def.plannedReward.label);
  const eventChip = def.event
    ? `<span class="ml-1 text-[9px] rounded-full px-1.5 py-0.5 ${eventLive ? "bg-pink-500/30 text-pink-100" : "bg-white/10 opacity-60"}">${eventLive ? "event live" : "seasonal"}</span>`
    : "";
  const state = unlocked
    ? `<span class="text-[9px] uppercase tracking-wider font-bold text-emerald-300">done</span>`
    : `<span class="text-[9px] uppercase tracking-wider opacity-50">locked</span>`;
  el.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <div class="text-[13px] font-bold capitalize truncate">${title}${eventChip}</div>
      ${state}
    </div>
    <div class="text-[11px] opacity-70 mt-0.5">${hint}</div>
    <div class="text-[10px] opacity-55 mt-1.5">${icon} reward: ${rewardLabel}</div>
  `;
  return el;
}

function pillarCard(
  style: PillarStyle,
  equipped: boolean,
  unlocked: boolean,
  hint: string | undefined,
  onTap: () => void,
  tier?: Tier,
  previewBody = "#3d8b58",
  previewCap = "#2b6f4d",
): HTMLElement {
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[11px] gap-2 border-2 ${
    equipped ? "border-paper" : unlocked ? "border-white/10" : "border-white/5"
  } bg-white/5 ${unlocked ? "active:scale-95" : "opacity-50 cursor-not-allowed"} transition`;
  // Mini preview: render the style onto a small canvas with a gap in the middle.
  const cv = document.createElement("canvas");
  cv.width = 120;
  cv.height = 90;
  cv.className = "w-full rounded-xl swatch-plate";
  const cx = cv.getContext("2d");
  if (cx) {
    const gapY = 38;
    const gapH = 22;
    style.draw({
      ctx: cx,
      x: 46,
      gapY,
      gapH,
      worldHeight: 90,
      pipeWidth: 28,
      over: 0,
      bodyColor: previewBody,
      capColor: previewCap,
      highContrast: false,
    });
  }
  const label = document.createElement("div");
  label.className = "font-bold capitalize";
  label.textContent = style.name;
  const sub = document.createElement("div");
  sub.className = "text-[10px] opacity-60 text-center leading-snug";
  sub.textContent = unlocked ? style.blurb : displayHint(hint);
  el.appendChild(cv);
  el.appendChild(label);
  el.appendChild(sub);
  if (style.hardensDaily) {
    const chip = document.createElement("div");
    chip.className = "text-[9px] uppercase tracking-wider text-amber-300";
    chip.textContent = "harder daily";
    el.appendChild(chip);
  }
  if (tier) {
    const t = document.createElement("div");
    t.innerHTML = tierChip(tier);
    el.appendChild(t.firstElementChild!);
  }
  if (equipped) {
    const eq = document.createElement("div");
    eq.className = "absolute top-1 right-1 text-[9px] bg-paper text-ink rounded-full px-1.5 py-0.5";
    eq.textContent = "equipped";
    el.appendChild(eq);
  }
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onTap();
  });
  return el;
}

/** A 7x7 colour-picker swatch with unlock gating. Locked swatches are dimmed,
 *  show a small lock glyph, expose the hint via title, and ignore taps. */
function colorSwatch(
  _id: string,
  name: string,
  background: string,
  isActive: boolean,
  unlock: { unlocked: boolean; hint?: string },
  onPick: () => void,
): HTMLButtonElement {
  const sw = document.createElement("button");
  sw.dataset.noFlap = "true";
  const locked = !unlock.unlocked;
  sw.className =
    "relative h-7 w-7 rounded-full border transition flex items-center justify-center " +
    (locked
      ? "border-white/10 opacity-40 cursor-not-allowed"
      : isActive
        ? "border-white ring-2 ring-white/60 scale-110"
        : "border-white/20 hover:border-white/50");
  sw.style.background = background;
  sw.title = locked ? `${name} — locked: ${unlock.hint ?? "keep playing"}` : name;
  sw.setAttribute("aria-label", locked ? `${name} (locked)` : name);
  if (locked) {
    sw.disabled = true;
    const lock = document.createElement("span");
    lock.className = "text-[9px] leading-none drop-shadow";
    lock.textContent = "🔒";
    sw.appendChild(lock);
  }
  sw.addEventListener("click", (e) => {
    e.stopPropagation();
    if (locked) return;
    onPick();
  });
  return sw;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
