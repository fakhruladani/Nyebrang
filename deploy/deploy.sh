#!/usr/bin/env bash
# Deploy dari laptop/VM lokal ke VPS. Butuh host SSH "vps" di ~/.ssh/config.
# 1) sinkron sumber ke ~/nyebrang-src  2) build di VPS  3) salin hasil ke /opt/nyebrang  4) restart  5) verifikasi
set -euo pipefail
HOST="${HOST:-vps}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_URL="${PUBLIC_URL:-https://72-62-122-35.sslip.io}"

rsync -az --delete --exclude node_modules --exclude dist --exclude .git --exclude '*.db*' --exclude data --exclude _to_delete "$ROOT/" "$HOST:nyebrang-src/"

ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd ~/nyebrang-src
npm ci --no-audit --no-fund --loglevel=error
npm test
npm run build
# -rlt: jangan bawa owner/grup/permission dari ~/nyebrang-src (grup /opt/nyebrang harus tetap nyebrang)
rsync -rlt --delete --exclude node_modules --exclude tests ./ /opt/nyebrang/
cd /opt/nyebrang
npm ci --omit=dev --workspace server --no-audit --no-fund --loglevel=error
chgrp -R nyebrang /opt/nyebrang
chmod -R g+rX,o-rwx /opt/nyebrang
sudo -n systemctl restart nyebrang
sleep 2
for i in 1 2 3 4 5; do sudo -n systemctl is-active nyebrang && break; sleep 2; done
curl -fsS http://127.0.0.1:3100/api/health; echo
REMOTE

echo "--- verifikasi publik ---"
curl -fsS -o /dev/null -w "Catatku  %{http_code}\n" "$PUBLIC_URL/"
curl -fsS -o /dev/null -w "Nyebrang %{http_code}\n" "$PUBLIC_URL/nyebrang/"
curl -fsS "$PUBLIC_URL/nyebrang/api/health"; echo
