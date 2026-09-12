#!/usr/bin/env node
/**
 * Concatenate the security migrations into ONE file to paste.
 *
 * Applying 0031-0040 means ten separate paste-and-Run operations in the
 * Supabase SQL Editor, in the right order, with no skips. That is ten chances
 * to miss one — and several of them are the security fixes the app depends on,
 * so a miss is not a cosmetic problem: 0031 is what stops any holder of the
 * anon key ending the ranked season, and 0037 is what keeps the server able to
 * persist progress at all.
 *
 * So generate one ordered file instead. Output is NOT committed (it is a build
 * artifact of files that are already in git, and regenerating it is free):
 *
 *   node scripts/build-combined-migration.mjs           # -> stdout
 *   node scripts/build-combined-migration.mjs -o out.sql
 *
 * By default it takes everything from 0031 up. Override with --from/--to when
 * you have already applied part of the range.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase/migrations");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const from = Number(opt("--from", "31"));
const to = Number(opt("--to", "9999"));
const out = opt("-o", opt("--out", null));

const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
  .filter((f) => {
    const n = Number(f.slice(0, 4));
    return n >= from && n <= to;
  });

if (files.length === 0) {
  console.error(`No migrations in range ${from}..${to}`);
  process.exit(1);
}

const bar = "-".repeat(75);
const parts = [
  `-- ============================================================================`,
  `-- Glide — combined migration bundle`,
  `-- Generated ${new Date().toISOString()} by scripts/build-combined-migration.mjs`,
  `--`,
  `-- Contains ${files.length} migration(s), in order:`,
  ...files.map((f, i) => `--   ${String(i + 1).padStart(2)}. ${f}`),
  `--`,
  `-- HOW TO APPLY: paste this whole file into the Supabase SQL Editor and Run.`,
  `-- Every migration in it is written to be re-runnable, so applying it twice`,
  `-- is safe and applying it after some were already applied is safe too.`,
  `--`,
  `-- It is deliberately NOT wrapped in a single transaction: a few statements`,
  `-- here (ALTER DEFAULT PRIVILEGES, CREATE INDEX) behave differently or cannot`,
  `-- run inside one, and a half-applied bundle is recoverable by re-running`,
  `-- whereas a silently rolled-back one looks like success.`,
  `--`,
  `-- AFTER RUNNING, verify with the queries in 0031 (step 5) and 0037, or run`,
  `--   node scripts/preflight.mjs`,
  `-- ============================================================================`,
  ``,
];

for (const f of files) {
  parts.push(
    ``,
    `-- ${bar}`,
    `-- BEGIN ${f}`,
    `-- ${bar}`,
    ``,
    readFileSync(join(dir, f), "utf8").trimEnd(),
    ``,
    `-- END ${f}`,
    ``,
  );
}

const sql = parts.join("\n");
if (out) {
  writeFileSync(isAbsolute(out) ? out : join(root, out), sql);
  console.error(`Wrote ${out} — ${files.length} migrations, ${(sql.length / 1024).toFixed(1)} KB`);
  console.error(`Paste it into the Supabase SQL Editor and Run.`);
} else {
  process.stdout.write(sql);
}
