-- Seed hossi95 with a score-100 run + the milestone skin unlocks.
--
-- Paste into the Supabase SQL Editor for the project behind the deployment you
-- want to seed, then Run. Safe to re-run: the run row dedupes on nothing (a
-- second run adds a harmless duplicate 100), and the skins dedupe on
-- (user_id, encoded_int) so they won't double up.
--
-- Notes:
--  * Milestone skins unlock by TOTAL GAMES PLAYED (thresholds 1/10/50/100),
--    not by score — so we also bump total_games to 100 so the gallery and
--    "what's next" reflect the unlocks as earned.
--  * In-game, each milestone skin's colours are derived deterministically from
--    the account id by a colour-science generator (LCH/CIEDE2000) that can't be
--    reproduced in plain SQL. The colours below are hand-picked, equally valid,
--    equippable rewards with the right rarity tiers.
--  * Achievement-colour unlocks (first flight, etc.) live in the browser's
--    localStorage, NOT the database — they can't be seeded from SQL. They light
--    up automatically the next time hossi95 plays on that device.

do $$
declare
  uid uuid;
  legendary_skin uuid;
begin
  select user_id into uid from public.profiles where username = 'hossi95';
  if uid is null then
    raise exception 'no profile with username hossi95 in this database';
  end if;

  -- 1) Leaderboard run of 100. Empty inputs => this manual row is never
  --    re-validated by replay.
  insert into public.runs (user_id, seed, score, ticks, inputs, inputs_count, mode, created_at)
  values (uid, 0, 100, 0, '[]'::jsonb, 0, 'casual', now());

  -- 2) Reflect "100 games played" so milestone unlocks read as earned.
  update public.profiles
     set total_games = greatest(total_games, 100)
   where user_id = uid;

  -- 3) Milestone skins at the 1 / 10 / 50 / 100 thresholds.
  --    encoded_int uses the same bit-packing the app does:
  --    r1<<40 | g1<<32 | b1<<24 | r2<<16 | g2<<8 | b2.
  insert into public.skins
    (user_id, body_r, body_g, body_b, accent_r, accent_g, accent_b, encoded_int, rarity, unlocked_at_games)
  values
    (uid, 38,166,154, 255,112,67,
       38::bigint*1099511627776 + 166*4294967296 + 154*16777216 + 255*65536 + 112*256 + 67,
       'uncommon', 1),
    (uid, 66,135,245, 245,200,66,
       66::bigint*1099511627776 + 135*4294967296 + 245*16777216 + 245*65536 + 200*256 + 66,
       'rare', 10),
    (uid, 171,71,188, 205,220,57,
       171::bigint*1099511627776 + 71*4294967296 + 188*16777216 + 205*65536 + 220*256 + 57,
       'epic', 50),
    (uid, 233,30,99, 0,229,255,
       233::bigint*1099511627776 + 30*4294967296 + 99*16777216 + 0*65536 + 229*256 + 255,
       'legendary', 100)
  on conflict (user_id, encoded_int) do nothing;

  -- 4) Equip the legendary one so it shows on the menu / share card.
  select id into legendary_skin from public.skins
   where user_id = uid and unlocked_at_games = 100
   order by unlocked_at desc limit 1;
  update public.profiles set equipped_skin_id = legendary_skin where user_id = uid;
end $$;
