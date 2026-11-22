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
async function reportMetrics(){if(reporting||!profile||Date.now()-lastMetrics<60000)return;const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;const state=db?.readState?.();if(!Array.isArray(state?.clients))return;reporting=true;try{
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
 const r=await fetch('/account/api/metrics',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(r.ok){lastMetrics=Date.now();pendingReport=null;}else if(r.status===403){pendingReport=null;events={};}
 }catch{}finally{reporting=false}}let expiryTimer=null;
function expireTrial(){profile=null;location.replace('/account?trial=expired');}
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
async function refresh(){try{const r=await fetch('/account/api/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok){if(r.status===403){const reason=await r.json().catch(()=>({}));if(/Пробный доступ завершён|Подписка STANDARD завершена/.test(reason.error||'')){expireTrial();return;}}profile=null;return}profile=await r.json();armTrial();if(!languageWrites&&profile.ui_language&&window.DiagnostikaI18n?.language!==profile.ui_language)window.DiagnostikaI18n?.setLanguage(profile.ui_language,{persist:false});void reportMetrics();}catch{profile=null}renderQuota();for(const button of document.querySelectorAll('[data-mode="deep"]')){button.hidden=!profile?.limits?.ai_detailed;button.disabled=!profile?.limits?.ai_detailed;}}function allow(flag,limit=null,count=0){if(accessExpiry()&&accessExpiry()*1000<=Date.now()){expireTrial();return false;}if(profile?.limits&&profile.enabled!==false&&profile.limits[flag]!==false&&(limit===null||profile.limits[limit]==null||count<profile.limits[limit]))return true;window.AppDialog?.alert(profile?'Действие ограничено настройками аккаунта.':'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false}window.DiagnostikaLimits=Object.freeze({allow,reserveTrial,isTrial:()=>!!profile?.trial,detailed:()=>profile?.limits?.ai_detailed===true,allowClient:n=>{if(profile?.limits?.clients_enabled===false)return allow('clients_enabled');if(profile&&(profile.limits.clients===null||n<profile.limits.clients))return true;window.AppDialog?.alert(profile?'Достигнут лимит клиентов: '+profile.limits.clients:'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false},refresh});const labels={
 ru:['AI','Использовано AI-запросов сегодня','Дневной лимит','Без ограничений','Проверка доступа…'],
 en:['AI','AI requests used today','Daily limit','Unlimited','Checking access…'],
 fr:['IA','Requêtes IA utilisées aujourd’hui','Limite quotidienne','Illimité','Vérification…'],
 de:['KI','KI-Anfragen heute verwendet','Tageslimit','Unbegrenzt','Zugriff wird geprüft…'],
 it:['IA','Richieste IA utilizzate oggi','Limite giornaliero','Illimitato','Verifica accesso…']
};
function updateText(el,value){if(el&&el.textContent!==String(value))el.textContent=String(value);}
function renderQuota(){
 const el=document.getElementById('aiQuotaStatus');if(!el)return;
 const l=labels[window.DiagnostikaI18n?.language||document.documentElement.lang]||labels.ru;
 const cap=profile?.trial?20:profile?.limits?.ai_daily,used=profile?.trial?profile.trial.used.ai:(profile?.ai_usage?.total??0);
 const value=profile?String(profile.trial?Math.max(0,cap-used):used)+' / '+(cap??'∞'):'—';
 updateText(el.querySelector('.ai-quota-label'),profile?.role==='specialist'?(profile.billing?.plan||(profile.trial?'FREE':'STANDARD'))+' · '+l[0]:l[0]);updateText(el.querySelector('.ai-quota-value'),value);
 const trialLabel=profile?.trial?({"ru":"Осталось AI-запросов за пробный период","en":"AI requests remaining during trial","fr":"Requêtes IA restantes pendant l’essai","de":"Verbleibende KI-Anfragen im Testzeitraum","it":"Richieste IA rimanenti durante la prova"})[window.DiagnostikaI18n?.language||document.documentElement.lang]||'AI trial':l[1];
 const trialInfo=({"ru":["Лимит за весь период","До","Клиенты","Сессии"],"en":["Trial total limit","Until","Clients","Sessions"],"fr":["Limite totale de l’essai","Jusqu’au","Clients","Séances"],"de":["Gesamtlimit des Tests","Bis","Klienten","Sitzungen"],"it":["Limite totale della prova","Fino al","Clienti","Sessioni"]})[window.DiagnostikaI18n?.language||document.documentElement.lang]||({"ru":["Лимит за весь период","До","Клиенты","Сессии"],"en":["Trial total limit","Until","Clients","Sessions"],"fr":["Limite totale de l’essai","Jusqu’au","Clients","Séances"],"de":["Gesamtlimit des Tests","Bis","Klienten","Sitzungen"],"it":["Limite totale della prova","Fino al","Clienti","Sessioni"]}).ru;
 const limitText=profile?.trial?trialInfo[0]:l[2];
 const trialSummary=profile?.trial?' · '+trialInfo[1]+' '+new Date(profile.trial.expires*1000).toLocaleString()+' · '+trialInfo[2]+': '+profile.trial.used.clients+'/5 · '+trialInfo[3]+': '+profile.trial.used.sessions+'/25':'';
 const label=profile?trialLabel+': '+(profile.trial?Math.max(0,cap-used):used)+' · '+limitText+': '+(cap??l[3])+trialSummary:l[4];
 el.setAttribute('aria-label',label);el.title=label;
 el.dataset.exhausted=String(!!profile&&cap!=null&&used>=cap);
 const detail=document.getElementById('aiQuotaDetails');
 if(detail){updateText(detail.querySelector('.ai-quota-detail-title'),profile?trialLabel:l[4]);updateText(detail.querySelector('.ai-quota-detail-used'),profile?(profile.trial?Math.max(0,cap-used):used):'—');updateText(detail.querySelector('.ai-quota-detail-limit'),profile?limitText+': '+(cap??l[3])+trialSummary:'');}
}
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
  wrap.innerHTML='<button id="aiQuotaStatus" type="button" aria-expanded="false" aria-controls="aiQuotaDetails"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5L14.8 9.2 21.5 12l-6.7 2.8L12 21.5l-2.8-6.7L2.5 12l6.7-2.8z"/><path d="M19 2v4m-2-2h4"/></svg><span class="ai-quota-label">AI</span><strong class="ai-quota-value">—</strong></button><div id="aiQuotaDetails" hidden><span class="ai-quota-detail-title"></span><strong class="ai-quota-detail-used"></strong><span class="ai-quota-detail-limit"></span></div>';
  const button=wrap.querySelector('button'),detail=wrap.querySelector('#aiQuotaDetails');
  button.addEventListener('click',()=>{const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));});
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))closeQuota();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!detail.hidden){closeQuota();button.focus();}});
 }
 if(wrap.parentElement!==group||title.nextElementSibling!==wrap)title.after(wrap);
 renderQuota();
}
const start=()=>{
 const style=document.createElement('style');style.textContent=`
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
 `;document.head.append(style);placeQuota();refresh();setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('diagnostika:language-changed',renderQuota);window.addEventListener('diagnostika:header-component-ready',placeQuota);
};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();
