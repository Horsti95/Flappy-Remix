# Ranked operations

## Season rotation

Seasons are calendar-month buckets. The first day of each month UTC,
call the rotation RPC:

```sql
select public.roll_season(to_char(now() at time zone 'utc', 'YYYY-MM'));
```

It runs under `security definer` and:

1. Inserts a row into `elo_season_snapshots` for every rated player in
   the current season with `rank = row_number() over (order by rating
   desc)`. Top-100 of this set keeps their badge forever.
2. Sets `ended_at = now()` on the current `seasons` row.
3. Inserts a new `seasons` row.
4. Carries every rated player into the new season at
   `round(1200 + (old_rating - 1200) * 0.25)` — a 75% pull back to the
   ELO midpoint. Early-season climbing matters again, but skilled
   players don't start from scratch.

### Schedule

Supabase Scheduled Functions / pg_cron, monthly at 00:00 UTC on the 1st:

```sql
select cron.schedule(
  'pflug-season-roll',
  '0 0 1 * *',
  $$ select public.roll_season() $$
);
```

If you don't have cron set up, this RPC is safe to call manually any
time — it just opens a new season early.

## Match expiry

`ranked_matches.expires_at` is set at create time to `now() + 3 days`
(24h per round × 3). The submit-run path returns `match_expired` and
refuses to record a score past that point. A future job can mark
expired matches as `state = 'expired'` and apply ELO based on whatever
rounds were played; for now they stay `in_progress` cosmetically until
both players agree to abandon (no UI for that yet).

## Cancellation / abuse

There is no cancel button in v1. If both players queue and one never
plays, the match expires after 72h with no ELO impact. Brigading via
many fast queue-join/leave cycles is mitigated by the matchmaking
endpoint being authenticated and idempotent (POST adds you to the
queue once, DELETE removes you, scanning is server-side only).
