import { storage } from "./storage";

/** Efek suara sintetis (WebAudio), tanpa file audio. */
type Name = "hop" | "coin" | "power" | "hit" | "splash" | "record" | "click";

class Sfx {
  private ctx: AudioContext | null = null;
  muted = storage.muted();

  /** Harus dipanggil dari gestur pengguna (kebijakan autoplay browser). */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch { this.ctx = null; }
  }

  toggle(): boolean {
    this.muted = !this.muted;
    storage.setMuted(this.muted);
    return this.muted;
  }

  play(name: Name): void {
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const tone = (freq: number, start: number, dur: number, type: OscillatorType = "square", vol = 0.08, slideTo?: number) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + start + dur);
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(c.destination);
      o.start(t + start);
      o.stop(t + start + dur + 0.02);
    };
    const noise = (dur: number, vol = 0.12) => {
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf; g.gain.value = vol;
      s.connect(g).connect(c.destination);
      s.start(t);
    };
    switch (name) {
      case "hop": tone(520, 0, 0.06, "square", 0.04, 700); break;
      case "coin": tone(988, 0, 0.07, "square", 0.05); tone(1319, 0.07, 0.12, "square", 0.05); break;
      case "power": [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.06, 0.1, "triangle", 0.07)); break;
      case "hit": noise(0.25, 0.18); tone(180, 0, 0.3, "sawtooth", 0.08, 60); break;
      case "splash": noise(0.4, 0.12); tone(400, 0, 0.3, "sine", 0.06, 120); break;
      case "record": [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.16, "triangle", 0.08)); break;
      case "click": tone(700, 0, 0.04, "square", 0.04); break;
    }
  }
}

export const sfx = new Sfx();
