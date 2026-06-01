import { listOwnedSkins, type SkinRow } from "../social/skins";
import { unlockProgress } from "../game/unlockables";
import { RARITY_COLOR, rarityRank } from "../game/rarity";
import { SHAPES, type ShapeId, type ShapeMeta } from "../game/shapes";
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
import { getGrantedShapesLocal } from "../social/grants";
import { PRESET_SKINS, presetUnlock, type PresetSkin } from "../game/preset-skins";
import { evaluateCriteria, isEventActive, type CriterionDef } from "../game/unlock-criteria";
import { PILLAR_STYLES, getEquippedPillarLocal, setEquippedPillarLocal, type PillarStyle } from "../game/pillars";
import {
  FLAP_FX_OPTIONS,
  flapFxUnlock,
  getActiveFlapFx,
  isFxLabMode,
  setActiveFlapFx,
  spawnFlapFx,
  type FlapFxId,
} from "../game/flap-fx";
import { getChainViews, type QuestChain, type QuestStep } from "../game/quests";
import { listMyBadges, type SeasonBadge } from "../social/badges";

export interface GalleryCallbacks {
  onEquipSkin(skinId: string | null): void;
  onEquipShape(shapeId: ShapeId): void;
  onEquipTheme(themeId: ThemeId): void;
  onEquipColorPreset(presetId: string | null): void;
  onClose(): void;
}

export interface GalleryEquipped {
  skinId: string | null;
  shapeId: ShapeId;
  themeId: ThemeId;
  presetId: string | null;
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
    <div class="px-5 pt-5 pb-1 flex items-center justify-between">
      <h2 class="text-xl font-bold">gallery</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div class="px-5 pb-2 text-[11px] opacity-60">collection ${collection.unlocked} / ${collection.total} unlocked</div>
    <div data-tabs class="px-5 flex gap-2 text-[12px] overflow-x-auto">
      <button data-tab="shapes" class="rounded-full px-3 py-1 bg-paper text-ink whitespace-nowrap">Icons</button>
      <button data-tab="skins" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">colors</button>
      <button data-tab="backgrounds" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">backgrounds</button>
      <button data-tab="effects" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">effects</button>
      <button data-tab="quests" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">quests</button>
      <button data-tab="pillars" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">pillars</button>
      <button data-tab="badges" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">badges</button>
    </div>
    <div data-body class="mt-3 px-3 flex-1 overflow-y-auto pb-6"></div>
  `;
  host.appendChild(wrap);

  type Tab = "shapes" | "skins" | "backgrounds" | "effects" | "quests" | "badges" | "pillars";
  let activeTab: Tab = "shapes";
  let currentEquipped = { ...equipped };
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

  wrap.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      activeTab = btn.dataset.tab as Tab;
      wrap.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
        b.classList.toggle("bg-paper", b === btn);
        b.classList.toggle("text-ink", b === btn);
        b.classList.toggle("opacity-60", b !== btn);
        b.classList.toggle("bg-white/5", b !== btn);
      });
      render();
    }),
  );

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
    body.innerHTML = `<div class="text-[11px] opacity-70 px-2 mb-3">pick your pillar look. glass is see-through — it adds a difficulty level on the daily.</div><div class="grid grid-cols-2 gap-3 px-2" data-pillar-grid></div>`;
    const grid = body.querySelector("[data-pillar-grid]") as HTMLDivElement;
    const stats = loadAchievementStats();
    const equippedPillar = getEquippedPillarLocal();
    for (const style of PILLAR_STYLES) {
      const st = style.unlock(stats);
      grid.appendChild(
        pillarCard(style, equippedPillar === style.id, st.unlocked, st.hint, () => {
          if (!st.unlocked) return;
          setEquippedPillarLocal(style.id);
          renderPillars();
        }),
      );
    }
  }

  async function renderBadges(): Promise<void> {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">loading…</div>`;
    const badges = await listMyBadges();
    if (cancelled || activeTab !== "badges") return;
    body.innerHTML = "";
    if (badges.length === 0) {
      const empty = document.createElement("div");
      empty.className = "px-4 mt-8 text-center text-[12px] opacity-60 leading-relaxed";
      empty.textContent =
        "No season placements yet — finish top-100 in a ranked season to earn a badge.";
      body.appendChild(empty);
      return;
    }
    const desc = document.createElement("div");
    desc.className = "text-[11px] opacity-70 px-2 mb-3";
    desc.textContent = "your ranked season placements — top-100 finishes.";
    body.appendChild(desc);
    const sorted = [...badges].sort((a, b) => b.season_id - a.season_id);
    const bestRank = Math.min(...sorted.map((b) => b.rank));
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-2 gap-3 px-2";
    body.appendChild(grid);
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
    const fxList = document.createElement("div");
    fxList.className = "space-y-2 px-2";
    const activeFx = getActiveFlapFx();
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
    body.innerHTML = `<div class="text-[11px] opacity-70 px-2 mb-3">multi-step chains that unlock content as you play.</div><div data-quests-body class="space-y-3 px-2"></div>`;
    const questsBody = body.querySelector("[data-quests-body]") as HTMLDivElement;
    const views = getChainViews();
    for (const v of views) questsBody.appendChild(chainCard(v.chain, v.activeIndex, v.complete));

    // Goals catalog — the wider set of unlock criteria (rewards still TBA in
    // dev). Shows what's earnable and how, with secret ones hidden until done.
    const achStats = loadAchievementStats();
    const results = evaluateCriteria(achStats);
    const got = results.filter((r) => r.unlocked).length;
    questsBody.appendChild(headerLabel(`goals — ${got} / ${results.length}`));
    const intro = document.createElement("div");
    intro.className = "text-[10px] opacity-60 px-2 mb-2";
    intro.textContent = "challenges to chase. rewards are still in the works (TBA) — the goal is live.";
    questsBody.appendChild(intro);
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 gap-2";
    for (const { def, unlocked } of results) grid.appendChild(criterionCard(def, unlocked));
    questsBody.appendChild(grid);
  }

  function renderBackgrounds(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="grid grid-cols-2 gap-3 px-2"></div>`;
    const grid = body.firstElementChild as HTMLDivElement;
    for (const theme of THEMES) {
      grid.appendChild(
        themeCard(theme, currentEquipped.themeId === theme.id, stats, () => {
          if (!isThemesLabMode() && !theme.unlock(stats).unlocked) return;
          currentEquipped.themeId = theme.id;
          cbs.onEquipTheme(theme.id);
          renderBackgrounds();
        }),
      );
    }
  }

  function renderShapes(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="grid grid-cols-2 gap-3 px-2"></div>`;
    const grid = body.firstElementChild as HTMLDivElement;
    const granted = new Set(getGrantedShapesLocal());
    for (const shape of SHAPES) {
      const unlocked = granted.has(shape.id) || shape.unlock(stats).unlocked;
      grid.appendChild(
        shapeCard(shape, currentEquipped.shapeId === shape.id, stats, () => {
          if (!unlocked) return;
          currentEquipped.shapeId = shape.id;
          cbs.onEquipShape(shape.id);
          renderShapes();
        }, unlocked),
      );
    }
  }

  async function renderSkins(): Promise<void> {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">loading…</div>`;
    const rows = await listOwnedSkins();
    if (cancelled || activeTab !== "skins") return;
    body.innerHTML = "";
    const achStats = loadAchievementStats();

    // Owned + default card. We always show the default-paper card so
    // the player can revert; achievement-locked rewards live in a
    // separate section underneath.
    const ownedGrid = document.createElement("div");
    ownedGrid.className = "grid grid-cols-3 gap-3 px-2";
    body.appendChild(headerLabel("owned"));
    body.appendChild(ownedGrid);
    ownedGrid.appendChild(
      defaultSkinCard(currentEquipped.skinId === null, currentEquipped.shapeId, () => {
        currentEquipped.skinId = null;
        currentEquipped.presetId = null;
        cbs.onEquipColorPreset(null);
        cbs.onEquipSkin(null);
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
          void renderSkins();
        }),
      );
    }

    // Preset palettes — hand-picked colours with their own unlock
    // criteria. Equipping one is local-only (no DB skin row).
    body.appendChild(headerLabel("palettes"));
    const presetGrid = document.createElement("div");
    presetGrid.className = "grid grid-cols-3 gap-3 px-2";
    body.appendChild(presetGrid);
    for (const p of PRESET_SKINS) {
      presetGrid.appendChild(
        presetCard(p, currentEquipped.presetId === p.id, achStats, currentEquipped.shapeId, () => {
          if (!presetUnlock(p, achStats).unlocked) return;
          currentEquipped.presetId = p.id;
          currentEquipped.skinId = null;
          cbs.onEquipColorPreset(p.id);
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
    achDesc.textContent = "color palettes earned by achievements — preview shown locked; ??? are secret.";
    body.appendChild(progress);
    body.appendChild(achDesc);
    const achGrid = document.createElement("div");
    achGrid.className = "grid grid-cols-3 gap-3 px-2";
    body.appendChild(achGrid);
    for (const a of ach) achGrid.appendChild(achievementColorCard(a, achStats, currentEquipped.shapeId));
  }

  render();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function shapeCard(
  shape: ShapeMeta,
  equipped: boolean,
  stats: GalleryStats,
  onTap: () => void,
  unlockedOverride?: boolean,
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
      unlocked ? shape.blurb : (state.hint ?? "locked")
    }</div>
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
      return svg(
        `<polygon points="0,-13 12,0 0,13 -12,0" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="0,-13 0,13 -12,0" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <line x1="-12" y1="0" x2="12" y2="0" stroke="#1a1a1a" stroke-width="0.4" opacity="0.5"/>`,
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
    case "toucan":
      return spriteSwatch("toucan", body);
    case "crane":
      return spriteSwatch("crane", body);
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

function headerLabel(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "px-3 mt-1 mb-2 text-[10px] uppercase tracking-wider opacity-60 font-bold";
  el.textContent = text;
  return el;
}

function themeCard(theme: Theme, equipped: boolean, stats: GalleryStats, onTap: () => void): HTMLElement {
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
    <div class="font-bold">${escapeHtml(theme.name)}</div>
    <div class="opacity-60 text-[10px] text-center leading-tight">${state.unlocked ? escapeHtml(theme.blurb) : escapeHtml(state.hint ?? "locked")}</div>
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

function achievementColorCard(a: AchievementDef, stats: AchievementStats, shapeId: ShapeId): HTMLElement {
  const got = a.check(stats);
  // Locked cards preview their real reward color so players can see what
  // they're working toward — EXCEPT prestige (secret) rewards, which stay a
  // blacked-out mystery to keep them aspirational.
  const mystery = !got && a.secret === true;
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 bg-white/5 ${
    got ? "border-emerald-400/40" : mystery ? "border-white/10" : "border-white/5 opacity-80"
  }`;
  const body = mystery ? ([18, 18, 22] as [number, number, number]) : a.reward.body;
  const accent = mystery ? ([10, 10, 12] as [number, number, number]) : a.reward.accent;
  const preview = mystery
    ? `<div class="w-full aspect-square flex items-center justify-center bg-black/40 rounded-xl text-2xl font-black opacity-70">?</div>`
    : `<div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl ${got ? "" : "opacity-90"}">
         ${shapeSvgWithColors(shapeId, body, accent)}
       </div>`;
  const stateLabel = got ? "unlocked" : mystery ? "secret" : "preview · locked";
  el.innerHTML = `
    ${preview}
    <div class="font-bold capitalize leading-tight text-center">${mystery ? "???" : escapeHtml(a.name)}</div>
    <div class="opacity-60 text-[10px] text-center leading-snug">${escapeHtml(a.blurb)}</div>
    <div class="text-[9px] uppercase tracking-wider font-bold ${got ? "text-emerald-300" : "opacity-50"}">${stateLabel}</div>
  `;
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
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[10px] gap-2 border-2 ${
    equipped ? "border-paper" : state.unlocked ? "border-white/10" : "border-white/5"
  } bg-white/5 ${state.unlocked ? "active:scale-95" : "opacity-50 cursor-not-allowed"} transition`;
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center swatch-plate rounded-xl">
      ${shapeSvgWithColors(shapeId, p.body, p.accent)}
    </div>
    <div class="font-bold">${escapeHtml(p.name)}</div>
    <div class="opacity-60 text-[10px] text-center leading-tight">${state.unlocked ? "ready" : escapeHtml(state.hint ?? "locked")}</div>
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
      bodyColor: "#3d8b58",
      capColor: "#2b6f4d",
      highContrast: false,
    });
  }
  const label = document.createElement("div");
  label.className = "font-bold capitalize";
  label.textContent = style.name;
  const sub = document.createElement("div");
  sub.className = "text-[10px] opacity-60 text-center leading-snug";
  sub.textContent = unlocked ? style.blurb : (hint ?? "locked");
  el.appendChild(cv);
  el.appendChild(label);
  el.appendChild(sub);
  if (style.hardensDaily) {
    const chip = document.createElement("div");
    chip.className = "text-[9px] uppercase tracking-wider text-amber-300";
    chip.textContent = "harder daily";
    el.appendChild(chip);
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
