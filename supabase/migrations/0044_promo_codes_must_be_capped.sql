-- 0044_promo_codes_must_be_capped.sql
--
-- Makes "every promo code has a use cap" a DATABASE INVARIANT instead of a
-- thing we keep checking after the fact.
--
-- WHY NOW. The owner minted a code by hand in the live database and capped it
-- there (a direct data change, deliberately never committed — the code itself
-- is a secret and putting one in a migration is the exact mistake 0043 exists
-- to clean up). That cap is therefore data, not schema: it is correct right
-- now, but nothing in the repo says it has to be. Two ways it silently comes
-- undone:
--
--   1. An `update public.skin_codes set max_uses = null` — one keystroke in the
--      SQL editor, no error, and the code is unlimited again.
--   2. The next hand-minted code. 0005 declares `max_uses integer default
--      null`, so INSERTing without naming the column produces an UNCAPPED code
--      and the database is perfectly happy about it.
--
-- 0043 and scripts/apply-migrations.mjs already WARN about an uncapped live
-- code, but a warning is a thing someone has to read. This makes the database
-- refuse.
--
-- WHY A CAP MATTERS AT ALL: an uncapped code is unbounded even while it is
-- secret. One leak — a screenshot, a forwarded chat, a friend of a friend — and
-- there is no ceiling on the damage and no way to stop it except editing the
-- row. A capped code fails closed: the blast radius is the cap.
--
-- NOT VALID is load-bearing, not laziness. It means:
--   * every INSERT and UPDATE from here on is checked — the hole is closed;
--   * pre-existing rows are NOT touched, so this migration cannot silently
--     disable an uncapped code the owner created on purpose. Disabling
--     someone's live giveaway as a side effect of a schema migration would be
--     worse than the warning it replaces.
-- The VALIDATE below then promotes it to a fully valid constraint whenever the
-- existing rows already satisfy it — which, after 0043, they do.
--
-- Re-runnable. Apply via `supabase db push` or the Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.skin_codes'::regclass
       and conname  = 'skin_codes_max_uses_capped'
  ) then
    alter table public.skin_codes
      add constraint skin_codes_max_uses_capped
      check (max_uses is not null and max_uses >= 0)
      not valid;
    raise notice 'added constraint skin_codes_max_uses_capped (uncapped codes can no longer be created)';
  else
    raise notice 'constraint skin_codes_max_uses_capped already present';
  end if;
end
$$;

-- Remove the `default null` that makes an uncapped code the PATH OF LEAST
-- RESISTANCE. With no default, an INSERT that forgets max_uses still fails the
-- constraint above -- but the failure now reads as "you left out max_uses"
-- rather than "the default did something you didn't ask for".
alter table public.skin_codes alter column max_uses drop default;

-- Promote to a fully valid constraint if the existing rows allow it. After 0043
-- they do: every seeded literal was set to max_uses = uses (uses is NOT NULL
-- default 0, so never null). Wrapped because a legacy uncapped row must leave a
-- loud warning, not abort the migration run -- the INSERT/UPDATE half is
-- already enforcing by this point, which is the part that closes the hole.
do $$
begin
  alter table public.skin_codes validate constraint skin_codes_max_uses_capped;
  raise notice 'constraint validated - no uncapped promo code exists';
exception when check_violation then
  raise warning 'constraint NOT validated: at least one EXISTING promo code is uncapped.';
  raise warning 'new codes are already blocked. to finish, cap the offenders:';
  raise warning '  select code, label, uses from public.skin_codes where max_uses is null;';
  raise warning '  -- then either cap it:     update public.skin_codes set max_uses = <n> where code = ''...'';';
  raise warning '  -- or retire it entirely:  update public.skin_codes set max_uses = uses, expires_at = now() where code = ''...'';';
  raise warning 'then re-run this migration to validate.';
end
$$;

-- ---------------------------------------------------------------------------
-- Verify:
--
--   -- must be true (t) once the rows are clean:
--   select convalidated from pg_constraint
--    where conrelid = 'public.skin_codes'::regclass
--      and conname  = 'skin_codes_max_uses_capped';
--
--   -- must FAIL with "violates check constraint":
--   insert into public.skin_codes
--     (code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label)
--   values ('SHOULDFAIL', 1,2,3, 4,5,6, 'rare', 'uncapped');
--
-- NOTE FOR FUTURE CODES: keep minting them by hand or with
-- `node scripts/rotate-codes.mjs` (which never emits max_uses = null) and keep
-- them OUT of the repo. This migration guarantees the shape of a code, never
-- its value -- a code's value is a secret and belongs nowhere in git.
-- ---------------------------------------------------------------------------
