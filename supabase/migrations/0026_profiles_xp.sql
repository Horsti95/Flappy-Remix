-- 0026_profiles_xp.sql
--
-- Server-authoritative pilot XP mirror (client formula in src/game/xp.ts).
-- NOTE: this column is service-role-only WITHOUT any extra grant work —
-- 0023_profiles_lockdown.sql revoked blanket UPDATE on profiles and granted
-- only (username, equipped_skin_id, equipped_shape) back to authenticated,
-- so a new column is not client-updatable by default. Only api/submit-run.ts
-- (admin client) writes it.

alter table public.profiles
  add column if not exists xp integer not null default 0;

comment on column public.profiles.xp is
  'Server-authoritative total pilot XP. Service-role-only by virtue of the 0023 column-grant model (UPDATE is granted per-column to authenticated; xp is not in that list).';
