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

  const PLANNABLE_TYPES=new Set(['Сессия','Диагностика','Бесплатная консультация','Созвон','Другое']);

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

  function isPlannedSkeleton(s){
    return !!s&&(s.planned===true||String(s.status||'')==='planned')&&!!s.calendarEventId;
  }

  function actualSessionsFor(c,r){
    if(!c||!r)return[];
    try{
      const rows=sessionsApi()?.forRequest?.(r.id,c);
      return Array.isArray(rows)?rows.filter(s=>!isPlannedSkeleton(s)):[];
    }catch(_){return[];}
  }

  function isSessionEvent(e){return String(e?.type||'').trim()==='Сессия'||/^Сессия №\d+$/i.test(String(e?.title||'').trim());}
  function isPlannableType(value){return PLANNABLE_TYPES.has(String(value||'').trim());}
  function isPlannableEvent(e){
    if(!e?.clientId)return false;
    if(e.plannedSessionSkeleton!==true&&!e.sessionId)return false;
    if(isSessionEvent(e))return true;
    return isPlannableType(e?.type||e?.title);
  }

  function eventStartTime(e){
    const rawDate=String(e?.date||'').trim();
    if(!rawDate)return NaN;
    if(/^\d{4}-\d{2}-\d{2}$/.test(rawDate)){
      const [year,month,day]=rawDate.split('-').map(Number);
      const rawTime=String(e?.time||'').trim();
      const match=rawTime.match(/^(\d{1,2}):(\d{2})/);
      const hour=match?Number(match[1]):23;
      const minute=match?Number(match[2]):59;
      return new Date(year,month-1,day,hour,minute,59,999).getTime();
    }
    const parsed=Date.parse(rawDate);
    return Number.isFinite(parsed)?parsed:NaN;
  }

  function isFutureAppointment(e){
    const time=eventStartTime(e);
    return Number.isFinite(time)&&time>=Date.now();
  }

  function requestForEvent(c,e){
    return requestById(c,e?.requestId)||activeRequest(c);
  }

  function plannedSessionsFor(c,r){
    if(!c||!r)return[];
    return events().filter(e=>String(e?.clientId||'')===String(c.id)&&isPlannableEvent(e)&&isSessionEvent(e)&&String((e?.requestId||requestForEvent(c,e)?.id)||'')===String(r.id));
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
    const plannable=isPlannableType(typeSelect.value);
    const c=clients().find(x=>String(x.id)===String(clientSelect.value||''));
    const r=c?activeRequest(c):null;
    const sessionOption=[...typeSelect.options].find(o=>o.value==='Сессия'||o.dataset.sessionOption==='1');

    if(sessionOption){
      sessionOption.dataset.sessionOption='1';
      sessionOption.value='Сессия';
    }

    if(!plannable||!c){
      preview.hidden=true;
      if(sessionOption)sessionOption.textContent='Сессия';
      const previous=noteInput.dataset.autoRequestText||'';
      if(previous&&noteInput.value.trim()===previous)noteInput.value='';
      noteInput.dataset.autoRequestText='';
      return;
    }

    preview.hidden=false;
    if(sessionMode){
      const n=nextSessionNumber(c,r);
      if(sessionOption)sessionOption.textContent=`Сессия №${n}`;
      preview.textContent=r
        ?`Будет создана запланированная карточка: Сессия №${n} • ${r.title||'Запрос без названия'}`
        :`Будет создана запланированная карточка: Сессия №${n} • у клиента не выбран текущий запрос`;
    }else{
      if(sessionOption)sessionOption.textContent='Сессия';
      preview.textContent=r
        ?`Будет создана запланированная карточка: ${typeSelect.value} • ${r.title||'Запрос без названия'}`
        :`Будет создана запланированная карточка: ${typeSelect.value} • у клиента не выбран текущий запрос`;
    }
    ensureCommentForRequest(r);
  }

  function migrateExistingFutureAppointments(){
    const api=calendarApi();
    if(!api?.list||!api?.update)return false;

    let changed=false;
    const clientMap=new Map(clients().map(c=>[String(c?.id||''),c]));
    api.list().forEach(e=>{
      if(!e?.id||!e?.clientId||e.plannedSessionSkeleton===true||e.sessionId)return;
      if(!isFutureAppointment(e))return;
      if(!isSessionEvent(e)&&!isPlannableType(e?.type||e?.title))return;

      const c=clientMap.get(String(e.clientId));
      if(!c||!requestForEvent(c,e))return;

      const updated=api.update(e.id,{
        plannedSessionSkeleton:true,
        plannedSessionMigrated:true
      },{source:'calendar-planned-session-migrate-existing'});
      if(updated)changed=true;
    });
    return changed;
  }

  function normalizePlannedSessions(){
    const api=calendarApi();
    if(!api?.list||!api?.update)return false;

    let changed=false;
    clients().forEach(c=>{
      const sessionEvents=api.list({clientId:c.id}).filter(e=>isSessionEvent(e)&&(e.plannedSessionSkeleton===true||!!e.sessionId));
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

  function sessionForEvent(c,e){
    const api=sessionsApi();
    if(!api||!c||!e?.id)return null;
    if(e.sessionId){
      const byId=api.get?.(e.sessionId,c);
      if(byId)return byId;
    }
    const rows=api.list?.(c)||[];
    return rows.find(s=>String(s?.calendarEventId||'')===String(e.id))||null;
  }

  function syncPlannedSkeletons(){
    const cal=calendarApi();
    const sessions=sessionsApi();
    if(!cal?.list||!cal?.update||!sessions?.create||!sessions?.update||!sessions?.remove)return false;

    let changed=false;
    const allEvents=cal.list();
    const activeEventIds=new Set(allEvents.filter(isPlannableEvent).map(e=>String(e.id)));

    clients().forEach(c=>{
      const clientEvents=allEvents.filter(e=>String(e?.clientId||'')===String(c.id)&&isPlannableEvent(e));

      clientEvents.forEach(e=>{
        const r=requestForEvent(c,e);
        if(!r)return;
        const appointmentType=isSessionEvent(e)?'Сессия':String(e.type||e.title||'Запись');
        let session=sessionForEvent(c,e);

        if(!session){
          session=sessions.create({
            date:e.date||'',
            scheduledTime:e.time||'',
            requestId:r.id,
            notes:'',
            plan:'',
            status:'planned',
            planned:true,
            calendarEventId:e.id,
            appointmentType,
            calendarTitle:e.title||appointmentType
          },{
            client:c,
            requestId:r.id,
            source:'calendar-planned-session-create',
            render:false
          });
          if(session)changed=true;
        }else if(isPlannedSkeleton(session)){
          const patch={};
          if(String(session.date||'')!==String(e.date||''))patch.date=e.date||session.date;
          if(String(session.scheduledTime||'')!==String(e.time||''))patch.scheduledTime=e.time||'';
          if(String(session.requestId||'')!==String(r.id))patch.requestId=r.id;
          if(String(session.appointmentType||'')!==appointmentType)patch.appointmentType=appointmentType;
          if(String(session.calendarTitle||'')!==String(e.title||appointmentType))patch.calendarTitle=e.title||appointmentType;
          if(session.planned!==true)patch.planned=true;
          if(String(session.status||'')!=='planned')patch.status='planned';
          if(Object.keys(patch).length){
            session=sessions.update(session.id,patch,{client:c,source:'calendar-planned-session-sync',render:false})||session;
            changed=true;
          }
        }

        if(session){
          const eventPatch={};
          if(String(e.sessionId||'')!==String(session.id))eventPatch.sessionId=session.id;
          if(String(e.requestId||'')!==String(r.id))eventPatch.requestId=r.id;
          if(String(e.requestTitle||'')!==String(r.title||''))eventPatch.requestTitle=r.title||'';
          if(Object.keys(eventPatch).length){
            if(cal.update(e.id,eventPatch,{source:'calendar-planned-session-link'}))changed=true;
          }
        }
      });

      const sessionRows=sessions.list?.(c)||[];
      sessionRows.filter(isPlannedSkeleton).forEach(s=>{
        if(activeEventIds.has(String(s.calendarEventId)))return;
        if(sessions.remove(s.id,{client:c,source:'calendar-planned-session-orphan-remove',render:false}))changed=true;
      });
    });

    if(changed){
      try{sessions.refresh?.();}catch(_){}
    }
    return changed;
  }

  clientSelect.addEventListener('change',updateForm);
  typeSelect.addEventListener('change',updateForm);
  overlay.addEventListener('close',()=>{noteInput.dataset.autoRequestText='';});

  let syncing=false;
  function refreshLinkage(){
    if(syncing)return false;
    syncing=true;
    try{
      const migrated=migrateExistingFutureAppointments();
      const normalized=normalizePlannedSessions();
      const skeletons=syncPlannedSkeletons();
      if(migrated||normalized||skeletons)window.DiagnostikaCalendar?.refresh?.();
      updateForm();
      return migrated||normalized||skeletons;
    }finally{
      syncing=false;
    }
  }

  saveButton.addEventListener('click',()=>{
    if(!isPlannableType(typeSelect.value))return;
    setTimeout(refreshLinkage,0);
  });

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#ccCalendarBtn,.cal-day,.cal-prev,.cal-next,.cal-today'))setTimeout(refreshLinkage,0);
  },true);

  let serviceEventsBound=false;
  function bindServiceEvents(){
    if(serviceEventsBound)return true;
    const bus=window.DiagnostikaPlatform?.events;
    if(!bus?.on)return false;
    ['calendar:ready','sessions:ready','session:created','session:updated','session:deleted',
      'calendar:event-created','calendar:event-updated','calendar:event-deleted','calendar:events-replaced'].forEach(type=>{
      bus.on(type,()=>setTimeout(refreshLinkage,0));
    });
    serviceEventsBound=true;
    return true;
  }

  bindServiceEvents();
  Promise.resolve(window.DiagnostikaPlatform?.ready).then(()=>{
    bindServiceEvents();
    setTimeout(refreshLinkage,0);
  }).catch(()=>{});
  setTimeout(refreshLinkage,0);

  window.DiagnostikaCalendarSessionPlanning=Object.freeze({
    version:'8F',
    moduleAware:true,
    refresh:refreshLinkage,
    nextSessionNumber,
    activeRequest
  });
})();
