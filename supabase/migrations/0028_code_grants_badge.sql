-- 0028_code_grants_badge.sql
-- Lets a redeem code also grant a profile BADGE (e.g. the "supporter" badge for
-- the Buy-Me-a-Coffee Glider tier). When a code's `unlocks_badge` is set, the
-- redeem-code edge function returns it and the client mirrors it into its local
-- badge-grant set so the gallery renders it. The redemption row in
-- `skin_code_redemptions` remains the server-side source of truth (a redeemed
-- supporter code == supporter status).
--
-- Apply via Supabase SQL Editor (paste this file, hit Run).

alter table public.skin_codes
  add column if not exists unlocks_badge text default null;

-- ---- Seed code -----------------------------------------------------------

-- THANKYOU — supporter tier: a warm "kraft + ink" livery that also grants the
-- supporter badge. Multi-use so it can be handed to BMC supporters.
insert into public.skin_codes
  (code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label, max_uses, unlocks_shape, unlocks_badge)
values
  ('THANKYOU', 214, 184, 122, 40, 30, 18, 'epic', 'supporter — thank you', 1000, null, 'supporter')
on conflict (code) do nothing;
