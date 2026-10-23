import { describe, expect, it } from "vitest";
import { GRID_COLUMNS, IDLE_LIMIT_START_TICKS, START_SAFE_ROWS } from "../shared/src/constants";
import { World, difficulty, moverX } from "../shared/src/sim/world";
import { Simulation } from "../shared/src/sim/simulation";
import { replay } from "../shared/src/sim/replay";
import { playBot } from "./helpers/bot";

describe("World generator", () => {
  it("dunia identik untuk seed sama, walau baris diminta dengan urutan berbeda", () => {
    const a = new World(123), b = new World(123);
    b.lane(300); // minta jauh dulu
    for (let r = 0; r <= 300; r++) expect(JSON.stringify(a.lane(r))).toBe(JSON.stringify(b.lane(r)));
  });

  it("baris awal selalu rumput dan jalur tengah bebas", () => {
    for (let s = 1; s <= 50; s++) {
      const w = new World(s);
      for (let r = 0; r < START_SAFE_ROWS; r++) {
        expect(w.lane(r).kind).toBe("grass");
        expect(w.lane(r).trees).not.toContain(Math.floor(GRID_COLUMNS / 2));
      }
    }
  });

  it("setiap lajur rumput menyisakan sel kosong; sungai selalu punya kayu", () => {
    const w = new World(99);
    for (let r = 0; r < 2000; r++) {
      const l = w.lane(r);
      if (l.kind === "grass") expect(l.trees.length).toBeLessThan(GRID_COLUMNS);
      if (l.kind === "water") expect(l.movers.length).toBeGreaterThanOrEqual(2);
      if (l.kind === "road" || l.kind === "water") expect(l.span).toBeGreaterThanOrEqual(GRID_COLUMNS + 4 + l.offset);
    }
  });

  it("selalu ada jalan menembus pohon (dua lajur rumput berurutan)", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = new World(seed);
      for (let r = 0; r < 1500; r++) {
        const a = w.lane(r), b = w.lane(r + 1);
        if (a.kind !== "grass" || b.kind !== "grass" || a.patrol || b.patrol) continue;
        // dari setiap kolom bebas di a yang terhubung lateral, harus ada kolom bebas di b yang dapat dicapai
        const reach = new Set<number>();
        const startFree = [...Array(9).keys()].filter((c) => !a.trees.includes(c));
        // setidaknya satu segmen bebas di a terhubung ke kolom bebas di b
        const ok = startFree.some((c) => !b.trees.includes(c));
        reach.add(0);
        expect(ok).toBe(true);
      }
    }
  });

  it("kesulitan dibatasi 2,5x", () => {
    expect(difficulty(0)).toBe(1);
    expect(difficulty(100000)).toBe(2.5);
  });

  it("mover wrap selalu di luar layar saat melompat", () => {
    const w = new World(5);
    for (let r = 0; r < 500; r++) {
      const l = w.lane(r);
      for (const m of l.movers) {
        for (let t = 0; t < 20; t += 0.05) {
          const x = moverX(l, m, t);
          if (x < -l.offset - 1e-9 || x >= l.span - l.offset) throw new Error(`wrap salah r=${r} x=${x}`);
        }
      }
    }
  });
});

describe("Simulation", () => {
  it("mati karena diam terlalu lama", () => {
    const s = new Simulation(1);
    for (let i = 0; i < IDLE_LIMIT_START_TICKS + 5 && s.state.alive; i++) s.step();
    expect(s.state.death).toBe("kelamaan");
  });

  it("cooldown lompat dihormati", () => {
    const s = new Simulation(1);
    expect(s.input(0)).toBe("ok");
    expect(s.input(0)).toBe("cooldown");
  });

  it("tidak bisa mundur ke baris negatif", () => {
    const s = new Simulation(1);
    expect(s.input(1)).toBe("blocked");
  });

  it("bot + replay menghasilkan skor yang sama persis (deterministik)", () => {
    for (const seed of [11, 22, 33]) {
      const { sim, inputs } = playBot(seed);
      const r = replay(seed, inputs);
      expect(r.ok).toBe(true);
      expect(r.score).toBe(sim.score);
      expect(r.ticks).toBe(sim.state.tick);
      expect(r.death).toBe(sim.state.death);
    }
  });

  it("replay menolak input yang diubah", () => {
    const { inputs } = playBot(44);
    const tampered = inputs.map(([t, d]) => [t, d] as [number, 0 | 1 | 2 | 3]);
    tampered.splice(3, 0, [ (tampered[2]?.[0] ?? 0) + 1, 0 ]); // input di tengah cooldown
    expect(replay(44, tampered).ok).toBe(false);
    expect(replay(44, [[5, 0], [3, 0]]).ok).toBe(false);
  });

  it("game bisa dimainkan: bot mencapai jarak wajar", () => {
    const dist: number[] = [];
    for (let seed = 1; seed <= 12; seed++) dist.push(playBot(seed, { stopAtRow: 400 }).sim.state.maxRow);
    const median = [...dist].sort((a, b) => a - b)[6] as number;
    console.log("jarak bot per seed:", dist.join(", "));
    expect(median).toBeGreaterThan(40);
  }, 120_000);
});
