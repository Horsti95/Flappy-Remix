/**
 * "Your account isn't backed up" nudge.
 *
 * Anonymous accounts exist only in this browser's localStorage. There is no
 * password, no email, no server-side way to prove ownership — so if that
 * storage goes (site data cleared, browser storage eviction, new device,
 * reinstall), the account is unreachable forever. Nothing about that is
 * obvious to the player, and until now the app never mentioned it: the
 * securing paths existed in social/auth.ts but weren't wired to any UI.
 *
 * This is the one place we tell them, and it is deliberately restrained:
 *   • only for anonymous accounts with real progress worth losing
 *   • only in the menu, never during or right after a run
 *   • dismissible, and it stays dismissed until the stakes roughly double
 *
 * The dismissal record lives in localStorage too. That's fine — losing it only
 * re-shows the nudge, which is the safe direction to fail.
 */
import { authState } from "../social/auth";

const DISMISS_KEY = "pflug.secureNudge.v1";
/** Below this many games there isn't enough at stake to interrupt anyone. */
const MIN_GAMES = 25;

function dismissedAt(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function recordDismiss(games: number): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(games));
  } catch {
    /* ignore — worst case the nudge reappears */
  }
}

/**
 * Show again once they have roughly twice the progress they dismissed at.
 * Pure, so the escalation rule is unit-testable without a DOM or storage.
 *
 * @param games            games played on this account
 * @param lastDismissedAt  the game count at the last dismissal (0 = never)
 */
export function shouldShowNudge(games: number, lastDismissedAt: number): boolean {
  if (games < MIN_GAMES) return false;
  if (lastDismissedAt <= 0) return true;
  return games >= lastDismissedAt * 2;
}

function shouldShow(games: number): boolean {
  return shouldShowNudge(games, dismissedAt());
}

let host: HTMLDivElement | null = null;

function teardown(): void {
  host?.remove();
  host = null;
}

/**
 * Mount or unmount the nudge inside the menu. Call on every menu render.
 * `onOpenAccount` should open the account panel, where the securing controls
 * live.
 */
export function syncSecureAccountNudge(
  parent: HTMLElement,
  onOpenAccount: () => void,
): void {
  teardown();
  const s = authState();
  if (s.offline || !s.ready || !s.user || s.sessionLost) return;
  // `is_anonymous === false` means a real provider is attached; anything else
  // (true, or undefined on an older session) is treated as unsecured.
  if (s.user.is_anonymous === false) return;
  const games = s.profile?.total_games ?? 0;
  if (!shouldShow(games)) return;

  host = document.createElement("div");
  host.dataset.noFlap = "true";
  host.className =
    "pointer-events-auto absolute bottom-3 inset-x-3 z-20 rounded-xl border border-accent-daily/40 bg-black/70 backdrop-blur-sm px-3 py-2.5 text-left";
  host.innerHTML = `
    <div class="flex items-start gap-2">
      <div class="flex-1 min-w-0">
        <div class="text-[12px] font-semibold text-accent-daily">Back up your account</div>
        <div class="text-[11px] opacity-75 leading-snug mt-0.5">
          ${games} games are saved only in this browser. Clear your data or
          switch phone and they're gone — add an email to keep them.
        </div>
      </div>
      <button data-nudge-dismiss type="button" aria-label="Dismiss"
              class="shrink-0 opacity-50 text-lg leading-none px-1">×</button>
    </div>
    <button data-nudge-open type="button"
            class="btn-primary w-full mt-2 py-1.5 text-[12px]">back it up</button>
  `;

  host.querySelector("[data-nudge-dismiss]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    recordDismiss(games);
    teardown();
  });
  host.querySelector("[data-nudge-open]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    // Opening the panel counts as acting on it — don't nag again at this level.
    recordDismiss(games);
    teardown();
    onOpenAccount();
  });

  parent.appendChild(host);
}
