import { dailyDateString, dailySeed } from "../src/game/daily";
import { applyModifiers, pickDaily } from "../src/game/daily-twist";
import { DEFAULT_CONFIG } from "../src/game/config";
import { levelFromTotalXp, levelsCrossedEvery5, xpForRun } from "../src/game/xp";
import { getAdminClient } from "./_lib/supabaseAdmin";
import { json } from "./_lib/http";
import { bearerJwt, resolveUserId } from "./_lib/auth";
import { grantYesterdaysChampions } from "./_lib/champions";
import { computeStreak } from "./_lib/streak";
import {
  generateSkinForThreshold,
  generateSkinFromKey,
  thresholdsCrossed,
  type GeneratedSkin,
} from "./_lib/unlock";
import { validatePayloadShape, validateRun } from "./_lib/validate";
import {
  applyElo,
  decideResult,
  isBestOfThreeComplete,
  marginBonus,
  tallyOutcome,
} from "./_lib/elo";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const jwt = bearerJwt(req);
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const shape = validatePayloadShape(raw);
  if ("error" in shape) return json({ error: shape.error }, 400);
  const body = shape;

  // Auth before the replay: validateRun simulates up to the whole run,
  // so don't burn that CPU for unauthenticated callers.
  const admin = getAdminClient();
  const userId = await resolveUserId(admin, jwt);
  if (!userId) return json({ error: "invalid token" }, 401);

  // Derive the twist config server-side so the replay validator uses the
  // same physics the client would have. Daily: today's pick. Challenge:
  // the challenge row's daily_date (derived from its source run at create
  // time — never client-claimed). Casual / ranked replay DEFAULT_CONFIG.
  let cfg = DEFAULT_CONFIG;
  if (body.mode === "daily") {
    const date = body.daily_date ?? dailyDateString();
    const pick = pickDaily(date);
    cfg = applyModifiers(DEFAULT_CONFIG, pick.modifiers);
  } else if (body.mode === "challenge" && body.challenge_short_id) {
    const ch = await admin
      .from("challenges")
      .select("daily_date")
      .eq("short_id", body.challenge_short_id)
      .maybeSingle();
    const twistDate = (ch.data?.daily_date as string | null | undefined) ?? null;
    if (twistDate) cfg = applyModifiers(DEFAULT_CONFIG, pickDaily(twistDate).modifiers);
  }
  const v = validateRun(body, cfg);
  if (!v.ok) return json({ accepted: false, reason: v.reason }, 200);

  // No inputs past the death tick: trailing taps can't change the replay,
  // so allowing them would let a thief re-hash someone else's run by
  // padding it (defeating the duplicate check below).
  if (body.inputs.some((i) => i.tick > v.ticks)) {
    return json({ accepted: false, reason: "inputs_after_death" }, 200);
  }

  // Anti replay-theft / idempotency: hash the canonical (seed, input ticks)
  // of every non-trivial run. An identical prior submission is rejected —
  // as theft when it came from another account, as a duplicate (e.g. an
  // offline-queue retry after a lost response) from the same one. Trivial
  // runs are exempt: two zero-flap deaths on the same daily seed are
  // legitimately identical.
  let inputsHash: string | null = null;
  if (body.score >= 10) {
    inputsHash = await sha256Hex(`${body.seed >>> 0}|${body.inputs.map((i) => i.tick).join(",")}`);
    const dupe = await admin
      .from("runs")
      .select("user_id")
      .eq("inputs_hash", inputsHash)
      .limit(1)
      .maybeSingle();
    if (dupe.data) {
      const reason = (dupe.data.user_id as string | null) === userId ? "duplicate_run" : "replay_theft";
      return json({ accepted: false, reason }, 200);
    }
  }

  const profile = await admin
    .from("profiles")
    .select("total_games, streak_days, last_play_at, last_daily_play_at, xp")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) return json({ error: profile.error.message }, 500);
  const prev = (profile.data?.total_games as number | undefined) ?? 0;
  const next = prev + 1;
  const prevXp = (profile.data?.xp as number | undefined) ?? 0;

  // Server-side PB check for the XP bonus: strictly beating the best prior
  // accepted run. Read BEFORE this run is inserted so the new row can't
  // count against itself. (runs is indexed on (user_id); score desc limit 1.)
  const bestPrior = await admin
    .from("runs")
    .select("score")
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();
  const isNewPb = body.score > ((bestPrior.data?.score as number | undefined) ?? -1);

  // For daily mode: the seed must match the server's notion of today's
  // daily seed. Reject mismatches so players can't farm yesterday's
  // easier seed under the daily badge.
  let effectiveMode = body.mode;
  let effectiveDailyDate: string | null = body.mode === "daily" ? body.daily_date ?? null : null;
  let dailyOverCap = false;
  if (body.mode === "daily") {
    const expectedDate = body.daily_date ?? dailyDateString();
    if (body.daily_date && body.daily_date !== dailyDateString()) {
      return json({ accepted: false, reason: "stale_daily_date" }, 200);
    }
    if (body.seed >>> 0 !== dailySeed(expectedDate) >>> 0) {
      return json({ accepted: false, reason: "wrong_daily_seed" }, 200);
    }
    // Daily best-of-3: only the first 3 daily runs per UTC day get daily
    // credit. Extra runs are accepted but stored as casual so they don't
    // appear on the daily board (the client also caps this for UX).
    const DAILY_MAX_ATTEMPTS = 3;
    const prior = await admin
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("mode", "daily")
      .eq("daily_date", expectedDate);
    if ((prior.count ?? 0) >= DAILY_MAX_ATTEMPTS) {
      dailyOverCap = true;
      effectiveMode = "casual";
      effectiveDailyDate = null;
    }
  }

  // Ranked submissions are checked against the match BEFORE the run row is
  // inserted: a reject must not leave an orphan run on the leaderboards.
  // `mode: "ranked"` without match coordinates used to skip every check and
  // still count on the ranked board — now it's rejected outright.
  let rankedRound: number | null = null;
  if (body.mode === "ranked") {
    if (body.ranked_match_id == null || body.ranked_round == null) {
      return json({ accepted: false, reason: "bad_ranked_payload" }, 200);
    }
    rankedRound = body.ranked_round | 0;
    if (rankedRound < 0 || rankedRound > 2) {
      return json({ accepted: false, reason: "bad_round" }, 200);
    }
    const pre = await fetchAndCheckMatch(admin, body.ranked_match_id, userId, rankedRound, body.seed);
    if ("reason" in pre) return json({ accepted: false, reason: pre.reason }, 200);
  }

  // Cosmetic snapshot: capture the shape + skin colors the run was flown
  // with. Validated defensively — anything malformed is dropped to null so a
  // bad client payload can never fail an otherwise-valid submission.
  const snapShape = typeof body.shape === "string" && body.shape.length <= 64 ? body.shape : null;
  const snapBody = sanitizeRgb(body.body);
  const snapAccent = sanitizeRgb(body.accent);

  const run = await admin
    .from("runs")
    .insert({
      user_id: userId,
      seed: body.seed,
      score: body.score,
      ticks: v.ticks,
      inputs: body.inputs,
      inputs_count: body.inputs.length,
      inputs_hash: inputsHash,
      equipped_skin_id: body.equipped_skin_id ?? null,
      mode: effectiveMode,
      daily_date: effectiveDailyDate,
      shape: snapShape,
      body_r: snapBody?.[0] ?? null,
      body_g: snapBody?.[1] ?? null,
      body_b: snapBody?.[2] ?? null,
      accent_r: snapAccent?.[0] ?? null,
      accent_g: snapAccent?.[1] ?? null,
      accent_b: snapAccent?.[2] ?? null,
    })
    .select("id")
    .single();
  if (run.error) return json({ error: run.error.message }, 500);

  // Lazy day-close: the first daily submission of a new UTC day mints
  // champion skins for yesterday's podium. Strictly best-effort — a
  // champion-grant hiccup must never fail the player's own submission.
  if (body.mode === "daily") {
    try {
      await grantYesterdaysChampions(admin);
    } catch {
      // retried on the next daily submission
    }
  }

  // Ranked: post the run into the right round slot, settle ELO if
  // this finishes the BO3.
  let rankedSummary: {
    match_id: string;
    round: number;
    you: "a" | "b";
    state: string;
    a_scores: number[];
    b_scores: number[];
    a_rating_after?: number;
    b_rating_after?: number;
    winner_id?: string | null;
  } | null = null;

  if (body.mode === "ranked" && rankedRound !== null) {
    const round = rankedRound;
    // Optimistic-concurrency settle: re-read, compute, then write guarded by
    // the match's version stamp. If both players settle concurrently the
    // loser of the race re-reads (now seeing the other's score) and retries,
    // so neither round score is lost and Elo settles exactly once.
    for (let attempt = 0; attempt < 3 && !rankedSummary; attempt++) {
      const pre = await fetchAndCheckMatch(admin, body.ranked_match_id!, userId, round, body.seed);
      if ("reason" in pre) {
        // Lost a race (settled/expired/replayed between our pre-check and
        // now). Remove the just-inserted run so no orphan hits the boards.
        await admin.from("runs").delete().eq("id", run.data.id);
        return json({ accepted: false, reason: pre.reason }, 200);
      }
      const m = pre.m;
      const youAreA = pre.youAreA;
      const aScores = ((m.a_scores as number[]) ?? []).slice();
      const bScores = ((m.b_scores as number[]) ?? []).slice();
      const aRunIds = ((m.a_run_ids as string[]) ?? []).slice();
      const bRunIds = ((m.b_run_ids as string[]) ?? []).slice();
      (youAreA ? aScores : bScores)[round] = body.score;
      (youAreA ? aRunIds : bRunIds)[round] = run.data.id;

      // Decide outcome based on the rounds that have both players' scores.
      const definedPaired = [0, 1, 2].filter((i) => aScores[i] != null && bScores[i] != null);
      const outcome = tallyOutcome(
        definedPaired.map((i) => aScores[i]),
        definedPaired.map((i) => bScores[i]),
      );
      const complete = isBestOfThreeComplete(outcome, definedPaired.length);

      let aAfter: number | undefined;
      let bAfter: number | undefined;
      let winnerId: string | null | undefined;
      let result: ReturnType<typeof decideResult> | null = null;
      let nextState: "in_progress" | "completed" = "in_progress";

      if (complete) {
        result = decideResult(outcome);
        const aBefore = (m.a_rating_before as number) ?? 1200;
        const bBefore = (m.b_rating_before as number) ?? 1200;
        const next = applyElo(aBefore, bBefore, result);
        // Winner-only flat bonus scaled by aggregate score margin over the
        // rounds actually played. Applied after the core Elo math.
        const aTotal = definedPaired.reduce((sum, i) => sum + (aScores[i] as number), 0);
        const bTotal = definedPaired.reduce((sum, i) => sum + (bScores[i] as number), 0);
        const bonus = marginBonus(aTotal, bTotal, result);
        aAfter = next.a + bonus.a;
        bAfter = next.b + bonus.b;
        winnerId = result === "draw" ? null : result === "a_win" ? (m.player_a as string) : (m.player_b as string);
        nextState = "completed";
      }

      const version = (m.version as number) ?? 0;
      const upd = await admin
        .from("ranked_matches")
        .update({
          a_scores: aScores,
          b_scores: bScores,
          a_run_ids: aRunIds,
          b_run_ids: bRunIds,
          state: nextState,
          winner_id: winnerId ?? null,
          a_rating_after: aAfter ?? null,
          b_rating_after: bAfter ?? null,
          completed_at: complete ? new Date().toISOString() : null,
          version: version + 1,
        })
        .eq("id", m.id as string)
        .eq("version", version)
        .select("id");
      if (upd.error || (upd.data?.length ?? 0) === 0) {
        // Version conflict — someone else wrote first. Re-read and retry.
        continue;
      }

      // Elo + W/L/D only after we definitively won the settle write, so a
      // concurrent settle can't apply ratings twice.
      if (complete && result) {
        const seasonId = m.season_id as number;
        const playerA = m.player_a as string;
        const playerB = m.player_b as string;
        const rows = await admin
          .from("elo_ratings")
          .select("user_id, games_played, wins, losses, draws")
          .eq("season_id", seasonId)
          .in("user_id", [playerA, playerB]);
        const counters = (uid: string, won: boolean, lost: boolean) => {
          const r = rows.data?.find((x) => (x.user_id as string) === uid);
          return {
            games_played: ((r?.games_played as number) ?? 0) + 1,
            wins: ((r?.wins as number) ?? 0) + (won ? 1 : 0),
            losses: ((r?.losses as number) ?? 0) + (lost ? 1 : 0),
            draws: ((r?.draws as number) ?? 0) + (result === "draw" ? 1 : 0),
          };
        };
        await admin
          .from("elo_ratings")
          .upsert({
            user_id: playerA,
            season_id: seasonId,
            rating: aAfter,
            updated_at: new Date().toISOString(),
            ...counters(playerA, result === "a_win", result === "b_win"),
          }, { onConflict: "user_id,season_id" });
        await admin
          .from("elo_ratings")
          .upsert({
            user_id: playerB,
            season_id: seasonId,
            rating: bAfter,
            updated_at: new Date().toISOString(),
            ...counters(playerB, result === "b_win", result === "a_win"),
          }, { onConflict: "user_id,season_id" });
      }

      rankedSummary = {
        match_id: m.id as string,
        round,
        you: youAreA ? "a" : "b",
        state: nextState,
        a_scores: aScores,
        b_scores: bScores,
        a_rating_after: aAfter,
        b_rating_after: bAfter,
        winner_id: winnerId ?? null,
      };
    }
    if (!rankedSummary) {
      await admin.from("runs").delete().eq("id", run.data.id);
      return json({ accepted: false, reason: "settle_conflict" }, 200);
    }
  }

  // If this submission is responding to a challenge, attach the run
  // to the challenge so the comparison surface can render.
  if (body.mode === "challenge" && body.challenge_short_id) {
    const ch = await admin
      .from("challenges")
      .select("id, seed, responder_id, responder_score, target_user_id, status")
      .eq("short_id", body.challenge_short_id)
      .maybeSingle();
    if (ch.data && ch.data.seed === body.seed) {
      // Unlimited tries, best counts: the first valid response claims the
      // slot, and the same responder may keep playing — we keep their best
      // score. A different user can't overwrite a claimed challenge.
      const unclaimed = !ch.data.responder_id;
      const claimedByMe = ch.data.responder_id === userId;
      const prevBest = (ch.data.responder_score as number | null) ?? -1;
      if (unclaimed || (claimedByMe && body.score > prevBest)) {
        const patch: Record<string, unknown> = {
          responder_id: userId,
          responder_run_id: run.data.id,
          responder_score: body.score,
          responded_at: new Date().toISOString(),
        };
        // A targeted (inbox) challenge flips from 'pending' to 'accepted'
        // the moment the addressed friend first plays it.
        if (unclaimed && ch.data.target_user_id === userId && ch.data.status === "pending") {
          patch.status = "accepted";
        }
        await admin.from("challenges").update(patch).eq("id", ch.data.id);
      }
    }
  }

  const streak = computeStreak({
    prevStreak: (profile.data?.streak_days as number | undefined) ?? 0,
    lastPlayAt: (profile.data?.last_play_at as string | null | undefined) ?? null,
    lastDailyPlayAt: (profile.data?.last_daily_play_at as string | null | undefined) ?? null,
    // Over-cap daily runs count as casual for streak — daily credit was
    // already granted on the first attempt of the day.
    mode: effectiveMode,
  });

  // XP mirror: the same formula the client runs locally (src/game/xp.ts).
  // effectiveMode (not body.mode) so over-cap daily attempts — demoted to
  // casual above — don't pay the daily bonus more than once per day.
  const xpGain = xpForRun({ score: body.score, mode: effectiveMode, isNewPb }).total;
  const newXp = prevXp + xpGain;

  await admin.from("profiles").update({
    total_games: next,
    last_play_at: new Date().toISOString(),
    streak_days: streak.streakDays,
    last_daily_play_at: streak.lastDailyPlayAt,
    xp: newXp,
  }).eq("user_id", userId);

  if (effectiveMode === "daily") {
    await admin.rpc("upsert_daily_seed", {
      d: effectiveDailyDate ?? dailyDateString(),
      s: body.seed,
    });
  }

  const crossed = thresholdsCrossed(prev, next);
  const granted: GeneratedSkin[] = [];
  for (const t of crossed) {
    const g = generateSkinForThreshold(userId, t);
    const ins = await admin
      .from("skins")
      .insert({
        user_id: userId,
        body_r: g.skin.body[0],
        body_g: g.skin.body[1],
        body_b: g.skin.body[2],
        accent_r: g.skin.accent[0],
        accent_g: g.skin.accent[1],
        accent_b: g.skin.accent[2],
        encoded_int: g.encoded.toString(),
        rarity: g.rarity,
        unlocked_at_games: t,
      })
      .select("id, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, unlocked_at_games")
      .single();
    if (!ins.error) granted.push(g);
  }

  // A random color skin every 5 account levels. Deterministic mint +
  // (user_id, encoded_int) ignoreDuplicates upsert = structurally idempotent,
  // same as the daily-champion grants.
  const levelSkins: Array<{
    level: number;
    rarity: GeneratedSkin["rarity"];
    body: [number, number, number];
    accent: [number, number, number];
  }> = [];
  for (const level of levelsCrossedEvery5(prevXp, newXp)) {
    const g = generateSkinFromKey(`glide-level:${level}:${userId}`, 60);
    const ins = await admin.from("skins").upsert(
      {
        user_id: userId,
        body_r: g.skin.body[0],
        body_g: g.skin.body[1],
        body_b: g.skin.body[2],
        accent_r: g.skin.accent[0],
        accent_g: g.skin.accent[1],
        accent_b: g.skin.accent[2],
        encoded_int: g.encoded.toString(),
        rarity: g.rarity,
        unlocked_at_games: next,
      },
      { onConflict: "user_id,encoded_int", ignoreDuplicates: true },
    );
    if (!ins.error) {
      levelSkins.push({ level, rarity: g.rarity, body: g.skin.body, accent: g.skin.accent });
    }
  }

  return json({
    accepted: true,
    run_id: run.data.id,
    total_games: next,
    streak_days: streak.streakDays,
    daily_over_cap: dailyOverCap,
    unlocked: granted.map((g) => ({
      threshold: g.threshold,
      rarity: g.rarity,
      body: g.skin.body,
      accent: g.skin.accent,
    })),
    // Level-up skins ride a separate field: the `unlocked` celebration card
    // renders "N games" and these are level grants, not game-count grants.
    level_skins: levelSkins,
    xp_total: newXp,
    level: levelFromTotalXp(newXp).level,
    ranked: rankedSummary,
  }, 200);
}

/** Coerce an untrusted RGB triple into [0..255] ints, or null if malformed. */
function sanitizeRgb(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const out: number[] = [];
  for (const c of v) {
    if (typeof c !== "number" || !Number.isFinite(c)) return null;
    out.push(Math.max(0, Math.min(255, Math.round(c))));
  }
  return out as [number, number, number];
}

/** Hex SHA-256 via Web Crypto (available in the edge runtime). */
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MATCH_SELECT =
  "id, season_id, player_a, player_b, seeds, a_scores, b_scores, a_run_ids, b_run_ids, state, expires_at, a_rating_before, b_rating_before, version";

/**
 * Load a ranked match and run every submission precondition. Expired
 * in_progress matches are lazily flipped to 'expired' here, which also
 * unblocks matchmaking for both players (queue joins are refused while an
 * in_progress match exists).
 */
async function fetchAndCheckMatch(
  admin: ReturnType<typeof getAdminClient>,
  matchId: string,
  userId: string,
  round: number,
  seed: number,
): Promise<{ m: Record<string, unknown>; youAreA: boolean } | { reason: string }> {
  const m = await admin
    .from("ranked_matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle();
  if (m.error || !m.data) return { reason: "match_not_found" };
  if (m.data.state !== "in_progress") return { reason: "match_closed" };
  if (new Date(m.data.expires_at as string).getTime() < Date.now()) {
    await admin
      .from("ranked_matches")
      .update({ state: "expired" })
      .eq("id", matchId)
      .eq("state", "in_progress");
    return { reason: "match_expired" };
  }
  const youAreA = m.data.player_a === userId;
  if (!youAreA && m.data.player_b !== userId) return { reason: "not_participant" };
  const expectedSeed = (m.data.seeds as number[])[round];
  if ((seed >>> 0) !== ((expectedSeed as number) >>> 0)) return { reason: "wrong_ranked_seed" };
  const mine = (youAreA ? m.data.a_scores : m.data.b_scores) as number[] | null;
  if (mine?.[round] != null) return { reason: "round_already_played" };
  return { m: m.data as Record<string, unknown>, youAreA };
}
