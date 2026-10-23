import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

const devSecret = randomBytes(32).toString("base64");

export interface Config {
  host: string;
  port: number;
  publicOrigin: string;
  publicBase: string;
  clientDist: string;
  version: string;
  dbPath: string;
  runTokenSecret: string;
  adminToken: string | null;
  /** waktu menulis nama setelah masuk Top 5 */
  claimWindowMs: number;
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const secret = env("RUN_TOKEN_SECRET", "");
  if (!secret && process.env.NODE_ENV === "production") throw new Error("RUN_TOKEN_SECRET wajib di production");
  return {
    host: env("HOST", "127.0.0.1"),
    port: Number(env("PORT", "3100")),
    publicOrigin: env("PUBLIC_ORIGIN", "http://localhost:5173"),
    publicBase: env("PUBLIC_BASE", "/nyebrang/"),
    clientDist: env("CLIENT_DIST", path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? "../../../../client/dist" : "../../client/dist")),
    version: env("APP_VERSION", "1.0.1"),
    dbPath: env("DB_PATH", path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? "../../../data/game.db" : "../data/game.db")),
    runTokenSecret: secret || devSecret,
    adminToken: env("ADMIN_TOKEN", "") || null,
    claimWindowMs: Number(env("CLAIM_WINDOW_MS", "120000")),
    ...overrides,
  };
}
