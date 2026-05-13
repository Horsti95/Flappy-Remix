-- M3: daily seed metadata, streak tracking, friend code.

alter table public.profiles
  add column last_daily_play_at date,
  add column friend_code text unique;

create or replace function public.gen_friend_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_count int;
  attempts int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select count(*) into exists_count from public.profiles where friend_code = code;
    exit when exists_count = 0;
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'could not allocate friend code';
    end if;
  end loop;
  return code;
end;
$$;

-- Backfill any existing rows.
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;

-- Assign on insert.
create or replace function public.assign_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.gen_friend_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_friend_code on public.profiles;
create trigger profiles_assign_friend_code
  before insert on public.profiles
  for each row execute function public.assign_friend_code();

-- Daily plays_count increment helper (called from the submit-run
-- edge function under the service role so RLS doesn't block writes
-- to daily_seeds).
create or replace function public.upsert_daily_seed(d date, s bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.daily_seeds (date, seed, plays_count)
  values (d, s, 1)
  on conflict (date)
  do update set plays_count = public.daily_seeds.plays_count + 1;
$$;
