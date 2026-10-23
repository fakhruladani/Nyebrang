import { LEADERBOARD_SIZE } from "../../shared/src/constants.js";
import type { Db } from "./db.js";

export interface LeaderEntry { rank: number; name: string; score: number; distance: number; date: string; pending: boolean }

interface Row { name: string | null; score: number; distance: number; created_at: number; claim_expires_at: number }

/** Top 5: skor tertinggi dulu; skor sama → yang lebih dulu dicapai di atas. */
export function topScores(db: Db, now: number): LeaderEntry[] {
  const rows = db.prepare(
    "SELECT name, score, distance, created_at, claim_expires_at FROM scores ORDER BY score DESC, id ASC LIMIT ?",
  ).all(LEADERBOARD_SIZE) as unknown as Row[];
  return rows.map((r, i) => {
    const pending = r.name === null && r.claim_expires_at > now;
    return {
      rank: i + 1,
      name: r.name ?? (pending ? "" : "ANONIM"),
      score: r.score,
      distance: r.distance,
      date: new Date(r.created_at).toISOString(),
      pending,
    };
  });
}

/** Peringkat yang akan didapat skor baru (skor sama yang sudah ada tetap di atas). */
export function rankFor(db: Db, score: number): number {
  const r = db.prepare("SELECT COUNT(*) AS n FROM scores WHERE score >= ?").get(score) as { n: number };
  return Number(r.n) + 1;
}
