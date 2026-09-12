#!/usr/bin/env node
/**
 * Deploy preflight — the pre-deploy checklist, executable.
 *
 * docs/pre-deploy-checklist.md lists things only the project owner can do:
 * apply migrations, rotate promo codes, pin the right region, enable an auth
 * provider. A written checklist is easy to half-follow, and the two items
 * most likely to be missed are the two that fail SILENTLY in production —
 * an unapplied 0031 leaves the ranked season resettable by anyone with the
 * anon key, and an unapplied 0037 makes submit-run stop persisting progress
 * while still returning correct-looking numbers to the client.
 *
 * So check them for real. Local config is always checked; the live-project
 * checks run when credentials are present:
 *
 *   node scripts/preflight.mjs                  # local config only
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/preflight.mjs
 *
 * Exits non-zero if anything BLOCKING is wrong. Warnings do not fail it —
 * a beta is allowed to ship with known gaps, as long as they are known.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

let blocking = 0;
let warnings = 0;
const ok = (m, extra) => console.log(`  \x1b[32mok\x1b[0m    ${m}${extra ? ` — ${extra}` : ""}`);
const bad = (m, fix) => { console.log(`  \x1b[31mBLOCK\x1b[0m ${m}`); if (fix) console.log(`        → ${fix}`); blocking++; };
const warn = (m, fix) => { console.log(`  \x1b[33mwarn\x1b[0m  ${m}`); if (fix) console.log(`        → ${fix}`); warnings++; };
const section = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

// ---------------------------------------------------------------------------
section("Build config");
// ---------------------------------------------------------------------------
const vercel = JSON.parse(read("vercel.json"));

// This exact mistake broke a deploy: `runtime: "edge"` is not a valid
// vercel.json value and Vercel rejects the config before the build runs, so
// every local check passes and only the deploy fails.
const badRuntimes = Object.entries(vercel.functions ?? {})
  .filter(([, f]) => f.runtime !== undefined)
  .filter(([, f]) => !/^\d+\.\d+\.\d+/.test(String(f.runtime).split("@").pop() ?? ""));
if (badRuntimes.length > 0) {
  bad(`vercel.json declares an invalid function runtime: ${badRuntimes.map(([p, f]) => `${p}=${f.runtime}`).join(", ")}`,
      'Remove it. The edge runtime is selected in-file with `export const config = { runtime: "edge" }`.');
} else {
  ok("vercel.json function runtimes are valid");
}

if (!vercel.regions || vercel.regions.length !== 1) {
  bad("vercel.json does not pin exactly one region",
      'Add "regions": ["fra1"] (or your Supabase region) — see docs/deploy.md.');
} else {
  ok(`functions pinned to ${vercel.regions[0]}`,
     "must match your Supabase region, or every query crosses a continent");
}

const edgeFiles = readdirSync(join(root, "api"))
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => /runtime:\s*"edge"/.test(read(join("api", f))))
  .sort();
if (edgeFiles.join(",") === "og-meta.ts,og.ts") {
  ok("only the two OG renderers run on the edge");
} else {
  warn(`unexpected edge runtime set: ${edgeFiles.join(", ") || "(none)"}`,
       "database-bound routes should be regional Node, not edge");
}

// ---------------------------------------------------------------------------
section("Migrations present in the repo");
// ---------------------------------------------------------------------------
const migrations = readdirSync(join(root, "supabase/migrations"))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();
ok(`${migrations.length} migration files, ${migrations[0]} … ${migrations.at(-1)}`);

const checklist = read("docs/pre-deploy-checklist.md");
const undocumented = migrations
  .filter((f) => Number(f.slice(0, 4)) >= 31)
  .filter((f) => !checklist.includes(f));
if (undocumented.length > 0) {
  warn(`not in the deploy checklist: ${undocumented.join(", ")}`,
       "a migration nobody is told to apply is a migration that gets skipped");
} else {
  ok("every security migration is in the deploy checklist");
}

// ---------------------------------------------------------------------------
section("Beta settings");
// ---------------------------------------------------------------------------
const robots = read("public/robots.txt");
if (/^Disallow:\s*\/\s*$/m.test(robots)) ok("robots.txt keeps the beta out of search");
else warn("robots.txt allows indexing", "fine for release, questionable for a beta");

const bannerEnabled = process.env.VITE_BANNER_ENABLED !== "false";
if (bannerEnabled) {
  const label = process.env.VITE_BANNER_LABEL;
  warn(`banner is ENABLED${label ? ` with a custom label` : " with the built-in placeholder label"}`,
       "set VITE_BANNER_ENABLED=false to hide it, or VITE_BANNER_LABEL to change the text");
} else {
  ok("banner disabled");
}

// ---------------------------------------------------------------------------
section("Environment");
// ---------------------------------------------------------------------------
const env = process.env;
for (const [k, why] of [
  ["VITE_SUPABASE_URL", "browser cannot reach the backend"],
  ["VITE_SUPABASE_ANON_KEY", "browser cannot reach the backend"],
  ["SUPABASE_URL", "api/* cannot reach the database"],
  ["SUPABASE_SERVICE_ROLE_KEY", "api/* cannot write anything"],
]) {
  if (env[k]) ok(`${k} set`);
  else warn(`${k} not set in this shell`, `must exist in Vercel (Production AND Preview) or ${why}`);
}
if (!env.GITHUB_FEEDBACK_TOKEN || !env.GITHUB_FEEDBACK_REPO) {
  warn("in-app feedback is not configured (GITHUB_FEEDBACK_TOKEN / GITHUB_FEEDBACK_REPO)",
       "it falls back to opening a GitHub issue page — acceptable, but for a beta the in-app path is the one testers use");
} else {
  ok("in-app feedback configured");
}

// ---------------------------------------------------------------------------
section("Live Supabase project");
// ---------------------------------------------------------------------------
const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  warn("skipped — no SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in this shell",
       "re-run with them to verify the migrations are actually applied");
} else {
  const rpc = async (fn, body = {}) => {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, text: await res.text() };
  };
  const rest = async (path, useAnon = false) => {
    const k = useAnon ? (env.VITE_SUPABASE_ANON_KEY ?? key) : key;
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
      headers: { apikey: k, authorization: `Bearer ${k}` },
    });
    return { status: res.status, text: await res.text() };
  };

  // 0039 — if this function is missing, the whole run-submit path is the old
  // non-transactional one and the daily cap is still raceable.
  const tx = await rpc("submit_run_tx", {});
  if (tx.status === 404) {
    bad("submit_run_tx() is NOT in the database — migration 0039 is unapplied",
        "apply the bundle: npm run migration:bundle, then paste migration-bundle.sql into the SQL Editor");
  } else {
    // Any other status means it exists (400 = wrong args, which is expected).
    ok("submit_run_tx() exists (0039 applied)");
  }

  // 0031 — the critical one. Called with the ANON key, it must be unreachable.
  if (env.VITE_SUPABASE_ANON_KEY) {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/roll_season`, {
      method: "POST",
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (res.status === 404 || res.status === 403 || res.status === 401) {
      ok("anon cannot call roll_season() (0031 applied)", `HTTP ${res.status}`);
    } else {
      bad(`anon CAN reach roll_season() — HTTP ${res.status}. Migration 0031 is unapplied.`,
          "Anyone with your publishable anon key can end the ranked season. Apply 0031 before deploying.");
    }
  } else {
    warn("cannot test anon access — VITE_SUPABASE_ANON_KEY not set in this shell");
  }

  // 0041 — per-caller RPCs must refuse the bare anon key. A 404 from PostgREST
  // is what "no EXECUTE for this role" looks like over REST.
  if (env.VITE_SUPABASE_ANON_KEY) {
    for (const fn of ["add_friend_by_username", "remove_friend", "inbox_incoming"]) {
      const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          apikey: env.VITE_SUPABASE_ANON_KEY,
          authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
          "content-type": "application/json",
        },
        body: "{}",
      });
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        ok(`anon cannot reach ${fn}() (0041 applied)`, `HTTP ${res.status}`);
      } else {
        bad(`anon CAN reach ${fn}() — HTTP ${res.status}. Migration 0041 is unapplied.`,
            "these act on auth.uid(); an unauthenticated caller has no business reaching them");
      }
    }
  }

  // 0036 / 0038 — input traces must not be bulk-readable by a client.
  if (env.VITE_SUPABASE_ANON_KEY) {
    for (const [table, migration] of [["runs", "0036"], ["challenges", "0038"]]) {
      const r = await rest(`${table}?select=inputs&limit=1`, true);
      if (r.status === 200) {
        bad(`anon can bulk-read ${table}.inputs — migration ${migration} is unapplied`,
            "this exposes every player's per-tick input trace");
      } else {
        ok(`anon cannot read ${table}.inputs (${migration} applied)`, `HTTP ${r.status}`);
      }
    }
  }

  // B3 — the promo codes that are in git history forever.
  const codes = await rest("skin_codes?select=code,max_uses");
  if (codes.status === 200) {
    let rows = [];
    try { rows = JSON.parse(codes.text); } catch { /* ignore */ }
    const burned = rows.filter((r) => ["PLAYTEST2025", "FOUNDER", "FRIENDSFAMILY"].includes(r.code));
    if (burned.length > 0) {
      bad(`promo codes still un-rotated: ${burned.map((r) => r.code).join(", ")}`,
          "these are in git history forever — run: node scripts/rotate-codes.mjs");
    } else {
      ok("the committed promo codes have been rotated");
    }
    const uncapped = rows.filter((r) => r.max_uses === null);
    if (uncapped.length > 0) {
      warn(`${uncapped.length} promo code(s) have no use limit`,
           "an uncapped code is a standing liability even when secret");
    } else if (rows.length > 0) {
      ok("every promo code has a use limit");
    }
  } else {
    warn(`could not read skin_codes (HTTP ${codes.status})`, "cannot verify the promo-code rotation");
  }

  // Account durability — the biggest remaining risk for a beta.
  const settings = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY ?? key },
  });
  if (settings.ok) {
    let s = {};
    try { s = await settings.json(); } catch { /* ignore */ }
    const providers = Object.entries(s.external ?? {}).filter(([, on]) => on).map(([p]) => p);
    const emailOn = s.external?.email === true;
    const real = providers.filter((p) => p !== "anonymous_users");
    if (real.length === 0 && !emailOn) {
      warn("no real auth provider is enabled — every account is anonymous",
           "an anonymous account lives only in one browser's localStorage. See docs/account-durability.md");
    } else {
      ok(`auth providers enabled: ${real.join(", ") || "email"}`);
    }
  } else {
    warn("could not read the auth settings", "verify manually that a provider is enabled");
  }
}

// ---------------------------------------------------------------------------
console.log();
if (blocking > 0) {
  console.log(`\x1b[31mNOT READY — ${blocking} blocking issue(s), ${warnings} warning(s)\x1b[0m`);
  process.exit(1);
}
console.log(
  warnings > 0
    ? `\x1b[32mREADY for a beta deploy\x1b[0m — ${warnings} warning(s) above; each is a known, acceptable gap for a beta.`
    : `\x1b[32mREADY\x1b[0m — no blocking issues, no warnings.`,
);
