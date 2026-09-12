/**
 * Why the last run submission failed.
 *
 * The menu could already say "5 queued", which tells a player something is
 * wrong and tells us nothing. A queued run means the server answered with an
 * error or was unreachable, and those are completely different problems — but
 * the only place the difference was recorded was `console.warn`, which nobody
 * has open on a phone.
 *
 * So keep the last failure. It costs one localStorage key, it turns a bug
 * report from "it says 5 queued" into "it says 5 queued · 500", and the detail
 * is the server's own error message.
 *
 * Its own module on purpose: `runs.ts` records the failure and `offline-queue.ts`
 * imports `runs.ts`, so putting this in either one would make the two import
 * each other.
 */

const KEY = "pflug.submitFail.v1";
const MAX_DETAIL = 300;

export interface SubmitFailure {
  /** `http_500`, `network`, … — the same reason string SubmitResult carries. */
  reason: string;
  /** The server's response body, or the thrown error. Trimmed. */
  detail?: string;
  /** When it happened (epoch ms). */
  ts: number;
}

export function recordSubmitFailure(reason: string, detail?: string): void {
  try {
    const entry: SubmitFailure = { reason, ts: Date.now() };
    if (detail) entry.detail = detail.slice(0, MAX_DETAIL);
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    /* storage full or blocked — a diagnostic must never break a submit */
  }
}

export function clearSubmitFailure(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function lastSubmitFailure(): SubmitFailure | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SubmitFailure>;
    if (typeof p?.reason !== "string" || typeof p?.ts !== "number") return null;
    return { reason: p.reason, detail: typeof p.detail === "string" ? p.detail : undefined, ts: p.ts };
  } catch {
    return null;
  }
}

/**
 * Short label for the menu pill. `http_500` reads as `500`; anything else keeps
 * its own name, because "network" and "timeout" are already the clearest words
 * for what they are.
 */
export function failureLabel(f: SubmitFailure): string {
  const m = /^http_(\d{3})$/.exec(f.reason);
  return m ? m[1] : f.reason;
}
