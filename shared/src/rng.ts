/**
 * RNG ber-seed (mulberry32). Semua keacakan di simulasi WAJIB lewat sini,
 * jangan Math.random(), supaya server bisa memutar ulang run dari seed + input.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Angka [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Bilangan bulat [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() dari array kosong");
    return items[this.int(0, items.length - 1)] as T;
  }
}
