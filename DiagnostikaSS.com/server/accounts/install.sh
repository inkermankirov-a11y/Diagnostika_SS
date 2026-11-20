#!/bin/bash
# One-time deployment; run on the VPS as root, not on a workstation.
set -euo pipefail
umask 077
SRC=/opt/zabvenye-source/DiagnostikaSS.com/server/accounts
APP=/opt/zabvenye-accounts
DATA=/var/lib/zabvenye-accounts
test "$(id -u)" = 0 || { echo "Run as root"; exit 1; }
docker network inspect n8n_default >/dev/null
if docker container inspect zabvenye-accounts >/dev/null 2>&1; then
  echo "Account container already exists. Refusing to replace it."; exit 1
fi
for f in service.py index.html ui.js ui.css; do test -s "$SRC/$f"; done
install -d -m 0755 "$APP"
for f in service.py index.html ui.js ui.css; do install -m 0644 "$SRC/$f" "$APP/$f"; done
install -d -m 0700 -o 10001 -g 10001 "$DATA"
if test -e "$DATA/accounts.sqlite3"; then echo "Existing account DB found; refusing to overwrite."; exit 1; fi
read -rp 'Turnstile Site Key: ' SITE
read -rsp 'Turnstile Secret Key: ' SECRET; echo
[[ "$SITE" =~ ^[A-Za-z0-9_-]+$ && "$SECRET" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Invalid CAPTCHA keys"; exit 1; }
printf 'ACCOUNT_ORIGIN=https://zabvenye.com\nTURNSTILE_SITE_KEY=%s\nTURNSTILE_SECRET_KEY=%s\n' "$SITE" "$SECRET" > "$APP/accounts.env"
unset SECRET SITE
docker pull python:3.12-alpine
docker run --rm -it --user 10001:10001 --memory 128m --pids-limit 32 \
  -v "$APP:/app:ro" -v "$DATA:/data" \
  python:3.12-alpine python /app/service.py admin
docker run -d --name zabvenye-accounts --restart unless-stopped \
  --network n8n_default --user 10001:10001 --memory 128m --pids-limit 64 \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --env-file "$APP/accounts.env" -v "$APP:/app:ro" -v "$DATA:/data" \
  --label 'traefik.enable=true' \
  --label 'traefik.http.routers.zabvenye-accounts.rule=Host(`zabvenye.com`) && (Path(`/account`) || PathPrefix(`/account/`))' \
  --label 'traefik.http.routers.zabvenye-accounts.priority=100' \
  --label 'traefik.http.routers.zabvenye-accounts.entrypoints=websecure' \
  --label 'traefik.http.routers.zabvenye-accounts.tls=true' \
  --label 'traefik.http.routers.zabvenye-accounts.tls.certresolver=mytlschallenge' \
  --label 'traefik.http.services.zabvenye-accounts.loadbalancer.server.port=8080' \
  python:3.12-alpine python /app/service.py
echo "Account service started. Check https://zabvenye.com/account"
