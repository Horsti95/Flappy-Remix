-- 0018: allow the mythic 'red' rarity on skins.
--
-- 'red' sits above legendary and is NEVER auto-classified (the client's
-- classifyRarity caps at legendary). It's granted by the dev / special events
-- only, e.g.:
--   update public.skins set rarity = 'red' where id = '<skin-uuid>';
-- so it stays prestigious and un-farmable. This just widens the CHECK so such
-- a grant is permitted. Re-runnable.

alter table public.skins drop constraint if exists skins_rarity_check;
alter table public.skins
  add constraint skins_rarity_check
  check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'red'));
