import { listFriends, type Friend } from "../social/friends";
import { authState } from "../social/auth";

export type ChallengeSeedSource = "casual" | "daily";

export interface ChallengePickResult {
  friend: Friend | null; // null = open challenge (no specific recipient)
  seedSource: ChallengeSeedSource;
}

export interface ChallengePickCallbacks {
  onPick(result: ChallengePickResult): void;
  onClose(): void;
}

export function renderChallengePickFriend(
  host: HTMLElement,
  cbs: ChallengePickCallbacks,
): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className =
    "pointer-events-auto absolute inset-0 z-30 bg-black/85 backdrop-blur-sm font-display text-paper flex flex-col";
  wrap.innerHTML = `
    <div class="px-5 pt-5 pb-3 flex items-center justify-between">
      <h2 class="text-xl font-bold">challenge a friend</h2>
      <button data-close class="text-sm underline opacity-70">close</button>
    </div>
    <div class="px-5 mb-3">
      <div class="text-[11px] opacity-60 uppercase tracking-wider">seed source</div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button data-source="casual" class="rounded-2xl border border-paper/40 text-paper py-3 text-sm bg-paper/10">
          fresh random
        </button>
        <button data-source="daily" class="rounded-2xl border border-paper/40 text-paper py-3 text-sm">
          today's daily
        </button>
      </div>
      <div data-source-blurb class="mt-2 text-[11px] opacity-60 text-center">a brand-new seed only you and the friend will see.</div>
    </div>
    <div class="px-5 mb-3 text-[11px] opacity-60 uppercase tracking-wider">pick a friend</div>
    <div data-list class="px-3 flex-1 overflow-y-auto pb-4 space-y-2">
      <div class="text-center text-xs opacity-60 mt-12">loading…</div>
    </div>
    <div class="px-5 pb-5 border-t border-white/10 pt-3">
      <button data-skip class="w-full rounded-2xl border border-paper/40 py-3 text-sm">
        skip — make an open challenge link
      </button>
      <div class="mt-2 text-[10px] opacity-50 text-center">open links can be claimed by anyone, friends or not.</div>
    </div>
  `;
  host.appendChild(wrap);

  let cancelled = false;
  let source: ChallengeSeedSource = "casual";

  const close = () => {
    cancelled = true;
    wrap.remove();
    cbs.onClose();
  };
  wrap.querySelector("[data-close]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });

  wrap.querySelectorAll<HTMLButtonElement>("[data-source]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      source = btn.dataset.source as ChallengeSeedSource;
      wrap.querySelectorAll<HTMLButtonElement>("[data-source]").forEach((b) => {
        b.classList.toggle("bg-paper/10", b === btn);
      });
      const blurb = wrap.querySelector("[data-source-blurb]") as HTMLDivElement;
      blurb.textContent =
        source === "daily"
          ? "challenge them on the daily — same seed + modifier they'd play anyway."
          : "a brand-new seed only you and the friend will see.";
    }),
  );

  wrap.querySelector("[data-skip]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrap.remove();
    cbs.onPick({ friend: null, seedSource: source });
  });

  if (authState().offline) {
    const list = wrap.querySelector("[data-list]") as HTMLDivElement;
    list.innerHTML = `
      <div class="text-center text-xs opacity-60 mt-12 px-6">
        offline. friend list needs the backend.<br/>
        you can still make an open challenge link below.
      </div>`;
    return () => wrap.remove();
  }

  listFriends().then((rows) => {
    if (cancelled) return;
    const list = wrap.querySelector("[data-list]") as HTMLDivElement;
    list.innerHTML = "";
    if (rows.length === 0) {
      list.innerHTML = `
        <div class="text-center text-xs opacity-60 mt-12 px-6">
          no friends yet. add some from the Friends panel, or<br/>
          tap 'skip' below to make an open link anyone can claim.
        </div>`;
      return;
    }
    rows.sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
    for (const f of rows) {
      list.appendChild(
        friendCard(f, () => {
          wrap.remove();
          cbs.onPick({ friend: f, seedSource: source });
        }),
      );
    }
  });

  return () => {
    cancelled = true;
    wrap.remove();
  };
}

function friendCard(f: Friend, onTap: () => void): HTMLElement {
  const el = document.createElement("button");
  el.dataset.noFlap = "true";
  el.className =
    "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/5 active:scale-[0.98] transition text-left";
  el.innerHTML = `
    <div class="text-sm font-bold">${f.username ? escapeHtml("@" + f.username) : "(no handle)"}</div>
    <div class="text-[11px] opacity-50">challenge →</div>
  `;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onTap();
  });
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
