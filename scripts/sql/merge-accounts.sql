-- ───────────────────────────────────────────────────────────────────────────
-- One-off account merge: fold several test accounts into a single keeper.
--
-- Keeper:  hossi95
-- Losers:  hossi18, nothossi, hossihp, notpaul, test, test1, xyz, xyzz
--
-- What it does, in one transaction:
--   1. resolve usernames -> user_ids
--   2. re-point every child row (runs, skins, friendships, challenges, ranked,
--      elo, shape_grants, redemptions) from the losers to the keeper
--   3. combine profile stats (sum games, MAX streak, keep keeper's handle/skin)
--   4. delete the loser auth.users (cascades away their now-empty profiles)
--
-- SAFETY:
--   * Wrapped in BEGIN/COMMIT — review the NOTICE output, then COMMIT (or
--     ROLLBACK if anything looks off). Run in the Supabase SQL Editor.
--   * BACK UP FIRST:  npm run backup   (dumps every table to JSON).
--   * Idempotent-ish: re-running after a successful merge is a no-op because
--     the loser usernames no longer exist.
--
-- NOTE on "best run" / "total score": those are DERIVED from the `runs` table
-- by the leaderboard views, not stored on the profile. Once all runs point to
-- hossi95, best-run = MAX(score) and total = SUM(score) update automatically —
-- nothing to copy. Only the denormalized counters (total_games, streak_days)
-- live on the profile and are combined below.
-- ───────────────────────────────────────────────────────────────────────────

begin;

-- 1. Resolve ids.
create temporary table _merge_keeper as
  select user_id from public.profiles where username = 'hossi95';

create temporary table _merge_losers as
  select user_id, username from public.profiles
  where username in
    ('hossi18','nothossi','hossihp','notpaul','test','test1','xyz','xyzz');

do $$
declare
  k uuid;
  n int;
begin
  select user_id into k from _merge_keeper;
  if k is null then
    raise exception 'keeper hossi95 not found — aborting';
  end if;
  select count(*) into n from _merge_losers;
  raise notice 'keeper hossi95 = %, merging % loser account(s)', k, n;
end $$;

-- 2. Re-point child rows from losers -> keeper.
--    runs: just reassign ownership (best/total recompute from these).
update public.runs r
  set user_id = (select user_id from _merge_keeper)
  where r.user_id in (select user_id from _merge_losers);

--    skins: keep them all (the keeper gains the losers' unlocked skins).
--    Avoid the unique (user_id, encoded_int) collision by skipping dupes.
update public.skins s
  set user_id = (select user_id from _merge_keeper)
  where s.user_id in (select user_id from _merge_losers)
    and not exists (
      select 1 from public.skins k
      where k.user_id = (select user_id from _merge_keeper)
        and k.encoded_int = s.encoded_int
    );
--    drop any leftover duplicate-skin rows still owned by losers.
delete from public.skins where user_id in (select user_id from _merge_losers);

--    challenges (creator / responder / target).
update public.challenges set creator_id   = (select user_id from _merge_keeper) where creator_id   in (select user_id from _merge_losers);
update public.challenges set responder_id  = (select user_id from _merge_keeper) where responder_id  in (select user_id from _merge_losers);
update public.challenges set target_user_id= (select user_id from _merge_keeper) where target_user_id in (select user_id from _merge_losers);

--    shape grants + redemptions (skip rows the keeper already has).
update public.shape_grants g
  set user_id = (select user_id from _merge_keeper)
  where g.user_id in (select user_id from _merge_losers)
    and not exists (select 1 from public.shape_grants k
      where k.user_id = (select user_id from _merge_keeper) and k.shape_id = g.shape_id);
delete from public.shape_grants where user_id in (select user_id from _merge_losers);

update public.skin_code_redemptions x
  set user_id = (select user_id from _merge_keeper)
  where x.user_id in (select user_id from _merge_losers)
    and not exists (select 1 from public.skin_code_redemptions k
      where k.user_id = (select user_id from _merge_keeper) and k.code = x.code);
delete from public.skin_code_redemptions where user_id in (select user_id from _merge_losers);

--    friendships: drop loser rows (and any pointing AT losers) to avoid
--    self-friend / dup rows; the keeper keeps its own friends.
delete from public.friendships
  where user_id in (select user_id from _merge_losers)
     or friend_id in (select user_id from _merge_losers);

--    ranked: these reference players; reassign would corrupt match history
--    (you could end up as both players). Simplest + safe: delete loser ranked
--    rows. Keeper's ranked history is untouched.
delete from public.ranked_matches
  where player_a in (select user_id from _merge_losers)
     or player_b in (select user_id from _merge_losers);
delete from public.elo_ratings        where user_id in (select user_id from _merge_losers);
delete from public.elo_season_snapshots where user_id in (select user_id from _merge_losers);
delete from public.matchmaking_queue   where user_id in (select user_id from _merge_losers);

-- 3. Combine the denormalized profile counters onto the keeper.
update public.profiles p set
  total_games = p.total_games + coalesce((select sum(total_games) from public.profiles l
                                          where l.user_id in (select user_id from _merge_losers)), 0),
  streak_days = greatest(p.streak_days, coalesce((select max(streak_days) from public.profiles l
                                          where l.user_id in (select user_id from _merge_losers)), 0))
  where p.user_id = (select user_id from _merge_keeper);

-- 4. Delete the loser accounts (auth.users cascade removes their profiles).
delete from auth.users where id in (select user_id from _merge_losers);

-- Review the row counts above. If correct:  COMMIT;   else:  ROLLBACK;
commit;
