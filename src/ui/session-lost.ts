/**
 * "We couldn't reach your account" notice.
 *
 * Counterpart to the account-loss fix in social/auth.ts. When a device that
 * provably had an account fails to restore its session, auth no longer papers
 * over it by minting a fresh anonymous account (which silently orphaned the
 * real one). Instead it raises `sessionLost`, and this is the only thing the
 * player sees until it resolves — because the alternative is them playing a
 * whole session onto a throwaway account and losing it.
 *
 * Two ways out, both explicit:
 *   • Retry — re-attempt the restore (also automatic on `online` / tab focus).
 *   • Start as a new player — abandons the old account for good. Behind a
 *     confirm step, because it is irreversible.
 */
import { authState, lastKnownUsername, retryRestore, startFreshAccount } from "../social/auth";

let host: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (host) return host;
  host = document.createElement("div");
  host.id = "session-lost";
  host.className =
    "fixed inset-0 z-[90] flex items-center justify-center px-6 bg-black/80 backdrop-blur-sm";
  document.body.appendChild(host);
  return host;
}

function render(): void {
  const el = ensureHost();
  const handle = lastKnownUsername();
  const who = handle ? `@${handle}` : "your account";
  el.innerHTML = `
    <div class="w-full max-w-sm rounded-2xl bg-ink text-paper border border-paper/15 p-5 space-y-4">
      <div class="space-y-1">
        <h2 class="text-lg font-bold">Couldn't reach ${escapeHtml(who)}</h2>
        <p class="text-[13px] text-paper/70 leading-relaxed">
          Your progress is safe on the server — this device just couldn't sign
          back in. Check your connection and retry.
        </p>
      </div>
      <button id="sl-retry" type="button" data-no-flap
        class="w-full rounded-xl bg-paper text-ink font-semibold py-2.5 text-sm">
        Retry
      </button>
      <div id="sl-status" class="text-[12px] text-paper/60 text-center min-h-[1rem]"></div>
      <details class="text-[12px] text-paper/50">
        <summary class="cursor-pointer select-none">Can't get back in?</summary>
        <p class="pt-2 leading-relaxed">
          Starting as a new player abandons ${escapeHtml(who)} permanently —
          scores, skins and streak stay behind. Only do this if you know the
          account is gone.
        </p>
        <button id="sl-fresh" type="button" data-no-flap
          class="mt-2 w-full rounded-xl border border-accent-danger/60 text-accent-danger py-2 text-[12px] font-semibold">
          Start as a new player
        </button>
      </details>
    </div>
  `;

  const status = el.querySelector<HTMLDivElement>("#sl-status")!;
  const retry = el.querySelector<HTMLButtonElement>("#sl-retry")!;
  retry.onclick = async () => {
    retry.disabled = true;
    status.textContent = "Signing in…";
    const ok = await retryRestore();
    if (!ok) {
      status.textContent = "Still no luck — check your connection.";
      retry.disabled = false;
    }
    // On success, subscribeAuth re-runs and hide() tears this down.
  };

  const fresh = el.querySelector<HTMLButtonElement>("#sl-fresh")!;
  let armed = false;
  fresh.onclick = async () => {
    if (!armed) {
      armed = true;
      fresh.textContent = "Tap again to confirm — this can't be undone";
      return;
    }
    fresh.disabled = true;
    await startFreshAccount();
  };
}

function hide(): void {
  host?.remove();
  host = null;
}

/** Call once from the auth subscription. Shows/hides itself from state. */
export function syncSessionLostNotice(): void {
  const s = authState();
  if (s.sessionLost) {
    if (!host) render();
  } else {
    hide();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
