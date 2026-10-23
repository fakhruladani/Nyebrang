import Phaser from "phaser";
import { sfx } from "../systems/sfx";

export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 16, color = "#ffffff", bold = false): Phaser.GameObjects.Text {
  return scene.add.text(x, y, s, {
    fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal",
    stroke: "#13202d", strokeThickness: Math.max(2, Math.round(size / 6)),
  });
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.82): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x13202d, alpha);
  g.fillRoundedRect(x, y, w, h, 16);
  g.lineStyle(2, 0xffffff, 0.12);
  g.strokeRoundedRect(x, y, w, h, 16);
  return g;
}

export interface Button extends Phaser.GameObjects.Container { setLabel(s: string): void; bounds: Phaser.Geom.Rectangle }

export function button(
  scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, label: string, onClick: () => void,
  color = 0x4caf50,
): Button {
  const c = scene.add.container(cx, cy) as Button;
  const g = scene.add.graphics();
  const draw = (hover: boolean) => {
    g.clear();
    g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(25).color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
    g.fillStyle(hover ? Phaser.Display.Color.IntegerToColor(color).lighten(10).color : color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  };
  draw(false);
  const t = text(scene, 0, 0, label, Math.min(22, h * 0.42), "#ffffff", true).setOrigin(0.5);
  c.add([g, t]);
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });
  c.on("pointerover", () => draw(true));
  c.on("pointerout", () => draw(false));
  c.on("pointerup", () => { sfx.unlock(); sfx.play("click"); onClick(); });
  c.setLabel = (s: string) => t.setText(s);
  c.bounds = new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h);
  return c;
}

/** Tabel Top 5 sebagai teks canvas (nama TIDAK pernah dirender sebagai HTML). */
export function leaderboardRows(
  scene: Phaser.Scene, x: number, y: number, w: number,
  rows: { rank: number; name: string; score: number; pending?: boolean }[] | null, highlightRank?: number,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  if (rows === null) { out.push(text(scene, x + w / 2, y + 10, "Leaderboard tidak tersedia", 15, "#c4d0dc").setOrigin(0.5, 0)); return out; }
  if (rows.length === 0) { out.push(text(scene, x + w / 2, y + 10, "Belum ada skor. Jadilah yang pertama!", 15, "#c4d0dc").setOrigin(0.5, 0)); return out; }
  rows.forEach((r, i) => {
    const yy = y + i * 30;
    const hl = r.rank === highlightRank;
    const color = hl ? "#ffd23f" : i === 0 ? "#ffe9a8" : "#ffffff";
    out.push(text(scene, x, yy, `${r.rank}.`, 18, color, true));
    out.push(text(scene, x + 34, yy, r.pending ? "(menulis nama…)" : r.name, 18, r.pending ? "#9fb0c0" : color, hl));
    out.push(text(scene, x + w, yy, String(r.score), 18, color, true).setOrigin(1, 0));
  });
  return out;
}
