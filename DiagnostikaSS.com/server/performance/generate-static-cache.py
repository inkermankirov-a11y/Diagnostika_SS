#!/usr/bin/env python3
"""Generate Nginx exact static locations for review; never install or reload."""
from pathlib import Path
import re
import sys

manifest = Path(__file__).with_name("static-assets.txt")
names = manifest.read_text().splitlines()
for name in names:
    if not re.fullmatch(r"[A-Za-z0-9_./-]+\.(js|css)", name) or ".." in name.split("/"):
        raise SystemExit("Invalid asset path: " + name)
if len(names) != len(set(names)):
    raise SystemExit("Duplicate asset path")
if sys.argv[1:] == ["--map"]:
    print("map $uri $zabvenye_static_asset {")
    print("    default 0;")
    for name in names:
        print("    ~^/" + re.escape(name) + "$ 1;")
    print("}")
    print(Path(__file__).with_name("static-cache-map.conf").read_text())
    raise SystemExit(0)
root = sys.argv[1] if len(sys.argv) == 2 else ""
if not re.fullmatch(r"/[A-Za-z0-9_./-]+", root) or ".." in root.split("/"):
    raise SystemExit("Usage: generate-static-cache.py /verified/nginx/document/root | --map")
for name in names:
    # Exact matches only; never cache an API route or an arbitrary file extension.
    print(f"""location = /{name} {{
    root {root};
    auth_request /__zabvenye_auth;
    error_page 401 =302 https://zabvenye.com/account;
    try_files $uri =404;
    etag on;
    if_modified_since exact;
    gzip on;
    gzip_vary on;
    gzip_min_length 256;
    gzip_types application/javascript text/javascript text/css;
}}""")
