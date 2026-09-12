/**
 * The daily results screen ("aftermath").
 *
 * Shown once the day's three attempts are spent. Its job is not to report
 * numbers — the game-over screen already did that per run — but to close the
 * day off and hand the player something worth sending to someone else.
 *
 * That artifact is the emoji block from game/daily-share, which is the whole
 * reason this screen exists: it renders identically in every chat app, needs
 * no image pipeline, and gives away nothing about the level. Copying it is the
 * primary action here, not an afterthought.
 */
import { dailyShareText, attemptBar } from "../game/daily-share";
// Difficulty tier (daily-twist), not the cosmetic rarity tier in tiers.ts.
import { TIER_COLOR, TIER_LABEL, type Tier } from "../game/daily-twist";

export interface DailyAftermathMeta {
  date: string;
  attempts: number[];
  tier: Tier;
  /** Modifier name(s) for the day, already joined for display. */
  twist: string | null;
  streakDays: number;
  /** World-wide plays today, for the "you and N others" line. */
  playsCount: number;
}

export interface DailyAftermathCallbacks {
  onClose: () => void;
  onPlayCasual: () => void;
  onOpenLeaderboard: () => void;
}

export function renderDailyAftermath(
  host: HTMLElement,
  meta: DailyAftermathMeta,
  cbs: DailyAftermathCallbacks,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/80 backdrop-blur-sm font-display text-paper flex flex-col";

  const best = meta.attempts.length > 0 ? Math.max(...meta.attempts) : 0;
  const shareText = dailyShareText({
    date: meta.date,
    attempts: meta.attempts,
    tier: meta.tier,
    twist: meta.twist,
    streakDays: meta.streakDays,
    url: typeof window !== "undefined" ? window.location.origin : undefined,
  });

  // In-screen bars mirror the shared block exactly, so what the player sees is
  // what their friends will see.
  const rows = meta.attempts
    .map(
      (score, i) => `
      <div class="flex items-center gap-2">
        <span class="w-3 text-[10px] opacity-40 tabular-nums">${i + 1}</span>
        <span class="text-[13px] leading-none tracking-[0.08em]">${attemptBar(score, best)}</span>
        <span class="ml-auto text-sm font-bold tabular-nums${score >= best && best > 0 ? "" : " opacity-60"}">${score}</span>
      </div>`,
    )
    .join("");

  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-2 flex items-center justify-between">
      <button data-close class="text-sm underline opacity-70">close</button>
      <div class="text-[11px] opacity-60 uppercase tracking-wider">daily results</div>
      <div style="width: 40px;"></div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 pb-4 flex flex-col items-center gap-4">
      <div class="text-center">
        <div class="text-[10px] uppercase tracking-wider opacity-60">${escapeHtml(meta.date)}</div>
        <div class="mt-1 text-3xl font-bold font-hand leading-none">${best}</div>
        <div class="mt-1 text-[11px] opacity-60">your best today</div>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2">
        <span class="paper-chip" style="color:${TIER_COLOR[meta.tier]}">${TIER_LABEL[meta.tier]}</span>
        ${meta.twist ? `<span class="paper-chip">${escapeHtml(meta.twist)}</span>` : ""}
        ${meta.streakDays > 1 ? `<span class="paper-chip">🔥 ${meta.streakDays}</span>` : ""}
      </div>

      <div class="w-full max-w-[300px] paper-note rounded-2xl px-4 py-3 space-y-2">
        ${rows || `<div class="text-center text-xs opacity-60">no attempts recorded</div>`}
      </div>

      <div class="w-full max-w-[300px]">
        <div class="text-[10px] uppercase tracking-wider opacity-50 mb-1.5">share your day</div>
        <pre data-share-text
             class="w-full rounded-xl bg-black/40 px-3 py-2.5 text-[11px] leading-[1.45] whitespace-pre overflow-x-auto select-all font-mono">${escapeHtml(shareText)}</pre>
        <button data-share class="mt-2 w-full rounded-2xl bg-paper text-ink font-bold py-3 active:scale-95 transition">
          share result
        </button>
        <button data-copy class="mt-1.5 w-full rounded-xl bg-white/10 py-2 text-[12px]">copy as text</button>
        <div data-status class="mt-1.5 h-4 text-[11px] opacity-60 text-center"></div>
      </div>

      <button data-leaderboard class="text-[12px] underline opacity-70">see today's leaderboard</button>
    </div>

    <div class="px-5 pb-6">
      <div class="text-center text-[11px] opacity-60">
        That's your three. Same wind for everyone — new one tomorrow.
      </div>
      <button data-casual class="mt-2 w-full text-[12px] underline opacity-60">play a casual run</button>
    </div>
  `;
  host.appendChild(wrap);

  const status = wrap.querySelector<HTMLDivElement>("[data-status]")!;
  const say = (msg: string): void => {
    status.textContent = msg;
  };

  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onClose();
  });
  wrap.querySelector("[data-casual]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onPlayCasual();
  });
  wrap.querySelector("[data-leaderboard]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenLeaderboard();
  });

  const copy = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareText);
      return true;
    } catch {
      return false;
    }
  };

  wrap.querySelector("[data-copy]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    say((await copy()) ? "copied — paste it anywhere" : "couldn't copy — select the text above");
  });

  // Native share where it exists (phones), clipboard everywhere else. Text
  // only, deliberately: the emoji block IS the artifact, and attaching an
  // image makes most apps drop the text.
  wrap.querySelector("[data-share]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof navigator.share === "function" && (nav.canShare?.({ text: shareText }) ?? true)) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (err) {
        // The user backing out of the sheet is not a failure.
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    say((await copy()) ? "copied — paste it anywhere" : "couldn't share on this device");
  });

  return () => wrap.remove();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
