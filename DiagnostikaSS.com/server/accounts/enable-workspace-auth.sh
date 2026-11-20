#!/bin/bash
# Enable authorization on the existing nginx website. No n8n/Traefik restarts.
set -euo pipefail
umask 077
test "$(id -u)" = 0
ROOT=/opt/zabvenye-source
WEB=zabvenye-web
ACCOUNTS=zabvenye-accounts
CONFIG=/etc/nginx/conf.d/default.conf
BACK=/var/backups/zabvenye-workspace-auth
exec 9>/run/lock/zabvenye-workspace-auth.lock
flock -n 9
bash "$ROOT/DiagnostikaSS.com/server/accounts/update.sh" --enable
# Do not change nginx until the account backend is running and rejects anonymous access.
docker exec "$ACCOUNTS" python -c 'import urllib.request,urllib.error
try:
    urllib.request.urlopen("http://127.0.0.1:8080/account/api/workspace-auth",timeout=5)
except urllib.error.HTTPError as e:
    assert e.code==401, e.code
else:
    raise SystemExit("Anonymous access was allowed")'
docker exec "$WEB" nginx -V 2>&1 | grep -q -- '--with-http_auth_request_module'
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
docker cp "$WEB:$CONFIG" "$work/original.conf"
if grep -q 'ZABVENYE_WORKSPACE_AUTH' "$work/original.conf"; then
  echo "Workspace authorization already configured."
else
  install -d -m 0700 "$BACK"
  test -e "$BACK/default.conf" || install -m 0600 "$work/original.conf" "$BACK/default.conf"
  python3 - "$work/original.conf" "$work/protected.conf" <<'PY'
import re,sys,pathlib
original=pathlib.Path(sys.argv[1]).read_text()
matches=list(re.finditer(r"(?m)^\s*server\s*\{",original))
if len(matches)!=1 or re.search(r"(?m)^\s*auth_request\s+",original):
    raise SystemExit("Unexpected nginx configuration; no changes applied")
# Reject location-specific error handlers that might override the outer 401 redirect.
if re.search(r"(?m)^\s*error_page\s+[^;]*\b401\b",original):
    raise SystemExit("Existing 401 handler; no changes applied")
pos=matches[0].end()
block="""
    # ZABVENYE_WORKSPACE_AUTH
    auth_request /__zabvenye_auth;
    error_page 401 =302 https://zabvenye.com/account;
    location = /__zabvenye_auth {
        internal;
        auth_request off;
        resolver 127.0.0.11 valid=10s ipv6=off;
        set $account_backend zabvenye-accounts:8080;
        proxy_pass http://$account_backend/account/api/workspace-auth;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host zabvenye.com;
        proxy_connect_timeout 3s;
        proxy_read_timeout 5s;
    }
"""
pathlib.Path(sys.argv[2]).write_text(original[:pos]+block+original[pos:])
PY
  chmod 644 "$work/protected.conf"
  docker cp "$work/protected.conf" "$WEB:$CONFIG"
  if ! docker exec "$WEB" nginx -t; then
    docker cp "$work/original.conf" "$WEB:$CONFIG"
    echo "nginx configuration test failed; original restored"
    exit 1
  fi
  if ! docker exec "$WEB" nginx -s reload; then
    docker cp "$work/original.conf" "$WEB:$CONFIG"
    docker exec "$WEB" nginx -s reload || true
    exit 1
  fi
  install -m 0600 "$work/protected.conf" "$BACK/protected.conf"
fi
# Check the actual nginx container over the existing Docker network.
docker exec "$ACCOUNTS" python -c 'import urllib.request,urllib.error,time
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args): return None
opener=urllib.request.build_opener(NoRedirect())
for attempt in range(10):
    try:
        opener.open("http://zabvenye-web/",timeout=3)
    except urllib.error.HTTPError as e:
        if e.code==302 and e.headers.get("Location")=="https://zabvenye.com/account":
            print("PASS: anonymous workspace redirects to sign-in")
            break
    except Exception: pass
    time.sleep(1)
else: raise SystemExit("Workspace authorization check failed; inspect nginx configuration")'
echo "Workspace authorization enabled. Existing account and database retained."
