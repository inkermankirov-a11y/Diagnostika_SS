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
  const REQUEST_EVENTS=['request:created','request:selected','request:updated','request:activated','request:completed','request:resumed','request:deleted'];
  let started=false;

  function lang(){const l=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';return PREFIX[l]?l:'en';}
  function tx(k){return TEXT[lang()][k]||TEXT.en[k]||k;}
  function platform(){return window.DiagnostikaPlatform||null;}
  function requestsApi(){
    if(window.DiagnostikaRequests?.moduleAware===true)return window.DiagnostikaRequests;
    return platform()?.services?.requests||null;
  }
  function cclient(){return window.DiagnostikaClients?.current?.()||(typeof client==='function'?client():null);}
  function list(c=cclient()){return requestsApi()?.list?.(c)||[];}
  function reqById(c,id){return requestsApi()?.get?.(id,c)||null;}
  function viewed(c=cclient()){return requestsApi()?.viewed?.(c)||null;}
  function viewedId(c=cclient()){return requestsApi()?.viewedId?.(c)||null;}
  function activeId(c=cclient()){return requestsApi()?.activeId?.(c)||null;}
  function statusOf(r){return r?.status==='completed'?'completed':'active';}
  function dateText(raw){if(!raw)return'';const d=new Date(raw);if(Number.isNaN(d.getTime()))return'';return d.toLocaleDateString(lang()==='ru'?'ru-RU':lang()==='de'?'de-DE':lang()==='fr'?'fr-FR':lang()==='it'?'it-IT':'en-GB');}

  function ensureInitialAuthority(){
    const api=requestsApi(),c=cclient();
    if(!api||!c||api.activeId(c))return;
    const currentView=api.viewed?.(c)||null;
    const first=(currentView&&statusOf(currentView)==='active')
      ? currentView
      : api.list(c).find(r=>statusOf(r)==='active')||null;
    if(!first)return;

    let previousSituationId=null;
    let previousSelected=null;
    let preserveDiagnosisContext=false;
    try{
      preserveDiagnosisContext=typeof mode!=='undefined'
        && mode==='diagnosis'
        && String(api.viewedId?.(c)??'')===String(first.id);
      if(preserveDiagnosisContext){
        previousSituationId=typeof situationId!=='undefined'?situationId:null;
        previousSelected=typeof selected!=='undefined'?selected:null;
      }
    }catch(_){}

    const activated=api.activate(first.id,{client:c,source:'request-ui-bootstrap',render:false});
    if(activated&&preserveDiagnosisContext){
      try{
        situationId=previousSituationId;
        selected=previousSelected;
      }catch(_){}
    }
  }

  function requestNumber(c,r){
    const value=requestsApi()?.requestNumber?.(c,r);
    return Number.isFinite(value)?value:0;
  }

  function statusLabel(r){return tx(statusOf(r));}

  function relabel(){
    const api=requestsApi(),c=cclient(),select=document.querySelector('#requestSelect');
    if(!api||!select)return;
    const rows=api.list(c);
    [...select.options].forEach((option,index)=>{
      const r=api.get(option.value,c)||rows[index]||null;
      const d=dateText(r?.createdAt||r?.createdDate||r?.date);
      const number=r?requestNumber(c,r):(index+1);
      const label=`${PREFIX[lang()]} ${number||index+1}${d?' · '+d:''}`;
      if(option.textContent!==label)option.textContent=label;
    });
    const id=api.viewedId(c);
    if(id&&[...select.options].some(o=>String(o.value)===String(id)))select.value=id;
  }

  function ensureStatusControls(){
    const toolbar=document.querySelector('.query-toolbar');
    if(!toolbar)return null;
    let row=document.querySelector('#requestStatusControls');
    if(row)return row;
    row=document.createElement('div');
    row.id='requestStatusControls';
    row.className='request-status-controls';
    row.innerHTML='<span class="request-status-badge"></span><button type="button" class="tk-btn request-current-btn"></button><button type="button" class="tk-btn request-resume-btn"></button><button type="button" class="tk-btn request-finish-btn"></button>';
    toolbar.insertAdjacentElement('afterend',row);

    row.querySelector('.request-current-btn').onclick=()=>{
      const api=requestsApi(),r=viewed();
      if(!api||!r||statusOf(r)==='completed')return;
      api.activate(r.id,{source:'request-ui-activate'});
    };
    row.querySelector('.request-resume-btn').onclick=()=>{
      const api=requestsApi(),r=viewed();
      if(!api||!r)return;
      api.resume(r.id,{source:'request-ui-resume'});
    };
    row.querySelector('.request-finish-btn').onclick=()=>{
      const api=requestsApi(),r=viewed();
      if(!api||!r)return;
      api.complete(r.id,{source:'request-ui-complete'});
    };
    return row;
  }

  function renderStatusControls(){
    const row=ensureStatusControls(),c=cclient(),r=viewed(c);
    if(!row)return;
    if(!r){row.style.display='none';return;}
    row.style.display='flex';
    const badge=row.querySelector('.request-status-badge');
    const currentBtn=row.querySelector('.request-current-btn');
    const resumeBtn=row.querySelector('.request-resume-btn');
    const finishBtn=row.querySelector('.request-finish-btn');
    const status=statusOf(r);
    badge.textContent=statusLabel(r);
    badge.className='request-status-badge '+status;
    const completed=status==='completed';
    const isCurrent=String(activeId(c)??'')===String(r.id);
    currentBtn.style.display=completed?'none':'';
    currentBtn.textContent=isCurrent?tx('currentMark'):tx('makeCurrent');
    currentBtn.disabled=isCurrent;
    resumeBtn.style.display=completed?'':'none';
    resumeBtn.textContent=tx('resume');
    finishBtn.style.display=completed?'none':'';
    finishBtn.textContent=tx('finish');
  }

  function renderAll(options={}){
    ensureInitialAuthority();
    relabel();
    renderStatusControls();
    try{window.DiagnostikaRequestTitleDisplay?.refresh?.();}catch(_){}
    if(options.payment!==false){try{window.DiagnostikaPayments?.refresh?.();}catch(_){}}
  }

  function bindLegacyUi(){
    const select=document.querySelector('#requestSelect');
    if(select){
      select.onchange=e=>{
        const api=requestsApi();
        if(!api)return;
        api.view(e.target.value,{source:'request-ui-view'});
      };
    }

    const addRequest=document.querySelector('#addRequestBtn');
    if(addRequest)addRequest.onclick=()=>{
      requestsApi()?.create?.({title:'Новый запрос'},{source:'request-ui-create'});
    };

    const deleteRequest=document.querySelector('#deleteRequestBtn');
    if(deleteRequest)deleteRequest.onclick=()=>{
      const api=requestsApi(),r=viewed();
      if(!api||!r)return;
      if(confirm('Удалить запрос?'))api.remove(r.id,{source:'request-ui-delete'});
    };

    const requestTitle=document.querySelector('#requestTitle');
    if(requestTitle)requestTitle.oninput=e=>{
      const api=requestsApi(),r=viewed();
      if(!api||!r)return;
      api.update(r.id,{title:e.target.value},{source:'request-ui-title-input'});
    };


  }

  function bindEvents(){
    const bus=platform()?.events;
    if(!bus?.on)return;
    for(const type of REQUEST_EVENTS)bus.on(type,()=>setTimeout(renderAll,0));
    for(const type of ['client:created','client:selected','client:updated','client:deleted','client:restored','client:purged']){
      bus.on(type,()=>setTimeout(renderAll,0));
    }
  }

  function bindLanguage(){
    const oldSetLanguage=window.DiagnostikaI18n?.setLanguage;
    if(!oldSetLanguage||oldSetLanguage.__requestUiPatched3B)return;
    const wrapped=function(l){
      const value=oldSetLanguage.call(this,l);
      setTimeout(renderAll,0);
      return value;
    };
    wrapped.__requestUiPatched3B=true;
    window.DiagnostikaI18n.setLanguage=wrapped;
  }

  function installStyle(){
    if(document.querySelector('style[data-request-ui-3c]'))return;
    const style=document.createElement('style');
    style.dataset.requestUi3c='1';
    style.textContent='.current-request-box{margin:8px 0 2px;padding:9px 10px;border:1px solid #cddbea;border-radius:8px;background:#f3f8fd}.current-request-label{font-size:11px;font-weight:800;color:#334155;margin-bottom:4px}.current-request-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.current-request-text{font-size:12px;color:#334155;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.current-request-status,.request-status-badge{flex:0 0 auto;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:800;border:1px solid #cbd5e1}.current-request-status.active,.request-status-badge.active{background:#e8f7ee;color:#237a49;border-color:#bce3cb}.current-request-status.completed,.request-status-badge.completed{background:#eef1f4;color:#65717e;border-color:#d5dce3}.current-request-extra{font-size:10px;color:#7b8794;margin-top:4px}.request-status-controls{display:flex;align-items:center;gap:7px;margin:7px 0 10px;flex-wrap:wrap}.request-status-controls .tk-btn{padding:6px 10px!important;font-size:11px!important;min-height:30px!important}.request-current-btn{background:linear-gradient(#5482ef,#315bd8)!important;color:#fff!important}.request-current-btn:disabled{opacity:.65;cursor:default}.request-resume-btn{background:linear-gradient(#5482ef,#315bd8)!important;color:#fff!important}.request-finish-btn{margin-left:auto;background:linear-gradient(#53aa77,#2d8f59)!important;color:#fff!important}@media(max-width:640px){.current-request-row{align-items:flex-start}.current-request-text{white-space:normal}.request-finish-btn{margin-left:0}}';
    document.head.appendChild(style);
  }

  function start(){
    if(started||!requestsApi())return;
    started=true;
    bindLegacyUi();
    bindEvents();
    bindLanguage();
    installStyle();
    window.DiagnostikaRequestsUI=Object.freeze({version:'3C',ready:true,refresh:renderAll});
    renderAll();
  }

  async function boot(){
    const p=platform();
    if(!p)return;
    try{await p.ready;}catch(_){}
    if(p.services?.requests){start();return;}
    if(!p.events?.on)return;
    let off=null;
    off=p.events.on('requests:ready',()=>{off?.();start();});
    if(p.services?.requests){off?.();start();}
  }

  boot().catch(error=>console.error('[DiagnostikaPlatform] Request UI 3B failed',error));
})();
