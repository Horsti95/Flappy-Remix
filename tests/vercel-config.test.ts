import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
  regions?: string[];
  functions?: Record<string, { runtime?: string }>;
  rewrites?: { source: string; destination: string }[];
};

/**
 * Guards the Vercel deploy config, because `npm run build` does NOT validate
 * it — Vercel checks vercel.json separately, before the build runs. A broken
 * config therefore passes typecheck + tests + build locally and only fails in
 * the cloud.
 *
 * That is exactly what happened: `"functions": { "api/og.ts": { "runtime":
 * "edge" } }` failed the deploy with "Function Runtimes must have a valid
 * version". Vercel's own check is:
 *
 *     let tag = `${func.runtime}`.split("@").pop();
 *     if (!tag || !semver.valid(tag)) -> invalid_function_runtime
 *
 * `"edge"` has no semver version, so it can never be valid there. The edge
 * runtime is selected per-file with `export const config = { runtime: "edge" }`,
 * not in vercel.json.
 */

/** Minimal semver check matching what Vercel applies to the runtime tag. */
function isValidSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(v);
}

describe("vercel.json", () => {
  it("declares no function runtime that Vercel would reject", () => {
    const offenders: string[] = [];
    for (const [path, fn] of Object.entries(cfg.functions ?? {})) {
      if (fn.runtime === undefined) continue;
      const tag = String(fn.runtime).split("@").pop() ?? "";
      if (!isValidSemver(tag)) offenders.push(`${path}: ${fn.runtime}`);
    }
    expect(offenders).toEqual([]);
  });

  it("never uses the literal 'edge' as a vercel.json runtime", () => {
    const runtimes = Object.values(cfg.functions ?? {}).map((f) => f.runtime);
    expect(runtimes).not.toContain("edge");
  });

  it("pins a single region for the database-bound serverless functions", () => {
    // Supabase is single-region; these functions must sit next to it.
    expect(cfg.regions).toBeDefined();
    expect(cfg.regions).toHaveLength(1);
    expect(cfg.regions?.[0]).toMatch(/^[a-z]{3}\d$/);
  });

  it("keeps the share-link rewrite that feeds the OG renderer", () => {
    const sources = (cfg.rewrites ?? []).map((r) => r.source);
    expect(sources).toContain("/run/:id");
  });
});

describe("edge runtime declarations", () => {
  it("only the two OG renderers opt into edge, and they do it in-file", () => {
    const edge: string[] = [];
    for (const f of ["og.ts", "og-meta.ts", "submit-run.ts", "daily.ts", "challenge.ts",
                     "redeem-code.ts", "feedback.ts", "link-code.ts", "me-export.ts",
                     "me-delete.ts", "ranked-queue.ts", "ranked-match.ts",
                     "ranked-challenge.ts", "challenge-create.ts"]) {
      const src = readFileSync(join(root, "api", f), "utf8");
      if (/runtime:\s*"edge"/.test(src)) edge.push(f);
    }
    expect(edge.sort()).toEqual(["og-meta.ts", "og.ts"]);
  });
});
