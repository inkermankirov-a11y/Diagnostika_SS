"""ZABVENYE account service. Separate from client records. Pilot only."""
import smtplib, ssl
from email.message import EmailMessage
import base64, os, sqlite3, hashlib, secrets, hmac, time, json, re, getpass, sys, urllib.request, urllib.parse, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import contextmanager
from pathlib import Path
from html import escape
from calendar import monthrange
from http.cookies import SimpleCookie
from datetime import date, datetime, timezone, timedelta

DATA=Path(os.getenv("ACCOUNT_DATA","/data")); DATA.mkdir(mode=0o700,parents=True,exist_ok=True)
os.umask(0o077)
ORIGIN=os.getenv("ACCOUNT_ORIGIN","https://zabvenye.com").rstrip("/")
SITE=os.getenv("TURNSTILE_SITE_KEY","")
SECRET=os.getenv("TURNSTILE_SECRET_KEY","")
DB=DATA/"accounts.sqlite3"
LEGAL_VERSION="1.0"
LICENSE_PAGE_TEXT={"ru":["Вход","Получение лицензии","Рабочее пространство для психологов и гипнотерапевтов","Клиенты, диагностика, сессии, финансы и AI — в одной системе.","Как получить доступ","Подтвердите квалификацию","Подготовьте диплом или сертификат профильного обучения.","Оставьте заявку","Напишите в личные сообщения Telegram. Документы и электронную почту передавайте только лично.","Выберите тариф","Согласуйте условия доступа. Данные для оплаты, если она требуется, будут предоставлены лично.","Получите код","Индивидуальный код будет отправлен на вашу почту. Введите его при регистрации.","Тарифы","Предварительные условия. Доступ и сроки согласовываются при заявке.","FREE","0 ₽","1 месяц","До 5 клиентов. На каждого — 4 сессии, 1 запрос и 1 ситуация в диагностике. 10 AI-запросов суммарно во всех модулях. Срок начинается при активации кода.","STANDARD","399 ₽","при оплате за месяц","199 ₽ / мес.","2 388 ₽ за год одним платежом","Основные рабочие модули","Оставить заявку в Telegram","Уже есть код? Зарегистрироваться","Поддержка"],"en":["Sign in","Get a license","A workspace for psychologists and hypnotherapists","Clients, assessments, sessions, finances and AI — in one place.","How to get access","Confirm your qualifications","Prepare a diploma or certificate of relevant training.","Apply for access","Send a private Telegram message. Share documents and your email privately.","Choose a plan","Agree on access terms. Payment details, if needed, will be provided privately.","Receive your code","Your individual code will be emailed to you. Enter it when registering.","Plans","Proposed terms. Access and duration are agreed when you apply.","FREE","₽0","1 month","Up to 5 clients. Per client: 4 sessions, 1 request and 1 assessment situation. 10 AI requests across all modules. Starts on code activation.","STANDARD","₽399","when paid monthly","₽199 / mo.","₽2,388 for one year, paid upfront","Core workspace modules","Apply in Telegram","Already have a code? Register","Support"],"fr":["Connexion","Obtenir une licence","Un espace de travail pour psychologues et hypnothérapeutes","Clients, évaluations, séances, finances et IA au même endroit.","Comment obtenir un accès","Confirmez vos qualifications","Préparez un diplôme ou certificat de formation pertinente.","Envoyez une demande","Envoyez un message privé sur Telegram. Transmettez vos documents et votre e-mail en privé.","Choisissez une offre","Convenez des conditions. Les informations de paiement seront communiquées en privé si nécessaire.","Recevez votre code","Votre code individuel sera envoyé par e-mail. Saisissez-le à l’inscription.","Offres","Conditions proposées. L’accès et la durée sont convenus lors de la demande.","FREE","0 ₽","1 mois","Jusqu’à 5 clients : 4 séances, 1 demande et 1 situation par client. 10 requêtes IA au total. Dès l’activation du code.","STANDARD","399 ₽","paiement mensuel","199 ₽ / mois","2 388 ₽ pour un an en un paiement","Modules principaux","Envoyer une demande sur Telegram","Vous avez un code ? Inscrivez-vous","Assistance"],"de":["Anmelden","Lizenz erhalten","Arbeitsbereich für Psychologen und Hypnotherapeuten","Klienten, Auswertungen, Sitzungen, Finanzen und KI an einem Ort.","So erhalten Sie Zugang","Qualifikation nachweisen","Halten Sie ein Diplom oder Zertifikat einer einschlägigen Ausbildung bereit.","Zugang beantragen","Senden Sie eine private Telegram-Nachricht. Übermitteln Sie Dokumente und E-Mail privat.","Tarif wählen","Vereinbaren Sie die Zugangsbedingungen. Zahlungsdaten erhalten Sie bei Bedarf privat.","Code erhalten","Ihr persönlicher Code wird per E-Mail zugesandt. Geben Sie ihn bei der Registrierung ein.","Tarife","Vorgeschlagene Konditionen. Zugang und Laufzeit werden bei der Anfrage vereinbart.","FREE","0 ₽","1 Monat","Bis zu 5 Klienten: je 4 Sitzungen, 1 Anliegen und 1 Situation. Insgesamt 10 KI-Anfragen. Ab Codeaktivierung.","STANDARD","399 ₽","bei monatlicher Zahlung","199 ₽ / Monat","2 388 ₽ für ein Jahr als Einmalzahlung","Zentrale Arbeitsmodule","Anfrage auf Telegram","Schon einen Code? Registrieren","Support"],"it":["Accedi","Ottieni una licenza","Uno spazio di lavoro per psicologi e ipnoterapeuti","Clienti, valutazioni, sessioni, finanze e IA in un unico sistema.","Come ottenere accesso","Conferma le qualifiche","Prepara un diploma o un certificato di formazione pertinente.","Invia una richiesta","Invia un messaggio privato su Telegram. Condividi documenti ed e-mail in privato.","Scegli un piano","Concorda le condizioni di accesso. I dati di pagamento, se necessari, saranno comunicati in privato.","Ricevi il codice","Il codice individuale sarà inviato via e-mail. Inseriscilo durante la registrazione.","Piani","Condizioni proposte. Accesso e durata vengono concordati alla richiesta.","FREE","0 ₽","1 mese","Fino a 5 clienti: 4 sessioni, 1 richiesta e 1 situazione per cliente. 10 richieste IA complessive. Dall’attivazione del codice.","STANDARD","399 ₽","con pagamento mensile","199 ₽ / mese","2 388 ₽ per un anno in un unico pagamento","Moduli di lavoro principali","Invia una richiesta su Telegram","Hai già un codice? Registrati","Assistenza"]}
LICENSE_PAGE_TEMPLATE="<!doctype html><html lang=\"{lang}\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>ZABVENYE — {t1}</title><link rel=\"stylesheet\" href=\"/account/ui.css?v=20261122-two-plans-1\"></head><body class=\"license-public\"><header class=\"lp-header\"><div class=\"lp-brand\">ZABVENYE</div><nav aria-label=\"Language\" class=\"lp-languages\">{languages}</nav><a class=\"lp-login\" href=\"/account?lang={lang}\">{t0}</a></header><main class=\"lp-main\"><section class=\"lp-hero\"><p class=\"lp-eyebrow\">{t1}</p><h1>{t2}</h1><p>{t3}</p><a class=\"lp-primary\" href=\"https://t.me/Evgeniy_Prudnikov\" target=\"_blank\" rel=\"noopener noreferrer\">{t25}</a></section><section class=\"lp-section\"><h2>{t4}</h2><ol class=\"lp-steps\"><li><span>1</span><div><h3>{t5}</h3><p>{t6}</p></div></li><li><span>2</span><div><h3>{t7}</h3><p>{t8}</p></div></li><li><span>3</span><div><h3>{t9}</h3><p>{t10}</p></div></li><li><span>4</span><div><h3>{t11}</h3><p>{t12}</p></div></li></ol></section><section class=\"lp-section\"><h2>{t13}</h2><p class=\"lp-muted\">{t14}</p><div class=\"lp-pricing\"><article class=\"lp-plan\"><h3>{t15}</h3><strong>{t16}</strong><p class=\"lp-muted\">{t17}</p><p>{t18}</p></article><article class=\"lp-plan lp-standard\"><h3>{t19}</h3><strong>{t20}</strong><p class=\"lp-muted\">{t21}</p><hr><strong class=\"lp-annual\">{t22}</strong><p class=\"lp-muted\">{t23}</p><p>{t24}</p></article></div></section><section class=\"lp-bottom\"><a class=\"lp-primary\" href=\"https://t.me/Evgeniy_Prudnikov\" target=\"_blank\" rel=\"noopener noreferrer\">{t25}</a><a class=\"lp-login\" href=\"/account?lang={lang}#register\">{t26}</a></section></main><footer class=\"lp-footer\">ZABVENYE · <a href=\"https://t.me/zabvenye_com\" target=\"_blank\" rel=\"noopener noreferrer\">{t27}</a></footer></body></html>"
def license_page(lang):
    if lang not in LICENSE_PAGE_TEXT:lang="ru"
    values={"t"+str(i):escape(v) for i,v in enumerate(LICENSE_PAGE_TEXT[lang])}
    labels={"ru":"RU","en":"EN","fr":"FR","de":"DE","it":"IT"}
    values["lang"]=lang
    values["languages"]="".join('<a href="/account/license?lang='+k+'" lang="'+k+'"'+(' aria-current="page"' if k==lang else '')+'>'+label+'</a>' for k,label in labels.items())
    return LICENSE_PAGE_TEMPLATE.format(**values).encode("utf-8")
LANGUAGES=("ru","en","fr","de","it")
AI_AREAS=("chat","session","hypothesis","diagnosis")
MODULE_FLAGS=("clients_enabled","diagnosis","diagnosis_hints","diagnosis_hypotheses","sessions_enabled","session_planning","attachments","payments","payment_debts","payment_advances","payment_receipts","calendar_reminders","google_calendar","forms","notes","sync","client_import","client_export","questionnaires","free_consultations")
MODULE_LIMITS=("requests_per_client","diagnoses","notes_count","attachment_mb","questionnaire_count","consultation_count")
FEATURES=("clients","sessions","ai","export","calendar","drive","ai_daily","ai_detailed")+tuple("ai_"+a for a in AI_AREAS)+MODULE_FLAGS+MODULE_LIMITS
VALID_ZONES=set(["UTC","Etc/UTC","Etc/GMT","Asia/Kolkata","Europe/Kyiv","Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Asmera","Africa/Bamako","Africa/Bangui","Africa/Banjul","Africa/Bissau","Africa/Blantyre","Africa/Brazzaville","Africa/Bujumbura","Africa/Cairo","Africa/Casablanca","Africa/Ceuta","Africa/Conakry","Africa/Dakar","Africa/Dar_es_Salaam","Africa/Djibouti","Africa/Douala","Africa/El_Aaiun","Africa/Freetown","Africa/Gaborone","Africa/Harare","Africa/Johannesburg","Africa/Juba","Africa/Kampala","Africa/Khartoum","Africa/Kigali","Africa/Kinshasa","Africa/Lagos","Africa/Libreville","Africa/Lome","Africa/Luanda","Africa/Lubumbashi","Africa/Lusaka","Africa/Malabo","Africa/Maputo","Africa/Maseru","Africa/Mbabane","Africa/Mogadishu","Africa/Monrovia","Africa/Nairobi","Africa/Ndjamena","Africa/Niamey","Africa/Nouakchott","Africa/Ouagadougou","Africa/Porto-Novo","Africa/Sao_Tome","Africa/Tripoli","Africa/Tunis","Africa/Windhoek","America/Adak","America/Anchorage","America/Anguilla","America/Antigua","America/Araguaina","America/Argentina/La_Rioja","America/Argentina/Rio_Gallegos","America/Argentina/Salta","America/Argentina/San_Juan","America/Argentina/San_Luis","America/Argentina/Tucuman","America/Argentina/Ushuaia","America/Aruba","America/Asuncion","America/Bahia","America/Bahia_Banderas","America/Barbados","America/Belem","America/Belize","America/Blanc-Sablon","America/Boa_Vista","America/Bogota","America/Boise","America/Buenos_Aires","America/Cambridge_Bay","America/Campo_Grande","America/Cancun","America/Caracas","America/Catamarca","America/Cayenne","America/Cayman","America/Chicago","America/Chihuahua","America/Ciudad_Juarez","America/Coral_Harbour","America/Cordoba","America/Costa_Rica","America/Coyhaique","America/Creston","America/Cuiaba","America/Curacao","America/Danmarkshavn","America/Dawson","America/Dawson_Creek","America/Denver","America/Detroit","America/Dominica","America/Edmonton","America/Eirunepe","America/El_Salvador","America/Fort_Nelson","America/Fortaleza","America/Glace_Bay","America/Godthab","America/Goose_Bay","America/Grand_Turk","America/Grenada","America/Guadeloupe","America/Guatemala","America/Guayaquil","America/Guyana","America/Halifax","America/Havana","America/Hermosillo","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vevay","America/Indiana/Vincennes","America/Indiana/Winamac","America/Indianapolis","America/Inuvik","America/Iqaluit","America/Jamaica","America/Jujuy","America/Juneau","America/Kentucky/Monticello","America/Kralendijk","America/La_Paz","America/Lima","America/Los_Angeles","America/Louisville","America/Lower_Princes","America/Maceio","America/Managua","America/Manaus","America/Marigot","America/Martinique","America/Matamoros","America/Mazatlan","America/Mendoza","America/Menominee","America/Merida","America/Metlakatla","America/Mexico_City","America/Miquelon","America/Moncton","America/Monterrey","America/Montevideo","America/Montserrat","America/Nassau","America/New_York","America/Nome","America/Noronha","America/North_Dakota/Beulah","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/Ojinaga","America/Panama","America/Paramaribo","America/Phoenix","America/Port-au-Prince","America/Port_of_Spain","America/Porto_Velho","America/Puerto_Rico","America/Punta_Arenas","America/Rankin_Inlet","America/Recife","America/Regina","America/Resolute","America/Rio_Branco","America/Santarem","America/Santiago","America/Santo_Domingo","America/Sao_Paulo","America/Scoresbysund","America/Sitka","America/St_Barthelemy","America/St_Johns","America/St_Kitts","America/St_Lucia","America/St_Thomas","America/St_Vincent","America/Swift_Current","America/Tegucigalpa","America/Thule","America/Tijuana","America/Toronto","America/Tortola","America/Vancouver","America/Whitehorse","America/Winnipeg","America/Yakutat","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Macquarie","Antarctica/Mawson","Antarctica/McMurdo","Antarctica/Palmer","Antarctica/Rothera","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok","Arctic/Longyearbyen","Asia/Aden","Asia/Almaty","Asia/Amman","Asia/Anadyr","Asia/Aqtau","Asia/Aqtobe","Asia/Ashgabat","Asia/Atyrau","Asia/Baghdad","Asia/Bahrain","Asia/Baku","Asia/Bangkok","Asia/Barnaul","Asia/Beirut","Asia/Bishkek","Asia/Brunei","Asia/Calcutta","Asia/Chita","Asia/Colombo","Asia/Damascus","Asia/Dhaka","Asia/Dili","Asia/Dubai","Asia/Dushanbe","Asia/Famagusta","Asia/Gaza","Asia/Hebron","Asia/Hong_Kong","Asia/Hovd","Asia/Irkutsk","Asia/Jakarta","Asia/Jayapura","Asia/Jerusalem","Asia/Kabul","Asia/Kamchatka","Asia/Karachi","Asia/Katmandu","Asia/Khandyga","Asia/Krasnoyarsk","Asia/Kuala_Lumpur","Asia/Kuching","Asia/Kuwait","Asia/Macau","Asia/Magadan","Asia/Makassar","Asia/Manila","Asia/Muscat","Asia/Nicosia","Asia/Novokuznetsk","Asia/Novosibirsk","Asia/Omsk","Asia/Oral","Asia/Phnom_Penh","Asia/Pontianak","Asia/Pyongyang","Asia/Qatar","Asia/Qostanay","Asia/Qyzylorda","Asia/Rangoon","Asia/Riyadh","Asia/Saigon","Asia/Sakhalin","Asia/Samarkand","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Srednekolymsk","Asia/Taipei","Asia/Tashkent","Asia/Tbilisi","Asia/Tehran","Asia/Thimphu","Asia/Tokyo","Asia/Tomsk","Asia/Ulaanbaatar","Asia/Urumqi","Asia/Ust-Nera","Asia/Vientiane","Asia/Vladivostok","Asia/Yakutsk","Asia/Yekaterinburg","Asia/Yerevan","Atlantic/Azores","Atlantic/Bermuda","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Faeroe","Atlantic/Madeira","Atlantic/Reykjavik","Atlantic/South_Georgia","Atlantic/St_Helena","Atlantic/Stanley","Australia/Adelaide","Australia/Brisbane","Australia/Broken_Hill","Australia/Darwin","Australia/Eucla","Australia/Hobart","Australia/Lindeman","Australia/Lord_Howe","Australia/Melbourne","Australia/Perth","Australia/Sydney","Europe/Amsterdam","Europe/Andorra","Europe/Astrakhan","Europe/Athens","Europe/Belgrade","Europe/Berlin","Europe/Bratislava","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Busingen","Europe/Chisinau","Europe/Copenhagen","Europe/Dublin","Europe/Gibraltar","Europe/Guernsey","Europe/Helsinki","Europe/Isle_of_Man","Europe/Istanbul","Europe/Jersey","Europe/Kaliningrad","Europe/Kiev","Europe/Kirov","Europe/Lisbon","Europe/Ljubljana","Europe/London","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Mariehamn","Europe/Minsk","Europe/Monaco","Europe/Moscow","Europe/Oslo","Europe/Paris","Europe/Podgorica","Europe/Prague","Europe/Riga","Europe/Rome","Europe/Samara","Europe/San_Marino","Europe/Sarajevo","Europe/Saratov","Europe/Simferopol","Europe/Skopje","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Tirane","Europe/Ulyanovsk","Europe/Vaduz","Europe/Vatican","Europe/Vienna","Europe/Vilnius","Europe/Volgograd","Europe/Warsaw","Europe/Zagreb","Europe/Zurich","Indian/Antananarivo","Indian/Chagos","Indian/Christmas","Indian/Cocos","Indian/Comoro","Indian/Kerguelen","Indian/Mahe","Indian/Maldives","Indian/Mauritius","Indian/Mayotte","Indian/Reunion","Pacific/Apia","Pacific/Auckland","Pacific/Bougainville","Pacific/Chatham","Pacific/Easter","Pacific/Efate","Pacific/Enderbury","Pacific/Fakaofo","Pacific/Fiji","Pacific/Funafuti","Pacific/Galapagos","Pacific/Gambier","Pacific/Guadalcanal","Pacific/Guam","Pacific/Honolulu","Pacific/Kiritimati","Pacific/Kosrae","Pacific/Kwajalein","Pacific/Majuro","Pacific/Marquesas","Pacific/Midway","Pacific/Nauru","Pacific/Niue","Pacific/Norfolk","Pacific/Noumea","Pacific/Pago_Pago","Pacific/Palau","Pacific/Pitcairn","Pacific/Ponape","Pacific/Port_Moresby","Pacific/Rarotonga","Pacific/Saipan","Pacific/Tahiti","Pacific/Tarawa","Pacific/Tongatapu","Pacific/Truk","Pacific/Wake","Pacific/Wallis"])
DEFAULT={"clients":10,"sessions":None,"ai":True,"export":True,"calendar":True,"drive":True,"ai_daily":10,"ai_detailed":False,**{"ai_"+a:None for a in AI_AREAS}}
DEFAULT.update({**{k:True for k in MODULE_FLAGS},**{k:None for k in MODULE_LIMITS}})
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
    CREATE TABLE IF NOT EXISTS vault_recovery(user_id TEXT PRIMARY KEY,secret TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS password_resets(token TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS account_notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',expires INTEGER,created INTEGER NOT NULL,read_at INTEGER,popup_at INTEGER,email_requested INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_try INTEGER NOT NULL DEFAULT 0,sent_at INTEGER);
    CREATE INDEX IF NOT EXISTS account_notifications_owner ON account_notifications(user_id,created,id);
    CREATE TABLE IF NOT EXISTS welcome_mail(user_id TEXT PRIMARY KEY,language TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_try INTEGER NOT NULL DEFAULT 0,sent_at INTEGER);
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
        if set(old)!=set(FEATURES):
            defaults=ADMIN_DEFAULT if row["role"]=="admin" else DEFAULT
            limits={**defaults,**{k:v for k,v in old.items() if k in FEATURES}}
            if row["role"]!="admin" and "clients" not in old: limits["clients"]=10
            c.execute("UPDATE users SET limits=? WHERE id=?",(json.dumps(limits),row["id"]))
    cols={r[1] for r in c.execute("PRAGMA table_info(users)")}
    for name,typ in (("first_name","TEXT NOT NULL DEFAULT ''"),("last_name","TEXT NOT NULL DEFAULT ''"),("gender","TEXT NOT NULL DEFAULT ''"),("last_seen","INTEGER"),("deleted","INTEGER NOT NULL DEFAULT 0"),("birth_date","TEXT NOT NULL DEFAULT ''"),("country","TEXT NOT NULL DEFAULT ''"),("city","TEXT NOT NULL DEFAULT ''"),("timezone","TEXT NOT NULL DEFAULT ''"),("onboarding_required","INTEGER NOT NULL DEFAULT 0"),("ui_language","TEXT NOT NULL DEFAULT 'ru'")):
        if name not in cols: c.execute("ALTER TABLE users ADD COLUMN "+name+" "+typ)
    invite_cols={r[1] for r in c.execute("PRAGMA table_info(invites)")}
    for name,typ in (("public_id","TEXT"),("preview","TEXT NOT NULL DEFAULT ''"),("created","INTEGER"),("comment","TEXT NOT NULL DEFAULT ''"),("used_at","INTEGER"),("used_by","TEXT"),("revoked_at","INTEGER"),("created_by","TEXT")):
        if name not in invite_cols: c.execute("ALTER TABLE invites ADD COLUMN "+name+" "+typ)
    for inv in c.execute("SELECT token FROM invites WHERE public_id IS NULL").fetchall():
        c.execute("UPDATE invites SET public_id=?,preview=? WHERE token=?",(secrets.token_hex(12),"Старый код",inv["token"]))
    c.execute("CREATE UNIQUE INDEX IF NOT EXISTS invite_public_id_unique ON invites(public_id)")
    c.execute("CREATE TABLE IF NOT EXISTS license_archive(public_id TEXT PRIMARY KEY,token TEXT NOT NULL,deleted_at INTEGER NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS license_numbers(number INTEGER PRIMARY KEY AUTOINCREMENT,public_id TEXT NOT NULL UNIQUE)")
    for row in c.execute("SELECT public_id FROM (SELECT public_id,COALESCE(created,0) AS ts FROM invites UNION ALL SELECT public_id,deleted_at AS ts FROM license_archive) ORDER BY ts,public_id").fetchall():
        if not c.execute("SELECT 1 FROM license_numbers WHERE public_id=?",(row["public_id"],)).fetchone():
            c.execute("INSERT INTO license_numbers(public_id) VALUES(?)",(row["public_id"],))
    if "trial_expires" not in cols: c.execute("ALTER TABLE users ADD COLUMN trial_expires INTEGER")
    if "access_plan" not in cols: c.execute("ALTER TABLE users ADD COLUMN access_plan TEXT NOT NULL DEFAULT 'permanent'")
    if "access_plan" not in invite_cols: c.execute("ALTER TABLE invites ADD COLUMN access_plan TEXT NOT NULL DEFAULT 'permanent'")
    c.execute("CREATE TABLE IF NOT EXISTS billing_migrations(name TEXT PRIMARY KEY)")
    if "subscription_expires" not in cols:c.execute("ALTER TABLE users ADD COLUMN subscription_expires INTEGER")
    if "subscription_period" not in cols:c.execute("ALTER TABLE users ADD COLUMN subscription_period TEXT")
    if "billing_period" not in invite_cols:c.execute("ALTER TABLE invites ADD COLUMN billing_period TEXT")
    c.execute("CREATE TABLE IF NOT EXISTS subscription_payments(id TEXT PRIMARY KEY,user_id TEXT,invite_id TEXT,period TEXT NOT NULL,amount INTEGER NOT NULL,paid_at INTEGER NOT NULL,recorded_at INTEGER NOT NULL,actor TEXT NOT NULL,start_at INTEGER,end_at INTEGER)")
    c.execute("CREATE INDEX IF NOT EXISTS subscription_payment_user ON subscription_payments(user_id,paid_at)")
    c.execute("CREATE TABLE IF NOT EXISTS subscription_reminders(user_id TEXT NOT NULL,end_at INTEGER NOT NULL,days INTEGER NOT NULL,sent_at INTEGER,PRIMARY KEY(user_id,end_at,days))")
    if "next_try" not in {row[1] for row in c.execute("PRAGMA table_info(subscription_reminders)")}:c.execute("ALTER TABLE subscription_reminders ADD COLUMN next_try INTEGER NOT NULL DEFAULT 0")
    if c.execute("INSERT OR IGNORE INTO billing_migrations VALUES('vip-first-ten-v1')").rowcount:
        c.execute("UPDATE invites SET access_plan='vip' WHERE access_plan='permanent' AND public_id IN (SELECT public_id FROM license_numbers WHERE number BETWEEN 1 AND 10)")
        c.execute("UPDATE users SET access_plan='vip' WHERE role='specialist' AND access_plan='permanent' AND id IN (SELECT used_by FROM invites WHERE access_plan='vip')")
    c.execute("CREATE TABLE IF NOT EXISTS trial_usage(user_id TEXT NOT NULL,feature TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,feature))")
    c.execute("CREATE TABLE IF NOT EXISTS trial_clients(user_id TEXT NOT NULL,client_key TEXT NOT NULL,sessions INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,client_key))")
    trial_client_cols={row[1] for row in c.execute("PRAGMA table_info(trial_clients)")}
    for field in ("requests","situations"):
        if field not in trial_client_cols:c.execute("ALTER TABLE trial_clients ADD COLUMN "+field+" INTEGER NOT NULL DEFAULT 0")
    for row in c.execute("SELECT id,limits FROM users WHERE access_plan='trial'").fetchall():
        limits=json.loads(row["limits"]);limits["requests_per_client"]=1
        c.execute("UPDATE users SET limits=? WHERE id=?",(json.dumps(limits),row["id"]))
    c.execute("CREATE TABLE IF NOT EXISTS invite_mail(public_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0,next_try INTEGER NOT NULL DEFAULT 0,sent_at INTEGER)")
    if "trial_policy" not in cols:
        c.execute("ALTER TABLE users ADD COLUMN trial_policy INTEGER NOT NULL DEFAULT 0")
        for row in c.execute("SELECT id,trial_expires,limits FROM users WHERE access_plan='trial'").fetchall():
            start=datetime.fromtimestamp((row["trial_expires"] or int(time.time()))-72*3600,timezone.utc)
            month=start.month%12+1; year=start.year+(start.month==12)
            end=start.replace(year=year,month=month,day=min(start.day,monthrange(year,month)[1]))
            limits=json.loads(row["limits"]);limits.update(clients=5,sessions=5,ai_daily=20,ai_detailed=True)
            c.execute("UPDATE users SET trial_expires=?,trial_policy=1,limits=? WHERE id=?",(int(end.timestamp()),json.dumps(limits),row["id"]))
    if "archived_at" not in cols: c.execute("ALTER TABLE users ADD COLUMN archived_at INTEGER")
    if "archived_enabled" not in cols: c.execute("ALTER TABLE users ADD COLUMN archived_enabled INTEGER")
    c.execute("CREATE TABLE IF NOT EXISTS specialist_tombstones(user_id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,purged_at INTEGER NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS legal_acceptance(user_id TEXT NOT NULL,version TEXT NOT NULL,accepted_at INTEGER NOT NULL,PRIMARY KEY(user_id,version))")
    if "language" not in {row[1] for row in c.execute("PRAGMA table_info(legal_acceptance)")}: c.execute("ALTER TABLE legal_acceptance ADD COLUMN language TEXT")
    c.execute("CREATE TABLE IF NOT EXISTS workspace_profiles(user_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,profile TEXT NOT NULL,updated_at INTEGER NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS specialist_metrics(user_id TEXT PRIMARY KEY,client_count INTEGER,reported_at INTEGER)")
    c.execute("CREATE TABLE IF NOT EXISTS analytics_preferences(user_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL,changed_at INTEGER NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS analytics_snapshots(user_id TEXT PRIMARY KEY,counts TEXT NOT NULL,income TEXT NOT NULL,device TEXT NOT NULL,reported_at INTEGER NOT NULL)")
    c.execute("CREATE TABLE IF NOT EXISTS analytics_daily(user_id TEXT NOT NULL,day TEXT NOT NULL,feature TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,day,feature))")
    c.execute("CREATE TABLE IF NOT EXISTS analytics_batches(user_id TEXT NOT NULL,batch TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,batch))")
    c.execute("CREATE TABLE IF NOT EXISTS specialist_days(user_id TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(user_id,day))")
    if "details" not in {r[1] for r in c.execute("PRAGMA table_info(audit)")}:
        c.execute("ALTER TABLE audit ADD COLUMN details TEXT NOT NULL DEFAULT '{}'")
    for u in c.execute("SELECT id,role FROM users ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END").fetchall():
        if u["role"]=="admin": allocate_id(c,u["id"],"admin","777777")
        allocate_id(c,u["id"],"specialist","888888" if u["role"]=="admin" else None)
    c.execute("UPDATE users SET last_seen=(SELECT MAX(created) FROM audit WHERE actor=users.id AND action IN ('login','registered')) WHERE last_seen IS NULL")
    c.execute("UPDATE users SET archived_at=COALESCE((SELECT MAX(created) FROM audit WHERE target=users.id AND action='delete'),?) WHERE deleted=1 AND archived_at IS NULL",(int(time.time()),))
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
# A workspace profile is separate from the client database and has a hard size limit.
WORKSPACE_FIELDS={"name":160,"surname":160,"title":240,"experience":120,"city":140,"region":140,"country":140,"countryCode":2,"currencyCode":3,"about":3000}
def workspace_payload(c,u):
    row=c.execute("SELECT revision,profile,updated_at FROM workspace_profiles WHERE user_id=?",(u["id"],)).fetchone()
    return {"account_id":ids(c,u["id"]).get("specialist"),"revision":row["revision"] if row else 0,"profile":json.loads(row["profile"]) if row else None,"identity":{"name":u["first_name"],"surname":u["last_name"]},"updated_at":row["updated_at"] if row else None}
def workspace_profile(value):
    if not isinstance(value,dict) or set(value)!=(set(WORKSPACE_FIELDS)|{"areas","avatar"}): raise Error(400,"Некорректные поля карточки специалиста")
    out={}
    for key,limit in WORKSPACE_FIELDS.items():
        v=value[key]
        if not isinstance(v,str) or len(v)>limit: raise Error(400,"Слишком длинное или некорректное поле карточки")
        out[key]=v.strip()
    if out["countryCode"] and not re.fullmatch(r"[A-Z]{2}",out["countryCode"]): raise Error(400,"Некорректная страна")
    if out["currencyCode"] and not re.fullmatch(r"[A-Z]{3}",out["currencyCode"]): raise Error(400,"Некорректная валюта")
    areas=value["areas"]
    if not isinstance(areas,list) or len(areas)>24 or any(not isinstance(v,str) or len(v)>160 for v in areas): raise Error(400,"Некорректные направления работы")
    out["areas"]=[v.strip() for v in areas if v.strip()]
    avatar=value["avatar"]
    if not isinstance(avatar,str) or len(avatar)>90000: raise Error(400,"Фотография слишком большая")
    if avatar:
        prefix="data:image/jpeg;base64,"
        if not avatar.startswith(prefix): raise Error(400,"Требуется фотография JPEG")
        try:
            image=base64.b64decode(avatar[len(prefix):],validate=True)
            if len(image)>65536 or not image.startswith(b"\xff\xd8\xff") or not image.endswith(b"\xff\xd9"): raise ValueError()
        except (ValueError,TypeError): raise Error(400,"Некорректная фотография")
    out["avatar"]=avatar
    return out
def ids(c,uid):
    return {r["kind"]:r["number"] for r in c.execute("SELECT kind,number FROM public_ids WHERE owner=?",(uid,))}
def digest(s): return hashlib.sha256(s.encode()).hexdigest()
def vault_recovery_secret(c,uid):
    # Server master is separated from SQLite and kept in the persistent data
    # directory (mode 0600). Losing it makes derived recovery secrets unavailable.
    path=DATA/"vault-recovery-master.key"
    try:
        master=path.read_bytes()
    except FileNotFoundError:
        if c.execute("SELECT 1 FROM vault_recovery WHERE secret='derived-v1' LIMIT 1").fetchone():
            raise Error(503,"Сервис восстановления временно недоступен")
        master=secrets.token_bytes(32)
        try:
            fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,"wb") as out:
                out.write(master);out.flush();os.fsync(out.fileno())
        except FileExistsError:
            master=path.read_bytes()
    if len(master)!=32: raise Error(503,"Сервис восстановления временно недоступен")
    raw=hmac.new(master,("ZABVENYE recovery v1:"+uid).encode(),hashlib.sha256).digest()
    return "ZBV1-"+base64.urlsafe_b64encode(raw).decode().rstrip("=")

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
TRIAL_CAPS={"clients":5,"sessions_per_client":4,"requests_per_client":1,"situations_per_client":1,"ai":10}
def trial_caps(u):
    return {**TRIAL_CAPS,"sessions_per_client":5,"ai":20} if u["trial_policy"]<2 else TRIAL_CAPS
TRIAL_FEATURES=("clients","sessions","requests","situations","ai")
TRIAL_LIMITS={**DEFAULT,"clients":5,"sessions":4,"ai_daily":10,"ai_detailed":True,"client_import":False,"requests_per_client":1}
SUBSCRIPTION_PRICES={"month":399,"year":2388}
def add_months(now,n):
    start=datetime.fromtimestamp(now,timezone.utc)
    y,m=divmod(start.year*12+start.month-1+n,12)
    return int(start.replace(year=y,month=m+1,day=min(start.day,monthrange(y,m+1)[1])).timestamp())
def subscription_expired(u,now=None):
    return u["access_plan"]=="standard" and (not u["subscription_expires"] or u["subscription_expires"]<=(int(time.time()) if now is None else now))
def require_access(u):
    if trial_expired(u):raise Error(403,"Пробный доступ завершён. Оплатите лицензию для продолжения.")
    if subscription_expired(u):raise Error(403,"Подписка STANDARD завершена. Оплатите лицензию для продолжения.")
def billing_summary(c,u):
    if u["role"]=="admin":return None
    plan={"trial":"FREE","vip":"VIP","standard":"STANDARD","permanent":"STANDARD"}.get(u["access_plan"],"STANDARD")
    expires=u["trial_expires"] if plan=="FREE" else u["subscription_expires"] if u["access_plan"]=="standard" else None
    payment=c.execute("SELECT period,amount,paid_at,end_at FROM subscription_payments WHERE user_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 1",(u["id"],)).fetchone()
    now=int(time.time())
    status="archived" if u["deleted"] else "blocked" if not u["enabled"] else "legacy" if u["access_plan"]=="permanent" else "expired" if expires is not None and expires<=now else "pending" if u["access_plan"]=="standard" and not expires else "active"
    return {"plan":plan,"period":u["subscription_period"],"expires":expires,"status":status,"last_payment":dict(payment) if payment else None,"legacy":u["access_plan"]=="permanent"}
def payment_date(value):
    if type(value) is not int or not 0<value<=int(time.time()):raise Error(400,"Укажите действительную дату поступления оплаты")
    return value
NOTIFICATION_COPY={
"ru":("Поздравляем! Ваш тариф — VIP","Администрация ZABVENYE предоставила вам бессрочный доступ по тарифу VIP. Оплата больше не требуется. Благодарим за доверие и желаем продуктивной работы!","Оплата подтверждена","Ваш тариф STANDARD активен. Доступ оплачен до"),
"en":("Congratulations! You now have VIP","The ZABVENYE administration has granted you lifetime VIP access. No further payment is required. Thank you for your trust, and we wish you productive work!","Payment confirmed","Your STANDARD plan is active. Access is paid until"),
"fr":("Félicitations ! Votre offre est VIP","L’administration de ZABVENYE vous a accordé un accès VIP sans limite de durée. Aucun autre paiement n’est nécessaire. Merci de votre confiance et excellent travail !","Paiement confirmé","Votre offre STANDARD est active. Accès payé jusqu’au"),
"de":("Herzlichen Glückwunsch! Sie haben VIP","Die ZABVENYE-Administration hat Ihnen unbefristeten VIP-Zugang gewährt. Weitere Zahlungen sind nicht erforderlich. Vielen Dank für Ihr Vertrauen und viel Erfolg bei Ihrer Arbeit!","Zahlung bestätigt","Ihr STANDARD-Tarif ist aktiv. Zugang bezahlt bis"),
"it":("Congratulazioni! Ora hai il piano VIP","L’amministrazione di ZABVENYE ti ha concesso l’accesso VIP a tempo indeterminato. Non sono necessari ulteriori pagamenti. Grazie per la fiducia e buon lavoro!","Pagamento confermato","Il tuo piano STANDARD è attivo. Accesso pagato fino al")}
def notification_text(row,language):
    vip_title,vip_body,pay_title,pay_body=NOTIFICATION_COPY.get(language,NOTIFICATION_COPY["ru"])
    if row["kind"]=="vip":return vip_title,vip_body
    if row["kind"]=="payment":return pay_title,pay_body+" "+datetime.fromtimestamp(row["expires"],timezone.utc).strftime("%d.%m.%Y %H:%M UTC")+"."
    return row["title"],row["body"]
def queue_notification(c,uid,kind,now,ident=None,title="",body="",expires=None,email=True):
    ident=ident or secrets.token_hex(16)
    c.execute("INSERT OR IGNORE INTO account_notifications(id,user_id,kind,title,body,expires,created,email_requested) VALUES(?,?,?,?,?,?,?,?)",(ident,uid,kind,title,body,expires,now,int(email)))
    return ident
def notification_public(row,language):
    title,body=notification_text(row,language)
    return {"id":row["id"],"kind":row["kind"],"title":title,"body":body,"created":row["created"],"read":row["read_at"] is not None}
def notification_count(c,uid):
    return c.execute("SELECT count(*) FROM account_notifications WHERE user_id=? AND read_at IS NULL",(uid,)).fetchone()[0]
def payment_record(c,actor,target,period,paid_at,request_id,now):
    if period not in SUBSCRIPTION_PRICES:raise Error(400,"Укажите месяц или год")
    if not isinstance(request_id,str) or not re.fullmatch(r"[a-f0-9-]{36}",request_id):raise Error(400,"Некорректный идентификатор оплаты")
    paid_at=payment_date(paid_at)
    if target["access_plan"]=="vip":raise Error(409,"VIP не требует оплаты")
    prev=c.execute("SELECT * FROM subscription_payments WHERE id=?",(request_id,)).fetchone()
    if prev:
        if prev["user_id"]!=target["id"] or prev["period"]!=period or prev["paid_at"]!=paid_at:raise Error(409,"Идентификатор оплаты уже используется")
        return
    start=max(now,target["subscription_expires"] or 0) if target["access_plan"]=="standard" else now
    end=add_months(start,1 if period=="month" else 12)
    c.execute("INSERT INTO subscription_payments VALUES(?,?,?,?,?,?,?,?,?,?)",(request_id,target["id"],None,period,SUBSCRIPTION_PRICES[period],paid_at,now,actor,start,end))
    limits=json.loads(target["limits"])
    if target["access_plan"]=="trial":limits=json.loads(json.dumps(DEFAULT))
    c.execute("UPDATE users SET access_plan='standard',subscription_expires=?,subscription_period=?,trial_expires=NULL,limits=? WHERE id=?",(end,period,json.dumps(limits),target["id"]))
    queue_notification(c,target["id"],"payment",now,ident="payment-"+request_id,expires=end)
    audit(c,actor,"subscription-payment",target["id"],{"amount":{"from":None,"to":SUBSCRIPTION_PRICES[period]},"access_until":{"from":target["subscription_expires"],"to":end}})
def trial_end(now):
    start=datetime.fromtimestamp(now,timezone.utc)
    month=start.month%12+1; year=start.year+(start.month==12)
    return int(start.replace(year=year,month=month,day=min(start.day,monthrange(year,month)[1])).timestamp())
def trial_expired(u,now=None):
    return u["access_plan"]=="trial" and (not u["trial_expires"] or u["trial_expires"]<=(int(time.time()) if now is None else now))
def trial_usage(c,u):
    if u["access_plan"]!="trial":return None
    counts={k:0 for k in TRIAL_FEATURES}
    for row in c.execute("SELECT feature,count FROM trial_usage WHERE user_id=?",(u["id"],)):
        if row["feature"] in counts:counts[row["feature"]]=row["count"]
    caps=trial_caps(u)
    return {"expires":u["trial_expires"],"cap":caps["ai"],"caps":caps,"used":counts,"remaining_ai":max(0,caps["ai"]-counts["ai"]),"expired":trial_expired(u)}
def reserve_trial(c,u,feature,client=None):
    if feature not in TRIAL_FEATURES:raise Error(400,"Некорректный тип лимита")
    if u["access_plan"]!="trial":return
    if trial_expired(u):raise Error(403,"Пробный доступ завершён. Оплатите лицензию для продолжения.")
    uid=u["id"]
    old=c.execute("SELECT count FROM trial_usage WHERE user_id=? AND feature=?",(uid,feature)).fetchone()
    used=old[0] if old else 0
    if feature=="ai":
        if used>=trial_caps(u)["ai"]:raise Error(429,"Лимит AI-запросов пробного доступа исчерпан.")
    else:
        if not isinstance(client,str) or not re.fullmatch(r"[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}",client):raise Error(400,"Некорректный идентификатор лимита")
        key=digest(uid+":"+client)
        slot=c.execute("SELECT sessions,requests,situations FROM trial_clients WHERE user_id=? AND client_key=?",(uid,key)).fetchone()
        if feature=="clients":
            if slot:raise Error(409,"Клиент уже учтён в лимите.")
            if used>=5:raise Error(429,"Лимит FREE: 5 клиентов за месяц.")
            c.execute("INSERT INTO trial_clients(user_id,client_key,sessions) VALUES(?,?,0)",(uid,key))
        else:
            if slot is None:
                registered=c.execute("SELECT count(*) FROM trial_clients WHERE user_id=?",(uid,)).fetchone()[0]
                previous=c.execute("SELECT count FROM trial_usage WHERE user_id=? AND feature='clients'",(uid,)).fetchone()
                if registered >= (previous[0] if previous else 0):raise Error(403,"Сначала создайте клиента в рамках FREE.")
                c.execute("INSERT INTO trial_clients(user_id,client_key,sessions) VALUES(?,?,0)",(uid,key))
                count=0
            else:count=slot[feature]
            cap=trial_caps(u)["sessions_per_client"] if feature=="sessions" else 1
            if count>=cap:raise Error(429,"Лимит FREE для этого клиента исчерпан.")
            if used>=cap*5:raise Error(429,"Общий лимит FREE исчерпан.")
            c.execute("UPDATE trial_clients SET "+feature+"="+feature+"+1 WHERE user_id=? AND client_key=?",(uid,key))
    c.execute("INSERT INTO trial_usage VALUES(?,?,1) ON CONFLICT(user_id,feature) DO UPDATE SET count=count+1",(uid,feature))
def activate_plan(c,uid,plan,now,invite=None):
    if plan=="vip":
        c.execute("UPDATE users SET access_plan='vip' WHERE id=?",(uid,))
        queue_notification(c,uid,"vip",now)
    elif plan=="standard":
        if not invite or invite["billing_period"] not in SUBSCRIPTION_PRICES:raise Error(409,"Оплата STANDARD не зарегистрирована")
        period=invite["billing_period"];end=add_months(now,1 if period=="month" else 12)
        if c.execute("UPDATE subscription_payments SET user_id=?,start_at=?,end_at=? WHERE invite_id=? AND user_id IS NULL",(uid,now,end,invite["public_id"])).rowcount!=1:raise Error(409,"Оплата STANDARD не зарегистрирована")
        c.execute("UPDATE users SET access_plan='standard',subscription_period=?,subscription_expires=? WHERE id=?",(period,end,uid))
    elif plan=="trial":
        c.execute("UPDATE users SET access_plan='trial',trial_expires=?,trial_policy=2,limits=? WHERE id=?",(trial_end(now),json.dumps(TRIAL_LIMITS),uid))
def usage(c,u):
    day=datetime.now(timezone.utc).date().isoformat()
    areas={a:0 for a in AI_AREAS}
    for row in c.execute("SELECT area,count FROM ai_usage WHERE user_id=? AND day=?",(u["id"],day)):
        if row["area"] in areas: areas[row["area"]]=row["count"]
    return {"day":day,"total":sum(areas.values()),"areas":areas,"reset":"00:00 UTC"}
ANALYTICS_COUNTS=("clients","archived_clients","sessions","completed_sessions","planned_sessions","cancelled_sessions","requests","diagnoses","situations","notes","calendar_events","payments","encrypted_storage")
ANALYTICS_FEATURES=("clients","sessions","diagnosis","payments","calendar","notes","storage","google_calendar","google_meet","zoom","teams","attachments","export","questionnaires","consultations")
ANALYTICS_DEVICES={"browser":("Chrome","Edge","Firefox","Safari","Other"),"os":("Windows","macOS","Linux","Android","iOS","Other"),"type":("desktop","mobile","tablet","other")}
def analytics_enabled(c,uid):
    row=c.execute("SELECT enabled FROM analytics_preferences WHERE user_id=?",(uid,)).fetchone()
    return bool(row and row[0])
def bounded_counts(value,keys,maximum):
    if not isinstance(value,dict) or not set(value)<=set(keys) or any(type(v) is not int or not 0<=v<=maximum for v in value.values()): raise Error(400,"Некорректные показатели статистики")
    return value
def save_analytics(c,uid,data,now):
    if not analytics_enabled(c,uid): raise Error(403,"Расширенная статистика отключена")
    if not isinstance(data,dict) or set(data)!={"counts","income","device","events","batch"}: raise Error(400,"Некорректная статистика")
    counts=bounded_counts(data["counts"],ANALYTICS_COUNTS,1000000)
    events=bounded_counts(data["events"],ANALYTICS_FEATURES,10000)
    income=data["income"]
    if not isinstance(income,dict) or len(income)>50 or any(not re.fullmatch(r"[A-Z]{3}",k) or type(v) is not int or not 0<=v<=10**14 for k,v in income.items()): raise Error(400,"Некорректные показатели оплат")
    device=data["device"]
    if not isinstance(device,dict) or set(device)!=set(ANALYTICS_DEVICES) or any(v not in ANALYTICS_DEVICES[k] for k,v in device.items()): raise Error(400,"Некорректный тип устройства")
    batch=data["batch"]
    if not isinstance(batch,str) or not re.fullmatch(r"[a-f0-9-]{36}",batch): raise Error(400,"Некорректный идентификатор отчёта")
    day=datetime.now(timezone.utc).date()
    c.execute("DELETE FROM analytics_batches WHERE created<?",(now-7*86400,))
    c.execute("DELETE FROM analytics_daily WHERE day<?",((day-timedelta(days=89)).isoformat(),))
    if not c.execute("INSERT OR IGNORE INTO analytics_batches VALUES(?,?,?)",(uid,batch,now)).rowcount:return
    c.execute("INSERT INTO analytics_snapshots VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET counts=excluded.counts,income=excluded.income,device=excluded.device,reported_at=excluded.reported_at",(uid,json.dumps(counts),json.dumps(income),json.dumps(device),now))
    for k,v in events.items():
        if v:c.execute("INSERT INTO analytics_daily VALUES(?,?,?,?) ON CONFLICT(user_id,day,feature) DO UPDATE SET count=count+excluded.count",(uid,day.isoformat(),k,v))
def advanced_statistics(c,days,uid=None):
    since=(datetime.now(timezone.utc).date()-timedelta(days=days-1)).isoformat()
    sql=" FROM analytics_snapshots a JOIN users u ON a.user_id=u.id WHERE u.role='specialist' AND u.deleted=0"
    args=[]
    if uid is not None:sql+=" AND u.id=?";args.append(uid)
    rows=c.execute("SELECT a.*"+sql,args).fetchall()
    counts={};income={};devices={}
    for row in rows:
        for k,v in json.loads(row["counts"]).items():counts[k]=counts.get(k,0)+v
        for k,v in json.loads(row["income"]).items():income[k]=income.get(k,0)+v
        for k,v in json.loads(row["device"]).items():
            group=devices.setdefault(k,{})
            group[v]=group.get(v,0)+1
    sql="SELECT d.feature,SUM(d.count) AS n FROM analytics_daily d JOIN users u ON u.id=d.user_id WHERE u.role='specialist' AND u.deleted=0 AND d.day>=?"
    params=[since]
    if uid is not None:sql+=" AND u.id=?";params.append(uid)
    events={row["feature"]:row["n"] for row in c.execute(sql+" GROUP BY d.feature",params)}
    return {"reported_accounts":len(rows),"counts":counts,"income":income,"devices":devices,"events":events,"reported_at":max((row["reported_at"] for row in rows),default=None)}
def specialist_metrics(c,u):
    m=c.execute("SELECT client_count,reported_at FROM specialist_metrics WHERE user_id=?",(u["id"],)).fetchone()
    return {"clients":m["client_count"] if m else None,"reported_at":m["reported_at"] if m else None,"logins":c.execute("SELECT count(*) FROM audit WHERE actor=? AND action='login'",(u["id"],)).fetchone()[0],"analytics_enabled":analytics_enabled(c,u["id"]),"advanced":advanced_statistics(c,30,u["id"]) if analytics_enabled(c,u["id"]) else None,"days30":c.execute("SELECT count(*) FROM specialist_days WHERE user_id=? AND day>=?",(u["id"],(datetime.now(timezone.utc).date()-timedelta(days=29)).isoformat())).fetchone()[0]}
def admin_statistics(c,days):
    today=datetime.now(timezone.utc).date()
    first=today-timedelta(days=days-1)
    start=int(datetime(first.year,first.month,first.day,tzinfo=timezone.utc).timestamp())
    day=first.isoformat()
    users=c.execute("SELECT count(*) AS total,coalesce(sum(enabled=1),0) AS enabled,coalesce(sum(created>=?),0) AS new FROM users WHERE role='specialist' AND deleted=0",(start,)).fetchone()
    active=c.execute("SELECT count(DISTINCT d.user_id) FROM specialist_days d JOIN users u ON u.id=d.user_id WHERE u.role='specialist' AND d.day>=? AND d.day<=?",(day,today.isoformat())).fetchone()[0]
    now=int(time.time())
    recent=c.execute("SELECT count(*) FROM users WHERE role='specialist' AND deleted=0 AND enabled=1 AND last_seen>=?",(now-300,)).fetchone()[0]
    logins=c.execute("SELECT count(*) FROM audit a JOIN users u ON u.id=a.actor WHERE u.role='specialist' AND a.action='login' AND a.created>=?",(start,)).fetchone()[0]
    clients=c.execute("SELECT coalesce(sum(m.client_count),0),count(*) FROM specialist_metrics m JOIN users u ON u.id=m.user_id WHERE u.role='specialist' AND u.deleted=0 AND m.client_count IS NOT NULL").fetchone()
    areas={a:0 for a in AI_AREAS}
    for row in c.execute("SELECT a.area,sum(a.count) AS n FROM ai_usage a JOIN users u ON u.id=a.user_id WHERE u.role='specialist' AND a.day>=? AND a.day<=? GROUP BY a.area",(day,today.isoformat())):
        if row["area"] in areas: areas[row["area"]]=row["n"]
    series={ (first+timedelta(days=i)).isoformat():{"day":(first+timedelta(days=i)).isoformat(),"active":0,"ai":0} for i in range(days)}
    for row in c.execute("SELECT d.day,count(*) AS n FROM specialist_days d JOIN users u ON u.id=d.user_id WHERE u.role='specialist' AND d.day>=? AND d.day<=? GROUP BY d.day",(day,today.isoformat())):
        series[row["day"]]["active"]=row["n"]
    for row in c.execute("SELECT a.day,sum(a.count) AS n FROM ai_usage a JOIN users u ON u.id=a.user_id WHERE u.role='specialist' AND a.day>=? AND a.day<=? GROUP BY a.day",(day,today.isoformat())):
        series[row["day"]]["ai"]=row["n"]
    return {"days":days,"timezone":"UTC","total":users["total"],"enabled":users["enabled"],"new":users["new"],"active":active,"recent":recent,"logins":logins,"clients_snapshot":clients[0],"reported_accounts":clients[1],"ai_total":sum(areas.values()),"ai_areas":areas,"series":list(series.values()),"advanced":advanced_statistics(c,days)}
def legal_acceptance(c,u):
    row=c.execute("SELECT version,accepted_at,language FROM legal_acceptance WHERE user_id=? AND version=?",(u["id"],LEGAL_VERSION)).fetchone()
    return dict(row) if row else None
def public(c,u):
    nums=ids(c,u["id"])
    return {"id":nums.get("specialist"),"admin_id":nums.get("admin"),"email":u["email"],"role":u["role"],"enabled":bool(u["enabled"]),"limits":json.loads(u["limits"]),"ai_usage":usage(c,u),"metrics":specialist_metrics(c,u),"access_plan":u["access_plan"],"billing":billing_summary(c,u),"notifications_unread":notification_count(c,u["id"]),"vip_popup_pending":u["access_plan"]=="vip" and bool(c.execute("SELECT 1 FROM account_notifications WHERE user_id=? AND kind='vip' AND popup_at IS NULL AND read_at IS NULL LIMIT 1",(u["id"],)).fetchone()),"trial":trial_usage(c,u),"created":u["created"],"first_name":u["first_name"],"last_name":u["last_name"],"gender":u["gender"],"birth_date":u["birth_date"],"country":u["country"],"city":u["city"],"timezone":u["timezone"],"ui_language":u["ui_language"],"legal_version":LEGAL_VERSION,"legal_acceptance":legal_acceptance(c,u),"onboarding_required":bool(u["onboarding_required"]),"last_seen":u["last_seen"],"deleted":bool(u["deleted"]),"archived_at":u["archived_at"],"purge_available_at":u["archived_at"]+86400 if u["archived_at"] else None}
def snapshot(c,uid):
    u=c.execute("SELECT email,role,first_name,last_name FROM users WHERE id=?",(uid,)).fetchone()
    if not u:
        tomb=c.execute("SELECT public_id FROM specialist_tombstones WHERE user_id=?",(uid,)).fetchone()
        return {"id":tomb[0],"first_name":"Удалённый специалист"} if tomb else {"email":uid}
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
def invite_key():
    path=DATA/"invite-signing.key"
    try:
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    except FileExistsError:
        key=path.read_bytes()
        if len(key)!=32: raise RuntimeError("Invalid invitation key")
        return key
    key=secrets.token_bytes(32)
    with os.fdopen(fd,"wb") as out:
        out.write(key); out.flush(); os.fsync(out.fileno())
    return key
# A separate secret on the server permits authorized code retrieval without storing plaintext codes.
INVITE_KEY=invite_key()
def derive_invite_code(ident):
    raw=hmac.new(INVITE_KEY,("zabvenye-invite-v1:"+ident).encode(),hashlib.sha256).digest()
    return "ZBV-"+base64.urlsafe_b64encode(raw).decode().rstrip("=")
def recover_invite_code(row):
    candidate=derive_invite_code(row["public_id"])
    return candidate if hmac.compare_digest(digest(candidate),row["token"]) else None
def cleanup_revoked(c):
    # Retain licenses until explicit archival.
    return
def invite_cleanup_loop():
    while True:
        try:
            with db() as c: cleanup_revoked(c)
        except sqlite3.Error: pass
        time.sleep(60)
def invite_status(row,now):
    if row["used_at"] is not None: return "used"
    if row["revoked_at"] is not None: return "revoked"
    if row["expires"] and row["expires"]<=now: return "expired"
    return "active"
# Registry display status is separate from the one-time activation code lifecycle.
INVITE_REGISTRY_STATUS = """CASE
    WHEN i.used_at IS NOT NULL THEN CASE
        WHEN u.id IS NULL OR u.deleted=1 THEN 'archived'
        WHEN u.enabled=0 THEN 'blocked'
        WHEN u.access_plan IN ('trial','standard') AND
             COALESCE(CASE WHEN u.access_plan='trial' THEN u.trial_expires ELSE u.subscription_expires END,0)<=? THEN 'awaiting_payment'
        ELSE 'used' END
    WHEN i.revoked_at IS NOT NULL THEN 'revoked'
    WHEN i.expires>0 AND i.expires<=? THEN 'expired'
    ELSE 'active' END"""
def invite_public(c,row,now):
    owner=c.execute("SELECT * FROM users WHERE id=?",(row["used_by"],)).fetchone() if row["used_by"] else None
    status=row["display_status"] if "display_status" in row.keys() else c.execute("SELECT "+INVITE_REGISTRY_STATUS+" FROM invites i LEFT JOIN users u ON u.id=i.used_by WHERE i.public_id=?",(now,now,row["public_id"])).fetchone()[0]
    access_expires=(owner["trial_expires"] if owner["access_plan"]=="trial" else owner["subscription_expires"] if owner["access_plan"]=="standard" else None) if owner else (trial_end(row["used_at"]) if row["access_plan"]=="trial" and row["used_at"] is not None else add_months(row["used_at"],1 if row["billing_period"]=="month" else 12) if row["access_plan"]=="standard" and row["used_at"] is not None else None)
    number=c.execute("SELECT number FROM license_numbers WHERE public_id=?",(row["public_id"],)).fetchone()
    payment=c.execute("SELECT amount FROM subscription_payments WHERE invite_id=? ORDER BY recorded_at LIMIT 1",(row["public_id"],)).fetchone()
    return {"id":row["public_id"],"license_number":f"{number[0]:06d}" if number else None,"preview":row["preview"],"email":row["email"],"created":row["created"],"expires":row["expires"],"comment":row["comment"],"status":status,"used_at":row["used_at"],"used_by":snapshot(c,row["used_by"]) if row["used_by"] else None,"revoked_at":row["revoked_at"],"access_plan":row["access_plan"],"billing_period":row["billing_period"],"paid_amount":payment[0] if payment else None,"access_expires":access_expires,"current_access_plan":owner["access_plan"] if owner else None}
def create_invite(c,actor,email,hours,comment,plan='standard',period=None,paid_at=None):
    now=int(time.time())
    if hours not in (24,72,168,0) or type(hours) is not int: raise Error(400,"Некорректный срок")
    if plan not in ("trial","standard","vip"): raise Error(400,"Некорректный тип лицензии")
    if plan=="standard":
        if period not in SUBSCRIPTION_PRICES:raise Error(400,"Укажите оплаченный период")
        paid_at=payment_date(paid_at)
        if not email:raise Error(400,"STANDARD должен быть привязан к email")
        if c.execute("SELECT 1 FROM invites WHERE email=? AND access_plan='standard' AND used_at IS NULL",(email,)).fetchone():raise Error(409,"Для этой почты уже есть оплаченный код. Используйте существующую лицензию или перевыпустите срок активации.")
    elif period is not None or paid_at is not None:raise Error(400,"Оплата предусмотрена только для STANDARD")
    if plan=="trial" and not email: raise Error(400,"Пробная лицензия должна быть привязана к email")
    if plan=="trial" and c.execute("SELECT 1 FROM invites WHERE email=? AND access_plan='trial' AND used_at IS NOT NULL",(email,)).fetchone():raise Error(409,"Пробный доступ для этой почты уже использован")
    if not isinstance(comment,str) or len(comment)>250: raise Error(400,"Комментарий до 250 символов")
    if email and c.execute("SELECT 1 FROM users WHERE email=?",(email,)).fetchone(): raise Error(409,"Аккаунт с этой почтой уже существует")
    ident=secrets.token_hex(16)
    while c.execute("SELECT 1 FROM license_archive WHERE public_id=? UNION SELECT 1 FROM invites WHERE public_id=?",(ident,ident)).fetchone(): ident=secrets.token_hex(16)
    token=derive_invite_code(ident)
    expiry=now+hours*3600 if hours else 0
    c.execute("INSERT INTO invites(token,email,expires,public_id,preview,created,comment,created_by,access_plan,billing_period) VALUES(?,?,?,?,?,?,?,?,?,?)",(digest(token),email,expiry,ident,token[:12]+"…",now,comment.strip(),actor,plan,period))
    if plan=="trial":c.execute("INSERT INTO invite_mail(public_id) VALUES(?)",(ident,))
    if plan=="standard":c.execute("INSERT INTO subscription_payments VALUES(?,?,?,?,?,?,?,?,?,?)",(secrets.token_hex(16),None,ident,period,SUBSCRIPTION_PRICES[period],paid_at,now,actor,None,None))
    number=c.execute("INSERT INTO license_numbers(public_id) VALUES(?)",(ident,)).lastrowid
    audit(c,actor,"invite",email or "Без привязки",{"invitation":{"from":None,"to":token[:12]+"…"},"expiry":{"from":None,"to":hours or "Бессрочно"}})
    return {"invite":token,"id":ident,"license_number":f"{number:06d}","access_plan":plan,"mail_queued":plan=="trial"}
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

# The mail configuration is provisioned on the server, outside Git.
SUPPORT="https://t.me/zabvenye_com"
RESET_MAIL_SLOT=threading.BoundedSemaphore(2)
MAIL_TEXT={
 "ru":("Добро пожаловать в ZABVENYE!","Здравствуйте!","Регистрация завершена. Ваш аккаунт создан. Добро пожаловать в рабочее пространство ZABVENYE.","Войти в аккаунт","Поддержка в Telegram","Восстановление пароля ZABVENYE","Чтобы установить новый пароль, откройте ссылку ниже. Она действует 30 минут и только один раз.","Если вы не запрашивали восстановление, проигнорируйте письмо."),
 "en":("Welcome to ZABVENYE!","Hello!","Registration is complete. Your account has been created. Welcome to the ZABVENYE workspace.","Sign in","Telegram support","Reset your ZABVENYE password","Open the link below to set a new password. It is valid for 30 minutes and can be used only once.","If you did not request a password reset, ignore this email."),
 "fr":("Bienvenue sur ZABVENYE !","Bonjour !","Votre inscription est terminée. Votre compte a été créé. Bienvenue dans votre espace de travail ZABVENYE.","Se connecter","Assistance sur Telegram","Réinitialisation de votre mot de passe ZABVENYE","Ouvrez le lien ci-dessous pour définir un nouveau mot de passe. Il est valable 30 minutes et utilisable une seule fois.","Si vous n’avez pas demandé cette réinitialisation, ignorez ce message."),
 "de":("Willkommen bei ZABVENYE!","Hallo!","Ihre Registrierung ist abgeschlossen. Ihr Konto wurde erstellt. Willkommen in Ihrem ZABVENYE-Arbeitsbereich.","Anmelden","Support auf Telegram","ZABVENYE-Passwort zurücksetzen","Öffnen Sie den folgenden Link, um ein neues Passwort festzulegen. Er ist 30 Minuten gültig und nur einmal verwendbar.","Falls Sie keine Zurücksetzung angefordert haben, ignorieren Sie diese E-Mail."),
 "it":("Benvenuto su ZABVENYE!","Ciao!","La registrazione è completata. Il tuo account è stato creato. Ti diamo il benvenuto nel tuo spazio di lavoro ZABVENYE.","Accedi","Assistenza su Telegram","Reimposta la password di ZABVENYE","Apri il link qui sotto per impostare una nuova password. È valido per 30 minuti e può essere utilizzato una sola volta.","Se non hai richiesto il ripristino della password, ignora questa email.")
}
def mail_config():
    cfg={}
    try:
        cfg=json.loads((DATA/"mail.json").read_text())
        if not isinstance(cfg,dict): return None
    except FileNotFoundError: pass
    except (OSError,ValueError): return None
    values={k:os.getenv("ACCOUNT_SMTP_"+k.upper(),cfg.get(k,"")) for k in ("host","port","user","password","sender","security")}
    if not all(values[k] for k in ("host","user","password","sender")) or not valid_email(values["sender"]): return None
    try:
        values["port"]=int(values["port"] or 465)
        if not 1<=values["port"]<=65535: return None
    except (TypeError,ValueError): return None
    values["security"]=values["security"] or "ssl"
    return values if values["security"] in ("ssl","starttls") else None
def send_mail(recipient,subject,body):
    cfg=mail_config()
    if not cfg: raise RuntimeError("Mail not configured")
    message=EmailMessage()
    message["From"]="ZABVENYE <"+cfg["sender"]+">"
    message["To"]=recipient
    message["Subject"]=subject
    message.set_content(body)
    context=ssl.create_default_context()
    if cfg["security"]=="ssl":
        with smtplib.SMTP_SSL(cfg["host"],cfg["port"],timeout=12,context=context) as smtp:
            smtp.login(cfg["user"],cfg["password"]);smtp.send_message(message)
    else:
        with smtplib.SMTP(cfg["host"],cfg["port"],timeout=12) as smtp:
            smtp.ehlo();smtp.starttls(context=context);smtp.ehlo()
            smtp.login(cfg["user"],cfg["password"]);smtp.send_message(message)
def send_reset_request(email):
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        u=c.execute("SELECT id,email,ui_language FROM users WHERE email=? AND enabled=1 AND deleted=0",(email,)).fetchone()
        if not u: return False
        token=secrets.token_urlsafe(32); hashed=digest(token)
        now=int(time.time())
        c.execute("DELETE FROM password_resets WHERE expires<=?",(now,))
        c.execute("INSERT INTO password_resets VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token,expires=excluded.expires",(hashed,u["id"],now+1800))
    lang=u["ui_language"] if u["ui_language"] in LANGUAGES else "ru"
    t=MAIL_TEXT[lang]
    link=ORIGIN+"/account#reset="+token+"&lang="+lang
    try: send_mail(u["email"],t[5],"\n\n".join((t[1],t[6],link,t[7],t[4]+": "+SUPPORT)))
    except Exception:
        with db() as c: c.execute("DELETE FROM password_resets WHERE token=?",(hashed,))
        raise
    return True
def send_next_welcome():
    now=int(time.time())
    with db() as c:
        row=c.execute("SELECT w.*,u.email FROM welcome_mail w JOIN users u ON u.id=w.user_id WHERE w.sent_at IS NULL AND w.next_try<=? AND u.enabled=1 AND u.deleted=0 AND u.onboarding_required=0 ORDER BY w.next_try LIMIT 1",(now,)).fetchone()
    if not row:return
    t=MAIL_TEXT.get(row["language"],MAIL_TEXT["ru"])
    try:
        send_mail(row["email"],t[0],"\n\n".join((t[1],t[2],t[3]+": "+ORIGIN+"/account",t[4]+": "+SUPPORT)))
    except Exception:
        with db() as c:c.execute("UPDATE welcome_mail SET attempts=attempts+1,next_try=? WHERE user_id=?",(now+min(86400,60*2**min(10,row["attempts"])),row["user_id"]))
        return
    with db() as c:c.execute("UPDATE welcome_mail SET sent_at=? WHERE user_id=?",(int(time.time()),row["user_id"]))
def send_next_invite():
    now=int(time.time())
    with db() as c:
        row=c.execute("SELECT i.*,m.attempts FROM invite_mail m JOIN invites i ON i.public_id=m.public_id WHERE m.sent_at IS NULL AND m.next_try<=? AND i.used_at IS NULL AND i.revoked_at IS NULL AND (i.expires=0 OR i.expires>?) ORDER BY m.next_try LIMIT 1",(now,now)).fetchone()
    if not row:return
    code=recover_invite_code(row)
    if not code:return
    try:
        send_mail(row["email"],"ZABVENYE — лицензия FREE","Ваш лицензионный код: "+code+"\n\nАктивируйте код при регистрации: "+ORIGIN+"/account#register\n\nFREE действует один календарный месяц с момента активации: 5 клиентов, по 4 сессии, 1 запрос и 1 ситуация на клиента, 10 AI-запросов за период.\n\nПоддержка: https://t.me/Evgeniy_Prudnikov")
    except Exception:
        with db() as c:c.execute("UPDATE invite_mail SET attempts=attempts+1,next_try=? WHERE public_id=?",(now+min(86400,60*2**min(10,row["attempts"])),row["public_id"]))
        return
    with db() as c:c.execute("UPDATE invite_mail SET sent_at=? WHERE public_id=?",(int(time.time()),row["public_id"]))
SUBSCRIPTION_MAIL={
"ru":("ZABVENYE — окончание подписки","Ваша подписка STANDARD скоро заканчивается. Доступ действует до","Для продления:"),
"en":("ZABVENYE — subscription expiry","Your STANDARD subscription will expire soon. Access ends on","To renew:"),
"fr":("ZABVENYE — expiration de l’abonnement","Votre abonnement STANDARD expire bientôt. Accès jusqu’au","Pour renouveler :"),
"de":("ZABVENYE — Abonnement läuft ab","Ihr STANDARD-Abonnement läuft bald ab. Zugriff bis","Verlängern:"),
"it":("ZABVENYE — scadenza abbonamento","L’abbonamento STANDARD scade a breve. Accesso fino al","Per rinnovare:")}
def send_next_subscription_reminder():
    now=int(time.time())
    with db() as c:
        rows=c.execute("SELECT id,email,ui_language,subscription_expires FROM users WHERE access_plan='standard' AND enabled=1 AND deleted=0 AND subscription_expires>? AND subscription_expires<=? ORDER BY subscription_expires LIMIT 200",(now,now+7*86400)).fetchall()
        selected=None
        for row in rows:
            end=row["subscription_expires"]
            days=1 if end-now<=86400 else 7
            record=c.execute("SELECT sent_at,next_try FROM subscription_reminders WHERE user_id=? AND end_at=? AND days=?",(row["id"],end,days)).fetchone()
            if record and (record["sent_at"] or record["next_try"]>now):continue
            c.execute("INSERT INTO subscription_reminders(user_id,end_at,days,next_try) VALUES(?,?,?,?) ON CONFLICT(user_id,end_at,days) DO UPDATE SET next_try=excluded.next_try",(row["id"],end,days,now+3600))
            selected=(row,end,days);break
    if not selected:return
    row,end,days=selected
    subject,body,renew=SUBSCRIPTION_MAIL.get(row["ui_language"],SUBSCRIPTION_MAIL["ru"])
    try:send_mail(row["email"],subject,body+" "+datetime.fromtimestamp(end,timezone.utc).strftime("%d.%m.%Y %H:%M UTC")+".\n\n"+renew+" "+ORIGIN+"/account/license\nhttps://t.me/Evgeniy_Prudnikov")
    except Exception:return
    with db() as c:c.execute("UPDATE subscription_reminders SET sent_at=? WHERE user_id=? AND end_at=? AND days=?",(int(time.time()),row["id"],end,days))
def send_next_notification():
    now=int(time.time())
    with db() as c:
        row=c.execute("""SELECT n.*,u.email,u.ui_language FROM account_notifications n JOIN users u ON u.id=n.user_id
            WHERE n.email_requested=1 AND n.sent_at IS NULL AND n.next_try<=? AND u.deleted=0 AND u.onboarding_required=0
            ORDER BY n.created,n.id LIMIT 1""",(now,)).fetchone()
    if not row:return
    title,body=notification_text(row,row["ui_language"])
    try:send_mail(row["email"],"ZABVENYE — "+title,body+"\n\n"+ORIGIN+"/account#notifications\n"+ORIGIN+"/")
    except Exception:
        with db() as c:c.execute("UPDATE account_notifications SET attempts=attempts+1,next_try=? WHERE id=?",(now+min(86400,60*2**min(10,row["attempts"])),row["id"]))
        return
    with db() as c:c.execute("UPDATE account_notifications SET sent_at=? WHERE id=?",(int(time.time()),row["id"]))
def mail_worker():
    while True:
        try:
            if mail_config():
                send_next_welcome();send_next_invite();send_next_subscription_reminder();send_next_notification()
        except Exception:pass
        time.sleep(5)

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
    def body(self,limit=8192):
        if self.headers.get("Origin")!=ORIGIN: raise Error(403,"Недопустимый источник запроса")
        if not self.headers.get("Content-Type","").startswith("application/json"): raise Error(415,"Требуется JSON")
        try:
            n=int(self.headers.get("Content-Length","0"))
            if not 0<n<=limit: raise ValueError()
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
        require_access(u)
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
            if path=="/account/license":
                q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                return self.reply(200,license_page(q.get("lang",["ru"])[0]),ctype="text/html")
            if path in ("/account","/account/ui.js","/account/ui.css"):
                file={" /account":"index.html"}.get(" "+path, path.rsplit("/",1)[-1])
                typ={"index.html":"text/html","ui.js":"application/javascript","ui.css":"text/css"}[file]
                return self.reply(200,(Path(__file__).parent/file).read_bytes(),ctype=typ)
            if path=="/account/api/config": return self.reply(200,{"sitekey":SITE if SECRET else "","password_reset":bool(mail_config())})
            # Traefik/nginx forward an opaque session cookie; no public data is returned.
            if path=="/account/api/workspace-auth":
                with db() as c:
                    u=c.execute("SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.enabled=1 AND u.deleted=0 AND u.onboarding_required=0 AND (u.access_plan!='trial' OR u.trial_expires>?) AND (u.access_plan!='standard' OR u.subscription_expires>?)",(digest(self.token()),int(time.time()),int(time.time()),int(time.time()))).fetchone()
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
                if path=="/account/api/workspace-profile":
                    if u["onboarding_required"]: raise Error(403,"Сначала завершите первичную настройку")
                    return self.reply(200,workspace_payload(c,u))
                q=urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
                def param(k): return q.get(k,[""])[0][:254]
                try: offset=max(0,min(1000000,int(param("offset") or "0")))
                except ValueError: raise Error(400,"Некорректная страница")
                if path=="/account/api/notifications":
                    rows=c.execute("SELECT * FROM account_notifications WHERE user_id=? ORDER BY created DESC,id DESC LIMIT 50 OFFSET ?",(u["id"],offset)).fetchall()
                    total=c.execute("SELECT count(*) FROM account_notifications WHERE user_id=?",(u["id"],)).fetchone()[0]
                    return self.reply(200,{"items":[notification_public(row,u["ui_language"]) for row in rows],"total":total,"unread":notification_count(c,u["id"])})
                if path=="/account/api/admin/statistics":
                    raw=param("days") or "1"
                    if raw not in ("1","7","30"): raise Error(400,"Некорректный период")
                    return self.reply(200,admin_statistics(c,int(raw)))
                if path=="/account/api/admin/subscriptions":
                    now=int(time.time())
                    month=int(datetime.now(timezone.utc).replace(day=1,hour=0,minute=0,second=0,microsecond=0).timestamp())
                    rows=c.execute("SELECT * FROM users WHERE role='specialist' AND deleted=0 ORDER BY created DESC").fetchall()
                    counts={"paid_active":0,"expiring":0,"expired":0,"vip":0,"free":0,"legacy":0}
                    for row in rows:
                        summary=billing_summary(c,row)
                        if summary["plan"]=="VIP":counts["vip"]+=1
                        elif summary["status"]=="legacy":counts["legacy"]+=1
                        elif summary["plan"]=="FREE":counts["free"]+=1
                        elif summary["status"]=="active":
                            counts["paid_active"]+=1
                            if summary["expires"]<=now+7*86400:counts["expiring"]+=1
                        elif summary["status"]=="expired":counts["expired"]+=1
                    income=c.execute("SELECT coalesce(sum(amount),0) FROM subscription_payments WHERE paid_at>=?",(month,)).fetchone()[0]
                    pending=c.execute("SELECT i.public_id,i.email,i.expires,i.revoked_at,p.amount,p.period,p.paid_at,n.number FROM subscription_payments p JOIN invites i ON i.public_id=p.invite_id JOIN license_numbers n ON n.public_id=i.public_id WHERE p.user_id IS NULL ORDER BY p.recorded_at DESC LIMIT 100").fetchall()
                    return self.reply(200,{"counts":counts,"income":income,"total":len(rows),"items":[public(c,row) for row in rows[offset:offset+50]],"pending":[dict(row) for row in pending]})
                if path=="/account/api/admin/subscription-history":
                    target=c.execute("SELECT u.id FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist'",(param("id"),)).fetchone()
                    if not target:raise Error(404,"Специалист не найден")
                    rows=c.execute("SELECT period,amount,paid_at,recorded_at,start_at,end_at FROM subscription_payments WHERE user_id=? ORDER BY recorded_at DESC,rowid DESC LIMIT 100 OFFSET ?",(target["id"],offset)).fetchall()
                    return self.reply(200,{"items":[dict(row) for row in rows]})
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
                # License records are retained until explicit archival.
                if path=="/account/api/admin/invite-detail":
                    ident=param("id")
                    row=c.execute("SELECT * FROM invites WHERE public_id=?",(ident,)).fetchone()
                    if not row: raise Error(404,"Приглашение не найдено")
                    detail=invite_public(c,row,int(time.time()))
                    detail["code"]=recover_invite_code(row)
                    detail["legacy_license_id"]=row["public_id"]
                    detail["specialist"]=None
                    if row["used_by"]:
                        owner=c.execute("SELECT * FROM users WHERE id=?",(row["used_by"],)).fetchone()
                        if owner: detail["specialist"]=public(c,owner)
                    detail["created_by"]=snapshot(c,row["created_by"]) if row["created_by"] else None
                    return self.reply(200,detail)
                if path=="/account/api/admin/invites":
                    now=int(time.time()); state=param("status")
                    registry="""WITH registry AS (SELECT i.*, n.number AS license_no,
                        casefold(COALESCE(NULLIF(i.comment,''),NULLIF(i.email,''),'')) AS recipient_sort,
                        casefold(trim(COALESCE(u.first_name,'')||' '||COALESCE(u.last_name,''))) AS owner_sort,
                        """+INVITE_REGISTRY_STATUS+""" AS display_status
                        FROM invites i LEFT JOIN users u ON u.id=i.used_by
                        LEFT JOIN license_numbers n ON n.public_id=i.public_id) """
                    where="1=1"; args=[now,now]
                    if state in ("active","used","awaiting_payment","expired","revoked","blocked","archived"):
                        where+=" AND display_status=?"; args.append(state)
                    qtext=param("q")
                    if qtext:
                        where+=" AND (instr(casefold(email),casefold(?))>0 OR instr(casefold(comment),casefold(?))>0 OR instr(casefold(preview),casefold(?))>0 OR instr(printf('%06d',license_no),?)>0 OR instr(public_id,?)>0 OR instr(owner_sort,casefold(?))>0)"
                        args.extend([qtext]*6)
                    field={"number":"license_no","recipient":"recipient_sort","created":"created","expires":"CASE WHEN expires=0 THEN 9223372036854775807 ELSE expires END","status":"CASE display_status WHEN 'active' THEN 1 WHEN 'used' THEN 2 WHEN 'awaiting_payment' THEN 3 WHEN 'expired' THEN 4 WHEN 'blocked' THEN 5 WHEN 'revoked' THEN 6 ELSE 7 END","owner":"owner_sort"}.get(param("sort"),"license_no")
                    direction="ASC" if param("dir")=="asc" else "DESC"
                    total=c.execute(registry+"SELECT count(*) FROM registry WHERE "+where,args).fetchone()[0]
                    rows=c.execute(registry+"SELECT * FROM registry WHERE "+where+" ORDER BY "+field+" "+direction+", license_no DESC LIMIT 50 OFFSET ?",args+[offset]).fetchall()
                    return self.reply(200,{"items":[invite_public(c,row,now) for row in rows],"total":total})
                if path=="/account/api/admin/audit":
                    return self.reply(200,{"items":audit_rows(c,offset),"total":c.execute("SELECT count(*) FROM audit").fetchone()[0]})
            raise Error(404,"Не найдено")
        if path.startswith("/account/api/ai/"): return self.ai_proxy(path.rsplit("/",1)[-1])
        b=self.body(120000 if path=="/account/api/workspace-profile" else 8192)
        if path=="/account/api/password-reset-request":
            e=b.get("email")
            if not valid_email(e): raise Error(400,"Введите корректный email.")
            e=e.strip().lower()
            if not mail_config(): raise Error(503,"Отправка писем пока недоступна. Обратитесь в поддержку.")
            if not allowed("reset-global",30,60) or not allowed("reset-email:"+digest(e),3,1800): raise Error(429,"Слишком много попыток. Повторите позже.")
            if not captcha(b.get("captcha")): raise Error(403,"Пройдите проверку безопасности.")
            if not RESET_MAIL_SLOT.acquire(False):raise Error(429,"Сервис занят. Повторите попытку.")
            try:
                try: sent=send_reset_request(e)
                except Exception:raise Error(503,"Не удалось отправить письмо. Повторите попытку позже.")
            finally:RESET_MAIL_SLOT.release()
            if not sent:raise Error(404,"Активный аккаунт с такой почтой не найден.")
            return self.reply(200,{"ok":True,"sent":True})
        if path=="/account/api/password-reset-confirm":
            token=b.get("token");p=b.get("password")
            if not isinstance(token,str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}",token): raise Error(400,"Ссылка недействительна или устарела.")
            if not valid_password(p): raise Error(400,"Пароль должен содержать от 12 до 128 символов.")
            if p!=b.get("password_repeat"):raise Error(400,"Пароли не совпадают")
            if not allowed("reset-confirm-global",30,60):raise Error(429,"Слишком много попыток. Повторите позже.")
            if not HASH_SLOT.acquire(False):raise Error(429,"Сервис занят. Повторите попытку.")
            try:
                with db() as c:
                    c.execute("BEGIN IMMEDIATE")
                    row=c.execute("SELECT r.user_id FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token=? AND r.expires>? AND u.enabled=1 AND u.deleted=0",(digest(token),int(time.time()))).fetchone()
                    if not row:raise Error(400,"Ссылка недействительна или устарела.")
                    uid=row["user_id"]
                    c.execute("UPDATE users SET password=? WHERE id=?",(password_hash(p),uid))
                    c.execute("DELETE FROM password_resets WHERE user_id=?",(uid,))
                    c.execute("DELETE FROM sessions WHERE user_id=?",(uid,))
                    audit(c,uid,"password-reset",uid)
            finally:HASH_SLOT.release()
            return self.reply(200,{"ok":True},"__Host-zabvenye_account=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0")
        if path in ("/account/api/login","/account/api/register"):
            e=b.get("email"); p=b.get("password")
            if not valid_email(e): raise Error(400,"Введите корректный email.")
            if not valid_password(p): raise Error(400,"Пароль должен содержать от 12 до 128 символов.")
            if path.endswith("/register") and b.get("password_repeat")!=p: raise Error(400,"Пароли не совпадают")
            e=e.strip().lower()
            # Global cap plus per-account cap; do not trust caller-provided forwarding headers.
            if not allowed("global-login",40,60) or not allowed("account:"+digest(e),8,900): raise Error(429,"Слишком много попыток. Повторите позже.")
            if not captcha(b.get("captcha")): raise Error(403,"Проверка безопасности не подтверждена сервером. Пройдите её ещё раз и нажмите кнопку продолжения.")
            if not HASH_SLOT.acquire(False): raise Error(429,"Сервис занят. Повторите попытку.")
            try:
                with db() as c:
                    if path.endswith("/register"):
                        tok=b.get("invite","")
                        if not isinstance(tok,str) or not 1<=len(tok.strip())<=128: raise Error(400,"Недействительный код лицензии")
                        c.execute("BEGIN IMMEDIATE")
                        inv=c.execute("SELECT * FROM invites WHERE token=?",(digest(tok.strip()),)).fetchone()
                        if not inv: raise Error(400,"Код лицензии не найден. Проверьте его целиком.")
                        if inv["email"] and inv["email"]!=e: raise Error(400,"Код лицензии выдан для другой электронной почты.")
                        if inv["used_at"] is not None:
                            owner=c.execute("SELECT email FROM users WHERE id=?",(inv["used_by"],)).fetchone()
                            if owner and owner["email"]==e: raise Error(409,"Этот код уже активирован. Войдите в аккаунт с указанным email и паролем, чтобы продолжить.")
                            raise Error(409,"Код лицензии уже использован. Обратитесь к администратору.")
                        if inv["revoked_at"] is not None: raise Error(409,"Код лицензии отозван. Обратитесь к администратору.")
                        if inv["expires"] and inv["expires"]<=int(time.time()): raise Error(409,"Срок активации лицензии истёк. Запросите новый код у администратора.")
                        if c.execute("SELECT 1 FROM users WHERE email=?",(e,)).fetchone(): raise Error(409,"Аккаунт с этой почтой уже существует. Войдите в него или обратитесь к администратору.")
                        uid=create_user(c,e,p,"specialist")
                        activation=int(time.time())
                        activate_plan(c,uid,inv["access_plan"],activation,inv)
                        c.execute("UPDATE users SET onboarding_required=1,last_seen=? WHERE id=?",(activation,uid))
                        c.execute("UPDATE invites SET used_at=?,used_by=? WHERE token=?",(activation,uid,inv["token"])); audit(c,uid,"registered",uid,{"invitation":{"from":None,"to":inv["preview"]}})
                        u=c.execute("SELECT * FROM users WHERE id=?",(uid,)).fetchone()
                    else:
                        u=c.execute("SELECT * FROM users WHERE email=?",(e,)).fetchone()
                        ok=password_ok(p,u["password"] if u else DUMMY)
                        if not ok or not u or not u["enabled"] or u["deleted"]: raise Error(401,"Неверные данные или аккаунт недоступен")
                        require_access(u)
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
            if path=="/account/api/notifications/read":
                ident=b.get("id")
                if ident=="all":
                    c.execute("UPDATE account_notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?",(int(time.time()),u["id"]))
                elif isinstance(ident,str) and 1<=len(ident)<=64:
                    if not c.execute("SELECT 1 FROM account_notifications WHERE id=? AND user_id=?",(ident,u["id"])).fetchone():raise Error(404,"Уведомление не найдено")
                    c.execute("UPDATE account_notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?",(int(time.time()),ident,u["id"]))
                else:raise Error(400,"Некорректное уведомление")
                payload={"ok":True,"unread":notification_count(c,u["id"])}
            elif path=="/account/api/notifications/claim-vip":
                row=c.execute("SELECT * FROM account_notifications WHERE user_id=? AND kind='vip' AND popup_at IS NULL AND read_at IS NULL ORDER BY created DESC,id DESC LIMIT 1",(u["id"],)).fetchone() if u["access_plan"]=="vip" and not u["onboarding_required"] else None
                if row:
                    c.execute("UPDATE account_notifications SET popup_at=? WHERE id=?",(int(time.time()),row["id"]))
                payload={"item":notification_public(row,u["ui_language"]) if row else None}
            elif path=="/account/api/admin/notify":
                target=c.execute("SELECT u.id FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=0",(b.get("id"),)).fetchone()
                if not target:raise Error(404,"Специалист не найден")
                title,body,email=b.get("title"),b.get("body"),b.get("email",True)
                if not isinstance(title,str) or not 1<=len(title.strip())<=120 or any(ord(ch)<32 or ord(ch)==127 for ch in title) or not isinstance(body,str) or not 1<=len(body.strip())<=1500 or type(email) is not bool:raise Error(400,"Укажите тему и текст уведомления")
                request_id=b.get("request_id")
                if not isinstance(request_id,str) or not re.fullmatch(r"[a-f0-9-]{36}",request_id):raise Error(400,"Некорректный идентификатор уведомления")
                prior=c.execute("SELECT * FROM account_notifications WHERE id=?",(request_id,)).fetchone()
                if prior:
                    if prior["user_id"]!=target["id"] or prior["kind"]!="admin" or prior["title"]!=title.strip() or prior["body"]!=body.strip() or prior["email_requested"]!=int(email):raise Error(409,"Идентификатор уже занят")
                else:
                    queue_notification(c,target["id"],"admin",int(time.time()),ident=request_id,title=title.strip(),body=body.strip(),email=email)
                    audit(c,u["id"],"admin-notification",target["id"])
                payload={"ok":True}
            elif path=="/account/api/onboarding":
                first=b.get("first_name",""); last=b.get("last_name",""); birth=b.get("birth_date","")
                if not all(isinstance(v,str) for v in (first,last,birth)) or not 1<=len(first.strip())<=80 or not 1<=len(last.strip())<=80: raise Error(400,"Укажите имя и фамилию")
                try:
                    born=date.fromisoformat(birth)
                    if born.isoformat()!=birth or born.year<1900 or born>datetime.now(timezone.utc).date()+timedelta(days=1): raise ValueError()
                except ValueError: raise Error(400,"Проверьте дату рождения")
                if not u["onboarding_required"]: raise Error(409,"Первичная настройка уже завершена")
                if b.get("legal_version")!=LEGAL_VERSION or b.get("license_accepted") is not True or b.get("privacy_read") is not True: raise Error(400,"Ознакомьтесь с документами и подтвердите принятие актуальной редакции")
                today=datetime.now(timezone.utc).date()
                if today.year-born.year-((today.month,today.day)<(born.month,born.day))<18: raise Error(400,"Регистрация доступна с 18 лет")
                language=b.get("language","ru")
                if language not in LANGUAGES: raise Error(400,"Недопустимый язык")
                c.execute("INSERT INTO legal_acceptance(user_id,version,accepted_at,language) VALUES(?,?,?,?)",(u["id"],LEGAL_VERSION,int(time.time()),language))
                c.execute("UPDATE users SET ui_language=? WHERE id=?",(language,u["id"]))
                audit(c,u["id"],"legal-acceptance",u["id"],{"version":{"from":None,"to":LEGAL_VERSION}})
                c.execute("UPDATE users SET first_name=?,last_name=?,birth_date=?,onboarding_required=0 WHERE id=?",(first.strip(),last.strip(),birth,u["id"]))
                audit(c,u["id"],"onboarding",u["id"])
                c.execute("INSERT OR IGNORE INTO welcome_mail(user_id,language) VALUES(?,?)",(u["id"],language))
                payload={"ok":True}
            elif path=="/account/api/language":
                language=b.get("language")
                if language not in LANGUAGES: raise Error(400,"Недопустимый язык")
                c.execute("UPDATE users SET ui_language=? WHERE id=?",(language,u["id"]))
                payload={"ok":True,"language":language}
            elif path=="/account/api/vault-recovery":
                if u["onboarding_required"]: raise Error(403,"Сначала завершите настройку профиля")
                number=b.get("license"); password=b.get("password"); mode=b.get("mode")
                if mode not in ("enroll","recover") or not isinstance(number,str) or not re.fullmatch(r"[0-9]{6,12}",number) or not valid_password(password): raise Error(400,"Введите номер лицензии и пароль аккаунта")
                if not allowed("vault-recovery-global",20,60) or not allowed("vault-recovery:"+u["id"],5,900): raise Error(429,"Слишком много попыток. Повторите позже.")
                if not HASH_SLOT.acquire(False): raise Error(429,"Сервис занят. Повторите попытку.")
                try: ok=password_ok(password,u["password"])
                finally: HASH_SLOT.release()
                license_row=c.execute("SELECT 1 FROM invites i JOIN license_numbers n ON n.public_id=i.public_id WHERE n.number=? AND i.used_by=? AND i.used_at IS NOT NULL AND i.revoked_at IS NULL",(int(number),u["id"])).fetchone()
                if not ok or not license_row: raise Error(403,"Номер лицензии или пароль не подтверждён")
                row=c.execute("SELECT secret FROM vault_recovery WHERE user_id=?",(u["id"],)).fetchone()
                if not row:
                    if mode!="enroll": raise Error(409,"Восстановление для этой лицензии ещё не подключено")
                    recovery=vault_recovery_secret(c,u["id"])
                    c.execute("INSERT INTO vault_recovery VALUES(?,?,?)",(u["id"],"derived-v1",int(time.time())))
                else: recovery=vault_recovery_secret(c,u["id"]) if row["secret"]=="derived-v1" else row["secret"]
                audit(c,u["id"],"vault-recovery-"+mode,u["id"])
                payload={"recovery_secret":recovery}
            elif path=="/account/api/trial-reserve":
                if u["onboarding_required"] or set(b)!={"feature","client"} or b.get("feature") not in ("clients","sessions","requests","situations"):raise Error(400,"Некорректный запрос")
                reserve_trial(c,u,b["feature"],b["client"])
                payload={"ok":True,"trial":trial_usage(c,u)}
            elif path=="/account/api/analytics-preference":
                enabled=b.get("enabled")
                if set(b)!={"enabled"} or type(enabled) is not bool or u["onboarding_required"]:raise Error(400,"Некорректная настройка статистики")
                c.execute("INSERT INTO analytics_preferences VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,changed_at=excluded.changed_at",(u["id"],int(enabled),int(time.time())))
                if not enabled:
                    for table in ("analytics_snapshots","analytics_daily","analytics_batches"):c.execute("DELETE FROM "+table+" WHERE user_id=?",(u["id"],))
                payload={"enabled":enabled}
            elif path=="/account/api/metrics":
                count=b.get("clients")
                if type(count) is not int or not 0<=count<=1000000: raise Error(400,"Некорректное количество клиентов")
                now=int(time.time())
                c.execute("INSERT INTO specialist_metrics VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET client_count=excluded.client_count,reported_at=excluded.reported_at",(u["id"],count,now))
                c.execute("INSERT OR IGNORE INTO specialist_days VALUES(?,?)",(u["id"],datetime.now(timezone.utc).date().isoformat()))
                if "advanced" in b:save_analytics(c,u["id"],b["advanced"],now)
                payload={"ok":True}
            elif path=="/account/api/workspace-profile":
                if u["onboarding_required"]: raise Error(403,"Сначала завершите первичную настройку")
                if set(b)!={"account_id","revision","profile"} or b.get("account_id")!=ids(c,u["id"]).get("specialist"): raise Error(403,"Карточка другого аккаунта")
                if not allowed("workspace-profile:"+u["id"],30,60): raise Error(429,"Слишком много обновлений")
                previous=workspace_payload(c,u)
                if type(b.get("revision")) is not int or b["revision"]!=previous["revision"]: raise Error(409,"Карточка обновлена на другом устройстве")
                value=workspace_profile(b["profile"])
                revision=previous["revision"]+1
                c.execute("INSERT INTO workspace_profiles VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,profile=excluded.profile,updated_at=excluded.updated_at",(u["id"],revision,json.dumps(value,ensure_ascii=False,separators=(",",":")),int(time.time())))
                payload=workspace_payload(c,u)
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
                c.execute("UPDATE users SET deleted=1,archived_enabled=enabled,archived_at=?,enabled=0 WHERE id=?",(int(time.time()),target["id"]))
                c.execute("DELETE FROM sessions WHERE user_id=?",(target["id"],))
                audit(c,u["id"],"delete",target["id"],{"deleted":{"from":False,"to":True}})
                payload={"ok":True}
            elif path=="/account/api/admin/restore":
                target=c.execute("SELECT u.* FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=1",(b.get("id"),)).fetchone()
                if not target: raise Error(404,"Архивированный специалист не найден")
                enabled=int(bool(target["archived_enabled"]))
                c.execute("UPDATE users SET deleted=0,enabled=?,archived_at=NULL,archived_enabled=NULL WHERE id=?",(enabled,target["id"]))
                audit(c,u["id"],"restore",target["id"],{"deleted":{"from":True,"to":False},"enabled":{"from":False,"to":bool(enabled)}})
                payload={"ok":True,"enabled":bool(enabled)}
            elif path=="/account/api/admin/purge":
                target=c.execute("SELECT u.* FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=1",(b.get("id"),)).fetchone()
                if not target: raise Error(404,"Архивированный специалист не найден")
                if not target["archived_at"] or int(time.time())<target["archived_at"]+86400: raise Error(409,"Окончательное удаление доступно через 24 часа после архивации")
                if b.get("confirm_id")!=b.get("id"): raise Error(400,"Введите точный ID специалиста")
                password=b.get("password")
                if not allowed("purge:"+u["id"],5,900): raise Error(429,"Слишком много попыток. Повторите позже.")
                if not valid_password(password) or not password_ok(password,u["password"]): raise Error(403,"Неверный пароль администратора")
                uid=target["id"]
                audit(c,u["id"],"purge",uid,{"account":{"from":"Архивирован","to":"Удалён окончательно"}})
                c.execute("INSERT INTO specialist_tombstones VALUES(?,?,?)",(uid,b["id"],int(time.time())))
                for table in ("sessions","ai_usage","specialist_metrics","specialist_days","analytics_preferences","analytics_snapshots","analytics_daily","analytics_batches","subscription_reminders","trial_usage","trial_clients","legal_acceptance","workspace_profiles","vault_recovery","password_resets","welcome_mail","account_notifications"):
                    c.execute("DELETE FROM "+table+" WHERE user_id=?",(uid,))
                c.execute("DELETE FROM users WHERE id=?",(uid,))
                payload={"ok":True}
            elif path=="/account/api/admin/invite":
                e=b.get("email","")
                if not isinstance(e,str): raise Error(400,"Некорректный email")
                e=e.strip().lower()
                if e and not valid_email(e): raise Error(400,"Некорректный email")
                payload=create_invite(c,u["id"],e,b.get("hours",24),b.get("comment",""),b.get("access_plan","standard"),b.get("period"),b.get("paid_at"))
            elif path=="/account/api/admin/invite-delete":
                ident=b.get("id")
                if not isinstance(ident,str): raise Error(400,"Некорректное приглашение")
                inv=c.execute("SELECT * FROM invites WHERE public_id=?",(ident,)).fetchone()
                if not inv: raise Error(404,"Приглашение не найдено")
                if inv["access_plan"]=="standard":raise Error(409,"Оплаченный код сохраняется для истории оплаты")
                if invite_status(inv,int(time.time())) not in ("revoked","expired"): raise Error(409,"Удалять можно только отозванные или истёкшие приглашения")
                audit(c,u["id"],"invite-delete",ident,{"invitation":{"from":inv["preview"],"to":"Удалено"}})
                c.execute("INSERT INTO license_archive VALUES(?,?,?)",(ident,inv["token"],int(time.time())))
                c.execute("DELETE FROM invites WHERE public_id=?",(ident,))
                payload={"ok":True}
            elif path=="/account/api/admin/invite-comment":
                ident=b.get("id"); comment=b.get("comment")
                if not isinstance(ident,str) or not isinstance(comment,str) or len(comment)>250: raise Error(400,"Некорректный комментарий")
                inv=c.execute("SELECT * FROM invites WHERE public_id=?",(ident,)).fetchone()
                if not inv: raise Error(404,"Приглашение не найдено")
                c.execute("UPDATE invites SET comment=? WHERE public_id=?",(comment.strip(),ident))
                audit(c,u["id"],"invite-comment",ident,{"comment":{"from":inv["comment"],"to":comment.strip()}})
                payload={"ok":True}
            elif path in ("/account/api/admin/invite-revoke","/account/api/admin/invite-reissue"):
                ident=b.get("id")
                if not isinstance(ident,str) or not re.fullmatch(r"[a-f0-9]{24}|[a-f0-9]{32}",ident): raise Error(400,"Некорректное приглашение")
                inv=c.execute("SELECT * FROM invites WHERE public_id=?",(ident,)).fetchone()
                now=int(time.time())
                if not inv: raise Error(404,"Приглашение не найдено")
                if path.endswith("reissue"):
                    hours=b.get("hours")
                    if type(hours) is not int or hours not in (24,72,168,0): raise Error(400,"Некорректный срок")
                    if inv["used_at"] is not None or inv["used_by"] is not None: raise Error(409,"Активированную лицензию нельзя перевыпустить")
                    expiry=now+hours*3600 if hours else 0
                    old_status=invite_status(inv,now)
                    c.execute("UPDATE invites SET expires=?,revoked_at=NULL WHERE public_id=?",(expiry,ident))
                    updated=c.execute("SELECT * FROM invites WHERE public_id=?",(ident,)).fetchone()
                    payload=invite_public(c,updated,now)
                    payload["code"]=recover_invite_code(updated)
                    audit(c,u["id"],"invite-reissue",ident,{"license_number":{"from":payload["license_number"],"to":payload["license_number"]},"license_status":{"from":old_status,"to":"active"},"activation_deadline":{"from":inv["expires"],"to":expiry},"expiry":{"from":None,"to":hours or "Бессрочно"}})
                else:
                    if invite_status(inv,now)!="active": raise Error(409,"Приглашение больше не действует")
                    c.execute("UPDATE invites SET revoked_at=? WHERE public_id=?",(now,ident))
                    audit(c,u["id"],"invite-revoke",inv["email"] or "Без привязки",{"invitation":{"from":inv["preview"],"to":"Отозвано"}})
                    payload={"ok":True}
            elif path in ("/account/api/admin/subscription-payment","/account/api/admin/grant-vip"):
                target=c.execute("SELECT u.* FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=0",(b.get("id"),)).fetchone()
                if not target:raise Error(404,"Специалист не найден")
                if path.endswith("subscription-payment"):
                    payment_record(c,u["id"],target,b.get("period"),b.get("paid_at"),b.get("request_id"),int(time.time()))
                else:
                    if target["access_plan"]=="standard" and target["subscription_expires"] and target["subscription_expires"]>int(time.time()):raise Error(409,"Дождитесь окончания оплаченного периода перед выдачей VIP")
                    limits=json.loads(target["limits"]) if target["access_plan"]!="trial" else DEFAULT
                    c.execute("UPDATE users SET access_plan='vip',subscription_expires=NULL,subscription_period=NULL,trial_expires=NULL,limits=? WHERE id=?",(json.dumps(limits),target["id"]))
                    if target["access_plan"]!="vip":
                        queue_notification(c,target["id"],"vip",int(time.time()))
                        audit(c,u["id"],"grant-vip",target["id"],{"access_plan":{"from":target["access_plan"],"to":"vip"}})
                payload=public(c,c.execute("SELECT * FROM users WHERE id=?",(target["id"],)).fetchone())
            elif path=="/account/api/admin/update":
                uid=b.get("id"); limits=b.get("limits"); enabled=b.get("enabled")
                if not isinstance(uid,str) or type(enabled) is not bool or not isinstance(limits,dict) or set(limits)!=set(FEATURES): raise Error(400,"Некорректные параметры")
                for k,v in limits.items():
                    if k in ("clients","sessions","ai_daily") or k in tuple("ai_"+a for a in AI_AREAS)+MODULE_LIMITS:
                        if v is not None and (type(v) is not int or not 0<=v<=1000000): raise Error(400,"Некорректный лимит")
                    elif type(v) is not bool: raise Error(400,"Некорректный переключатель")
                target=c.execute("SELECT u.* FROM users u JOIN public_ids p ON p.owner=u.id WHERE p.number=? AND p.kind='specialist' AND u.role='specialist' AND u.deleted=0",(uid,)).fetchone()
                if not target: raise Error(404,"Специалист не найден")
                uid=target["id"]
                if target["access_plan"]=="trial":
                    for k,cap in (("clients",5),("sessions",trial_caps(target)["sessions_per_client"]),("ai_daily",trial_caps(target)["ai"])):limits[k]=min(cap,limits[k]) if limits[k] is not None else cap
                    limits["client_import"]=False;limits["requests_per_client"]=1
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
            reserve_trial(c,u,"ai")
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
    threading.Thread(target=mail_worker,daemon=True,name="account-mail").start()
    Server(("0.0.0.0",8080),Handler).serve_forever()
