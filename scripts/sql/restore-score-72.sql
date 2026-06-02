-- Restore a lost high score for hossi95.
--
-- An account holding a 72 was deleted; this re-inserts a casual run of 72 for
-- hossi95 so the leaderboard best-run reflects it again. The leaderboard views
-- read MAX(score) from `runs`, so a single row is enough — no profile edit.
--
-- `inputs` is required + non-null; we store an empty array (this run is a
-- manual restore, not a replay, so it won't be re-validated).
--
-- Run in the Supabase SQL Editor. Safe to run once; re-running adds another
-- identical 72 row (harmless for "best", but avoid spamming).

insert into public.runs (user_id, seed, score, ticks, inputs, inputs_count, mode, created_at)
select p.user_id, 0, 72, 0, '[]'::jsonb, 0, 'casual', now()
from public.profiles p
where p.username = 'hossi95';
