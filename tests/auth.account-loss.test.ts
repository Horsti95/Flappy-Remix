import { describe, it, expect } from "vitest";
import { decideRestore } from "../src/social/auth";

/**
 * Regression guard for the silent-account-loss bug.
 *
 * initAuth used to discard the error from `getSession()` and call
 * `signInAnonymously()` whenever no session came back. That mints a new
 * user_id AND overwrites the stored refresh token, so any transient restore
 * failure (dead network mid-refresh, Supabase 5xx, clock skew, or a refresh
 * token rotated out from under this device by redeemLinkCode on another one)
 * permanently orphaned the player's real account. They relaunched as
 * `guest-xxxx` with no progress.
 */
describe("decideRestore — never replace an existing account", () => {
  it("uses the restored session when there is one", () => {
    expect(decideRestore(true, true)).toBe("use-session");
    expect(decideRestore(false, true)).toBe("use-session");
  });

  it("signs in anonymously only on a device that never had an account", () => {
    expect(decideRestore(false, false)).toBe("fresh-anon");
  });

  it("THE BUG: a marked device with no session must report, never re-sign-in", () => {
    // If this ever returns "fresh-anon" again, real accounts get orphaned.
    expect(decideRestore(true, false)).toBe("report-lost");
    expect(decideRestore(true, false)).not.toBe("fresh-anon");
  });

  it("is total — every input combination is covered", () => {
    for (const marker of [true, false]) {
      for (const session of [true, false]) {
        expect(["use-session", "fresh-anon", "report-lost"]).toContain(
          decideRestore(marker, session),
        );
      }
    }
  });
});
