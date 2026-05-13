import { type Plugin, type ViteDevServer } from "vite";
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Mounts files under /api as Web-standard request handlers during
 * `vite dev` so the same code that runs on Vercel edge in production
 * also serves locally. Vercel runs these directly in prod via its
 * file-based routing.
 */
export function devApi(): Plugin {
  return {
    name: "pflug-dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();
        const url = new URL(req.url, `http://${req.headers.host}`);
        let modulePath: string;
        try {
          modulePath = await resolveHandler(url.pathname);
        } catch {
          return next();
        }
        try {
          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default as (req: Request) => Promise<Response>;
          if (typeof handler !== "function") return next();
          const webReq = await toWebRequest(req, url);
          const webRes = await handler(webReq);
          res.statusCode = webRes.status;
          webRes.headers.forEach((v, k) => res.setHeader(k, v));
          const buf = Buffer.from(await webRes.arrayBuffer());
          res.end(buf);
        } catch (err) {
          console.error("[dev-api]", err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "dev-api crash", detail: String(err) }));
        }
      });
    },
  };

  async function resolveHandler(pathname: string): Promise<string> {
    const stripped = pathname.replace(/^\/api\//, "").replace(/\/+$/, "");
    if (!stripped) throw new Error("no path");
    const apiRoot = path.resolve("api");
    const direct = path.join(apiRoot, `${stripped}.ts`);
    if (await exists(direct)) return direct;
    const index = path.join(apiRoot, stripped, "index.ts");
    if (await exists(index)) return index;
    // dynamic [param].ts
    const segments = stripped.split("/");
    const dir = path.join(apiRoot, ...segments.slice(0, -1));
    const entries = await readdir(dir).catch(() => []);
    for (const e of entries) {
      if (e.startsWith("[") && e.endsWith(".ts")) return path.join(dir, e);
    }
    throw new Error("not found");
  }

  async function exists(p: string): Promise<boolean> {
    try {
      await (await import("node:fs/promises")).stat(p);
      return true;
    } catch {
      return false;
    }
  }

  async function toWebRequest(req: import("http").IncomingMessage, url: URL): Promise<Request> {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else if (v) headers.set(k, v);
    }
    let body: BodyInit | undefined;
    if (req.method && !["GET", "HEAD"].includes(req.method)) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      body = Buffer.concat(chunks);
    }
    return new Request(url.toString(), { method: req.method ?? "GET", headers, body });
  }
}
