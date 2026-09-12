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
 * PREFER `supabase db push --linked` WHEN THE CLI IS LINKED. It is the tool
 * that owns the migration ledger, and it applies exactly what is missing. Use
 * this script when the CLI is not set up, when you want the invariant checks,
 * or to verify a database somebody already migrated by hand.
 *
 * This script now READS and WRITES the same ledger
 * (supabase_migrations.schema_migrations), so the two no longer disagree:
 * versions already recorded there are skipped, and versions it applies are
 * recorded. It does NOT create the ledger — if the table is absent it says so
 * and applies anyway, because inventing a table the CLI owns is how you break
 * the CLI.
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
 *   --force       re-apply versions the ledger already records (they are
 *                 idempotent; useful if you suspect the ledger is wrong)
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
const FORCE = flag("--force");

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

  // -------------------------------------------------------------------------
  // The Supabase CLI's migration ledger.
  //
  // `supabase db push` records every applied version in
  // supabase_migrations.schema_migrations. Applying SQL directly without
  // touching it makes the CLI's view of the database wrong — it will offer to
  // re-apply what is already there, and a later `db push` can report a history
  // mismatch. So read it (skip what is recorded) and write it (record what we
  // apply).
  //
  // The table is NOT created here if absent. Its shape belongs to the CLI, and
  // guessing it is how you break `db push`. Columns are detected rather than
  // assumed, because the CLI has changed them across versions (`version` only
  // in older releases; `version`, `name`, `statements` now).
  // -------------------------------------------------------------------------
  let ledger = null;
  {
    const { rows: [t] } = await client.query(
      `select to_regclass('supabase_migrations.schema_migrations') is not null as present`,
    );
    if (t.present) {
      const { rows: cols } = await client.query(
        `select column_name from information_schema.columns
          where table_schema = 'supabase_migrations'
            and table_name = 'schema_migrations'`,
      );
      ledger = { columns: new Set(cols.map((c) => c.column_name)) };
      const { rows: have } = await client.query(
        `select version from supabase_migrations.schema_migrations order by version`,
      );
      ledger.applied = new Set(have.map((r) => String(r.version)));
      console.log(
        `  migration ledger present ${C.dim(`(${ledger.applied.size} version(s) recorded, latest ${[...ledger.applied].pop() ?? "none"})`)}`,
      );
    } else {
      console.log(
        `  ${C.warn("no migration ledger")} ${C.dim("(supabase_migrations.schema_migrations absent — CLI not used here)")}`,
      );
    }
  }

  if (!VERIFY_ONLY) {
    // A version is the leading digits of the filename, which is what the CLI
    // stores — `0041_client_rpc_anon_lockdown.sql` is version `0041`.
    const versionOf = (f) => f.slice(0, 4);
    const todoFiles = files.filter((f) => {
      if (FORCE || !ledger) return true;
      return !ledger.applied.has(versionOf(f));
    });
    const skipped = files.length - todoFiles.length;

    console.log(
      C.b(`\n=== Applying ${todoFiles.length} migration(s)${skipped > 0 ? ` (${skipped} already recorded)` : ""} ${DRY ? "(DRY RUN)" : ""} ===`),
    );
    if (skipped > 0 && !FORCE) {
      console.log(C.dim(`  Skipping what the ledger already records. Use --force to re-apply anyway.`));
    }
    if (todoFiles.length === 0) {
      console.log(C.dim("  Nothing to do — the database is already at the newest migration."));
    }

    for (const f of todoFiles) {
      if (DRY) { console.log(`  ${C.dim("would apply")} ${f}`); continue; }
      const sql = readFileSync(join(migDir, f), "utf8");
      try {
        // One query per file => one implicit transaction => all-or-nothing.
        await client.query(sql);

        // Record it, so the CLI and this script agree from here on.
        if (ledger) {
          const cols = ["version"];
          const vals = [versionOf(f)];
          if (ledger.columns.has("name")) { cols.push("name"); vals.push(f.replace(/\.sql$/, "")); }
          // `statements` is text[] and the CLI fills it with the split-up SQL.
          // A single-element array is honest (we ran it as one statement) and
          // keeps a NOT NULL constraint happy if one exists.
          if (ledger.columns.has("statements")) { cols.push("statements"); vals.push([sql]); }
          await client.query(
            `insert into supabase_migrations.schema_migrations (${cols.join(", ")})
             values (${cols.map((_, i) => `$${i + 1}`).join(", ")})
             on conflict (version) do nothing`,
            vals,
          );
        }

        console.log(`  ${C.ok("ok")}    ${f}${ledger ? C.dim(" (recorded)") : ""}`);
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

  // 0041 — the per-caller RPCs must be authenticated-only. 0031 granted them
  // to `authenticated` but never revoked the PUBLIC default, so `anon` kept
  // access; and the check above never looked, because it excluded the whole
  // allowlist from scrutiny instead of checking it per role.
  for (const fn of [
    "add_friend_by_username", "incoming_friend_requests", "accept_friend_request",
    "decline_friend_request", "remove_friend", "inbox_incoming", "inbox_outgoing",
    "inbox_unseen_count", "inbox_mark_seen", "decline_challenge", "friends_leaderboard",
  ]) {
    const r = await one(
      `select coalesce(bool_or(has_function_privilege('anon', p.oid, 'execute')), false) as a,
              coalesce(bool_or(has_function_privilege('authenticated', p.oid, 'execute')), false) as u
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`,
      [fn],
    );
    check(
      `${fn}(): authenticated yes, anon no`,
      r.a === false && r.u === true,
      r.a ? "anon can still reach it (0041 unapplied)" : r.u ? "" : "client would 404",
    );
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

  // 0040 + 0042 — NO function may have a mutable search_path. The `prosecdef`
  // filter this used to carry is what hid two SECURITY INVOKER functions and
  // left Supabase's advisor reporting warnings nobody could locate.
  const mut = await one(
    `select coalesce(string_agg(p.proname, ', ' order by p.proname), '') as names
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
      where n.nspname='public' and p.prokind='f' and d.objid is null
        and p.proconfig is null`,
  );
  check("no function has a mutable search_path (any security mode)", mut.names === "", mut.names);

  // The promo codes that live in git history forever. This is now a genuine
  // INVARIANT rather than an owner action: 0043 disables them, which needs no
  // secret. What matters is whether they are still REDEEMABLE, not whether the
  // rows exist — the rows must stay, because skin_code_redemptions references
  // them ON DELETE CASCADE and deleting one would wipe players' redemption
  // history and let them redeem again.
  //
  // All six seeded literals, across 0005 / 0006 / 0028. Listing only the three
  // that 0030's comment names is what left LENNART2, ISA_S2 and THANKYOU live,
  // and THANKYOU grants the supporter badge.
  const codes = await one(
    `select coalesce(string_agg(code, ', ' order by code), '') as live
       from public.skin_codes
      where code in ('PLAYTEST2025','FOUNDER','FRIENDSFAMILY',
                     'LENNART2','ISA_S2','THANKYOU')
        and (expires_at is null or expires_at > now())
        and (max_uses is null or uses < max_uses)`,
  );
  check(
    "committed promo codes are no longer redeemable",
    codes.live === "",
    codes.live ? `still redeemable: ${codes.live} — migration 0043 is unapplied` : "",
  );

  // Nothing uncapped may be redeemable anywhere, including codes the owner
  // added by hand.
  const uncapped = await one(
    `select coalesce(string_agg(code, ', ' order by code), '') as c
       from public.skin_codes
      where max_uses is null and (expires_at is null or expires_at > now())`,
  );
  check(
    "no uncapped promo code is redeemable",
    uncapped.c === "",
    uncapped.c ? `uncapped and live: ${uncapped.c}` : "",
  );

  // 0044 — "capped" must be a CONSTRAINT, not a habit. The check above finds an
  // uncapped code after the fact; this one proves the database would have
  // refused to create it. convalidated also has to be true: NOT VALID blocks
  // new writes but tolerates a legacy uncapped row, so an unvalidated
  // constraint means one is still in there.
  const cap = await one(
    `select coalesce(max(case when convalidated then 'valid' else 'notvalid' end), 'missing') as state
       from pg_constraint
      where conrelid = 'public.skin_codes'::regclass
        and conname  = 'skin_codes_max_uses_capped'`,
  );
  check(
    "an uncapped promo code is impossible (0044)",
    cap.state === "valid",
    cap.state === "missing"
      ? "constraint absent — migration 0044 is unapplied"
      : cap.state === "notvalid"
        ? "constraint is NOT VALID — an existing code is uncapped; cap it, then re-run 0044"
        : "",
  );

  // A badge-granting code that is still live is worth a look either way — it is
  // an entitlement, not a cosmetic.
  const badged = await one(
    `select coalesce(string_agg(code || '->' || unlocks_badge, ', '), '') as c
       from public.skin_codes
      where unlocks_badge is not null
        and (expires_at is null or expires_at > now())
        and (max_uses is null or uses < max_uses)`,
  );
  if (badged.c) {
    todo(`badge-granting promo code(s) are live: ${badged.c}`, false,
         "fine if you minted them yourself; not fine if they were ever committed");
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
