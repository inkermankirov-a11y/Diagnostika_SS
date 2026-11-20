"""ZABVENYE account service. Separate from client records. Pilot only."""
import os, sqlite3, hashlib, secrets, hmac, time, json, re, getpass, sys, urllib.request, urllib.parse, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import contextmanager
from pathlib import Path
from http.cookies import SimpleCookie

DATA=Path(os.getenv("ACCOUNT_DATA","/data")); DATA.mkdir(mode=0o700,parents=True,exist_ok=True)
os.umask(0o077)
ORIGIN=os.getenv("ACCOUNT_ORIGIN","https://zabvenye.com").rstrip("/")
SITE=os.getenv("TURNSTILE_SITE_KEY","")
SECRET=os.getenv("TURNSTILE_SECRET_KEY","")
DB=DATA/"accounts.sqlite3"
FEATURES=("clients","sessions","ai","export","calendar","drive")
DEFAULT={"clients":None,"sessions":None,"ai":True,"export":True,"calendar":True,"drive":True}
@contextmanager
def db():
    con=sqlite3.connect(DB,timeout=5); con.row_factory=sqlite3.Row
    try:
        with con: yield con
    finally: con.close()
with db() as c:
    c.executescript("""CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,limits TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,target TEXT,created INTEGER);
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
    """)
def digest(s): return hashlib.sha256(s.encode()).hexdigest()
def password_hash(p):
    salt=secrets.token_hex(16)
    v=hashlib.scrypt(p.encode(),salt=bytes.fromhex(salt),n=32768,r=8,p=1,maxmem=64*1024*1024)
    return salt+":"+v.hex()
def password_ok(p,stored):
    salt,expected=stored.split(":")
    val=hashlib.scrypt(p.encode(),salt=bytes.fromhex(salt),n=32768,r=8,p=1,maxmem=64*1024*1024)
    return hmac.compare_digest(val.hex(),expected)
def valid_email(e): return isinstance(e,str) and len(e)<=254 and bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",e))
def valid_password(p): return isinstance(p,str) and 12<=len(p)<=128 and len(p.encode())<=512
def public(u): return {"id":u["id"],"email":u["email"],"role":u["role"],"enabled":bool(u["enabled"]),"limits":json.loads(u["limits"]),"created":u["created"]}
def audit(c,actor,action,target): c.execute("INSERT INTO audit(actor,action,target,created) VALUES(?,?,?,?)",(actor,action,target,int(time.time())))
def create_user(c,e,p,role):
    ident=secrets.token_hex(16)
    c.execute("INSERT INTO users VALUES(?,?,?,?,?,?,?)",(ident,e,password_hash(p),role,1,json.dumps(DEFAULT),int(time.time())))
    return ident
if len(sys.argv)>1 and sys.argv[1]=="admin":
    email=input("Admin email: ").strip().lower(); p=getpass.getpass("Password (12+ characters): ")
    if not valid_email(email) or not valid_password(p): sys.exit("Invalid email or password")
    if p!=getpass.getpass("Repeat password: "): sys.exit("Passwords differ")
    with db() as c:
        if c.execute("SELECT 1 FROM users WHERE role='admin'").fetchone(): sys.exit("Admin already exists")
        create_user(c,email,p,"admin")
    sys.exit("Admin created")
# Bound memory and CPU for the small VPS. Rate counters are intentionally ephemeral.
LOCK=threading.Lock(); RATE={}; HASH_SLOT=threading.BoundedSemaphore(1); REQUESTS=threading.BoundedSemaphore(12)
DUMMY=password_hash(secrets.token_hex(24))
def allowed(key,limit,window):
    now=time.monotonic()
    with LOCK:
        if len(RATE)>4096:
            for k,v in list(RATE.items()):
                if v[0]<now: RATE.pop(k,None)
        if key not in RATE and len(RATE)>=4096: return False
        end,count=RATE.get(key,(now+window,0))
        if end<now: end,count=now+window,0
        RATE[key]=(end,count+1)
        return count<limit
def captcha(token):
    if not SECRET or not SITE or not isinstance(token,str) or not 1<=len(token)<=2048: return False
    try:
        req=urllib.request.Request("https://challenges.cloudflare.com/turnstile/v0/siteverify",data=urllib.parse.urlencode({"secret":SECRET,"response":token}).encode())
        with urllib.request.urlopen(req,timeout=6) as r: result=json.load(r)
        return result.get("success") is True and result.get("hostname")==urllib.parse.urlparse(ORIGIN).hostname and result.get("action")=="account"
    except Exception: return False
class Error(Exception):
    def __init__(self,status,msg): self.status=status; self.msg=msg
class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup(); self.connection.settimeout(12)
    def log_message(self,*args): pass
    def reply(self,status,data,cookie=None,ctype="application/json"):
        body=json.dumps(data,ensure_ascii=False).encode() if ctype=="application/json" else data
        self.send_response(status); self.send_header("Content-Type",ctype+"; charset=utf-8"); self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store"); self.send_header("X-Content-Type-Options","nosniff"); self.send_header("X-Frame-Options","DENY"); self.send_header("Referrer-Policy","no-referrer")
        self.send_header("Content-Security-Policy","default-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        if cookie: self.send_header("Set-Cookie",cookie)
        self.end_headers(); self.wfile.write(body)
    def body(self):
        if self.headers.get("Origin")!=ORIGIN: raise Error(403,"Недопустимый источник запроса")
        if not self.headers.get("Content-Type","").startswith("application/json"): raise Error(415,"Требуется JSON")
        try:
            n=int(self.headers.get("Content-Length","0"))
            if not 0<n<=8192: raise ValueError()
            v=json.loads(self.rfile.read(n))
            if not isinstance(v,dict): raise ValueError()
            return v
        except Exception: raise Error(400,"Некорректный запрос")
    def token(self):
        try:
            c=SimpleCookie(); c.load(self.headers.get("Cookie","")); return c["__Host-zabvenye_account"].value if "__Host-zabvenye_account" in c else ""
        except Exception: return ""
    def user(self,c,admin=False):
        t=self.token()
        u=c.execute("SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.enabled=1",(digest(t),int(time.time()))).fetchone()
        if not u: raise Error(401,"Войдите в аккаунт")
        if admin and u["role"]!="admin": raise Error(403,"Нет доступа")
        return u
    def issue(self,c,u):
        t=secrets.token_urlsafe(32); now=int(time.time())
        c.execute("DELETE FROM sessions WHERE expires<=?",(now,))
        c.execute("INSERT INTO sessions VALUES(?,?,?)",(digest(t),u["id"],now+86400))
        return "__Host-zabvenye_account="+t+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400"
    def dispatch(self):
        path=urllib.parse.urlsplit(self.path).path.rstrip("/")
        if self.command=="GET":
            if path in ("/account","/account/ui.js","/account/ui.css"):
                file={" /account":"index.html"}.get(" "+path, path.rsplit("/",1)[-1])
                typ={"index.html":"text/html","ui.js":"application/javascript","ui.css":"text/css"}[file]
                return self.reply(200,(Path(__file__).parent/file).read_bytes(),ctype=typ)
            if path=="/account/api/config": return self.reply(200,{"sitekey":SITE if SECRET else ""})
            with db() as c:
                u=self.user(c,path.startswith("/account/api/admin/"))
                if path=="/account/api/me": return self.reply(200,public(u))
                if path=="/account/api/admin/users": return self.reply(200,[public(x) for x in c.execute("SELECT * FROM users ORDER BY created DESC LIMIT 500")])
                if path=="/account/api/admin/audit": return self.reply(200,[dict(x) for x in c.execute("SELECT actor,action,target,created FROM audit ORDER BY id DESC LIMIT 100")])
            raise Error(404,"Не найдено")
        b=self.body()
        if path in ("/account/api/login","/account/api/register"):
            e=b.get("email"); p=b.get("password")
            if not valid_email(e) or not valid_password(p): raise Error(400,"Проверьте email и пароль (12–128 символов)")
            e=e.strip().lower()
            # Global cap plus per-account cap; do not trust caller-provided forwarding headers.
            if not allowed("global-login",40,60) or not allowed("account:"+digest(e),8,900): raise Error(429,"Слишком много попыток. Повторите позже.")
            if not captcha(b.get("captcha")): raise Error(403,"Проверка CAPTCHA не пройдена или не настроена")
            if not HASH_SLOT.acquire(False): raise Error(429,"Сервис занят. Повторите попытку.")
            try:
                with db() as c:
                    if path.endswith("/register"):
                        tok=b.get("invite","")
                        if not isinstance(tok,str) or len(tok)>128: raise Error(400,"Недействительное приглашение")
                        c.execute("BEGIN IMMEDIATE")
                        inv=c.execute("SELECT * FROM invites WHERE token=? AND email=? AND expires>?",(digest(tok),e,int(time.time()))).fetchone()
                        if not inv or c.execute("SELECT 1 FROM users WHERE email=?",(e,)).fetchone(): raise Error(400,"Недействительное приглашение")
                        uid=create_user(c,e,p,"specialist"); c.execute("DELETE FROM invites WHERE token=?",(digest(tok),)); audit(c,uid,"registered",uid)
                        u=c.execute("SELECT * FROM users WHERE id=?",(uid,)).fetchone()
                    else:
                        u=c.execute("SELECT * FROM users WHERE email=?",(e,)).fetchone()
                        ok=password_ok(p,u["password"] if u else DUMMY)
                        if not ok or not u or not u["enabled"]: raise Error(401,"Неверные данные или аккаунт недоступен")
                        audit(c,u["id"],"login",u["id"])
                    cookie=self.issue(c,u); payload=public(u)
                return self.reply(200,payload,cookie)
            finally: HASH_SLOT.release()
        with db() as c:
            u=self.user(c,path.startswith("/account/api/admin/"))
            if path=="/account/api/logout":
                c.execute("DELETE FROM sessions WHERE token=?",(digest(self.token()),))
                return self.reply(200,{"ok":True},"__Host-zabvenye_account=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0")
            if path=="/account/api/admin/invite":
                e=b.get("email")
                if not valid_email(e): raise Error(400,"Некорректный email")
                e=e.lower(); t=secrets.token_urlsafe(32)
                c.execute("DELETE FROM invites WHERE email=? OR expires<=?",(e,int(time.time())))
                c.execute("INSERT INTO invites VALUES(?,?,?)",(digest(t),e,int(time.time())+86400)); audit(c,u["id"],"invite",e)
                payload={"invite":t}
            elif path=="/account/api/admin/update":
                uid=b.get("id"); limits=b.get("limits"); enabled=b.get("enabled")
                if not isinstance(uid,str) or type(enabled) is not bool or not isinstance(limits,dict) or set(limits)!=set(FEATURES): raise Error(400,"Некорректные параметры")
                for k,v in limits.items():
                    if k in ("clients","sessions"):
                        if v is not None and (type(v) is not int or not 0<=v<=1000000): raise Error(400,"Некорректный лимит")
                    elif type(v) is not bool: raise Error(400,"Некорректный переключатель")
                target=c.execute("SELECT * FROM users WHERE id=? AND role='specialist'",(uid,)).fetchone()
                if not target: raise Error(404,"Специалист не найден")
                c.execute("UPDATE users SET enabled=?,limits=? WHERE id=?",(int(enabled),json.dumps(limits),uid))
                if not enabled: c.execute("DELETE FROM sessions WHERE user_id=?",(uid,))
                audit(c,u["id"],"update-access",uid); payload={"ok":True}
            else: raise Error(404,"Не найдено")
        return self.reply(200,payload)
    def do_GET(self): self.run()
    def do_POST(self): self.run()
    def run(self):
        try: self.dispatch()
        except Error as e: self.reply(e.status,{"error":e.msg})
        except (BrokenPipeError,ConnectionResetError): pass
        except Exception: self.reply(500,{"error":"Внутренняя ошибка сервиса"})
class Server(ThreadingHTTPServer):
    daemon_threads=True
    def process_request(self,request,address):
        if not REQUESTS.acquire(False): self.shutdown_request(request); return
        try: super().process_request(request,address)
        except Exception: REQUESTS.release(); raise
    def process_request_thread(self,*args):
        try: super().process_request_thread(*args)
        finally: REQUESTS.release()
if __name__=="__main__":
    Server(("0.0.0.0",8080),Handler).serve_forever()
