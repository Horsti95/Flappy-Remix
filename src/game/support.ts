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
 * Non-tracking banner slot. A single static message + optional link that you
 * place yourself — no ad network, no tracking, no SDK. Default-on so the
 * placement is visible on preview deploys; set VITE_BANNER_ENABLED=false to
 * hide it, or point it at a real sponsor with the other VITE_BANNER_* vars.
 */
export interface BannerConfig {
  enabled: boolean;
  label: string;
  href?: string;
}

export const BANNER: BannerConfig = {
  enabled: env.VITE_BANNER_ENABLED !== "false",
  label: env.VITE_BANNER_LABEL ?? "fake ad slot — 100.000€ to advertise to Lennart's friends & family only",
  href: env.VITE_BANNER_HREF,
};

/**
 * Feedback destination email. Empty by default so no personal address is
 * committed — the feedback button only shows when VITE_FEEDBACK_EMAIL is set
 * at build time. Uses a plain `mailto:` (zero backend, no tracking); we can
 * swap to a private serverless endpoint later without changing the button.
 */
export const FEEDBACK_EMAIL: string = env.VITE_FEEDBACK_EMAIL ?? "";
