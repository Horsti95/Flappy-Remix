#!/usr/bin/env node
/**
 * Full Supabase data backup.
 *
 * Dumps every application table to a single timestamped JSON file using the
 * service-role key, so we have a guaranteed restore point *before* running a
 * migration. Our migrations are additive (`CREATE TABLE IF NOT EXISTS`,
 * `ALTER TABLE ... ADD COLUMN`), so new columns land empty and old rows are
 * preserved — but a pre-migration dump means even a mistaken destructive
 * change can be rolled back.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup.mjs
 *   node scripts/backup.mjs --out ./backups        # custom directory
 *
 * The service-role key bypasses RLS, so this reads every row of every table.
 * NEVER commit the produced files — backups/ is gitignored.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Every table that holds durable data. Views (leaderboard_*) are derived
// from `runs` and intentionally omitted — restoring base tables rebuilds them.
const TABLES = [
  "profiles",
  "skins",
  "runs",
  "daily_seeds",
  "friendships",
  "challenges",
  "seasons",
  "elo_ratings",
  "elo_season_snapshots",
  "ranked_matches",
  "matchmaking_queue",
  "skin_codes",
  "skin_code_redemptions",
  "shape_grants",
];

const PAGE = 1000; // PostgREST caps each request; page through large tables.

function parseArgs(argv) {
  const args = { out: "backups" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

async function fetchAll(admin, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
    );
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const dump = {
    backed_up_at: new Date().toISOString(),
    format: "pflug-backup-v1",
    tables: {},
  };

  let total = 0;
  for (const table of TABLES) {
    process.stdout.write(`  ${table} … `);
    const rows = await fetchAll(admin, table);
    dump.tables[table] = rows;
    total += rows.length;
    console.log(`${rows.length} rows`);
  }

  await mkdir(out, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(out, `pflug-backup-${stamp}.json`);
  await writeFile(file, JSON.stringify(dump, null, 2), "utf8");

  console.log(`\nBacked up ${total} rows across ${TABLES.length} tables → ${file}`);
}

main().catch((err) => {
  console.error("\nBackup failed:", err.message ?? err);
  process.exit(1);
});
