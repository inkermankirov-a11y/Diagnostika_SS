'use strict';

(() => {
  const PREFIX={ru:'Запрос',en:'Request',fr:'Demande',de:'Anliegen',it:'Richiesta'};
  const STATUS_TEXT={
    ru:{active:'В работе',paused:'На паузе',completed:'Завершён',resumed:'Возобновлён',current:'ТЕКУЩИЙ ЗАПРОС',none:'Нет текущего запроса',pause:'Пауза',finish:'Завершить запрос',resume:'Возобновить',continue:'Продолжить',other:'Других открытых запросов'},
    en:{active:'In progress',paused:'Paused',completed:'Completed',resumed:'Resumed',current:'CURRENT REQUEST',none:'No current request',pause:'Pause',finish:'Complete request',resume:'Resume',continue:'Continue',other:'Other open requests'},
    fr:{active:'En cours',paused:'En pause',completed:'Terminé',resumed:'Repris',current:'DEMANDE ACTUELLE',none:'Aucune demande actuelle',pause:'Pause',finish:'Terminer',resume:'Reprendre',continue:'Continuer',other:'Autres demandes ouvertes'},
    de:{active:'In Arbeit',paused:'Pausiert',completed:'Abgeschlossen',resumed:'Wiederaufgenommen',current:'AKTUELLES ANLIEGEN',none:'Kein aktuelles Anliegen',pause:'Pause',finish:'Abschließen',resume:'Wiederaufnehmen',continue:'Fortsetzen',other:'Weitere offene Anliegen'},
    it:{active:'In corso',paused:'In pausa',completed:'Completato',resumed:'Ripreso',current:'RICHIESTA ATTUALE',none:'Nessuna richiesta attuale',pause:'Pausa',finish:'Completa richiesta',resume:'Riprendi',continue:'Continua',other:'Altre richieste aperte'}
  };

  function currentLang(){const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';return PREFIX[l]?l:'en';}
  function tx(k){return STATUS_TEXT[currentLang()][k]||STATUS_TEXT.en[k]||k;}
  function cclient(){return typeof client==='function'?client():null;}
  function reqById(c,id){return c?.requests?.find(r=>r.id===id)||null;}
  function now(){return new Date().toISOString();}

  function ensureClient(c){
    if(!c||!Array.isArray(c.requests)) return null;
    c.requests.forEach((r,i)=>{
      if(!r.status) r.status=(i===c.requests.length-1?'active':'completed');
      if(!r.createdAt) r.createdAt=now();
    });
    if(c.currentRequestId && !reqById(c,c.currentRequestId)) c.currentRequestId=null;
    if(!c.currentRequestId && c.requests.length){
      const remembered=reqById(c,c.lastDiagnosisRequestId);
      const active=c.requests.find(r=>r.status==='active'||r.status==='resumed');
      const chosen=active||remembered||c.requests[c.requests.length-1];
      c.currentRequestId=chosen.id;
      if(chosen.status==='completed') chosen.status='resumed';
    }
    return reqById(c,c.currentRequestId);
  }

  function setCurrent(c,id,{resumeCompleted=true}={}){
    if(!c) return null;
    const target=reqById(c,id);if(!target)return null;
    const old=reqById(c,c.currentRequestId);
    if(old&&old.id!==target.id&&(old.status==='active'||old.status==='resumed')) old.status='paused';
    c.currentRequestId=target.id;
    if(target.status==='completed'&&resumeCompleted) target.status='resumed';
    else if(target.status==='paused') target.status='active';
    else if(!target.status) target.status='active';
    target.updatedAt=now();
    c.lastDiagnosisRequestId=target.id;
    if(typeof save==='function') save();
    return target;
  }

  function currentRequest(c=cclient()){return ensureClient(c);}
  function requestNumber(c,r){const i=c?.requests?.indexOf(r)??-1;return i>=0?i+1:0;}
  function statusLabel(r){return tx(r?.status||'active');}
  function openCount(c){return (c?.requests||[]).filter(r=>r.id!==c.currentRequestId&&r.status!=='completed').length;}

  function relabel(){
    const c=cclient(),select=document.querySelector('#requestSelect');if(!select)return;
    const prefix=PREFIX[currentLang()];
    [...select.options].forEach((option,index)=>{option.textContent=`${prefix} ${index+1}`;});
    if(c?.currentRequestId&&[...select.options].some(o=>o.value===c.currentRequestId)&&mode==='diagnosis'){
      select.value=requestId||c.currentRequestId;
    }
  }

  function ensureCurrentBox(){
    const card=document.querySelector('.client-card');if(!card||card.querySelector('#currentRequestBox'))return;
    const box=document.createElement('div');box.id='currentRequestBox';box.className='current-request-box';
    box.innerHTML='<div class="current-request-label"></div><div class="current-request-row"><div class="current-request-text"></div><span class="current-request-status"></span></div><div class="current-request-extra"></div>';
    const pay=card.querySelector('#clientPaymentBox');const work=card.querySelector('.client-work');
    if(pay) pay.insertAdjacentElement('beforebegin',box); else if(work) work.insertAdjacentElement('beforebegin',box); else card.appendChild(box);
  }

  function renderCurrentBox(){
    ensureCurrentBox();const c=cclient(),box=document.querySelector('#currentRequestBox');if(!box||!c)return;
    const r=currentRequest(c),label=box.querySelector('.current-request-label'),text=box.querySelector('.current-request-text'),badge=box.querySelector('.current-request-status'),extra=box.querySelector('.current-request-extra');
    label.textContent=tx('current');
    if(!r){text.textContent=tx('none');badge.textContent='';badge.className='current-request-status';extra.textContent='';return;}
    const n=requestNumber(c,r);text.textContent=`${PREFIX[currentLang()]} ${n}: ${r.title||'—'}`;
    badge.textContent=statusLabel(r);badge.className=`current-request-status ${r.status||'active'}`;
    const nOpen=openCount(c);extra.textContent=nOpen?`${tx('other')}: ${nOpen}`:'';
  }

  function ensureStatusControls(){
    const toolbar=document.querySelector('.query-toolbar');if(!toolbar||document.querySelector('#requestStatusControls'))return;
    const row=document.createElement('div');row.id='requestStatusControls';row.className='request-status-controls';
    row.innerHTML='<span class="request-status-badge"></span><button type="button" class="tk-btn request-pause-btn"></button><button type="button" class="tk-btn request-finish-btn"></button>';
    toolbar.insertAdjacentElement('afterend',row);
    row.querySelector('.request-pause-btn').onclick=()=>{
      const c=cclient(),r=reqById(c,requestId);if(!c||!r)return;
      if(r.status==='completed'){setCurrent(c,r.id,{resumeCompleted:true});}
      else if(r.status==='paused'){setCurrent(c,r.id,{resumeCompleted:false});}
      else{r.status='paused';r.updatedAt=now();c.currentRequestId=r.id;save();}
      renderAll();
    };
    row.querySelector('.request-finish-btn').onclick=()=>{
      const c=cclient(),r=reqById(c,requestId);if(!c||!r)return;
      r.status='completed';r.completedAt=now();r.updatedAt=r.completedAt;
      if(c.currentRequestId===r.id)c.currentRequestId=null;
      save();renderAll();
    };
  }

  function renderStatusControls(){
    ensureStatusControls();const row=document.querySelector('#requestStatusControls'),c=cclient(),r=reqById(c,requestId);if(!row)return;
    if(!r){row.style.display='none';return;}row.style.display='flex';
    const badge=row.querySelector('.request-status-badge'),pause=row.querySelector('.request-pause-btn'),finish=row.querySelector('.request-finish-btn');
    badge.textContent=statusLabel(r);badge.className=`request-status-badge ${r.status||'active'}`;
    pause.textContent=r.status==='completed'?tx('resume'):r.status==='paused'?tx('continue'):tx('pause');
    finish.textContent=tx('finish');finish.style.display=r.status==='completed'?'none':'';
  }

  function renderAll(){relabel();renderCurrentBox();renderStatusControls();if(window.DiagnostikaPayments?.refresh)window.DiagnostikaPayments.refresh();}

  // Existing clients migration.
  (state.clients||[]).forEach(ensureClient);if(typeof save==='function')save();

  const oldRenderClient=window.renderClient;
  if(typeof oldRenderClient==='function')window.renderClient=function(){const v=oldRenderClient.apply(this,arguments);setTimeout(renderAll,0);return v;};
  const oldRenderRequests=window.renderRequests;
  if(typeof oldRenderRequests==='function')window.renderRequests=function(){const v=oldRenderRequests.apply(this,arguments);setTimeout(renderAll,0);return v;};

  const select=document.querySelector('#requestSelect');
  if(select){
    select.onchange=e=>{
      const c=cclient();if(!c)return;
      requestId=e.target.value;situationId=null;selected=null;
      setCurrent(c,requestId,{resumeCompleted:true});
      if(typeof renderRequests==='function')renderRequests();
    };
    new MutationObserver(()=>relabel()).observe(select,{childList:true});
  }

  const addRequest=document.querySelector('#addRequestBtn');
  if(addRequest)addRequest.onclick=()=>{
    const c=cclient();if(!c)return;const old=currentRequest(c);if(old&&(old.status==='active'||old.status==='resumed'))old.status='paused';
    const r=newRequest();r.title='Новый запрос';r.status='active';r.createdAt=now();r.updatedAt=r.createdAt;c.requests.push(r);c.currentRequestId=r.id;c.lastDiagnosisRequestId=r.id;requestId=r.id;situationId=null;selected=null;save();renderRequests();
  };

  const diagNew=document.querySelector('#diagNewBtn');
  if(diagNew)diagNew.onclick=()=>{
    const c=cclient();if(!c)return;const old=currentRequest(c);if(old&&(old.status==='active'||old.status==='resumed'))old.status='paused';
    const r=newRequest();r.title='Новый запрос';r.status='active';r.createdAt=now();r.updatedAt=r.createdAt;c.requests.push(r);c.currentRequestId=r.id;c.lastDiagnosisRequestId=r.id;requestId=r.id;situationId=null;selected=null;mode='diagnosis';save();renderRequests();renderMode();document.querySelector('#diagnosisLaunchDialog')?.close();
  };

  const diagnosisBtn=document.querySelector('#diagnosisModeBtn');
  if(diagnosisBtn)diagnosisBtn.onclick=()=>{
    const c=cclient();if(!c)return alert('Сначала выбери клиента.');
    if(mode==='diagnosis'){document.querySelector('#diagnosisLaunchDialog')?.showModal();return;}
    const r=currentRequest(c);
    if(r){requestId=r.id;situationId=r.situations?.[0]?.id||null;selected=null;mode='diagnosis';c.lastDiagnosisRequestId=r.id;save();renderRequests();renderMode();}
    else document.querySelector('#diagnosisLaunchDialog')?.showModal();
  };

  const addSession=document.querySelector('#addSessionBtn');
  if(addSession)addSession.onclick=()=>{
    const c=cclient();if(!c)return;const r=currentRequest(c);const active=r&&(r.status==='active'||r.status==='resumed')?r:null;
    c.sessions.push({id:uid(),date:today(),requestId:active?.id||'',notes:''});save();renderSessions();
  };

  // If an older request is opened from history, it becomes the current work focus.
  const historyOpen=document.querySelector('#requestOpenBtn');
  if(historyOpen){
    historyOpen.addEventListener('click',()=>setTimeout(()=>{const c=cclient();if(c&&requestId)setCurrent(c,requestId,{resumeCompleted:true});renderAll();},0));
  }

  const style=document.createElement('style');style.textContent=`
    .current-request-box{margin:8px 0 2px;padding:9px 10px;border:1px solid #cddbea;border-radius:8px;background:#f3f8fd}.current-request-label{font-size:11px;font-weight:800;color:#334155;margin-bottom:4px}.current-request-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.current-request-text{font-size:12px;color:#334155;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.current-request-status,.request-status-badge{flex:0 0 auto;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;border:1px solid #cbd5e1;background:#eef2f7;color:#475569}.current-request-status.active,.request-status-badge.active{background:#e8f7ee;color:#237a49;border-color:#bce3cb}.current-request-status.resumed,.request-status-badge.resumed{background:#eaf2ff;color:#315fa8;border-color:#c8d8f2}.current-request-status.paused,.request-status-badge.paused{background:#fff5d9;color:#8b6705;border-color:#ead895}.current-request-status.completed,.request-status-badge.completed{background:#eef1f4;color:#65717e;border-color:#d5dce3}.current-request-extra{font-size:10px;color:#7b8794;margin-top:4px}.request-status-controls{display:flex;align-items:center;gap:7px;margin:7px 0 10px}.request-status-controls .tk-btn{padding:6px 10px!important;font-size:11px!important;min-height:30px!important}.request-finish-btn{margin-left:auto;background:linear-gradient(#53aa77,#2d8f59)!important;color:#fff!important}@media(max-width:640px){.current-request-row{align-items:flex-start}.current-request-text{white-space:normal}.request-status-controls{flex-wrap:wrap}.request-finish-btn{margin-left:0}}
  `;document.head.appendChild(style);

  const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
  if(oldSetLanguage&&!oldSetLanguage.__requestCyclePatched){const wrapped=function(l){const v=oldSetLanguage.call(this,l);setTimeout(renderAll,0);return v;};wrapped.__requestCyclePatched=true;window.DiagnostikaI18n.setLanguage=wrapped;}

  window.DiagnostikaRequests={current:currentRequest,setCurrent,ensureClient,requestNumber,statusLabel,refresh:renderAll};
  renderAll();
})();