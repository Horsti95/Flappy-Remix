#!/usr/bin/env node
/**
 * Mint fresh promo codes.
 *
 * NO LONGER A SECURITY CHORE. Six codes were seeded as literals across
 * migrations 0005, 0006 and 0028 (PLAYTEST2025, FOUNDER, FRIENDSFAMILY,
 * LENNART2, ISA_S2, THANKYOU), so all six are in git history permanently —
 * and THANKYOU granted the supporter badge. Migration 0043 DISABLES all of
 * them, which needs no secret and therefore can live in the repo.
 *
 * So this script is now optional: run it when you actually want codes to hand
 * out. What it prints replaces the disabled rows with fresh random secrets.
 *
 * It deliberately does NOT write the codes to any file in the repo — paste the
 * output into the Supabase SQL Editor, then save the new codes in your password
 * manager.
 *
 *   node scripts/rotate-codes.mjs
 *   node scripts/rotate-codes.mjs --len 12
 *
 * Re-runnable: each run mints different codes. Run it once, use that output.
 */
import { randomInt } from "node:crypto";

// Same alphabet as the device link codes: no 0/O/1/I/L, so a code read aloud
// or off a sticker can't be mistyped.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const args = process.argv.slice(2);
const lenArg = args.indexOf("--len");
const LEN = lenArg >= 0 ? Number(args[lenArg + 1]) : 10;
if (!Number.isInteger(LEN) || LEN < 6 || LEN > 32) {
  console.error("--len must be an integer between 6 and 32");
  process.exit(1);
}

/** Uniform random code — randomInt() is rejection-sampled, so no modulo bias. */
function code() {
  let out = "";
  for (let i = 0; i < LEN; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Every code seeded as a literal, and what each should become. Caps are
// deliberate: an uncapped code is a standing liability even when secret, so
// nothing here gets max_uses = null — FRIENDSFAMILY, which was unlimited, gains
// one. Since 0044 the database enforces that too (a CHECK constraint refuses
// max_uses = null), so an uncapped rotation would now fail outright rather than
// quietly succeed.
const rotations = [
  { old: "PLAYTEST2025", maxUses: 100, note: "early playtester" },
  { old: "FOUNDER", maxUses: 25, note: "founder" },
  { old: "FRIENDSFAMILY", maxUses: 100, note: "friends & family (was UNLIMITED)" },
  { old: "LENNART2", maxUses: 1, note: "lennart re-issue" },
  { old: "ISA_S2", maxUses: 1, note: "isa s2 (also grants the butterfly shape)" },
  { old: "THANKYOU", maxUses: 250, note: "supporter — GRANTS THE SUPPORTER BADGE" },
];

const minted = rotations.map((r) => ({ ...r, next: code() }));

console.log(`-- Promo code rotation — generated ${new Date().toISOString()}
--
-- Paste into the Supabase SQL Editor and Run. Then store the new codes in your
-- password manager and hand them out individually. Do NOT commit them.
--
-- Each statement is a no-op if the old code was already rotated, so this is
-- safe to run even if you are unsure whether you did it already.
begin;
`);

for (const { old, next, maxUses, note } of minted) {
  console.log(`-- ${old}  ->  ${next}      (${note}, max_uses ${maxUses})`);
  // expires_at must be cleared too: 0043 set it to now() to disable the code,
  // so a rotation that only changes the string would mint an already-expired
  // code and the redemption would fail with "expired".
  console.log(`update public.skin_codes
   set code = '${next}', max_uses = ${maxUses}, expires_at = null
 where code = '${old}';
`);
}

console.log(`-- Verify: the old strings must be gone, and nothing may be uncapped.
select code, label, uses, max_uses, expires_at
  from public.skin_codes
 order by label;

-- Any row below is still a liability (uncapped promo code):
select code, label from public.skin_codes where max_uses is null;

commit;`);

console.error(`
┌─ NEW CODES — copy these somewhere safe now ─────────────────┐`);
for (const { old, next } of minted) {
  console.error(`│  ${old.padEnd(14)} -> ${next.padEnd(12)}                   │`);
}
console.error(`└─────────────────────────────────────────────────────────────┘
(The SQL went to stdout; this box went to stderr, so
 \`node scripts/rotate-codes.mjs > rotate.sql\` keeps the codes off disk.)
`);
