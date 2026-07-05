-- 0030_skin_codes_lockdown.sql
--
-- SECURITY FIX (board-review C2).
--
-- 0005 created `skin_codes_select_all` with `using (true)`, exposing the WHOLE
-- table — including the primary key `code`, which IS the secret — to any anon or
-- authenticated client. A client could `select code, unlocks_badge, unlocks_shape
-- from skin_codes` and redeem every promo (including the unlimited-use
-- FRIENDSFAMILY), self-granting the founder/supporter badge. That is an
-- entitlement bypass, not just a free skin.
--
-- Nothing in the client ever reads this table: redemption goes through
-- api/redeem-code.ts using the service-role admin client, which bypasses RLS.
-- So we drop the public read policy entirely; RLS default-deny then keeps the
-- table readable only by the service role.

drop policy if exists "skin_codes_select_all" on public.skin_codes;

-- Defense in depth: remove any residual table-level SELECT grant to client roles
-- (harmless no-op if it was never granted directly).
revoke select on public.skin_codes from anon;
revoke select on public.skin_codes from authenticated;

-- ---------------------------------------------------------------------------
-- ⚠ OWNER ACTION STILL REQUIRED — ROTATE THE COMMITTED CODES.
--
-- PLAYTEST2025 / FOUNDER / FRIENDSFAMILY were committed in plaintext in
-- 0005_skin_codes.sql, so they live in git history forever. Dropping the read
-- policy stops NEW discovery, but anyone who already has a code can still
-- redeem it. Rotate them in the DB (values are intentionally NOT hard-coded
-- here to avoid re-committing new secrets). Suggested, run manually with real
-- new codes of your choosing:
--
--   update public.skin_codes set code = '<new-secret>' where code = 'FOUNDER';
--   update public.skin_codes set code = '<new-secret>' where code = 'PLAYTEST2025';
--   -- FRIENDSFAMILY is unlimited (max_uses = null) AND public — cap or rotate it:
--   update public.skin_codes set code = '<new-secret>', max_uses = 100
--     where code = 'FRIENDSFAMILY';
-- ---------------------------------------------------------------------------
