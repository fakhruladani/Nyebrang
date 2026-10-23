import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/** SQLite bawaan Node (node:sqlite). Satu file, terpisah total dari PostgreSQL Catatku. */
export type Db = DatabaseSync;

export function openDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      seed INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL CHECK (status IN ('active','finished','rejected')),
      reject_reason TEXT,
      ticks INTEGER,
      score INTEGER,
      distance INTEGER,
      coins INTEGER,
      ip_hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS runs_started ON runs(started_at);
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
      name TEXT,
      score INTEGER NOT NULL,
      distance INTEGER NOT NULL,
      coins INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      claim_hash TEXT,
      claim_expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS scores_rank ON scores(score DESC, id ASC);
    CREATE UNIQUE INDEX IF NOT EXISTS scores_claim ON scores(claim_hash) WHERE claim_hash IS NOT NULL;
  `);
  return db;
}

/** Bersihkan run yang tak pernah selesai (>4 jam) dan run lama yang tidak masuk leaderboard (>30 hari). */
export function cleanup(db: Db, now: number): void {
  db.prepare("DELETE FROM runs WHERE status = 'active' AND started_at < ?").run(now - 4 * 3600_000);
  db.prepare("DELETE FROM runs WHERE status != 'active' AND started_at < ? AND id NOT IN (SELECT run_id FROM scores)").run(now - 30 * 86400_000);
}
