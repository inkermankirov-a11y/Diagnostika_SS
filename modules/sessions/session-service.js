'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.sessions)return;

  const EVENTS=Object.freeze({
    created:'session:created',
    updated:'session:updated',
    deleted:'session:deleted'
  });

  const now=()=>new Date().toISOString();

  function clientsService(){
    return platform.services?.clients||window.DiagnostikaClients||null;
  }

  function requestsService(){
    return platform.services?.requests
      || (window.DiagnostikaRequests?.moduleAware===true?window.DiagnostikaRequests:null)
      || null;
  }

  function resolveClient(clientRef){
    if(clientRef&&typeof clientRef==='object')return clientRef;
    if(clientRef!==undefined&&clientRef!==null&&clientRef!==''){
      const viaService=clientsService()?.findById?.(clientRef);
      if(viaService)return viaService;
      try{
        const rows=platform.store?.clients?.()||[];
        return rows.find(c=>c&&String(c.id)===String(clientRef))||null;
      }catch(_){return null;}
    }
    const current=clientsService()?.current?.();
    if(current)return current;
    try{return platform.store?.currentClient?.()||null;}catch(_){}
    try{return typeof client==='function'?client():null;}catch(_){return null;}
  }

  function list(clientRef){
    const c=resolveClient(clientRef);
    return Array.isArray(c?.sessions)?c.sessions:[];
  }

  function get(id,clientRef){
    if(id===undefined||id===null||id==='')return null;
    return list(clientRef).find(s=>s&&String(s.id)===String(id))||null;
  }

  function requestId(sessionRef){
    if(!sessionRef)return null;
    const id=sessionRef.requestId||sessionRef.payment?.requestId||null;
    return id===undefined||id===null||id===''?null:id;
  }

  function resolveRequestId(value,c,{defaultActive=false}={}){
    let candidate=value;
    if(candidate&&typeof candidate==='object')candidate=candidate.id;
    if((candidate===undefined)&&defaultActive){
      candidate=requestsService()?.currentId?.(c)||null;
    }
    if(candidate===undefined||candidate===null||candidate==='')return null;
    const request=requestsService()?.get?.(candidate,c)
      || (Array.isArray(c?.requests)?c.requests.find(r=>r&&String(r.id)===String(candidate)):null);
    return request?.id||null;
  }

  function forRequest(requestRef,clientRef){
    const c=resolveClient(clientRef);
    if(!c)return [];
    const targetId=resolveRequestId(requestRef,c,{defaultActive:requestRef===undefined});
    if(targetId===null)return [];
    return list(c).filter(s=>String(requestId(s)??'')===String(targetId));
  }

  function sessionTime(session,index=0){
    const raw=session?.date||session?.createdAt||'';
    const t=raw?new Date(raw).getTime():NaN;
    return Number.isFinite(t)?t:index;
  }

  function sessionNumber(clientRef,sessionRef){
    const c=resolveClient(clientRef);
    const target=typeof sessionRef==='object'?sessionRef:get(sessionRef,c);
    if(!c||!target)return null;
    const chronological=list(c)
      .map((s,index)=>({s,index,time:sessionTime(s,index)}))
      .sort((a,b)=>a.time-b.time||a.index-b.index);
    const index=chronological.findIndex(item=>item.s===target||String(item.s?.id)===String(target.id));
    return index>=0?index+1:null;
  }

  function clone(value){
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  }

  function makeId(){
    try{if(typeof uid==='function')return uid();}catch(_){}
    try{if(crypto?.randomUUID)return crypto.randomUUID();}catch(_){}
    return 'session_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  }

  function todayValue(){
    try{if(typeof today==='function')return today();}catch(_){}
    const d=new Date();
    d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
    return d.toISOString().slice(0,10);
  }

  function freshSession(data={},c=null,options={}){
    const incoming=clone(data)||{};
    const hasRequest=Object.prototype.hasOwnProperty.call(incoming,'requestId')
      || Object.prototype.hasOwnProperty.call(options,'requestId');
    const rawRequest=Object.prototype.hasOwnProperty.call(options,'requestId')
      ? options.requestId
      : incoming.requestId;
    const linkedId=resolveRequestId(rawRequest,c,{defaultActive:!hasRequest});
    if(rawRequest!==undefined&&rawRequest!==null&&rawRequest!==''&&!linkedId)return null;

    const created={
      id:incoming.id||makeId(),
      date:incoming.date||todayValue(),
      requestId:linkedId,
      notes:'',
      ...incoming
    };
    created.requestId=linkedId;
    if(!created.createdAt)created.createdAt=now();
    if(!created.updatedAt)created.updatedAt=created.createdAt;
    return created;
  }

  function persist(){
    try{
      if(platform.store?.legacySave?.())return true;
    }catch(_){}
    try{if(typeof save==='function'){save();return true;}}catch(error){
      console.error('[DiagnostikaPlatform] session persistence failed',error);
    }
    return false;
  }


  function render(){
    try{if(typeof renderSessions==='function')renderSessions();}catch(error){
      console.error('[DiagnostikaPlatform] session render failed',error);
      return false;
    }
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
    return true;
  }

  function emit(type,detail={}){
    if(!platform.events?.emit)return 0;
    return platform.events.emit(type,Object.freeze({
      ...detail,
      source:detail.source||'session-service',
      emittedAt:detail.emittedAt||now()
    }));
  }

  function create(data={},options={}){
    const c=resolveClient(options.client??options.clientId);
    if(!c)return null;
    if(!Array.isArray(c.sessions))c.sessions=[];

    const created=freshSession(data,c,options);
    if(!created||get(created.id,c))return null;

    c.sessions.push(created);
    if(!persist()){
      c.sessions.pop();
      return null;
    }

    emit(EVENTS.created,{
      clientId:c.id,
      sessionId:created.id,
      requestId:requestId(created),
      source:options.source||'session-service-create'
    });
    if(options.render!==false)render();
    return created;
  }

  function update(id,changes={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target||!changes||typeof changes!=='object')return null;

    const before=clone(target)||{};
    const patch=clone(changes)||{};
    delete patch.id;

    if(Object.prototype.hasOwnProperty.call(patch,'requestId')){
      const raw=patch.requestId;
      const linked=resolveRequestId(raw,c);
      if(raw!==undefined&&raw!==null&&raw!==''&&!linked)return null;
      patch.requestId=linked;
    }

    Object.assign(target,patch);
    if(options.touch!==false&&!Object.prototype.hasOwnProperty.call(patch,'updatedAt'))target.updatedAt=now();

    if(!persist()){
      for(const key of Object.keys(target))delete target[key];
      Object.assign(target,before);
      return null;
    }

    emit(EVENTS.updated,{
      clientId:c.id,
      sessionId:target.id,
      requestId:requestId(target),
      fields:Object.keys(patch),
      source:options.source||'session-service-update'
    });
    if(options.render!==false)render();
    return target;
  }

  function remove(id,options={}){
    const c=resolveClient(options.client??options.clientId);
    const sessions=list(c);
    const index=sessions.findIndex(s=>s&&String(s.id)===String(id));
    if(!c||index<0)return null;

    const removed=sessions[index];
    sessions.splice(index,1);

    if(!persist()){
      sessions.splice(index,0,removed);
      return null;
    }

    emit(EVENTS.deleted,{
      clientId:c.id,
      sessionId:removed.id,
      requestId:requestId(removed),
      source:options.source||'session-service-remove'
    });
    if(options.render!==false)render();
    return removed;
  }

  function refresh(){
    return render();
  }

  services.sessions=Object.freeze({
    events:EVENTS,
    list,
    get,
    create,
    update,
    remove,
    forRequest,
    requestId,
    sessionNumber,
    refresh
  });
})();
