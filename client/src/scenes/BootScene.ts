import Phaser from "phaser";

/** Tidak ada aset eksternal: semua bentuk digambar dengan Graphics, suara disintesis. */
export class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  create(): void { this.scene.start("Menu"); }
}
