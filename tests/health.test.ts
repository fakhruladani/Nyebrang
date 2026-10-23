import { describe, expect, it } from "vitest";
import { buildApp } from "../server/src/app";
import { openDb } from "../server/src/db";

describe("API health & header keamanan", () => {
  it("GET /api/health → ok", async () => {
    const app = await buildApp({ serveClient: false, db: openDb(":memory:") });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    await app.close();
  });

  it("CSP membatasi connect-src ke path API game saja", async () => {
    const app = await buildApp({ serveClient: false, db: openDb(":memory:") });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toMatch(/connect-src [^;]*\/nyebrang\/api\//);
    expect(csp).not.toMatch(/connect-src[^;]*'self'/);
    expect(csp).toContain("frame-ancestors 'none'");
    await app.close();
  });

  it("API tidak dikenal → 404 JSON", async () => {
    const app = await buildApp({ serveClient: false, db: openDb(":memory:") });
    const res = await app.inject({ method: "GET", url: "/api/tidak-ada" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not_found" });
    await app.close();
  });
});
