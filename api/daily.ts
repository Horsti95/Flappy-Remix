import { dailyDateString, dailySeed } from "../src/game/daily";
import { getAdminClient } from "./_lib/supabaseAdmin";

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
