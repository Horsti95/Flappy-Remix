import { type Settings } from "../game/settings";
import { RARITY_COLOR, type Rarity } from "../game/rarity";

export interface MenuCallbacks {
  onPlay(): void;
  onToggleSetting(key: keyof Settings): void;
  onOpenAccount(): void;
  onOpenSkins(): void;
}

export function renderMenu(host: HTMLElement, settings: Settings, cbs: MenuCallbacks, accountLabel = "account"): void {
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center text-center font-display bg-black/40 backdrop-blur-sm text-paper";
  wrap.innerHTML = `
    <button data-account class="absolute top-3 right-3 text-[11px] rounded-full px-3 py-1 bg-white/15">${escapeHtml(accountLabel)}</button>
    <div class="px-6 max-w-sm w-full">
      <h1 class="text-5xl font-bold tracking-tight">Pflug</h1>
      <p class="mt-1 text-xs opacity-70">a daily flap-through-gaps arcade</p>
      <button data-action="play" class="mt-8 w-full rounded-2xl bg-paper text-ink font-bold py-4 text-lg shadow-lg active:scale-95 transition">
        Play
      </button>
      <button data-action="skins" class="mt-3 w-full rounded-2xl border border-paper/40 text-paper font-bold py-3 text-sm">
        Skins
      </button>
      <div class="mt-6 grid grid-cols-3 gap-2 text-[11px]">
        ${toggle("sound", "Sound", settings.sound)}
        ${toggle("highContrast", "Contrast", settings.highContrast)}
        ${toggle("reducedMotion", "Reduced motion", settings.reducedMotion)}
      </div>
      <p class="mt-8 text-[10px] opacity-50">tap, click, or space to flap · esc to pause</p>
    </div>
  `;
  host.appendChild(wrap);
  wrap.querySelector('[data-action="play"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onPlay();
  });
  wrap.querySelector('[data-action="skins"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenSkins();
  });
  wrap.querySelector("[data-account]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenAccount();
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      cbs.onToggleSetting(btn.dataset.toggle as keyof Settings);
    });
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function toggle(key: keyof Settings, label: string, on: boolean): string {
  return `
    <button data-toggle="${key}" class="rounded-xl border ${on ? "bg-paper/20 border-paper" : "border-paper/30"} py-2 px-1">
      <div class="opacity-70">${label}</div>
      <div class="mt-1 font-bold">${on ? "on" : "off"}</div>
    </button>
  `;
}

export function renderPauseOverlay(host: HTMLElement, onResume: () => void, onQuit: () => void): void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.id = "pause-overlay";
  wrap.className = "pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-paper font-display";
  wrap.innerHTML = `
    <div class="text-center">
      <div class="text-3xl font-bold">paused</div>
      <button data-resume class="mt-6 rounded-2xl bg-paper text-ink font-bold py-3 px-8">resume</button>
      <button data-quit class="block mt-3 mx-auto text-xs underline opacity-70">quit run</button>
    </div>
  `;
  host.appendChild(wrap);
  wrap.querySelector("[data-resume]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onResume();
  });
  wrap.querySelector("[data-quit]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onQuit();
  });
}

export function removePauseOverlay(host: HTMLElement): void {
  host.querySelector("#pause-overlay")?.remove();
}

export interface GameOverResult {
  result?: {
    accepted?: boolean;
    reason?: string;
    total_games?: number;
    unlocked?: Array<{
      threshold: number;
      rarity: Rarity;
      body: [number, number, number];
      accent: [number, number, number];
    }>;
  } | null;
  ticks?: number;
}

export function renderGameOver(
  host: HTMLElement,
  score: number,
  onRestart: () => void,
  onMenu: () => void,
  extra?: GameOverResult,
): void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-x-0 bottom-0 z-10 px-4 pb-6 pt-6 bg-gradient-to-t from-black/80 to-transparent text-paper font-display";
  const unlocks = extra?.result?.unlocked ?? [];
  const unlocksHtml = unlocks.length > 0 ? renderUnlocks(unlocks) : "";
  const acceptStatus = extra?.result
    ? extra.result.accepted
      ? `<div class="text-[10px] opacity-60">submitted · ${extra.result.total_games ?? "?"} games total</div>`
      : `<div class="text-[10px] opacity-40">offline / not accepted</div>`
    : "";
  wrap.innerHTML = `
    <div class="max-w-sm mx-auto text-center">
      <div class="text-xs opacity-70 uppercase tracking-wider">your run</div>
      <div class="text-6xl font-bold mt-1">${score}</div>
      ${acceptStatus}
      ${unlocksHtml}
      <div class="mt-5 grid grid-cols-2 gap-3">
        <button data-restart class="rounded-2xl bg-paper text-ink font-bold py-3">Play again</button>
        <button data-menu class="rounded-2xl border border-paper/40 py-3">Menu</button>
      </div>
      <p class="mt-3 text-[10px] opacity-50">share cards + daily seed land in M3</p>
    </div>
  `;
  host.appendChild(wrap);
  wrap.querySelector("[data-restart]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onRestart();
  });
  wrap.querySelector("[data-menu]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onMenu();
  });
}

function renderUnlocks(unlocks: NonNullable<GameOverResult["result"]>["unlocked"]): string {
  if (!unlocks) return "";
  return `
    <div class="mt-3 rounded-2xl bg-white/10 px-3 py-3">
      <div class="text-[11px] uppercase tracking-wider opacity-70">unlocked</div>
      <div class="mt-2 flex justify-center gap-3">
        ${unlocks
          .map(
            (u) => `
          <div class="flex flex-col items-center">
            <svg viewBox="-20 -20 40 40" class="w-12 h-12">
              <polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="rgb(${u.body.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
              <polygon points="1,0 -14,6 -1,11" fill="rgb(${u.accent.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
            </svg>
            <div class="text-[10px] font-bold capitalize" style="color:${RARITY_COLOR[u.rarity]}">${u.rarity}</div>
            <div class="text-[9px] opacity-60">@${u.threshold}</div>
          </div>`,
          )
          .join("")}
      </div>
    </div>
  `;
}
