import { authState, claimUsername, signInWithGoogle, signOut, subscribeAuth } from "../social/auth";
import { validateUsername } from "../social/profanity";
import { refreshGrantedShapes } from "../social/grants";

export function renderAccountPanel(host: HTMLElement, onClose: () => void): () => void {
  const wrap = document.createElement("div");
  wrap.dataset.noFlap = "true";
  wrap.className = "pointer-events-auto absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center px-6 font-display text-paper";
  host.appendChild(wrap);

  const unsub = subscribeAuth((s) => {
    if (!s.ready) {
      wrap.innerHTML = `<div class="opacity-70 text-sm">loading…</div>`;
      return;
    }
    if (s.offline) {
      wrap.innerHTML = offlineView();
      bindCloseButtons(wrap, onClose);
      return;
    }
    const hasUsername = !!s.profile?.username;
    const isGoogle = (s.user?.app_metadata?.providers as string[] | undefined)?.includes("google");
    wrap.innerHTML = `
      <div class="w-full max-w-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold">account</h2>
          <button data-close class="text-sm underline opacity-70">close</button>
        </div>

        <div class="mt-4 rounded-2xl bg-white/5 p-4">
          <div class="text-[11px] uppercase tracking-wider opacity-60">handle</div>
          ${
            hasUsername
              ? `<div class="text-2xl font-bold mt-1">${escapeHtml(s.profile!.username!)}</div>
                 <div class="mt-1 text-[11px] opacity-50">handles are permanent in v1.</div>`
              : `<form data-username-form class="mt-2 flex gap-2">
                   <input data-username name="username" autocomplete="off" autocapitalize="none" spellcheck="false"
                          maxlength="8" minlength="3"
                          class="flex-1 rounded-xl bg-white/10 px-3 py-2 text-base outline-none focus:bg-white/20"
                          placeholder="3-8 chars, a-z, 0-9" />
                   <button class="rounded-xl bg-paper text-ink px-4 py-2 font-bold disabled:opacity-50">claim</button>
                 </form>
                 <div data-username-error class="mt-2 text-[12px] text-red-300 min-h-[1em]"></div>`
          }
        </div>

        <div class="mt-3 rounded-2xl bg-white/5 p-4">
          <div class="text-[11px] uppercase tracking-wider opacity-60">sign in</div>
          ${
            isGoogle
              ? `<div class="text-sm mt-1">signed in with Google.</div>`
              : `<p class="text-xs mt-1 opacity-70">currently anonymous. sign in to keep your runs across devices.</p>
                 <button data-google class="mt-3 w-full rounded-xl bg-paper text-ink font-bold py-3">continue with Google</button>`
          }
        </div>

        <div class="mt-3 rounded-2xl bg-white/5 p-4">
          <div class="text-[11px] uppercase tracking-wider opacity-60">redeem code</div>
          <form data-redeem-form class="mt-2 flex gap-2 items-stretch">
            <input data-redeem-input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
                   maxlength="32"
                   class="flex-1 min-w-0 rounded-xl bg-white/10 px-3 py-2 text-base outline-none focus:bg-white/20 uppercase tracking-wider"
                   placeholder="enter code" />
            <button class="shrink-0 rounded-xl bg-paper text-ink px-3 py-2 text-sm font-bold disabled:opacity-50">use</button>
          </form>
          <div data-redeem-status class="mt-2 text-[12px] min-h-[1em] opacity-70"></div>
        </div>

        <div class="mt-3 rounded-2xl bg-white/5 p-4">
          <div class="text-[11px] uppercase tracking-wider opacity-60">stats</div>
          <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
            <div><div class="opacity-60">games</div><div class="font-bold text-base">${s.profile?.total_games ?? 0}</div></div>
            <div><div class="opacity-60">streak</div><div class="font-bold text-base">${s.profile?.streak_days ?? 0}</div></div>
            <div><div class="opacity-60">user id</div><div class="font-mono text-[10px] truncate">${s.user?.id?.slice(0, 8) ?? "—"}</div></div>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-2 gap-2 text-[11px]">
          <button data-export class="rounded-xl bg-white/5 py-2">export my data</button>
          <button data-delete class="rounded-xl bg-red-900/40 text-red-100 py-2">delete account</button>
        </div>
        <div data-account-status class="mt-2 text-[11px] opacity-60 min-h-[1em]"></div>
      </div>
    `;
    bindCloseButtons(wrap, onClose);
    wrap.querySelector("[data-google]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      signInWithGoogle();
    });
    wrap.querySelector("[data-redeem-form]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = wrap.querySelector("[data-redeem-input]") as HTMLInputElement;
      const status = wrap.querySelector("[data-redeem-status]") as HTMLDivElement;
      const raw = input.value.trim();
      if (!raw) return;
      if (!s.session) {
        status.textContent = "not signed in";
        return;
      }
      status.className = "mt-2 text-[12px] min-h-[1em] opacity-70";
      status.textContent = "checking…";
      try {
        const res = await fetch("/api/redeem-code", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${s.session.access_token}`,
          },
          body: JSON.stringify({ code: raw }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          label?: string;
          error?: string;
          granted_shape?: string | null;
        };
        if (!res.ok || !body.ok) {
          status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
          status.textContent = redeemErrorMessage(body.error ?? `http_${res.status}`);
          return;
        }
        status.className = "mt-2 text-[12px] min-h-[1em] text-emerald-300";
        status.textContent = body.granted_shape
          ? `unlocked: ${body.label} (+ ${body.granted_shape} shape). open Gallery to equip.`
          : `unlocked: ${body.label}. open Gallery to equip.`;
        input.value = "";
        void refreshGrantedShapes();
      } catch {
        status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
        status.textContent = "network error. try again.";
      }
    });
    wrap.querySelector("[data-export]")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const status = wrap.querySelector("[data-account-status]") as HTMLDivElement;
      status.textContent = "preparing export…";
      const session = s.session;
      if (!session) {
        status.textContent = "not signed in";
        return;
      }
      try {
        const res = await fetch("/api/me-export", {
          headers: { authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          status.textContent = `export failed (${res.status})`;
          return;
        }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `glide-export-${(s.user?.id ?? "").slice(0, 8)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        status.textContent = "downloaded";
      } catch (err) {
        status.textContent = `export failed: ${(err as Error).message}`;
      }
    });
    let deleteArmed = false;
    const deleteBtn = wrap.querySelector("[data-delete]") as HTMLButtonElement | null;
    deleteBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const status = wrap.querySelector("[data-account-status]") as HTMLDivElement;
      const session = s.session;
      if (!session) {
        status.textContent = "not signed in";
        return;
      }
      // Step 1: arm. A stray single tap just turns the button into a clear
      // warning; it does nothing destructive and re-disarms shortly.
      if (!deleteArmed) {
        deleteArmed = true;
        deleteBtn.textContent = "tap again to delete";
        deleteBtn.classList.add("bg-red-600", "text-white");
        deleteBtn.classList.remove("bg-red-900/40", "text-red-100");
        status.textContent = "this permanently wipes everything — tap again to continue.";
        window.setTimeout(() => {
          deleteArmed = false;
          deleteBtn.textContent = "delete account";
          deleteBtn.classList.remove("bg-red-600", "text-white");
          deleteBtn.classList.add("bg-red-900/40", "text-red-100");
          if (status.textContent?.startsWith("this permanently")) status.textContent = "";
        }, 4000);
        return;
      }
      // Step 2: explicit OK dialog, THEN the typed phrase. Two deliberate
      // confirmations after arming — accidental deletion is now very hard.
      deleteArmed = false;
      deleteBtn.textContent = "delete account";
      deleteBtn.classList.remove("bg-red-600", "text-white");
      deleteBtn.classList.add("bg-red-900/40", "text-red-100");
      if (!window.confirm("Delete your account? This cannot be undone. Stats, purchases, unlocks, runs, friends, challenges and ranked matches will be removed.")) {
        status.textContent = "cancelled";
        return;
      }
      const phrase = window.prompt(
        "Final step: type DELETE to permanently delete this account.",
      );
      if (phrase !== "DELETE") {
        status.textContent = "cancelled";
        return;
      }
      status.textContent = "deleting…";
      try {
        const res = await fetch("/api/me-delete", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ confirm: phrase }),
        });
        if (!res.ok) {
          status.textContent = `delete failed (${res.status})`;
          return;
        }
        status.textContent = "account deleted";
        await signOut();
      } catch (err) {
        status.textContent = `delete failed: ${(err as Error).message}`;
      }
    });
    const form = wrap.querySelector("[data-username-form]") as HTMLFormElement | null;
    if (form) {
      const input = form.querySelector("input") as HTMLInputElement;
      const err = wrap.querySelector("[data-username-error]") as HTMLDivElement;
      input.addEventListener("input", () => {
        err.textContent = "";
        const r = validateUsername(input.value);
        if (input.value.length >= 3 && !r.ok) err.textContent = r.reason;
      });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = await claimUsername(input.value);
        if (!r.ok) err.textContent = r.reason;
      });
    }
  });

  return () => {
    unsub();
    wrap.remove();
  };
}

function offlineView(): string {
  return `
    <div class="text-center max-w-sm">
      <h2 class="text-xl font-bold">offline mode</h2>
      <p class="mt-2 text-sm opacity-70">
        No Supabase keys configured. Solo play works, but leaderboards,
        friends, and ranked are disabled.
      </p>
      <button data-close class="mt-6 rounded-xl bg-paper text-ink px-4 py-2 font-bold">close</button>
    </div>
  `;
}

function bindCloseButtons(host: HTMLElement, onClose: () => void): void {
  host.querySelectorAll<HTMLButtonElement>("[data-close]").forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClose();
    }),
  );
}

function redeemErrorMessage(code: string): string {
  switch (code) {
    case "invalid_format": return "codes are 3–32 characters.";
    case "not_found":      return "code doesn't exist.";
    case "expired":        return "this code has expired.";
    case "depleted":       return "this code has been fully claimed.";
    case "already_redeemed": return "you've already used this code.";
    case "unauthorized":   return "sign in first to redeem.";
    default:               return `couldn't redeem (${code}).`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export { authState };
