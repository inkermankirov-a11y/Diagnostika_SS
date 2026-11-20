"""ZABVENYE account service. Separate from client records. Pilot only."""
import os, sqlite3, hashlib, secrets, hmac, time, json, re, getpass, sys, urllib.request, urllib.parse, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import contextmanager
from pathlib import Path
from http.cookies import SimpleCookie
from datetime import date, datetime, timezone, timedelta

DATA=Path(os.getenv("ACCOUNT_DATA","/data")); DATA.mkdir(mode=0o700,parents=True,exist_ok=True)
os.umask(0o077)
ORIGIN=os.getenv("ACCOUNT_ORIGIN","https://zabvenye.com").rstrip("/")
SITE=os.getenv("TURNSTILE_SITE_KEY","")
SECRET=os.getenv("TURNSTILE_SECRET_KEY","")
DB=DATA/"accounts.sqlite3"
AI_AREAS=("chat","session","hypothesis","diagnosis")
FEATURES=("clients","sessions","ai","export","calendar","drive","ai_daily","ai_detailed")+tuple("ai_"+a for a in AI_AREAS)
VALID_ZONES=set(["UTC","Etc/UTC","Etc/GMT","Asia/Kolkata","Europe/Kyiv","Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Asmera","Africa/Bamako","Africa/Bangui","Africa/Banjul","Africa/Bissau","Africa/Blantyre","Africa/Brazzaville","Africa/Bujumbura","Africa/Cairo","Africa/Casablanca","Africa/Ceuta","Africa/Conakry","Africa/Dakar","Africa/Dar_es_Salaam","Africa/Djibouti","Africa/Douala","Africa/El_Aaiun","Africa/Freetown","Africa/Gaborone","Africa/Harare","Africa/Johannesburg","Africa/Juba","Africa/Kampala","Africa/Khartoum","Africa/Kigali","Africa/Kinshasa","Africa/Lagos","Africa/Libreville","Africa/Lome","Africa/Luanda","Africa/Lubumbashi","Africa/Lusaka","Africa/Malabo","Africa/Maputo","Africa/Maseru","Africa/Mbabane","Africa/Mogadishu","Africa/Monrovia","Africa/Nairobi","Africa/Ndjamena","Africa/Niamey","Africa/Nouakchott","Africa/Ouagadougou","Africa/Porto-Novo","Africa/Sao_Tome","Africa/Tripoli","Africa/Tunis","Africa/Windhoek","America/Adak","America/Anchorage","America/Anguilla","America/Antigua","America/Araguaina","America/Argentina/La_Rioja","America/Argentina/Rio_Gallegos","America/Argentina/Salta","America/Argentina/San_Juan","America/Argentina/San_Luis","America/Argentina/Tucuman","America/Argentina/Ushuaia","America/Aruba","America/Asuncion","America/Bahia","America/Bahia_Banderas","America/Barbados","America/Belem","America/Belize","America/Blanc-Sablon","America/Boa_Vista","America/Bogota","America/Boise","America/Buenos_Aires","America/Cambridge_Bay","America/Campo_Grande","America/Cancun","America/Caracas","America/Catamarca","America/Cayenne","America/Cayman","America/Chicago","America/Chihuahua","America/Ciudad_Juarez","America/Coral_Harbour","America/Cordoba","America/Costa_Rica","America/Coyhaique","America/Creston","America/Cuiaba","America/Curacao","America/Danmarkshavn","America/Dawson","America/Dawson_Creek","America/Denver","America/Detroit","America/Dominica","America/Edmonton","America/Eirunepe","America/El_Salvador","America/Fort_Nelson","America/Fortaleza","America/Glace_Bay","America/Godthab","America/Goose_Bay","America/Grand_Turk","America/Grenada","America/Guadeloupe","America/Guatemala","America/Guayaquil","America/Guyana","America/Halifax","America/Havana","America/Hermosillo","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vevay","America/Indiana/Vincennes","America/Indiana/Winamac","America/Indianapolis","America/Inuvik","America/Iqaluit","America/Jamaica","America/Jujuy","America/Juneau","America/Kentucky/Monticello","America/Kralendijk","America/La_Paz","America/Lima","America/Los_Angeles","America/Louisville","America/Lower_Princes","America/Maceio","America/Managua","America/Manaus","America/Marigot","America/Martinique","America/Matamoros","America/Mazatlan","America/Mendoza","America/Menominee","America/Merida","America/Metlakatla","America/Mexico_City","America/Miquelon","America/Moncton","America/Monterrey","America/Montevideo","America/Montserrat","America/Nassau","America/New_York","America/Nome","America/Noronha","America/North_Dakota/Beulah","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/Ojinaga","America/Panama","America/Paramaribo","America/Phoenix","America/Port-au-Prince","America/Port_of_Spain","America/Porto_Velho","America/Puerto_Rico","America/Punta_Arenas","America/Rankin_Inlet","America/Recife","America/Regina","America/Resolute","America/Rio_Branco","America/Santarem","America/Santiago","America/Santo_Domingo","America/Sao_Paulo","America/Scoresbysund","America/Sitka","America/St_Barthelemy","America/St_Johns","America/St_Kitts","America/St_Lucia","America/St_Thomas","America/St_Vincent","America/Swift_Current","America/Tegucigalpa","America/Thule","America/Tijuana","America/Toronto","America/Tortola","America/Vancouver","America/Whitehorse","America/Winnipeg","America/Yakutat","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Macquarie","Antarctica/Mawson","Antarctica/McMurdo","Antarctica/Palmer","Antarctica/Rothera","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok","Arctic/Longyearbyen","Asia/Aden","Asia/Almaty","Asia/Amman","Asia/Anadyr","Asia/Aqtau","Asia/Aqtobe","Asia/Ashgabat","Asia/Atyrau","Asia/Baghdad","Asia/Bahrain","Asia/Baku","Asia/Bangkok","Asia/Barnaul","Asia/Beirut","Asia/Bishkek","Asia/Brunei","Asia/Calcutta","Asia/Chita","Asia/Colombo","Asia/Damascus","Asia/Dhaka","Asia/Dili","Asia/Dubai","Asia/Dushanbe","Asia/Famagusta","Asia/Gaza","Asia/Hebron","Asia/Hong_Kong","Asia/Hovd","Asia/Irkutsk","Asia/Jakarta","Asia/Jayapura","Asia/Jerusalem","Asia/Kabul","Asia/Kamchatka","Asia/Karachi","Asia/Katmandu","Asia/Khandyga","Asia/Krasnoyarsk","Asia/Kuala_Lumpur","Asia/Kuching","Asia/Kuwait","Asia/Macau","Asia/Magadan","Asia/Makassar","Asia/Manila","Asia/Muscat","Asia/Nicosia","Asia/Novokuznetsk","Asia/Novosibirsk","Asia/Omsk","Asia/Oral","Asia/Phnom_Penh","Asia/Pontianak","Asia/Pyongyang","Asia/Qatar","Asia/Qostanay","Asia/Qyzylorda","Asia/Rangoon","Asia/Riyadh","Asia/Saigon","Asia/Sakhalin","Asia/Samarkand","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Srednekolymsk","Asia/Taipei","Asia/Tashkent","Asia/Tbilisi","Asia/Tehran","Asia/Thimphu","Asia/Tokyo","Asia/Tomsk","Asia/Ulaanbaatar","Asia/Urumqi","Asia/Ust-Nera","Asia/Vientiane","Asia/Vladivostok","Asia/Yakutsk","Asia/Yekaterinburg","Asia/Yerevan","Atlantic/Azores","Atlantic/Bermuda","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Faeroe","Atlantic/Madeira","Atlantic/Reykjavik","Atlantic/South_Georgia","Atlantic/St_Helena","Atlantic/Stanley","Australia/Adelaide","Australia/Brisbane","Australia/Broken_Hill","Australia/Darwin","Australia/Eucla","Australia/Hobart","Australia/Lindeman","Australia/Lord_Howe","Australia/Melbourne","Australia/Perth","Australia/Sydney","Europe/Amsterdam","Europe/Andorra","Europe/Astrakhan","Europe/Athens","Europe/Belgrade","Europe/Berlin","Europe/Bratislava","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Busingen","Europe/Chisinau","Europe/Copenhagen","Europe/Dublin","Europe/Gibraltar","Europe/Guernsey","Europe/Helsinki","Europe/Isle_of_Man","Europe/Istanbul","Europe/Jersey","Europe/Kaliningrad","Europe/Kiev","Europe/Kirov","Europe/Lisbon","Europe/Ljubljana","Europe/London","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Mariehamn","Europe/Minsk","Europe/Monaco","Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Podgorica","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Samara","Europe/San_Marino","Europe/Sarajevo","Europe/Saratov","Europe/Simferopol","Europe/Skopje","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Tirane","Europe/Ulyanovsk","Europe/Vaduz","Europe/Vatican","Europe/Vienna","Europe/Vilnius","Europe/Volgograd","Europe/Warsaw","Europe/Zagreb","Europe/Zurich","Indian/Antananarivo","Indian/Chagos","Indian/Christmas","Indian/Cocos","Indian/Comoro","Indian/Kerguelen","Indian/Mahe","Indian/Maldives","Indian/Mauritius","Indian/Mayotte","Indian/Reunion","Pacific/Apia","Pacific/Auckland","Pacific/Bougainville","Pacific/Chatham","Pacific/Easter","Pacific/Efate","Pacific/Enderbury","Pacific/Fakaofo","Pacific/Fiji","Pacific/Funafuti","Pacific/Galapagos","Pacific/Gambier","Pacific/Guadalcanal","Pacific/Guam","Pacific/Honolulu","Pacific/Kiritimati","Pacific/Kosrae","Pacific/Kwajalein","Pacific/Majuro","Pacific/Marquesas","Pacific/Midway","Pacific/Nauru","Pacific/Niue","Pacific/Norfolk","Pacific/Noumea","Pacific/Pago_Pago","Pacific/Palau","Pacific/Pitcairn","Pacific/Ponape","Pacific/Port_Moresby","Pacific/Rarotonga","Pacific/Saipan","Pacific/Tahiti","Pacific/Tarawa","Pacific/Tongatapu","Pacific/Truk","Pacific/Wake","Pacific/Wallis"])
DEFAULT={"clients":10,"sessions":None,"ai":True,"export":True,"calendar":True,"drive":True,"ai_daily":10,"ai_detailed":False,**{"ai_"+a:None for a in AI_AREAS}}
ADMIN_DEFAULT={**DEFAULT,"clients":None,"ai_daily":None,"ai_detailed":True}
@contextmanager
def db():
    con=sqlite3.connect(DB,timeout=5); con.row_factory=sqlite3.Row; con.create_function("casefold",1,lambda v: str(v or "").casefold(),deterministic=True)
    try:
        with con: yield con
    finally: con.close()
with db() as c:
    c.executescript("""CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,limits TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT,action TEXT,target TEXT,created INTEGER);
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_usage(user_id TEXT NOT NULL,day TEXT NOT NULL,area TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,day,area));
    """)
# Public IDs are independent of internal authentication identifiers.
def allocate_id(c,owner,kind,preferred=None):
    old=c.execute("SELECT number FROM public_ids WHERE owner=? AND kind=?",(owner,kind)).fetchone()
    if old: return old[0]
    for _ in range(10000):
        number=preferred or f"{secrets.randbelow(999999)+1:06d}"
        try:
            c.execute("INSERT INTO public_ids VALUES(?,?,?)",(number,owner,kind)); return number
        except sqlite3.IntegrityError:
            if preferred: preferred=None
    # Near exhaustion, select a free slot rather than failing by chance.
    free=c.execute("SELECT printf('%06d',n) FROM (SELECT 1 AS n UNION ALL SELECT CAST(number AS INTEGER)+1 FROM public_ids WHERE CAST(number AS INTEGER)<999999) q WHERE NOT EXISTS(SELECT 1 FROM public_ids WHERE number=printf('%06d',q.n)) LIMIT 1").fetchone()
    if not free: raise RuntimeError("Public ID allocation exhausted")
    c.execute("INSERT INTO public_ids VALUES(?,?,?)",(free[0],owner,kind))
    return free[0]
with db() as c:
    c.execute("BEGIN IMMEDIATE")
    c.execute("CREATE TABLE IF NOT EXISTS public_ids(number TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,UNIQUE(owner,kind))")
    for row in c.execute("SELECT id,role,limits FROM users").fetchall():
        old=json.loads(row["limits"])
        if "ai_daily" not in old:
            defaults=ADMIN_DEFAULT if row["role"]=="admin" else DEFAULT
            limits={**defaults,**old}
            if row["role"]!="admin" and limits["clients"] is None: limits["clients"]=10
            c.execute("UPDATE users SET limits=? WHERE id=?",(json.dumps(limits),row["id"]))
    cols={r[1] for r in c.execute("PRAGMA table_info(users)")}
    for name,typ in (("first_name","TEXT NOT NULL DEFAULT ''"),("last_name","TEXT NOT NULL DEFAULT ''"),("gender","TEXT NOT NULL DEFAULT ''"),("last_seen","INTEGER"),("deleted","INTEGER NOT NULL DEFAULT 0"),("birth_date","TEXT NOT NULL DEFAULT ''"),("country","TEXT NOT NULL DEFAULT ''"),("city","TEXT NOT NULL DEFAULT ''"),("timezone","TEXT NOT NULL DEFAULT ''"),("onboarding_required","INTEGER NOT NULL DEFAULT 0")):
        if name not in cols: c.execute("ALTER TABLE users ADD COLUMN "+name+" "+typ)
    invite_cols={r[1] for r in c.execute("PRAGMA table_info(invites)")}
    for name,typ in (("public_id","TEXT"),("preview","TEXT NOT NULL DEFAULT ''"),("created","INTEGER"),("comment","TEXT NOT NULL DEFAULT ''"),("used_at","INTEGER"),("used_by","TEXT"),("revoked_at","INTEGER"),("created_by","TEXT")):
        if name not in invite_cols: c.execute("ALTER TABLE invites ADD COLUMN "+name+" "+typ)
    for inv in c.execute("SELECT token FROM invites WHERE public_id IS NULL").fetchall():
        c.execute("UPDATE invites SET public_id=?,preview=? WHERE token=?",(secrets.token_hex(12),"Старый код",inv["token"]))
    c.execute("CREATE UNIQUE INDEX IF NOT EXISTS invite_public_id_unique ON invites(public_id)")
    if "details" not in {r[1] for r in c.execute("PRAGMA table_info(audit)")}:
        c.execute("ALTER TABLE audit ADD COLUMN details TEXT NOT NULL DEFAULT '{}'")
    for u in c.execute("SELECT id,role FROM users ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END").fetchall():
        if u["role"]=="admin": allocate_id(c,u["id"],"admin","777777")
        allocate_id(c,u["id"],"specialist","888888" if u["role"]=="admin" else None)
    c.execute("UPDATE users SET last_seen=(SELECT MAX(created) FROM audit WHERE actor=users.id AND action IN ('login','registered')) WHERE last_seen IS NULL")
def profile(b):
    first=b.get("first_name",""); last=b.get("last_name",""); gender=b.get("gender","")
    if not isinstance(first,str) or not isinstance(last,str) or not 1<=len(first.strip())<=80 or not 1<=len(last.strip())<=80 or gender not in ("male","female"):
        raise Error(400,"Укажите имя, фамилию и пол")
    birth=b.get("birth_date",""); country=b.get("country",""); city=b.get("city",""); tz=b.get("timezone","")
    if not all(isinstance(v,str) for v in (birth,country,city,tz)) or not 1<=len(country.strip())<=100 or not 1<=len(city.strip())<=100 or not 1<=len(tz)<=100:
        raise Error(400,"Укажите дату рождения, страну, город и часовой пояс")
    try:
        if tz not in VALID_ZONES: raise ValueError()
        today=datetime.now(timezone.utc).date()+timedelta(days=1)
        born=date.fromisoformat(birth)
        if born.isoformat()!=birth or born>today or born.year<1900: raise ValueError()
    except ValueError: raise Error(400,"Проверьте дату рождения и часовой пояс")
    return first.strip(),last.strip(),gender,birth,country.strip(),city.strip(),tz
def ids(c,uid):
    return {r["kind"]:r["number"] for r in c.execute("SELECT kind,number FROM public_ids WHERE owner=?",(uid,))}
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
def usage(c,u):
    day=datetime.now(timezone.utc).date().isoformat()
    areas={a:0 for a in AI_AREAS}
    for row in c.execute("SELECT area,count FROM ai_usage WHERE user_id=? AND day=?",(u["id"],day)):
        if row["area"] in areas: areas[row["area"]]=row["count"]
    return {"day":day,"total":sum(areas.values()),"areas":areas,"reset":"00:00 UTC"}
def public(c,u):
    nums=ids(c,u["id"])
    return {"id":nums.get("specialist"),"admin_id":nums.get("admin"),"email":u["email"],"role":u["role"],"enabled":bool(u["enabled"]),"limits":json.loads(u["limits"]),"ai_usage":usage(c,u),"created":u["created"],"first_name":u["first_name"],"last_name":u["last_name"],"gender":u["gender"],"birth_date":u["birth_date"],"country":u["country"],"city":u["city"],"timezone":u["timezone"],"onboarding_required":bool(u["onboarding_required"]),"last_seen":u["last_seen"],"deleted":bool(u["deleted"])}
def snapshot(c,uid):
    u=c.execute("SELECT email,role,first_name,last_name FROM users WHERE id=?",(uid,)).fetchone()
    if not u: return {"email":uid}
    nums=ids(c,uid)
    return {"id":nums.get("specialist"),"admin_id":nums.get("admin"),**dict(u)}
def audit_rows(c,offset):
    out=[]
    for r in c.execute("SELECT * FROM audit ORDER BY id DESC LIMIT 100 OFFSET ?",(offset,)):
        d=dict(r); d["details"]=json.loads(d["details"])
        d["actor"]=d["details"].get("actor",snapshot(c,r["actor"]))
        d["target"]=d["details"].get("target",snapshot(c,r["target"]))
        out.append(d)
    return out
def invite_status(row,now):
    if row["used_at"] is not None: return "used"
    if row["revoked_at"] is not None: return "revoked"
    if row["expires"] and row["expires"]<=now: return "expired"
    return "active"
def invite_public(c,row,now):
    return {"id":row["public_id"],"preview":row["preview"],"email":row["email"],"created":row["created"],"expires":row["expires"],"comment":row["comment"],"status":invite_status(row,now),"used_at":row["used_at"],"used_by":snapshot(c,row["used_by"]) if row["used_by"] else None,"revoked_at":row["revoked_at"]}
def create_invite(c,actor,email,hours,comment):
    now=int(time.time())
    if hours not in (24,72,168,0) or type(hours) is not int: raise Error(400,"Некорректный срок")
    if not isinstance(comment,str) or len(comment)>250: raise Error(400,"Комментарий до 250 символов")
    if email and c.execute("SELECT 1 FROM users WHERE email=?",(email,)).fetchone(): raise Error(409,"Аккаунт с этой почтой уже существует")
    token="ZBV-"+secrets.token_urlsafe(32)
    ident=secrets.token_hex(12)
    expiry=now+hours*3600 if hours else 0
    c.execute("INSERT INTO invites(token,email,expires,public_id,preview,created,comment,created_by) VALUES(?,?,?,?,?,?,?,?)",(digest(token),email,expiry,ident,token[:12]+"…",now,comment.strip(),actor))
    audit(c,actor,"invite",email or "Без привязки",{"invitation":{"from":None,"to":token[:12]+"…"},"expiry":{"from":None,"to":hours or "Бессрочно"}})
    return {"invite":token,"id":ident}
def audit(c,actor,action,target,changes=None):
    d={"actor":snapshot(c,actor),"target":snapshot(c,target),"changes":changes or {}}
    c.execute("INSERT INTO audit(actor,action,target,created,details) VALUES(?,?,?,?,?)",(actor,action,target,int(time.time()),json.dumps(d,ensure_ascii=False)))
def create_user(c,e,p,role):
    ident=secrets.token_hex(16)
    c.execute("INSERT INTO users(id,email,password,role,enabled,limits,created) VALUES(?,?,?,?,?,?,?)",(ident,e,password_hash(p),role,1,json.dumps(ADMIN_DEFAULT if role=="admin" else DEFAULT),int(time.time())))
    if role=="admin": allocate_id(c,ident,"admin","777777")
    allocate_id(c,ident,"specialist","888888" if role=="admin" else None)
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
        u=c.execute("SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.enabled=1 AND u.deleted=0",(digest(t),int(time.time()))).fetchone()
        if not u: raise Error(401,"Войдите в аккаунт")
        if admin and u["role"]!="admin": raise Error(403,"Нет доступа")
        now=int(time.time())
        if not u["last_seen"] or now-u["last_seen"]>=60:
            c.execute("UPDATE users SET last_seen=? WHERE id=?",(now,u["id"]))
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
            # Traefik/nginx forward an opaque session cookie; no public data is returned.
            if path=="/account/api/workspace-auth":
                with db() as c:
                    u=c.execute("SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.enabled=1 AND u.deleted=0 AND u.onboarding_required=0",(digest(self.token()),int(time.time()))).fetchone()
                return self.reply(200 if u else 401,{"ok":bool(u)})

            if path=="/account/api/cities":
                q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                name=q.get("q",[""])[0].strip()
                country=q.get("country",[""])[0].upper()
                if not 2<=len(name)<=100 or not re.fullmatch(r"[A-Z]{2}",country): raise Error(400,"Укажите страну и город")
                if not allowed("global-geocoding",90,60): raise Error(429,"Слишком много запросов")
                params=urllib.parse.urlencode({"name":name,"countryCode":country,"count":15,"language":"ru","format":"json"})
                try:
                    with urllib.request.urlopen("https://geocoding-api.open-meteo.com/v1/search?"+params,timeout=5) as response:
                        result=json.loads(response.read(262144))
                    rows=[{"name":v["name"],"region":v.get("admin1",""),"timezone":v.get("timezone","")} for v in result.get("results",[]) if v.get("country_code")==country and isinstance(v.get("name"),str)]
                    return self.reply(200,rows[:12])
                except Exception: raise Error(503,"Справочник городов временно недоступен")

            with db() as c:
                c.execute("BEGIN IMMEDIATE")
                u=self.user(c,path.startswith("/account/api/admin/"))
                if path=="/account/api/me": return self.reply(200,public(c,u))
                q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                def param(k): return q.get(k,[""])[0][:254]
                try: offset=max(0,min(1000000,int(param("offset") or "0")))
                except ValueError: raise Error(400,"Некорректная страница")
                if path=="/account/api/admin/users":
                    where=["1=1"]; args=[]
                    search=param("q")
                    if search:
                        where.append("(instr(casefold(u.email),casefold(?))>0 OR instr(casefold(u.first_name || ' ' || u.last_name),casefold(?))>0 OR EXISTS(SELECT 1 FROM public_ids p WHERE p.owner=u.id AND instr(p.number,?)>0))"); args.extend([search]*3)
                    for k in ("gender","email"):
                        if param(k):
                            where.append("u."+k+"=?" if k=="gender" else "instr(casefold(u.email),casefold(?))>0"); args.append(param(k))
                    if param("status") in ("active","blocked","deleted"):
                        where.append({"active":"u.enabled=1 AND u.deleted=0","blocked":"u.enabled=0 AND u.deleted=0","deleted":"u.deleted=1"}[param("status")])
                    for k,col,op in (("created_from","created",">="),("created_to","created","<"),("seen_from","last_seen",">="),("seen_to","last_seen","<")):
                        if param(k):
                            try: value=int(param(k))
                            except ValueError: raise Error(400,"Некорректная дата")
                            where.append("u."+col+op+"?"); args.append(value)
                    clause=" AND ".join(where)
                    total=c.execute("SELECT count(*) FROM users u WHERE "+clause,args).fetchone()[0]
                    rows=c.execute("SELECT u.* FROM users u JOIN public_ids p ON u.id=p.owner AND p.kind='specialist' WHERE "+clause+" ORDER BY p.number LIMIT 50 OFFSET ?",args+[offset]).fetchall()
                    return self.reply(200,{"items":[public(c,x) for x in rows],"total":total})
                if path=="/account/api/admin/invites":
                    now=int(time.time()); state=param("status")
                    where={"active":"used_at IS NULL AND revoked_at IS NULL AND (expires=0 OR expires>?)","expired":"used_at IS NULL AND revoked_at IS NULL AND expires>0 AND expires<=?","used":"used_at IS NOT NULL","revoked":"used_at IS NULL AND revoked_at IS NOT NULL"}.get(state,"1=1")
                    args=[now] if state in ("active","expired") else []
                    qtext=param("q")
                    if qtext:
                        where+=" AND (instr(casefold(email),casefold(?))>0 OR instr(casefold(comment),casefold(?))>0 OR instr(casefold(preview),casefold(?))>0)"
                        args.extend([qtext]*3)
                    total=c.execute("SELECT count(*) FROM invites WHERE "+where,args).fetchone()[0]
                    rows=c.execute("SELECT * FROM invites WHERE "+where+" ORDER BY created DESC,public_id LIMIT 50 OFFSET ?",args+[offset]).fetchall()
                    return self.reply(200,{"items":[invite_public(c,row,now) for row in rows],"total":total})
                if path=="/account/api/admin/audit":
                    return self.reply(200,{"items":audit_rows(c,offset),"total":c.execute("SELECT count(*) FROM audit").fetchone()[0]})
            raise Error(404,"Не найдено")
        if path.startswith("/account/api/ai/"): return self.ai_proxy(path.rsplit("/",1)[-1])
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
                        if not isinstance(tok,str) or not 1<=len(tok.strip())<=128: raise Error(400,"Недействительное приглашение")
                        c.execute("BEGIN IMMEDIATE")
                        inv=c.execute("SELECT * FROM invites WHERE token=? AND (email=? OR email='') AND (expires=0 OR expires>?) AND used_at IS NULL AND revoked_at IS NULL",(digest(tok.strip()),e,int(time.time()))).fetchone()
                        if not inv or c.execute("SELECT 1 FROM users WHERE email=?",(e,)).fetchone(): raise Error(400,"Недействительное приглашение")
                        if b.get("password_repeat")!=p: raise Error(400,"Пароли не совпадают")
                        uid=create_user(c,e,p,"specialist")
                        c.execute("UPDATE users SET onboarding_required=1,last_seen=? WHERE id=?",(int(time.time()),uid))
                        c.execute("UPDATE invites SET used_at=?,used_by=? WHERE token=?",(int(time.time()),uid,inv["token"])); audit(c,uid,"registered",uid,{"invitation":{"from":None,"to":inv["preview"]}})
                        u=c.execute("SELECT * FROM users WHERE id=?",(uid,)).fetchone()
                    else:
                        u=c.execute("SELECT * FROM users WHERE email=?",(e,)).fetchone()
                        ok=password_ok(p,u["password"] if u else DUMMY)
                        if not ok or not u or not u["enabled"] or u["deleted"]: raise Error(401,"Неверные данные или аккаунт недоступен")
                        c.execute("UPDATE users SET last_seen=? WHERE id=?",(int(time.time()),u["id"])); audit(c,u["id"],"login",u["id"])
                    cookie=self.issue(c,u); uid=u["id"]
                with db() as c: payload=public(c,c.execute("SELECT * FROM users WHERE id=?",(uid,)).fetchone())
                return self.reply(200,payload,cookie)
            finally: HASH_SLOT.release()
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            u=self.user(c,path.startswith("/account/api/admin/"))
            if path=="/account/api/logout":
                c.execute("DELETE FROM sessions WHERE token=?",(digest(self.token()),))
                audit(c,u["id"],"logout",u["id"])
                return self.reply(200,{"ok":True},"__Host-zabvenye_account=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0")
            if path=="/account/api/onboarding":
                first=b.get("first_name",""); last=b.get("last_name",""); birth=b.get("birth_date","")
                if not all(isinstance(v,str) for v in (first,last,birth)) or not 1<=len(first.strip())<=80 or not 1<=len(last.strip())<=80: raise Error(400,"Укажите имя и фамилию")
                try:
                    born=date.fromisoformat(birth)
                    if born.isoformat()!=birth or born.year<1900 or born>datetime.now(timezone.utc).date()+timedelta(days=1): raise ValueError()
                except ValueError: raise Error(400,"Проверьте дату рождения")
                if not u["onboarding_required"]: raise Error(409,"Первичная настройка уже завершена")
                c.execute("UPDATE users SET first_name=?,last_name=?,birth_date=?,onboarding_required=0 WHERE id=?",(first.strip(),last.strip(),birth,u["id"]))
                audit(c,u["id"],"onboarding",u["id"])
                payload={"ok":True}
            elif path=="/account/api/profile":
                if u["onboarding_required"]: raise Error(403,"Сначала завершите первичную настройку")
                first,last,gender,birth,country,city,tz=profile(b)
                changes={k:{"from":u[k],"to":v} for k,v in (("first_name",first),("last_name",last),("gender",gender),("birth_date",birth),("country",country),("city",city),("timezone",tz)) if u[k]!=v}
                c.execute("UPDATE users SET first_name=?,last_name=?,gender=?,birth_date=?,country=?,city=?,timezone=? WHERE id=?",(first,last,gender,birth,country,city,tz,u["id"]))
                if changes: audit(c,u["id"],"profile",u["id"],{k:({"from":"—","to":"Обновлено"} if k in ("birth_date","country","city","timezone") else v) for k,v in changes.items()})
                payload={"ok":True}
            elif path=="/account/api/admin/delete":
                target=c.execute("SELECT u.* FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=0",(b.get("id"),)).fetchone()
                if not target: raise Error(404,"Специалист не найден")
                c.execute("UPDATE users SET deleted=1,enabled=0 WHERE id=?",(target["id"],))
                c.execute("DELETE FROM sessions WHERE user_id=?",(target["id"],))
                audit(c,u["id"],"delete",target["id"],{"deleted":{"from":False,"to":True}})
                payload={"ok":True}
            elif path=="/account/api/admin/invite":
                e=b.get("email","")
                if not isinstance(e,str): raise Error(400,"Некорректный email")
                e=e.strip().lower()
                if e and not valid_email(e): raise Error(400,"Некорректный email")
                payload=create_invite(c,u["id"],e,b.get("hours",24),b.get("comment",""))
            elif path in ("/account/api/admin/invite-revoke","/account/api/admin/invite-reissue"):
                ident=b.get("id")
                if not isinstance(ident,str) or not re.fullmatch(r"[a-f0-9]{24}",ident): raise Error(400,"Некорректное приглашение")
                inv=c.execute("SELECT * FROM invites WHERE public_id=?",(ident,)).fetchone()
                now=int(time.time())
                if not inv or invite_status(inv,now)!="active": raise Error(409,"Приглашение больше не действует")
                c.execute("UPDATE invites SET revoked_at=? WHERE public_id=?",(now,ident))
                audit(c,u["id"],"invite-revoke",inv["email"] or "Без привязки",{"invitation":{"from":inv["preview"],"to":"Отозвано"}})
                if path.endswith("reissue"):
                    hours=b.get("hours",24)
                    payload=create_invite(c,u["id"],inv["email"],hours,inv["comment"])
                else: payload={"ok":True}
            elif path=="/account/api/admin/update":
                uid=b.get("id"); limits=b.get("limits"); enabled=b.get("enabled")
                if not isinstance(uid,str) or type(enabled) is not bool or not isinstance(limits,dict) or set(limits)!=set(FEATURES): raise Error(400,"Некорректные параметры")
                for k,v in limits.items():
                    if k in ("clients","sessions","ai_daily") or k in tuple("ai_"+a for a in AI_AREAS):
                        if v is not None and (type(v) is not int or not 0<=v<=1000000): raise Error(400,"Некорректный лимит")
                    elif type(v) is not bool: raise Error(400,"Некорректный переключатель")
                target=c.execute("SELECT u.* FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=0",(uid,)).fetchone()
                if not target: raise Error(404,"Специалист не найден")
                uid=target["id"]
                old=json.loads(target["limits"]); changes={k:{"from":old[k],"to":v} for k,v in limits.items() if old[k]!=v}
                if bool(target["enabled"])!=enabled: changes["enabled"]={"from":bool(target["enabled"]),"to":enabled}
                c.execute("UPDATE users SET enabled=?,limits=? WHERE id=?",(int(enabled),json.dumps(limits),uid))
                if not enabled: c.execute("DELETE FROM sessions WHERE user_id=?",(uid,))
                if changes: audit(c,u["id"],"update-access",uid,changes)
                payload={"ok":True}
            else: raise Error(404,"Не найдено")
        return self.reply(200,payload)
    def ai_proxy(self,area):
        endpoints={"chat":"diagnostika-client-chat-v1","session":"diagnostika-client-chat-v1","hypothesis":"diagnostika-hypothesis-v1","diagnosis":"diagnostika-ai-request-v2"}
        if area not in endpoints or self.headers.get("Origin")!=ORIGIN: raise Error(403,"Недопустимый запрос")
        ct=self.headers.get("Content-Type","")
        if not (ct.startswith("application/json") or area=="diagnosis" and (ct.startswith("multipart/form-data;") or ct.startswith("application/x-www-form-urlencoded"))): raise Error(415,"Неверный формат")
        try: n=int(self.headers.get("Content-Length","0"))
        except ValueError: raise Error(400,"Некорректный запрос")
        if not 0<n<=2000000: raise Error(413,"Запрос слишком большой")
        raw=self.rfile.read(n)
        with db() as c:
            c.execute("BEGIN IMMEDIATE")
            u=self.user(c)
            if u["onboarding_required"]: raise Error(403,"Завершите настройку профиля")
            limits=json.loads(u["limits"]); stat=usage(c,u)
            if not limits["ai"]: raise Error(403,"AI-инструменты отключены")
            cap=limits["ai_daily"]; sub=limits["ai_"+area]
            if cap is not None and stat["total"]>=cap: raise Error(429,"Суточный лимит AI исчерпан. Обновление в 00:00 UTC.")
            if sub is not None and stat["areas"][area]>=sub: raise Error(429,"Лимит этого раздела исчерпан.")
            if ct.startswith("application/json"):
                try:
                    data=json.loads(raw)
                    if not isinstance(data,dict): raise ValueError()
                except ValueError: raise Error(400,"Некорректный JSON")
                if not limits["ai_detailed"]:
                    for k in ("mode","responseMode","answerMode"):
                        if data.get(k) in ("deep","detailed","long","full"): raise Error(403,"Подробные ответы отключены")
                    if isinstance(data.get("message"),str): data["message"]="Ответь кратко, не более 6 коротких пунктов. "+data["message"]
                raw=json.dumps(data,ensure_ascii=False).encode()
            c.execute("INSERT INTO ai_usage(user_id,day,area,count) VALUES(?,?,?,1) ON CONFLICT(user_id,day,area) DO UPDATE SET count=count+1",(u["id"],stat["day"],area))
        # Count dispatched attempts, including upstream failures; never hold SQLite lock during network I/O.
        req=urllib.request.Request("https://lugovoyn8n.ru/webhook/"+endpoints[area],data=raw,headers={"Content-Type":ct},method="POST")
        try:
            with urllib.request.urlopen(req,timeout=100) as res:
                result=res.read(2000001)
                if len(result)>2000000: raise Error(502,"Ответ AI слишком большой")
                code=res.status
        except urllib.error.HTTPError as e:
            raise Error(502,"AI-сервис вернул ошибку")
        except (OSError,TimeoutError): raise Error(502,"AI-сервис недоступен")
        try: parsed=json.loads(result)
        except ValueError: return self.reply(code,result,ctype="text/plain")
        return self.reply(code,parsed)
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
