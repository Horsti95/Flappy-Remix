import { dailyDateString, dailySeed } from "../src/game/daily";
import { getAdminClient } from "./_lib/supabaseAdmin";

// Runtime: regional Node, NOT edge. This handler is database-bound, and the
// database is single-region. At the edge each Supabase round trip crossed a
// continent, so the sequential calls below cost ~200-300ms EACH for a distant
// player. Pinned to the Supabase region via `regions` in vercel.json, the same
// calls are intra-datacentre. The Web `Request`/`Response` signature below is
// supported by Vercel's Node runtime as-is, so no handler rewrite is needed.

export default async function handler(_req: Request): Promise<Response> {
  const date = dailyDateString();
  const seed = dailySeed(date);
  let playsCount = 0;
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("daily_seeds")
      .select("plays_count")
      .eq("date", date)
      .maybeSingle();
    playsCount = (data?.plays_count as number | undefined) ?? 0;
  } catch (err) {
    console.warn("[daily] supabase unreachable, returning seed only", err);
  }
  return new Response(JSON.stringify({ date, seed, plays_count: playsCount }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=30, s-maxage=30",
    },
  });
}
