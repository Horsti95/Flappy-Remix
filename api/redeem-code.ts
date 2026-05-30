import { getAdminClient } from "./_lib/supabaseAdmin";
import { encodeSkin } from "../src/game/skin";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const token = auth.slice("Bearer ".length);

  const admin = getAdminClient();
  const userRes = await admin.auth.getUser(token);
  if (userRes.error || !userRes.data.user) return json({ error: "unauthorized" }, 401);
  const userId = userRes.data.user.id;

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const raw = (body.code ?? "").trim().toUpperCase();
  if (!raw || raw.length < 3 || raw.length > 32) {
    return json({ error: "invalid_format" }, 400);
  }

  const codeRow = await admin
    .from("skin_codes")
    .select("code, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, label, max_uses, uses, expires_at, unlocks_shape")
    .eq("code", raw)
    .maybeSingle();
  if (codeRow.error || !codeRow.data) {
    return json({ error: "not_found" }, 404);
  }
  const c = codeRow.data;

  if (c.expires_at && new Date(c.expires_at as string).getTime() < Date.now()) {
    return json({ error: "expired" }, 410);
  }
  if (c.max_uses != null && (c.uses as number) >= (c.max_uses as number)) {
    return json({ error: "depleted" }, 410);
  }

  const existing = await admin
    .from("skin_code_redemptions")
    .select("code")
    .eq("user_id", userId)
    .eq("code", raw)
    .maybeSingle();
  if (existing.data) {
    return json({ error: "already_redeemed" }, 409);
  }

  const profile = await admin
    .from("profiles")
    .select("total_games")
    .eq("user_id", userId)
    .maybeSingle();
  const totalGames = (profile.data?.total_games as number | null) ?? 0;

  const skin = {
    body: [c.body_r as number, c.body_g as number, c.body_b as number] as [number, number, number],
    accent: [c.accent_r as number, c.accent_g as number, c.accent_b as number] as [number, number, number],
  };
  const encoded = encodeSkin(skin).toString();

  const skinInsert = await admin
    .from("skins")
    .insert({
      user_id: userId,
      body_r: skin.body[0],
      body_g: skin.body[1],
      body_b: skin.body[2],
      accent_r: skin.accent[0],
      accent_g: skin.accent[1],
      accent_b: skin.accent[2],
      encoded_int: encoded,
      rarity: c.rarity,
      unlocked_at_games: totalGames,
    })
    .select("id, body_r, body_g, body_b, accent_r, accent_g, accent_b, rarity, unlocked_at_games")
    .single();
  if (skinInsert.error || !skinInsert.data) {
    return json({ error: skinInsert.error?.message ?? "insert_failed" }, 500);
  }

  const redemption = await admin
    .from("skin_code_redemptions")
    .insert({ user_id: userId, code: raw, skin_id: skinInsert.data.id })
    .select("code")
    .single();
  if (redemption.error) {
    // Roll back the skin so a half-applied state doesn't poison future
    // redemption attempts. Best-effort — a failure here just leaves an
    // orphan skin row that the user can still equip.
    await admin.from("skins").delete().eq("id", skinInsert.data.id);
    return json({ error: redemption.error.message }, 500);
  }

  await admin.from("skin_codes").update({ uses: (c.uses as number) + 1 }).eq("code", raw);

  // If this code also grants a shape, upsert into shape_grants so the
  // client unlock check picks it up regardless of the player's stats.
  let grantedShape: string | null = null;
  if (c.unlocks_shape) {
    grantedShape = c.unlocks_shape as string;
    await admin
      .from("shape_grants")
      .upsert(
        { user_id: userId, shape_id: grantedShape, source: `code:${raw}` },
        { onConflict: "user_id,shape_id" },
      );
  }

  return json({
    ok: true,
    label: c.label,
    skin: skinInsert.data,
    granted_shape: grantedShape,
  });
}

function json(b: unknown, status = 200): Response {
  return new Response(JSON.stringify(b), {
    status,
    headers: { "content-type": "application/json" },
  });
}
