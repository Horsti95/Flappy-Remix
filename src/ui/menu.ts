import { type Settings } from "../game/settings";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { TIER_COLOR, TIER_LABEL, type Tier } from "../game/daily-twist";
import { playUnlockSound, triggerUnlockHaptic } from "../game/sfx";
import { DEFAULT_SHAPE_ID, type ShapeId } from "../game/shapes";
import { DEFAULT_SKIN, type SkinColors } from "../game/skin";
import { getTheme, DEFAULT_THEME_ID, type ThemeId } from "../game/themes";
import { shapeSvgInner } from "./shape-svg";

export interface MenuCallbacks {
  onPlay(): void;
  onPlayDaily(): void;
  onChallengeFriend(): void;
  onToggleSetting(key: keyof Settings): void;
  onOpenAccount(): void;
  onOpenSkins(): void;
  onOpenLeaderboard(): void;
  onOpenFriends(): void;
  onOpenRanked(): void;
  onOpenInbox(): void;
}

export interface MenuMeta {
  accountLabel: string;
  daily: {
    date: string;
    playsCount: number;
    tier: Tier;
    modifierNames: string[];
    modifierBlurbs: string[];
  } | null;
  streakDays: number;
  pendingSubmissions?: number;
  online?: boolean;
  /** Equipped shape — drives the mascot above the title. */
  equippedShape?: ShapeId;
  /** Equipped skin colours — drives mascot paint. Null = default cream/ink. */
  equippedSkin?: SkinColors;
  /** Equipped theme — drives the menu sky gradient. */
  equippedTheme?: ThemeId;
  /** User toggle: when false the menu always shows the default paper plane. */
  showEquippedInMenu?: boolean;
  /** Count of unseen incoming challenges — drives the inbox badge. */
  inboxUnseen?: number;
}

export function renderMenu(host: HTMLElement, settings: Settings, cbs: MenuCallbacks, meta: MenuMeta): void {
  host.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  // Theme-tinted backdrop: pull the equipped theme's sky gradient
  // into a CSS variable so the menu reads as the same world the
  // player is about to fly in.
  const showEquipped = meta.showEquippedInMenu !== false;
  const theme = getTheme(showEquipped ? (meta.equippedTheme ?? DEFAULT_THEME_ID) : DEFAULT_THEME_ID);
  const skyTop = theme.colors.skyTop;
  const skyBottom = theme.colors.skyBottom;
  wrap.className = "pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center text-center font-display menu-bg-paper backdrop-blur-sm text-paper";
  wrap.style.setProperty("--menu-sky-top", skyTop);
  wrap.style.setProperty("--menu-sky-bottom", skyBottom);
  const dailyLine = meta.daily
    ? `${formatPlays(meta.daily.playsCount)} played today`
    : "world plays the same level today";
  const tierChip = meta.daily
    ? `<span class="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider" style="background:${TIER_COLOR[meta.daily.tier]}22;color:${TIER_COLOR[meta.daily.tier]}">${TIER_LABEL[meta.daily.tier]}</span>`
    : "";
  const modifierLine = meta.daily && meta.daily.modifierNames.length > 0
    ? `<div class="mt-1 text-[11px] opacity-70 truncate">${meta.daily.modifierNames.map(escapeHtml).join(" + ")}</div>`
    : "";
  const streakBadge = meta.streakDays > 0
    ? `<span class="ml-2 inline-flex items-center gap-1 text-[10px] bg-white/10 rounded-full px-2 py-0.5">streak ${meta.streakDays}</span>`
    : "";
  const offlineBadge = meta.online === false
    ? `<div class="absolute top-3 left-3 text-[10px] rounded-full px-2 py-0.5 bg-orange-400/30 text-paper">offline${meta.pendingSubmissions ? ` · ${meta.pendingSubmissions} queued` : ""}</div>`
    : meta.pendingSubmissions
      ? `<div class="absolute top-3 left-3 text-[10px] rounded-full px-2 py-0.5 bg-paper/15">${meta.pendingSubmissions} queued</div>`
      : "";

  wrap.innerHTML = `
    ${offlineBadge}
    <button data-account class="absolute top-3 right-3 text-[11px] rounded-full px-3 py-1 bg-white/15">${escapeHtml(meta.accountLabel)}${streakBadge}</button>
    <div data-menu-content class="px-6 max-w-sm w-full">
      <div class="relative h-16 mb-2">
        <svg viewBox="-20 -20 40 40" data-menu-mascot class="menu-mascot absolute left-1/2 -translate-x-1/2 w-16 h-16">
          ${shapeSvgInner(
            showEquipped ? (meta.equippedShape ?? DEFAULT_SHAPE_ID) : DEFAULT_SHAPE_ID,
            showEquipped && meta.equippedSkin ? meta.equippedSkin.body : DEFAULT_SKIN.body,
            showEquipped && meta.equippedSkin ? meta.equippedSkin.accent : DEFAULT_SKIN.accent,
          )}
        </svg>
      </div>
      <h1 class="menu-title text-6xl font-bold tracking-tight">Glide</h1>
      <p class="mt-2 text-[11px] italic opacity-60">guide the paper plane through the gaps</p>

      <div class="mt-6 grid grid-cols-2 gap-3">
        <button data-action="play" class="rounded-2xl bg-paper text-ink font-bold py-5 text-lg shadow-lg active:scale-95 transition">
          Play
        </button>
        <button data-action="daily" class="rounded-2xl bg-paper text-ink font-bold py-3 px-4 text-left shadow-lg active:scale-95 transition">
          <div class="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1.5">
            <span>Daily</span>${tierChip}
          </div>
          <div class="text-sm leading-tight mt-0.5">${modifierLine ? meta.daily!.modifierBlurbs.map(escapeHtml).join(" + ") : "same seed worldwide"}</div>
          <div class="text-[9px] opacity-50 mt-1">${dailyLine}</div>
        </button>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2">
        <button data-action="challenge-friend" class="rounded-2xl border border-paper/40 text-paper font-bold py-3 text-sm">
          Challenge friend
        </button>
        <button data-action="inbox" class="relative rounded-2xl border border-paper/40 text-paper font-bold py-3 text-sm">
          Challenges
          ${meta.inboxUnseen && meta.inboxUnseen > 0
            ? `<span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">${meta.inboxUnseen > 9 ? "9+" : meta.inboxUnseen}</span>`
            : ""}
        </button>
      </div>

      <div class="mt-3 grid grid-cols-4 gap-2">
        <button data-action="ranked" class="rounded-2xl border border-paper/40 text-paper font-bold py-2.5 text-[10px]">
          Ranked
        </button>
        <button data-action="skins" class="rounded-2xl border border-paper/40 text-paper font-bold py-2.5 text-[10px]">
          Gallery
        </button>
        <button data-action="leaderboard" class="rounded-2xl border border-paper/40 text-paper font-bold py-2.5 text-[10px]">
          Board
        </button>
        <button data-action="friends" class="rounded-2xl border border-paper/40 text-paper font-bold py-2.5 text-[10px]">
          Friends
        </button>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        ${toggle("sound", "Sound", settings.sound)}
        ${toggle("highContrast", "Contrast", settings.highContrast)}
        ${toggle("reducedMotion", "Motion", settings.reducedMotion)}
      </div>
    </div>
  `;
  host.appendChild(wrap);
  const flyOutThenPlay = (action: () => void): void => {
    const mascot = wrap.querySelector("[data-menu-mascot]");
    const content = wrap.querySelector("[data-menu-content]");
    if (!mascot || !content || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      action();
      return;
    }
    mascot.classList.remove("menu-mascot");
    mascot.classList.add("menu-mascot-flyout");
    content.classList.add("menu-content-fade");
    window.setTimeout(action, 380);
  };
  wrap.querySelector('[data-action="play"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    flyOutThenPlay(() => cbs.onPlay());
  });
  wrap.querySelector('[data-action="daily"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onPlayDaily();
  });
  wrap.querySelector('[data-action="inbox"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenInbox();
  });
  wrap.querySelector('[data-action="challenge-friend"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onChallengeFriend();
  });
  wrap.querySelector('[data-action="skins"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenSkins();
  });
  wrap.querySelector('[data-action="leaderboard"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenLeaderboard();
  });
  wrap.querySelector('[data-action="friends"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenFriends();
  });
  wrap.querySelector('[data-action="ranked"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    cbs.onOpenRanked();
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

function formatPlays(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
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
  onShare?: () => void;
  challengeContext?: {
    creator: string;
    creatorScore: number;
    canChallengeBack: boolean;
  };
  onChallengeBack?: () => void;
}

export function renderGameOver(
  host: HTMLElement,
  score: number,
  onRestart: () => void,
  onMenu: () => void,
  extra?: GameOverResult,
): void {
  const unlocks = extra?.result?.unlocked ?? [];
  if (unlocks.length > 0) {
    renderUnlockCelebration(host, unlocks, () => {
      renderGameOverInner(host, score, onRestart, onMenu, extra);
    });
    return;
  }
  renderGameOverInner(host, score, onRestart, onMenu, extra);
}

function renderGameOverInner(
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
  const ctx = extra?.challengeContext;
  const versus = ctx
    ? `<div class="mt-2 rounded-2xl bg-white/10 px-4 py-3 text-left">
         <div class="text-[10px] uppercase tracking-wider opacity-60">vs @${escapeHtml(ctx.creator)}</div>
         <div class="flex items-baseline justify-between mt-1">
           <div><span class="text-2xl font-bold">${score}</span> <span class="opacity-50">you</span></div>
           <div class="opacity-70">${ctx.creatorScore} <span class="opacity-50">them</span></div>
         </div>
         <div class="mt-1 text-[11px] ${score > ctx.creatorScore ? "text-green-300" : score < ctx.creatorScore ? "text-orange-300" : "opacity-70"}">${
           score > ctx.creatorScore ? "you win" : score < ctx.creatorScore ? "they win" : "tie"
         }</div>
       </div>`
    : "";
  const cbButton = ctx && ctx.canChallengeBack && extra?.onChallengeBack
    ? `<button data-challenge-back class="mt-3 w-full rounded-2xl bg-paper text-ink font-bold py-3">Challenge back</button>`
    : ctx
      ? `<div class="mt-3 text-[10px] opacity-50">chain capped at 2 — share to start a new one</div>`
      : "";
  wrap.innerHTML = `
    <div class="max-w-sm mx-auto text-center">
      <div class="text-xs opacity-70 uppercase tracking-wider">your run</div>
      <div class="text-6xl font-bold mt-1">${score}</div>
      ${acceptStatus}
      ${versus}
      ${unlocksHtml}
      <button data-restart class="mt-4 w-full rounded-2xl bg-paper text-ink font-bold py-5 text-lg shadow-lg active:scale-95 transition">Play again</button>
      <button data-share class="mt-3 w-full rounded-2xl border border-paper/40 text-paper font-bold py-3">${ctx ? "Share result" : "Share run"}</button>
      ${cbButton}
      <button data-menu class="mt-3 w-full text-xs underline opacity-60 py-1">Back to menu</button>
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
  wrap.querySelector("[data-share]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    extra?.onShare?.();
  });
  wrap.querySelector("[data-challenge-back]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    extra?.onChallengeBack?.();
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

type Unlock = NonNullable<NonNullable<GameOverResult["result"]>["unlocked"]>[number];

function renderUnlockCelebration(host: HTMLElement, unlocks: Unlock[], onDone: () => void): void {
  let index = 0;

  const showOne = (): void => {
    const u = unlocks[index];
    if (!u) {
      onDone();
      return;
    }
    const glow = RARITY_COLOR[u.rarity];
    const overlay = document.createElement("div");
    overlay.dataset.noFlap = "true";
    overlay.className =
      "unlock-celebrate-backdrop pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm text-paper font-display";
    const remaining = unlocks.length - index - 1;
    const moreLabel = remaining > 0 ? `<div class="mt-3 text-[10px] opacity-60">${remaining} more after this</div>` : "";
    overlay.innerHTML = `
      <div class="max-w-sm w-full px-6 text-center">
        <div class="unlock-celebrate-headline text-[11px] uppercase font-bold opacity-80" style="letter-spacing:0.25em">new skin</div>
        <div class="mt-6 flex justify-center" style="--unlock-glow:${glow}">
          <svg viewBox="-20 -20 40 40" class="unlock-celebrate-svg w-60 h-60">
            <polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="rgb(${u.body.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
            <polygon points="1,0 -14,6 -1,11" fill="rgb(${u.accent.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/>
          </svg>
        </div>
        <div class="mt-6 text-2xl font-bold capitalize tracking-widest" style="color:${glow}">${u.rarity}</div>
        <div class="mt-1 text-[11px] opacity-70">unlocked at ${u.threshold} games</div>
        ${moreLabel}
        <button data-unlock-continue class="mt-8 w-full rounded-2xl bg-paper text-ink font-bold py-3">Continue</button>
      </div>
    `;
    host.appendChild(overlay);
    playUnlockSound(u.rarity);
    triggerUnlockHaptic(u.rarity);

    const advance = (): void => {
      overlay.remove();
      index += 1;
      showOne();
    };
    overlay.querySelector("[data-unlock-continue]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      advance();
    });
  };

  showOne();
}
