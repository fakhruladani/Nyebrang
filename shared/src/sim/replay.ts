import { MAX_RUN_TICKS } from "../constants.js";
import { type DeathCause, type Dir, Simulation } from "./simulation.js";

/** Satu input terekam: [tick saat diterapkan, arah]. */
export type InputRecord = [number, Dir];

export interface ReplayResult {
  ok: boolean;
  reason?: "bad_input" | "input_rejected" | "not_dead" | "too_long";
  ticks: number;
  score: number;
  distance: number;
  coins: number;
  death: DeathCause | null;
}

/**
 * Putar ulang run dari seed + input. Run dianggap valid hanya jika setiap input diterima
 * simulasi pada tick yang sama dan pemain mati sebelum batas tick.
 */
export function replay(seed: number, inputs: readonly InputRecord[], maxTicks = MAX_RUN_TICKS): ReplayResult {
  const sim = new Simulation(seed);
  const result = (ok: boolean, reason?: ReplayResult["reason"]): ReplayResult => ({
    ok, reason, ticks: sim.state.tick, score: sim.score, distance: sim.state.maxRow,
    coins: sim.state.coins, death: sim.state.death,
  });

  let prev = -1;
  for (const rec of inputs) {
    if (!Array.isArray(rec) || rec.length !== 2) return result(false, "bad_input");
    const [tick, dir] = rec;
    if (!Number.isInteger(tick) || tick <= prev || tick < 0 || ![0, 1, 2, 3].includes(dir)) return result(false, "bad_input");
    prev = tick;
  }

  let i = 0;
  while (sim.state.alive) {
    if (sim.state.tick >= maxTicks) return result(false, "too_long");
    while (i < inputs.length && (inputs[i] as InputRecord)[0] === sim.state.tick) {
      if (sim.input((inputs[i] as InputRecord)[1]) !== "ok") return result(false, "input_rejected");
      i++;
    }
    if (i < inputs.length && (inputs[i] as InputRecord)[0] < sim.state.tick) return result(false, "input_rejected");
    sim.step();
    sim.events.length = 0;
  }
  // input setelah mati = tidak sah
  if (i < inputs.length) return result(false, "input_rejected");
  return result(true);
}
