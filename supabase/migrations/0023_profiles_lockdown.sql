-- 0023_profiles_lockdown.sql
--
-- The old profiles_update_self policy let any signed-in client update EVERY
-- column of their own row — including total_games / streak_days (which the
-- server mints milestone skins from) and equipped_skin_id with no ownership
-- check (anyone could equip another player's rare). Lock it down:
--
--  1. Column privileges: clients may only update the three identity /
--     cosmetic columns. Progression counters become service-role-only.
--  2. A trigger enforces that equipped_skin_id references YOUR OWN skin
--     (applies to every role, incl. service code paths).
--  3. Usernames are permanent in v1 ("handles are permanent") — the trigger
--     also rejects changing a non-null username. Admin renames: disable the
--     trigger for the session, rename, re-enable.

-- 1. Column-level update privileges (RLS row check from 0001 still applies).
revoke update on table public.profiles from anon, authenticated;
grant update (username, equipped_skin_id, equipped_shape)
  on table public.profiles to authenticated;

-- 2 + 3. Ownership / immutability trigger.
create or replace function public.enforce_profile_invariants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.equipped_skin_id is not null
     and new.equipped_skin_id is distinct from old.equipped_skin_id then
    if not exists (
      select 1 from public.skins s
      where s.id = new.equipped_skin_id and s.user_id = new.user_id
    ) then
      raise exception 'equipped_skin_id must reference one of your own skins';
    end if;
  end if;

  if old.username is not null and new.username is distinct from old.username then
    raise exception 'username is permanent';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_invariants on public.profiles;
create trigger profiles_invariants
  before update on public.profiles
  for each row execute function public.enforce_profile_invariants();
