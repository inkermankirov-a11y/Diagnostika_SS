#!/usr/bin/env python3
"""Generate Nginx exact static locations for review; never install or reload."""
from pathlib import Path
import re
import sys

manifest = Path(__file__).with_name("static-assets.txt")
root = sys.argv[1] if len(sys.argv) == 2 else ""
if not re.fullmatch(r"/[A-Za-z0-9_./-]+", root) or ".." in root.split("/"):
    raise SystemExit("Usage: generate-static-cache.py /verified/nginx/document/root")
for name in manifest.read_text().splitlines():
    if not re.fullmatch(r"[A-Za-z0-9_./-]+\.(js|css)", name) or ".." in name.split("/"):
        raise SystemExit("Invalid asset path: " + name)
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
    add_header Cache-Control $zabvenye_static_cache_control always;
}}""")
