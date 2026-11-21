"""Local synthetic latency server for reproducible startup benchmarks only."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import os, sys, time
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        time.sleep(float(os.environ.get("PERF_LATENCY_MS", "40"))/1000)
        return super().do_GET()
    def send_head(self):
        return super().send_head()
if __name__=="__main__":
    ThreadingHTTPServer(("127.0.0.1",8149),partial(Handler,directory=sys.argv[1])).serve_forever()
