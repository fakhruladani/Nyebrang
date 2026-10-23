# Riwayat perubahan

## 23 Okt 2026: v1.0.1 – README & kemudahan instalasi
- README ditulis ulang: screenshot, tabel fitur, cara main, diagram arsitektur, instalasi, environment, keamanan, troubleshooting.
- `npm start` bisa dibuka langsung di `http://127.0.0.1:3100/nyebrang/` (server menerima prefix `PUBLIC_BASE`) dan membaca `.env` otomatis.
- Request tidak lagi dicatat ke log (log Fastify berisi IP pemain); IP tetap hanya disimpan sebagai hash.
- `engines.node` >= 22.13 (`node:sqlite`), lisensi MIT.

## 23 Okt 2026: v1.0.0 – F1–F5 (game lengkap)

**Gameplay (F1–F2)**
- Simulasi deterministik di `shared/src/sim/` (60 tick/detik, RNG ber-seed, tanpa `Math.random`/trigonometri) dipakai bersama klien & server.
- Generator dunia endless berurutan: rumput (pohon, jalur bebas dijamin), jalan (mobil/truk), sungai (kayu, arah berselang), rel (kereta + lampu peringatan, mulai baris 50), anjing patroli (mulai baris 120).
- Kesulitan naik dengan jarak, dibatasi 2,5x; bar diam 8 s menyusut ke 5 s.
- Koin (+5), power-up: Siluman 5 s, Tambah waktu, Magnet 8 s, Slow-mo 5 s.
- 6 penyebab mati; animasi mati per penyebab.
- 4 tema visual bergantian tiap 150 baris (Desa, Kota, Hutan, Malam).

**Backend & anti-cheat (F3–F4)**
- SQLite bawaan Node (`node:sqlite`), tabel `runs` & `scores`.
- `POST /api/runs` (seed + token HMAC), `POST /api/runs/:id/finish` (replay penuh di server), `GET /api/leaderboard`, `POST /api/leaderboard/claim`, `/api/admin/*` (butuh `ADMIN_TOKEN`).
- Validasi: token HMAC, replay input harus identik (skor, tick), input tidak sah ditolak, tick > waktu nyata + 2 s ditolak (speed-hack), run sekali kirim, kedaluwarsa 3 jam.
- Leaderboard Top 5; posisi dikunci saat game over, nama 2 menit, lewat → ANONIM; nama 3–12 huruf/angka/spasi + filter kata kasar; skor sama → yang lebih dulu di atas.
- Rate limit per IP: 60 run/jam, 60 kirim/jam, 20 klaim/10 menit.

**Antarmuka (F5)**
- Menu (dunia demo bergerak, Top 5, rekor pribadi), HUD (skor, rekor, bar diam, power-up aktif), jeda (P/Esc, otomatis saat tab disembunyikan), game over + input nama.
- Efek suara sintetis WebAudio + tombol bisu (M).
- Kontrol keyboard & sentuh (tap maju, swipe 4 arah), zoom menyesuaikan lebar layar.

**Test**: 26 (RNG, generator, simulasi, replay, bot keseimbangan, API run/leaderboard/klaim/admin, CSP).

**Batasan yang diketahui**
- Bot/otomasi yang bermain lewat input sah tidak bisa dibedakan dari manusia (batas anti-cheat sisi klien).
- Phaser 3 dipakai sesuai keputusan walau Phaser 4 sudah rilis.

## 23 Okt 2026: F0 – Fondasi
- Monorepo `client` (Vite + TS + Phaser 3.90), `server` (Fastify 5 + TS), `shared`, `deploy`, `docs`, `tests`.
- Pratinjau isometrik, `/api/health`, CSP `connect-src` dibatasi ke `/nyebrang/api/`, berkas deploy.
