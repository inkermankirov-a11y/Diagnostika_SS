'use strict';

(() => {
  const PREFIX={ru:'Запрос',en:'Request',fr:'Demande',de:'Anliegen',it:'Richiesta'};
  const TEXT={
    ru:{active:'В работе',completed:'Завершён',current:'ТЕКУЩИЙ ЗАПРОС',none:'Нет текущего запроса',finish:'Завершить запрос',resume:'Возобновить',makeCurrent:'Активный запрос',currentMark:'Активный запрос ✓',other:'Других запросов в работе'},
    en:{active:'In progress',completed:'Completed',current:'CURRENT REQUEST',none:'No current request',finish:'Complete request',resume:'Resume',makeCurrent:'Active request',currentMark:'Active request ✓',other:'Other active requests'},
    fr:{active:'En cours',completed:'Terminé',current:'DEMANDE ACTUELLE',none:'Aucune demande actuelle',finish:'Terminer',resume:'Reprendre',makeCurrent:'Demande active',currentMark:'Demande active ✓',other:'Autres demandes en cours'},
    de:{active:'In Arbeit',completed:'Abgeschlossen',current:'AKTUELLES ANLIEGEN',none:'Kein aktuelles Anliegen',finish:'Abschließen',resume:'Wiederaufnehmen',makeCurrent:'Aktives Anliegen',currentMark:'Aktives Anliegen ✓',other:'Weitere Anliegen in Arbeit'},
    it:{active:'In corso',completed:'Completato',current:'RICHIESTA ATTUALE',none:'Nessuna richiesta attuale',finish:'Completa richiesta',resume:'Riprendi',makeCurrent:'Richiesta attiva',currentMark:'Richiesta attiva ✓',other:'Altre richieste in corso'}
  };

  function lang(){const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';return PREFIX[l]?l:'en';}
  function tx(k){return TEXT[lang()][k]||TEXT.en[k]||k;}
  function cclient(){return typeof client==='function'?client():null;}
  function reqById(c,id){return c?.requests?.find(r=>r.id===id)||null;}
  function now(){return new Date().toISOString();}
  function dateText(raw){if(!raw)return'';const d=new Date(raw);if(Number.isNaN(d.getTime()))return'';return d.toLocaleDateString(lang()==='ru'?'ru-RU':lang()==='de'?'de-DE':lang()==='fr'?'fr-FR':lang()==='it'?'it-IT':'en-GB');}

  function normalizeStatus(r){
    if(!r.status) r.status='active';
    if(r.status==='paused'||r.status==='resumed') r.status='active';
    return r.status;
  }

  function ensureClient(c){
    if(!c||!Array.isArray(c.requests)) return null;
    c.requests.forEach(r=>{normalizeStatus(r);if(!r.createdAt)r.createdAt=now();});
    if(c.currentRequestId&&!reqById(c,c.currentRequestId))c.currentRequestId=null;
    if(!c.currentRequestId){
      const active=c.requests.find(r=>normalizeStatus(r)==='active');
      if(active)c.currentRequestId=active.id;
    }
    return reqById(c,c.currentRequestId);
  }

  function setCurrent(c,id,{resumeCompleted=false}={}){
    if(!c)return null;
    const target=reqById(c,id);if(!target)return null;
    if(target.status==='completed'&&!resumeCompleted)return null;
    if(target.status==='completed')target.status='active';
    c.currentRequestId=target.id;
    c.lastDiagnosisRequestId=target.id;
    target.updatedAt=now();
    if(typeof save==='function')save();
    return target;
  }

  function currentRequest(c=cclient()){return ensureClient(c);}
  function requestNumber(c,r){const i=c?.requests?.indexOf(r)??-1;return i>=0?i+1:0;}
  function statusLabel(r){return tx(normalizeStatus(r||{}));}
  function openCount(c){return (c?.requests||[]).filter(r=>r.id!==c.currentRequestId&&normalizeStatus(r)==='active').length;}

  function relabel(){
    const c=cclient(),select=document.querySelector('#requestSelect');if(!select)return;
    [...select.options].forEach((option,index)=>{
      const r=c?.requests?.[index];
      const d=dateText(r?.createdAt);
      option.textContent=`${PREFIX[lang()]} ${index+1}${d?' · '+d:''}`;
    });
    if(requestId&&[...select.options].some(o=>o.value===requestId))select.value=requestId;
  }

  function ensureCurrentBox(){
    const card=document.querySelector('.client-card');if(!card||card.querySelector('#currentRequestBox'))return;
    const box=document.createElement('div');box.id='currentRequestBox';box.className='current-request-box';
    box.innerHTML='<div class="current-request-label"></div><div class="current-request-row"><div class="current-request-text"></div><span class="current-request-status"></span></div><div class="current-request-extra"></div>';
    const pay=card.querySelector('#clientPaymentBox'),work=card.querySelector('.client-work');
    if(pay)pay.insertAdjacentElement('beforebegin',box);else if(work)work.insertAdjacentElement('beforebegin',box);else card.appendChild(box);
  }

  function renderCurrentBox(){
    ensureCurrentBox();const c=cclient(),box=document.querySelector('#currentRequestBox');if(!box||!c)return;
    const r=currentRequest(c),label=box.querySelector('.current-request-label'),text=box.querySelector('.current-request-text'),badge=box.querySelector('.current-request-status'),extra=box.querySelector('.current-request-extra');
    label.textContent=tx('current');
    if(!r){text.textContent=tx('none');badge.textContent='';badge.className='current-request-status';extra.textContent='';return;}
    text.textContent=`${PREFIX[lang()]} ${requestNumber(c,r)}: ${r.title||'—'}`;
    badge.textContent=statusLabel(r);badge.className=`current-request-status ${r.status}`;
    const n=openCount(c);extra.textContent=n?`${tx('other')}: ${n}`:'';
  }

  function ensureStatusControls(){
    const toolbar=document.querySelector('.query-toolbar');if(!toolbar||document.querySelector('#requestStatusControls'))return;
    const row=document.createElement('div');row.id='requestStatusControls';row.className='request-status-controls';
    row.innerHTML='<span class="request-status-badge"></span><button type="button" class="tk-btn request-current-btn"></button><button type="button" class="tk-btn request-resume-btn"></button><button type="button" class="tk-btn request-finish-btn"></button>';
    toolbar.insertAdjacentElement('afterend',row);

    row.querySelector('.request-current-btn').onclick=()=>{
      const c=cclient(),r=reqById(c,requestId);if(!c||!r||r.status==='completed')return;
      setCurrent(c,r.id);renderAll();
    };
    row.querySelector('.request-resume-btn').onclick=()=>{
      const c=cclient(),r=reqById(c,requestId);if(!c||!r)return;
      r.status='active';delete r.completedAt;r.updatedAt=now();setCurrent(c,r.id,{resumeCompleted:true});save();renderAll();
    };
    row.querySelector('.request-finish-btn').onclick=()=>{
      const c=cclient(),r=reqById(c,requestId);if(!c||!r)return;
      r.status='completed';r.completedAt=now();r.updatedAt=r.completedAt;
      if(c.currentRequestId===r.id){const next=c.requests.find(x=>x.id!==r.id&&normalizeStatus(x)==='active');c.currentRequestId=next?.id||null;}
      save();renderAll();
    };
  }

  function renderStatusControls(){
    ensureStatusControls();const row=document.querySelector('#requestStatusControls'),c=cclient(),r=reqById(c,requestId);if(!row)return;
    if(!r){row.style.display='none';return;}row.style.display='flex';normalizeStatus(r);
    const badge=row.querySelector('.request-status-badge'),currentBtn=row.querySelector('.request-current-btn'),resumeBtn=row.querySelector('.request-resume-btn'),finishBtn=row.querySelector('.request-finish-btn');
    badge.textContent=statusLabel(r);badge.className=`request-status-badge ${r.status}`;
    const completed=r.status==='completed',isCurrent=c?.currentRequestId===r.id;
    currentBtn.style.display=completed?'none':'';currentBtn.textContent=isCurrent?tx('currentMark'):tx('makeCurrent');currentBtn.disabled=isCurrent;
    resumeBtn.style.display=completed?'':'none';resumeBtn.textContent=tx('resume');
    finishBtn.style.display=completed?'none':'';finishBtn.textContent=tx('finish');
  }

  function renderAll(){relabel();renderCurrentBox();renderStatusControls();if(window.DiagnostikaPayments?.refresh)window.DiagnostikaPayments.refresh();}

  (state.clients||[]).forEach(ensureClient);if(typeof save==='function')save();

  const oldRenderClient=window.renderClient;if(typeof oldRenderClient==='function')window.renderClient=function(){const v=oldRenderClient.apply(this,arguments);setTimeout(renderAll,0);return v;};
  const oldRenderRequests=window.renderRequests;if(typeof oldRenderRequests==='function')window.renderRequests=function(){const v=oldRenderRequests.apply(this,arguments);setTimeout(renderAll,0);return v;};

  const select=document.querySelector('#requestSelect');
  if(select){
    select.onchange=e=>{requestId=e.target.value;situationId=null;selected=null;if(typeof renderRequests==='function')renderRequests();};
    new MutationObserver(relabel).observe(select,{childList:true});
  }

  const addRequest=document.querySelector('#addRequestBtn');
  if(addRequest)addRequest.onclick=()=>{const c=cclient();if(!c)return;const r=newRequest();r.title='Новый запрос';r.status='active';r.createdAt=now();r.updatedAt=r.createdAt;c.requests.push(r);c.currentRequestId=r.id;c.lastDiagnosisRequestId=r.id;requestId=r.id;situationId=null;selected=null;save();renderRequests();};

  const diagNew=document.querySelector('#diagNewBtn');
  if(diagNew)diagNew.onclick=()=>{const c=cclient();if(!c)return;const r=newRequest();r.title='Новый запрос';r.status='active';r.createdAt=now();r.updatedAt=r.createdAt;c.requests.push(r);c.currentRequestId=r.id;c.lastDiagnosisRequestId=r.id;requestId=r.id;situationId=null;selected=null;mode='diagnosis';save();renderRequests();renderMode();document.querySelector('#diagnosisLaunchDialog')?.close();};

  const diagnosisBtn=document.querySelector('#diagnosisModeBtn');
  if(diagnosisBtn)diagnosisBtn.onclick=()=>{const c=cclient();if(!c)return alert('Сначала выбери клиента.');if(mode==='diagnosis'){document.querySelector('#diagnosisLaunchDialog')?.showModal();return;}const r=currentRequest(c);if(r){requestId=r.id;situationId=r.situations?.[0]?.id||null;selected=null;mode='diagnosis';c.lastDiagnosisRequestId=r.id;save();renderRequests();renderMode();}else document.querySelector('#diagnosisLaunchDialog')?.showModal();};

  const addSession=document.querySelector('#addSessionBtn');
  if(addSession)addSession.onclick=()=>{const c=cclient();if(!c)return;const r=currentRequest(c);c.sessions.push({id:uid(),date:today(),requestId:r?.status==='active'?r.id:'',notes:''});save();renderSessions();};

  const style=document.createElement('style');style.textContent=`
    .current-request-box{margin:8px 0 2px;padding:9px 10px;border:1px solid #cddbea;border-radius:8px;background:#f3f8fd}.current-request-label{font-size:11px;font-weight:800;color:#334155;margin-bottom:4px}.current-request-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.current-request-text{font-size:12px;color:#334155;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.current-request-status,.request-status-badge{flex:0 0 auto;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;border:1px solid #cbd5e1}.current-request-status.active,.request-status-badge.active{background:#e8f7ee;color:#237a49;border-color:#bce3cb}.current-request-status.completed,.request-status-badge.completed{background:#eef1f4;color:#65717e;border-color:#d5dce3}.current-request-extra{font-size:10px;color:#7b8794;margin-top:4px}.request-status-controls{display:flex;align-items:center;gap:7px;margin:7px 0 10px;flex-wrap:wrap}.request-status-controls .tk-btn{padding:6px 10px!important;font-size:11px!important;min-height:30px!important}.request-current-btn{background:linear-gradient(#5482ef,#315bd8)!important;color:#fff!important}.request-current-btn:disabled{opacity:.65;cursor:default}.request-resume-btn{background:linear-gradient(#5482ef,#315bd8)!important;color:#fff!important}.request-finish-btn{margin-left:auto;background:linear-gradient(#53aa77,#2d8f59)!important;color:#fff!important}@media(max-width:640px){.current-request-row{align-items:flex-start}.current-request-text{white-space:normal}.request-finish-btn{margin-left:0}}
  `;document.head.appendChild(style);

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;if(oldSetLanguage&&!oldSetLanguage.__requestCyclePatched2){const wrapped=function(l){const v=oldSetLanguage.call(this,l);setTimeout(renderAll,0);return v;};wrapped.__requestCyclePatched2=true;window.DiagnostikaI18n.setLanguage=wrapped;}

  window.DiagnostikaRequests={current:currentRequest,setCurrent,ensureClient,requestNumber,statusLabel,refresh:renderAll};
  renderAll();
})();