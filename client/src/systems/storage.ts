/** localStorage yang aman (private mode / diblokir → diam-diam pakai nilai default). Kunci berawalan "nyebrang:". */
const P = "nyebrang:";

function get(key: string): string | null {
  try { return window.localStorage.getItem(P + key); } catch { return null; }
}
function set(key: string, value: string): void {
  try { window.localStorage.setItem(P + key, value); } catch { /* abaikan */ }
}

export const storage = {
  best(): number { const n = Number(get("best")); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; },
  setBest(n: number): void { set("best", String(Math.floor(n))); },
  muted(): boolean { return get("muted") === "1"; },
  setMuted(m: boolean): void { set("muted", m ? "1" : "0"); },
  lastName(): string { return (get("name") ?? "").slice(0, 12); },
  setLastName(n: string): void { set("name", n.slice(0, 12)); },
};
