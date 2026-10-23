import Phaser from "phaser";
import type { Dir } from "@shared/sim/simulation";

/**
 * Input keyboard (panah/WASD) dan sentuh (swipe 4 arah, tap = maju).
 * Menyimpan maksimal 1 input yang menunggu cooldown, supaya kontrol terasa responsif.
 */
export class InputQueue {
  private pending: Dir | null = null;
  private down: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene, private readonly onAny: () => void, private readonly isUiHit: (x: number, y: number) => boolean) {
    scene.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // sedang mengetik nama
      const k = e.key.toLowerCase();
      const map: Record<string, Dir> = { arrowup: 0, w: 0, arrowdown: 1, s: 1, arrowleft: 2, a: 2, arrowright: 3, d: 3 };
      const d = map[k];
      if (d !== undefined) { e.preventDefault(); this.push(d); }
    });
    scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.isUiHit(p.x, p.y)) return;
      this.down = { x: p.x, y: p.y };
    });
    scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.down) return;
      const dx = p.x - this.down.x, dy = p.y - this.down.y;
      this.down = null;
      if (Math.hypot(dx, dy) < 22) return this.push(0);
      if (Math.abs(dx) > Math.abs(dy)) this.push(dx > 0 ? 3 : 2);
      else this.push(dy < 0 ? 0 : 1);
    });
  }

  private push(d: Dir): void {
    this.pending = d;
    this.onAny();
  }

  peek(): Dir | null { return this.pending; }
  clear(): void { this.pending = null; }
}
