#!/usr/bin/env node
/**
 * Rotate the promo codes that were committed in plaintext.
 *
 * WHY: 0005_skin_codes.sql seeded PLAYTEST2025, FOUNDER and FRIENDSFAMILY as
 * literal values, so they are in git history permanently. 0030 removed the
 * public read policy (nobody can discover NEW codes), and 0031 locked down the
 * RPCs — but anyone who already has one of those three strings can still
 * redeem it, and via skin_codes.unlocks_badge (0028) that self-grants the
 * founder/supporter badge. FRIENDSFAMILY is the worst of the three: max_uses
 * is NULL, so it is unlimited.
 *
 * This prints the SQL to replace them with fresh random codes. It deliberately
 * does NOT write the codes to any file in the repo — paste the output into the
 * Supabase SQL Editor, then save the new codes in your password manager.
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

// The three burned codes, and what each should become. FRIENDSFAMILY gains a
// cap: an uncapped promo code is a standing liability even when it is secret.
const rotations = [
  { old: "PLAYTEST2025", maxUses: 100, note: "early playtester" },
  { old: "FOUNDER", maxUses: 25, note: "founder" },
  { old: "FRIENDSFAMILY", maxUses: 100, note: "friends & family (was UNLIMITED)" },
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
  console.log(`update public.skin_codes
   set code = '${next}', max_uses = ${maxUses}
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
