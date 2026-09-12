#!/usr/bin/env node
/**
 * Apply the migrations to a live Supabase project, then prove it worked.
 *
 * Replaces "paste ten files into the SQL Editor and hope", which is ten
 * chances to skip one — and a skip is not cosmetic here: without 0031 anyone
 * holding the publishable anon key can end the ranked season, and without 0037
 * the server stops persisting progress while still returning correct-looking
 * numbers to the client.
 *
 *   # PowerShell
 *   $env:SUPABASE_DB_URL="postgresql://postgres:PW@db.REF.supabase.co:5432/postgres"
 *   node scripts/apply-migrations.mjs
 *
 * Flags:
 *   --from N      first migration to apply (default 31 — see below)
 *   --to N        last migration to apply (default: all)
 *   --dry-run     list what would run, touch nothing
 *   --verify-only skip applying, just run the checks
 *
 * WHY --from DEFAULTS TO 31: migrations 0001-0030 are NOT re-runnable (0001
 * does a bare `create table`), and on any project where the app has ever
 * worked they are already applied. Re-running them errors. 0031+ are all
 * written to be re-runnable, so applying this twice is safe.
 * For a brand-new empty project, pass --from 1.
 *
 * Each migration file is sent as ONE query, which Postgres runs in an implicit
 * transaction — so a file either applies completely or not at all, and a
 * failure never leaves half a migration behind.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase/migrations");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const FROM = Number(val("--from", "31"));
const TO = Number(val("--to", "9999"));
const DRY = flag("--dry-run");
const VERIFY_ONLY = flag("--verify-only");

const C = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  bad: (s) => `\x1b[31m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
};

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error(C.bad("SUPABASE_DB_URL is not set."));
  console.error(`
Get it from: Supabase Dashboard -> your project -> Connect -> "Connection string"
             pick the DIRECT connection (port 5432), not the transaction pooler
             (6543) — the pooler cannot run some of the DDL in these migrations.

PowerShell:
  $env:SUPABASE_DB_URL="postgresql://postgres:YOUR-PASSWORD@db.YOUR-REF.supabase.co:5432/postgres"

If your password contains @ : / ? # or %, URL-encode it (e.g. @ becomes %40).
`);
  process.exit(2);
}

// Honour sslmode from the URL; default to encrypted-and-verified.
// If your project's chain isn't in Node's store you'll get a cert error — add
// ?sslmode=no-verify to the URL yourself rather than have this silently
// weaken the connection for everyone.
const sslmode = /[?&]sslmode=([a-z-]+)/.exec(url)?.[1] ?? "require";
const ssl =
  sslmode === "disable"
    ? false
    : { rejectUnauthorized: !["no-verify", "allow", "prefer"].includes(sslmode) };

const files = readdirSync(migDir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
  .filter((f) => { const n = Number(f.slice(0, 4)); return n >= FROM && n <= TO; });

if (files.length === 0) {
  console.error(C.bad(`No migrations in range ${FROM}..${TO}`));
  process.exit(2);
}

const client = new pg.Client({ connectionString: url, ssl, application_name: "glide-migrate" });

let applied = 0;
let failed = 0;
const checks = [];   // invariants: these PROVE the migrations took effect
const todos = [];    // owner actions no migration can perform
const check = (name, pass, detail) => checks.push({ name, pass, detail });
const todo = (name, done, action) => todos.push({ name, done, action });

try {
  console.log(C.b("\n=== Connecting ==="));
  await client.connect();
  const { rows: [info] } = await client.query(
    "select current_database() as db, current_user as usr, version() as v",
  );
  console.log(`  connected as ${C.b(info.usr)} to ${C.b(info.db)}`);
  console.log(`  ${C.dim(info.v.split(",")[0])}`);

  // Refuse to run 0031+ against a database that has never had the baseline —
  // every one of them ALTERs objects 0001-0030 create, so the errors would be
  // confusing rather than useful.
  if (FROM > 1) {
    const { rows: [b] } = await client.query(
      "select to_regclass('public.profiles') is not null as has_baseline",
    );
    if (!b.has_baseline) {
      console.error(C.bad(`\npublic.profiles does not exist — the 0001-0030 baseline is missing.`));
      console.error(`This looks like an empty project. Re-run with --from 1 to apply everything.\n`);
      process.exit(2);
    }
    console.log(`  baseline present ${C.dim("(public.profiles exists)")}`);
  }

  if (!VERIFY_ONLY) {
    console.log(C.b(`\n=== Applying ${files.length} migration(s) ${DRY ? "(DRY RUN)" : ""} ===`));
    for (const f of files) {
      if (DRY) { console.log(`  ${C.dim("would apply")} ${f}`); continue; }
      const sql = readFileSync(join(migDir, f), "utf8");
      try {
        // One query per file => one implicit transaction => all-or-nothing.
        await client.query(sql);
        console.log(`  ${C.ok("ok")}    ${f}`);
        applied++;
      } catch (e) {
        console.log(`  ${C.bad("FAIL")}  ${f}`);
        console.log(`        ${e.message.split("\n")[0]}`);
        if (e.hint) console.log(`        hint: ${e.hint}`);
        failed++;
      }
    }
  }

  if (DRY) {
    console.log(C.dim("\nDry run — nothing was changed.\n"));
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // Verification. Read-only catalog queries only — this runs against your real
  // database, so it must never create test data.
  // -------------------------------------------------------------------------
  console.log(C.b("\n=== Verifying ==="));

  const one = async (sql, params = []) => (await client.query(sql, params)).rows[0];

  // 0031 — the critical one.
  for (const fn of ["roll_season", "upsert_daily_seed"]) {
    const r = await one(
      `select coalesce(bool_or(has_function_privilege($1, p.oid, 'execute')), false) as can
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $2`,
      ["anon", fn],
    );
    check(`anon cannot call ${fn}()`, r.can === false, r.can ? "STILL REACHABLE" : "");
  }

  // The client RPCs must still work, or we've shipped an outage.
  for (const fn of ["leaderboard_by", "public_profile", "remove_friend", "best_run_ghost"]) {
    const r = await one(
      `select coalesce(bool_or(has_function_privilege('authenticated', p.oid, 'execute')), false) as can
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`,
      [fn],
    );
    check(`authenticated can call ${fn}()`, r.can === true, r.can ? "" : "client would 404");
  }

  // 0037 — the silent one.
  for (const fn of ["submit_run_tx", "bump_profile_after_run", "claim_code_use", "claim_feedback_slot"]) {
    const r = await one(
      `select coalesce(bool_or(has_function_privilege('service_role', p.oid, 'execute')), false) as can,
              count(*) as n
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`,
      [fn],
    );
    check(
      `service_role can execute ${fn}()`,
      Number(r.n) > 0 && r.can === true,
      Number(r.n) === 0 ? "FUNCTION MISSING" : r.can ? "" : "server would break silently",
    );
  }

  // 0032 — unique replay hash.
  const idx = await one(
    `select count(*) as n from pg_indexes
      where schemaname='public' and tablename='runs' and indexdef ilike '%unique%inputs_hash%'`,
  );
  check("runs.inputs_hash has a UNIQUE index", Number(idx.n) > 0);

  // 0036 / 0038 — input traces closed to clients, scores still open.
  for (const [tbl, mig] of [["runs", "0036"], ["challenges", "0038"]]) {
    const r = await one(
      `select has_column_privilege('anon', $1, 'inputs', 'select') as can`,
      [`public.${tbl}`],
    );
    check(`anon cannot read ${tbl}.inputs (${mig})`, r.can === false, r.can ? "STILL EXPOSED" : "");
  }
  const score = await one(`select has_column_privilege('anon','public.runs','score','select') as can`);
  check("anon can still read run scores (leaderboards)", score.can === true);

  // 0034 — run cosmetic ownership trigger.
  const trg = await one(
    `select count(*) as n from pg_trigger
      where tgrelid = 'public.runs'::regclass and tgname = 'runs_enforce_skin_ownership'`,
  );
  check("runs skin-ownership trigger installed", Number(trg.n) > 0);

  // 0040 — no SECURITY DEFINER function may have a mutable search_path.
  const mut = await one(
    `select coalesce(string_agg(p.proname, ', ' order by p.proname), '') as names
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
      where n.nspname='public' and p.prosecdef and d.objid is null and p.proconfig is null`,
  );
  check("no SECURITY DEFINER function has a mutable search_path", mut.names === "", mut.names);

  // B3 — the promo codes that live in git history forever. An OWNER ACTION,
  // not a migration outcome: the new codes must be secrets, so they can't come
  // from a file in the repo.
  const codes = await one(
    `select coalesce(string_agg(code, ', '), '') as burned
       from public.skin_codes
      where code in ('PLAYTEST2025','FOUNDER','FRIENDSFAMILY')`,
  );
  todo(
    codes.burned
      ? `rotate the committed promo codes (still live: ${codes.burned})`
      : "committed promo codes rotated",
    codes.burned === "",
    "node scripts/rotate-codes.mjs   # prints SQL; new codes go to stderr",
  );

  const uncapped = await one(
    `select coalesce(string_agg(code, ', '), '') as c
       from public.skin_codes where max_uses is null`,
  );
  if (uncapped.c) {
    todo(`cap the unlimited promo code(s): ${uncapped.c}`, false,
         "update public.skin_codes set max_uses = 100 where max_uses is null;");
  }

  // -------------------------------------------------------------------------
  for (const c of checks) {
    console.log(`  ${c.pass ? C.ok("ok  ") : C.bad("FAIL")} ${c.name}${c.detail ? ` ${C.dim("— " + c.detail)}` : ""}`);
  }

  const bad = checks.filter((c) => !c.pass);

  console.log();
  if (failed === 0 && bad.length === 0) {
    console.log(
      C.ok(C.b("✔ MIGRATIONS OK")) +
        ` — ${VERIFY_ONLY ? "verified" : `${applied} applied,`} all ${checks.length} invariants hold.`,
    );
    console.log(C.dim("  Safe to re-run this command any time; 0031+ are idempotent."));
  } else {
    console.log(
      C.bad(C.b("✘ MIGRATIONS NOT OK")) +
        ` — ${failed} file(s) failed to apply, ${bad.length} invariant(s) not holding.`,
    );
    for (const c of bad) console.log(`    - ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
    process.exitCode = 1;
  }

  // Owner actions are reported separately: they do not mean the migrations
  // failed, but the beta is not finished until they are done.
  const open = todos.filter((t) => !t.done);
  if (open.length > 0) {
    console.log(C.warn(C.b("\n⚠ STILL TO DO (not a migration — only you can do these)")));
    for (const t of open) {
      console.log(`    ${C.warn("•")} ${t.name}`);
      console.log(`      ${C.dim(t.action)}`);
    }
  } else if (todos.length > 0) {
    console.log(C.ok("✔ owner actions done") + C.dim(" — promo codes rotated and capped"));
  }
  console.log();
} catch (e) {
  console.error(C.bad(`\nConnection or fatal error: ${e.message}`));
  if (/self.signed|certificate/i.test(e.message)) {
    console.error(`\nTLS chain not trusted by Node. Append ?sslmode=no-verify to SUPABASE_DB_URL\n(still encrypted; skips certificate verification).`);
  }
  if (/password|SASL|auth/i.test(e.message)) {
    console.error(`\nCheck the password in the URL. If it contains @ : / ? # or %, URL-encode it.`);
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(e.message)) {
    console.error(`\nHost not resolvable — check the project ref in the URL, and that the project isn't paused.`);
  }
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
