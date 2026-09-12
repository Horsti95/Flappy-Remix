import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the one mistake that took the whole save path down on production.
 *
 * Vercel's Node runtime reaches a Web handler through `export default { fetch }`.
 * A bare `export default function handler(req: Request)` is treated as the
 * LEGACY Node signature and called as handler(req, res) with an
 * IncomingMessage: `req.headers.get(...)` throws, every request 500s, and the
 * Response that comes back is discarded. The edge runtime accepts the bare
 * function, so moving a route off edge breaks it silently — no type error, no
 * build error, just 500s in production.
 *
 * So: an edge route may export a bare default function; a Node route must not.
 *
 * Every pattern is anchored to the start of a line (/m): these files explain the
 * trap in a comment, and an unanchored regex matches the explanation instead of
 * the code. It did on the first run of this test.
 */

const API_DIR = join(import.meta.dirname ?? __dirname, "..", "api");

const routes = readdirSync(API_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ file: f, src: readFileSync(join(API_DIR, f), "utf8") }))
  .filter(({ src }) => src.includes("export default"));

const isEdge = (src: string) => /runtime:\s*["']edge["']/.test(src);

describe("api handler export shape", () => {
  it("finds the route files at all (a moved directory must fail loudly)", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  for (const { file, src } of routes) {
    if (isEdge(src)) {
      it(`${file} (edge) may export a bare default function`, () => {
        expect(src).toMatch(/^export default (async )?function/m);
      });
      continue;
    }

    it(`${file} (node) exports default { fetch }`, () => {
      expect(src).toMatch(/^export default \{ fetch:/m);
    });

    it(`${file} (node) does NOT export a bare default function`, () => {
      expect(src).not.toMatch(/^export default (async )?function/m);
    });
  }
});

/**
 * The regex checks above only read the source. These IMPORT the routes and call
 * them, which is the only way to prove the shape Vercel actually invokes works:
 * `default.fetch` exists, takes a Web Request, and returns a Web Response.
 */
describe("api handlers are callable as web handlers", () => {
  const nodeRoutes = routes.filter(({ src }) => !isEdge(src)).map(({ file }) => file);

  for (const file of nodeRoutes) {
    it(`${file} exposes a callable default.fetch`, async () => {
      const name = file.replace(/\.ts$/, "");
      const mod = (await import(`../api/${name}.ts`)) as {
        default?: { fetch?: unknown };
      };
      expect(typeof mod.default?.fetch).toBe("function");
    });
  }

  it("a wrong method gets a real Response, not a crash", async () => {
    // GET on a POST-only route returns 405 before any Supabase client is built,
    // so this needs no credentials — and it proves req.method was readable,
    // which is the exact line that threw under the legacy signature.
    const mod = (await import("../api/submit-run")) as {
      default: { fetch: (req: Request) => Promise<Response> };
    };
    const res = await mod.default.fetch(new Request("https://example.test/api/submit-run"));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(405);
  });

  it("a POST without a token is rejected as unauthenticated, not as a crash", async () => {
    // Proves req.headers.get() works — the call that threw when Vercel handed
    // the handler an IncomingMessage instead of a Request.
    const mod = (await import("../api/submit-run")) as {
      default: { fetch: (req: Request) => Promise<Response> };
    };
    const res = await mod.default.fetch(
      new Request("https://example.test/api/submit-run", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(401);
  });
});
