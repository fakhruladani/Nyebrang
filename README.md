# Nyebrang!

Game arkade endless (v1.0.0) "menyeberang jalan" (genre Frogger, tampilan isometrik ala Crossy Road) berbasis Phaser 3, dengan leaderboard global Top 5. Tidak ada save point: satu nyawa, mati = mulai lagi.

- URL (uji coba): https://72-62-122-35.sslip.io/nyebrang/
- Rancangan lengkap: dokumen "Rancangan Game Endless (Varmintz-like) di VPS" (Claude Docs) + `docs/DESAIN.md`
- Berjalan terpisah dari Catatku: user `nyebrang`, port 127.0.0.1:3100, SQLite sendiri.

## Struktur

```
client/   Vite + TypeScript + Phaser 3 (base /nyebrang/)
server/   Fastify + TypeScript (melayani file game + /api)
shared/   kode bersama klien & server (RNG ber-seed, konstanta; nanti simulasi deterministik)
deploy/   systemd unit, potongan Caddyfile, setup-vps.sh, deploy.sh
docs/     DESAIN, DEPLOY, CHANGELOG
tests/    vitest
```

## Cara main

- Maju: ↑/W atau ketuk layar · belok: ←→/AD atau swipe · mundur: ↓/S atau swipe bawah · jeda: P/Esc · suara: M
- Jangan diam terlalu lama (bar di bawah skor). Skor = jarak terjauh + 5 per koin.
- Masuk 5 besar → tulis nama dalam 2 menit.

## Pengembangan lokal

```bash
npm install
npm run dev:server     # http://127.0.0.1:3100
npm run dev:client     # http://localhost:5173/nyebrang/  (proxy /nyebrang/api → server)
npm test
npm run build
```
