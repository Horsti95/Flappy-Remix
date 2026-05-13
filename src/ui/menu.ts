import { type Settings } from "../game/settings";

export interface MenuCallbacks {
  onPlay(): void;
  onToggleSetting(key: keyof Settings): void;
}

export function renderMenu(host: HTMLElement, settings: Settings, cbs: MenuCallbacks): void {
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center text-center font-display bg-black/40 backdrop-blur-sm text-paper";
  wrap.innerHTML = `
    <div class="px-6 max-w-sm w-full">
      <h1 class="text-5xl font-bold tracking-tight">Pflug</h1>
      <p class="mt-1 text-xs opacity-70">a daily flap-through-gaps arcade</p>
      <button data-action="play" class="mt-8 w-full rounded-2xl bg-paper text-ink font-bold py-4 text-lg shadow-lg active:scale-95 transition">
        Play
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
  wrap.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      cbs.onToggleSetting(btn.dataset.toggle as keyof Settings);
    });
  });
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

export function renderGameOver(host: HTMLElement, score: number, onRestart: () => void, onMenu: () => void): void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-x-0 bottom-0 z-10 px-4 pb-6 pt-8 bg-gradient-to-t from-black/70 to-transparent text-paper font-display";
  wrap.innerHTML = `
    <div class="max-w-sm mx-auto text-center">
      <div class="text-xs opacity-70 uppercase tracking-wider">your run</div>
      <div class="text-6xl font-bold mt-1">${score}</div>
      <div class="mt-5 grid grid-cols-2 gap-3">
        <button data-restart class="rounded-2xl bg-paper text-ink font-bold py-3">Play again</button>
        <button data-menu class="rounded-2xl border border-paper/40 py-3">Menu</button>
      </div>
      <p class="mt-3 text-[10px] opacity-60">leaderboards + share cards land in M2/M3</p>
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
