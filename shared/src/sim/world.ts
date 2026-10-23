import { GRID_COLUMNS, SIDE_MARGIN, START_SAFE_ROWS } from "../constants.js";
import { SeededRng } from "../rng.js";

/**
 * Generator dunia endless. Lajur dibangkitkan BERURUTAN dari baris 0 dengan satu aliran RNG,
 * sehingga klien dan server selalu mendapat dunia yang sama untuk seed yang sama,
 * berapa pun baris yang diminta lebih dulu.
 *
 * Aturan determinisme: hanya + - * / %, Math.floor/round/abs/min/max. Tanpa sin/cos/pow di sini.
 */

export type LaneKind = "grass" | "road" | "water" | "rail";
export type PowerKind = "ghost" | "time" | "magnet" | "slow";

export interface Mover {
  /** posisi awal dalam ruang wrap [0, span) */
  x0: number;
  /** panjang dalam sel */
  len: number;
}

export interface Lane {
  row: number;
  kind: LaneKind;
  dir: 1 | -1;
  /** sel per detik (waktu dunia) */
  speed: number;
  /** panjang siklus wrap */
  span: number;
  /** pergeseran agar mover yang di-wrap selalu muncul/hilang di luar layar */
  offset: number;
  movers: Mover[];
  trees: number[];
  coin: number | null;
  power: { col: number; kind: PowerKind } | null;
  /** musuh patroli bolak-balik di lajur rumput (sel/detik) */
  patrol: { speed: number; phase: number } | null;
}

/** Pengali kecepatan berdasarkan jarak; dibatasi 2,5x supaya tetap bisa dimainkan. */
export function difficulty(row: number): number {
  return 1 + Math.min(row / 200, 1.5);
}

/** Posisi kolom kiri sebuah mover pada waktu dunia t (detik). */
export function moverX(lane: Lane, m: Mover, t: number): number {
  const raw = m.x0 + lane.dir * lane.speed * t;
  const w = ((raw % lane.span) + lane.span) % lane.span;
  return w - lane.offset;
}

/** Posisi musuh patroli (gelombang segitiga 0..GRID_COLUMNS-1). */
export function patrolX(lane: Lane, t: number): number {
  if (!lane.patrol) return -100;
  const range = GRID_COLUMNS - 1;
  const p = (lane.patrol.phase + lane.patrol.speed * t) % (2 * range);
  return p <= range ? p : 2 * range - p;
}

interface Segment { kind: LaneKind; remaining: number }

const BLOCKED_LANE: Lane = Object.freeze({
  row: -1, kind: "grass", dir: 1, speed: 0, span: 1, offset: 0, movers: [],
  trees: Array.from({ length: GRID_COLUMNS }, (_, i) => i), coin: null, power: null, patrol: null,
}) as Lane;

export class World {
  private readonly rng: SeededRng;
  private readonly lanes: Lane[] = [];
  private segment: Segment = { kind: "grass", remaining: START_SAFE_ROWS };
  private lastKind: LaneKind = "grass";
  private lastWaterDir: 1 | -1 = 1;
  /** kolom yang dijamin bebas pohon, bergeser pelan: menjamin selalu ada jalan maju */
  private pathCol = Math.floor(GRID_COLUMNS / 2);

  constructor(readonly seed: number) {
    this.rng = new SeededRng(seed);
  }

  lane(row: number): Lane {
    if (row < 0) return BLOCKED_LANE;
    while (this.lanes.length <= row) this.lanes.push(this.generate(this.lanes.length));
    return this.lanes[row] as Lane;
  }

  private pickSegment(row: number): Segment {
    const r = this.rng;
    const opts: [LaneKind, number][] = [
      ["grass", this.lastKind === "grass" ? 0 : 30],
      ["road", this.lastKind === "road" ? 0 : 36],
      ["water", row >= 12 && this.lastKind !== "water" ? 24 : 0],
      ["rail", row >= 50 && this.lastKind !== "rail" ? 11 : 0],
    ];
    const total = opts.reduce((s, o) => s + o[1], 0);
    let pick = r.next() * total;
    let kind: LaneKind = "grass";
    for (const [k, w] of opts) {
      if (pick < w) { kind = k; break; }
      pick -= w;
    }
    const maxCount: Record<LaneKind, number> = {
      grass: 2,
      road: row < 40 ? 2 : row < 150 ? 3 : 4,
      water: row < 80 ? 2 : 3,
      rail: 2,
    };
    return { kind, remaining: r.int(1, maxCount[kind]) };
  }

  private generate(row: number): Lane {
    if (this.segment.remaining <= 0) this.segment = this.pickSegment(row);
    this.segment.remaining--;
    const kind = this.segment.kind;
    this.lastKind = kind;
    const r = this.rng;
    const mul = difficulty(row);
    const lane: Lane = {
      row, kind, dir: r.next() < 0.5 ? 1 : -1, speed: 0, span: 1, offset: 0,
      movers: [], trees: [], coin: null, power: null, patrol: null,
    };

    if (kind === "grass") {
      if (row >= 120 && r.next() < 0.35) {
        lane.patrol = { speed: (1.2 + r.next() * 0.8) * Math.min(mul, 2), phase: r.next() * 16 };
      } else {
        const maxTrees = row < START_SAFE_ROWS ? 0 : row < 10 ? 2 : 4;
        const n = r.int(0, maxTrees);
        const oldPath = this.pathCol;
        const shift = r.int(-1, 1);
        this.pathCol = Math.max(0, Math.min(GRID_COLUMNS - 1, oldPath + shift));
        for (let i = 0; i < n; i++) {
          const c = r.int(0, GRID_COLUMNS - 1);
          if (!lane.trees.includes(c) && c !== oldPath && c !== this.pathCol) lane.trees.push(c);
        }
        if (row > 0 && row < START_SAFE_ROWS) lane.trees.push(0, GRID_COLUMNS - 1);
      }
    } else if (kind === "road") {
      lane.speed = Math.min((1.2 + r.next() * 1.4) * mul, 6.5);
      const truck = r.next() < 0.25;
      const len = truck ? 2 : 1;
      const n = Math.max(1, Math.min(4, Math.floor(1 + r.next() * 2 + row / 120)));
      lane.offset = SIDE_MARGIN + len;
      lane.span = GRID_COLUMNS + SIDE_MARGIN + lane.offset + Math.floor(r.next() * 6);
      const gap = lane.span / n;
      for (let i = 0; i < n; i++) lane.movers.push({ x0: i * gap + r.next() * Math.max(0, gap - len - 1.5), len });
    } else if (kind === "water") {
      lane.dir = this.lastWaterDir === 1 ? -1 : 1;
      this.lastWaterDir = lane.dir;
      lane.speed = (0.9 + r.next() * 0.9) * Math.min(mul, 1.8);
      const len = row < 100 ? r.int(3, 4) : row < 250 ? r.int(2, 4) : r.int(2, 3);
      lane.offset = SIDE_MARGIN + len;
      lane.span = GRID_COLUMNS + SIDE_MARGIN + lane.offset + r.int(0, 3);
      const n = Math.max(2, Math.floor(lane.span / (len + 2.2)));
      const gap = lane.span / n;
      for (let i = 0; i < n; i++) lane.movers.push({ x0: i * gap + r.next() * 0.8, len });
    } else {
      // rel kereta: satu kereta panjang, sangat cepat, periodik
      const len = 10;
      lane.speed = 20 + r.next() * 6;
      lane.offset = SIDE_MARGIN + len;
      const period = 3.5 + r.next() * 3;
      lane.span = Math.max(GRID_COLUMNS + SIDE_MARGIN + lane.offset + 2, lane.speed * period);
      lane.movers.push({ x0: r.next() * lane.span, len });
    }

    if ((kind === "grass" || kind === "road") && row >= START_SAFE_ROWS && r.next() < 0.25) {
      const c = r.int(0, GRID_COLUMNS - 1);
      if (!lane.trees.includes(c)) lane.coin = c;
    }
    if (kind === "grass" && row >= 10 && r.next() < 0.06) {
      const c = r.int(0, GRID_COLUMNS - 1);
      const kinds: PowerKind[] = ["ghost", "time", "magnet", "slow"];
      const k = r.pick(kinds);
      if (!lane.trees.includes(c) && lane.coin !== c) lane.power = { col: c, kind: k };
    }
    return lane;
  }
}
