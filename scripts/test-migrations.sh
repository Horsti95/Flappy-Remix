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

# Fixed test identities, used by several assertion blocks. Defined up here
# because the blocks run in file order and `set -u` turns a forward reference
# into an abort rather than an empty string.
UA=11111111-1111-1111-1111-111111111111
UB=22222222-2222-2222-2222-222222222222
# Dedicated identity for the client-RPC calls. It claims a username, and 0023
# makes usernames PERMANENT — reusing $UA here broke the later ghost assertion,
# which needs to claim a different one.
URPC=66666666-6666-6666-6666-666666666666
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

# NOTE: the harness lives in scripts/, NOT scripts/sql/ — that directory is
# gitignored (it holds one-off operational SQL naming real handles), so a
# harness kept there is absent from every fresh clone and this script fails
# in CI while passing locally. It did, once.
echo "==> scaffolding supabase-shaped roles + auth schema"
"${PSQL[@]}" -f "$HERE/scripts/migration-test-harness.sql"

echo "==> applying migrations"
for f in "$HERE"/supabase/migrations/0*.sql; do
  if out=$("${PSQL[@]}" -f "$f" 2>&1); then
    echo "    ok   $(basename "$f")"
  else
    echo "    FAIL $(basename "$f")"; echo "$out" | head -10; fails=$((fails+1))
  fi
done

# NOTE: the client-role table grants are set up in scripts/sql/test-harness.sql
# via ALTER DEFAULT PRIVILEGES, BEFORE the migrations run — the way Supabase
# actually does it. Do not re-grant them here: a blanket grant after the
# migrations would undo any column-level revoke a migration performs (0036),
# and the privacy assertions would pass or fail for the wrong reason.

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
      'friends_leaderboard','leaderboard_by','public_profile','best_run_ghost',
      'current_season')
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

echo "==> asserting per-role access on the client RPCs (migration 0041)"

# THE GAP THIS CLOSES: the leak check above excludes the whole allowlist from
# scrutiny, so it asked "is any NON-allowlisted function client-executable?"
# and never "are the allowlisted ones reachable by the RIGHT role?". 0031's
# allowlist branch only GRANTED and never revoked the PUBLIC default, so all 12
# per-caller RPCs stayed executable by `anon` and no test noticed.
for fn in add_friend_by_username incoming_friend_requests accept_friend_request \
          decline_friend_request remove_friend inbox_incoming inbox_outgoing \
          inbox_unseen_count inbox_mark_seen decline_challenge friends_leaderboard; do
  read -r a u <<<"$("${PSQL[@]}" -tAc "
    select coalesce(bool_or(has_function_privilege('anon', p.oid,'execute')),false)::text
           || ' ' ||
           coalesce(bool_or(has_function_privilege('authenticated', p.oid,'execute')),false)::text
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='$fn';")"
  if [ "$a" = "false" ] && [ "$u" = "true" ]; then
    echo "    ok   $fn: authenticated yes, anon no"
  else
    echo "    FAIL $fn: anon=$a authenticated=$u (want false/true)"; fails=$((fails+1))
  fi
done

# The deliberately-public ones must STAY public — they feed the OG/share renderer.
for fn in public_profile leaderboard_by best_run_ghost current_season; do
  a=$("${PSQL[@]}" -tAc "
    select coalesce(bool_or(has_function_privilege('anon', p.oid,'execute')),false)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='$fn';")
  if [ "$a" = "t" ]; then echo "    ok   $fn stays anon-readable (by design)"
  else echo "    FAIL $fn lost anon access — share links would break"; fails=$((fails+1)); fi
done

# ---------------------------------------------------------------------------
# And CALL every client RPC with a real auth.uid(). Checking a privilege bit is
# not the same as checking the function works: friends_leaderboard had been
# raising "column reference user_id is ambiguous" for EVERY caller since 0013,
# because its RETURNS TABLE declares an OUT column named user_id that collides
# with friendships.user_id in the body. It is plpgsql, so the ambiguity only
# surfaces at CALL time — a privilege check would never have found it.
# ---------------------------------------------------------------------------
"${PSQL[@]}" -c "
  insert into auth.users (id) values ('$URPC'),('$UB') on conflict (id) do nothing;
  insert into public.profiles (user_id) values ('$URPC'),('$UB')
    on conflict (user_id) do nothing;
  update public.profiles set username = 'rpcuser'
    where user_id = '$URPC' and username is null;" >/dev/null 2>&1

while read -r call; do
  # `|| true` matters: under `set -euo pipefail` a grep that finds nothing
  # exits 1 — which is the PASSING case here — and would abort the whole script
  # mid-suite while still letting an outer pipe report success. It did.
  err=$("${PSQL[@]}" -c "set role authenticated;
        set request.jwt.claim.sub = '$URPC';
        select * from public.$call;" 2>&1 | grep -i "^ERROR" | head -1 || true)
  if [ -z "$err" ]; then
    echo "    ok   ${call%%(*}() executes for a signed-in caller"
  else
    echo "    FAIL ${call%%(*}() errors for a signed-in caller: $(echo "$err" | cut -c1-70)"
    fails=$((fails+1))
  fi
done <<CALLS
add_friend_by_username('nobody')
incoming_friend_requests()
accept_friend_request('$UB'::uuid)
decline_friend_request('$UB'::uuid)
remove_friend('$UB'::uuid)
inbox_incoming()
inbox_outgoing()
inbox_unseen_count()
inbox_mark_seen()
decline_challenge('nope')
friends_leaderboard('weekly','casual')
leaderboard_by('weekly','casual')
public_profile('rpcuser')
best_run_ghost('rpcuser')
current_season()
CALLS

# The leaderboard views must respect the caller (0041), so a future column
# revoke on runs applies through them instead of silently not.
noninv=$("${PSQL[@]}" -tAc "
  select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public' and c.relkind='v'
    and not coalesce(array_to_string(c.reloptions,',') like '%security_invoker=true%', false);")
if [ -z "$noninv" ]; then
  echo "    ok   every leaderboard view is security_invoker"
else
  echo "    FAIL views still run as owner: $noninv"; fails=$((fails+1))
fi

echo "==> asserting search_path hardening (migration 0040)"

# No SECURITY DEFINER function may have a MUTABLE (unset) search_path — that is
# the real vulnerability, and it must hold for every function, old or new.
mutable=$("${PSQL[@]}" -tAc "
  select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and p.prosecdef and d.objid is null
    and p.proconfig is null;")
if [ -z "$mutable" ]; then
  echo "    ok   no SECURITY DEFINER function has a mutable search_path"
else
  echo "    FAIL mutable search_path on: $mutable"; fails=$((fails+1))
fi

# The functions 0040 hardens must actually be on the empty search_path.
for fn in bump_profile_after_run settle_ranked_elo _apply_elo_row claim_code_use \
          release_code_use remove_friend enforce_run_skin_ownership \
          purge_link_codes claim_feedback_slot cleanup_stale_anonymous_users \
          find_account_by_reference best_run_ghost submit_run_tx; do
  cfg=$("${PSQL[@]}" -tAc "
    select coalesce(array_to_string(p.proconfig, ','), 'NONE')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='$fn' limit 1;")
  case "$cfg" in
    *"search_path="*) echo "    ok   $fn -> $cfg" ;;
    *) echo "    FAIL $fn search_path config: $cfg"; fails=$((fails+1)) ;;
  esac
done

# The two functions that had no direct coverage — if a body reference were
# unqualified, search_path='' makes it fail HERE instead of in production.
if "${PSQL[@]}" -c "set role service_role; select public.release_code_use('CONCUR5');" >/dev/null 2>&1; then
  echo "    ok   release_code_use executes under the empty search_path"
else
  echo "    FAIL release_code_use broke under search_path='' (unqualified reference?)"; fails=$((fails+1))
fi
if "${PSQL[@]}" -c "set role service_role; select public.purge_link_codes();" >/dev/null 2>&1; then
  echo "    ok   purge_link_codes executes under the empty search_path"
else
  echo "    FAIL purge_link_codes broke under search_path='' (unqualified reference?)"; fails=$((fails+1))
fi

echo "==> asserting service_role access (migration 0037)"

# THE GAP THIS CLOSES: the suite previously only asserted the NEGATIVE (anon and
# authenticated are blocked) and the client-RPC positive. It never checked that
# the SERVER can still call the functions api/* depends on. Since service_role
# is not a superuser and not a member of the function owner, a revoke that
# caught it would have been invisible here -- and the failure in production is
# quiet: submit-run only logs the error and falls back to local arithmetic for
# the response, so players would see correct numbers while nothing persisted.
for fn in upsert_daily_seed bump_profile_after_run settle_ranked_elo \
          _apply_elo_row claim_code_use release_code_use claim_feedback_slot \
          purge_link_codes submit_run_tx; do
  has=$("${PSQL[@]}" -tAc "
    select coalesce(bool_or(has_function_privilege('service_role', p.oid, 'execute')), false)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '$fn';")
  if [ "$has" = "t" ]; then
    echo "    ok   service_role can execute $fn"
  else
    echo "    FAIL service_role CANNOT execute $fn (api/* would break silently)"; fails=$((fails+1))
  fi
done

# And the pairing that matters: server yes, client no, on the same function.
svc=$("${PSQL[@]}" -tAc "select has_function_privilege('service_role','public.bump_profile_after_run(uuid,integer,integer,timestamptz,timestamptz)','execute');")
cli=$("${PSQL[@]}" -tAc "select has_function_privilege('authenticated','public.bump_profile_after_run(uuid,integer,integer,timestamptz,timestamptz)','execute');")
if [ "$svc" = "t" ] && [ "$cli" = "f" ]; then
  echo "    ok   bump_profile_after_run: server yes, client no"
else
  echo "    FAIL bump_profile_after_run svc=$svc client=$cli (want t/f)"; fails=$((fails+1))
fi

# service_role must also keep full table access despite 0036's column revoke.
if "${PSQL[@]}" -c "set role service_role; select inputs from public.runs limit 1;" >/dev/null 2>&1; then
  echo "    ok   service_role still reads runs.inputs (needed by me-export/me-delete)"
else
  echo "    FAIL 0036's column revoke also caught service_role"; fails=$((fails+1))
fi

echo "==> asserting data integrity (migration 0032: unique replay hash)"

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

echo "==> asserting run-input privacy (migration 0036)"

# Bulk harvesting the per-tick trace must be denied for both client roles...
for role in anon authenticated; do
  if "${PSQL[@]}" -c "set role $role; select inputs from public.runs limit 1;" >/dev/null 2>&1; then
    echo "    FAIL $role can still bulk-read runs.inputs"; fails=$((fails+1))
  else
    echo "    ok   $role denied bulk access to runs.inputs"
  fi
done

# ...while everything leaderboards and profiles actually select stays readable.
for role in anon authenticated; do
  if "${PSQL[@]}" -c "set role $role; select id, user_id, seed, score, ticks, mode, daily_date, created_at, equipped_skin_id, shape from public.runs limit 1;" >/dev/null 2>&1; then
    echo "    ok   $role can still read run scores/metadata"
  else
    echo "    FAIL $role lost access to run columns leaderboards need"; fails=$((fails+1))
  fi
done

# The one legitimate ghost path still returns inputs, for one named player.
"${PSQL[@]}" -c "
  update public.profiles set username = 'ghosty' where user_id = '$UA';
  insert into public.runs (user_id, seed, score, ticks, inputs, inputs_count, mode)
    values ('$UA', 555, 99, 1200, '[{\"tick\":5,\"action\":\"flap\"}]'::jsonb, 1, 'casual');" >/dev/null 2>&1
ghost=$("${PSQL[@]}" -tAc "set role anon; select score from public.best_run_ghost('ghosty');")
if [ "$ghost" = "99" ]; then
  echo "    ok   best_run_ghost still serves the duel-their-best feature"
else
  echo "    FAIL best_run_ghost returned '$ghost' (expected 99)"; fails=$((fails+1))
fi
ghostin=$("${PSQL[@]}" -tAc "set role anon; select jsonb_array_length(inputs) from public.best_run_ghost('ghosty');")
if [ "$ghostin" = "1" ]; then
  echo "    ok   best_run_ghost returns the inputs the ghost needs"
else
  echo "    FAIL best_run_ghost inputs length '$ghostin' (expected 1)"; fails=$((fails+1))
fi

echo "==> asserting submit_run_tx atomicity (migration 0039)"

UE=55555555-5555-5555-5555-555555555555
"${PSQL[@]}" -c "
  insert into auth.users (id) values ('$UE') on conflict (id) do nothing;
  insert into public.profiles (user_id) values ('$UE') on conflict (user_id) do nothing;
  update public.profiles set total_games = 0, xp = 0 where user_id = '$UE';
  delete from public.runs where user_id = '$UE';
  delete from public.daily_seeds where date = '2026-09-20';"

XPM='{"daily_pb":80,"daily_nopb":30,"casual_pb":55,"casual_nopb":5}'

# 12 DAILY submissions fired at once. The cap is 3. Before 0039 each request
# read the count before any of them had inserted, so all 12 counted as daily.
for i in $(seq 1 12); do
  ( psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc "
      select accepted, effective_mode, daily_over_cap from public.submit_run_tx(
        '$UE'::uuid, 4242::bigint, 20, 500, '[]'::jsonb, 0, 'hash-daily-$i',
        'daily', '2026-09-20'::date, null, null,
        null,null,null,null,null,null,
        '$XPM'::jsonb, 1, now(), 3, 4242::bigint);" >/dev/null 2>&1 ) &
done
wait

daily_rows=$("${PSQL[@]}" -tAc "select count(*) from public.runs where user_id='$UE' and mode='daily';")
casual_rows=$("${PSQL[@]}" -tAc "select count(*) from public.runs where user_id='$UE' and mode='casual';")
total_rows=$("${PSQL[@]}" -tAc "select count(*) from public.runs where user_id='$UE';")

if [ "$daily_rows" = "3" ]; then
  echo "    ok   12 parallel daily submits produced exactly 3 daily runs (cap held)"
else
  echo "    FAIL daily cap leaked: $daily_rows daily rows (expected 3)"; fails=$((fails+1))
fi
if [ "$casual_rows" = "9" ] && [ "$total_rows" = "12" ]; then
  echo "    ok   the other 9 were demoted to casual, none lost"
else
  echo "    FAIL expected 9 casual / 12 total, got $casual_rows / $total_rows"; fails=$((fails+1))
fi

# Counters must match the rows exactly — insert and bump are one transaction.
read -r g x <<<"$("${PSQL[@]}" -tAc "select total_games, xp from public.profiles where user_id='$UE';" | tr '|' ' ')"
if [ "$g" = "12" ]; then
  echo "    ok   total_games == rows inserted (12), no lost update"
else
  echo "    FAIL total_games=$g but 12 runs exist (insert/bump not atomic)"; fails=$((fails+1))
fi

# Exactly ONE run may claim the personal-best bonus. All 12 have the same
# score, the 3 that fit under the cap commit first (they are the ones that saw
# room), and whichever of those commits first is the PB. So the XP total is
# fully determined:
#     1 x daily_pb    (80)
#   + 2 x daily_nopb  (30 each)
#   + 9 x casual_nopb ( 5 each)  = 185
# Pre-0039 several runs could each claim the +50 PB bonus, pushing this higher.
EXPECTED_XP=185
if [ "$x" = "$EXPECTED_XP" ]; then
  echo "    ok   xp total is exactly $EXPECTED_XP — one PB bonus, paid once"
else
  echo "    FAIL xp total $x, expected $EXPECTED_XP (a duplicated PB bonus reads high)"; fails=$((fails+1))
fi

# daily_seeds.plays_count must count only the runs that actually counted.
plays=$("${PSQL[@]}" -tAc "select coalesce(plays_count,0) from public.daily_seeds where date='2026-09-20';")
if [ "$plays" = "3" ]; then
  echo "    ok   daily plays_count == 3, matching the capped runs"
else
  echo "    FAIL daily plays_count=$plays (expected 3)"; fails=$((fails+1))
fi

# A repeated replay hash must be refused with the right reason, not a 500.
r1=$("${PSQL[@]}" -tAc "
  select reason from public.submit_run_tx('$UE'::uuid, 9::bigint, 30, 600, '[]'::jsonb, 0,
    'hash-daily-1', 'casual', null, null, null, null,null,null,null,null,null,
    '$XPM'::jsonb, 1, now(), 3, null);")
if [ "$r1" = "duplicate_run" ]; then
  echo "    ok   resubmitting your own replay hash -> duplicate_run"
else
  echo "    FAIL expected duplicate_run, got '$r1'"; fails=$((fails+1))
fi
r2=$("${PSQL[@]}" -tAc "
  select reason from public.submit_run_tx('$UA'::uuid, 9::bigint, 30, 600, '[]'::jsonb, 0,
    'hash-daily-1', 'casual', null, null, null, null,null,null,null,null,null,
    '$XPM'::jsonb, 1, now(), 3, null);")
if [ "$r2" = "replay_theft" ]; then
  echo "    ok   another player submitting the same hash -> replay_theft"
else
  echo "    FAIL expected replay_theft, got '$r2'"; fails=$((fails+1))
fi

echo "==> asserting challenge-input privacy (migration 0038)"

for role in anon authenticated; do
  if "${PSQL[@]}" -c "set role $role; select inputs from public.challenges limit 1;" >/dev/null 2>&1; then
    echo "    FAIL $role can still bulk-read challenges.inputs"; fails=$((fails+1))
  else
    echo "    ok   $role denied bulk access to challenges.inputs"
  fi
done

# What the client actually selects from this table must keep working.
for role in anon authenticated; do
  if "${PSQL[@]}" -c "set role $role; select short_id, creator_score, responder_score, status, daily_date from public.challenges limit 1;" >/dev/null 2>&1; then
    echo "    ok   $role can still read challenge scores/metadata"
  else
    echo "    FAIL $role lost challenge columns the client needs"; fails=$((fails+1))
  fi
done

# api/challenge.ts serves the ghost with the service key — must be unaffected.
if "${PSQL[@]}" -c "set role service_role; select inputs from public.challenges limit 1;" >/dev/null 2>&1; then
  echo "    ok   service_role still reads challenges.inputs (api/challenge.ts)"
else
  echo "    FAIL service_role lost challenges.inputs — ghosts would break"; fails=$((fails+1))
fi

echo "==> asserting account durability (migration 0035)"

# An anonymous account >30d old with a STALE zero counter but real runs must
# survive the reaper. This is the pre-0033 lost-update scenario, and the old
# predicate would have deleted it (cascading away runs, skins and ratings).
UC=33333333-3333-3333-3333-333333333333
UD=44444444-4444-4444-4444-444444444444
"${PSQL[@]}" -c "
  insert into auth.users (id, is_anonymous, created_at)
    values ('$UC', true, now() - interval '90 days'),
           ('$UD', true, now() - interval '90 days')
    on conflict (id) do nothing;
  insert into public.profiles (user_id) values ('$UC'),('$UD')
    on conflict (user_id) do nothing;
  -- UC: counters say empty, but it HAS a run (the dangerous case).
  update public.profiles set total_games = 0, xp = 0, streak_days = 0,
                             username = null, last_play_at = null
    where user_id in ('$UC','$UD');
  insert into public.runs (user_id, seed, score, ticks, inputs, inputs_count, mode)
    values ('$UC', 777, 42, 900, '[]'::jsonb, 0, 'casual');"

reaped=$("${PSQL[@]}" -tAc "select public.cleanup_stale_anonymous_users('30 days');")

uc_alive=$("${PSQL[@]}" -tAc "select count(*) from auth.users where id='$UC';")
ud_alive=$("${PSQL[@]}" -tAc "select count(*) from auth.users where id='$UD';")

if [ "$uc_alive" = "1" ]; then
  echo "    ok   account with a stale zero counter but real runs SURVIVED the reaper"
else
  echo "    FAIL reaper deleted an account that had runs (counter was stale)"; fails=$((fails+1))
fi

# UD is genuinely empty — it should still be reaped, or the reaper is useless.
if [ "$ud_alive" = "0" ]; then
  echo "    ok   genuinely empty anonymous account still reaped (returned $reaped)"
else
  echo "    FAIL reaper left a genuinely empty account behind"; fails=$((fails+1))
fi

# Recovery lookup: finds an account by its short reference, and refuses a
# too-short prefix (which would otherwise dump the whole table).
found=$("${PSQL[@]}" -tAc "select count(*) from public.find_account_by_reference('33333333');")
if [ "$found" = "1" ]; then
  echo "    ok   find_account_by_reference locates an account by its reference"
else
  echo "    FAIL recovery lookup returned $found rows (expected 1)"; fails=$((fails+1))
fi
short=$("${PSQL[@]}" -tAc "select count(*) from public.find_account_by_reference('33');")
if [ "$short" = "0" ]; then
  echo "    ok   recovery lookup refuses a too-short reference"
else
  echo "    FAIL a 2-char reference returned $short rows"; fails=$((fails+1))
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "PASS — migrations apply cleanly and privilege invariants hold"
else
  echo "FAIL — $fails problem(s)"; exit 1
fi
