-- Challenges created from a daily run carry the day, so the ghost replays
-- (and the responder plays, and the validator replays) under that day's
-- twist physics instead of DEFAULT_CONFIG. Without this, daily-twist runs
-- shared as challenges desynced: the ghost died in the wrong place and the
-- challengee flew different physics than the creator.
alter table public.challenges add column if not exists daily_date date;
