'use strict';

(() => {
  if (window.DiagnostikaCalendarSessionPlanning) return;

  const overlay=document.getElementById('diagnostikaCalendarOverlay');
  if(!overlay) return;

  const clientSelect=overlay.querySelector('.cal-client');
  const typeSelect=overlay.querySelector('.cal-type');
  const noteInput=overlay.querySelector('.cal-note');
  const saveButton=overlay.querySelector('.cal-save');
  if(!clientSelect||!typeSelect||!noteInput||!saveButton) return;

  const style=document.createElement('style');
  style.textContent=`
    .cal-session-preview{grid-column:1/-1;border:1px solid #cfe0f4;border-radius:8px;background:#f3f8ff;padding:8px 10px;font-size:11px;font-weight:800;color:#285a91;line-height:1.35}
    .cal-session-preview[hidden]{display:none!important}
  `;
  document.head.appendChild(style);

  const preview=document.createElement('div');
  preview.className='cal-session-preview';
  preview.hidden=true;
  const typeLabel=typeSelect.closest('label');
  if(typeLabel) typeLabel.insertAdjacentElement('afterend',preview);

  function getState(){try{return typeof state!=='undefined'?state:null;}catch(_){return null;}}
  function clients(){const st=getState();return Array.isArray(st?.clients)?st.clients:[];}
  function calendarApi(){
    const facade=window.DiagnostikaCalendar;
    if(facade?.moduleAware===true)return facade;
    return window.DiagnostikaPlatform?.services?.calendar||null;
  }
  function sessionsApi(){
    const facade=window.DiagnostikaSessions;
    if(facade?.moduleAware===true)return facade;
    return window.DiagnostikaPlatform?.services?.sessions||null;
  }
  function requestsApi(){
    const facade=window.DiagnostikaRequests;
    if(facade?.moduleAware===true)return facade;
    return window.DiagnostikaPlatform?.services?.requests||null;
  }
  function events(){
    const api=calendarApi();
    try{return api?.list?api.list():[];}catch(_){return[];}
  }

  function activeRequest(c){
    const requests=Array.isArray(c?.requests)?c.requests:[];
    if(!requests.length)return null;

    try{
      const fromModule=requestsApi()?.current?.(c);
      if(fromModule&&requests.some(r=>String(r.id)===String(fromModule.id)))return fromModule;
    }catch(_){}

    return requests.find(r=>String(r.id)===String(c.currentRequestId||''))
      ||requests.find(r=>String(r.id)===String(c.activeRequestId||''))
      ||requests[requests.length-1]
      ||requests[0]
      ||null;
  }

  function requestById(c,id){
    if(!c||id===undefined||id===null||id==='')return null;
    try{
      const fromModule=requestsApi()?.get?.(id,c);
      if(fromModule)return fromModule;
    }catch(_){}
    return (c?.requests||[]).find(r=>String(r.id)===String(id))||null;
  }

  function actualSessionsFor(c,r){
    if(!c||!r)return[];
    try{
      const rows=sessionsApi()?.forRequest?.(r.id,c);
      return Array.isArray(rows)?rows:[];
    }catch(_){return[];}
  }

  function isSessionEvent(e){return String(e?.type||'').trim()==='Сессия'||/^Сессия №\d+$/i.test(String(e?.title||'').trim());}

  function requestForEvent(c,e){
    return requestById(c,e?.requestId)||activeRequest(c);
  }

  function plannedSessionsFor(c,r){
    if(!c||!r)return[];
    return events().filter(e=>String(e?.clientId||'')===String(c.id)&&isSessionEvent(e)&&String((e?.requestId||requestForEvent(c,e)?.id)||'')===String(r.id));
  }

  function nextSessionNumber(c,r){
    if(!c||!r)return 1;
    return actualSessionsFor(c,r).length+plannedSessionsFor(c,r).length+1;
  }

  function requestComment(r){return r?.title?`Запрос: ${String(r.title).trim()}`:'';}

  function ensureCommentForRequest(r){
    const text=requestComment(r);
    const previous=noteInput.dataset.autoRequestText||'';
    const current=noteInput.value.trim();
    if(!text){
      if(previous&&current===previous)noteInput.value='';
      noteInput.dataset.autoRequestText='';
      return;
    }
    if(!current||current===previous){
      noteInput.value=text;
      noteInput.dataset.autoRequestText=text;
    }
  }

  function updateForm(){
    const sessionMode=typeSelect.value==='Сессия';
    const c=clients().find(x=>String(x.id)===String(clientSelect.value||''));
    const r=c?activeRequest(c):null;
    const sessionOption=[...typeSelect.options].find(o=>o.value==='Сессия'||o.dataset.sessionOption==='1');

    if(sessionOption){
      sessionOption.dataset.sessionOption='1';
      sessionOption.value='Сессия';
    }

    if(!sessionMode||!c){
      preview.hidden=true;
      if(sessionOption)sessionOption.textContent='Сессия';
      const previous=noteInput.dataset.autoRequestText||'';
      if(previous&&noteInput.value.trim()===previous)noteInput.value='';
      noteInput.dataset.autoRequestText='';
      return;
    }

    const n=nextSessionNumber(c,r);
    if(sessionOption)sessionOption.textContent=`Сессия №${n}`;
    preview.hidden=false;
    preview.textContent=r
      ?`Будет запланирована: Сессия №${n} • ${r.title||'Запрос без названия'}`
      :`Будет запланирована: Сессия №${n} • у клиента не выбран текущий запрос`;
    ensureCommentForRequest(r);
  }

  function normalizePlannedSessions(){
    const api=calendarApi();
    if(!api?.list||!api?.update)return false;

    let changed=false;
    clients().forEach(c=>{
      const sessionEvents=api.list({clientId:c.id}).filter(isSessionEvent);
      const groups=new Map();
      sessionEvents.forEach(e=>{
        const r=requestForEvent(c,e);
        if(!r)return;
        const key=String(r.id);
        if(!groups.has(key))groups.set(key,{r,items:[]});
        groups.get(key).items.push(e);
      });

      groups.forEach(({r,items})=>{
        items.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.time||'').localeCompare(String(b.time||''))||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
        let number=actualSessionsFor(c,r).length+1;
        items.forEach(e=>{
          const title=`Сессия №${number}`;
          const reqText=requestComment(r);
          const patch={};

          if(e.sessionNumber!==number)patch.sessionNumber=number;
          if(String(e.title||'')!==title)patch.title=title;
          if(String(e.type||'')!=='Сессия')patch.type='Сессия';
          if(String(e.requestId||'')!==String(r.id))patch.requestId=r.id;
          if(String(e.requestTitle||'')!==String(r.title||''))patch.requestTitle=r.title||'';

          const old=String(e.note||'').trim();
          if(reqText&&!old)patch.note=reqText;
          else if(reqText&&old&&!old.includes(String(r.title||'').trim()))patch.note=`${reqText}\n${old}`;

          if(Object.keys(patch).length){
            const updated=api.update(e.id,patch,{source:'calendar-session-linkage'});
            if(updated)changed=true;
          }
          number++;
        });
      });
    });
    return changed;
  }

  clientSelect.addEventListener('change',updateForm);
  typeSelect.addEventListener('change',updateForm);
  overlay.addEventListener('close',()=>{noteInput.dataset.autoRequestText='';});

  function refreshLinkage(){
    const changed=normalizePlannedSessions();
    if(changed)window.DiagnostikaCalendar?.refresh?.();
    updateForm();
    return changed;
  }

  saveButton.addEventListener('click',()=>{
    const wasSession=typeSelect.value==='Сессия';
    if(!wasSession)return;
    setTimeout(refreshLinkage,0);
  });

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#ccCalendarBtn,.cal-day,.cal-prev,.cal-next,.cal-today'))setTimeout(refreshLinkage,0);
  },true);

  const bus=window.DiagnostikaPlatform?.events;
  ['calendar:ready','sessions:ready','session:created','session:updated','session:deleted'].forEach(type=>{
    bus?.on?.(type,()=>setTimeout(refreshLinkage,0));
  });

  setTimeout(refreshLinkage,0);

  window.DiagnostikaCalendarSessionPlanning=Object.freeze({
    version:'8C',
    moduleAware:true,
    refresh:refreshLinkage,
    nextSessionNumber,
    activeRequest
  });
})();
