import { THEME_ROWS } from "@shared/constants";

/** Tema visual berganti tiap THEME_ROWS baris (kosmetik saja). */
export interface Theme {
  name: string;
  grass: [number, number];
  road: number;
  roadMark: number;
  water: number;
  rail: number;
  railBar: number;
  tree: number;
  trunk: number;
  outsideDim: number; // faktor gelap area di luar kolom main
}

export const THEMES: Theme[] = [
  { name: "Desa", grass: [0x8fd46e, 0x84cb63], road: 0x5b5f6b, roadMark: 0xd9dde6, water: 0x4fb3e8, rail: 0x8b7d70, railBar: 0x5a4d42, tree: 0x3f8f3a, trunk: 0x7a5534, outsideDim: 0.8 },
  { name: "Kota", grass: [0xa3c98a, 0x98bf7e], road: 0x4b4f5a, roadMark: 0xf2d16b, water: 0x5aa6c9, rail: 0x7c7c86, railBar: 0x4a4a52, tree: 0x4c7d45, trunk: 0x6b4a33, outsideDim: 0.78 },
  { name: "Hutan", grass: [0x5fa452, 0x579a4a], road: 0x5e5446, roadMark: 0xc9b98f, water: 0x3e9c8f, rail: 0x7a6650, railBar: 0x4d3f30, tree: 0x2d6b2b, trunk: 0x5e4129, outsideDim: 0.75 },
  { name: "Malam", grass: [0x3f6b5a, 0x396252], road: 0x2f3240, roadMark: 0x9aa3c7, water: 0x2a5d8f, rail: 0x51505c, railBar: 0x33323b, tree: 0x24493a, trunk: 0x4a3a2c, outsideDim: 0.72 },
];

export function themeFor(row: number): Theme {
  const i = Math.floor(Math.max(0, row) / THEME_ROWS) % THEMES.length;
  return THEMES[i] as Theme;
}

export const COLORS = {
  car: [0xe85d5d, 0xf2b84b, 0x6c8cf5, 0xb36cf5, 0x4fc9a6, 0xf28b4b],
  truckCab: 0xdfe4ea,
  log: 0x9a6b3f,
  train: 0xd94848,
  trainWindow: 0xfdf2c4,
  lampOn: 0xff3b3b,
  lampOff: 0x5c2b2b,
  dog: 0x8a5a3c,
  coin: 0xffd23f,
  player: 0xfff4d6,
  beak: 0xf29b38,
  comb: 0xe8484d,
  power: { ghost: 0xeef3ff, time: 0x4fd6e8, magnet: 0xff5a7a, slow: 0xa77bff } as Record<string, number>,
};

export const POWER_LABEL: Record<string, string> = {
  ghost: "Siluman", time: "Tambah waktu", magnet: "Magnet", slow: "Slow-mo",
};
