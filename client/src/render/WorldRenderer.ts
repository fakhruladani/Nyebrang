import { GRID_COLUMNS, HOP_COOLDOWN_TICKS } from "@shared/constants";
import { type Lane, type World, moverX, patrolX } from "@shared/sim/world";
import type { DeathCause } from "@shared/sim/simulation";
import { COLORS, themeFor } from "./palette";
import { drawBlock, drawQuad, drawShadow, mix, shade } from "./iso";

/** Lebar tanah yang digambar di luar area main (kolom). */
const GROUND_PAD = 9;

export interface PlayerView {
  px: number;
  row: number;
  fromPx: number;
  fromRow: number;
  /** tick sejak lompatan terakhir dimulai */
  hopAge: number;
  /** arah hadap: 0 maju, 1 mundur, 2 kiri, 3 kanan */
  facing: number;
  ghost: boolean;
  death: DeathCause | null;
  /** detik sejak mati (untuk animasi) */
  deadFor: number;
}

export interface FrameInput {
  world: World;
  /** waktu dunia untuk posisi kendaraan */
  worldTime: number;
  /** waktu nyata (detik) untuk animasi kosmetik */
  clock: number;
  rowFrom: number;
  rowTo: number;
  collected?: ReadonlySet<string>;
  player?: PlayerView;
}

interface Drawable { key: number; draw: () => void }

/**
 * Menggambar dunia dalam 3 lapis: tanah (jauh→dekat), benda datar (kayu, marka), lalu balok
 * yang diurutkan per baris (jauh dulu) dan kolom (kiri dulu).
 */
export class WorldRenderer {
  constructor(private readonly g: Phaser.GameObjects.Graphics) {}

  /** posisi interpolasi pemain untuk kamera */
  static playerPos(p: PlayerView): { pc: number; pr: number; lift: number } {
    const t = Math.min(1, p.hopAge / HOP_COOLDOWN_TICKS);
    const e = 1 - (1 - t) * (1 - t);
    return {
      pc: p.fromPx + (p.px - p.fromPx) * e,
      pr: p.fromRow + (p.row - p.fromRow) * e,
      lift: Math.sin(t * Math.PI) * 0.45,
    };
  }

  draw(f: FrameInput): void {
    const g = this.g;
    g.clear();
    const lanes: Lane[] = [];
    for (let r = f.rowTo; r >= f.rowFrom; r--) lanes.push(f.world.lane(Math.max(r, 0)));

    // 1) tanah
    for (let r = f.rowTo; r >= f.rowFrom; r--) this.drawGround(f.world.lane(Math.max(r, 0)), r, f);

    // 2) benda datar: kayu (supaya pemain di atas kayu selalu tergambar sesudahnya)
    for (let r = f.rowTo; r >= f.rowFrom; r--) {
      if (r < 0) continue;
      const lane = f.world.lane(r);
      if (lane.kind !== "water") continue;
      for (const m of lane.movers) {
        const x = moverX(lane, m, f.worldTime);
        const bob = Math.sin(f.clock * 3 + r) * 0.02;
        drawBlock(g, x, r, COLORS.log, 0.22, { size: 0.86, depth: 0.74, length: m.len, lift: -0.08 + bob });
        drawQuad(g, x - 0.43, x + m.len - 1 + 0.43, r - 0.37, r + 0.37, shade(COLORS.log, 1.12), 1, 0.14 + bob);
      }
    }

    // 3) balok
    const items: Drawable[] = [];
    const key = (row: number, col: number) => -row * 1000 + col;
    for (let r = f.rowTo; r >= f.rowFrom; r--) {
      if (r < 0) {
        // pagar pohon di belakang garis start
        for (let c = -GROUND_PAD; c < GRID_COLUMNS + GROUND_PAD; c += 2) {
          items.push({ key: key(r, c), draw: () => this.tree(c, r, themeFor(0).tree, themeFor(0).trunk, 1.3) });
        }
        continue;
      }
      this.laneBlocks(f.world.lane(r), r, f, items, key);
    }

    if (f.player) {
      const p = f.player;
      const { pc, pr, lift } = WorldRenderer.playerPos(p);
      items.push({ key: key(Math.round(pr), pc) + 0.5, draw: () => this.player(p, pc, pr, lift, f.clock) });
    }

    items.sort((a, b) => a.key - b.key);
    for (const it of items) it.draw();
  }

  private drawGround(lane: Lane, r: number, f: FrameInput): void {
    const g = this.g;
    const th = themeFor(r);
    const L = -GROUND_PAD - 0.5, R = GRID_COLUMNS + GROUND_PAD - 0.5;
    const inL = -0.5, inR = GRID_COLUMNS - 0.5;
    const dim = th.outsideDim;
    if (r < 0 || lane.kind === "grass") {
      for (let c = -GROUND_PAD; c < GRID_COLUMNS + GROUND_PAD; c++) {
        const base = th.grass[(((r + c) % 2) + 2) % 2] as number;
        const out = c < 0 || c >= GRID_COLUMNS || r < 0;
        drawQuad(g, c - 0.5, c + 0.5, r - 0.5, r + 0.5, out ? shade(base, dim) : base);
      }
      return;
    }
    const base = lane.kind === "road" ? th.road : lane.kind === "water" ? th.water : th.rail;
    const col = lane.kind === "water" ? mix(base, 0xffffff, 0.04 + 0.03 * Math.sin(f.clock * 1.6 + r)) : base;
    drawQuad(g, L, inL, r - 0.5, r + 0.5, shade(col, dim));
    drawQuad(g, inL, inR, r - 0.5, r + 0.5, col);
    drawQuad(g, inR, R, r - 0.5, r + 0.5, shade(col, dim));

    if (lane.kind === "road") {
      const prev = r > 0 ? f.world.lane(r - 1) : null;
      if (prev && prev.kind === "road") {
        // marka putus-putus di antara dua lajur jalan
        for (let c = -GROUND_PAD; c < GRID_COLUMNS + GROUND_PAD; c += 2) {
          drawQuad(g, c - 0.3, c + 0.3, r - 0.53, r - 0.47, th.roadMark, 0.85);
        }
      }
    } else if (lane.kind === "rail") {
      for (let c = -GROUND_PAD; c < GRID_COLUMNS + GROUND_PAD; c++) {
        drawQuad(g, c - 0.12, c + 0.12, r - 0.42, r + 0.42, th.railBar);
      }
      drawQuad(g, L, R, r - 0.3, r - 0.24, 0xb8bcc6);
      drawQuad(g, L, R, r + 0.24, r + 0.3, 0xb8bcc6);
    }
  }

  private laneBlocks(lane: Lane, r: number, f: FrameInput, items: Drawable[], key: (r: number, c: number) => number): void {
    const th = themeFor(r);
    const t = f.worldTime;
    if (lane.kind === "grass") {
      for (const c of lane.trees) items.push({ key: key(r, c), draw: () => this.tree(c, r, th.tree, th.trunk, 1 + ((c * 7 + r * 3) % 3) * 0.25) });
      // pohon hiasan di luar area main
      for (let c = -GROUND_PAD; c < GRID_COLUMNS + GROUND_PAD; c++) {
        if (c >= 0 && c < GRID_COLUMNS) continue;
        if ((c * 31 + r * 17) % 5 === 0) items.push({ key: key(r, c), draw: () => this.tree(c, r, shade(th.tree, 0.9), th.trunk, 1.2) });
      }
      if (lane.patrol) {
        const ex = patrolX(lane, t);
        items.push({ key: key(r, ex), draw: () => this.dog(ex, r, f.clock) });
      }
    } else if (lane.kind === "road") {
      lane.movers.forEach((m, i) => {
        const x = moverX(lane, m, t);
        const color = COLORS.car[(i + r) % COLORS.car.length] as number;
        items.push({ key: key(r, x), draw: () => this.car(x, r, m.len, color, lane.dir) });
      });
    } else if (lane.kind === "rail") {
      const m = lane.movers[0];
      if (m) {
        const x = moverX(lane, m, t);
        items.push({ key: key(r, x), draw: () => this.train(x, r, m.len) });
        // lampu peringatan: menyala bila kereta ada/akan masuk area dalam 1,2 detik
        const near = (tt: number) => { const xx = moverX(lane, m, tt); return xx + m.len > -3 && xx < GRID_COLUMNS + 3; };
        const warn = [0, 0.4, 0.8, 1.2].some((d) => near(t + d));
        const on = warn && Math.floor(f.clock * 6) % 2 === 0;
        items.push({ key: key(r, -1.2), draw: () => this.lamp(-1.2, r, on) });
      }
    }

    const col = f.collected;
    if (lane.coin !== null && !(col && col.has(`c${r}`))) {
      const c = lane.coin;
      items.push({ key: key(r, c) + 0.2, draw: () => this.coin(c, r, f.clock) });
    }
    if (lane.power && !(col && col.has(`p${r}`))) {
      const p = lane.power;
      items.push({ key: key(r, p.col) + 0.2, draw: () => this.power(p.col, r, p.kind, f.clock) });
    }
  }

  // ---------- bentuk ----------

  private tree(c: number, r: number, leaf: number, trunk: number, h: number): void {
    drawShadow(this.g, c + 0.05, r - 0.05, 0.7, 0.12);
    drawBlock(this.g, c, r, trunk, 0.35, { size: 0.24 });
    drawBlock(this.g, c, r, leaf, h * 0.85, { size: 0.68, lift: 0.3 });
  }

  private car(x: number, r: number, len: number, color: number, dir: number): void {
    const g = this.g;
    drawShadow(g, x + (len - 1) / 2, r - 0.06, 0.8 + (len - 1), 0.15);
    drawBlock(g, x, r, color, 0.42, { size: 0.86, depth: 0.7, length: len, lift: 0.1 });
    if (len === 1) {
      drawBlock(g, x - dir * 0.08, r, shade(color, 1.18), 0.28, { size: 0.5, depth: 0.6, lift: 0.52 });
    } else {
      const cab = dir === 1 ? x + len - 1 + 0.15 : x - 0.15;
      drawBlock(g, cab, r, COLORS.truckCab, 0.42, { size: 0.5, depth: 0.66, lift: 0.52 });
    }
    // roda
    for (const wx of [x - 0.25, x + len - 1 + 0.25]) drawBlock(g, wx, r - 0.36, 0x22252b, 0.2, { size: 0.24, depth: 0.06 });
  }

  private train(x: number, r: number, len: number): void {
    const g = this.g;
    drawBlock(g, x, r, COLORS.train, 0.85, { size: 0.9, depth: 0.82, length: len, lift: 0.08 });
    for (let i = 0; i < len; i += 1.5) {
      drawQuad(g, x + i - 0.15, x + i + 0.45, r - 0.42, r - 0.4, COLORS.trainWindow, 1, 0.6);
    }
  }

  private lamp(c: number, r: number, on: boolean): void {
    drawBlock(this.g, c, r + 0.35, 0x3a3d45, 1.1, { size: 0.12 });
    drawBlock(this.g, c, r + 0.35, on ? COLORS.lampOn : COLORS.lampOff, 0.22, { size: 0.3, depth: 0.2, lift: 1.1 });
  }

  private dog(x: number, r: number, clock: number): void {
    const hop = Math.abs(Math.sin(clock * 10)) * 0.08;
    drawShadow(this.g, x, r, 0.6, 0.15);
    drawBlock(this.g, x, r, COLORS.dog, 0.42, { size: 0.62, depth: 0.42, lift: 0.12 + hop });
    drawBlock(this.g, x + 0.28, r, shade(COLORS.dog, 1.15), 0.32, { size: 0.3, depth: 0.34, lift: 0.4 + hop });
  }

  private coin(c: number, r: number, clock: number): void {
    const bob = 0.25 + Math.sin(clock * 4 + c + r) * 0.08;
    drawShadow(this.g, c, r, 0.3, 0.12);
    drawBlock(this.g, c, r, COLORS.coin, 0.3, { size: 0.3, depth: 0.1, lift: bob });
  }

  private power(c: number, r: number, kind: string, clock: number): void {
    const color = COLORS.power[kind] ?? 0xffffff;
    const bob = 0.3 + Math.sin(clock * 3 + r) * 0.1;
    drawShadow(this.g, c, r, 0.4, 0.15);
    drawBlock(this.g, c, r, color, 0.36, { size: 0.38, lift: bob, alpha: kind === "ghost" ? 0.75 : 1 });
    drawBlock(this.g, c, r, 0xffffff, 0.08, { size: 0.16, lift: bob + 0.36, alpha: 0.9 });
  }

  private player(p: PlayerView, pc: number, pr: number, lift: number, clock: number): void {
    const g = this.g;
    const alpha = p.ghost ? 0.45 + 0.15 * Math.sin(clock * 12) : 1;
    let body = COLORS.player;
    let height = 0.62;
    let size = 0.5;
    let z = lift;
    if (p.death === "tertabrak" || p.death === "kereta") { height = 0.12; size = 0.72; z = 0; }
    else if (p.death === "tenggelam" || p.death === "hanyut") { z = Math.max(-0.7, -p.deadFor * 1.2); }
    else if (p.death === "diserang") body = 0xf2a3a3;
    else if (p.death === "kelamaan") body = 0xb9b9b9;
    if (z > -0.6) drawShadow(g, pc, pr, 0.5, 0.2 - lift * 0.15);
    drawBlock(g, pc, pr, body, height, { size, depth: size, lift: z, alpha });
    if (height > 0.3) {
      const [fx, fy] = p.facing === 2 ? [-0.27, 0] : p.facing === 3 ? [0.27, 0] : p.facing === 1 ? [0, -0.27] : [0, 0.27];
      drawBlock(g, pc + fx, pr + fy, COLORS.beak, 0.12, { size: 0.14, lift: z + 0.3, alpha });
      drawBlock(g, pc, pr, COLORS.comb, 0.12, { size: 0.12, depth: 0.26, lift: z + height, alpha });
    }
  }
}
