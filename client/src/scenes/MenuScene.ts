import Phaser from "phaser";
import { GAME_NAME, GRID_COLUMNS } from "@shared/constants";
import { World } from "@shared/sim/world";
import { api, type LeaderEntry } from "../api";
import { COL_X, ROW_Y, project } from "../render/iso";
import { WorldRenderer } from "../render/WorldRenderer";
import { sfx } from "../systems/sfx";
import { storage } from "../systems/storage";
import { button, leaderboardRows, panel, text } from "../ui/widgets";

/** Menu: dunia demo bergerak di latar, judul, tombol main, Top 5, rekor pribadi. */
export class MenuScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private worldRenderer!: WorldRenderer;
  private world = new World(20261023);
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private top: LeaderEntry[] | null | undefined = undefined;
  private clock = 0;

  constructor() { super("Menu"); }

  create(): void {
    this.objs = [];
    this.top = undefined;
    this.g = this.add.graphics();
    this.worldRenderer = new WorldRenderer(this.g);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.g);
    this.layout();
    this.scale.on("resize", this.onResize, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.onResize, this));
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowUp" || e.key.toLowerCase() === "w") this.play();
      if (e.key.toLowerCase() === "m") { sfx.toggle(); this.layout(); }
    });
    void api.leaderboard().then((t) => { this.top = t; if (this.scene.isActive()) this.layout(); });
  }

  private onResize(size: Phaser.Structs.Size): void {
    this.uiCam.setSize(size.width, size.height);
    this.layout();
  }

  private play(): void {
    sfx.unlock();
    this.scene.start("Game");
  }

  private layout(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.objs.push(o); this.cameras.main.ignore(o); return o; };
    const W = this.scale.width, H = this.scale.height;
    const compact = H < 640;

    const pw = Math.min(420, W - 24);
    const px = (W - pw) / 2;
    let y = compact ? 16 : Math.max(24, H * 0.06);
    add(text(this, W / 2, y, GAME_NAME, compact ? 46 : 60, "#ffffff", true).setOrigin(0.5, 0)); y += compact ? 56 : 74;
    add(text(this, W / 2, y, "Seberangi jalan, sungai, dan rel sejauh mungkin.", 15, "#e6eef5").setOrigin(0.5, 0).setWordWrapWidth(W - 32).setAlign("center")); y += 34;
    add(button(this, W / 2, y + 30, 220, 60, "MAIN", () => this.play())); y += 78;
    add(text(this, W / 2, y, `Rekor pribadimu: ${storage.best()}`, 15, "#ffe9a8", true).setOrigin(0.5, 0)); y += 34;

    const rows = this.top === undefined ? [] : this.top;
    const lh = Math.max(1, rows?.length ?? 1) * 30 + 58;
    add(panel(this, px, y, pw, lh, 0.78));
    add(text(this, px + 20, y + 14, "Top 5", 18, "#ffffff", true));
    if (this.top === undefined) add(text(this, px + pw / 2, y + 46, "Memuat…", 15, "#c4d0dc").setOrigin(0.5, 0));
    else for (const o of leaderboardRows(this, px + 20, y + 46, pw - 40, this.top)) add(o);
    y += lh + 14;

    const touch = this.sys.game.device.input.touch;
    const help = touch ? "Ketuk = maju · swipe = belok/mundur" : "↑/W maju · ←→/AD belok · ↓/S mundur · P jeda · M suara";
    add(text(this, W / 2, Math.min(y, H - 56), help, 13, "#c4d0dc").setOrigin(0.5, 0).setWordWrapWidth(W - 32).setAlign("center"));
    add(text(this, W / 2, H - 28, "Jangan diam terlalu lama · koin +5 · tanpa save point", 12, "#9fb0c0").setOrigin(0.5, 0));
    add(button(this, W - 40, 34, 52, 44, sfx.muted ? "✕" : "♪", () => { sfx.toggle(); this.layout(); }, 0x37506a));
  }

  override update(_t: number, delta: number): void {
    this.clock += delta / 1000;
    const cam = this.cameras.main;
    cam.setZoom(Math.min(1.25, cam.width / (GRID_COLUMNS * COL_X + 160)));
    const row = Number(import.meta.env.VITE_MENU_ROW ?? 3) + this.clock * 0.6;
    const c = project(GRID_COLUMNS / 2, row);
    cam.centerOn(c.x, c.y);
    const half = Math.ceil(cam.height / cam.zoom / ROW_Y / 2) + 3;
    this.worldRenderer.draw({ world: this.world, worldTime: this.clock, clock: this.clock, rowFrom: Math.floor(row - half), rowTo: Math.ceil(row + half + 2) });
    cam.setBackgroundColor(0x1d2b3a);
  }
}
