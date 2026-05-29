import { listOwnedSkins, type SkinRow } from "../social/skins";
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

export interface GalleryCallbacks {
  onEquipSkin(skinId: string | null): void;
  onEquipShape(shapeId: ShapeId): void;
  onClose(): void;
}

export interface GalleryEquipped {
  skinId: string | null;
  shapeId: ShapeId;
}

export interface GalleryStats {
  totalGames: number;
  bestScore: number;
  streakDays: number;
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
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">gallery</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-tabs class="px-5 flex gap-2 text-[12px] overflow-x-auto">
      <button data-tab="shapes" class="rounded-full px-3 py-1 bg-paper text-ink whitespace-nowrap">shapes</button>
      <button data-tab="skins" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">colors</button>
      <button data-tab="awards" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">awards</button>
      <button data-tab="sounds" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">sounds</button>
    </div>
    <div data-body class="mt-3 px-3 flex-1 overflow-y-auto pb-6"></div>
  `;
  host.appendChild(wrap);

  type Tab = "shapes" | "skins" | "awards" | "sounds";
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
    else if (activeTab === "awards") renderAwards();
    else if (activeTab === "sounds") renderSounds();
  }

  function renderAwards(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    const achStats = loadAchievementStats();
    const unlockedN = ACHIEVEMENTS.filter((a) => a.check(achStats)).length;
    const pct = Math.round((unlockedN / ACHIEVEMENTS.length) * 100);
    body.innerHTML = `
      <div class="px-2 mb-3">
        <div class="text-[11px] opacity-70">${unlockedN} / ${ACHIEVEMENTS.length} unlocked · ${pct}%</div>
        <div class="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-paper transition-all" style="width:${pct}%"></div>
        </div>
        <p class="mt-3 text-[10px] opacity-60">each achievement gives a reward color. play to unlock new ones — the painted plane below is the look you'll equip.</p>
      </div>
      <div data-awards-grid class="grid grid-cols-2 gap-2 px-2"></div>
    `;
    const grid = body.querySelector("[data-awards-grid]") as HTMLDivElement;
    for (const a of ACHIEVEMENTS) grid.appendChild(awardCard(a, achStats));
  }

  function renderSounds(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    const achStats = loadAchievementStats();
    const active = getActiveFlapSound();
    body.innerHTML = `
      <div class="px-2 mb-3 text-[10px] opacity-60">your tap sound. tap any unlocked row to preview; pick to set it for runs.</div>
      <div data-sounds-list class="space-y-2 px-2"></div>
    `;
    const list = body.querySelector("[data-sounds-list]") as HTMLDivElement;
    for (const opt of FLAP_SOUND_OPTIONS) {
      list.appendChild(soundCard(opt.id, opt.label, opt.blurb, achStats, active === opt.id, (id) => {
        setActiveFlapSound(id);
        renderSounds();
      }));
    }
  }

  function renderShapes(): void {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="grid grid-cols-2 gap-3 px-2"></div>`;
    const grid = body.firstElementChild as HTMLDivElement;
    for (const shape of SHAPES) {
      grid.appendChild(
        shapeCard(shape, currentEquipped.shapeId === shape.id, stats, () => {
          if (!shape.unlock(stats).unlocked) return;
          currentEquipped.shapeId = shape.id;
          cbs.onEquipShape(shape.id);
          renderShapes();
        }),
      );
    }
  }

  async function renderSkins(): Promise<void> {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    body.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">loading…</div>`;
    const rows = await listOwnedSkins();
    if (cancelled || activeTab !== "skins") return;
    body.innerHTML = "";
    if (rows.length === 0) {
      body.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">no color unlocks yet — play one game to mint your first.</div>`;
      return;
    }
    rows.sort(
      (a, b) =>
        rarityRank(b.rarity) - rarityRank(a.rarity) || b.unlocked_at_games - a.unlocked_at_games,
    );
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-3 gap-3 px-2";
    body.appendChild(grid);
    for (const row of rows) {
      grid.appendChild(
        skinCard(row, row.id === currentEquipped.skinId, currentEquipped.shapeId, () => {
          const newId = row.id === currentEquipped.skinId ? null : row.id;
          currentEquipped.skinId = newId;
          cbs.onEquipSkin(newId);
          void renderSkins();
        }),
      );
    }
    // Add a "default colors" card so the player can revert to the
    // built-in palette without losing their procedurally unlocked
    // skins.
    grid.appendChild(
      defaultSkinCard(currentEquipped.skinId === null, currentEquipped.shapeId, () => {
        currentEquipped.skinId = null;
        cbs.onEquipSkin(null);
        void renderSkins();
      }),
    );
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
): HTMLElement {
  const state = shape.unlock(stats);
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-[11px] gap-2 border-2 ${
    equipped ? "border-paper" : state.unlocked ? "border-white/10" : "border-white/5"
  } bg-white/5 ${state.unlocked ? "active:scale-95" : "opacity-50 cursor-not-allowed"} transition`;
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center bg-ink/80 rounded-xl">
      ${shapeSvg(shape.id, state.unlocked)}
    </div>
    <div class="font-bold">${shape.name}</div>
    <div class="opacity-60 text-[10px] text-center leading-tight">${
      state.unlocked ? shape.blurb : (state.hint ?? "locked")
    }</div>
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
    <div class="w-full aspect-square flex items-center justify-center bg-ink/80 rounded-xl">
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
    <div class="w-full aspect-square flex items-center justify-center bg-ink/80 rounded-xl">
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
    case "dart":
      return svg(
        `<polygon points="-13,6 15,-3 -10,2" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="15,-3 -10,2 -13,6 -1,3" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>`,
      );
    case "kite":
      return svg(
        `<polygon points="0,-13 12,0 0,13 -12,0" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="0,-13 0,13 -12,0" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <line x1="-12" y1="0" x2="12" y2="0" stroke="#1a1a1a" stroke-width="0.4" opacity="0.5"/>`,
      );
    case "paper-crane":
      return svg(
        `<polygon points="-14,3 -1,-5 4,1 -3,8" fill="${a}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="4,1 14,-3 12,3 17,5 13,8 4,5" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="-1,-5 9,-8 4,1" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>
         <polygon points="14,-3 18,-6 19,-3 15,-2" fill="${b}" stroke="#1a1a1a" stroke-width="0.8"/>`,
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
  }
}

function shapeSvg(shapeId: ShapeId, unlocked: boolean): string {
  const body: [number, number, number] = unlocked ? [244, 234, 213] : [120, 120, 120];
  const accent: [number, number, number] = unlocked ? [26, 26, 26] : [60, 60, 60];
  return shapeSvgWithColors(shapeId, body, accent);
}

function svg(inner: string): string {
  return `<svg viewBox="-20 -16 40 32" class="w-3/4 h-3/4">${inner}</svg>`;
}

function awardCard(a: AchievementDef, stats: AchievementStats): HTMLElement {
  const got = a.check(stats);
  const bodyFill = got ? `rgb(${a.reward.body.join(",")})` : "#3a3a3a";
  const accentFill = got ? `rgb(${a.reward.accent.join(",")})` : "#262626";
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = `relative rounded-2xl p-3 flex flex-col items-center text-center bg-white/5 ${got ? "" : "opacity-60"}`;
  el.innerHTML = `
    <div class="w-full aspect-square flex items-center justify-center bg-ink/80 rounded-xl">
      <svg viewBox="-20 -20 40 40" class="w-3/4 h-3/4">
        <polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="${bodyFill}" stroke="#1a1a1a" stroke-width="0.8"/>
        <polygon points="1,0 -14,6 -1,11" fill="${accentFill}" stroke="#1a1a1a" stroke-width="0.8"/>
      </svg>
    </div>
    <div class="mt-2 text-[12px] font-bold capitalize leading-tight">${escapeHtml(a.name)}</div>
    <div class="text-[10px] opacity-70 mt-0.5 leading-snug">${escapeHtml(a.blurb)}</div>
    <div class="mt-1.5 text-[9px] uppercase tracking-wider font-bold ${got ? "text-emerald-300" : "opacity-50"}">${got ? "unlocked" : "locked"}</div>
  `;
  return el;
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
