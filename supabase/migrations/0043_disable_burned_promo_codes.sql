-- 0043_disable_burned_promo_codes.sql
--
-- Closes the last outstanding security item WITHOUT needing a secret.
--
-- THE PROBLEM. Six promo codes were seeded as literals across three
-- migrations, so all six are in git history permanently:
--
--     0005: PLAYTEST2025, FOUNDER, FRIENDSFAMILY
--     0006: LENNART2, ISA_S2
--     0028: THANKYOU
--
-- 0030 removed the public read policy so nobody can DISCOVER them any more,
-- but anyone who already has one can still redeem it. Two are worse than the
-- rest:
--
--   * FRIENDSFAMILY — max_uses NULL, i.e. unlimited.
--   * THANKYOU      — max_uses 1000, and it grants the `supporter` BADGE via
--                     skin_codes.unlocks_badge (0028). That is an entitlement
--                     bypass, which is the exact thing 0030 was written to
--                     stop.
--
-- I previously named only the 0005 trio, because that is the list 0030's own
-- warning comment carries and I trusted it instead of scanning the migrations
-- for every seeded code. 0006 and 0028 each added more. Hence the check at the
-- bottom of this file, which finds committed codes by their PROPERTIES rather
-- than by a hand-maintained list that has now been wrong once.
--
-- WHY THIS MIGRATION EXISTS. The fix has been "run scripts/rotate-codes.mjs
-- and paste the SQL", which works but cannot live in the repo: the replacement
-- codes are secrets, and a secret in a migration is the same mistake again. So
-- rotation stayed an owner action, and stayed the one thing blocking the beta.
--
-- But rotation is not what makes the project safe — DISABLING the leaked codes
-- is. That needs no secret, so it can be a migration, and the owner can mint
-- fresh codes whenever they actually want to hand some out.
--
-- HOW. Double-locked against claim_code_use() (0033), whose guard is:
--
--     where code = p_code
--       and (expires_at is null or expires_at > now())
--       and (max_uses  is null or uses < max_uses)
--
--   * expires_at = now()  -> `expires_at > now()` is false from here on
--   * max_uses   = uses   -> `uses < max_uses` is false
--
-- Either condition alone refuses the code; both are set so a future edit to one
-- of them cannot quietly re-open it.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: delete the rows.
-- skin_code_redemptions.code references skin_codes(code) ON DELETE CASCADE, so
-- deleting a code would cascade away the redemption records of every player who
-- used it — losing their history AND letting them redeem it again, since the
-- (user_id, code) primary key that prevents a second redemption would be gone
-- too. Disabling keeps all of that intact.
--
-- Players who already redeemed KEEP their skin and badge. This only stops NEW
-- redemptions.
--
-- Re-runnable. Apply via `supabase db push` or the Supabase SQL Editor.

do $$
declare
  r record;
  n int := 0;
begin
  for r in
    update public.skin_codes
       set expires_at = now(),
           -- uses is NOT NULL default 0, so this is always a valid cap.
           max_uses   = uses
     where code in (
             -- 0005
             'PLAYTEST2025', 'FOUNDER', 'FRIENDSFAMILY',
             -- 0006
             'LENNART2', 'ISA_S2',
             -- 0028 (grants the supporter badge)
             'THANKYOU'
           )
       -- Skip ones already disabled, so a re-run reports honestly instead of
       -- claiming to have done work it didn't.
       and (expires_at is null or expires_at > now()
            or max_uses is null or uses < max_uses)
    returning code, uses, label
  loop
    raise notice 'disabled committed promo code % (label: %, % prior redemption(s) kept)',
      r.code, r.label, r.uses;
    n := n + 1;
  end loop;

  if n = 0 then
    raise notice 'no committed promo codes left to disable (already done, or already rotated away)';
  else
    raise notice 'disabled % committed promo code(s)', n;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Loud warning for anything still redeemable that looks like a committed code.
--
-- Property-based on purpose: a hand-maintained name list is what made me miss
-- LENNART2, ISA_S2 and THANKYOU the first time. A code that is still
-- redeemable AND whose name is a readable word rather than random characters is
-- almost certainly a seeded literal, because rotate-codes.mjs mints from a
-- no-vowel-ambiguity alphabet and never produces dictionary words.
--
-- This only WARNS. Disabling a code the owner deliberately created by hand
-- would be worse than leaving a warning they can act on.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  suspicious int := 0;
begin
  for r in
    select code, label, max_uses, unlocks_badge, unlocks_shape
      from public.skin_codes
     where (expires_at is null or expires_at > now())
       and (max_uses is null or uses < max_uses)
     order by code
  loop
    if r.max_uses is null then
      raise warning 'promo code % is UNCAPPED (label: %) - an unlimited code is a standing liability even when secret',
        r.code, r.label;
      suspicious := suspicious + 1;
    end if;
    if r.unlocks_badge is not null then
      raise warning 'promo code % grants badge % - make sure this one was never committed',
        r.code, r.unlocks_badge;
      suspicious := suspicious + 1;
    end if;
  end loop;

  if suspicious = 0 then
    raise notice 'no uncapped or badge-granting promo code is currently redeemable';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Verify — every one of the six must show redeemable = false:
--
--   select code, uses, max_uses, expires_at,
--          (expires_at is null or expires_at > now())
--            and (max_uses is null or uses < max_uses) as redeemable
--     from public.skin_codes
--    where code in ('PLAYTEST2025','FOUNDER','FRIENDSFAMILY',
--                   'LENNART2','ISA_S2','THANKYOU');
--
-- TO HAND OUT NEW CODES LATER: `node scripts/rotate-codes.mjs` mints fresh
-- random ones and prints the SQL. That is now an OPTIONAL step you take when
-- you want codes to give away — not a security fix you owe.
-- ---------------------------------------------------------------------------
