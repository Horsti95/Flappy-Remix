import { fetchPublicProfile, type PublicProfile } from "../social/profile";
import { RARITY_COLOR, type Rarity } from "../game/rarity";
import { shapeSvgInner } from "./shape-svg";
import { DEFAULT_SHAPE_ID, type ShapeId } from "../game/shapes";
import { isPlaytester } from "../game/playtester";

/**
 * Public profile inspector — a read-only stat card for any player by
 * username. Opened from the friends list, leaderboard rows, and duel
 * results. Shows only safe aggregates (see social/profile.ts).
 */
export function renderProfile(
  host: HTMLElement,
  username: string,
  onClose: () => void,
  onRaceBestRun?: (username: string) => void,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-40 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">@${escapeHtml(username)}</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-body class="flex-1 overflow-y-auto px-5 pb-8">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
  `;
  host.appendChild(wrap);

  let cancelled = false;
  const close = (): void => {
    cancelled = true;
    wrap.remove();
    onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  void (async () => {
    const profile = await fetchPublicProfile(username);
    if (cancelled) return;
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    if (!profile) {
      body.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">couldn't load this profile.</div>`;
      return;
    }
    body.innerHTML = card(profile);
    // "Race their best" — flies you on the same seed against their best run's
    // ghost. Only when they actually have a scoring run and the caller wired
    // up the handler (logged-in, online).
    if (onRaceBestRun && profile.best_score > 0) {
      const btn = document.createElement("button");
      btn.dataset.noFlap = "true";
      btn.className =
        "mt-4 w-full rounded-2xl bg-paper text-ink font-bold py-3 active:scale-95 transition";
      btn.textContent = `🏁 race their best (${profile.best_score})`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onRaceBestRun(username);
      });
      body.appendChild(btn);
    }
  })();

  return close;
}

function card(p: PublicProfile): string {
  const skin = p.equipped;
  const rarityColor = skin?.rarity ? RARITY_COLOR[skin.rarity as Rarity] : "#9ca3af";
  const plane = skin
    ? `<svg viewBox="-20 -20 40 40" class="w-16 h-16 mx-auto">${shapeSvgInner((p.shape ?? DEFAULT_SHAPE_ID) as ShapeId, skin.body, skin.accent)}</svg>`
    : `<div class="w-16 h-16 mx-auto rounded-full bg-white/10"></div>`;

  const ranked = p.ranked_rating != null
    ? `<div class="mt-4 rounded-2xl bg-white/5 p-4">
         <div class="text-[10px] uppercase tracking-wider opacity-50">ranked</div>
         <div class="flex items-baseline justify-between mt-1">
           <div class="text-2xl font-bold">${p.ranked_rating}<span class="text-[11px] opacity-50 ml-1">elo</span></div>
           <div class="text-sm opacity-80">${p.ranked_wins}W · ${p.ranked_losses}L${p.ranked_draws ? ` · ${p.ranked_draws}D` : ""}</div>
         </div>
       </div>`
    : "";

  const badge = p.best_rank != null && p.best_rank <= 100
    ? `<div class="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style="background:#facc1522;color:#facc15">🏅 top ${p.best_rank} season finish</div>`
    : "";

  const playtester = isPlaytester(p.created_at)
    ? `<div class="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style="background:#34d39922;color:#34d399">🧪 Playtester</div>`
    : "";

  return `
    <div class="text-center">
      ${plane}
      ${skin?.rarity ? `<div class="text-[11px] mt-1" style="color:${rarityColor}">${escapeHtml(skin.rarity)} skin</div>` : ""}
      <div class="flex flex-wrap items-center justify-center gap-2">${badge}${playtester}</div>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-2 text-center">
      ${stat("best run", String(p.best_score))}
      ${stat("games", String(p.total_games))}
      ${stat("total score", formatNum(p.total_score))}
      ${stat("avg / run", String(p.avg_score))}
      ${stat("streak", `${p.streak_days}🔥`)}
      ${stat("joined", formatDate(p.created_at))}
    </div>
    ${ranked}
  `;
}

function stat(label: string, value: string): string {
  return `<div class="rounded-xl bg-white/5 px-3 py-3">
    <div class="text-[9px] uppercase tracking-wider opacity-50">${escapeHtml(label)}</div>
    <div class="text-lg font-bold mt-0.5">${escapeHtml(value)}</div>
  </div>`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
