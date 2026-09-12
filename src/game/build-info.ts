/**
 * Who am I, exactly?
 *
 * A beta tester's report is only actionable if it names the build it came
 * from. APP_VERSION can't do that on its own — every deploy of v0.23.0 looks
 * identical — so the commit and build time are stamped in by vite's `define`
 * and surfaced here.
 *
 * Guarded with typeof checks because the tests run the source directly through
 * vitest, where `define` never ran and the globals don't exist.
 */
import { APP_VERSION } from "./changelog";

export const BUILD_ID: string =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "dev";

/** e.g. "0.23.0+a1b2c3d" — one token to quote in a bug report. */
export function buildLabel(): string {
  return BUILD_ID === "dev" || BUILD_ID === "unknown"
    ? APP_VERSION
    : `${APP_VERSION}+${BUILD_ID}`;
}

/** Everything worth attaching to a crash or feedback report. */
export function buildContext(): Record<string, string> {
  return {
    version: APP_VERSION,
    build: BUILD_ID,
    built: BUILD_TIME,
    // Trimmed: a full UA string is long and the useful part is the engine.
    ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : "n/a",
    // Standalone means "installed to the home screen", which changes layout
    // behaviour — worth knowing on a layout bug report.
    display:
      typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
        ? "standalone"
        : "browser",
    viewport:
      typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "n/a",
  };
}
