import { authState } from "../social/auth";
import { markFeedbackGiven } from "../game/achievements";
import { playUnlockSound, triggerUnlockHaptic } from "../game/sfx";
import { APP_VERSION } from "../game/changelog";

/**
 * Where the "send feedback" flow falls back to when the /api/feedback
 * endpoint isn't configured (or the player is signed out). Defaults to the
 * public repo's issue form; override with VITE_FEEDBACK_URL.
 */
const FEEDBACK_URL =
  (import.meta.env as Record<string, string | undefined>).VITE_FEEDBACK_URL ||
  "https://github.com/horsti95/flappy-remix/issues/new";

/** Markup for the in-app feedback block (textarea + send + status line). */
export function feedbackFormHtml(): string {
  return `
    <p class="text-xs opacity-70 mb-2">Found a bug or have an idea? Tell us — there's a little something in it for you.</p>
    <form data-feedback-form class="flex flex-col gap-2">
      <textarea data-feedback-input rows="3" maxlength="2000"
                class="w-full rounded-xl bg-white/10 px-3 py-2 text-sm outline-none focus:bg-white/20 resize-none"
                placeholder="what happened / what would you like?"></textarea>
      <button data-feedback class="btn-secondary w-full py-2.5 text-sm">send feedback</button>
    </form>
    <div data-feedback-status class="mt-2 text-[12px] min-h-[1em] opacity-70"></div>`;
}

/** Wire the block rendered by {@link feedbackFormHtml} inside `root`. */
export function bindFeedbackForm(root: HTMLElement): void {
  root.querySelector("[data-feedback-form]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const status = root.querySelector("[data-feedback-status]") as HTMLDivElement;
    const input = root.querySelector("[data-feedback-input]") as HTMLTextAreaElement;
    const btn = root.querySelector("[data-feedback]") as HTMLButtonElement;
    const message = input.value.trim();
    const session = authState().session;

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
}
