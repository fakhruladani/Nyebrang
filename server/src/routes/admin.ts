import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";
import { safeEqual } from "../token.js";

/** Moderasi manual (hapus entri curang/nama tidak pantas). Aktif hanya jika ADMIN_TOKEN diisi. */
export function adminRoutes(app: FastifyInstance, db: Db, adminToken: string): void {
  app.addHook("onRequest", async (req, reply) => {
    const h = req.headers["x-admin-token"];
    if (typeof h !== "string" || !safeEqual(h, adminToken)) return reply.code(401).send({ error: "unauthorized" });
  });

  app.get("/scores", async () => ({
    scores: db.prepare("SELECT s.id, s.name, s.score, s.distance, s.coins, s.created_at, r.ip_hash FROM scores s JOIN runs r ON r.id = s.run_id ORDER BY s.score DESC, s.id ASC LIMIT 100").all(),
  }));

  app.delete<{ Params: { id: string } }>("/scores/:id", async (req, reply) => {
    const res = db.prepare("DELETE FROM scores WHERE id = ?").run(Number(req.params.id));
    if (Number(res.changes) === 0) return reply.code(404).send({ error: "not_found" });
    return { ok: true };
  });

  app.patch<{ Params: { id: string }; Body: { name: string } }>("/scores/:id", {
    schema: { body: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 12 } } } },
  }, async (req) => {
    db.prepare("UPDATE scores SET name = ?, claim_hash = NULL WHERE id = ?").run(req.body.name, Number(req.params.id));
    return { ok: true };
  });
}
