import {
  TIER_COLOR,
  TIER_LABEL,
  computeIntensity,
  intensityBand,
  intensityPercentLabel,
  INTENSITY_BAND_COLOR,
  type DailyPick,
} from "../game/daily-twist";

export interface DailyLandingMeta {
  date: string;
  pick: DailyPick;
  playsCount: number;
  bestScore: number | null;
  streakDays: number;
  /** Attempts already used today (best-of-3). */
  attemptsUsed: number;
  /** Max attempts per UTC day. */
  maxAttempts: number;
  /** Player's equipped pillar style is see-through (glass) — a self-imposed
   *  extra difficulty for today's daily. Shown as a heads-up chip. */
  glassHandicap?: boolean;
}

export interface DailyLandingCallbacks {
  onPlay(): void;
  /** Play a casual (non-daily) run instead — offered once attempts run out. */
  onPlayCasual?(): void;
  onClose(): void;
}

export function renderDailyLanding(
  host: HTMLElement,
  meta: DailyLandingMeta,
  cbs: DailyLandingCallbacks,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";

  const tierColor = TIER_COLOR[meta.pick.tier];
  const tierLabel = TIER_LABEL[meta.pick.tier];
  const isSuperHard = meta.pick.tier === "super_hard";
  const modifierList = meta.pick.modifiers.map((m) => m.name).join(" + ");

  // Overall intensity: modifiers compound, plus the glass-pillar handicap if
  // the player equipped it. Shown as a named band + percent.
  const intensity = computeIntensity(meta.pick.modifiers, meta.glassHandicap ? 1.15 : 1);
  const band = intensityBand(intensity);
  const bandColor = INTENSITY_BAND_COLOR[band];
  const intensityRow = `
    <div class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold"
         style="background:${bandColor}22; color:${bandColor}">
      <span class="uppercase tracking-wider">${band}</span>
      <span class="opacity-70">${intensityPercentLabel(intensity)} intensity</span>
    </div>`;
  const modifierBlurbs = meta.pick.modifiers.map((m) => m.blurb).join(" + ");

  const warningCopy = isSuperHard
    ? "you've been warned."
    : meta.pick.tier === "hard"
      ? "expect resistance."
      : meta.pick.tier === "medium"
        ? "feels different today."
        : "go gentle today.";

  const remaining = Math.max(0, meta.maxAttempts - meta.attemptsUsed);
  const exhausted = remaining <= 0;
  const attemptRow = `<div class="text-[11px] opacity-70">attempt <span class="font-bold">${Math.min(meta.attemptsUsed + 1, meta.maxAttempts)}</span> of ${meta.maxAttempts} · best counts</div>`;

  const bestRow =
    meta.bestScore != null
      ? `<div class="text-[11px] opacity-70">your daily best: <span class="font-bold">${meta.bestScore}</span></div>`
      : `<div class="text-[11px] opacity-50">no daily PB yet — set one.</div>`;

  const streakRow =
    meta.streakDays > 0
      ? `<div class="text-[11px] opacity-70">streak: <span class="font-bold">${meta.streakDays}</span> ${meta.streakDays === 1 ? "day" : "days"}</div>`
      : "";

  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <button data-back class="text-sm underline opacity-70">back</button>
      <div class="text-[11px] opacity-60 uppercase tracking-wider">today's daily</div>
      <div style="width: 40px;"></div>
    </div>
    <div class="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
      <div class="text-[10px] uppercase tracking-wider opacity-60">${escapeHtml(meta.date)}</div>
      <div class="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
           style="background:${tierColor}22; color:${tierColor}">${tierLabel}</div>
      <div>${intensityRow}</div>
      <div class="text-2xl font-bold leading-tight">${escapeHtml(modifierList)}</div>
      <div class="text-[12px] opacity-70 leading-tight">${escapeHtml(modifierBlurbs)}</div>
      ${meta.pick.visualEffect ? `<div class="text-[12px] opacity-80">${visualChip(meta.pick.visualEffect)}</div>` : ""}
      ${meta.glassHandicap ? `<div class="text-[11px] text-amber-300">🪟 glass pillars equipped — harder to read today</div>` : ""}
      <div class="text-[12px] opacity-60 mt-2">${escapeHtml(warningCopy)}</div>
      <div class="mt-4 grid grid-cols-2 gap-3 text-center min-w-[200px]">
        <div class="rounded-xl bg-white/5 px-3 py-2">
          <div class="text-[9px] uppercase tracking-wider opacity-50">played today</div>
          <div class="text-base font-bold">${formatPlays(meta.playsCount)}</div>
        </div>
        <div class="rounded-xl bg-white/5 px-3 py-2">
          <div class="text-[9px] uppercase tracking-wider opacity-50">your streak</div>
          <div class="text-base font-bold">${meta.streakDays}</div>
        </div>
      </div>
      ${attemptRow}
      ${bestRow}
      ${streakRow}
    </div>
    <div class="px-5 pb-6">
      ${
        exhausted
          ? `<div class="w-full rounded-2xl bg-white/10 py-4 text-center text-sm opacity-80">${meta.maxAttempts} attempts used — come back tomorrow</div>
             <button data-casual class="mt-2 w-full text-[12px] underline opacity-60">play a casual run instead</button>`
          : `<button data-play class="w-full rounded-2xl bg-paper text-ink font-bold py-4 text-lg active:scale-95 transition"
                  style="${isSuperHard ? `box-shadow: inset 0 0 0 2px ${tierColor}` : ""}">
            ${isSuperHard ? "play anyway" : "play"} <span class="opacity-60 text-sm">(${remaining} left)</span>
          </button>`
      }
      <div class="mt-2 text-[10px] opacity-50 text-center">same seed for the world today</div>
    </div>
  `;
  host.appendChild(wrap);

  const close = () => {
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-back]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  wrap.querySelector("[data-play]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.remove();
    cbs.onPlay();
  });
  wrap.querySelector("[data-casual]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.remove();
    cbs.onPlayCasual?.();
  });

  return () => wrap.remove();
}

function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function visualChip(fx: NonNullable<DailyLandingMeta["pick"]["visualEffect"]>): string {
  const labels: Record<string, string> = {
    night: "🌙 night sky",
    sunset: "🌅 sunset glow",
    blinding_sun: "🔆 blinding sun — glare on the right",
    rain: "🌧️ light rain",
  };
  return labels[fx] ?? "";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
