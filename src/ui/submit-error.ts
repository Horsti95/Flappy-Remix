/**
 * "Why won't my runs save?" — shown by tapping the queued pill in the menu.
 *
 * The pill can say "4 queued · 500", which narrows the problem but does not
 * name it. The server's actual message was only in the `title` attribute, i.e.
 * hover-only: unreachable on the phone where the beta is actually played. That
 * cost a full deploy cycle to learn nothing.
 *
 * So put it on screen, in a selectable box, with a copy button. Self-contained
 * and inline-styled for the same reason as the crash screen: it has to work when
 * something else is broken.
 */
import { buildLabel } from "../game/build-info";
import type { SubmitFailure } from "../social/submit-diagnostics";

export function renderSubmitError(failure: SubmitFailure, pending: number): void {
  if (document.getElementById("submit-error")) return;

  const report = [
    `Glide save failure`,
    `build    ${buildLabel()}`,
    `queued   ${pending} run${pending === 1 ? "" : "s"}`,
    `reason   ${failure.reason}`,
    `when     ${new Date(failure.ts).toISOString()}`,
    ``,
    failure.detail ?? "(no message from the server)",
  ].join("\n");

  const host = document.createElement("div");
  host.id = "submit-error";
  host.setAttribute(
    "style",
    [
      "position:fixed", "inset:0", "z-index:2147483646",
      "display:flex", "flex-direction:column", "align-items:center",
      "justify-content:center", "gap:12px", "padding:20px",
      "box-sizing:border-box", "background:rgba(20,20,20,.94)",
      "color:#f4ead5", "font:14px/1.5 system-ui,-apple-system,sans-serif",
      "text-align:center", "overflow-y:auto",
    ].join(";"),
  );

  const esc = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

  host.innerHTML = `
    <div style="font-size:34px" aria-hidden="true">📮</div>
    <h2 style="margin:0;font-size:19px;font-weight:800">${pending} run${pending === 1 ? "" : "s"} waiting to save</h2>
    <p style="margin:0;max-width:34rem;opacity:.85">
      Nothing is lost — they're stored on this device and will send themselves as
      soon as saving works again. This is what the server said:
    </p>
    <textarea readonly data-no-flap style="
      width:100%;max-width:34rem;min-height:9.5rem;resize:vertical;
      background:#0f0f0f;color:#d9cfb8;border:1px solid #3a3a3a;border-radius:10px;
      padding:10px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;
      white-space:pre;text-align:left;box-sizing:border-box;">${esc(report)}</textarea>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
      <button type="button" data-copy data-no-flap style="
        appearance:none;border:0;cursor:pointer;padding:11px 18px;border-radius:12px;
        font:inherit;font-weight:700;background:#f4ead5;color:#1a1a1a">Copy</button>
      <button type="button" data-close data-no-flap style="
        appearance:none;cursor:pointer;padding:11px 18px;border-radius:12px;
        font:inherit;font-weight:700;background:transparent;color:#f4ead5;
        border:1px solid #5a5a5a">Close</button>
    </div>`;

  const close = (): void => host.remove();
  host.querySelector("[data-close]")?.addEventListener("click", close);
  host.addEventListener("click", (e) => {
    if (e.target === host) close();
  });

  const copyBtn = host.querySelector("[data-copy]") as HTMLButtonElement | null;
  copyBtn?.addEventListener("click", () => {
    const done = (ok: boolean): void => {
      copyBtn.textContent = ok ? "Copied" : "Press and hold to copy";
    };
    // clipboard.writeText needs a secure context and can be denied; the
    // textarea is selectable either way, which is why it is a textarea.
    navigator.clipboard?.writeText(report).then(() => done(true), () => done(false)) ?? done(false);
  });

  document.body.appendChild(host);
}
