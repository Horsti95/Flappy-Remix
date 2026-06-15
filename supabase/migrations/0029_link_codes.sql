-- 0029_link_codes.sql
-- Emailless cross-device "link code". A signed-in device generates a short,
-- single-use code; another device enters it to adopt the SAME account (same
-- user_id → same profile, skins, streak), no email required.
--
-- Supabase has no emailless "mint a session for user X" admin API, so we relay
-- the originating device's session through a short-lived row: the generating
-- device stores its refresh token here keyed by the code; the redeeming device
-- exchanges the code for it and calls auth.setSession(). Safeguards:
--   * codes expire fast (the edge function sets ~10 min)
--   * single use (consumed_at stamped on redeem)
--   * service-role only — RLS denies all client access, so tokens are never
--     readable from the anon/auth client; only the edge function (service_role,
--     which bypasses RLS) reads/writes them.
-- The row holds a refresh token only briefly; a cleanup of expired rows can run
-- from the same edge function or a cron.
--
-- Apply via Supabase SQL Editor (paste this file, hit Run).

create table if not exists public.link_codes (
  code          text primary key,
  user_id       uuid not null references public.profiles(user_id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz default null
);

create index if not exists link_codes_user_idx on public.link_codes(user_id);
create index if not exists link_codes_expires_idx on public.link_codes(expires_at);

alter table public.link_codes enable row level security;

-- No client policies at all: every read/write goes through the edge function
-- with the service-role key (which bypasses RLS). This keeps refresh tokens
-- unreadable from any anon/auth client session.
revoke all on public.link_codes from anon, authenticated;
