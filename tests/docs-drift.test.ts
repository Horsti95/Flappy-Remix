import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

/**
 * Documentation drift has bitten this project twice: docs/deploy.md told
 * readers `supabase db push` "applies 0001 .. 0004" when there were 30+, and
 * the pre-deploy checklist listed a stale test count and a heading that
 * stopped at 0034 while the table ran to 0040.
 *
 * That is not a cosmetic problem here. Several later migrations are the
 * security fixes the app depends on — a reader who trusts an out-of-date
 * deploy guide can ship the code without them and leave known holes open. So
 * the deploy guide's coverage is a test, not a promise.
 */
describe("pre-deploy checklist", () => {
  const checklist = read("docs/pre-deploy-checklist.md");

  it("lists every migration from 0031 onward", () => {
    // 0001-0030 predate the checklist and are covered by "apply them in order".
    const expected = migrations.filter((f) => Number(f.slice(0, 4)) >= 31);
    const missing = expected.filter((f) => !checklist.includes(f));
    expect(missing).toEqual([]);
  });

  it("does not reference a migration file that no longer exists", () => {
    const referenced = [...checklist.matchAll(/`(\d{4}_[a-z0-9_]+\.sql)`/g)].map((m) => m[1]);
    const unknown = referenced.filter((f) => !migrations.includes(f));
    expect(unknown).toEqual([]);
  });

  it("pins no exact test count that will rot", () => {
    // A number here goes stale on the next test added. Phrase it as a floor.
    expect(checklist).not.toMatch(/#\s*\d{3} tests\b/);
  });
});

describe("README accuracy", () => {
  const readme = read("README.md");

  it("does not claim the database-bound API runs on the edge", () => {
    // Only og.ts / og-meta.ts are edge; everything else moved to regional
    // Node so its Supabase queries stay in-region.
    const edgeClaims = readme
      .split("\n")
      .filter((l) => /edge function/i.test(l))
      .filter((l) => !/og\b|og-meta|@vercel\/og|crawler/i.test(l));
    expect(edgeClaims).toEqual([]);
  });

  it("does not hard-code a migration count", () => {
    expect(readme).not.toMatch(/\b\d{2}\s+and counting\b/);
    expect(readme).not.toMatch(/\b\d{2}\s+migrations\b/);
  });
});

describe("runtime declarations match the docs", () => {
  it("exactly the two OG renderers are on the edge runtime", () => {
    const edge = readdirSync(join(root, "api"))
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /runtime:\s*"edge"/.test(read(join("api", f))))
      .sort();
    expect(edge).toEqual(["og-meta.ts", "og.ts"]);
  });
});
