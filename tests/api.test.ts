import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server/src/app";
import { openDb, type Db } from "../server/src/db";
import { FIXED_STEP_MS } from "../shared/src/constants";
import { playBot } from "./helpers/bot";

let clock = 1_800_000_000_000;
const now = () => clock;
let app: FastifyInstance;
let db: Db;

async function start() {
  const r = await app.inject({ method: "POST", url: "/api/runs", payload: {} });
  expect(r.statusCode).toBe(200);
  return r.json() as { runId: string; seed: number; token: string };
}

/** main dengan bot memakai seed dari server, lalu majukan jam sesuai durasi run */
async function playAndFinish(stopAtRow?: number, mutate?: (b: Record<string, unknown>) => void) {
  const t = await start();
  const { sim, inputs } = playBot(t.seed, { stopAtRow });
  // bot berhenti di stopAtRow tanpa mati: biarkan diam sampai mati
  while (sim.state.alive) sim.step();
  clock += Math.ceil(sim.state.tick * FIXED_STEP_MS) + 500;
  const body: Record<string, unknown> = { token: t.token, inputs, ticks: sim.state.tick, score: sim.score };
  mutate?.(body);
  const r = await app.inject({ method: "POST", url: `/api/runs/${t.runId}/finish`, payload: body });
  return { r, sim, t };
}

beforeEach(async () => {
  db = openDb(":memory:");
  app = await buildApp({ serveClient: false, db, now, config: { runTokenSecret: "test-secret", adminToken: "admin-token-123456" } });
});

describe("Run & leaderboard", () => {
  it("run valid diterima dan masuk Top 5 saat leaderboard kosong", async () => {
    const { r, sim } = await playAndFinish(30);
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.accepted).toBe(true);
    expect(j.score).toBe(sim.score);
    expect(j.qualifies).toBe(true);
    expect(j.rank).toBe(1);
    expect(typeof j.claimToken).toBe("string");
    expect(j.top[0].pending).toBe(true);
  });

  it("skor dipalsukan ditolak (mismatch)", async () => {
    const { r } = await playAndFinish(20, (b) => { b.score = (b.score as number) + 1000; });
    expect(r.statusCode).toBe(422);
    expect(r.json().reason).toBe("mismatch");
  });

  it("speed-hack ditolak (tick melebihi waktu nyata)", async () => {
    const t = await start();
    const { sim, inputs } = playBot(t.seed, { stopAtRow: 20 });
    while (sim.state.alive) sim.step();
    clock += 1000; // hanya 1 detik berlalu
    const r = await app.inject({ method: "POST", url: `/api/runs/${t.runId}/finish`, payload: { token: t.token, inputs, ticks: sim.state.tick, score: sim.score } });
    expect(r.statusCode).toBe(422);
    expect(r.json().reason).toBe("too_fast");
  });

  it("token salah ditolak, run tidak bisa dikirim dua kali", async () => {
    const { r, t } = await playAndFinish(10);
    expect(r.statusCode).toBe(200);
    const again = await app.inject({ method: "POST", url: `/api/runs/${t.runId}/finish`, payload: { token: t.token, inputs: [], ticks: 0, score: 0 } });
    expect(again.statusCode).toBe(409);
    const t2 = await start();
    const bad = await app.inject({ method: "POST", url: `/api/runs/${t2.runId}/finish`, payload: { token: "x".repeat(43), inputs: [], ticks: 0, score: 0 } });
    expect(bad.statusCode).toBe(403);
  });

  it("klaim nama: valid, sekali pakai, filter kata kasar, kedaluwarsa → ANONIM", async () => {
    const a = (await playAndFinish(25)).r.json();
    const badWord = await app.inject({ method: "POST", url: "/api/leaderboard/claim", payload: { claimToken: a.claimToken, name: "anjing 1" } });
    expect(badWord.json().error).toBe("bad_word");
    const badChars = await app.inject({ method: "POST", url: "/api/leaderboard/claim", payload: { claimToken: a.claimToken, name: "<script>" } });
    expect(badChars.json().error).toBe("invalid_name");
    const ok = await app.inject({ method: "POST", url: "/api/leaderboard/claim", payload: { claimToken: a.claimToken, name: "  Dani   PT21 " } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().top[0].name).toBe("Dani PT21");
    const reuse = await app.inject({ method: "POST", url: "/api/leaderboard/claim", payload: { claimToken: a.claimToken, name: "Lain" } });
    expect(reuse.statusCode).toBe(404);

    const b = (await playAndFinish(15)).r.json();
    expect(b.qualifies).toBe(true);
    clock += 121_000;
    const late = await app.inject({ method: "POST", url: "/api/leaderboard/claim", payload: { claimToken: b.claimToken, name: "Telat" } });
    expect(late.statusCode).toBe(410);
    const lb = (await app.inject({ method: "GET", url: "/api/leaderboard" })).json();
    expect(lb.top.some((e: { name: string }) => e.name === "ANONIM")).toBe(true);
  });

  it("hanya 5 teratas; skor sama → yang lebih dulu tetap di atas", async () => {
    // isi 5 skor 100 langsung di DB
    for (let i = 0; i < 5; i++) {
      db.prepare("INSERT INTO runs (id, seed, started_at, status, ip_hash) VALUES (?, 1, 0, 'finished', 'x')").run(`r${i}`);
      db.prepare("INSERT INTO scores (run_id, name, score, distance, coins, created_at, claim_hash, claim_expires_at) VALUES (?, ?, 100, 100, 0, ?, NULL, 0)").run(`r${i}`, `P${i}`, i);
    }
    const { r } = await playAndFinish(12); // skor < 100
    expect(r.json().qualifies).toBe(false);
    const lb = (await app.inject({ method: "GET", url: "/api/leaderboard" })).json();
    expect(lb.top.map((e: { name: string }) => e.name)).toEqual(["P0", "P1", "P2", "P3", "P4"]);
  });

  it("admin: tanpa token 401, dengan token bisa hapus", async () => {
    const a = (await playAndFinish(10)).r.json();
    expect(a.accepted).toBe(true);
    expect((await app.inject({ method: "GET", url: "/api/admin/scores" })).statusCode).toBe(401);
    const list = (await app.inject({ method: "GET", url: "/api/admin/scores", headers: { "x-admin-token": "admin-token-123456" } })).json();
    const id = list.scores[0].id;
    const del = await app.inject({ method: "DELETE", url: `/api/admin/scores/${id}`, headers: { "x-admin-token": "admin-token-123456" } });
    expect(del.statusCode).toBe(200);
  });

  it("body tidak valid → 400", async () => {
    const t = await start();
    const r = await app.inject({ method: "POST", url: `/api/runs/${t.runId}/finish`, payload: { token: t.token, inputs: "x", ticks: 1, score: 1 } });
    expect(r.statusCode).toBe(400);
  });
});
