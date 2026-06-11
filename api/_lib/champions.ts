import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSkinFromKey } from "./unlock";

/**
 * Daily champion skins — yesterday's top daily players each get a
 * server-minted high-chroma skin, granted lazily: the first daily
 * submission of a new UTC day triggers the grant for the day before.
 *
 * Idempotency is structural, no bookkeeping table needed:
 *  - the mint is deterministic per `glide-champ:<date>:<userId>`, and
 *  - `skins_user_encoded_idx` (user_id, encoded_int) makes re-inserts
 *    no-ops via upsert+ignoreDuplicates,
 * so re-running for the same day grants nothing new. A per-instance memo
 * just keeps the happy path to zero extra queries.
 */
const CHAMPION_COUNT = 3;
const CHAMPION_MIN_CHROMA = 80; // trends epic/legendary, like the 500+ mints
const grantedDates = new Set<string>();

export async function grantYesterdaysChampions(admin: SupabaseClient): Promise<void> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (grantedDates.has(yesterday)) return;

  const runs = await admin
    .from("runs")
    .select("user_id, score")
    .eq("mode", "daily")
    .eq("daily_date", yesterday)
    .not("user_id", "is", null)
    .order("score", { ascending: false })
    .limit(50);
  if (runs.error) return;

  // Best run per user, then the podium.
  const seen = new Set<string>();
  const podium: string[] = [];
  for (const r of runs.data ?? []) {
    const uid = r.user_id as string;
    if (seen.has(uid)) continue;
    seen.add(uid);
    podium.push(uid);
    if (podium.length >= CHAMPION_COUNT) break;
  }
  if (podium.length === 0) {
    grantedDates.add(yesterday);
    return;
  }

  const profiles = await admin
    .from("profiles")
    .select("user_id, total_games")
    .in("user_id", podium);
  const gamesByUser = new Map<string, number>(
    (profiles.data ?? []).map((p) => [p.user_id as string, (p.total_games as number) ?? 0]),
  );

  let allOk = true;
  for (const uid of podium) {
    const g = generateSkinFromKey(`glide-champ:${yesterday}:${uid}`, CHAMPION_MIN_CHROMA);
    const ins = await admin.from("skins").upsert(
      {
        user_id: uid,
        body_r: g.skin.body[0],
        body_g: g.skin.body[1],
        body_b: g.skin.body[2],
        accent_r: g.skin.accent[0],
        accent_g: g.skin.accent[1],
        accent_b: g.skin.accent[2],
        encoded_int: g.encoded.toString(),
        rarity: g.rarity,
        unlocked_at_games: gamesByUser.get(uid) ?? 0,
      },
      { onConflict: "user_id,encoded_int", ignoreDuplicates: true },
    );
    if (ins.error) allOk = false;
  }
  // Only memoize a fully successful pass; partial failures retry on the
  // next daily submission (the upserts make retries safe).
  if (allOk) grantedDates.add(yesterday);
}
