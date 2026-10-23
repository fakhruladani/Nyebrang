#!/usr/bin/env bash
# Setup SEKALI di VPS (butuh sudo): user layanan, folder, env, systemd, sudoers terbatas, rute Caddy.
# Jalankan: sudo bash ~/nyebrang-src/deploy/setup-vps.sh
# Idempoten: aman dijalankan ulang. Catatku tidak disentuh selain penambahan rute di Caddyfile.
set -euo pipefail

APP_DIR=/opt/nyebrang
DATA_DIR=/var/lib/nyebrang
ETC_DIR=/etc/nyebrang
CADDYFILE=/etc/caddy/Caddyfile
DEPLOY_USER="${SUDO_USER:-dani}"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-https://72-62-122-35.sslip.io}"
SITE_MATCH="${SITE_MATCH:-72-62-122-35.sslip.io}"

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo"; exit 1; }

echo "[1/6] user layanan 'nyebrang'"
id nyebrang >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin nyebrang

echo "[2/6] folder"
install -d -o "$DEPLOY_USER" -g nyebrang -m 2750 "$APP_DIR"  # kode: ditulis deploy user, dibaca layanan (setgid: grup ikut nyebrang)
chgrp nyebrang "$APP_DIR" && chmod 2750 "$APP_DIR"
usermod -aG nyebrang "$DEPLOY_USER"                             # agar deploy user bisa chgrp file ke nyebrang
install -d -o nyebrang -g nyebrang -m 700 "$DATA_DIR"         # database: hanya layanan
install -d -o root -g nyebrang -m 750 "$ETC_DIR"

echo "[3/6] env"
if [ ! -f "$ETC_DIR/nyebrang.env" ]; then
  umask 027
  cat > "$ETC_DIR/nyebrang.env" <<ENV
HOST=127.0.0.1
PORT=3100
PUBLIC_ORIGIN=$PUBLIC_ORIGIN
PUBLIC_BASE=/nyebrang/
DB_PATH=$DATA_DIR/game.db
RUN_TOKEN_SECRET=$(openssl rand -base64 32)
ENV
  chown root:nyebrang "$ETC_DIR/nyebrang.env"; chmod 640 "$ETC_DIR/nyebrang.env"
fi
# token admin untuk moderasi leaderboard (ditambahkan bila belum ada)
grep -q '^ADMIN_TOKEN=' "$ETC_DIR/nyebrang.env" || echo "ADMIN_TOKEN=$(openssl rand -hex 24)" >> "$ETC_DIR/nyebrang.env"

echo "[4/6] systemd"
install -m 644 "$SRC_DIR/deploy/nyebrang.service" /etc/systemd/system/nyebrang.service
systemctl daemon-reload
systemctl enable nyebrang >/dev/null

echo "[5/6] sudoers terbatas untuk deploy (hanya restart/status layanan game)"
SUDOERS=/etc/sudoers.d/nyebrang-deploy
cat > "$SUDOERS.tmp" <<SUD
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart nyebrang, /usr/bin/systemctl status nyebrang, /usr/bin/systemctl is-active nyebrang
SUD
visudo -cf "$SUDOERS.tmp" >/dev/null && mv "$SUDOERS.tmp" "$SUDOERS" && chmod 440 "$SUDOERS"

echo "[6/6] rute Caddy /nyebrang"
if grep -q "handle_path /nyebrang/" "$CADDYFILE"; then
  echo "  rute sudah ada, dilewati"
else
  BACKUP="$CADDYFILE.bak-$(date +%Y%m%d-%H%M%S)"
  cp -p "$CADDYFILE" "$BACKUP"
  # sisipkan potongan tepat setelah baris pembuka blok situs
  python3 - "$CADDYFILE" "$SRC_DIR/deploy/Caddyfile.snippet" "$SITE_MATCH" <<'PY'
import sys
path, snip, site = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines(keepends=True)
snippet = open(snip).read()
for i, l in enumerate(lines):
    s = l.strip()
    if site in s and s.endswith("{") and not s.startswith("#"):
        lines.insert(i + 1, snippet)
        break
else:
    sys.exit("blok situs '%s' tidak ditemukan" % site)
open(path, "w").writelines(lines)
PY
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "  ditambahkan & di-reload (backup: $BACKUP)"
  else
    cp -p "$BACKUP" "$CADDYFILE"
    echo "  GAGAL validasi, Caddyfile dikembalikan dari backup"; exit 1
  fi
fi
echo "Selesai. Lanjut: bash deploy/deploy.sh dari laptop."
