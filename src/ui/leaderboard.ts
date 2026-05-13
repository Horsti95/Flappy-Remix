import { fetchLeaderboard, type LeaderboardScope } from "../social/leaderboard";
import { authState } from "../social/auth";
import { RARITY_COLOR, type Rarity } from "../game/rarity";

export function renderLeaderboard(host: HTMLElement, onClose: () => void): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-30 bg-black/80 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">leaderboard</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-tabs class="px-5 flex gap-2 text-[12px] overflow-x-auto">
      ${tab("all_time", "all time", true)}
      ${tab("weekly", "this week")}
      ${tab("daily", "today")}
      ${tab("friends", "friends")}
    </div>
    <div data-list class="mt-3 px-3 flex-1 overflow-y-auto pb-6">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
  `;
  host.appendChild(wrap);

  let scope: LeaderboardScope = "all_time";
  let cancelled = false;

  const close = () => {
    cancelled = true;
    wrap.remove();
    onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      scope = btn.dataset.scope as LeaderboardScope;
      wrap.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach((b) => {
        b.classList.toggle("bg-paper", b === btn);
        b.classList.toggle("text-ink", b === btn);
        b.classList.toggle("opacity-60", b !== btn);
      });
      load();
    }),
  );

  async function load() {
    const list = wrap.querySelector("[data-list]") as HTMLDivElement;
    list.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">loading…</div>`;
    const rows = await fetchLeaderboard(scope, 100);
    if (cancelled) return;
    if (rows.length === 0) {
      list.innerHTML = `
        <div class="text-center text-xs opacity-60 mt-12">
          no runs yet${authState().offline ? " · offline" : ""}.<br/>
          play a game to put a mark down.
        </div>`;
      return;
    }
    list.innerHTML = "";
    const me = authState().user?.id;
    rows.forEach((row, idx) => {
      const r = document.createElement("div");
      const isMe = row.user_id === me;
      r.className = `flex items-center gap-3 px-3 py-2 rounded-xl ${isMe ? "bg-paper/15" : "bg-white/5"}`;
      const rarityColor = row.skin_rarity ? RARITY_COLOR[row.skin_rarity as Rarity] : "#9ca3af";
      const plane = row.body && row.accent
        ? `<svg viewBox="-20 -20 40 40" class="w-7 h-7"><polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="rgb(${row.body.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/><polygon points="1,0 -14,6 -1,11" fill="rgb(${row.accent.join(",")})" stroke="#1a1a1a" stroke-width="0.8"/></svg>`
        : `<div class="w-7 h-7 rounded-full bg-white/10"></div>`;
      r.innerHTML = `
        <div class="w-6 text-right text-[11px] opacity-60">${idx + 1}</div>
        ${plane}
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">${row.username ? escapeHtml(row.username) : "anon"}</div>
          <div class="text-[10px] opacity-50" style="color:${rarityColor}">${row.skin_rarity ?? ""}</div>
        </div>
        <div class="font-bold text-lg">${row.score}</div>
      `;
      list.appendChild(r);
    });
  }

  load();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function tab(id: LeaderboardScope, label: string, active = false): string {
  return `<button data-scope="${id}" class="rounded-full px-3 py-1 ${
    active ? "bg-paper text-ink" : "bg-white/5 opacity-60"
  }">${label}</button>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
