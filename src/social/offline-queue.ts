import type { SubmitPayload, SubmitResult } from "./runs";
import { submitRun } from "./runs";
import { authState, subscribeAuth } from "./auth";

const KEY = "pflug.queue.v1";
const MAX_QUEUE = 32;

interface Queued extends SubmitPayload {
  ts: number;
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
    let q = read();
    while (q.length > 0) {
      const next = q[0];
      let result: SubmitResult | null = null;
      try {
        result = await submitRun(next);
      } catch (err) {
        console.warn("[queue] submit threw", err);
        break;
      }
      if (!result) break;
      // Treat HTTP errors (network) as retriable. Validator rejects
      // (accepted=false but result returned) drop the run silently —
      // they would never be accepted.
      if (result.reason && result.reason.startsWith("http_")) break;
      q.shift();
      write(q);
      flushed++;
    }
    return { flushed, remaining: q.length };
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
