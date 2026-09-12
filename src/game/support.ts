/**
 * Monetisation config — ethics-aligned (see ETHICS.md).
 *
 * Hard rules this honors:
 *  - NO tracking / ad SDK. The banner is a single static slot YOU control
 *    (house message or one sponsor), not a network. Nothing here loads
 *    third-party scripts or sets cookies.
 *  - NO pay-to-win, NO pay-for-playtime. Tips are gratitude only.
 *  - NO personal data in the repo. The tip link is a platform alias and
 *    every value is env-overridable, so your real name / email / PayPal
 *    address never has to be committed.
 */

const env = import.meta.env;

/**
 * "Buy me a coffee" tip link. Replace the placeholder handle, or set
 * VITE_SUPPORT_URL at build time. Prefer a platform alias (Buy Me a Coffee /
 * Ko-fi / GitHub Sponsors) over a personal PayPal.me link to avoid doxxing.
 */
export const SUPPORT_URL: string =
  env.VITE_SUPPORT_URL ?? "https://buymeacoffee.com/hossi95";

/** Whether to show the subtle tip link in the menu. */
export const SUPPORT_ENABLED = true;

/**
 * The banner slot.
 *
 * Today this renders ONE static message you control — no ad network, no SDK,
 * no third-party script, no cookie. That is what makes it compatible with
 * ETHICS.md as written.
 *
 * INTENT: this slot is staying in place so that a real ad banner (Google
 * AdSense / Ad Manager) can drop into it at launch. The structure is already
 * right for that — a fixed-height reserved box in the app shell, so filling it
 * with an ad iframe will not shift the layout or resize the play area.
 *
 * ── Before you switch it to real Google ads, three things actually block it ──
 *
 * 1. ETHICS.md and PRIVACY.md currently promise the opposite. ETHICS.md says
 *    "NO tracking / ad SDK … Nothing here loads third-party scripts or sets
 *    cookies", and PRIVACY.md tells players their data goes nowhere. AdSense
 *    is a third-party script that sets cookies and profiles users. Both
 *    documents have to be rewritten to match reality BEFORE the script ships,
 *    or the app is making a promise it breaks. This is a documentation change,
 *    not an optional one.
 *
 * 2. EEA/UK traffic needs a Google-certified CMP. Google requires a certified
 *    Consent Management Platform for personalised ads to EEA/UK users, and the
 *    consent signal has to reach the ad script (TCF). A German launch is
 *    exactly this case. Without it, either the ads don't serve or the
 *    deployment isn't GDPR-clean. Budget for a CMP, and gate the ad script
 *    behind its consent callback — non-consenting players should get the house
 *    message below rather than a blank box.
 *
 * 3. The CSP has to allow it. Loading pagead2.googlesyndication.com means
 *    widening script-src/frame-src. Add it deliberately and only for the ad
 *    host.
 *
 * The wiring itself is then small: keep `enabled`, swap the innerHTML in
 * main.ts for the AdSense <ins> element plus its loader, and feed the client
 * id from an env var the way the values below already are.
 *
 * Until then the default label is a deliberate in-joke placeholder, kept by
 * the owner's choice: it reads as an obviously-fake ad slot, which is the
 * point — it shows where the real banner will go without pretending to be
 * real advertising. Override it per-deploy with VITE_BANNER_LABEL.
 */
export interface BannerConfig {
  enabled: boolean;
  label: string;
  href?: string;
}

/**
 * Only http(s) may reach the banner's href.
 *
 * main.ts renders the link with escapeHtmlAttr(), which prevents breaking out
 * of the attribute — but an href is a URL context, not a text one, and
 * `javascript:alert(1)` passes through HTML-escaping completely unharmed and
 * runs on click. Harmless while this was a hand-set env var; not something to
 * leave in place now that the slot is meant to carry third-party ad URLs.
 *
 * Returns undefined for anything that isn't an absolute http(s) URL, which
 * makes the banner render as plain text instead of a link.
 */
function safeHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    // Not an absolute URL (relative paths included) — don't guess.
    return undefined;
  }
}

export const BANNER: BannerConfig = {
  // Default-on so the placement stays visible on preview deploys (that is the
  // point of keeping the slot). Set VITE_BANNER_ENABLED=false to hide it.
  enabled: env.VITE_BANNER_ENABLED !== "false",
  // Placeholder in-joke by design (see the note above) — the dashed "fake
  // ad slot" styling in style.css is what sells it as not-real-advertising.
  label:
    env.VITE_BANNER_LABEL ??
    "100,000 EUR to advertise to his friends and family only",
  href: safeHref(env.VITE_BANNER_HREF),
};
