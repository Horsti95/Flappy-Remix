import type { SubmitPayload, SubmitResult } from "./runs";
import { submitRun } from "./runs";
import { authState, subscribeAuth } from "./auth";

const KEY = "pflug.queue.v1";
const MAX_QUEUE = 32;
// A run that keeps getting HTTP-rejected (a permanent 400/403 — malformed,
// forbidden) is poison: retrying it forever would block every run behind it.
// Pure network failures (fetch throws / no result) are NOT counted here, so a
// genuinely-offline device never burns attempts on a good run.
const MAX_ATTEMPTS = 6;

interface Queued extends SubmitPayload {
  ts: number;
  /** HTTP-reject attempts so far (see MAX_ATTEMPTS). Absent = 0. */
  attempts?: number;
}

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Queued[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(q: Queued[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
  } catch {
    /* localStorage may be full or blocked */
  }
}

export function enqueueSubmission(payload: SubmitPayload): void {
  const q = read();
  q.push({ ...payload, ts: Date.now() });
  write(q);
}

export function pendingCount(): number {
  return read().length;
}

let flushing = false;

export async function flushQueued(): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return { flushed: 0, remaining: pendingCount() };
  if (!navigator.onLine) return { flushed: 0, remaining: pendingCount() };
  if (authState().offline || !authState().session) {
    return { flushed: 0, remaining: pendingCount() };
  }
  flushing = true;
  let flushed = 0;
  try {
    // Bound the loop so a pathological queue can't spin; MAX_QUEUE+ is plenty
    // since every iteration either removes the head or stops.
    for (let guard = 0; guard < MAX_QUEUE + 8; guard++) {
      const head = read()[0];
      if (!head) break;

      let result: SubmitResult | null = null;
      let threw = false;
      try {
        result = await submitRun(head);
      } catch (err) {
        console.warn("[queue] submit threw", err);
        threw = true;
      }

      // Re-read AFTER the await: a run may have been enqueued while we waited
      // (e.g. the player died mid-flush). Operate on the current queue and
      // locate our item by identity so a concurrent enqueue is never clobbered.
      const cur = read();
      const idx = cur.findIndex((x) => x.ts === head.ts && x.seed === head.seed && x.score === head.score);

      const networkFail = threw || !result;
      const httpReject = !!result?.reason && result.reason.startsWith("http_");

      if (networkFail) {
        // Server unreachable — stop; retry on the next online/visibility tick.
        // Don't count an attempt: a good run must survive a long offline spell.
        break;
      }

      if (httpReject) {
        // Server answered with an error. Could be transient (429/500) or
        // permanent (400/403). Count it; drop as poison past the cap so it
        // stops blocking everything behind it, then keep draining.
        if (idx >= 0) {
          const attempts = (cur[idx].attempts ?? 0) + 1;
          if (attempts >= MAX_ATTEMPTS) {
            console.warn("[queue] dropping run after", attempts, "HTTP rejects:", result?.reason);
            cur.splice(idx, 1);
            write(cur);
            continue;
          }
          cur[idx] = { ...cur[idx], attempts };
          write(cur);
        }
        break;
      }

      // Accepted, or a permanent validator reject (result returned, no http_
      // reason) that would never succeed: remove it and continue draining.
      if (idx >= 0) {
        cur.splice(idx, 1);
        write(cur);
      }
      if (result?.accepted) flushed++;
    }
    return { flushed, remaining: pendingCount() };
  } finally {
    flushing = false;
  }
}

let installed = false;
export function installFlushHooks(): void {
  if (installed) return;
  installed = true;
  window.addEventListener("online", () => void flushQueued());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushQueued();
  });
  subscribeAuth((s) => {
    if (s.ready && s.session && !s.offline) void flushQueued();
  });
}

export async function submitOrEnqueue(payload: SubmitPayload): Promise<SubmitResult | null> {
  const s = authState();
  // Anonymous offline / no env vars: only persist if eventually we'll
  // have an account. Until then, drop silently — there's no upstream
  // to flush to.
  if (s.offline) return null;
  if (!navigator.onLine || !s.session) {
    enqueueSubmission(payload);
    return { accepted: false, reason: "queued_offline" };
  }
  const result = await submitRun(payload);
  if (!result || (result.reason && result.reason.startsWith("http_"))) {
    enqueueSubmission(payload);
    return { accepted: false, reason: "queued_offline" };
  }
  return result;
}
