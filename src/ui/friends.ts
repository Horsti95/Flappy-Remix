import { addFriendByUsername, getRecordVsFriend, listFriends, refreshFriendCount, removeFriend, listIncomingRequests, acceptFriendRequest, declineFriendRequest, type Friend, type FriendRequest, type VsRecord } from "../social/friends";
import { authState } from "../social/auth";

export interface FriendsPanelCallbacks {
  onChallenge?: (friend: Friend) => void;
  onRankedChallenge?: (friend: Friend) => void;
  onViewProfile?: (friend: Friend) => void;
}

export function renderFriendsPanel(host: HTMLElement, onClose: () => void, cbs?: FriendsPanelCallbacks): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-30 bg-black/80 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">friends</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div class="px-5">
      <form data-add class="flex gap-2">
        <input data-username autocomplete="off" autocapitalize="none" spellcheck="false"
               maxlength="8"
               class="flex-1 rounded-xl bg-white/10 px-3 py-2 text-base outline-none focus:bg-white/20"
               placeholder="username" />
        <button class="rounded-xl bg-paper text-ink px-4 py-2 font-bold">add</button>
      </form>
      <div data-status class="mt-2 text-[12px] min-h-[1em] opacity-80"></div>
      <div data-me class="mt-3 text-[11px] opacity-60"></div>
    </div>
    <div data-list class="mt-2 px-3 flex-1 overflow-y-auto pb-6 space-y-2">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
  `;
  host.appendChild(wrap);

  const list = wrap.querySelector("[data-list]") as HTMLDivElement;
  const status = wrap.querySelector("[data-status]") as HTMLDivElement;
  const me = wrap.querySelector("[data-me]") as HTMLDivElement;

  const profile = authState().profile;
  if (profile?.friend_code) {
    me.textContent = `your friend code: ${profile.friend_code}`;
  } else if (authState().offline) {
    me.textContent = "offline — friends sync requires backend";
  }

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

  const form = wrap.querySelector("[data-add]") as HTMLFormElement;
  const input = wrap.querySelector("[data-username]") as HTMLInputElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    status.textContent = "sending…";
    const r = await addFriendByUsername(input.value);
    if (r.ok) {
      status.textContent = r.state === "accepted" ? "friend added!" : "request sent — waiting for them to accept.";
      input.value = "";
      await load();
      void refreshFriendCount();
    } else {
      status.textContent = r.reason;
    }
  });

  async function load() {
    const [rows, requests] = await Promise.all([listFriends(), listIncomingRequests()]);
    if (cancelled) return;
    list.innerHTML = "";
    // Incoming friend requests first — each with accept / decline.
    if (requests.length > 0) {
      const reqHeader = document.createElement("div");
      reqHeader.className = "text-[10px] uppercase tracking-wider opacity-60 font-bold px-1 mb-1";
      reqHeader.textContent = `requests (${requests.length})`;
      list.appendChild(reqHeader);
      for (const req of requests) {
        list.appendChild(requestRow(req,
          async () => { await acceptFriendRequest(req.user_id); await load(); void refreshFriendCount(); },
          async () => { await declineFriendRequest(req.user_id); await load(); },
        ));
      }
      const friendsHeader = document.createElement("div");
      friendsHeader.className = "text-[10px] uppercase tracking-wider opacity-60 font-bold px-1 mt-3 mb-1";
      friendsHeader.textContent = "friends";
      list.appendChild(friendsHeader);
    }
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-center text-xs opacity-60 mt-6";
      empty.textContent = requests.length > 0 ? "no friends yet — accept a request above." : "no friends yet — add by handle above.";
      list.appendChild(empty);
      return;
    }
    rows.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
    rows.forEach((f) => list.appendChild(row(f, async () => {
      await removeFriend(f.user_id);
      await load();
      void refreshFriendCount();
    }, cbs?.onChallenge ? () => cbs.onChallenge!(f) : undefined,
    cbs?.onViewProfile && f.username ? () => cbs.onViewProfile!(f) : undefined,
    cbs?.onRankedChallenge ? () => cbs.onRankedChallenge!(f) : undefined)));
    // Backfill the vs-record badges asynchronously so the list paints fast.
    void Promise.all(
      rows.map(async (f) => {
        const record = await getRecordVsFriend(f.user_id);
        if (cancelled) return;
        const el = list.querySelector(`[data-friend-id="${f.user_id}"] [data-record]`);
        if (el) el.innerHTML = recordBadge(record);
      }),
    );
  }

  load();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function requestRow(req: FriendRequest, onAccept: () => void, onDecline: () => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-emerald-400/5 border border-emerald-400/20 mb-1";
  el.innerHTML = `
    <div class="flex-1 min-w-0">
      <div class="text-sm truncate">${req.username ? escapeHtml("@" + req.username) : "(no handle)"}</div>
      <div class="text-[10px] opacity-50 mt-0.5">wants to be friends</div>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button data-accept class="rounded-lg bg-emerald-400 text-ink text-[11px] font-bold px-3 py-1.5">accept</button>
      <button data-decline class="text-[11px] underline opacity-60">decline</button>
    </div>
  `;
  el.querySelector("[data-accept]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onAccept();
  });
  el.querySelector("[data-decline]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onDecline();
  });
  return el;
}

function row(f: Friend, onRemove: () => void, onChallenge?: () => void, onView?: () => void, onRankedChallenge?: () => void): HTMLElement {
  const el = document.createElement("div");
  el.dataset.friendId = f.user_id;
  el.className = "flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-white/5";
  const challengeBtn = onChallenge
    ? `<button data-challenge class="rounded-lg bg-paper text-ink text-[11px] font-bold px-3 py-1.5">challenge</button>`
    : "";
  const rankedBtn = onRankedChallenge
    ? `<button data-ranked class="rounded-lg bg-amber-300 text-ink text-[11px] font-bold px-3 py-1.5">ranked</button>`
    : "";
  // The handle is a tappable profile link when a view callback + handle exist.
  const nameEl = onView && f.username
    ? `<button data-view class="text-sm truncate underline decoration-dotted underline-offset-2 text-left">${escapeHtml("@" + f.username)}</button>`
    : `<div class="text-sm truncate">${f.username ? escapeHtml("@" + f.username) : "(no handle)"}</div>`;
  el.innerHTML = `
    <div class="flex-1 min-w-0">
      ${nameEl}
      <div data-record class="text-[10px] opacity-50 mt-0.5">vs: …</div>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      ${rankedBtn}
      ${challengeBtn}
      <button data-remove class="text-[11px] underline opacity-60">remove</button>
    </div>
  `;
  el.querySelector("[data-remove]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
  });
  el.querySelector("[data-challenge]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onChallenge?.();
  });
  el.querySelector("[data-ranked]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onRankedChallenge?.();
  });
  el.querySelector("[data-view]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onView?.();
  });
  return el;
}

function recordBadge(r: VsRecord): string {
  if (r.total === 0) {
    return `<span class="opacity-60">vs: no matches yet</span>`;
  }
  const pct = r.total > 0 ? Math.round((r.wins / r.total) * 100) : 0;
  const tone = r.wins > r.losses ? "text-emerald-300" : r.wins < r.losses ? "text-orange-300" : "opacity-70";
  const draws = r.draws > 0 ? ` <span class="opacity-50">${r.draws}D</span>` : "";
  return `<span class="${tone}">vs: ${r.wins}W ${r.losses}L${draws}</span> <span class="opacity-40 ml-1">· ${pct}% win</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
