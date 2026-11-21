'use strict';
(()=>{if(location.hostname!=='zabvenye.com')return;let profile=null,lastMetrics=0,reporting=false,languageWrites=0;window.addEventListener('diagnostika:language-changed',async e=>{const language=e.detail?.language;if(!['ru','en','fr','de','it'].includes(language))return;languageWrites++;try{const result=await fetch('/account/api/language',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({language})});if(!result.ok)throw Error('Language preference not saved');if(profile)profile.ui_language=language;}catch(error){console.warn(error)}finally{languageWrites--}});async function reportMetrics(){if(reporting||!profile||Date.now()-lastMetrics<60000)return;const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;const state=db?.readState?.();if(!Array.isArray(state?.clients))return;reporting=true;try{const r=await fetch('/account/api/metrics',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({clients:state.clients.length})});if(r.ok)lastMetrics=Date.now()}catch{}finally{reporting=false}}async function refresh(){try{const r=await fetch('/account/api/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok){profile=null;return}profile=await r.json();if(!languageWrites&&profile.ui_language&&window.DiagnostikaI18n?.language!==profile.ui_language)window.DiagnostikaI18n?.setLanguage(profile.ui_language,{persist:false});void reportMetrics();}catch{profile=null}renderQuota();for(const button of document.querySelectorAll('[data-mode="deep"]')){button.hidden=!profile?.limits?.ai_detailed;button.disabled=!profile?.limits?.ai_detailed;}}function allow(flag,limit=null,count=0){if(profile?.limits&&profile.enabled!==false&&profile.limits[flag]!==false&&(limit===null||profile.limits[limit]==null||count<profile.limits[limit]))return true;window.AppDialog?.alert(profile?'Действие ограничено настройками аккаунта.':'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false}window.DiagnostikaLimits=Object.freeze({allow,detailed:()=>profile?.limits?.ai_detailed===true,allowClient:n=>{if(profile?.limits?.clients_enabled===false)return allow('clients_enabled');if(profile&&(profile.limits.clients===null||n<profile.limits.clients))return true;window.AppDialog?.alert(profile?'Достигнут лимит клиентов: '+profile.limits.clients:'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false},refresh});const labels={
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
 const cap=profile?.limits?.ai_daily,used=profile?.ai_usage?.total??0;
 const value=profile?String(used)+' / '+(cap??'∞'):'—';
 updateText(el.querySelector('.ai-quota-label'),l[0]);updateText(el.querySelector('.ai-quota-value'),value);
 const label=profile?l[1]+': '+used+' · '+l[2]+': '+(cap??l[3]):l[4];
 el.setAttribute('aria-label',label);el.title=label;
 el.dataset.exhausted=String(!!profile&&cap!=null&&used>=cap);
 const detail=document.getElementById('aiQuotaDetails');
 if(detail){updateText(detail.querySelector('.ai-quota-detail-title'),profile?l[1]:l[4]);updateText(detail.querySelector('.ai-quota-detail-used'),profile?used:'—');updateText(detail.querySelector('.ai-quota-detail-limit'),profile?l[2]+': '+(cap??l[3]):'');}
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
