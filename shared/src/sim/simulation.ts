import {
  BACK_LIMIT, GRID_COLUMNS, HOP_COOLDOWN_TICKS, IDLE_LIMIT_MIN_TICKS, IDLE_LIMIT_START_TICKS,
  POINTS_PER_COIN, POINTS_PER_ROW, POWER_DURATION_TICKS, STEP_S,
} from "../constants.js";
import { type Lane, type PowerKind, World, moverX, patrolX } from "./world.js";

/**
 * Simulasi game murni (tanpa render, tanpa waktu dinding). Dipakai klien untuk bermain
 * dan server untuk memutar ulang run dari seed + log input (anti-cheat Level 2).
 */

export type Dir = 0 | 1 | 2 | 3; // 0 maju, 1 mundur, 2 kiri, 3 kanan
export const DIR_DELTA: Record<Dir, [number, number]> = { 0: [0, 1], 1: [0, -1], 2: [-1, 0], 3: [1, 0] };

export type DeathCause = "tertabrak" | "kereta" | "tenggelam" | "hanyut" | "diserang" | "kelamaan";
export type InputResult = "ok" | "cooldown" | "blocked" | "dead";
export type SimEvent =
  | { type: "hop" }
  | { type: "coin"; row: number; col: number }
  | { type: "power"; kind: PowerKind }
  | { type: "death"; cause: DeathCause };

export interface SimState {
  tick: number;
  /** waktu dunia (detik); melambat saat power-up slow aktif */
  worldTime: number;
  /** posisi kolom (pecahan saat menumpang kayu) */
  px: number;
  row: number;
  maxRow: number;
  coins: number;
  alive: boolean;
  death: DeathCause | null;
  idleTicks: number;
  lastHopTick: number;
  hopFrom: { px: number; row: number };
  ghostUntil: number;
  magnetUntil: number;
  slowUntil: number;
  collected: Set<string>;
}

const PLAYER_HALF = 0.3;
const MOVER_PAD = 0.4;
const PATROL_HALF = 0.35;

export function idleLimit(maxRow: number): number {
  return Math.max(IDLE_LIMIT_MIN_TICKS, IDLE_LIMIT_START_TICKS - Math.floor(maxRow / 50) * 30);
}

export function scoreOf(maxRow: number, coins: number): number {
  return maxRow * POINTS_PER_ROW + coins * POINTS_PER_COIN;
}

export class Simulation {
  readonly world: World;
  state: SimState;
  /** event dari langkah/input terakhir; dikosongkan oleh pemanggil */
  events: SimEvent[] = [];

  constructor(seed: number, world?: World) {
    this.world = world ?? new World(seed);
    const col = Math.floor(GRID_COLUMNS / 2);
    this.state = {
      tick: 0, worldTime: 0, px: col, row: 0, maxRow: 0, coins: 0, alive: true, death: null,
      idleTicks: 0, lastHopTick: -HOP_COOLDOWN_TICKS, hopFrom: { px: col, row: 0 },
      ghostUntil: 0, magnetUntil: 0, slowUntil: 0, collected: new Set(),
    };
  }

  get score(): number {
    return scoreOf(this.state.maxRow, this.state.coins);
  }

  clone(): Simulation {
    const c = new Simulation(this.world.seed, this.world);
    c.state = { ...this.state, hopFrom: { ...this.state.hopFrom }, collected: new Set(this.state.collected) };
    return c;
  }

  canHop(): boolean {
    return this.state.alive && this.state.tick - this.state.lastHopTick >= HOP_COOLDOWN_TICKS;
  }

  /** Terapkan input pada tick saat ini (sebelum step()). */
  input(dir: Dir): InputResult {
    const s = this.state;
    if (!s.alive) return "dead";
    if (!this.canHop()) return "cooldown";
    const [dc, dr] = DIR_DELTA[dir];
    const newRow = s.row + dr;
    if (newRow < 0 || newRow < s.maxRow - BACK_LIMIT) return "blocked";
    const from = this.world.lane(s.row);
    const to = this.world.lane(newRow);

    let newPx: number;
    if (to.kind === "water") {
      newPx = s.px + dc;
      if (from.kind !== "water") newPx = Math.round(newPx);
      if (newPx < -0.4 || newPx > GRID_COLUMNS - 0.6) return "blocked";
    } else {
      newPx = Math.round(s.px) + dc;
      if (newPx < 0 || newPx > GRID_COLUMNS - 1) return "blocked";
      if (to.trees.includes(newPx)) return "blocked";
    }

    s.hopFrom = { px: s.px, row: s.row };
    s.px = newPx;
    s.row = newRow;
    s.lastHopTick = s.tick;
    if (newRow > s.maxRow) {
      s.maxRow = newRow;
      s.idleTicks = 0;
    }
    this.events.push({ type: "hop" });
    return "ok";
  }

  /** Maju satu tick. */
  step(): void {
    const s = this.state;
    if (!s.alive) return;
    s.tick++;
    const scale = s.tick <= s.slowUntil ? 0.5 : 1;
    s.worldTime += STEP_S * scale;
    const lane = this.world.lane(s.row);
    const t = s.worldTime;
    const ghost = s.tick <= s.ghostUntil;

    if (lane.kind === "water") {
      const log = lane.movers.find((m) => {
        const x = moverX(lane, m, t);
        return s.px >= x - 0.5 && s.px <= x + m.len - 0.5;
      });
      if (!log) return this.die("tenggelam");
      s.px += lane.dir * lane.speed * STEP_S * scale;
      if (s.px < -0.5 || s.px > GRID_COLUMNS - 0.5) return this.die("hanyut");
    } else if (!ghost) {
      if (lane.kind === "road" || lane.kind === "rail") {
        for (const m of lane.movers) {
          const x = moverX(lane, m, t);
          if (s.px + PLAYER_HALF > x - MOVER_PAD && s.px - PLAYER_HALF < x + m.len - 1 + MOVER_PAD) {
            return this.die(lane.kind === "rail" ? "kereta" : "tertabrak");
          }
        }
      }
      if (lane.patrol) {
        const ex = patrolX(lane, t);
        if (Math.abs(s.px - ex) < PLAYER_HALF + PATROL_HALF) return this.die("diserang");
      }
    }

    this.collect(lane);
    if (s.tick <= s.magnetUntil) {
      for (let r = s.row - 1; r <= s.row + 2; r++) {
        if (r === s.row || r < 0) continue;
        const l = this.world.lane(r);
        if (l.coin !== null && Math.abs(l.coin - s.px) <= 2) this.takeCoin(l);
      }
    }

    s.idleTicks++;
    if (s.idleTicks >= idleLimit(s.maxRow)) this.die("kelamaan");
  }

  private collect(lane: Lane): void {
    const s = this.state;
    const col = Math.round(s.px);
    if (lane.coin !== null && lane.coin === col) this.takeCoin(lane);
    if (lane.power && lane.power.col === col) {
      const key = `p${lane.row}`;
      if (!s.collected.has(key)) {
        s.collected.add(key);
        const k = lane.power.kind;
        if (k === "time") s.idleTicks = 0;
        else if (k === "ghost") s.ghostUntil = s.tick + POWER_DURATION_TICKS.ghost;
        else if (k === "magnet") s.magnetUntil = s.tick + POWER_DURATION_TICKS.magnet;
        else s.slowUntil = s.tick + POWER_DURATION_TICKS.slow;
        this.events.push({ type: "power", kind: k });
      }
    }
  }

  private takeCoin(lane: Lane): void {
    const key = `c${lane.row}`;
    if (lane.coin === null || this.state.collected.has(key)) return;
    this.state.collected.add(key);
    this.state.coins++;
    this.events.push({ type: "coin", row: lane.row, col: lane.coin });
  }

  private die(cause: DeathCause): void {
    this.state.alive = false;
    this.state.death = cause;
    this.events.push({ type: "death", cause });
  }
}
