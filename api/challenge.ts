import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const shortId = url.searchParams.get("id");
  if (!shortId) return json({ error: "missing id" }, 400);

  const admin = getAdminClient();
  const ch = await admin
    .from("challenges")
    .select("id, short_id, seed, inputs, creator_score, depth, expires_at, creator_id, creator_shape, creator_theme, daily_date")
    .eq("short_id", shortId)
    .maybeSingle();
  if (ch.error || !ch.data) return json({ error: "not_found" }, 404);

  if (new Date(ch.data.expires_at as string).getTime() < Date.now()) {
    return json({ error: "expired" }, 410);
  }

  const profile = await admin
    .from("profiles")
    .select("username, equipped_skin_id")
    .eq("user_id", ch.data.creator_id as string)
    .maybeSingle();

  let skin: {
    body: [number, number, number];
    accent: [number, number, number];
    rarity: string | null;
  } | null = null;
  const skinId = profile.data?.equipped_skin_id as string | null | undefined;
  if (skinId) {
    const s = await admin
      .from("skins")
      .select("body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity")
      .eq("id", skinId)
      .maybeSingle();
    if (s.data) {
      skin = {
        body: [s.data.body_r as number, s.data.body_g as number, s.data.body_b as number],
        accent: [s.data.accent_r as number, s.data.accent_g as number, s.data.accent_b as number],
        rarity: (s.data.rarity as string | null) ?? null,
      };
    }
  }

  return json({
    short_id: ch.data.short_id,
    seed: ch.data.seed,
    inputs: ch.data.inputs,
    creator_score: ch.data.creator_score,
    creator_username: (profile.data?.username as string | null | undefined) ?? null,
    creator_skin: skin,
    creator_shape: (ch.data.creator_shape as string | null | undefined) ?? null,
    creator_theme: (ch.data.creator_theme as string | null | undefined) ?? null,
    daily_date: (ch.data.daily_date as string | null | undefined) ?? null,
    depth: ch.data.depth,
    can_respond_again: (ch.data.depth as number) < 2,
  }, 200, 30);
}

function json(body: unknown, status: number, sMaxAge = 0): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sMaxAge > 0) headers["cache-control"] = `public, max-age=${sMaxAge}, s-maxage=${sMaxAge}`;
  return new Response(JSON.stringify(body), { status, headers });
}
