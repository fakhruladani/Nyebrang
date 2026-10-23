import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { existsSync } from "node:fs";
import { type Config, loadConfig } from "./config.js";
import { type Db, cleanup, openDb } from "./db.js";
import { registerSecurityHeaders } from "./security.js";
import { runRoutes } from "./routes/runs.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { adminRoutes } from "./routes/admin.js";

export interface BuildOpts {
  logger?: boolean;
  serveClient?: boolean;
  config?: Partial<Config>;
  db?: Db;
  now?: () => number;
}

/**
 * Caddy memakai `handle_path /nyebrang/*`, jadi prefix sudah dilepas sebelum sampai sini:
 * server melayani "/" (file game) dan "/api/*".
 */
export async function buildApp(opts: BuildOpts = {}): Promise<FastifyInstance> {
  const cfg = loadConfig(opts.config);
  const now = opts.now ?? Date.now;
  const db = opts.db ?? openDb(cfg.dbPath);

  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: "127.0.0.1",   // hanya percaya X-Forwarded-For dari Caddy lokal
    bodyLimit: 64 * 1024,
  });

  registerSecurityHeaders(app, cfg);

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, accepted: false, error: "rate_limited", retryAfterMs: ctx.ttl }),
  });

  app.setErrorHandler((err: { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err.validation) return reply.code(400).send({ error: "bad_request" });
    if (err.statusCode === 429) return reply.code(429).send(err);
    if ((err.statusCode ?? 500) < 500) return reply.code(err.statusCode ?? 400).send({ error: "bad_request" });
    req.log.error(err);
    return reply.code(500).send({ error: "server_error" });
  });

  await app.register(async (api) => {
    api.get("/health", async () => ({ ok: true, version: cfg.version }));
    runRoutes(api, db, cfg, now);
    leaderboardRoutes(api, db, now);
    if (cfg.adminToken) {
      const token = cfg.adminToken;
      await api.register(async (admin) => adminRoutes(admin, db, token), { prefix: "/admin" });
    }
  }, { prefix: "/api" });

  if (opts.serveClient !== false && existsSync(cfg.clientDist)) {
    await app.register(fastifyStatic, {
      root: cfg.clientDist,
      prefix: "/",
      index: ["index.html"],
      setHeaders: (res, filePath) => {
        if (filePath.includes("assets")) res.header("Cache-Control", "public, max-age=31536000, immutable");
        else res.header("Cache-Control", "no-cache");
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "not_found" });
    return reply.code(404).type("text/plain").send("Tidak ditemukan");
  });

  if (!opts.db) {
    cleanup(db, now());
    const timer = setInterval(() => cleanup(db, now()), 3600_000);
    timer.unref();
    app.addHook("onClose", async () => { clearInterval(timer); db.close(); });
  }
  return app;
}
