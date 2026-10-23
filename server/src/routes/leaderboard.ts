import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";
import { topScores } from "../leaderboard.js";
import { isBadName, normalizeName } from "../names.js";
import { sha256 } from "../token.js";

export function leaderboardRoutes(app: FastifyInstance, db: Db, now: () => number): void {
  app.get("/leaderboard", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { top: topScores(db, now()) };
  });

  app.post<{ Body: { claimToken: string; name: string } }>("/leaderboard/claim", {
    config: { rateLimit: { max: 20, timeWindow: "10 minutes" } },
    schema: {
      body: {
        type: "object", required: ["claimToken", "name"], additionalProperties: false,
        properties: { claimToken: { type: "string", minLength: 10, maxLength: 128 }, name: { type: "string", maxLength: 40 } },
      },
    },
  }, async (req, reply) => {
    const t = now();
    const name = normalizeName(req.body.name);
    if (!name) return reply.code(400).send({ error: "invalid_name" });
    if (isBadName(name)) return reply.code(400).send({ error: "bad_word" });
    const row = db.prepare("SELECT id, claim_expires_at FROM scores WHERE claim_hash = ? AND name IS NULL")
      .get(sha256(req.body.claimToken)) as { id: number; claim_expires_at: number } | undefined;
    if (!row) return reply.code(404).send({ error: "not_found" });
    if (row.claim_expires_at <= t) {
      db.prepare("UPDATE scores SET claim_hash = NULL WHERE id = ?").run(row.id);
      return reply.code(410).send({ error: "expired" });
    }
    db.prepare("UPDATE scores SET name = ?, claim_hash = NULL WHERE id = ?").run(name, row.id);
    return { ok: true, top: topScores(db, t) };
  });
}
