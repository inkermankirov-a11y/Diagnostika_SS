'use strict';
(()=>{if(location.hostname!=='zabvenye.com')return;let profile=null,lastMetrics=0,reporting=false,languageWrites=0;window.addEventListener('diagnostika:language-changed',async e=>{const language=e.detail?.language;if(!['ru','en','fr','de','it'].includes(language))return;languageWrites++;try{const result=await fetch('/account/api/language',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({language})});if(!result.ok)throw Error('Language preference not saved');if(profile)profile.ui_language=language;}catch(error){console.warn(error)}finally{languageWrites--}});const analyticsFeatures={ 'client:created':'clients','client:updated':'clients','session:created':'sessions','session:updated':'sessions','diagnosis:updated':'diagnosis','payment:added':'payments','payment:updated':'payments','session-payment:updated':'payments','calendar:event-created':'calendar','calendar:event-updated':'calendar'};
let events={},pendingReport=null,eventsOwner=null,eventsBound=false;
const list=v=>Array.isArray(v)?v:[];
function track(feature){if(profile?.role!=='specialist'||!profile?.metrics?.analytics_enabled)return;if(eventsOwner!==profile.id){events={};pendingReport=null;eventsOwner=profile.id;}events[feature]=Math.min(10000,(events[feature]||0)+1)}
function bindEvents(){if(eventsBound)return;const bus=window.DiagnostikaPlatform?.events;if(!bus?.on)return;for(const [event,feature] of Object.entries(analyticsFeatures))bus.on(event,()=>track(feature));eventsBound=true;}
window.addEventListener('diagnostika-general-notes-changed',()=>track('notes'));
window.addEventListener('diagnostika:analytics-feature',e=>{if(['google_calendar','google_meet','zoom','teams','storage','export','attachments','questionnaires','consultations'].includes(e.detail?.feature))track(e.detail.feature)});
document.addEventListener('click',e=>{const link=e.target?.closest?.('a[href]');if(!link)return;try{const h=new URL(link.href).hostname;const feature=h==='meet.google.com'?'google_meet':h==='zoom.us'||h.endsWith('.zoom.us')?'zoom':h==='teams.microsoft.com'||h==='teams.live.com'?'teams':h==='calendar.google.com'?'google_calendar':null;if(feature)track(feature)}catch{}},true);
function snapshotMetrics(state){
 const clients=list(state.clients),counts={clients:clients.length,archived_clients:0,sessions:0,completed_sessions:0,planned_sessions:0,cancelled_sessions:0,requests:0,diagnoses:0,situations:0,notes:list(state.generalNotes).length,calendar_events:list(state.calendarEvents).length,payments:0,encrypted_storage:0},income={};
 const money=v=>Number(String(v??'').replace(/[\s\u00a0\u202f]/g,'').replace(',','.'));
 function add(value,currency){const n=money(value);if(!Number.isFinite(n)||n<=0)return;const cc=String(currency||'RUB').toUpperCase();if(!/^[A-Z]{3}$/.test(cc))return;income[cc]=Math.min(10**14,(income[cc]||0)+Math.round(n*100));counts.payments++}
 for(const c of clients){
  if(c.archived===true||c.status==='archived'||c.archivedAt)counts.archived_clients++;
  const sessions=list(c.sessions),requests=list(c.requests),paid=sessions.filter(s=>s.payment?.paid===true&&money(s.payment.amount)>0),ids=new Set(paid.map(s=>String(s.id)));
  counts.sessions+=sessions.length;counts.requests+=requests.length;
  for(const s of sessions){const status=String(s.status||'').toLowerCase();if(['cancelled','canceled'].includes(status))counts.cancelled_sessions++;else if(s.planned===true||status==='planned')counts.planned_sessions++;else if(status==='completed'||status==='done'||s.completedAt||s.conductedAt)counts.completed_sessions++}
  for(const r of requests){const situations=list(r.situations);if(situations.length)counts.diagnoses++;counts.situations+=situations.length;for(const pay of list(r.payment?.payments)){if(pay.sessionId&&ids.has(String(pay.sessionId)))continue;add(pay.amount,r.payment?.currency||c.currency)}}
  for(const s of paid){const r=requests.find(r=>String(r.id)===String(s.requestId||s.payment?.requestId||''));add(s.payment.amount,r?.payment?.currency||c.currency)}
 }
 return {counts,income};
}
function privateDevice(){const ua=navigator.userAgent||'',browser=/Edg\//.test(ua)?'Edge':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Other',os=/Android/.test(ua)?'Android':/iPhone|iPad|iPod/.test(ua)?'iOS':/Windows/.test(ua)?'Windows':/Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Other',type=/iPad|Tablet/.test(ua)?'tablet':/Mobile|iPhone|Android/.test(ua)?'mobile':'desktop';return {browser,os,type}}
async function reportMetrics(){if(document.visibilityState==='hidden'||reporting||!profile||Date.now()-lastMetrics<120000)return;const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;const state=db?.readState?.();if(!Array.isArray(state?.clients))return;reporting=true;lastMetrics=Date.now();try{
 const payload={clients:state.clients.length},owner=profile.id;
 if(eventsOwner!==owner){eventsOwner=owner;events={};pendingReport=null;}
 if(profile.role==='specialist'&&profile.metrics?.analytics_enabled){
  bindEvents();
  if(!pendingReport){
   const data=snapshotMetrics(state);
   try{data.counts.encrypted_storage=await window.DiagnostikaStorageUI?.setupStatus?.()==='ready'?1:0}catch{}
   if(profile?.id!==owner||!profile?.metrics?.analytics_enabled)return;
   pendingReport={...data,device:privateDevice(),events:{...events},batch:crypto.randomUUID()};events={};
  }
  payload.advanced=pendingReport;
 }else{events={};pendingReport=null}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);let r;try{r=await fetch('/account/api/metrics',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timer);}
 if(r.ok){lastMetrics=Date.now();pendingReport=null;}else if(r.status===403){pendingReport=null;events={};}
 }catch{}finally{reporting=false}}let expiryTimer=null;
function expireTrial(hcs=profile?.billing?.plan==='HCS'){profile=null;location.replace(hcs?'/account?hcs=expired':'/account?trial=expired');}
function accessExpiry(){return profile?.billing?.expires||profile?.trial?.expires||null}
function armTrial(){clearTimeout(expiryTimer);const expires=accessExpiry();if(expires){const remaining=expires*1000-Date.now();if(remaining<=0){expireTrial();return;}expiryTimer=setTimeout(()=>{if(accessExpiry()&&accessExpiry()*1000<=Date.now())expireTrial();else armTrial();},Math.min(remaining,2147483647));}}
function reserveTrial(feature,client){
 if(!profile)return false;
 if(accessExpiry()&&accessExpiry()*1000<=Date.now()){expireTrial();return false;}
 if(!profile.trial)return true;
 if(profile.trial.expires*1000<=Date.now()){expireTrial();return false;}
 if(feature==='clients'&&(profile.trial.used?.clients||0)>=5){window.AppDialog?.alert('Лимит FREE: 5 клиентов за весь период.','FREE');return false;}
 try{
  const req=new XMLHttpRequest();req.open('POST','/account/api/trial-reserve',false);req.setRequestHeader('Content-Type','application/json');if(!client)return false;const key=client.trialQuotaId||(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(String(client.id))?String(client.id):crypto.randomUUID());req.send(JSON.stringify({feature,client:key}));
  if(req.status!==200)throw Error(JSON.parse(req.responseText).error||'Лимит не подтверждён');
  const result=JSON.parse(req.responseText);profile.trial=result.trial;client.trialQuotaId=key;renderQuota();return true;
 }catch(e){window.AppDialog?.alert(e.message||'Не удалось проверить лимит.','Пробный доступ');return false;}
}
// A single in-flight status check, randomized cadence, and bounded retries.
let refreshInFlight=null,refreshTimer=null,lastRefresh=0,refreshFailures=0;
let statusEndpoint='/account/api/workspace-status';
const randomDelay=(min,max)=>min+Math.floor(Math.random()*(max-min+1));
function statusDelay(){
 const hidden=document.visibilityState==='hidden';
 const normal=hidden?randomDelay(180000,240000):randomDelay(45000,60000);
 if(!refreshFailures)return normal;
 const retry=Math.min(120000,15000*2**Math.min(refreshFailures-1,3))+randomDelay(0,5000);
 return hidden?Math.max(normal,retry):retry;
}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,statusDelay());}
function refreshOnFocus(){
 if(refreshInFlight)return;
 if(document.visibilityState!=='hidden'&&Date.now()-lastRefresh>=10000)void refresh();
 else scheduleRefresh();
}
async function performRefresh(){
 lastRefresh=Date.now();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let status=0;
 try{
  const options={credentials:'same-origin',cache:'no-store',signal:controller.signal};
  let r=await fetch(statusEndpoint,options);
  // A safe fallback if the static bundle gets deployed before the account service.
  if(r.status===404&&statusEndpoint!=='/account/api/me'){statusEndpoint='/account/api/me';r=await fetch(statusEndpoint,options);}
  status=r.status??(r.ok?200:0);
  if(!r.ok){
   if(r.status===403){const reason=await r.json().catch(()=>({}));if(/Пробный доступ завершён|Подписка STANDARD завершена|Учебная лицензия HCS завершена/.test(reason.error||'')){expireTrial(/HCS/.test(reason.error||''));return;}}
   profile=null;refreshFailures=r.status>=500||r.status===429?refreshFailures+1:0;return;
  }
  profile=await r.json();refreshFailures=0;armTrial();void maybeShowVIP();
  if(!languageWrites&&profile.ui_language&&window.DiagnostikaI18n?.language!==profile.ui_language)window.DiagnostikaI18n?.setLanguage(profile.ui_language,{persist:false});
  void reportMetrics();
 }catch{profile=null;refreshFailures++;}
 finally{
  clearTimeout(timeout);window.dispatchEvent(new CustomEvent('diagnostika:workspace-account-status',{detail:{profile:profile?{...profile}:null,status}}));renderQuota();
  for(const button of document.querySelectorAll('[data-mode="deep"]')){button.hidden=!profile?.limits?.ai_detailed;button.disabled=!profile?.limits?.ai_detailed;}
 }
}
function refresh(){if(refreshInFlight)return refreshInFlight;clearTimeout(refreshTimer);refreshInFlight=performRefresh().finally(()=>{refreshInFlight=null;scheduleRefresh();});return refreshInFlight;}
function allow(flag,limit=null,count=0){if(accessExpiry()&&accessExpiry()*1000<=Date.now()){expireTrial();return false;}if(profile?.limits&&profile.enabled!==false&&profile.limits[flag]!==false&&(limit===null||profile.limits[limit]==null||count<profile.limits[limit]))return true;window.AppDialog?.alert(profile?'Действие ограничено настройками аккаунта.':'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false}window.DiagnostikaLimits=Object.freeze({sharedStatus:true,allow,reserveTrial,isTrial:()=>!!profile?.trial,detailed:()=>profile?.limits?.ai_detailed===true,allowClient:n=>{if(profile?.limits?.clients_enabled===false)return allow('clients_enabled');if(profile&&(profile.limits.clients===null||n<profile.limits.clients))return true;window.AppDialog?.alert(profile?'Достигнут лимит клиентов: '+profile.limits.clients:'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false},refresh});const labels={
 ru:['AI','Использовано AI-запросов сегодня','Дневной лимит','Без ограничений','Проверка доступа…'],
 en:['AI','AI requests used today','Daily limit','Unlimited','Checking access…'],
 fr:['IA','Requêtes IA utilisées aujourd’hui','Limite quotidienne','Illimité','Vérification…'],
 de:['KI','KI-Anfragen heute verwendet','Tageslimit','Unbegrenzt','Zugriff wird geprüft…'],
 it:['IA','Richieste IA utilizzate oggi','Limite giornaliero','Illimitato','Verifica accesso…']
};
function updateText(el,value){if(el&&el.textContent!==String(value))el.textContent=String(value);}
function renderQuota(){
 renderNoticeLink();const el=document.getElementById('aiQuotaStatus');if(!el)return;
 const l=labels[window.DiagnostikaI18n?.language||document.documentElement.lang]||labels.ru;
 const cap=profile?.trial?(profile.trial.caps?.ai??profile.trial.cap):profile?.limits?.ai_daily,used=profile?.trial?profile.trial.used.ai:(profile?.ai_usage?.total??0);
 const value=profile?String(profile.trial?Math.max(0,cap-used):used)+' / '+(cap??'∞'):'—';
 updateText(el.querySelector('.ai-quota-label'),profile?.role==='specialist'?(profile.billing?.plan||(profile.trial?'FREE':'STANDARD'))+' · '+l[0]:l[0]);updateText(el.querySelector('.ai-quota-value'),value);
 const trialLabel=profile?.trial?({"ru":"Осталось AI-запросов за пробный период","en":"AI requests remaining during trial","fr":"Requêtes IA restantes pendant l’essai","de":"Verbleibende KI-Anfragen im Testzeitraum","it":"Richieste IA rimanenti durante la prova"})[window.DiagnostikaI18n?.language||document.documentElement.lang]||'AI trial':l[1];
 const trialInfo=({"ru":["Лимит за весь период","До","Клиенты","Сессии"],"en":["Trial total limit","Until","Clients","Sessions"],"fr":["Limite totale de l’essai","Jusqu’au","Clients","Séances"],"de":["Gesamtlimit des Tests","Bis","Klienten","Sitzungen"],"it":["Limite totale della prova","Fino al","Clienti","Sessioni"]})[window.DiagnostikaI18n?.language||document.documentElement.lang]||({"ru":["Лимит за весь период","До","Клиенты","Сессии"],"en":["Trial total limit","Until","Clients","Sessions"],"fr":["Limite totale de l’essai","Jusqu’au","Clients","Séances"],"de":["Gesamtlimit des Tests","Bis","Klienten","Sitzungen"],"it":["Limite totale della prova","Fino al","Clienti","Sessioni"]}).ru;
 const limitText=profile?.trial?trialInfo[0]:l[2];
 const trialSummary=profile?.trial?' · '+trialInfo[1]+' '+new Date(profile.trial.expires*1000).toLocaleString()+' · '+trialInfo[2]+': '+profile.trial.used.clients+'/5 · '+trialInfo[3]+': '+profile.trial.used.sessions+'/'+(profile.trial.caps.clients*profile.trial.caps.sessions_per_client):'';
 const label=profile?trialLabel+': '+(profile.trial?Math.max(0,cap-used):used)+' · '+limitText+': '+(cap??l[3])+trialSummary:l[4];
 el.setAttribute('aria-label',label);el.title=label;
 el.dataset.exhausted=String(!!profile&&cap!=null&&used>=cap);
 const detail=document.getElementById('aiQuotaDetails');
 if(detail){updateText(detail.querySelector('.ai-quota-detail-title'),profile?trialLabel:l[4]);updateText(detail.querySelector('.ai-quota-detail-used'),profile?(profile.trial?Math.max(0,cap-used):used):'—');updateText(detail.querySelector('.ai-quota-detail-limit'),profile?limitText+': '+(cap??l[3])+trialSummary:'');}
}
const noticeLabels={ru:'Уведомления',en:'Notifications',fr:'Notifications',de:'Benachrichtigungen',it:'Notifiche'};
let vipPopupBusy=false;
async function maybeShowVIP(){
 if(vipPopupBusy||!profile?.vip_popup_pending||document.visibilityState!=='visible'||!window.AppDialog||document.querySelector('dialog[open]'))return;
 vipPopupBusy=true;try{const r=await fetch('/account/api/notifications/claim-vip',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});if(!r.ok)return;const {item}=await r.json();if(item){await window.AppDialog.alert(item.body,item.title);}}catch{}finally{vipPopupBusy=false;}
}
function renderNoticeLink(){const link=document.getElementById('workspaceNotifications');if(!link)return;const label=noticeLabels[window.DiagnostikaI18n?.language||document.documentElement.lang]||noticeLabels.ru;const n=profile?.notifications_unread||0;link.hidden=profile?.role!=='specialist';link.title=label;link.setAttribute('aria-label',label+(n?' ('+n+')':''));const count=link.querySelector('span');count.hidden=!n;updateText(count,n>99?'99+':String(n));}

const inboxCopy={
 ru:['Уведомления','Входящие','Архив','Прочитать все','Нет уведомлений','Прочитать','Архивировать','Вернуть','Назад','Далее','Не удалось загрузить. Повторить','Закрыть','Непрочитанное','Прочитано','Свернуть','Загрузка…'],
 en:['Notifications','Inbox','Archive','Mark all read','No notifications','Read','Archive','Restore','Previous','Next','Could not load. Retry','Close','Unread','Read','Collapse','Loading…'],
 fr:['Notifications','Réception','Archives','Tout marquer comme lu','Aucune notification','Lire','Archiver','Restaurer','Précédent','Suivant','Échec. Réessayer','Fermer','Non lu','Lu','Réduire','Chargement…'],
 de:['Mitteilungen','Eingang','Archiv','Alle als gelesen markieren','Keine Mitteilungen','Lesen','Archivieren','Wiederherstellen','Zurück','Weiter','Fehler. Erneut versuchen','Schließen','Ungelesen','Gelesen','Einklappen','Laden…'],
 it:['Notifiche','In arrivo','Archivio','Segna tutte come lette','Nessuna notifica','Leggi','Archivia','Ripristina','Indietro','Avanti','Errore. Riprova','Chiudi','Non letta','Letta','Comprimi','Caricamento…']
};
const noticeLang=()=>window.DiagnostikaI18n?.language||document.documentElement.lang||'ru';
const nt=i=>(inboxCopy[noticeLang()]||inboxCopy.ru)[i];
let noticePanel=null,noticeList,noticeTitle,noticeClose,noticeAll,noticeInbox,noticeArchive,noticePager,noticePrev,noticeNext,noticeError;
let noticeView='inbox',noticeOffset=0,noticeSeq=0,noticeOwner=null,noticeBusy=false,noticeTotal=0,noticeItems=[],noticeLoadedUnread=null,noticeRequested=false;
function node(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;}
function nbutton(cls,label,fn){const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
function positionNotices(){
 if(!noticePanel||noticePanel.hidden)return;const anchor=document.getElementById('workspaceNotifications');if(!anchor)return;
 const r=anchor.getBoundingClientRect(),w=Math.min(440,window.innerWidth-16),top=Math.min(Math.max(8,r.bottom+8),Math.max(8,window.innerHeight-180));
 noticePanel.style.width=w+'px';noticePanel.style.left=Math.max(8,Math.min(r.right-w,window.innerWidth-w-8))+'px';noticePanel.style.top=top+'px';noticePanel.style.maxHeight=Math.max(140,window.innerHeight-top-8)+'px';
}
function closeNotices(restore=false){
 if(!noticePanel)return;noticePanel.hidden=true;noticeSeq++;noticeRequested=false;const bell=document.getElementById('workspaceNotifications');bell?.setAttribute('aria-expanded','false');if(restore)bell?.focus();
}
function noticeLabelsUpdate(){
 if(!noticePanel)return;noticeTitle.textContent=nt(0);noticeInbox.textContent=nt(1);noticeArchive.textContent=nt(2);noticeAll.textContent=nt(3);noticeClose.title=nt(11);noticeClose.setAttribute('aria-label',nt(11));noticePrev.textContent=nt(8);noticeNext.textContent=nt(9);
 noticeInbox.setAttribute('aria-pressed',String(noticeView==='inbox'));noticeArchive.setAttribute('aria-pressed',String(noticeView==='archive'));noticeAll.hidden=noticeView!=='inbox';noticeAll.disabled=noticeBusy||!profile?.notifications_unread;
}
function ensureNoticePanel(){
 if(noticePanel)return;
 noticePanel=node('section','workspace-notice-panel');noticePanel.id='workspaceNoticePanel';noticePanel.hidden=true;noticePanel.dataset.i18nUserContent='';noticePanel.setAttribute('role','region');noticePanel.setAttribute('aria-labelledby','workspaceNoticeTitle');
 const head=node('div','wn-head');noticeTitle=node('strong','',nt(0));noticeTitle.id='workspaceNoticeTitle';noticeClose=nbutton('wn-close','×',()=>closeNotices(true));head.append(noticeTitle,noticeClose);
 const tools=node('div','wn-tools'),tabs=node('div','wn-tabs');noticeInbox=nbutton('',nt(1),()=>switchNoticeView('inbox'));noticeArchive=nbutton('',nt(2),()=>switchNoticeView('archive'));tabs.append(noticeInbox,noticeArchive);noticeAll=nbutton('wn-read-all',nt(3),()=>void mutateNotice('/read',{id:'all'}));tools.append(tabs,noticeAll);
 noticeList=node('div','wn-list');noticeList.setAttribute('aria-live','polite');noticeError=nbutton('wn-error',nt(10),()=>void loadNotices());noticeError.hidden=true;noticePager=node('div','wn-pager');noticePrev=nbutton('',nt(8),()=>{noticeOffset=Math.max(0,noticeOffset-50);void loadNotices()});noticeNext=nbutton('',nt(9),()=>{noticeOffset+=50;void loadNotices()});noticePager.append(noticePrev,noticeNext);noticePager.hidden=true;noticePanel.append(head,tools,noticeError,noticeList,noticePager);document.body.append(noticePanel);
 document.addEventListener('pointerdown',e=>{const b=document.getElementById('workspaceNotifications');if(!noticePanel.hidden&&!noticePanel.contains(e.target)&&!b?.contains(e.target))closeNotices();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!noticePanel.hidden){e.preventDefault();e.stopImmediatePropagation();closeNotices(true);}},true);
 window.addEventListener('resize',positionNotices);window.addEventListener('scroll',positionNotices,true);
}
async function noticeAPI(path,body){const r=await fetch('/account/api/notifications'+path,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(nt(10));return r.json();}
function setNoticeUnread(n){if(profile){profile.notifications_unread=n;noticeLoadedUnread=n;renderNoticeLink();}window.dispatchEvent(new CustomEvent('diagnostika:notifications-unread',{detail:n}));}
function drawNotices(){
 if(!noticePanel||noticePanel.hidden)return;noticeLabelsUpdate();noticeList.replaceChildren();
 if(!noticeItems.length)noticeList.append(node('p','wn-empty',nt(4)));
 for(const n of noticeItems){
  const card=node('article','wn-card');card.dataset.unread=String(!n.read);
  const head=node('div','wn-message-head'),dot=node('span','wn-dot'),main=node('div','wn-main'),title=node('strong','',n.title),date=node('small','',new Date(n.created*1000).toLocaleString(noticeLang(),{dateStyle:'short',timeStyle:'short'}));
  main.append(title,date);head.append(dot,main);card.append(head);
  const text=node('p','wn-body',n.body);card.append(text);
  const actions=node('div','wn-actions');
  if(!n.read){const read=nbutton('',nt(5),()=>void mutateNotice('/read',{id:n.id}));read.disabled=noticeBusy;actions.append(read);}
  const archive=nbutton('',n.archived?nt(7):nt(6),()=>void mutateNotice('/archive',{id:n.id,archived:!n.archived}));archive.disabled=noticeBusy;actions.append(archive);card.append(actions);noticeList.append(card);
 }
 noticePager.hidden=noticeOffset===0&&noticeTotal<=50;noticePrev.disabled=noticeBusy||noticeOffset===0;noticeNext.disabled=noticeBusy||noticeOffset+50>=noticeTotal;noticeInbox.disabled=noticeArchive.disabled=noticeBusy;
}
async function loadNotices(){
 if(!noticePanel||noticePanel.hidden||profile?.role!=='specialist')return;const seq=++noticeSeq,owner=profile.id,view=noticeView,offset=noticeOffset;noticeError.hidden=true;
 try{const result=await noticeAPI('?view='+view+'&offset='+offset);if(seq!==noticeSeq||noticePanel.hidden||profile?.id!==owner)return;
  if(!result.items.length&&offset>0){noticeOffset=Math.max(0,offset-50);return loadNotices();}
  noticeItems=result.items;noticeTotal=result.total;setNoticeUnread(result.unread);drawNotices();
 }catch{if(seq===noticeSeq&&!noticePanel.hidden){noticeError.textContent=nt(10);noticeError.hidden=false;}}
}
async function mutateNotice(path,body){
 if(noticeBusy||profile?.role!=='specialist')return;noticeBusy=true;const owner=profile.id;noticeSeq++;drawNotices();
 try{const result=await noticeAPI(path,body);if(profile?.id!==owner)return;setNoticeUnread(result.unread);await loadNotices();}
 catch{if(!noticePanel.hidden){noticeError.textContent=nt(10);noticeError.hidden=false;}}
 finally{noticeBusy=false;if(!noticePanel.hidden)drawNotices();}
}
function switchNoticeView(view){if(noticeBusy||view===noticeView)return;noticeOffset=0;noticeView=view;noticeItems=[];drawNotices();void loadNotices();}
async function openNotices(){
 noticeRequested=true;if(!profile){await refresh();}if(!noticeRequested||profile?.role!=='specialist')return;
 ensureNoticePanel();if(noticeOwner!==profile.id){noticeOwner=profile.id;noticeItems=[];}
 closeQuota();noticeView='inbox';noticeOffset=0;noticePanel.hidden=false;noticeList.replaceChildren(node('p','wn-empty',nt(15)));noticePager.hidden=true;noticeLabelsUpdate();document.getElementById('workspaceNotifications')?.setAttribute('aria-expanded','true');positionNotices();await loadNotices();
}
function noticeHash(){if(!['#account-notifications','#notifications'].includes(location.hash))return;history.replaceState(history.state,'',location.pathname+location.search);void openNotices();}
window.addEventListener('diagnostika:open-account-notifications',()=>void openNotices());window.addEventListener('hashchange',noticeHash);
window.addEventListener('diagnostika:language-changed',()=>{if(noticePanel&&!noticePanel.hidden){noticeLabelsUpdate();void loadNotices();}});
window.addEventListener('diagnostika:workspace-account-status',e=>{if(!noticePanel||noticePanel.hidden)return;const u=e.detail?.profile;if(u?.role!=='specialist'||u.id!==noticeOwner){closeNotices();noticeItems=[];return;}if(!noticeBusy&&u.notifications_unread!==noticeLoadedUnread)void loadNotices();});

function closeQuota(){
 const detail=document.getElementById('aiQuotaDetails'),el=document.getElementById('aiQuotaStatus');
 if(detail)detail.hidden=true;if(el)el.setAttribute('aria-expanded','false');
}
function placeQuota(){
 const title=document.querySelector('.app-header h1');
 const group=title?.closest('.header-title-group');if(!group)return;
 let wrap=document.getElementById('aiQuotaWrap');
 if(!wrap){
  wrap=document.createElement('div');wrap.id='aiQuotaWrap';wrap.setAttribute('data-i18n-user-content','');
  wrap.innerHTML='<button id="aiQuotaStatus" type="button" aria-expanded="false" aria-controls="aiQuotaDetails"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5L14.8 9.2 21.5 12l-6.7 2.8L12 21.5l-2.8-6.7L2.5 12l6.7-2.8z"/><path d="M19 2v4m-2-2h4"/></svg><span class="ai-quota-label">AI</span><strong class="ai-quota-value">—</strong></button><div id="aiQuotaDetails" hidden><span class="ai-quota-detail-title"></span><strong class="ai-quota-detail-used"></strong><span class="ai-quota-detail-limit"></span></div><button type="button" id="workspaceNotifications" aria-expanded="false" aria-controls="workspaceNoticePanel" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span hidden></span></button>';
  wrap.querySelector('#workspaceNotifications').addEventListener('click',()=>{if(noticePanel&&!noticePanel.hidden)closeNotices();else void openNotices();});
  const button=wrap.querySelector('button'),detail=wrap.querySelector('#aiQuotaDetails');
  button.addEventListener('click',()=>{closeNotices();const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));});
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))closeQuota();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!detail.hidden){closeQuota();button.focus();}});
 }
 if(wrap.parentElement!==group||title.nextElementSibling!==wrap)title.after(wrap);
 renderQuota();
}
const start=()=>{
 const style=document.createElement('style');style.textContent=`
 #workspaceNotifications{border:0;background:transparent;cursor:pointer;box-shadow:none;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:3px;color:#d8e7fb;text-decoration:none;padding:0 5px;height:28px;flex:none}#workspaceNotifications[hidden],#workspaceNotifications span[hidden]{display:none!important}#workspaceNotifications svg{width:15px;height:15px}#workspaceNotifications span{font:700 10px system-ui;background:#bfa3ef;color:#30204d;padding:1px 4px;border-radius:8px}#workspaceNotifications:focus-visible{outline:2px solid #b9aeff;outline-offset:2px}
 #workspaceNoticePanel{position:fixed;z-index:100080;box-sizing:border-box;display:flex;flex-direction:column;gap:0;background:#fff!important;color:#1f344b!important;border:1px solid #b6c9dc;border-radius:12px;box-shadow:0 15px 42px #10253d40;font:13px/1.5 system-ui,sans-serif!important;overflow:hidden;text-align:left}
 #workspaceNoticePanel[hidden],#workspaceNoticePanel [hidden]{display:none!important}
 #workspaceNoticePanel button{appearance:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:auto!important;min-width:0!important;height:auto!important;min-height:0!important;max-width:100%!important;margin:0!important;padding:6px 9px!important;border:1px solid #c4d3e2!important;border-radius:6px!important;box-shadow:none!important;text-shadow:none!important;transform:none!important;background:#fff!important;color:#244d76!important;font:600 12px/1.3 system-ui,sans-serif!important;letter-spacing:normal!important;white-space:normal!important;cursor:pointer;text-align:center!important}
 #workspaceNoticePanel button:hover:not(:disabled){background:#e7f0fa!important;color:#123b63!important}#workspaceNoticePanel button:disabled{opacity:1!important;color:#74869a!important;background:#f2f5f8!important;cursor:default}#workspaceNoticePanel button:focus-visible{outline:2px solid #517ca7;outline-offset:2px}
 #workspaceNoticePanel .wn-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px 8px;flex:none}#workspaceNoticePanel .wn-head strong{font-size:16px;font-weight:700;color:#163b62}#workspaceNoticePanel .wn-close{font-size:20px!important;line-height:1!important;padding:3px 8px!important}
 #workspaceNoticePanel .wn-tools{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 12px 10px;border-bottom:1px solid #dbe5ee;flex-wrap:wrap;flex:none}#workspaceNoticePanel .wn-tabs{display:flex;gap:4px}#workspaceNoticePanel .wn-tabs button[aria-pressed=true]{background:#24547e!important;border-color:#24547e!important;color:#fff!important}#workspaceNoticePanel .wn-tabs button[aria-pressed=true]:hover{background:#24547e!important;color:#fff!important}
 #workspaceNoticePanel .wn-read-all{color:#234d78!important;border-color:#b8cde1!important}
 #workspaceNoticePanel .wn-list{overflow-y:auto;overscroll-behavior:contain;min-height:0;flex:1 1 auto;max-height:60vh}
 #workspaceNoticePanel .wn-card{padding:10px 12px;border-bottom:1px solid #dbe5ee;background:#fff}#workspaceNoticePanel .wn-card[data-unread=true]{background:#eaf3ff;border-left:3px solid #3479bf;padding-left:9px}#workspaceNoticePanel .wn-card:last-child{border-bottom:0}
 #workspaceNoticePanel .wn-message-head{display:flex;align-items:flex-start;gap:7px}#workspaceNoticePanel .wn-main{display:grid;min-width:0;flex:1;gap:2px}#workspaceNoticePanel .wn-main strong{font-size:14px;line-height:1.35;overflow-wrap:anywhere;font-weight:700;color:#183d60}#workspaceNoticePanel .wn-main small{font-size:11px;color:#536b81}#workspaceNoticePanel .wn-dot{width:8px;height:8px;flex:0 0 8px;margin-top:5px;border-radius:50%;background:transparent}#workspaceNoticePanel .wn-card[data-unread=true] .wn-dot{background:#3479bf}
 #workspaceNoticePanel .wn-body{display:block!important;margin:7px 0 8px 15px!important;padding:0!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important;overflow:visible!important;max-height:none!important;-webkit-line-clamp:unset!important;color:#263b52!important;text-shadow:none!important;font:13px/1.5 system-ui,sans-serif!important}
 #workspaceNoticePanel .wn-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}#workspaceNoticePanel .wn-actions button{font-size:12px!important;padding:5px 8px!important}#workspaceNoticePanel .wn-card[data-unread=true] .wn-actions button:first-child{background:#24547e!important;color:#fff!important;border-color:#24547e!important}
 #workspaceNoticePanel .wn-empty{margin:0;padding:22px 12px;text-align:center;color:#536b81;font-size:13px}#workspaceNoticePanel .wn-pager{display:flex;justify-content:space-between;border-top:1px solid #dbe5ee;padding:7px 12px;flex:none}#workspaceNoticePanel .wn-error{margin:6px 12px!important;color:#8b2424!important;background:#fff0f0!important}
 .app-header .header-title-group #aiQuotaWrap{position:relative;display:flex;flex:0 0 auto;align-items:center;align-self:center;margin:0 0 0 1px}
 .app-header .header-title-group #aiQuotaStatus{display:inline-flex!important;align-items:center;justify-content:center;gap:5px;min-width:0!important;width:auto!important;min-height:28px!important;height:28px!important;box-sizing:border-box;padding:0 9px!important;margin:0!important;border:1px solid #7892ad!important;border-radius:999px!important;background:linear-gradient(135deg,#263d56,#1e3047)!important;color:#d8e7fb!important;box-shadow:inset 0 1px 0 #ffffff14!important;font:600 11px/1 system-ui,sans-serif!important;white-space:nowrap!important;cursor:pointer}
 .app-header .header-title-group #aiQuotaStatus:hover,.app-header .header-title-group #aiQuotaStatus[aria-expanded="true"]{background:#3e5876!important;border-color:#a4bce0!important}
 .app-header .header-title-group #aiQuotaStatus:focus-visible{outline:2px solid #b9aeff;outline-offset:3px}
 .app-header #aiQuotaStatus svg{width:13px;height:13px;flex:none;color:#cbbdff}
 .app-header #aiQuotaStatus .ai-quota-label{font-weight:600;letter-spacing:.03em}
 .app-header #aiQuotaStatus .ai-quota-value{font-size:12px;font-weight:750;font-variant-numeric:tabular-nums;color:#fff}
 .app-header .header-title-group #aiQuotaStatus[data-exhausted="true"]{border-color:#cf965b!important}
 .app-header #aiQuotaDetails{position:absolute;left:0;right:auto;top:calc(100% + 9px);z-index:31000;display:grid;gap:5px;width:max-content;max-width:min(245px,calc(100vw - 24px));padding:12px 14px;border:1px solid #c8d9e8;border-radius:10px;background:#f8fbff;color:#244560;box-shadow:0 10px 28px #142b4230;font:600 12px/1.4 system-ui,sans-serif;white-space:normal}
 .app-header #aiQuotaDetails[hidden]{display:none!important}
 .app-header .ai-quota-detail-used{font-size:23px;color:#244560;font-variant-numeric:tabular-nums}
 .app-header .ai-quota-detail-limit{font-size:11px;color:#526b81}
 @media(max-width:1180px){.app-header .header-title-group #aiQuotaStatus{padding:0 6px!important;gap:3px!important;font-size:10px!important}.app-header #aiQuotaStatus .ai-quota-value{font-size:11px}.app-header #aiQuotaStatus svg{display:none}}
 @media(max-width:767px),(max-width:1000px) and (max-height:500px) and (pointer:coarse){.app-header .header-title-group #aiQuotaWrap{margin:0!important}.app-header .header-title-group #aiQuotaStatus{height:32px!important;min-height:32px!important;padding:0 6px!important}.app-header #aiQuotaDetails{left:auto;right:0}.app-header #aiQuotaStatus svg{display:none}}
 `;document.head.append(style);placeQuota();refresh();noticeHash();window.addEventListener('focus',refreshOnFocus);document.addEventListener('visibilitychange',refreshOnFocus);window.addEventListener('diagnostika:language-changed',renderQuota);window.addEventListener('diagnostika:header-component-ready',placeQuota);
};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();
