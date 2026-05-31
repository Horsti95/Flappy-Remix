import {
  joinRankedQueue,
  leaveRankedQueue,
  listActiveRankedMatches,
  myScores,
  nextUnplayedRound,
  oppScores,
  ratingDelta,
  type QueueState,
  type RankedMatch,
} from "../social/ranked";
import { authState } from "../social/auth";

export interface RankedCallbacks {
  onPlayRound(match: RankedMatch, round: number): void;
  onClose(): void;
}

export function renderRankedPanel(host: HTMLElement, cbs: RankedCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">ranked</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-queue class="px-5"></div>
    <div data-list class="mt-2 px-3 flex-1 overflow-y-auto pb-6 space-y-2">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
  `;
  host.appendChild(wrap);

  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let queue: QueueState | null = null;

  const close = () => {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  async function refresh(): Promise<void> {
    if (cancelled) return;
    if (authState().offline) {
      (wrap.querySelector("[data-queue]") as HTMLDivElement).innerHTML = offlineNote();
      (wrap.querySelector("[data-list]") as HTMLDivElement).innerHTML = "";
      return;
    }
    const matches = await listActiveRankedMatches();
    if (cancelled) return;
    renderQueue();
    renderList(matches);
  }

  function renderQueue(): void {
    const el = wrap.querySelector("[data-queue]") as HTMLDivElement;
    const hasUsername = Boolean(authState().profile?.username);
    if (!queue) {
      if (!hasUsername) {
        el.innerHTML = `
          <div class="rounded-2xl bg-white/10 p-4 text-center">
            <div class="text-sm font-bold">Pick a name to play ranked</div>
            <div class="mt-1 text-[11px] opacity-70">Ranked opponents see your handle. Open the account button (top-right) to set a 3–8 char name.</div>
          </div>
          <p class="mt-2 text-[11px] opacity-60 text-center">best-of-three · 24h per round · ELO</p>
        `;
        return;
      }
      el.innerHTML = `
        <button data-find class="w-full rounded-2xl bg-paper text-ink font-bold py-4">Find match</button>
        <p class="mt-2 text-[11px] opacity-60 text-center">best-of-three · 24h per round · ELO</p>
      `;
      el.querySelector("[data-find]")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await find();
      });
    } else if (queue.state === "queued") {
      const elapsed = queue.elapsed_sec ?? 0;
      const window = queue.window === Number.POSITIVE_INFINITY ? "any rating" : `±${queue.window}`;
      el.innerHTML = `
        <div class="rounded-2xl bg-white/10 p-4 text-center">
          <div class="text-sm">searching for a match…</div>
          <div class="text-[11px] mt-1 opacity-60">${formatElapsed(elapsed)} · pool: ${window} · your rating: ${queue.rating}</div>
          <button data-cancel class="mt-3 text-[11px] underline opacity-80">cancel</button>
        </div>
      `;
      el.querySelector("[data-cancel]")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await leaveRankedQueue();
        queue = null;
        renderQueue();
      });
    } else if (queue.state === "matched" || queue.state === "in_match") {
      el.innerHTML = `<div class="rounded-2xl bg-paper/20 p-4 text-center text-sm">matched! pulling up your match…</div>`;
    }
  }

  function renderList(matches: RankedMatch[]): void {
    const el = wrap.querySelector("[data-list]") as HTMLDivElement;
    if (matches.length === 0) {
      el.innerHTML = `<div class="text-center text-xs opacity-60 mt-8">no ranked history yet.</div>`;
      return;
    }
    el.innerHTML = "";
    for (const m of matches) el.appendChild(matchCard(m, cbs.onPlayRound));
  }

  async function find(): Promise<void> {
    const result = await joinRankedQueue();
    if (!result) return;
    queue = result;
    renderQueue();
    if (result.state === "matched" && result.match_id) {
      await refresh();
      queue = null;
      renderQueue();
    }
    if (!pollTimer) pollTimer = setInterval(pollQueue, 4000);
  }

  async function pollQueue(): Promise<void> {
    if (cancelled || !queue || queue.state !== "queued") return;
    const result = await joinRankedQueue();
    if (!result) return;
    queue = result;
    renderQueue();
    if (result.state === "matched") {
      await refresh();
      queue = null;
      renderQueue();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }
  }

  refresh();

  return () => {
    cancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    wrap.remove();
  };
}

function matchCard(m: RankedMatch, onPlayRound: (m: RankedMatch, round: number) => void): HTMLElement {
  const el = document.createElement("div");
  el.dataset.noFlap = "true";
  el.className = "rounded-2xl bg-white/5 p-4";
  const mine = myScores(m);
  const them = oppScores(m);
  const next = nextUnplayedRound(m);
  const stateBadge =
    m.state === "completed"
      ? `<span class="text-[10px] uppercase tracking-wider opacity-70">completed</span>`
      : m.state === "expired"
        ? `<span class="text-[10px] uppercase tracking-wider text-orange-300">expired</span>`
        : `<span class="text-[10px] uppercase tracking-wider text-paper/80">in progress</span>`;

  const oppLabel = m.opponent.username ? `@${escapeHtml(m.opponent.username)}` : "anon";
  const revealOpp = m.state === "completed" || m.state === "expired";
  const rounds = [0, 1, 2]
    .map((i) => {
      const a = mine[i];
      const b = them[i];
      // Per-round blind reveal: the opponent's score for a round stays
      // hidden ("?") until you've taken your own shot at it. Once your
      // score is locked you can't gain an edge from seeing theirs, so we
      // reveal it then (or at match end) rather than only on completion.
      const revealThis = revealOpp || a != null;
      const bShown = revealThis ? (b == null ? "—" : String(b)) : (b == null ? "—" : "?");
      if (a == null && b == null) return roundChip(i, "—", "—", false);
      if (a == null) return roundChip(i, "—", bShown, false);
      if (b == null) return roundChip(i, String(a), "·", a !== undefined);
      return roundChip(i, String(a), bShown, revealThis ? a > b : false);
    })
    .join("");

  const winner = m.state === "completed"
    ? (m.winner_id == null
      ? `<div class="mt-2 text-[12px] opacity-70">draw</div>`
      : m.winner_id === (m.you_are === "a" ? (m.opponent.user_id === m.opponent.user_id ? null : null) : null)
        ? ""
        : "")
    : "";
  const ratingLine = m.state === "completed"
    ? ratingChange(m)
    : `<div class="text-[11px] opacity-60">round ${next !== null ? next + 1 : 3} of 3</div>`;

  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-sm font-bold">vs ${oppLabel}</div>
      ${stateBadge}
    </div>
    <div class="mt-3 grid grid-cols-3 gap-2">${rounds}</div>
    <div class="mt-3 flex items-center justify-between text-[11px]">
      ${ratingLine}
      ${
        next !== null && m.state === "in_progress"
          ? `<button data-play class="rounded-xl bg-paper text-ink font-bold px-3 py-1.5">Play round ${next + 1}</button>`
          : ""
      }
    </div>
    ${winner}
  `;
  el.querySelector("[data-play]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (next !== null) onPlayRound(m, next);
  });
  return el;
}

function ratingChange(m: RankedMatch): string {
  const d = ratingDelta(m);
  if (d.you == null) return "";
  const sign = d.you > 0 ? "+" : "";
  const color = d.you > 0 ? "text-green-300" : d.you < 0 ? "text-orange-300" : "opacity-70";
  return `<div class="${color} text-[12px] font-bold">${sign}${d.you} ELO</div>`;
}

function roundChip(i: number, a: string, b: string, winA: boolean): string {
  return `
    <div class="rounded-xl bg-white/5 p-2 text-center">
      <div class="text-[9px] opacity-50 uppercase tracking-wider">round ${i + 1}</div>
      <div class="mt-1 text-sm">
        <span class="${winA ? "font-bold" : "opacity-70"}">${a}</span>
        <span class="opacity-40 mx-1">·</span>
        <span class="${!winA && b !== "·" && b !== "—" ? "font-bold" : "opacity-70"}">${b}</span>
      </div>
    </div>
  `;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m === 0 ? `${s}s` : `${m}m ${s}s`;
}

function offlineNote(): string {
  return `<div class="rounded-2xl bg-white/10 p-4 text-center text-sm opacity-80">ranked needs backend — configure Supabase env vars to enable.</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
