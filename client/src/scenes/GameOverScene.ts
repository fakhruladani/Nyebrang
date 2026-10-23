import Phaser from "phaser";
import { api, type FinishResult, type LeaderEntry } from "../api";
import { sfx } from "../systems/sfx";
import { storage } from "../systems/storage";
import { button, leaderboardRows, panel, text } from "../ui/widgets";
import { DEATH_TEXT, type GameOverData } from "./GameScene";

type Phase = "sending" | "naming" | "done" | "offline" | "error" | "rejected";

const NAME_RE = /^[A-Za-z0-9 ]{3,12}$/;
const CLAIM_ERR: Record<string, string> = {
  invalid_name: "Nama 3–12 karakter: huruf, angka, spasi.",
  bad_word: "Nama mengandung kata yang tidak pantas.",
  expired: "Waktu menulis nama habis; tercatat sebagai ANONIM.",
  not_found: "Klaim tidak ditemukan atau sudah dipakai.",
  rate_limited: "Terlalu sering. Coba lagi sebentar.",
};

export class GameOverScene extends Phaser.Scene {
  private d!: GameOverData;
  private phase: Phase = "sending";
  private result: FinishResult | null = null;
  private top: LeaderEntry[] | null = null;
  private highlight?: number;
  private message = "";
  private objs: Phaser.GameObjects.GameObject[] = [];
  private inputEl: HTMLInputElement | null = null;
  private deadline = 0;
  private countdown?: Phaser.GameObjects.Text;
  private saving = false;

  constructor() { super("GameOver"); }

  init(data: GameOverData): void {
    this.d = data;
    this.phase = data.online && data.ticket ? "sending" : "offline";
    this.result = null; this.top = null; this.highlight = undefined; this.message = ""; this.saving = false;
  }

  create(): void {
    if (this.d.score > this.d.prevBest && this.d.score > 0) sfx.play("record");
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => { this.scale.off("resize", this.layout, this); this.removeInput(); });
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Enter" || e.key === " ") this.playAgain();
      if (e.key === "Escape") this.toMenu();
    });
    if (this.phase === "sending") void this.submit();
    else void api.leaderboard().then((t) => { this.top = t; this.layout(); });
  }

  private async submit(): Promise<void> {
    const t = this.d.ticket;
    if (!t) return;
    this.phase = "sending"; this.layout();
    const r = await api.finishRun(t.runId, { token: t.token, inputs: this.d.inputs, ticks: this.d.ticks, score: this.d.score });
    if (!this.scene.isActive()) return;
    if (!r) { this.phase = "error"; this.layout(); return; }
    if (!r.accepted) {
      this.phase = "rejected";
      this.message = r.error === "rate_limited" ? "Terlalu banyak run. Coba lagi nanti." : "Skor ditolak server (run tidak valid).";
      this.top = r.top ?? null;
      this.layout(); return;
    }
    this.result = r; this.top = r.top;
    if (r.qualifies && r.claimToken) {
      this.phase = "naming";
      this.highlight = r.rank;
      this.deadline = this.time.now + (r.claimExpiresInMs ?? 120_000);
      sfx.play("record");
    } else this.phase = "done";
    this.layout();
  }

  private async saveName(): Promise<void> {
    if (!this.inputEl || !this.result?.claimToken || this.saving) return;
    const name = this.inputEl.value.trim().replace(/\s+/g, " ");
    if (!NAME_RE.test(name)) { this.message = CLAIM_ERR.invalid_name as string; this.layout(); return; }
    this.saving = true;
    const r = await api.claim(this.result.claimToken, name);
    this.saving = false;
    if (!this.scene.isActive()) return;
    if (r?.ok && r.top) {
      storage.setLastName(name);
      this.top = r.top; this.phase = "done"; this.message = "Nama tersimpan di leaderboard!";
    } else {
      this.message = (r?.error && CLAIM_ERR[r.error]) || "Gagal menyimpan nama. Coba lagi.";
      if (r?.error === "expired" || r?.error === "not_found") { this.phase = "done"; void api.leaderboard().then((t) => { this.top = t; this.layout(); }); }
    }
    this.layout();
  }

  private playAgain(): void {
    if (this.phase === "sending" || this.saving) return;
    this.removeInput();
    this.scene.stop("GameOver");
    this.scene.start("Game");
  }

  private toMenu(): void {
    this.removeInput();
    this.scene.stop("GameOver");
    this.scene.start("Menu");
  }

  private removeInput(): void {
    this.inputEl?.remove();
    this.inputEl = null;
  }

  override update(): void {
    if (this.phase === "naming" && this.countdown) {
      const left = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
      this.countdown.setText(`Sisa waktu ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      if (left === 0) {
        this.phase = "done"; this.message = "Waktu habis; tercatat sebagai ANONIM.";
        void api.leaderboard().then((t) => { this.top = t; this.layout(); });
        this.layout();
      }
    }
  }

  private layout(): void {
    const keep = this.inputEl?.value;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    this.countdown = undefined;
    this.removeInput();
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { this.objs.push(o); return o; };

    const W = this.scale.width, H = this.scale.height;
    const pw = Math.min(440, W - 24);
    const naming = this.phase === "naming";
    const rows = Math.max(1, this.top?.length ?? 1);
    const estH = 18 + 30 + 66 + 24 + 32 + 28 + (naming ? 52 + 46 : this.phase === "error" ? 52 : 0) + 28 + rows * 30 + 14 + 76;
    const ph = Math.min(H - 24, estH);
    const px = (W - pw) / 2, py = Math.max(12, (H - ph) / 2);
    add(this.add.rectangle(0, 0, W, H, 0x0b1520, 0.35).setOrigin(0));
    add(panel(this, px, py, pw, ph, 0.9));
    const cx = W / 2;
    let y = py + 18;

    add(text(this, cx, y, DEATH_TEXT[this.d.death], 18, "#ffb3a8", true).setOrigin(0.5, 0)); y += 30;
    add(text(this, cx, y, String(this.d.score), 54, "#ffffff", true).setOrigin(0.5, 0)); y += 66;
    add(text(this, cx, y, `Jarak ${this.d.distance} · Koin ${this.d.coins}`, 15, "#c4d0dc").setOrigin(0.5, 0)); y += 24;
    const best = Math.max(this.d.prevBest, this.d.score);
    const isRecord = this.d.score > this.d.prevBest && this.d.score > 0;
    add(text(this, cx, y, isRecord ? "★ Rekor pribadi baru!" : `Rekor pribadi: ${best}`, 15, isRecord ? "#ffd23f" : "#c4d0dc", isRecord).setOrigin(0.5, 0)); y += 32;

    const status: Record<Phase, string> = {
      sending: "Mengirim & memverifikasi skor…",
      naming: `Masuk Top 5! Peringkat #${this.result?.rank ?? "?"}. Tulis namamu:`,
      done: this.message,
      offline: "Mode offline: skor tidak dikirim.",
      error: "Gagal mengirim skor (jaringan).",
      rejected: this.message,
    };
    const st = status[this.phase];
    if (st) { add(text(this, cx, y, st, 15, naming ? "#ffd23f" : "#e6eef5", naming).setOrigin(0.5, 0).setWordWrapWidth(pw - 32).setAlign("center")); y += 28; }

    if (naming) {
      this.createInput(px + 24, y + 2, pw - 48 - 110, 40, keep ?? storage.lastName());
      add(button(this, px + pw - 24 - 50, y + 22, 100, 42, "Simpan", () => void this.saveName(), 0xf2a33a));
      y += 52;
      if (this.message) { add(text(this, cx, y, this.message, 13, "#ffb3a8").setOrigin(0.5, 0)); y += 20; }
      this.countdown = add(text(this, cx, y, "", 13, "#9fb0c0").setOrigin(0.5, 0)); y += 26;
    } else if (this.phase === "error") {
      add(button(this, cx, y + 20, 160, 40, "Coba kirim lagi", () => void this.submit(), 0x37506a)); y += 52;
    }

    add(text(this, px + 24, y, "Top 5", 17, "#ffffff", true)); y += 28;
    for (const o of leaderboardRows(this, px + 24, y, pw - 48, this.top, this.highlight)) add(o);
    y += Math.max(1, this.top?.length ?? 1) * 30 + 14;

    const by = py + ph - 40;
    add(button(this, cx - 82, by, 150, 50, "Main lagi", () => this.playAgain()));
    add(button(this, cx + 82, by, 130, 50, "Menu", () => this.toMenu(), 0x37506a));
  }

  private createInput(x: number, y: number, w: number, h: number, value: string): void {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / this.scale.width, sy = rect.height / this.scale.height;
    const el = document.createElement("input");
    el.type = "text";
    el.maxLength = 12;
    el.autocomplete = "off";
    el.spellcheck = false;
    el.placeholder = "Namamu";
    el.setAttribute("aria-label", "Nama untuk leaderboard");
    el.value = value.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 12);
    Object.assign(el.style, {
      position: "fixed", left: `${rect.left + x * sx}px`, top: `${rect.top + y * sy}px`,
      width: `${w * sx}px`, height: `${h * sy}px`, boxSizing: "border-box", padding: "0 12px",
      font: `bold ${Math.round(18 * sy)}px system-ui, sans-serif`, color: "#13202d", background: "#ffffff",
      border: "2px solid #f2a33a", borderRadius: "10px", outline: "none", zIndex: "10",
    });
    el.addEventListener("input", () => {
      const clean = el.value.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 12);
      if (clean !== el.value) el.value = clean;
    });
    el.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); void this.saveName(); }
    });
    document.body.appendChild(el);
    this.inputEl = el;
    if (!this.sys.game.device.input.touch) setTimeout(() => el.focus(), 50);
  }
}
