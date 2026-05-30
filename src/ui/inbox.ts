import {
  declineChallenge,
  fetchIncomingChallenges,
  fetchOutgoingChallenges,
  markInboxSeen,
  type IncomingChallenge,
  type OutgoingChallenge,
} from "../social/challenges";
import { authState } from "../social/auth";

export interface InboxCallbacks {
  /** Play an incoming challenge (drops into a ghost run). */
  onAccept(shortId: string): void;
  onClose(): void;
}

export function renderInbox(host: HTMLElement, cbs: InboxCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">challenges</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div data-tabs class="px-5 flex gap-2 text-[12px]">
      <button data-tab="incoming" class="rounded-full px-3 py-1 bg-paper text-ink whitespace-nowrap">incoming</button>
      <button data-tab="outgoing" class="rounded-full px-3 py-1 bg-white/5 opacity-60 whitespace-nowrap">sent</button>
    </div>
    <div data-body class="mt-3 px-3 flex-1 overflow-y-auto pb-6">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
  `;
  host.appendChild(wrap);

  let cancelled = false;
  let tab: "incoming" | "outgoing" = "incoming";

  const close = (): void => {
    cancelled = true;
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  wrap.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      tab = btn.dataset.tab as "incoming" | "outgoing";
      wrap.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => {
        b.classList.toggle("bg-paper", b === btn);
        b.classList.toggle("text-ink", b === btn);
        b.classList.toggle("opacity-60", b !== btn);
        b.classList.toggle("bg-white/5", b !== btn);
      });
      void load();
    }),
  );

  const offline = authState().offline;

  async function load(): Promise<void> {
    const body = wrap.querySelector("[data-body]") as HTMLDivElement;
    if (offline) {
      body.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">challenges need a connection.</div>`;
      return;
    }
    body.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">loading…</div>`;
    if (tab === "incoming") {
      const rows = await fetchIncomingChallenges();
      if (cancelled) return;
      void markInboxSeen();
      renderIncoming(body, rows);
    } else {
      const rows = await fetchOutgoingChallenges();
      if (cancelled) return;
      renderOutgoing(body, rows);
    }
  }

  function renderIncoming(body: HTMLDivElement, rows: IncomingChallenge[]): void {
    if (rows.length === 0) {
      body.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">no incoming challenges. ask a friend to send you one!</div>`;
      return;
    }
    body.innerHTML = "";
    for (const r of rows) {
      const el = document.createElement("div");
      el.className = "rounded-2xl bg-white/5 p-4 mb-2";
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="text-sm font-bold">@${escapeHtml(r.creator_username ?? "anon")}</div>
          <div class="text-[10px] opacity-50">${timeAgo(r.created_at)}</div>
        </div>
        <div class="text-[11px] opacity-70 mt-1">scored ${r.creator_score} — can you beat it?</div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button data-accept class="rounded-xl bg-paper text-ink font-bold py-2.5 text-sm">Accept · play</button>
          <button data-decline class="rounded-xl border border-paper/40 py-2.5 text-sm opacity-80">Decline</button>
        </div>
      `;
      el.querySelector("[data-accept]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        cbs.onAccept(r.short_id);
      });
      el.querySelector("[data-decline]")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await declineChallenge(r.short_id);
        void load();
      });
      body.appendChild(el);
    }
  }

  function renderOutgoing(body: HTMLDivElement, rows: OutgoingChallenge[]): void {
    if (rows.length === 0) {
      body.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">you haven't sent any direct challenges yet.</div>`;
      return;
    }
    body.innerHTML = "";
    for (const r of rows) {
      const el = document.createElement("div");
      el.className = "rounded-2xl bg-white/5 p-4 mb-2";
      const statusChip = statusBadge(r);
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="text-sm font-bold">to @${escapeHtml(r.target_username ?? "anon")}</div>
          ${statusChip}
        </div>
        <div class="text-[11px] opacity-70 mt-1">
          you ${r.creator_score}${
            r.responder_score != null ? ` · them ${r.responder_score}` : ""
          }
        </div>
      `;
      body.appendChild(el);
    }
  }

  void load();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function statusBadge(r: OutgoingChallenge): string {
  if (r.status === "accepted") {
    const youWon = r.responder_score != null && r.creator_score > r.responder_score;
    const tone = youWon ? "text-green-300" : (r.responder_score != null && r.creator_score < r.responder_score) ? "text-orange-300" : "opacity-70";
    const label = r.responder_score == null ? "played" : youWon ? "you won" : r.creator_score < r.responder_score ? "they won" : "tie";
    return `<span class="text-[10px] uppercase tracking-wider ${tone}">${label}</span>`;
  }
  if (r.status === "declined") {
    return `<span class="text-[10px] uppercase tracking-wider text-orange-300/70">declined</span>`;
  }
  return `<span class="text-[10px] uppercase tracking-wider opacity-60">pending</span>`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
