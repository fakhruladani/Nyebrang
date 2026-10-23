/**
 * Proyeksi "isometrik ala Crossy Road" (dimetrik miring). Logika game tetap di grid (col, row);
 * hanya rendering yang diproyeksikan.
 *  - col bertambah  = ke kanan, sedikit turun (arah lajur)
 *  - row bertambah  = maju: ke atas, sedikit ke kanan
 *  - z              = tinggi balok
 */
export const COL_X = 44;
export const COL_Y = 10;
export const ROW_X = 14;
export const ROW_Y = 38;
export const UNIT_Z = 30;

export interface Pt { x: number; y: number }

export function project(col: number, row: number, z = 0): Pt {
  return { x: col * COL_X + row * ROW_X, y: col * COL_Y - row * ROW_Y - z * UNIT_Z };
}

/** Ubah kecerahan warna 0xRRGGBB (factor < 1 = lebih gelap). */
export function shade(color: number, factor: number): number {
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((color >> s) & 0xff) * factor)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Campur dua warna (t=0 → a, t=1 → b). */
export function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number) => (c >> s) & 0xff;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/** Jajaran genjang datar dari (c0..c1) × (r0..r1) pada ketinggian z. */
export function drawQuad(
  g: Phaser.GameObjects.Graphics, c0: number, c1: number, r0: number, r1: number, color: number, alpha = 1, z = 0,
): void {
  g.fillStyle(color, alpha);
  g.fillPoints([project(c0, r1, z), project(c1, r1, z), project(c1, r0, z), project(c0, r0, z)], true);
}

/** Ubin datar seluas satu sel, berpusat di (col,row). */
export function drawTile(g: Phaser.GameObjects.Graphics, col: number, row: number, color: number): void {
  drawQuad(g, col - 0.5, col + 0.5, row - 0.5, row + 0.5, color);
}

export interface BlockOpts {
  /** lebar relatif sel arah baris (0..1) */
  depth?: number;
  /** lebar relatif sel arah kolom untuk balok 1 sel; untuk length>1 ujungnya */
  size?: number;
  /** panjang sepanjang lajur dalam sel */
  length?: number;
  /** mengambang dari tanah (dalam UNIT_Z) */
  lift?: number;
  alpha?: number;
}

/**
 * Balok di atas ubin. (col,row) = pusat sel paling kiri. height dalam UNIT_Z.
 * Sisi yang terlihat kamera: atas, depan (-row), kanan (+col).
 */
export function drawBlock(
  g: Phaser.GameObjects.Graphics, col: number, row: number, color: number, height: number, opts: BlockOpts = {},
): void {
  const size = opts.size ?? 0.7;
  const depth = opts.depth ?? size;
  const length = opts.length ?? 1;
  const lift = opts.lift ?? 0;
  const alpha = opts.alpha ?? 1;
  const c0 = col - size / 2, c1 = col + (length - 1) + size / 2;
  const r0 = row - depth / 2, r1 = row + depth / 2;
  const z0 = lift, z1 = lift + height;
  const tA = project(c0, r1, z1), tB = project(c1, r1, z1), tC = project(c1, r0, z1), tD = project(c0, r0, z1);
  const bB = project(c1, r1, z0), bC = project(c1, r0, z0), bD = project(c0, r0, z0);
  g.fillStyle(shade(color, 0.72), alpha);
  g.fillPoints([tB, tC, bC, bB], true);
  g.fillStyle(shade(color, 0.86), alpha);
  g.fillPoints([tD, tC, bC, bD], true);
  g.fillStyle(color, alpha);
  g.fillPoints([tA, tB, tC, tD], true);
}

/** Bayangan sederhana di tanah. */
export function drawShadow(g: Phaser.GameObjects.Graphics, col: number, row: number, size = 0.6, alpha = 0.18): void {
  drawQuad(g, col - size / 2, col + size / 2, row - size / 2, row + size / 2, 0x000000, alpha);
}
