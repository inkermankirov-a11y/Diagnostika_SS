'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.calendar)return;

  const EVENTS=Object.freeze({
    created:'calendar:event-created',
    updated:'calendar:event-updated',
    deleted:'calendar:event-deleted',
    replaced:'calendar:events-replaced'
  });

  const now=()=>new Date().toISOString();

  function clone(value){
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  }

  function stateRef(){
    try{return platform.store?.state?.()||null;}catch(_){return null;}
  }

  function eventsRef({create=false}={}){
    const st=stateRef();
    if(!st)return null;
    if(Array.isArray(st.calendarEvents))return st.calendarEvents;
    if(!create)return [];
    st.calendarEvents=[];
    return st.calendarEvents;
  }

  function makeId(){
    try{if(typeof uid==='function')return uid();}catch(_){}
    try{if(crypto?.randomUUID)return crypto.randomUUID();}catch(_){}
    return 'calendar_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  }

  function persist(){
    try{return platform.store?.legacySave?.()===true;}catch(error){
      console.error('[DiagnostikaPlatform] calendar persistence failed',error);
      return false;
    }
  }

  function emit(type,detail={}){
    if(!platform.events?.emit)return 0;
    return platform.events.emit(type,Object.freeze({
      ...detail,
      source:detail.source||'calendar-service',
      emittedAt:detail.emittedAt||now()
    }));
  }

  function matches(event,filter={}){
    if(!event)return false;
    if(filter.date!==undefined&&String(event.date||'')!==String(filter.date||''))return false;
    if(filter.clientId!==undefined&&String(event.clientId||'')!==String(filter.clientId||''))return false;
    if(filter.requestId!==undefined&&String(event.requestId||'')!==String(filter.requestId||''))return false;
    if(filter.type!==undefined&&String(event.type||'')!==String(filter.type||''))return false;
    return true;
  }

  function list(filter={}){
    const rows=eventsRef()||[];
    return clone(rows.filter(e=>matches(e,filter)))||[];
  }

  function get(id){
    if(id===undefined||id===null||id==='')return null;
    const rows=eventsRef()||[];
    return clone(rows.find(e=>e&&String(e.id)===String(id))||null);
  }

  function forDate(date,filter={}){
    return list({...filter,date});
  }

  function forClient(clientRef,filter={}){
    const id=clientRef&&typeof clientRef==='object'?clientRef.id:clientRef;
    if(id===undefined||id===null||id==='')return [];
    return list({...filter,clientId:id});
  }

  function create(data={},options={}){
    if(!data||typeof data!=='object')return null;
    const st=stateRef();
    if(!st)return null;
    const hadEvents=Array.isArray(st.calendarEvents);
    const rows=hadEvents?st.calendarEvents:(st.calendarEvents=[]);

    const created={...clone(data)};
    created.id=created.id||makeId();
    if(rows.some(e=>e&&String(e.id)===String(created.id)))return null;
    if(!created.createdAt)created.createdAt=now();
    if(!created.updatedAt)created.updatedAt=created.createdAt;

    rows.push(created);
    if(!persist()){
      rows.pop();
      if(!hadEvents)delete st.calendarEvents;
      return null;
    }

    emit(EVENTS.created,{
      eventId:created.id,
      clientId:created.clientId||null,
      requestId:created.requestId||null,
      source:options.source||'calendar-service-create'
    });
    return clone(created);
  }

  function update(id,changes={},options={}){
    if(id===undefined||id===null||id===''||!changes||typeof changes!=='object')return null;
    const rows=eventsRef()||[];
    const index=rows.findIndex(e=>e&&String(e.id)===String(id));
    if(index<0)return null;

    const target=rows[index];
    const before=clone(target)||{};
    const patch=clone(changes)||{};
    delete patch.id;
    Object.assign(target,patch);
    if(options.touch!==false&&!Object.prototype.hasOwnProperty.call(patch,'updatedAt'))target.updatedAt=now();

    if(!persist()){
      rows[index]=before;
      return null;
    }

    emit(EVENTS.updated,{
      eventId:target.id,
      clientId:target.clientId||null,
      requestId:target.requestId||null,
      fields:Object.keys(patch),
      source:options.source||'calendar-service-update'
    });
    return clone(target);
  }

  function remove(id,options={}){
    if(id===undefined||id===null||id==='')return null;
    const rows=eventsRef()||[];
    const index=rows.findIndex(e=>e&&String(e.id)===String(id));
    if(index<0)return null;

    const [removed]=rows.splice(index,1);
    if(!persist()){
      rows.splice(index,0,removed);
      return null;
    }

    emit(EVENTS.deleted,{
      eventId:removed.id,
      clientId:removed.clientId||null,
      requestId:removed.requestId||null,
      source:options.source||'calendar-service-delete'
    });
    return clone(removed);
  }

  function replace(items=[],options={}){
    if(!Array.isArray(items))return null;
    const st=stateRef();
    if(!st)return null;

    const hadEvents=Array.isArray(st.calendarEvents);
    const before=clone(hadEvents?st.calendarEvents:[])||[];
    const next=clone(items)||[];
    const ids=new Set();
    for(const item of next){
      if(!item||typeof item!=='object')return null;
      item.id=item.id||makeId();
      const key=String(item.id);
      if(ids.has(key))return null;
      ids.add(key);
      if(!item.createdAt)item.createdAt=now();
      if(!item.updatedAt)item.updatedAt=item.createdAt;
    }

    st.calendarEvents=next;
    if(!persist()){
      if(hadEvents)st.calendarEvents=before;
      else delete st.calendarEvents;
      return null;
    }

    emit(EVENTS.replaced,{
      count:next.length,
      source:options.source||'calendar-service-replace'
    });
    return clone(next);
  }

  services.calendar=Object.freeze({
    events:EVENTS,
    list,
    get,
    forDate,
    forClient,
    create,
    update,
    remove,
    replace
  });
})();