"""Local integration checks for bounded AI concurrency; no external network or client data."""
import io, os, tempfile, pathlib, runpy, threading, time, json, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
with tempfile.TemporaryDirectory() as tmp:
    os.environ["ACCOUNT_DATA"]=tmp
    m=runpy.run_path(str(pathlib.Path(__file__).with_name("service.py")))
    globals_=m["Handler"].ai_proxy.__globals__
    gate=m["AIGate"](parallel=2,waiting=2,wait_seconds=2)
    globals_["AI_GATE"]=gate
    with m["db"]() as c:
        c.execute("BEGIN IMMEDIATE")
        u=m["create_user"](c,"load@example.invalid","local-test-password-123","specialist")
        c.execute("UPDATE users SET onboarding_required=0,last_seen=? WHERE id=?",(int(time.time()),u))
        c.execute("INSERT INTO sessions VALUES(?,?,?)",(m["digest"]("test-token"),u,int(time.time())+3600))
    server=m["Server"](("127.0.0.1",0),m["Handler"])
    server_thread=threading.Thread(target=server.serve_forever,daemon=True);server_thread.start()
    url="http://127.0.0.1:"+str(server.server_port)+"/account/api/"
    original=urllib.request.urlopen
    lock=threading.Lock();release=threading.Event();entered=[]
    class Response(io.BytesIO):
        status=200
    def fake_upstream(req,*a,**kw):
        if isinstance(req,urllib.request.Request) and req.full_url.startswith("https://lugovoyn8n.ru/webhook/"):
            with lock:entered.append(json.loads(req.data)["id"])
            assert release.wait(8),"test upstream timeout"
            return Response(b'{"ok":true}')
        return original(req,*a,**kw)
    urllib.request.urlopen=fake_upstream
    def call(path,data=None,authorized=True):
        req=urllib.request.Request(url+path,data=None if data is None else json.dumps(data).encode(),headers={"Cookie":"__Host-zabvenye_account="+("test-token" if authorized else "invalid"),"Origin":m["ORIGIN"],"Content-Type":"application/json"})
        try:
            with original(req,timeout=10) as r:return r.status,json.load(r)
        except urllib.error.HTTPError as e:return e.code,json.load(e)
    def wait_for(predicate):
        until=time.monotonic()+3
        while not predicate():
            assert time.monotonic()<until,"condition timeout"
            time.sleep(.01)
    try:
        assert call("workspace-status",authorized=False)[0]==401
        full=call("me")[1];light=call("workspace-status")[1]
        assert light["metrics"]=={"analytics_enabled":False}
        assert {k:v for k,v in light.items() if k!="metrics"}=={k:v for k,v in full.items() if k!="metrics"}
        with ThreadPoolExecutor(max_workers=6) as pool:
            try:
                a=pool.submit(call,"ai/chat",{"id":1})
                b=pool.submit(call,"ai/chat",{"id":2})
                wait_for(lambda:len(entered)==2)
                c=pool.submit(call,"ai/chat",{"id":3})
                wait_for(lambda:len(gate.queue)==1)
                d=pool.submit(call,"ai/chat",{"id":4})
                wait_for(lambda:len(gate.queue)==2)
                assert call("ai/chat",{"id":5})[0]==503
                assert call("ai/chat",{"id":6},False)[0]==401
                assert call("workspace-status")[1]["ai_usage"]["total"]==2
                assert call("workspace-auth")[0]==200
                assert c.result(timeout=5)[0]==503 and d.result(timeout=5)[0]==503
                assert len(gate.queue)==0 and gate.active==2
                assert call("workspace-status")[1]["ai_usage"]["total"]==2
                release.set()
                assert a.result(timeout=5)[0]==200 and b.result(timeout=5)[0]==200
            finally:release.set()
        assert gate.active==0 and not gate.queue
        assert call("ai/chat",{"id":7})[0]==200
        assert call("workspace-status")[1]["ai_usage"]["total"]==3
        # Verify FIFO ordering and release even when execution raises.
        single=m["AIGate"](parallel=1,waiting=2,wait_seconds=3)
        order=[]
        def worker(n):
            try:
                with single.slot():
                    order.append(n)
                    if n==1:raise RuntimeError("fixture")
            except RuntimeError:pass
        with ThreadPoolExecutor(max_workers=2) as pool:
            with single.slot():
                f=pool.submit(worker,1);wait_for(lambda:len(single.queue)==1)
                g=pool.submit(worker,2);wait_for(lambda:len(single.queue)==2)
            f.result(timeout=4);g.result(timeout=4)
        assert order==[1,2] and single.active==0 and not single.queue
        print("PASS: authenticated lightweight status, 2 AI executions + 2 waiters, overflow/timeout without quota use, normal traffic during AI load, FIFO and slot release")
    finally:
        release.set();urllib.request.urlopen=original
        server.shutdown();server.server_close();server_thread.join()
