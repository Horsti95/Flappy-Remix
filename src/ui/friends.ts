import { addFriendByUsername, getRecordVsFriend, listFriends, refreshFriendCount, removeFriend, type Friend, type VsRecord } from "../social/friends";
import { authState } from "../social/auth";

export function renderFriendsPanel(host: HTMLElement, onClose: () => void): () => void {
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
    status.textContent = "adding…";
    const r = await addFriendByUsername(input.value);
    if (r.ok) {
      status.textContent = "added";
      input.value = "";
      await load();
      void refreshFriendCount();
    } else {
      status.textContent = r.reason;
    }
  });

  async function load() {
    const rows = await listFriends();
    if (cancelled) return;
    list.innerHTML = "";
    if (rows.length === 0) {
      list.innerHTML = `<div class="text-center text-xs opacity-60 mt-12">no friends yet — add by handle above.</div>`;
      return;
    }
    rows.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
    rows.forEach((f) => list.appendChild(row(f, async () => {
      await removeFriend(f.user_id);
      await load();
      void refreshFriendCount();
    })));
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

function row(f: Friend, onRemove: () => void): HTMLElement {
  const el = document.createElement("div");
  el.dataset.friendId = f.user_id;
  el.className = "flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-white/5";
  el.innerHTML = `
    <div class="flex-1 min-w-0">
      <div class="text-sm truncate">${f.username ? escapeHtml("@" + f.username) : "(no handle)"}</div>
      <div data-record class="text-[10px] opacity-50 mt-0.5">vs: …</div>
    </div>
    <button data-remove class="text-[11px] underline opacity-60">remove</button>
  `;
  el.querySelector("[data-remove]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
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
