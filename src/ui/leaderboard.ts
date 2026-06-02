import { fetchLeaderboard, type LeaderboardScope, type LeaderboardPeriod, type LeaderboardMode } from "../social/leaderboard";
import { authState } from "../social/auth";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { shapeSvgInner } from "./shape-svg";
import { DEFAULT_SHAPE_ID, type ShapeId } from "../game/shapes";

export function renderLeaderboard(
  host: HTMLElement,
  onClose: () => void,
  onViewProfile?: (username: string) => void,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-30 bg-black/80 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">leaderboard</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-scopes class="px-5 grid grid-cols-2 gap-2 text-[12px]">
      ${seg("scope", "global", "global", true)}
      ${seg("scope", "friends", "friends", false)}
    </div>
    <div data-periods class="px-5 mt-2 grid grid-cols-4 gap-2 text-[12px]">
      ${seg("period", "total", "all-time", false)}
      ${seg("period", "monthly", "month", false)}
      ${seg("period", "weekly", "week", true)}
      ${seg("period", "daily", "daily", false)}
    </div>
    <div data-modes class="px-5 mt-2 grid grid-cols-4 gap-2 text-[12px]">
      ${seg("mode", "all", "all", true)}
      ${seg("mode", "casual", "casual", false)}
      ${seg("mode", "ranked", "ranked", false)}
      ${seg("mode", "daily", "daily", false)}
    </div>
    <div data-list class="mt-3 px-3 flex-1 overflow-y-auto pb-6">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
  `;
  host.appendChild(wrap);

  let scope: LeaderboardScope = "global";
  let period: LeaderboardPeriod = "weekly";
  let mode: LeaderboardMode = "all";
  let cancelled = false;
  // Monotonic token so a slow in-flight fetch can't render under a tab the
  // user has since switched away from (rapid tab taps would otherwise race).
  let loadSeq = 0;

  const close = () => {
    cancelled = true;
    wrap.remove();
    onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  const setActive = (sel: string, active: HTMLButtonElement): void => {
    wrap.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => {
      const on = b === active;
      // Active: cream pill + dark text. Inactive: faint pill + light text.
      // (Previously inactive buttons lost text-ink but kept dark text on the
      // dark backdrop → unreadable.)
      b.classList.toggle("bg-paper", on);
      b.classList.toggle("text-ink", on);
      b.classList.toggle("bg-white/5", !on);
      b.classList.toggle("text-paper", !on);
      b.classList.toggle("opacity-60", !on);
    });
  };

  wrap.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      scope = btn.dataset.scope as LeaderboardScope;
      setActive("[data-scope]", btn);
      void load();
    }),
  );
  wrap.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      period = btn.dataset.period as LeaderboardPeriod;
      setActive("[data-period]", btn);
      void load();
    }),
  );
  wrap.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      mode = btn.dataset.mode as LeaderboardMode;
      setActive("[data-mode]", btn);
      void load();
    }),
  );

  async function load(): Promise<void> {
    const seq = ++loadSeq;
    const list = wrap.querySelector("[data-list]") as HTMLDivElement;
    list.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">loading…</div>`;
    const rows = await fetchLeaderboard(scope, period, mode, 100);
    // Drop the result if closed, or if a newer load has started since.
    if (cancelled || seq !== loadSeq) return;
    if (rows.length === 0) {
      const hint = scope === "friends"
        ? "add friends and play to fill this board."
        : "play a game to put a mark down.";
      list.innerHTML = `
        <div class="text-center text-xs opacity-60 mt-12">
          no runs yet${authState().offline ? " · offline" : ""}.<br/>
          ${hint}
        </div>`;
      return;
    }
    list.innerHTML = "";
    const me = authState().user?.id;
    rows.forEach((row, idx) => {
      const rank = idx + 1;
      const r = document.createElement("div");
      const isMe = row.user_id === me;
      const podium = rank <= 3;
      r.className = [
        "flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5 transition-colors",
        isMe ? "bg-paper/15 ring-1 ring-paper/50" : podium ? "bg-white/[0.07]" : "bg-white/5",
      ].join(" ");
      const rarityColor = row.skin_rarity ? RARITY_COLOR[row.skin_rarity as Rarity] : "#9ca3af";
      const plane = row.body && row.accent
        ? `<svg viewBox="-20 -20 40 40" class="w-7 h-7 shrink-0">${shapeSvgInner((row.shape ?? DEFAULT_SHAPE_ID) as ShapeId, row.body, row.accent)}</svg>`
        : `<div class="w-7 h-7 rounded-full bg-white/10 shrink-0"></div>`;
      const meChip = isMe
        ? `<span class="text-[9px] uppercase tracking-wider bg-paper text-ink rounded px-1 py-0.5 font-bold">you</span>`
        : "";
      r.innerHTML = `
        <div class="w-7 flex items-center justify-center shrink-0">${rankBadge(rank)}</div>
        ${plane}
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate flex items-center gap-1.5">${row.username ? escapeHtml(row.username) : anonName(row.user_id)} ${meChip}</div>
          <div class="text-[10px] opacity-50" style="color:${rarityColor}">${row.skin_rarity ?? ""}</div>
        </div>
        <div class="font-bold ${podium ? "text-xl" : "text-lg"} tabular-nums">${row.score}</div>
      `;
      if (onViewProfile && row.username) {
        r.classList.add("cursor-pointer");
        r.addEventListener("click", (e) => {
          e.stopPropagation();
          onViewProfile(row.username as string);
        });
      }
      list.appendChild(r);
    });
  }

  void load();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

/** A stable, distinguishable name for handle-less players, derived from the
 *  first 4 chars of their user id (e.g. "guest-3f9a"). Beats every anon
 *  showing the same "anon". */
function anonName(userId: string | null): string {
  if (!userId) return "guest";
  return `guest-${userId.slice(0, 4)}`;
}

/** Gold/silver/bronze medal disc for the podium, plain number otherwise. */
function rankBadge(rank: number): string {
  const medals: Record<number, { bg: string; fg: string }> = {
    1: { bg: "#f5c542", fg: "#3a2c00" },
    2: { bg: "#cdd3da", fg: "#2b2f33" },
    3: { bg: "#cd8a52", fg: "#2e1a09" },
  };
  const m = medals[rank];
  if (m) {
    return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold" style="background:${m.bg};color:${m.fg}">${rank}</span>`;
  }
  return `<span class="text-[11px] opacity-60 tabular-nums">${rank}</span>`;
}

function seg(attr: "scope" | "period" | "mode", id: string, label: string, active: boolean): string {
  // Full-width segmented control: each button stretches to fill its grid cell.
  return `<button data-${attr}="${id}" class="w-full text-center rounded-full px-2 py-1 whitespace-nowrap ${
    active ? "bg-paper text-ink" : "bg-white/5 text-paper opacity-60"
  }">${label}</button>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
