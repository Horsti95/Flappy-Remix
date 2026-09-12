import { dailyDateString, dailySeed } from "../src/game/daily";
import { getAdminClient } from "./_lib/supabaseAdmin";

// Runtime: EDGE — and deliberately back on edge after two failed attempts to
// move it.
//
// The move was worth trying: this handler is database-bound and the database is
// single-region, so at the edge every Supabase round trip crosses a continent
// (~200-300ms each for a distant player) where regional Node pinned to the
// Supabase region would be intra-datacentre.
//
// Attempt 1 kept `export default async function handler(req: Request)`, which
// edge accepts and Node does not — Node takes a default-exported FUNCTION for
// the legacy (req, res) signature and hands it an IncomingMessage, so
// req.headers.get() throws. Attempt 2 used `export default { fetch: handler }`,
// the shape Vercel's changelog documents for Node web handlers. Production kept
// answering 500 through both, and players' runs were piling up unsaved.
//
// So this is back to the configuration that demonstrably served this app for
// months. The latency win is real but it is not worth guessing at in production:
// re-attempt it on a PREVIEW deploy, confirm a run actually saves there, and
// only then ship it.

export const config = { runtime: "edge" };

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
