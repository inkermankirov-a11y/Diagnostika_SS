'use strict';
(()=>{if(location.hostname!=='zabvenye.com')return;let profile=null,lastMetrics=0,reporting=false,languageWrites=0;window.addEventListener('diagnostika:language-changed',async e=>{const language=e.detail?.language;if(!['ru','en','fr','de','it'].includes(language))return;languageWrites++;try{const result=await fetch('/account/api/language',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({language})});if(!result.ok)throw Error('Language preference not saved');if(profile)profile.ui_language=language;}catch(error){console.warn(error)}finally{languageWrites--}});async function reportMetrics(){if(reporting||!profile||Date.now()-lastMetrics<60000)return;const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;const state=db?.readState?.();if(!Array.isArray(state?.clients))return;reporting=true;try{const r=await fetch('/account/api/metrics',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({clients:state.clients.length})});if(r.ok)lastMetrics=Date.now()}catch{}finally{reporting=false}}async function refresh(){try{const r=await fetch('/account/api/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok){profile=null;return}profile=await r.json();if(!languageWrites&&profile.ui_language&&window.DiagnostikaI18n?.language!==profile.ui_language)window.DiagnostikaI18n?.setLanguage(profile.ui_language,{persist:false});void reportMetrics();}catch{profile=null}renderQuota();for(const button of document.querySelectorAll('[data-mode="deep"]')){button.hidden=!profile?.limits?.ai_detailed;button.disabled=!profile?.limits?.ai_detailed;}}window.DiagnostikaLimits=Object.freeze({detailed:()=>profile?.limits?.ai_detailed===true,allowClient:n=>{if(profile&&(profile.limits.clients===null||n<profile.limits.clients))return true;window.AppDialog?.alert(profile?'Достигнут лимит клиентов: '+profile.limits.clients:'Не удалось проверить ограничения аккаунта.','Ограничение аккаунта');return false},refresh});const labels={ru:['AI сегодня','Проверка доступа','Лимит AI-запросов на сегодня'],en:['AI today','Checking access','Daily AI request limit'],fr:['IA aujourd’hui','Vérification','Limite quotidienne de requêtes IA'],de:['KI heute','Zugriff prüfen','Tägliches KI-Anfragelimit'],it:['IA oggi','Verifica accesso','Limite giornaliero di richieste IA']};
function renderQuota(){
 const el=document.getElementById('aiQuotaStatus');if(!el)return;
 const lang=window.DiagnostikaI18n?.language||document.documentElement.lang||'ru',l=labels[lang]||labels.ru;
 const cap=profile?.limits?.ai_daily,used=profile?.ai_usage?.total;
 const label=el.querySelector('.ai-quota-label'),value=el.querySelector('.ai-quota-value');
 label.textContent=l[0];value.textContent=profile?(used??0)+' / '+(cap??'∞'):l[1];el.setAttribute('aria-label',l[2]+': '+value.textContent);el.title=l[2];
}
function placeQuota(){
 const title=document.querySelector('.app-header h1');if(!title)return;
 let el=document.getElementById('aiQuotaStatus');
 if(!el){el=document.createElement('span');el.id='aiQuotaStatus';el.setAttribute('data-i18n-user-content','');el.innerHTML='<span class="ai-quota-label"></span><strong class="ai-quota-value"></strong>';}
 if(title.nextElementSibling!==el)title.after(el);
 renderQuota();
}
const start=()=>{
 const style=document.createElement('style');style.textContent=`
 .app-header #aiQuotaStatus{display:inline-flex;flex:0 0 auto;flex-direction:column;justify-content:center;gap:2px;min-width:66px;max-width:110px;padding:6px 10px;box-sizing:border-box;border:1px solid #9bb3c8;border-radius:9px;background:#edf5fc;color:#244560;font:600 10px/1.15 system-ui,sans-serif;white-space:normal}
 .app-header #aiQuotaStatus .ai-quota-label{opacity:.85}
 .app-header #aiQuotaStatus .ai-quota-value{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}
 @media(max-width:1000px){.app-header #aiQuotaStatus{padding:4px 6px;min-width:48px;max-width:78px;gap:1px;font-size:9px}.app-header #aiQuotaStatus .ai-quota-value{font-size:12px}}
 @media(max-width:767px),(max-width:1000px) and (max-height:500px) and (pointer:coarse){html body .app-header .header-title-group{gap:5px!important}.app-header #aiQuotaStatus{padding:3px 5px;max-width:68px;min-width:44px}}
 `;document.head.append(style);placeQuota();refresh();setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('diagnostika:language-changed',renderQuota);
};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();})();
