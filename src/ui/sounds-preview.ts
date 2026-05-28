import {
  FLAP_SOUND_OPTIONS,
  getActiveFlapSound,
  playFlap,
  setActiveFlapSound,
  type FlapSoundId,
} from "../game/sfx";

export interface SoundsPreviewCallbacks {
  onClose(): void;
}

export function renderSoundsPreview(host: HTMLElement, cbs: SoundsPreviewCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/90 backdrop-blur-sm font-display text-paper flex flex-col";

  let active: FlapSoundId = getActiveFlapSound();

  const renderRow = (id: FlapSoundId, label: string, blurb: string): string => `
    <div data-row="${id}" class="rounded-2xl p-3 mb-3 ${id === active ? "bg-paper/20 border border-paper" : "bg-white/5 border border-transparent"}">
      <div class="flex items-center justify-between gap-3">
        <div class="text-left flex-1">
          <div class="text-base font-bold">${label}</div>
          <div class="text-[11px] opacity-70 mt-0.5">${blurb}</div>
        </div>
        <button data-play="${id}" class="rounded-full bg-paper text-ink font-bold px-4 py-2 text-sm">▶ Play</button>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button data-burst="${id}" class="rounded-xl border border-paper/40 text-paper py-2 text-[11px]">10× burst</button>
        <button data-pick="${id}" class="rounded-xl ${id === active ? "bg-emerald-400/30 text-emerald-100 border border-emerald-300" : "border border-paper/40 text-paper"} py-2 text-[11px] font-bold">
          ${id === active ? "Active" : "Pick this"}
        </button>
      </div>
    </div>
  `;

  const renderBody = (): string => `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold">Flap sounds</h2>
        <div class="text-[11px] opacity-70 mt-0.5">tap each to preview, then pick a winner</div>
      </div>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div class="px-4 pb-2 text-[11px] opacity-70">
      The 10× burst plays the sound fast to simulate spamming flaps mid-run.
      Your pick persists across sessions.
    </div>
    <div data-list class="px-4 pt-2 flex-1 overflow-y-auto pb-6">
      ${FLAP_SOUND_OPTIONS.map((o) => renderRow(o.id, o.label, o.blurb)).join("")}
    </div>
  `;

  wrap.innerHTML = renderBody();
  host.appendChild(wrap);

  const close = (): void => {
    wrap.remove();
    cbs.onClose();
  };

  const rebuild = (): void => {
    wrap.innerHTML = renderBody();
    bind();
  };

  const bind = (): void => {
    wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      close();
    });
    wrap.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        playFlap(btn.dataset.play as FlapSoundId);
      });
    });
    wrap.querySelectorAll<HTMLButtonElement>("[data-burst]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.burst as FlapSoundId;
        for (let i = 0; i < 10; i++) setTimeout(() => playFlap(id), i * 110);
      });
    });
    wrap.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.pick as FlapSoundId;
        active = id;
        setActiveFlapSound(id);
        rebuild();
      });
    });
  };

  bind();
  return close;
}
