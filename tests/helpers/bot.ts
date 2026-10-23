import { type Dir, Simulation } from "../../shared/src/sim/simulation";
import type { InputRecord } from "../../shared/src/sim/replay";

/** Bot sederhana untuk uji keseimbangan & replay: maju jika aman, kalau tidak geser/tunggu/mundur. */
export function playBot(seed: number, opts: { lookahead?: number; maxTicks?: number; stopAtRow?: number } = {}) {
  const look = opts.lookahead ?? 30;
  const maxTicks = opts.maxTicks ?? 60 * 60 * 10;
  const sim = new Simulation(seed);
  const inputs: InputRecord[] = [];
  const safe = (dir: Dir | null, ticks: number) => {
    const c = sim.clone();
    if (dir !== null && c.input(dir) !== "ok") return false;
    for (let i = 0; i < ticks && c.state.alive; i++) c.step();
    return c.state.alive;
  };
  while (sim.state.alive && sim.state.tick < maxTicks) {
    if (opts.stopAtRow && sim.state.maxRow >= opts.stopAtRow) break;
    if (sim.canHop()) {
      let chosen: Dir | null = null;
      // pohon di depan? geser ke kolom bebas terdekat di lajur depan
      const next = sim.world.lane(sim.state.row + 1);
      const col = Math.round(sim.state.px);
      let order: Dir[] = [0, 2, 3];
      if (next.trees.includes(col)) {
        let best = 99;
        for (let c = 0; c < 9; c++) if (!next.trees.includes(c) && Math.abs(c - col) < Math.abs(best - col)) best = c;
        order = best < col ? [2, 3, 1] : [3, 2, 1];
      }
      for (const d of order) if (safe(d, look)) { chosen = d; break; }
      if (chosen === null && !safe(null, 12)) {
        for (const d of [1, 2, 3] as Dir[]) if (safe(d, 12)) { chosen = d; break; }
      }
      if (chosen !== null && sim.input(chosen) === "ok") inputs.push([sim.state.tick, chosen]);
    }
    sim.step();
    sim.events.length = 0;
  }
  return { sim, inputs };
}
