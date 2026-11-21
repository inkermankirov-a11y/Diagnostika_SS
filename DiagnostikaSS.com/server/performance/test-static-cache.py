#!/usr/bin/env python3
"""Test candidate Nginx config against synthetic data only."""
import gzip
import http.client
import time

def request(path, cookie=None, extra=None):
    conn = http.client.HTTPConnection("127.0.0.1", 8150, timeout=4)
    headers = dict(extra or {})
    if cookie: headers["Cookie"] = cookie
    try:
        conn.request("GET", path, headers=headers)
        res = conn.getresponse()
        return res.status, {k.lower(): v for k,v in res.getheaders()}, res.read()
    finally:
        conn.close()

for _ in range(30):
    try:
        code, _, _ = request("/")
        break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("Nginx did not start")
cookie = "session=synthetic"
asset = "/app.js?v=stage3-test"
for path in ["/", asset, "/account/api/workspace-profile"]:
    code, headers, _ = request(path)
    assert code == 302, (path, code)
    assert headers.get("location") == "https://zabvenye.com/account", headers
    assert "no-store" in headers.get("cache-control", ""), headers
code, headers, gz = request(asset, cookie, {"Accept-Encoding":"gzip"})
assert code == 200, code
assert headers.get("content-encoding") == "gzip", headers
assert "accept-encoding" in headers.get("vary", "").lower(), headers
assert "private" in headers.get("cache-control", "") and "no-cache" in headers["cache-control"], headers
assert "public" not in headers["cache-control"] and "immutable" not in headers["cache-control"], headers
assert headers.get("etag"), headers
raw = gzip.decompress(gz)
code2, plainheaders, plain = request(asset, cookie)
assert code2 == 200 and raw == plain and len(gz) < len(plain), (code2,len(gz),len(plain))
code, conditional, _ = request(asset, cookie, {"If-None-Match":plainheaders["etag"]})
assert code == 304 and "private" in conditional["cache-control"], (code,conditional)
code, headers, _ = request(asset, None, {"If-None-Match":plainheaders["etag"]})
assert code == 302 and "no-store" in headers["cache-control"], (code,headers)
for path in ["/","/account/api/workspace-profile","/secret.json"]:
    code, headers, _ = request(path,cookie,{"Accept-Encoding":"gzip"})
    assert "no-store" in headers.get("cache-control","") and "content-encoding" not in headers, (path,code,headers)
print("STATIC_CACHE_AUTH_GZIP_OK",{"rawBytes":len(raw),"gzipBytes":len(gz),"revalidated":304,"anonymous":302})
