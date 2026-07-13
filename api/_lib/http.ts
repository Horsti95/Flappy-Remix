/**
 * Shared JSON response helper for every api/ handler. Replaces the per-file
 * `json()` copies that had already drifted into three signatures (and two
 * handlers that hand-rolled Response and forgot the content-type header).
 */
export function json(
  body: unknown,
  status = 200,
  opts?: { sMaxAge?: number },
): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts?.sMaxAge && opts.sMaxAge > 0) {
    headers["cache-control"] = `public, max-age=${opts.sMaxAge}, s-maxage=${opts.sMaxAge}`;
  }
  return new Response(JSON.stringify(body), { status, headers });
}
