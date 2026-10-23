# Desain ringkas (sumber utama: dokumen rancangan di Claude Docs)

Keputusan (disetujui 23 Okt 2026):

| Keputusan | Pilihan |
| --- | --- |
| Nama | Nyebrang! |
| URL | `72-62-122-35.sslip.io/nyebrang` (path, satu host dengan Catatku; uji coba, nanti pindah ke VPS sendiri) |
| Perspektif | Isometrik ala Crossy Road (dimetrik miring, 2.5D semu) |
| Engine | Phaser 3 (3.90) |
| Database | SQLite bawaan Node (`node:sqlite`), tanpa dependensi native |
| Anti-cheat | Level 1 (token HMAC, batas kewajaran, rate limit) + Level 2 (replay deterministik di server) |
| Repo | GitHub baru terpisah, push setelah produk selesai |
| Nama ganda di Top 5 | Boleh |
| Aset | Bentuk sederhana (Phaser Graphics) |

Aturan teknis yang mengikat semua fase:

1. Semua keacakan simulasi lewat `shared/src/rng.ts` (seed dari server). Dilarang `Math.random()` di logika game.
2. Logika game (grid, tabrakan, skor) terpisah dari render, dengan langkah waktu tetap `FIXED_STEP_MS`, supaya server bisa memutar ulang run dari seed + log input.
3. Klien hanya boleh memanggil `${BASE_URL}api/*`. CSP `connect-src` dibatasi ke path itu (mitigasi satu origin dengan Catatku).
4. Nama pemain tidak pernah dirender sebagai HTML.

## Tahapan

- [x] F0 – Fondasi: repo, skeleton, pratinjau isometrik, health API, berkas deploy
- [x] F1 – Core gameplay (grid, lompat, jalan, tabrakan, kamera, generator ber-seed, skor jarak)
- [x] F2 – Konten endless (sungai, rel, patroli, bar diam, koin, power-up, kurva kesulitan, tema)
- [x] F3 – Backend & leaderboard (API run, SQLite, klaim nama, personal best)
- [x] F4 – Keamanan (HMAC, kewajaran, rate limit, filter nama, moderasi, replay)
- [x] F5 – Polish (audio, sentuh, dokumentasi)
- [ ] Push ke repo GitHub baru (menunggu instruksi)

## Angka permainan (nilai awal, mudah diubah di `shared/src/constants.ts` & `shared/src/sim/world.ts`)

| Parameter | Nilai |
| --- | --- |
| Tick simulasi | 60/detik |
| Jeda lompat | 8 tick (133 ms) |
| Batas mundur | 4 baris dari baris terjauh |
| Bar diam | 8 s, berkurang 0,5 s tiap 50 baris, minimum 5 s |
| Skor | +1 per baris baru, +5 per koin |
| Kesulitan | 1 + min(jarak/200, 1,5) → maks 2,5x |
| Sungai / rel / patroli mulai | baris 12 / 50 / 120 |
| Power-up | Siluman 5 s, Magnet 8 s, Slow-mo 5 s (dunia 50%), Tambah waktu (bar penuh) |
