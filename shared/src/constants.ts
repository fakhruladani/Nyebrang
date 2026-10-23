/** Konstanta game yang dipakai bersama oleh klien dan server (validasi/replay). */
export const GAME_NAME = "Nyebrang!";

/** Lebar area main (kolom 0..GRID_COLUMNS-1). */
export const GRID_COLUMNS = 9;
/** Kolom hiasan di kiri/kanan area main (kendaraan muncul/hilang di sini). */
export const SIDE_MARGIN = 4;

/** Simulasi berjalan dengan langkah tetap 60 tick/detik supaya deterministik dan bisa di-replay server. */
export const TICK_RATE = 60;
export const FIXED_STEP_MS = 1000 / TICK_RATE;
export const STEP_S = 1 / TICK_RATE;

/** Jeda minimum antar-lompatan dalam tick (8 tick ≈ 133 ms). */
export const HOP_COOLDOWN_TICKS = 8;
export const MIN_HOP_INTERVAL_MS = HOP_COOLDOWN_TICKS * FIXED_STEP_MS;
/** Pemain tidak boleh mundur lebih dari ini dari baris terjauhnya. */
export const BACK_LIMIT = 4;
/** Baris awal yang selalu aman (rumput). */
export const START_SAFE_ROWS = 4;

/** Batas diam: bar terisi ulang hanya saat mencapai baris baru. Menyusut seiring jarak. */
export const IDLE_LIMIT_START_TICKS = 8 * TICK_RATE;
export const IDLE_LIMIT_MIN_TICKS = 5 * TICK_RATE;

export const POINTS_PER_ROW = 1;
export const POINTS_PER_COIN = 5;

export const POWER_DURATION_TICKS = {
  ghost: 5 * TICK_RATE,
  magnet: 8 * TICK_RATE,
  slow: 5 * TICK_RATE,
} as const;

/** Pergantian tema visual (kosmetik) tiap N baris. */
export const THEME_ROWS = 150;

export const LEADERBOARD_SIZE = 5;
/** Batas panjang satu run yang diterima server (3 jam). */
export const MAX_RUN_TICKS = 3 * 60 * 60 * TICK_RATE;
