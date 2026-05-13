import { addFriendByUsername, listFriends, removeFriend, type Friend } from "../social/friends";
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
    })));
  }

  load();

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function row(f: Friend, onRemove: () => void): HTMLElement {
  const el = document.createElement("div");
  el.className = "flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-white/5";
  el.innerHTML = `
    <div class="text-sm">${f.username ? escapeHtml("@" + f.username) : "(no handle)"}</div>
    <button data-remove class="text-[11px] underline opacity-60">remove</button>
  `;
  el.querySelector("[data-remove]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    onRemove();
  });
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
