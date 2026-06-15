-- ───────────────────────────────────────────────────────────────────────────
-- Skins diagnostic — why some skins won't equip.
--
-- Run in the Supabase SQL Editor. Read-only (no writes). Default account is
-- 'hossi95'; change the username in the `me` CTE if needed.
--
-- Theory under test: the gallery shows skins from a stale localStorage cache
-- (pflug.ownedSkins.cache.v1) that includes ids deleted/re-pointed by the
-- account merge. Those ids aren't owned by you anymore, so the equip is
-- rejected by the 0023 ownership trigger and silently reverts to default —
-- while genuinely-owned rows below still equip.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Headline: counts + is the currently-equipped skin actually owned?
with me as (
  select user_id, username, equipped_skin_id
  from public.profiles where username = 'hossi95'
)
select 'owned_skins (server truth)' as metric,
       (select count(*)::text from public.skins s, me where s.user_id = me.user_id) as value
union all
select 'distinct colours by encoded_int',
       (select count(distinct s.encoded_int)::text from public.skins s, me where s.user_id = me.user_id)
union all
select 'distinct colours by RGB',
       (select count(distinct (s.body_r,s.body_g,s.body_b,s.accent_r,s.accent_g,s.accent_b))::text
        from public.skins s, me where s.user_id = me.user_id)
union all
select 'equipped_skin_id', (select coalesce(equipped_skin_id::text,'(none)') from me)
union all
select 'equipped skin is owned by you?',
       (select case
          when (select equipped_skin_id from me) is null then 'n/a (none equipped)'
          when exists (select 1 from public.skins s, me
                       where s.id = me.equipped_skin_id and s.user_id = me.user_id) then 'yes'
          else 'NO — trigger would reject; shows as default' end);

-- 2) Colours that appear MORE THAN ONCE (DB is unique by encoded_int, so any
--    RGB duplicate means two distinct encoded_int rows for the "same" colour —
--    these are what the gallery RGB de-dup collapses, and a prime suspect).
with me as (select user_id from public.profiles where username = 'hossi95')
select s.body_r, s.body_g, s.body_b, s.accent_r, s.accent_g, s.accent_b,
       count(*) as row_count,
       array_agg(s.id order by s.unlocked_at_games) as skin_ids,
       array_agg(s.encoded_int order by s.unlocked_at_games) as encoded_ints,
       array_agg(s.unlocked_at_games order by s.unlocked_at_games) as at_games
from public.skins s, me
where s.user_id = me.user_id
group by 1,2,3,4,5,6
having count(*) > 1
order by row_count desc;

-- 3) Full owned list in the gallery's display order (rarity desc, games desc).
--    Compare these ids against the browser-console cache dump (see chat) —
--    any cached id NOT in this list is a phantom card that can't be equipped.
with me as (select user_id from public.profiles where username = 'hossi95')
select s.id,
       s.rarity,
       s.unlocked_at_games as at_games,
       format('rgb(%s,%s,%s) / rgb(%s,%s,%s)',
              s.body_r, s.body_g, s.body_b, s.accent_r, s.accent_g, s.accent_b) as colours,
       s.encoded_int
from public.skins s, me
where s.user_id = me.user_id
order by array_position(array['red','legendary','epic','rare','uncommon','common']::text[], s.rarity),
         s.unlocked_at_games desc;

-- 4) Orphan check: any skin whose owner no longer exists as a profile (would
--    indicate an incomplete merge / dangling rows). Expect zero.
select s.id, s.user_id, s.rarity, s.unlocked_at_games
from public.skins s
left join public.profiles p on p.user_id = s.user_id
where p.user_id is null
order by s.unlocked_at_games;
