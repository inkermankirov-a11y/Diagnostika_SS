#!/bin/bash
set -euo pipefail
umask 077
test "$(id -u)" = 0
exec 9>/run/lock/zabvenye-accounts-update.lock
flock -n 9 || exit 0
ROOT=/opt/zabvenye-source
APP=/opt/zabvenye-accounts
DATA=/var/lib/zabvenye-accounts
BACK=/var/backups/zabvenye-accounts
test -f "$DATA/accounts.sqlite3"
test -f "$APP/accounts.env"
docker inspect -f '{{.State.Running}}' zabvenye-accounts | grep -qx true
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
rev=$(git -C "$ROOT" rev-parse HEAD)
mkdir "$work/new" "$work/test"
changed=0
for f in mascot-guide.webp mascot-pricing.webp zabvenye-orb.webp ui.css ui.js index.html service.py; do
  git -C "$ROOT" show "$rev:DiagnostikaSS.com/server/accounts/$f" > "$work/new/$f"
  test -s "$work/new/$f"
  cmp -s "$work/new/$f" "$APP/$f" || changed=1
done
if test "$changed" = 1; then
  python3 - "$DATA/accounts.sqlite3" "$work/test/accounts.sqlite3" <<'PY'
import sys,sqlite3
src=sqlite3.connect(sys.argv[1],timeout=15)
dst=sqlite3.connect(sys.argv[2])
src.backup(dst)
assert dst.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
dst.close();src.close()
PY
  install -d -m 0700 "$BACK"
  install -m 0600 "$work/test/accounts.sqlite3" "$BACK/accounts.sqlite3.new"
  mv "$BACK/accounts.sqlite3.new" "$BACK/accounts.sqlite3"
  for f in mascot-guide.webp mascot-pricing.webp zabvenye-orb.webp ui.css ui.js index.html service.py; do if test -f "$APP/$f"; then install -m 0600 "$APP/$f" "$BACK/$f"; fi; done
  ACCOUNT_DATA="$work/test" python3 - "$work/new/service.py" <<'PY'
import sys,runpy,secrets
m=runpy.run_path(sys.argv[1])
with m["db"]() as c:
    c.execute("BEGIN IMMEDIATE")
    for u in c.execute("SELECT * FROM users").fetchall():
        d=m["public"](c,u)
        assert len(d["id"])==6 and d["id"]!="000000"
        if d["role"]=="admin": assert len(d["admin_id"])==6 and d["admin_id"]!=d["id"]
    uid=m["create_user"](c,"test-"+secrets.token_hex(8)+"@example.invalid",secrets.token_hex(20),"specialist")
    m["audit"](c,uid,"registered",uid)
    assert m["audit_rows"](c,0)[0]["target"]["id"]==m["ids"](c,uid)["specialist"]
    assert c.execute("SELECT count(*) FROM public_ids").fetchone()[0]==c.execute("SELECT count(DISTINCT number) FROM public_ids").fetchone()[0]
    ident=m["queue_notification"](c,uid,"vip",123)
    assert m["notification_count"](c,uid)==1
    row=c.execute("SELECT * FROM account_notifications WHERE id=?",(ident,)).fetchone()
    assert "VIP" in m["notification_public"](row,"ru")["title"]
    c.execute("UPDATE account_notifications SET read_at=124 WHERE id=?",(ident,))
    assert m["notification_count"](c,uid)==0
print("Migration and registry smoke test passed")
PY
  for f in mascot-guide.webp mascot-pricing.webp zabvenye-orb.webp ui.css ui.js index.html service.py; do
    install -m 0644 "$work/new/$f" "$APP/$f.new"
    mv "$APP/$f.new" "$APP/$f"
  done
  docker restart zabvenye-accounts >/dev/null
  ready=0
  for attempt in $(seq 1 15); do
    if docker exec zabvenye-accounts python -c 'import urllib.request; assert urllib.request.urlopen("http://127.0.0.1:8080/account/api/config",timeout=2).status==200; assert urllib.request.urlopen("http://127.0.0.1:8080/account/mascot-guide.webp",timeout=2).read(4)==b"RIFF"; assert urllib.request.urlopen("http://127.0.0.1:8080/account/mascot-pricing.webp",timeout=2).read(4)==b"RIFF"; assert urllib.request.urlopen("http://127.0.0.1:8080/account/zabvenye-orb.webp",timeout=2).read(4)==b"RIFF"' >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
  done
  test "$ready" = 1 || { echo "Account service failed health check. Backup: $BACK"; exit 1; }
  echo "Account service updated: $rev"
fi
if [[ "$*" == "--enable" ]]; then
  install -m 0755 "$ROOT/DiagnostikaSS.com/server/accounts/update.sh" /usr/local/sbin/zabvenye-accounts-update
  cat > /etc/systemd/system/zabvenye-accounts-update.service <<'UNIT'
[Unit]
Description=Update ZABVENYE account registry from local Git checkout
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/zabvenye-accounts-update
UNIT
  cat > /etc/systemd/system/zabvenye-accounts-update.timer <<'UNIT'
[Unit]
Description=Automatic ZABVENYE account registry updates
[Timer]
OnBootSec=3min
OnUnitActiveSec=2min
Unit=zabvenye-accounts-update.service
[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now zabvenye-accounts-update.timer
  echo "Automatic account updates enabled"
fi
