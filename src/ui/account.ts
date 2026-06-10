import { authState, claimUsername, signInWithGoogle, signInWithDiscord, signInWithEmail, signOut, subscribeAuth } from "../social/auth";
import { validateUsername } from "../social/profanity";
import { refreshGrantedShapes } from "../social/grants";
import { markFeedbackGiven } from "../game/achievements";
import { APP_VERSION } from "../game/changelog";
import { playUnlockSound, triggerUnlockHaptic } from "../game/sfx";

/**
 * Where the "send feedback" button points. Defaults to the public repo's
 * issue form; override with VITE_FEEDBACK_URL to send people to a mailto,
 * Google Form, Canny board, etc. without touching code.
 */
const FEEDBACK_URL =
  (import.meta.env as Record<string, string | undefined>).VITE_FEEDBACK_URL ||
  "https://github.com/horsti95/flappy-remix/issues/new";

export function renderAccountPanel(host: HTMLElement, onClose: () => void, onViewProfile?: (username: string) => void): () => void {
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
    const providers = (s.user?.app_metadata?.providers as string[] | undefined) ?? [];
    const linked = s.user?.is_anonymous === false;
    const providerLabel = providers.includes("google")
      ? "Google"
      : providers.includes("discord")
        ? "Discord"
        : providers.includes("email")
          ? "email"
          : "your account";
    wrap.innerHTML = `
      <div class="w-full max-w-sm max-h-[88vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold">account</h2>
          <button data-close class="btn-quiet text-sm px-2 py-1">close</button>
        </div>

        <div class="panel-group-label">Profile</div>
        <div class="rounded-2xl bg-white/5 p-4">
          ${
            hasUsername
              ? `<button data-view-profile class="text-2xl font-bold underline decoration-dotted underline-offset-4 text-left">${escapeHtml(s.profile!.username!)}</button>
                 <div class="mt-1 text-[11px] opacity-50">tap your name to view your profile · handles are permanent in v1.</div>`
              : `<form data-username-form class="flex gap-2 items-stretch">
                   <input data-username name="username" autocomplete="off" autocapitalize="none" spellcheck="false"
                          maxlength="8" minlength="3"
                          class="flex-1 min-w-0 rounded-xl bg-white/10 px-3 py-2 text-base outline-none focus:bg-white/20"
                          placeholder="3-8 chars, a-z, 0-9" />
                   <button class="btn-primary shrink-0 px-4 py-2">claim</button>
                 </form>
                 <div data-username-error class="mt-2 text-[12px] text-accent-danger min-h-[1em]"></div>`
          }
          <div class="mt-3 pt-3 border-t border-white/5">
            ${
              linked
                ? `<div class="text-[12px] opacity-70">✓ signed in with ${providerLabel}</div>`
                : `<p class="text-xs opacity-70 mb-2">anonymous — sign in to keep your runs across devices.</p>
                   <div class="space-y-2">
                     <button data-mail class="btn-primary w-full py-2.5 text-sm">✉️ Continue with email</button>
                     <form data-email-form class="hidden gap-2 items-stretch">
                       <input data-email name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false"
                              class="flex-1 min-w-0 rounded-xl bg-white/10 px-3 py-2 text-base outline-none focus:bg-white/20"
                              placeholder="you@email.com" />
                       <button class="btn-secondary shrink-0 px-4 py-2 text-sm">send link</button>
                     </form>
                     <button data-google class="btn-primary w-full py-2.5 text-sm">Continue with Google</button>
                     <button data-discord class="btn-primary w-full py-2.5 text-sm">Continue with Discord</button>
                   </div>
                   <div data-auth-status class="mt-2 text-[12px] min-h-[1em] opacity-70"></div>`
            }
          </div>
        </div>

        <div class="panel-group-label">Progress</div>
        <div class="rounded-2xl bg-white/5 p-4">
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div><div class="opacity-60">games</div><div class="font-bold text-base">${s.profile?.total_games ?? 0}</div></div>
            <div><div class="opacity-60">streak</div><div class="font-bold text-base">${s.profile?.streak_days ?? 0}</div></div>
            <div><div class="opacity-60">id</div><div class="font-mono text-[10px] truncate opacity-70">${s.user?.id?.slice(0, 8) ?? "—"}</div></div>
          </div>
        </div>

        <div class="panel-group-label">Codes</div>
        <div class="rounded-2xl bg-white/5 p-4">
          <form data-redeem-form class="flex gap-2 items-stretch">
            <input data-redeem-input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
                   maxlength="32"
                   class="flex-1 min-w-0 rounded-xl bg-white/10 px-3 py-2 text-base outline-none focus:bg-white/20 uppercase tracking-wider"
                   placeholder="enter code" />
            <button class="btn-primary shrink-0 px-4 py-2 text-sm">use</button>
          </form>
          <div data-redeem-status class="mt-2 text-[12px] min-h-[1em] opacity-70"></div>
        </div>

        <div class="panel-group-label">Feedback</div>
        <div class="rounded-2xl bg-white/5 p-4">
          <p class="text-xs opacity-70 mb-2">Found a bug or have an idea? Tell us — there's a little something in it for you.</p>
          <form data-feedback-form class="flex flex-col gap-2">
            <textarea data-feedback-input rows="3" maxlength="2000"
                      class="w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none focus:bg-white/20 resize-none"
                      placeholder="what happened / what would you like?"></textarea>
            <button data-feedback class="btn-secondary w-full py-2.5 text-sm">send feedback</button>
          </form>
          <div data-feedback-status class="mt-2 text-[12px] min-h-[1em] opacity-70"></div>
        </div>

        <div class="panel-group-label">Data</div>
        <div class="rounded-2xl bg-white/5 p-4">
          <button data-export class="btn-secondary w-full py-2.5 text-sm">export my data</button>
          ${
            linked
              ? `<button data-signout class="btn-quiet w-full text-xs py-2 mt-1">log out</button>`
              : ""
          }
        </div>

        <div class="mt-8">
          <button data-delete class="btn-danger w-full py-2.5 text-sm">delete account</button>
          <div class="mt-1.5 text-[10px] opacity-40 text-center">permanent — export your data first if unsure</div>
        </div>
        <div data-account-status class="mt-2 text-[11px] opacity-60 min-h-[1em] text-center"></div>
      </div>
    `;
    bindCloseButtons(wrap, onClose);
    wrap.querySelector("[data-google]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      signInWithGoogle();
    });
    wrap.querySelector("[data-discord]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      signInWithDiscord();
    });
    // "Continue with email" reveals the address input rather than going
    // straight to a form, so the default sign-in row stays a clean 3 buttons.
    wrap.querySelector("[data-mail]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const form = wrap.querySelector("[data-email-form]") as HTMLElement | null;
      if (!form) return;
      form.className = "flex gap-2 items-stretch";
      (form.querySelector("[data-email]") as HTMLInputElement | null)?.focus();
    });
    wrap.querySelector("[data-email-form]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = wrap.querySelector("[data-email]") as HTMLInputElement;
      const status = wrap.querySelector("[data-auth-status]") as HTMLDivElement;
      status.className = "mt-2 text-[12px] min-h-[1em] opacity-70";
      status.textContent = "sending…";
      const res = await signInWithEmail(input.value);
      if (res.ok) {
        status.className = "mt-2 text-[12px] min-h-[1em] text-emerald-300";
        status.textContent = "check your email for a sign-in link.";
      } else {
        status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
        status.textContent = res.reason;
      }
    });
    wrap.querySelector("[data-view-profile]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = s.profile?.username;
      if (name && onViewProfile) onViewProfile(name);
    });
    // Log out is only offered to Google users (they can sign back in). Anon
    // users have no "log out" — abandoning an anon account == deleting it, so
    // we don't duplicate that footgun; they use the explicit delete button.
    wrap.querySelector("[data-signout]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      signOut();
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
    wrap.querySelector("[data-feedback-form]")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const status = wrap.querySelector("[data-feedback-status]") as HTMLDivElement;
      const input = wrap.querySelector("[data-feedback-input]") as HTMLTextAreaElement;
      const btn = wrap.querySelector("[data-feedback]") as HTMLButtonElement;
      const message = input.value.trim();
      const session = s.session;

      const celebrate = () => {
        const { newlyUnlocked } = markFeedbackGiven();
        if (newlyUnlocked) {
          playUnlockSound("epic");
          triggerUnlockHaptic("epic");
          status.className = "mt-2 text-[12px] min-h-[1em] text-emerald-300";
          status.textContent = `thanks! unlocked “${newlyUnlocked.name}” — open Gallery to equip the skin.`;
        } else {
          status.className = "mt-2 text-[12px] min-h-[1em] opacity-70";
          status.textContent = "thanks for the feedback!";
        }
      };

      // No session or empty box: fall back to the external feedback page
      // (the submit click is still a user gesture). Honour-system latch.
      if (!session || message.length < 10) {
        if (message.length > 0 && message.length < 10) {
          status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
          status.textContent = "a few more words? (10 characters minimum)";
          return;
        }
        window.open(FEEDBACK_URL, "_blank", "noopener,noreferrer");
        celebrate();
        return;
      }

      btn.disabled = true;
      status.className = "mt-2 text-[12px] min-h-[1em] opacity-70";
      status.textContent = "sending…";
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ message, version: APP_VERSION }),
        });
        if (res.ok) {
          input.value = "";
          celebrate();
        } else if (res.status === 503) {
          // API not wired up (yet) — external page keeps the flow alive.
          window.open(FEEDBACK_URL, "_blank", "noopener,noreferrer");
          celebrate();
        } else if (res.status === 429) {
          status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
          status.textContent = "easy there — try again in a few minutes.";
        } else {
          status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
          status.textContent = "couldn't send. try again?";
        }
      } catch {
        status.className = "mt-2 text-[12px] min-h-[1em] text-red-300";
        status.textContent = "network error. try again.";
      } finally {
        btn.disabled = false;
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
      if (!window.confirm("Delete your account? This cannot be undone — profile, runs, skins, friends, challenges and ranked matches are all wiped.")) {
        status.textContent = "cancelled";
        return;
      }
      const phrase = window.prompt(
        "Final step — type 'delete me forever' to confirm.",
      );
      if (phrase !== "delete me forever") {
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
