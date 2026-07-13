import { getAdminClient } from "./_lib/supabaseAdmin";

export const config = { runtime: "edge" };

// NOT called by app code — reached only via the vercel.json rewrite of
// /run/:id (link-preview crawlers + shared-link visitors). Don't mistake
// it for a dead endpoint.
//
// Serves a thin HTML shell with run-specific OG / Twitter meta tags
// for /run/<id> URLs. Crawlers (WhatsApp, Discord, Twitter, Slack,
// Telegram, iMessage) parse this; humans get redirected to the SPA
// root after a moment via the meta refresh, with deep-link params
// preserved.

const ABS_ORIGIN = process.env.PUBLIC_SITE_URL ?? "https://glide.uno";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const runId =
    url.searchParams.get("id") ??
    (url.pathname.match(/\/run\/([^/?#]+)/)?.[1] ?? null);
  if (!runId) return new Response("not found", { status: 404 });

  let title = "Glide — can you beat this?";
  let description = "Daily flap-through-gaps. Same seed for the world, every day.";
  let dailyDate: string | null = null;
  try {
    const admin = getAdminClient();
    const { data } = await admin
      .from("runs")
      .select("score, mode, daily_date, profiles(username)")
      .eq("id", runId)
      .maybeSingle();
    if (data) {
      const username = (data as { profiles: { username?: string | null } | null }).profiles?.username ?? "anon";
      const verb = (data.score as number) === 0 ? "bombed" : `scored ${data.score}`;
      const mode = data.mode === "daily" ? "the daily" : "Glide";
      title = `@${username} ${verb} on ${mode}`;
      description = "tap to play the same seed.";
      dailyDate = (data.daily_date as string | null) ?? null;
    }
  } catch (err) {
    console.warn("[og-meta] supabase lookup failed", err);
  }

  const ogImage = `${ABS_ORIGIN}/api/og?run=${encodeURIComponent(runId)}`;
  const canonical = `${ABS_ORIGIN}/run/${encodeURIComponent(runId)}`;
  const appUrl = dailyDate ? `${ABS_ORIGIN}/?d=${dailyDate}&from=${runId}` : `${ABS_ORIGIN}/?from=${runId}`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}" />
  <link rel="canonical" href="${escape(canonical)}" />
  <meta property="og:title" content="${escape(title)}" />
  <meta property="og:description" content="${escape(description)}" />
  <meta property="og:image" content="${escape(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escape(canonical)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(title)}" />
  <meta name="twitter:description" content="${escape(description)}" />
  <meta name="twitter:image" content="${escape(ogImage)}" />
  <meta http-equiv="refresh" content="0; url=${escape(appUrl)}" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <style>body{font-family:system-ui,sans-serif;background:#1a1a1a;color:#f4ead5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style>
</head>
<body>
  <a href="${escape(appUrl)}">open Glide →</a>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
