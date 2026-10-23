import Phaser from "phaser";
import { FIXED_STEP_MS, GRID_COLUMNS, STEP_S } from "@shared/constants";
import { type DeathCause, type Dir, Simulation, idleLimit } from "@shared/sim/simulation";
import type { InputRecord } from "@shared/sim/replay";
import { api, type RunTicket } from "../api";
import { COL_X, ROW_Y, project } from "../render/iso";
import { WorldRenderer } from "../render/WorldRenderer";
import { POWER_LABEL, themeFor } from "../render/palette";
import { InputQueue } from "../systems/input";
import { sfx } from "../systems/sfx";
import { storage } from "../systems/storage";
import { FONT, button, text, type Button } from "../ui/widgets";

export const DEATH_TEXT: Record<DeathCause, string> = {
  tertabrak: "Tertabrak kendaraan",
  kereta: "Tertabrak kereta",
  tenggelam: "Tercebur ke sungai",
  hanyut: "Hanyut terbawa arus",
  diserang: "Digigit anjing penjaga",
  kelamaan: "Terlalu lama diam",
};

export interface GameOverData {
  online: boolean;
  ticket: RunTicket | null;
  inputs: InputRecord[];
  ticks: number;
  score: number;
  distance: number;
  coins: number;
  death: DeathCause;
  prevBest: number;
}

export class GameScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private worldRenderer!: WorldRenderer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private ui: Phaser.GameObjects.GameObject[] = [];

  private sim: Simulation | null = null;
  private ticket: RunTicket | null = null;
  private inputs: InputRecord[] = [];
  private queue!: InputQueue;
  private started = false;
  private paused = false;
  private acc = 0;
  private clock = 0;
  private deadFor = 0;
  private overLaunched = false;
  private facing = 0;
  private prevBest = 0;
  private camPos = { x: 0, y: 0 };

  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private powerText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private toast!: Phaser.GameObjects.Text;
  private idleBar!: Phaser.GameObjects.Graphics;
  private pauseBtn!: Button;
  private muteBtn!: Button;
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];
  private onVisibility = () => { if (document.hidden) this.setPaused(true); };

  constructor() { super("Game"); }

  init(): void {
    this.sim = null; this.ticket = null; this.inputs = []; this.started = false; this.paused = false;
    this.acc = 0; this.clock = 0; this.deadFor = 0; this.overLaunched = false; this.facing = 0;
    this.ui = []; this.pauseLayer = [];
    this.prevBest = storage.best();
  }

  create(): void {
    this.g = this.add.graphics();
    this.worldRenderer = new WorldRenderer(this.g);
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.g);

    this.scoreText = this.track(text(this, 16, 10, "0", 40, "#ffffff", true));
    this.bestText = this.track(text(this, 18, 58, "", 14, "#e6eef5"));
    this.idleBar = this.track(this.add.graphics());
    this.powerText = this.track(text(this, 18, 98, "", 15, "#ffe9a8", true));
    this.infoText = this.track(text(this, 18, 0, "", 12, "#c4d0dc"));
    this.centerText = this.track(text(this, 0, 0, "Menyiapkan…", 22, "#ffffff", true).setOrigin(0.5));
    this.toast = this.track(text(this, 0, 0, "", 20, "#ffe9a8", true).setOrigin(0.5).setAlpha(0));
    this.pauseBtn = this.track(button(this, 0, 0, 52, 44, "II", () => this.setPaused(!this.paused), 0x37506a));
    this.muteBtn = this.track(button(this, 0, 0, 52, 44, sfx.muted ? "✕" : "♪", () => this.toggleMute(), 0x37506a));
    this.layoutHud();
    this.scale.on("resize", this.onResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.onResize, this);
      document.removeEventListener("visibilitychange", this.onVisibility);
    });
    document.addEventListener("visibilitychange", this.onVisibility);

    this.queue = new InputQueue(this, () => { sfx.unlock(); if (this.paused) this.setPaused(false); }, (x, y) =>
      this.pauseBtn.bounds.contains(x, y) || this.muteBtn.bounds.contains(x, y) || this.paused);
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "p" || k === "escape") this.setPaused(!this.paused);
      if (k === "m") this.toggleMute();
    });

    const start = project(Math.floor(GRID_COLUMNS / 2), 2);
    this.camPos = { ...start };

    void api.startRun().then((t) => {
      this.ticket = t;
      const seed = t?.seed ?? (Math.floor(Math.random() * 2 ** 31) >>> 0);
      this.sim = new Simulation(seed);
      this.queue.clear();
      this.infoText.setText(t ? "" : "Mode offline: skor tidak masuk leaderboard");
      this.centerText.setText(this.sys.game.device.input.touch ? "Ketuk untuk mulai\nswipe untuk belok" : "Tekan ↑ / W untuk mulai\n←→ belok · P jeda · M suara");
    });
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.ui.push(o);
    this.cameras.main.ignore(o);
    return o;
  }

  private onResize(size: Phaser.Structs.Size): void {
    this.uiCam.setSize(size.width, size.height);
    this.layoutHud();
  }

  private layoutHud(): void {
    const w = this.scale.width, h = this.scale.height;
    this.pauseBtn.setPosition(w - 40, 34); this.pauseBtn.bounds.setTo(w - 66, 12, 52, 44);
    this.muteBtn.setPosition(w - 100, 34); this.muteBtn.bounds.setTo(w - 126, 12, 52, 44);
    this.centerText.setPosition(w / 2, h * 0.72).setAlign("center");
    this.toast.setPosition(w / 2, h * 0.2);
    this.infoText.setPosition(18, h - 26);
  }

  private toggleMute(): void {
    const m = sfx.toggle();
    this.muteBtn.setLabel(m ? "✕" : "♪");
  }

  private setPaused(p: boolean): void {
    if (!this.sim || !this.sim.state.alive || this.overLaunched) return;
    if (p === this.paused) return;
    this.paused = p;
    this.pauseBtn.setLabel(p ? "▶" : "II");
    this.pauseLayer.forEach((o) => o.destroy());
    this.pauseLayer = [];
    if (p) {
      const w = this.scale.width, h = this.scale.height;
      const bg = this.add.rectangle(0, 0, w, h, 0x0b1520, 0.55).setOrigin(0);
      const t = text(this, w / 2, h / 2 - 70, "Jeda", 36, "#ffffff", true).setOrigin(0.5);
      const b1 = button(this, w / 2, h / 2, 220, 52, "Lanjut", () => this.setPaused(false));
      const b2 = button(this, w / 2, h / 2 + 66, 220, 48, "Menu", () => this.scene.start("Menu"), 0x37506a);
      this.pauseLayer = [bg, t, b1, b2];
      this.pauseLayer.forEach((o) => this.cameras.main.ignore(o));
      this.queue.clear();
    }
  }

  private flash(msg: string): void {
    this.toast.setText(msg).setAlpha(1).setScale(1.15);
    this.tweens.add({ targets: this.toast, alpha: 0, scale: 1, duration: 1400, delay: 500 });
  }

  override update(_time: number, delta: number): void {
    this.clock += delta / 1000;
    const sim = this.sim;
    if (!sim) return this.renderFrame(null);

    if (!this.started && this.queue.peek() !== null) {
      this.started = true;
      this.centerText.setText("");
    }

    if (this.started && !this.paused && sim.state.alive) {
      this.acc += Math.min(delta, 250);
      while (this.acc >= FIXED_STEP_MS && sim.state.alive) {
        const d = this.queue.peek();
        if (d !== null) {
          const res = sim.input(d);
          if (res === "ok") { this.inputs.push([sim.state.tick, d]); this.facing = d; this.queue.clear(); }
          else if (res !== "cooldown") this.queue.clear();
        }
        sim.step();
        this.handleEvents(sim);
        this.acc -= FIXED_STEP_MS;
      }
    }

    if (!sim.state.alive) {
      this.deadFor += delta / 1000;
      if (this.deadFor > 1.1 && !this.overLaunched) this.launchGameOver(sim);
    }
    this.renderFrame(sim);
    this.updateHud(sim);
  }

  private handleEvents(sim: Simulation): void {
    for (const e of sim.events) {
      if (e.type === "hop") sfx.play("hop");
      else if (e.type === "coin") sfx.play("coin");
      else if (e.type === "power") { sfx.play("power"); this.flash(POWER_LABEL[e.kind] ?? e.kind); }
      else if (e.type === "death") {
        sfx.play(e.cause === "tenggelam" || e.cause === "hanyut" ? "splash" : "hit");
        if (e.cause !== "tenggelam" && e.cause !== "hanyut") this.cameras.main.shake(220, 0.01);
      }
    }
    sim.events.length = 0;
  }

  private renderFrame(sim: Simulation | null): void {
    const cam = this.cameras.main;
    cam.setZoom(Math.min(1.25, cam.width / (GRID_COLUMNS * COL_X + 160)));
    const s = sim?.state;
    const player = s ? {
      px: s.px, row: s.row, fromPx: s.hopFrom.px, fromRow: s.hopFrom.row,
      hopAge: s.tick - s.lastHopTick + (s.alive ? this.acc / FIXED_STEP_MS : 8),
      facing: this.facing, ghost: s.alive && s.tick <= s.ghostUntil, death: s.death, deadFor: this.deadFor,
    } : undefined;
    const pos = player ? WorldRenderer.playerPos(player) : { pc: Math.floor(GRID_COLUMNS / 2), pr: 0, lift: 0 };
    const target = project(pos.pc * 0.35 + (GRID_COLUMNS / 2) * 0.65, pos.pr + 2.5);
    const k = Math.min(1, this.game.loop.delta / 140);
    this.camPos.x += (target.x - this.camPos.x) * k;
    this.camPos.y += (target.y - this.camPos.y) * k;
    cam.centerOn(this.camPos.x, this.camPos.y);

    const half = Math.ceil(cam.height / cam.zoom / ROW_Y / 2) + 3;
    const centerRow = pos.pr + 2.5;
    const worldTime = s ? s.worldTime + (s.alive ? 0 : this.deadFor) : 0;
    this.worldRenderer.draw({
      world: sim?.world ?? this.placeholderWorld(),
      worldTime: sim ? worldTime : 0,
      clock: this.clock,
      rowFrom: Math.floor(centerRow - half),
      rowTo: Math.ceil(centerRow + half + 2),
      collected: s?.collected,
      player,
    });
    // warna latar mengikuti tema
    const th = themeFor(Math.floor(pos.pr));
    cam.setBackgroundColor(Phaser.Display.Color.IntegerToColor(th.water).darken(55).color);
  }

  private placeholder: Simulation | null = null;
  private placeholderWorld() {
    if (!this.placeholder) this.placeholder = new Simulation(1);
    return this.placeholder.world;
  }

  private updateHud(sim: Simulation): void {
    const s = sim.state;
    const score = sim.score;
    this.scoreText.setText(String(score));
    const best = Math.max(this.prevBest, score);
    this.bestText.setText(`Rekor: ${best}   Jarak: ${s.maxRow}   Koin: ${s.coins}`);

    const lim = idleLimit(s.maxRow);
    const frac = s.alive ? Math.max(0, 1 - s.idleTicks / lim) : 0;
    const g = this.idleBar;
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(18, 80, 150, 10, 5);
    const color = frac > 0.5 ? 0x7be07b : frac > 0.25 ? 0xf2c14b : 0xf25b5b;
    g.fillStyle(color, 1); g.fillRoundedRect(18, 80, Math.max(4, 150 * frac), 10, 5);

    const parts: string[] = [];
    const left = (until: number) => Math.ceil((until - s.tick) * STEP_S);
    if (s.tick <= s.ghostUntil) parts.push(`Siluman ${left(s.ghostUntil)}s`);
    if (s.tick <= s.magnetUntil) parts.push(`Magnet ${left(s.magnetUntil)}s`);
    if (s.tick <= s.slowUntil) parts.push(`Slow-mo ${left(s.slowUntil)}s`);
    this.powerText.setText(parts.join("  ·  "));
    this.powerText.setFontFamily(FONT);
  }

  private launchGameOver(sim: Simulation): void {
    this.overLaunched = true;
    const s = sim.state;
    const data: GameOverData = {
      online: !!this.ticket, ticket: this.ticket, inputs: this.inputs, ticks: s.tick, score: sim.score,
      distance: s.maxRow, coins: s.coins, death: s.death ?? "kelamaan", prevBest: this.prevBest,
    };
    if (sim.score > this.prevBest) storage.setBest(sim.score);
    this.pauseBtn.setVisible(false);
    this.scene.launch("GameOver", data);
    this.scene.bringToTop("GameOver");
  }
}

export type { Dir };
