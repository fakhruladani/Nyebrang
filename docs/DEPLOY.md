# Deploy Nyebrang! ke VPS (berdampingan dengan Catatku)

Prasyarat: Node.js 22, Caddy, dan Catatku sudah berjalan (lihat repo Catatku). Akses SSH dengan key; host `vps` di `~/.ssh/config`.

## Sekali saja (butuh sudo)

```bash
# dari laptop: kirim sumber
rsync -az --exclude node_modules --exclude dist ./ vps:nyebrang-src/
# di VPS
sudo bash ~/nyebrang-src/deploy/setup-vps.sh
```

Script ini: membuat user sistem `nyebrang`, folder `/opt/nyebrang` (kode), `/var/lib/nyebrang` (DB), `/etc/nyebrang/nyebrang.env` (rahasia acak), memasang `nyebrang.service`, aturan sudoers yang **hanya** mengizinkan `systemctl restart|status|is-active nyebrang` tanpa password, dan menyisipkan rute `/nyebrang` ke Caddyfile (backup otomatis, `caddy validate`, `reload`; jika validasi gagal, backup dipulihkan).

## Setiap update

```bash
bash deploy/deploy.sh
```

Sinkron sumber → `npm ci`, test, build di VPS → salin ke `/opt/nyebrang` → restart layanan game saja → cek health lokal, Catatku, dan game dari publik.

## Isolasi dari Catatku

| Aspek | Catatku | Nyebrang! |
| --- | --- | --- |
| Proses | `catatku.service` | `nyebrang.service` (MemoryMax 256M, CPUQuota 50%) |
| User | `dani` | `nyebrang` (nologin, tanpa sudo) |
| Port | 127.0.0.1:3000 | 127.0.0.1:3100 |
| DB | PostgreSQL `catatku` | SQLite `/var/lib/nyebrang/game.db` |
| URL | `/` | `/nyebrang/` |

## Perintah

```bash
sudo systemctl status nyebrang
sudo journalctl -u nyebrang -f
```

## Moderasi leaderboard

`ADMIN_TOKEN` dibuat otomatis di `/etc/nyebrang/nyebrang.env` (baca dengan `sudo grep ADMIN_TOKEN /etc/nyebrang/nyebrang.env`).

```bash
T=<ADMIN_TOKEN>
curl -s -H "x-admin-token: $T" https://72-62-122-35.sslip.io/nyebrang/api/admin/scores        # daftar
curl -s -X DELETE -H "x-admin-token: $T" https://72-62-122-35.sslip.io/nyebrang/api/admin/scores/ID   # hapus
curl -s -X PATCH -H "x-admin-token: $T" -H 'content-type: application/json' -d '{"name":"ANONIM"}' https://72-62-122-35.sslip.io/nyebrang/api/admin/scores/ID
```

## Database

SQLite di `/var/lib/nyebrang/game.db` (hanya user `nyebrang`). Backup: `sudo sqlite3 /var/lib/nyebrang/game.db ".backup /tmp/game.bak"` atau salin file saat layanan berhenti.

## Rollback rute Caddy

```bash
ls /etc/caddy/Caddyfile.bak-*          # pilih backup sebelum Nyebrang!
sudo cp /etc/caddy/Caddyfile.bak-XXXX /etc/caddy/Caddyfile && sudo systemctl reload caddy
```
