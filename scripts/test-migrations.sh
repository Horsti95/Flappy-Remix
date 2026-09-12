#!/usr/bin/env bash
# Apply every migration in supabase/migrations/ to a throwaway local Postgres
# and assert the security invariants. This is the DB-side integration test the
# unit suite can't cover (vitest never touches SQL).
#
#   ./scripts/test-migrations.sh
#
# Requires: postgresql-16 (or newer) client + server binaries. On Debian/Ubuntu:
#   apt-get install -y postgresql postgresql-client
#
# It never touches your real project. Everything happens in a temp cluster on
# port 55432 that is destroyed at the end.
set -euo pipefail

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
PORT=55432
PGD="${PGD:-/var/lib/postgresql/glide-migtest}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)
RUNAS=postgres
fails=0

cleanup() {
  su "$RUNAS" -s /bin/bash -c "PATH=$PGBIN:\$PATH pg_ctl -D $PGD stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$PGD" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> booting throwaway postgres on :$PORT"
rm -rf "$PGD"; mkdir -p "$(dirname "$PGD")"
chown "$RUNAS" "$(dirname "$PGD")" 2>/dev/null || true
su "$RUNAS" -s /bin/bash -c "PATH=$PGBIN:\$PATH initdb -D $PGD -U postgres --auth=trust" >/dev/null
su "$RUNAS" -s /bin/bash -c "PATH=$PGBIN:\$PATH pg_ctl -D $PGD -o '-p $PORT' -l $PGD/log start" >/dev/null
for _ in $(seq 1 30); do "${PSQL[@]}" -c 'select 1' >/dev/null 2>&1 && break; sleep 0.5; done

echo "==> scaffolding supabase-shaped roles + auth schema"
"${PSQL[@]}" -f "$HERE/scripts/sql/test-harness.sql"

echo "==> applying migrations"
for f in "$HERE"/supabase/migrations/0*.sql; do
  if out=$("${PSQL[@]}" -f "$f" 2>&1); then
    echo "    ok   $(basename "$f")"
  else
    echo "    FAIL $(basename "$f")"; echo "$out" | head -10; fails=$((fails+1))
  fi
done

# Supabase grants table DML to anon/authenticated by default and relies on RLS
# as the gate. Mirror that, so the RPC assertions below exercise privileges the
# same way production does.
"${PSQL[@]}" -c "
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;"

echo "==> asserting function privileges (migration 0031)"

# 1. No non-allowlisted public function may be executable by a client role.
leaks=$("${PSQL[@]}" -tAc "
  select p.proname || ' <- ' || r.rolname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  cross join lateral (values ('anon'),('authenticated')) as r(rolname)
  where n.nspname = 'public' and p.prokind = 'f' and d.objid is null
    and has_function_privilege(r.rolname, p.oid, 'execute')
    and p.proname not in (
      'add_friend_by_username','incoming_friend_requests','accept_friend_request',
      'decline_friend_request','remove_friend','inbox_incoming','inbox_outgoing',
      'inbox_unseen_count','inbox_mark_seen','decline_challenge',
      'friends_leaderboard','leaderboard_by','public_profile','current_season')
  order by 1;")
if [ -n "$leaks" ]; then
  echo "    FAIL client-executable functions leaked:"; echo "$leaks" | sed 's/^/      /'
  fails=$((fails+1))
else
  echo "    ok   no client-executable functions outside the allowlist"
fi

# 2. The two destructive RPCs must be unreachable from both client roles.
for fn in "roll_season('x')" "upsert_daily_seed('2030-01-01'::date, 1::bigint)"; do
  for role in anon authenticated; do
    if "${PSQL[@]}" -c "set role $role; select public.$fn;" >/dev/null 2>&1; then
      echo "    FAIL $role can still call $fn"; fails=$((fails+1))
    else
      echo "    ok   $role blocked from ${fn%%(*}"
    fi
  done
done

# 3. The client RPCs must still work, or we've shipped an outage.
while read -r role call; do
  if "${PSQL[@]}" -c "set role $role; select * from public.$call;" >/dev/null 2>&1; then
    echo "    ok   $role can call ${call%%(*}"
  else
    echo "    FAIL $role can NOT call ${call%%(*} (client would 404)"; fails=$((fails+1))
  fi
done <<'CALLS'
anon leaderboard_by('weekly','casual')
anon public_profile('nobody')
authenticated leaderboard_by('weekly','casual')
authenticated public_profile('nobody')
CALLS

# remove_friend must be reachable by a signed-in player (it is how the client
# severs a friendship) but must only ever touch pairs involving the caller.
if "${PSQL[@]}" -c "set role authenticated; select public.remove_friend('00000000-0000-0000-0000-000000000000');" >/dev/null 2>&1; then
  echo "    ok   authenticated can call remove_friend"
else
  echo "    FAIL authenticated can NOT call remove_friend"; fails=$((fails+1))
fi

echo "==> asserting data integrity (migration 0032: unique replay hash)"

UA=11111111-1111-1111-1111-111111111111
UB=22222222-2222-2222-2222-222222222222
"${PSQL[@]}" -c "
  insert into auth.users (id) values ('$UA'),('$UB') on conflict do nothing;
  insert into public.profiles (user_id) values ('$UA'),('$UB') on conflict do nothing;"

ins() { # ins <user> <seed> <hash-or-NULL>
  local h="$3"; [ "$h" = NULL ] && h=null || h="'$h'"
  "${PSQL[@]}" -c "insert into public.runs
    (user_id, seed, score, ticks, inputs, inputs_count, mode, inputs_hash)
    values ('$1', $2, 20, 500, '[]'::jsonb, 0, 'casual', $h);" >/dev/null 2>&1
}

if ins "$UA" 42 abc; then
  echo "    ok   original run with a hash inserts"
else
  echo "    FAIL could not insert the original run"; fails=$((fails+1))
fi

# The whole point: a second row with the same canonical replay hash — whoever
# submits it, and however the API's pre-check raced — must be rejected by the DB.
if ins "$UB" 42 abc; then
  echo "    FAIL a stolen replay hash was accepted (unique index missing)"; fails=$((fails+1))
else
  echo "    ok   duplicate replay hash rejected by the database"
fi

# Trivial runs carry a NULL hash and must stay insertable without limit.
if ins "$UA" 1 NULL && ins "$UA" 2 NULL; then
  echo "    ok   multiple NULL-hash runs still allowed"
else
  echo "    FAIL NULL-hash runs were blocked"; fails=$((fails+1))
fi

hashed=$("${PSQL[@]}" -tAc "select count(inputs_hash) from public.runs;")
if [ "$hashed" = "1" ]; then
  echo "    ok   exactly one hashed run survived"
else
  echo "    FAIL expected 1 hashed run, found $hashed"; fails=$((fails+1))
fi

echo "==> asserting atomicity under concurrency (migration 0033)"

# ---- promo code limit -------------------------------------------------------
# A 5-use code hit by 40 parallel claims must hand out exactly 5 uses. The old
# check-then-act in redeem-code.ts would over-issue here.
"${PSQL[@]}" -c "
  insert into public.skin_codes
    (code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label, max_uses)
  values ('CONCUR5', 1,2,3, 4,5,6, 'rare', 'concurrency test', 5)
  on conflict (code) do update set uses = 0, max_uses = 5;"

for _ in $(seq 1 40); do
  ( psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc \
      "select public.claim_code_use('CONCUR5');" >/dev/null 2>&1 ) &
done
wait

uses=$("${PSQL[@]}" -tAc "select uses from public.skin_codes where code='CONCUR5';")
if [ "$uses" = "5" ]; then
  echo "    ok   40 parallel claims on a 5-use code consumed exactly 5"
else
  echo "    FAIL 5-use code ended at uses=$uses (expected 5)"; fails=$((fails+1))
fi

granted=$("${PSQL[@]}" -tAc "select public.claim_code_use('CONCUR5');")
if [ "$granted" = "f" ]; then
  echo "    ok   a depleted code refuses further claims"
else
  echo "    FAIL depleted code still granted a use"; fails=$((fails+1))
fi

# ---- profile counters -------------------------------------------------------
# 50 parallel accepted runs must add exactly 50 games and 50*7 XP. The old
# read-compute-write lost increments here.
"${PSQL[@]}" -c "update public.profiles set total_games = 0, xp = 0 where user_id = '$UA';"
for _ in $(seq 1 50); do
  ( psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc \
      "select public.bump_profile_after_run('$UA', 7, 1, null, now());" >/dev/null 2>&1 ) &
done
wait

read -r games xp <<<"$("${PSQL[@]}" -tAc \
  "select total_games, xp from public.profiles where user_id='$UA';" | tr '|' ' ')"
if [ "$games" = "50" ] && [ "$xp" = "350" ]; then
  echo "    ok   50 parallel runs -> total_games=50, xp=350 (no lost updates)"
else
  echo "    FAIL expected games=50 xp=350, got games=$games xp=$xp"; fails=$((fails+1))
fi

# ---- RPC return shapes ------------------------------------------------------
# api/submit-run.ts reads total_games/xp back OUT of bump_profile_after_run and
# derives the milestone + level-up "before" values from them. If the function
# returned nothing usable it would silently fall back to stale local arithmetic,
# so assert the shape, not just the side effect.
"${PSQL[@]}" -c "update public.profiles set total_games = 10, xp = 100 where user_id = '$UA';"
read -r rg rx <<<"$("${PSQL[@]}" -tAc \
  "select total_games, xp from public.bump_profile_after_run('$UA', 5, 3, null, now());" | tr '|' ' ')"
if [ "$rg" = "11" ] && [ "$rx" = "105" ]; then
  echo "    ok   bump_profile_after_run returns the post-update row (11, 105)"
else
  echo "    FAIL bump_profile_after_run returned games=$rg xp=$rx (expected 11, 105)"; fails=$((fails+1))
fi

# ---- feedback rate limit ----------------------------------------------------
# Shared across instances and not raceable: the first call wins, the rest are
# refused until the cooldown elapses.
"${PSQL[@]}" -c "delete from public.feedback_rate_limit where user_id = '$UA';"
first=$("${PSQL[@]}" -tAc "select public.claim_feedback_slot('$UA');")
second=$("${PSQL[@]}" -tAc "select public.claim_feedback_slot('$UA');")
if [ "$first" = "t" ] && [ "$second" = "f" ]; then
  echo "    ok   feedback slot granted once, then refused within cooldown"
else
  echo "    FAIL feedback slot gave first=$first second=$second (expected t, f)"; fails=$((fails+1))
fi

# 30 parallel sends must yield exactly one grant.
"${PSQL[@]}" -c "delete from public.feedback_rate_limit where user_id = '$UB';"
tmp=$(mktemp)
for _ in $(seq 1 30); do
  ( psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc \
      "select public.claim_feedback_slot('$UB');" 2>/dev/null >>"$tmp" ) &
done
wait
grants=$(grep -c '^t$' "$tmp" || true); rm -f "$tmp"
if [ "$grants" = "1" ]; then
  echo "    ok   30 parallel feedback sends granted exactly 1"
else
  echo "    FAIL 30 parallel feedback sends granted $grants (expected 1)"; fails=$((fails+1))
fi

# A past cooldown must let the next one through.
"${PSQL[@]}" -c "update public.feedback_rate_limit set last_sent = now() - interval '11 minutes' where user_id = '$UA';"
after=$("${PSQL[@]}" -tAc "select public.claim_feedback_slot('$UA');")
if [ "$after" = "t" ]; then
  echo "    ok   slot granted again once the cooldown elapsed"
else
  echo "    FAIL slot still refused after the cooldown (got $after)"; fails=$((fails+1))
fi

# ---- run cosmetic ownership -------------------------------------------------
# A run may not claim a skin its owner doesn't hold; the trigger strips it
# rather than rejecting the (legitimate) score.
skin=$("${PSQL[@]}" -tAc "
  insert into public.skins (user_id, body_r, body_g, body_b, accent_r, accent_g, accent_b, encoded_int, rarity, unlocked_at_games)
  values ('$UB', 1,2,3, 4,5,6, 42, 'rare', 0) returning id;")
"${PSQL[@]}" -c "insert into public.runs
  (user_id, seed, score, ticks, inputs, inputs_count, mode, equipped_skin_id)
  values ('$UA', 99, 5, 100, '[]'::jsonb, 0, 'casual', '$skin');" >/dev/null 2>&1
stolen=$("${PSQL[@]}" -tAc "select coalesce(equipped_skin_id::text,'STRIPPED') from public.runs where seed = 99;")
if [ "$stolen" = "STRIPPED" ]; then
  echo "    ok   a run claiming another player's skin has it stripped"
else
  echo "    FAIL run kept a skin owned by someone else ($stolen)"; fails=$((fails+1))
fi

# ---- elo deltas -------------------------------------------------------------
# Two of a player's matches settling at once must apply BOTH deltas.
"${PSQL[@]}" -c "
  insert into public.seasons (id, started_at, name)
    values (9001, now(), 'concurrency')
    on conflict (id) do nothing;
  delete from public.elo_ratings where user_id in ('$UA','$UB');"
for d in 10 25; do
  ( psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc \
      "select public.settle_ranked_elo(9001,'$UA','$UB',$d,-$d,1200,1200,'a_win');" >/dev/null 2>&1 ) &
done
wait

read -r rating gp <<<"$("${PSQL[@]}" -tAc \
  "select rating, games_played from public.elo_ratings where user_id='$UA' and season_id=9001;" | tr '|' ' ')"
if [ "$rating" = "1235" ] && [ "$gp" = "2" ]; then
  echo "    ok   two concurrent settlements applied both deltas (1200+10+25=1235, 2 games)"
else
  echo "    FAIL expected rating=1235 games=2, got rating=$rating games=$gp"; fails=$((fails+1))
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "PASS — migrations apply cleanly and privilege invariants hold"
else
  echo "FAIL — $fails problem(s)"; exit 1
fi
