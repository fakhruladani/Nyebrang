/** Validasi & penyaringan nama leaderboard. Nama hanya pernah dirender sebagai teks canvas di klien. */
export const NAME_RE = /^[A-Za-z0-9 ]{3,12}$/;

// kata kasar umum (ID/EN). Kata pendek dicocokkan per kata utuh agar "Taiwan"/"Basuki" tidak ikut tertolak.
const BAD_SUBSTR = [
  "anjing", "bangsat", "bajingan", "kontol", "memek", "ngentot", "entot", "jancok", "jancuk", "goblok", "tolol",
  "kampret", "pepek", "lonte", "pelacur", "perek", "babi", "keparat", "fuck", "shit", "bitch", "pussy", "cunt",
  "nigger", "nigga", "asshole", "bastard",
];
const BAD_WORD = ["asu", "tai", "bego", "dick", "cok", "jembut", "titit", "peler", "sex", "porn"];

export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().replace(/\s+/g, " ");
  return NAME_RE.test(n) ? n : null;
}

export function isBadName(name: string): boolean {
  const lower = name.toLowerCase();
  const squashed = lower.replace(/\s+/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  if (BAD_SUBSTR.some((w) => squashed.includes(w))) return true;
  return lower.split(" ").some((w) => BAD_WORD.includes(w));
}
