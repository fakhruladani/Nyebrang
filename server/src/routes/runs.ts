import { randomInt, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { FIXED_STEP_MS, LEADERBOARD_SIZE, MAX_RUN_TICKS } from "../../../shared/src/constants.js";
import { type InputRecord, replay } from "../../../shared/src/sim/replay.js";
import type { Config } from "../config.js";
import type { Db } from "../db.js";
import { rankFor, topScores } from "../leaderboard.js";
import { randomToken, safeEqual, sha256, sign } from "../token.js";

interface RunRow { id: string; seed: number; started_at: number; status: string; ip_hash: string }

/** Toleransi jam: tick simulasi tidak boleh melebihi waktu nyata + 2 detik (cegah speed-hack). */
const WALL_SLACK_MS = 2000;
const MAX_INPUTS = 200_000;

export function runRoutes(app: FastifyInstance, db: Db, cfg: Config, now: () => number): void {
  const ipHash = (ip: string) => sha256(`${cfg.runTokenSecret}:${ip}`).slice(0, 16);
  const tokenFor = (id: string, seed: number, started: number) => sign(cfg.runTokenSecret, `${id}.${seed}.${started}`);

  app.post("/runs", {
    config: { rateLimit: { max: 60, timeWindow: "1 hour" } },
  }, async (req) => {
    const id = randomUUID();
    const seed = randomInt(1, 2 ** 31 - 1);
    const started = now();
    db.prepare("INSERT INTO runs (id, seed, started_at, status, ip_hash) VALUES (?, ?, ?, 'active', ?)").run(id, seed, started, ipHash(req.ip));
    return { runId: id, seed, token: tokenFor(id, seed, started) };
  });

  app.post<{ Params: { id: string }; Body: { token: string; inputs: InputRecord[]; ticks: number; score: number } }>("/runs/:id/finish", {
    bodyLimit: 4 * 1024 * 1024,
    config: { rateLimit: { max: 60, timeWindow: "1 hour" } },
    schema: {
      params: { type: "object", properties: { id: { type: "string", maxLength: 64 } }, required: ["id"] },
      body: {
        type: "object",
        required: ["token", "inputs", "ticks", "score"],
        additionalProperties: false,
        properties: {
          token: { type: "string", maxLength: 128 },
          ticks: { type: "integer", minimum: 0, maximum: MAX_RUN_TICKS },
          score: { type: "integer", minimum: 0 },
          inputs: {
            type: "array", maxItems: MAX_INPUTS,
            items: { type: "array", minItems: 2, maxItems: 2, items: { type: "integer", minimum: 0 } },
          },
        },
      },
    },
  }, async (req, reply) => {
    const t = now();
    const run = db.prepare("SELECT id, seed, started_at, status, ip_hash FROM runs WHERE id = ?").get(req.params.id) as RunRow | undefined;
    if (!run) return reply.code(404).send({ accepted: false, error: "not_found" });
    if (run.status !== "active") return reply.code(409).send({ accepted: false, error: "already_finished" });
    if (!safeEqual(req.body.token, tokenFor(run.id, run.seed, run.started_at))) return reply.code(403).send({ accepted: false, error: "bad_token" });

    const reject = (reason: string) => {
      db.prepare("UPDATE runs SET status = 'rejected', reject_reason = ?, finished_at = ? WHERE id = ?").run(reason, t, run.id);
      req.log.warn({ run: run.id, reason }, "run ditolak");
      return reply.code(422).send({ accepted: false, error: "invalid_run", reason, top: topScores(db, t) });
    };

    const elapsed = t - run.started_at;
    if (elapsed > MAX_RUN_TICKS * FIXED_STEP_MS + 15 * 60_000) return reject("expired");
    if (req.body.ticks * FIXED_STEP_MS > elapsed + WALL_SLACK_MS) return reject("too_fast");

    const r = replay(run.seed, req.body.inputs as InputRecord[]);
    if (!r.ok) return reject(r.reason ?? "replay_failed");
    if (r.ticks !== req.body.ticks || r.score !== req.body.score) return reject("mismatch");

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE runs SET status = 'finished', finished_at = ?, ticks = ?, score = ?, distance = ?, coins = ? WHERE id = ?")
        .run(t, r.ticks, r.score, r.distance, r.coins, run.id);
      const rank = rankFor(db, r.score);
      const qualifies = r.score > 0 && rank <= LEADERBOARD_SIZE;
      let claimToken: string | undefined;
      if (qualifies) {
        claimToken = randomToken();
        db.prepare("INSERT INTO scores (run_id, name, score, distance, coins, created_at, claim_hash, claim_expires_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)")
          .run(run.id, r.score, r.distance, r.coins, t, sha256(claimToken), t + cfg.claimWindowMs);
      }
      db.exec("COMMIT");
      return {
        accepted: true, score: r.score, qualifies, rank: qualifies ? rank : undefined,
        claimToken, claimExpiresInMs: qualifies ? cfg.claimWindowMs : undefined, top: topScores(db, t),
      };
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
}
