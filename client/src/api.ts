import type { InputRecord } from "@shared/sim/replay";

/** Semua panggilan API lewat sini. BASE_URL = "/nyebrang/"; CSP hanya mengizinkan path API game. */
const API = `${import.meta.env.BASE_URL}api`;

export interface Health { ok: boolean; version: string }
export interface RunTicket { runId: string; seed: number; token: string }
export interface LeaderEntry { rank: number; name: string; score: number; distance: number; date: string; pending: boolean }
export interface FinishResult {
  accepted: boolean;
  reason?: string;
  score: number;
  qualifies: boolean;
  rank?: number;
  claimToken?: string;
  claimExpiresInMs?: number;
  top: LeaderEntry[];
}

async function call<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init?.timeoutMs ?? 6000);
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      signal: ctl.signal,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) return (data && typeof data === "object" ? { ...(data as object), __status: res.status } : null) as T | null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => call<Health>("/health"),
  leaderboard: () => call<{ top: LeaderEntry[] }>("/leaderboard").then((r) => r?.top ?? null),
  startRun: () => call<RunTicket>("/runs", { method: "POST", body: "{}", timeoutMs: 4000 }).then((r) => (r && "runId" in r ? r : null)),
  finishRun: (runId: string, body: { token: string; inputs: InputRecord[]; ticks: number; score: number }) =>
    call<FinishResult & { error?: string }>(`/runs/${encodeURIComponent(runId)}/finish`, { method: "POST", body: JSON.stringify(body), timeoutMs: 15000 }),
  claim: (claimToken: string, name: string) =>
    call<{ ok?: boolean; error?: string; top?: LeaderEntry[] }>("/leaderboard/claim", { method: "POST", body: JSON.stringify({ claimToken, name }) }),
};
