-- 0006_shape_grants.sql
-- Lets a redeem code grant a shape (not just a colour skin). When
-- a code's `unlocks_shape` is set, the redemption inserts a row into
-- `shape_grants` for the redeeming user. The client merges these
-- grants into the shape-unlock check so granted shapes are always
-- selectable regardless of stat thresholds.
--
-- Also includes seed inserts:
--   * LENNART2  — re-issue of the LENNART skin (pink + ink) for the
--                 production anon account that didn't share the
--                 original redemption.
--   * ISA_S2    — purple/pink/white legendary skin that also grants
--                 the butterfly shape. 1-use.
--
-- Apply via Supabase SQL Editor (paste this file, hit Run).

alter table public.skin_codes
  add column if not exists unlocks_shape text default null;

create table if not exists public.shape_grants (
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  shape_id   text not null,
  source     text not null default 'code',
  granted_at timestamptz not null default now(),
  primary key (user_id, shape_id)
);

create index if not exists shape_grants_user_idx on public.shape_grants(user_id);

alter table public.shape_grants enable row level security;

-- Players see only their own grants. Inserts are server-only via the
-- redeem-code edge function (service_role bypasses RLS).
drop policy if exists "shape_grants_self_select" on public.shape_grants;
create policy "shape_grants_self_select"
  on public.shape_grants for select using (auth.uid() = user_id);

-- ---- Seed codes ----------------------------------------------------------

-- LENNART2 — same palette as the original LENNART code.
insert into public.skin_codes (code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label, max_uses, unlocks_shape)
values ('LENNART2', 255, 100, 200, 30, 30, 30, 'legendary', 'lennart re-issue', 1, null)
on conflict (code) do nothing;

-- ISA_S2 — purple/pink/white legendary, also grants the butterfly shape.
insert into public.skin_codes (code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label, max_uses, unlocks_shape)
values ('ISA_S2', 200, 130, 255, 255, 105, 200, 'legendary', 'isa s2', 1, 'butterfly')
on conflict (code) do nothing;
