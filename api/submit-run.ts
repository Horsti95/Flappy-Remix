import { dailyDateString, dailySeed } from "../src/game/daily";
import { applyModifiers, pickDaily } from "../src/game/daily-twist";
import { DEFAULT_CONFIG } from "../src/game/config";
import { getAdminClient } from "./_lib/supabaseAdmin";
import { computeStreak } from "./_lib/streak";
import {
  generateSkinForThreshold,
  thresholdsCrossed,
  type GeneratedSkin,
} from "./_lib/unlock";
import { validatePayloadShape, validateRun } from "./_lib/validate";
import {
  applyElo,
  decideResult,
  isBestOfThreeComplete,
  tallyOutcome,
} from "./_lib/elo";

export const config = { runtime: "edge" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);
  const jwt = auth.slice("Bearer ".length);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const shape = validatePayloadShape(raw);
  if ("error" in shape) return json({ error: shape.error }, 400);
  const body = shape;

  // Derive the daily twist server-side so the replay validator uses
  // the same physics the client would have. Casual / challenge / ranked
  // all replay against DEFAULT_CONFIG.
  let cfg = DEFAULT_CONFIG;
  if (body.mode === "daily") {
    const date = body.daily_date ?? dailyDateString();
    const pick = pickDaily(date);
    cfg = applyModifiers(DEFAULT_CONFIG, pick.modifiers);
  }
  const v = validateRun(body, cfg);
  if (!v.ok) return json({ accepted: false, reason: v.reason }, 200);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(jwt);
  if (userRes.error || !userRes.data.user) return json({ error: "invalid token" }, 401);
  const userId = userRes.data.user.id;

  const profile = await admin
    .from("profiles")
    .select("total_games, streak_days, last_play_at, last_daily_play_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile.error) return json({ error: profile.error.message }, 500);
  const prev = (profile.data?.total_games as number | undefined) ?? 0;
  const next = prev + 1;

  // For daily mode: the seed must match the server's notion of today's
  // daily seed. Reject mismatches so players can't farm yesterday's
  // easier seed under the daily badge.
  if (body.mode === "daily") {
    const expectedDate = body.daily_date ?? dailyDateString();
    if (body.daily_date && body.daily_date !== dailyDateString()) {
      return json({ accepted: false, reason: "stale_daily_date" }, 200);
    }
    if (body.seed >>> 0 !== dailySeed(expectedDate) >>> 0) {
      return json({ accepted: false, reason: "wrong_daily_seed" }, 200);
    }
  }

  const run = await admin
    .from("runs")
    .insert({
      user_id: userId,
      seed: body.seed,
      score: body.score,
      ticks: v.ticks,
      inputs: body.inputs,
      inputs_count: body.inputs.length,
      equipped_skin_id: body.equipped_skin_id ?? null,
      mode: body.mode,
      daily_date: body.mode === "daily" ? body.daily_date ?? null : null,
    })
    .select("id")
    .single();
  if (run.error) return json({ error: run.error.message }, 500);

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

  if (body.mode === "ranked" && body.ranked_match_id != null && body.ranked_round != null) {
    const round = body.ranked_round | 0;
    if (round < 0 || round > 2) {
      return json({ accepted: false, reason: "bad_round" }, 200);
    }
    const m = await admin
      .from("ranked_matches")
      .select(
        "id, season_id, player_a, player_b, seeds, a_scores, b_scores, a_run_ids, b_run_ids, state, expires_at, a_rating_before, b_rating_before",
      )
      .eq("id", body.ranked_match_id)
      .maybeSingle();
    if (m.error || !m.data) return json({ accepted: false, reason: "match_not_found" }, 200);
    if (m.data.state !== "in_progress") return json({ accepted: false, reason: "match_closed" }, 200);
    if (new Date(m.data.expires_at as string).getTime() < Date.now()) {
      return json({ accepted: false, reason: "match_expired" }, 200);
    }
    const youAreA = m.data.player_a === userId;
    if (!youAreA && m.data.player_b !== userId) {
      return json({ accepted: false, reason: "not_participant" }, 200);
    }
    const expectedSeed = (m.data.seeds as number[])[round];
    if ((body.seed >>> 0) !== ((expectedSeed as number) >>> 0)) {
      return json({ accepted: false, reason: "wrong_ranked_seed" }, 200);
    }
    const aScores = ((m.data.a_scores as number[]) ?? []).slice();
    const bScores = ((m.data.b_scores as number[]) ?? []).slice();
    const aRunIds = ((m.data.a_run_ids as string[]) ?? []).slice();
    const bRunIds = ((m.data.b_run_ids as string[]) ?? []).slice();
    const mineScores = youAreA ? aScores : bScores;
    const mineRunIds = youAreA ? aRunIds : bRunIds;
    if (mineScores[round] != null) {
      return json({ accepted: false, reason: "round_already_played" }, 200);
    }
    mineScores[round] = body.score;
    mineRunIds[round] = run.data.id;

    // Decide outcome based on the rounds that have both players' scores.
    const a = aScores;
    const b = bScores;
    const definedPaired = [0, 1, 2].filter((i) => a[i] != null && b[i] != null);
    const outcome = tallyOutcome(
      definedPaired.map((i) => a[i]),
      definedPaired.map((i) => b[i]),
    );
    const complete = isBestOfThreeComplete(outcome, definedPaired.length);

    let aAfter: number | undefined;
    let bAfter: number | undefined;
    let winnerId: string | null | undefined;
    let nextState: "in_progress" | "completed" = "in_progress";

    if (complete) {
      const result = decideResult(outcome);
      const aBefore = (m.data.a_rating_before as number) ?? 1200;
      const bBefore = (m.data.b_rating_before as number) ?? 1200;
      const next = applyElo(aBefore, bBefore, result);
      aAfter = next.a;
      bAfter = next.b;
      winnerId = result === "draw" ? null : result === "a_win" ? (m.data.player_a as string) : (m.data.player_b as string);
      nextState = "completed";

      // Update both elo_ratings rows.
      const seasonId = m.data.season_id as number;
      await admin
        .from("elo_ratings")
        .upsert({
          user_id: m.data.player_a as string,
          season_id: seasonId,
          rating: aAfter,
        }, { onConflict: "user_id" });
      await admin
        .from("elo_ratings")
        .upsert({
          user_id: m.data.player_b as string,
          season_id: seasonId,
          rating: bAfter,
        }, { onConflict: "user_id" });
    }

    const upd = await admin
      .from("ranked_matches")
      .update({
        a_scores: youAreA ? mineScores : aScores,
        b_scores: youAreA ? bScores : mineScores,
        a_run_ids: youAreA ? mineRunIds : aRunIds,
        b_run_ids: youAreA ? bRunIds : mineRunIds,
        state: nextState,
        winner_id: winnerId ?? null,
        a_rating_after: aAfter ?? null,
        b_rating_after: bAfter ?? null,
        completed_at: complete ? new Date().toISOString() : null,
      })
      .eq("id", m.data.id);
    if (upd.error) console.error("[submit-run] ranked update", upd.error);
    rankedSummary = {
      match_id: m.data.id as string,
      round,
      you: youAreA ? "a" : "b",
      state: nextState,
      a_scores: youAreA ? mineScores : aScores,
      b_scores: youAreA ? bScores : mineScores,
      a_rating_after: aAfter,
      b_rating_after: bAfter,
      winner_id: winnerId ?? null,
    };
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
    mode: body.mode,
  });

  await admin.from("profiles").update({
    total_games: next,
    last_play_at: new Date().toISOString(),
    streak_days: streak.streakDays,
    last_daily_play_at: streak.lastDailyPlayAt,
  }).eq("user_id", userId);

  if (body.mode === "daily") {
    await admin.rpc("upsert_daily_seed", {
      d: body.daily_date ?? dailyDateString(),
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

  return json({
    accepted: true,
    run_id: run.data.id,
    total_games: next,
    streak_days: streak.streakDays,
    unlocked: granted.map((g) => ({
      threshold: g.threshold,
      rarity: g.rarity,
      body: g.skin.body,
      accent: g.skin.accent,
    })),
    ranked: rankedSummary,
  }, 200);
}
