import { ImageResponse } from "@vercel/og";
import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

interface OgPayload {
  username: string;
  score: number;
  body: [number, number, number];
  accent: [number, number, number];
  rarity: string | null;
  mode: string;
  date: string | null;
  total_played: number | null;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const runId = url.searchParams.get("run");
  const date = url.searchParams.get("d");

  let payload: OgPayload | null = null;

  if (runId) {
    try {
      const admin = getAdminClient();
      const { data } = await admin
        .from("leaderboard_all_time")
        .select(
          "score, username, body_r, body_g, body_b, accent_r, accent_g, accent_b, skin_rarity, mode, daily_date",
        )
        .eq("run_id", runId)
        .maybeSingle();
      if (data) {
        let totalPlayed: number | null = null;
        if (data.daily_date) {
          const { data: ds } = await admin
            .from("daily_seeds")
            .select("plays_count")
            .eq("date", data.daily_date)
            .maybeSingle();
          totalPlayed = (ds?.plays_count as number | undefined) ?? null;
        }
        payload = {
          username: (data.username as string | null) ?? "anon",
          score: data.score as number,
          body: [data.body_r ?? 244, data.body_g ?? 234, data.body_b ?? 213] as [number, number, number],
          accent: [data.accent_r ?? 26, data.accent_g ?? 26, data.accent_b ?? 26] as [number, number, number],
          rarity: (data.skin_rarity as string | null) ?? null,
          mode: (data.mode as string) ?? "casual",
          date: (data.daily_date as string | null) ?? null,
          total_played: totalPlayed,
        };
      }
    } catch (err) {
      console.warn("[og] supabase lookup failed", err);
    }
  }

  if (!payload) {
    payload = {
      username: "pflug",
      score: 0,
      body: [244, 234, 213],
      accent: [26, 26, 26],
      rarity: null,
      mode: date ? "daily" : "casual",
      date,
      total_played: null,
    };
  }

  return new ImageResponse(card(payload), {
    width: 1200,
    height: 630,
    headers: {
      "cache-control": "public, immutable, max-age=3600, s-maxage=3600",
    },
  });
}

// Hand-build the Satori tree without JSX so we don't need to wire a
// JSX transform for one file. Each entry is { type, props } where
// props.children is a string or an array of such entries.
type Node = { type: string; props: Record<string, unknown> };

function el(type: string, props: Record<string, unknown> = {}, children: Node | Node[] | string | null = null): Node {
  return { type, props: children === null ? props : { ...props, children } };
}

function card(p: OgPayload): Node {
  const bodyRgb = `rgb(${p.body.join(",")})`;
  const accentRgb = `rgb(${p.accent.join(",")})`;
  const subline = p.mode === "daily"
    ? `daily · ${p.date ?? ""}${p.total_played ? ` · ${p.total_played} played` : ""}`
    : "casual run";
  return el("div", {
    style: {
      width: "1200px",
      height: "630px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "64px 72px",
      background: "linear-gradient(135deg, #1a1a1a 0%, #2a3d5b 65%, #3a4d6b 100%)",
      color: "#f4ead5",
      fontFamily: "system-ui, sans-serif",
    },
  }, [
    el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, [
      el("div", { style: { display: "flex", flexDirection: "column" } }, [
        el("div", { style: { fontSize: 64, fontWeight: 800, lineHeight: 1 } }, "Glide"),
        el("div", { style: { marginTop: 8, fontSize: 24, opacity: 0.7 } }, subline),
      ]),
      planeSvg(bodyRgb, accentRgb),
    ]),
    el("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between" } }, [
      el("div", { style: { display: "flex", flexDirection: "column" } }, [
        el("div", { style: { fontSize: 36, opacity: 0.7 } }, `@${p.username}`),
        el("div", { style: { fontSize: 240, fontWeight: 900, lineHeight: 1 } }, String(p.score)),
        p.rarity
          ? el("div", { style: { fontSize: 24, opacity: 0.7, marginTop: 8 } }, `${p.rarity} skin`)
          : el("div", {}, ""),
      ]),
      el("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } }, [
        el("div", { style: { fontSize: 22, opacity: 0.7 } }, "play"),
        el("div", { style: { fontSize: 48, fontWeight: 700 } }, "glide.uno"),
      ]),
    ]),
  ]);
}

function planeSvg(bodyRgb: string, accentRgb: string): Node {
  const svg = `
    <svg width="220" height="160" viewBox="-20 -16 44 32" xmlns="http://www.w3.org/2000/svg">
      <polygon points="-14,6 14,-6 1,0 14,-6 -1,11" fill="${bodyRgb}" stroke="#1a1a1a" stroke-width="0.8"/>
      <polygon points="1,0 -14,6 -1,11" fill="${accentRgb}" stroke="#1a1a1a" stroke-width="0.8"/>
    </svg>`;
  return el("img", { width: 220, height: 160, src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` });
}
