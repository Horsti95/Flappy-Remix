import { dailyDateString, dailySeed } from "../src/game/daily";
import { getAdminClient } from "./_lib/supabaseAdmin";

// Runtime: regional Node, NOT edge. This handler is database-bound, and the
// database is single-region. At the edge each Supabase round trip crossed a
// continent, so the sequential calls below cost ~200-300ms EACH for a distant
// player. Pinned to the Supabase region via `regions` in vercel.json, the same
// calls are intra-datacentre. The Web `Request`/`Response` signature below is
// reached through the `default.fetch` export at the bottom of this file, which
// is how Vercel's Node runtime recognises a Web handler.

async function handler(_req: Request): Promise<Response> {
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

// Vercel's Node runtime reaches a Web handler through `default.fetch`, NOT
// through a default-exported function. A bare `export default function
// handler(req: Request)` is taken for the LEGACY Node signature and invoked as
// handler(req, res) with an IncomingMessage — so the first line that touches
// req.headers.get() throws, every request 500s, and the returned Response is
// discarded. That is exactly what happened when these routes moved off the
// edge runtime. The edge runtime does accept a bare default function, which is
// why nothing complained before the move.
export default { fetch: handler };
