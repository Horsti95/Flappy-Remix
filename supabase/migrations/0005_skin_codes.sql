-- 0005_skin_codes.sql
-- Code-redeemable skins. A small catalog of pre-defined RGB pairs that
-- can be unlocked by typing a redeem code in the account panel. Useful
-- for early playtesters, founders, IRL events, partner promotions, etc.
--
-- Apply via Supabase SQL editor (paste this file, hit Run).

create table public.skin_codes (
  code        text primary key,
  body_r      smallint not null check (body_r between 0 and 255),
  body_g      smallint not null check (body_g between 0 and 255),
  body_b      smallint not null check (body_b between 0 and 255),
  accent_r    smallint not null check (accent_r between 0 and 255),
  accent_g    smallint not null check (accent_g between 0 and 255),
  accent_b    smallint not null check (accent_b between 0 and 255),
  rarity      text not null check (rarity in ('common','uncommon','rare','epic','legendary')),
  label       text not null,
  max_uses    integer default null,
  uses        integer not null default 0,
  expires_at  timestamptz default null,
  created_at  timestamptz not null default now()
);

create table public.skin_code_redemptions (
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  code        text not null references public.skin_codes(code) on delete cascade,
  redeemed_at timestamptz not null default now(),
  skin_id     uuid not null references public.skins(id) on delete cascade,
  primary key (user_id, code)
);

create index skin_code_redemptions_user_idx on public.skin_code_redemptions(user_id);

alter table public.skin_codes enable row level security;
alter table public.skin_code_redemptions enable row level security;

-- Anyone can read the code catalog (for the label / rarity hints).
create policy "skin_codes_select_all"
  on public.skin_codes for select using (true);

-- Players see only their own redemption rows.
create policy "redemptions_self_select"
  on public.skin_code_redemptions for select using (auth.uid() = user_id);

-- All writes happen via the server (service_role) — no client RLS
-- policy granted for insert/update/delete. The API increments the
-- `uses` counter and inserts both the redemption row and the matching
-- per-user `skins` row in one transaction.

-- Seed codes. Edit the rows below — or insert your own afterwards via
-- the SQL editor — to mint codes for your playtesters and partners.
insert into public.skin_codes (code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label, max_uses) values
  ('PLAYTEST2025',  255, 215,   0,  100,  50, 200, 'legendary', 'early playtester', 100),
  ('FOUNDER',       200,  30, 100,  255, 215,   0, 'legendary', 'founder',           25),
  ('FRIENDSFAMILY', 100, 200, 255,  200, 100, 255, 'epic',      'friends & family', null);
