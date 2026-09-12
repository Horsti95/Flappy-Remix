/**
 * Crash screen.
 *
 * Until now nothing listened for `error` or `unhandledrejection`, so any
 * uncaught throw left the player looking at a black canvas with no message,
 * no version, and nothing to report. For a closed beta that is the worst
 * possible failure mode: the tester can only tell you "it broke", which is
 * not actionable, and you find out days later that everyone hit the same bug.
 *
 * So: catch it, say so plainly, and make the report one tap. The screen shows
 * what happened, identifies the exact build, and puts a complete report on the
 * clipboard — no typing, nothing for the tester to remember.
 *
 * Design rules, learned from crash screens that make things worse:
 *  - Never block a recoverable situation. A failed image fetch is not a crash;
 *    only genuine uncaught errors and rejections open this.
 *  - Never block for someone else's bug. Browser extensions inject scripts into
 *    every page and reject promises the page never made; a crash screen for a
 *    wallet extension's onboarding state teaches testers to ignore the screen.
 *    See isForeignError().
 *  - Show it ONCE. A render loop that throws every frame would otherwise
 *    rebuild this 60 times a second and take the tab down with it.
 *  - Offer "keep playing". The sim is deterministic and most throws come from
 *    UI code, so dismissing is usually fine and beats a forced reload that
 *    loses an unsubmitted run.
 *  - Don't depend on the app. This module imports nothing that could itself be
 *    the thing that just broke.
 */
import { buildContext, buildLabel } from "../game/build-info";

/** Only ever one crash screen, however many errors follow the first. */
let shown = false;
let installed = false;

interface CrashInfo {
  kind: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  source?: string;
}

function describe(info: CrashInfo): string {
  const ctx = buildContext();
  const lines = [
    "Glide crash report",
    `build   ${buildLabel()} (${ctx.build}, built ${ctx.built})`,
    `where   ${info.source ?? "unknown"}`,
    `kind    ${info.kind}`,
    `display ${ctx.display} · ${ctx.viewport}`,
    `ua      ${ctx.ua}`,
    "",
    `error   ${info.message}`,
  ];
  if (info.stack) {
    // First few frames only: enough to locate it, short enough to paste.
    lines.push("", info.stack.split("\n").slice(0, 8).join("\n"));
  }
  return lines.join("\n");
}

function render(info: CrashInfo): void {
  const report = describe(info);

  const host = document.createElement("div");
  host.id = "crash";
  // Inline styles on purpose: if the stylesheet failed to load, that may BE
  // the crash, and a crash screen that needs the app's CSS is no crash screen.
  host.setAttribute(
    "style",
    [
      "position:fixed", "inset:0", "z-index:2147483647",
      "display:flex", "flex-direction:column", "align-items:center",
      "justify-content:center", "gap:14px",
      "padding:24px", "box-sizing:border-box",
      "background:#1a1a1a", "color:#f4ead5",
      "font:14px/1.5 system-ui,-apple-system,sans-serif",
      "text-align:center", "overflow-y:auto",
    ].join(";"),
  );

  const btn = (label: string, primary: boolean): string =>
    `<button type="button" data-no-flap style="
        appearance:none;border:0;cursor:pointer;
        padding:11px 18px;border-radius:12px;font:inherit;font-weight:700;
        ${primary ? "background:#f4ead5;color:#1a1a1a" : "background:rgba(244,234,213,.12);color:#f4ead5"}
      ">${label}</button>`;

  host.innerHTML = `
    <div style="font-size:40px;line-height:1">🪂</div>
    <div style="font-size:18px;font-weight:800">That wasn't supposed to happen</div>
    <div style="max-width:30rem;opacity:.75">
      Glide hit an error. Your progress is saved — nothing was lost.
      Sending this report is the single most useful thing you can do right now.
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
      ${btn("Copy report", true)}
      ${btn("Keep playing", false)}
      ${btn("Reload", false)}
    </div>
    <div data-status style="min-height:1.2em;font-size:12px;opacity:.7"></div>
    <details style="max-width:34rem;width:100%;text-align:left">
      <summary style="cursor:pointer;opacity:.6;font-size:12px">Technical details</summary>
      <pre style="
        margin:8px 0 0;padding:10px;border-radius:10px;
        background:rgba(0,0,0,.45);font-size:11px;line-height:1.45;
        white-space:pre-wrap;word-break:break-word;overflow-x:auto;
      "></pre>
    </details>
    <div style="font-size:11px;opacity:.45">${escapeHtml(buildLabel())}</div>
  `;

  // Insert the report as TEXT, never as HTML — an error message can contain
  // anything, including markup from a failed fetch of someone else's content.
  const pre = host.querySelector("pre");
  if (pre) pre.textContent = report;

  const [copyBtn, dismissBtn, reloadBtn] = [...host.querySelectorAll("button")];
  const status = host.querySelector<HTMLDivElement>("[data-status]");

  copyBtn?.addEventListener("click", async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(report);
      ok = true;
    } catch {
      /* clipboard blocked — the details block is the fallback */
    }
    if (status) {
      status.textContent = ok
        ? "Copied. Paste it into the bug report — thank you."
        : "Couldn't copy. Open Technical details and select the text.";
    }
  });

  dismissBtn?.addEventListener("click", () => {
    host.remove();
    // Allow a LATER, different crash to surface again. Without this, one
    // dismissal would silence every future error for the whole session.
    shown = false;
  });

  reloadBtn?.addEventListener("click", () => window.location.reload());

  document.body.appendChild(host);
}

/** Surface a crash. Safe to call repeatedly; only the first one renders. */
export function reportCrash(info: CrashInfo): void {
  // Always log, even when a screen is already up — the console keeps the full
  // sequence for anyone with devtools open.
  console.error(`[crash:${info.kind}]`, info.source ?? "", info.message, info.stack ?? "");
  if (shown) return;
  shown = true;
  try {
    render(info);
  } catch (err) {
    // A crash screen that itself throws must not take the page with it.
    console.error("[crash] failed to render crash screen", err);
  }
}

/**
 * Schemes a browser extension's injected script runs under. An error thrown in
 * one of these is not the game's.
 */
const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "safari-extension://",
  "ms-browser-extension://",
  "webkit-masked-url://",
];

/**
 * True when the error demonstrably came from outside our own code.
 *
 * WHY THIS EXISTS. A tester got the crash screen for this:
 *
 *   Talisman extension has not been configured yet. Please continue with
 *   onboarding.
 *     at chrome-extension://fijngjgcjhjmmpcmkeiomlglpeiijkld/page.js:1:4498
 *
 * A wallet extension's own onboarding state, on a page that was working
 * perfectly. Extensions inject scripts into every page and reject promises the
 * page never made, so a global `unhandledrejection` listener hears all of it.
 * Blocking the game for that is worse than useless: it teaches testers that the
 * crash screen means nothing, and then they stop reporting the real ones.
 *
 * The test is attribution, not a message blocklist: an extension frame in the
 * stack AND no frame from our own origin. If our code appears anywhere in the
 * stack we still report it — our code calling into something an extension broke
 * is genuinely our problem.
 */
export function isForeignError(info: { stack?: string; source?: string; message?: string }): boolean {
  // "Script error." with no stack is what a cross-origin script's throw looks
  // like from here. It carries no origin, no line, no stack — by construction
  // there is nothing in it to act on.
  if ((info.message ?? "").trim() === "Script error." && !info.stack) return true;

  const hay = `${info.source ?? ""}\n${info.stack ?? ""}`;
  if (!hay.trim()) return false; // nothing to attribute — assume it is ours
  if (!EXTENSION_SCHEMES.some((scheme) => hay.includes(scheme))) return false;

  const own = typeof location !== "undefined" ? location.origin : "";
  return !(own && hay.includes(own));
}

/** Install the global listeners. Idempotent. */
export function installCrashHandler(): void {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (e: ErrorEvent) => {
    // Resource load failures (a missing image, a blocked font) arrive here too
    // but have no `error` object and are not crashes — the game plays fine
    // without a background. Ignore them.
    if (!e.error && !e.message) return;
    if (e.target && e.target !== window) return;
    const info: CrashInfo = {
      kind: "error",
      message: e.error?.message ?? e.message ?? "unknown error",
      stack: e.error?.stack,
      // Keep the FULL url for attribution; shortenUrl() would strip the
      // chrome-extension:// scheme that identifies it as not ours.
      source: e.filename ? `${e.filename}:${e.lineno ?? 0}` : undefined,
    };
    if (isForeignError(info)) {
      console.warn("[crash] ignoring error from outside the app:", info.message);
      return;
    }
    reportCrash({ ...info, source: info.source ? shortenUrl(info.source) : undefined });
  });

  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const r: unknown = e.reason;
    const message =
      r instanceof Error ? r.message : typeof r === "string" ? r : safeStringify(r);
    const info: CrashInfo = {
      kind: "unhandledrejection",
      message: message || "unknown rejection",
      stack: r instanceof Error ? r.stack : undefined,
    };
    if (isForeignError(info)) {
      console.warn("[crash] ignoring rejection from outside the app:", info.message);
      return;
    }
    reportCrash(info);
  });
}

function shortenUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)?.slice(0, 300) ?? String(v);
  } catch {
    return String(v);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
