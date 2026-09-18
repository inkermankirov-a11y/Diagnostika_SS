'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.requests)return;

  const EVENTS=Object.freeze({
    created:'request:created',
    selected:'request:selected',
    updated:'request:updated',
    activated:'request:activated',
    completed:'request:completed',
    resumed:'request:resumed',
    deleted:'request:deleted'
  });

  const now=()=>new Date().toISOString();

  function clientsService(){
    return platform.services?.clients||window.DiagnostikaClients||null;
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
    return Array.isArray(c?.requests)?c.requests:[];
  }

  function get(id,clientRef){
    if(id===undefined||id===null||id==='')return null;
    return list(clientRef).find(r=>r&&String(r.id)===String(id))||null;
  }

  function legacyViewedId(){
    try{return typeof requestId!=='undefined'?requestId:null;}catch(_){return null;}
  }

  function viewed(clientRef){
    const c=resolveClient(clientRef);
    if(!c)return null;
    return get(legacyViewedId(),c);
  }

  function viewedId(clientRef){
    return viewed(clientRef)?.id||null;
  }

  function active(clientRef){
    const c=resolveClient(clientRef);
    if(!c)return null;
    return get(c.currentRequestId,c);
  }

  function activeId(clientRef){
    return active(clientRef)?.id||null;
  }

  function current(clientRef){return active(clientRef);}
  function currentId(clientRef){return activeId(clientRef);}

  function clone(value){
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  }

  function freshRequest(data={}){
    let base=null;
    try{if(typeof newRequest==='function')base=newRequest();}catch(_){}
    if(!base){
      base={
        id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2),
        title:'Новый запрос',
        situations:[]
      };
    }
    const incoming=clone(data)||{};
    const created={...base,...incoming};
    if(!created.id)created.id=base.id;
    if(!created.title)created.title='Новый запрос';
    if(!Array.isArray(created.situations))created.situations=[];
    if(!created.status)created.status='active';
    if(!created.createdAt)created.createdAt=now();
    if(!created.updatedAt)created.updatedAt=created.createdAt;
    return created;
  }

  function persist(){
    try{
      if(platform.store?.legacySave?.())return true;
    }catch(_){}
    try{if(typeof save==='function'){save();return true;}}catch(error){
      console.error('[DiagnostikaPlatform] request persistence failed',error);
    }
    return false;
  }

  function render(){
    try{if(typeof renderRequests==='function')renderRequests();}catch(error){
      console.error('[DiagnostikaPlatform] request render failed',error);
      return false;
    }
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
    return true;
  }

  function emit(type,detail={}){
    if(!platform.events?.emit)return 0;
    return platform.events.emit(type,Object.freeze({
      ...detail,
      source:detail.source||'request-service',
      emittedAt:detail.emittedAt||now()
    }));
  }

  function setLegacyView(id){
    try{
      requestId=id||null;
      situationId=null;
      selected=null;
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] request view selection failed',error);
      return false;
    }
  }

  function view(id,options={}){
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target)return false;

    const previousRequestId=viewedId(c);
    if(!setLegacyView(target.id))return false;
    if(options.render!==false)render();

    if(String(previousRequestId??'')!==String(target.id)){
      emit(EVENTS.selected,{
        clientId:c.id,
        requestId:target.id,
        previousRequestId:previousRequestId??null,
        source:options.source||'request-service-view'
      });
    }
    return true;
  }

  function activate(id,options={}){
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target)return false;
    if(target.status==='completed'&&options.resumeCompleted!==true)return false;

    const previousActiveId=activeId(c);
    const previousViewedId=viewedId(c);
    const previousCurrentRequestId=c.currentRequestId??null;
    const previousLastDiagnosisRequestId=c.lastDiagnosisRequestId??null;
    const previousStatus=target.status;
    if(options.resumeCompleted===true&&target.status==='completed')target.status='active';
    c.currentRequestId=target.id;
    c.lastDiagnosisRequestId=target.id;
    if(!setLegacyView(target.id)){
      c.currentRequestId=previousCurrentRequestId;
      c.lastDiagnosisRequestId=previousLastDiagnosisRequestId;
      target.status=previousStatus;
      return false;
    }

    if(!persist()){
      c.currentRequestId=previousCurrentRequestId;
      c.lastDiagnosisRequestId=previousLastDiagnosisRequestId;
      target.status=previousStatus;
      setLegacyView(previousViewedId);
      return false;
    }

    if(options.render!==false)render();

    if(String(previousViewedId??'')!==String(target.id)){
      emit(EVENTS.selected,{
        clientId:c.id,
        requestId:target.id,
        previousRequestId:previousViewedId??null,
        source:options.source||'request-service-activate'
      });
    }
    if(String(previousActiveId??'')!==String(target.id)){
      emit(EVENTS.activated,{
        clientId:c.id,
        requestId:target.id,
        previousRequestId:previousActiveId??null,
        source:options.source||'request-service-activate'
      });
    }
    return true;
  }

  function select(id,options={}){
    return activate(id,options);
  }

  function create(data={},options={}){
    const c=resolveClient(options.client??options.clientId);
    if(!c)return null;

    const requests=list(c);
    const created=freshRequest(data);
    if(get(created.id,c))return null;

    const previousActiveId=activeId(c);
    const previousViewedId=viewedId(c);
    const previousCurrentRequestId=c.currentRequestId??null;
    const previousLastDiagnosisRequestId=c.lastDiagnosisRequestId??null;
    const shouldActivate=options.activate!==false;
    const shouldView=shouldActivate||options.view===true;

    requests.push(created);
    if(shouldActivate){
      c.currentRequestId=created.id;
      c.lastDiagnosisRequestId=created.id;
    }
    if(shouldView&&!setLegacyView(created.id)){
      requests.pop();
      c.currentRequestId=previousCurrentRequestId;
      c.lastDiagnosisRequestId=previousLastDiagnosisRequestId;
      return null;
    }

    if(!persist()){
      requests.pop();
      c.currentRequestId=previousCurrentRequestId;
      c.lastDiagnosisRequestId=previousLastDiagnosisRequestId;
      if(shouldView)setLegacyView(previousViewedId);
      return null;
    }

    if(options.render!==false)render();

    emit(EVENTS.created,{
      clientId:c.id,
      requestId:created.id,
      source:options.source||'request-service-create'
    });
    if(shouldView&&String(previousViewedId??'')!==String(created.id)){
      emit(EVENTS.selected,{
        clientId:c.id,
        requestId:created.id,
        previousRequestId:previousViewedId??null,
        source:options.source||'request-service-create'
      });
    }
    if(shouldActivate&&String(previousActiveId??'')!==String(created.id)){
      emit(EVENTS.activated,{
        clientId:c.id,
        requestId:created.id,
        previousRequestId:previousActiveId??null,
        source:options.source||'request-service-create'
      });
    }
    return created;
  }

  function update(id,changes={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target||!changes||typeof changes!=='object')return null;

    const before=clone(target)||{};
    const patch=clone(changes)||{};
    delete patch.id;
    Object.assign(target,patch);
    if(options.touch!==false&&!Object.prototype.hasOwnProperty.call(patch,'updatedAt'))target.updatedAt=now();

    if(!persist()){
      for(const key of Object.keys(target))delete target[key];
      Object.assign(target,before);
      return null;
    }

    if(options.render!==false)render();
    emit(EVENTS.updated,{
      clientId:c.id,
      requestId:target.id,
      fields:Object.keys(patch),
      source:options.source||'request-service-update'
    });
    return target;
  }

  function complete(id,options={}){
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target)return null;
    if(target.status==='completed')return target;

    const before=clone(target)||{};
    const previousActiveId=activeId(c);
    const previousCurrentRequestId=c.currentRequestId??null;
    target.status='completed';
    target.completedAt=now();
    target.updatedAt=target.completedAt;

    let next=null;
    if(String(previousActiveId??'')===String(target.id)){
      next=list(c).find(r=>r&&String(r.id)!==String(target.id)&&r.status!=='completed')||null;
      c.currentRequestId=next?.id||null;
    }

    if(!persist()){
      for(const key of Object.keys(target))delete target[key];
      Object.assign(target,before);
      c.currentRequestId=previousCurrentRequestId;
      return null;
    }

    if(options.render!==false)render();
    emit(EVENTS.completed,{
      clientId:c.id,
      requestId:target.id,
      source:options.source||'request-service-complete'
    });
    if(next&&String(previousActiveId??'')!==String(next.id)){
      emit(EVENTS.activated,{
        clientId:c.id,
        requestId:next.id,
        previousRequestId:target.id,
        source:options.nextSource||options.source||'request-service-complete-next'
      });
    }
    return target;
  }

  function resume(id,options={}){
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target)return null;

    const before=clone(target)||{};
    const previousActiveId=activeId(c);
    const previousViewedId=viewedId(c);
    const previousCurrentRequestId=c.currentRequestId??null;
    const previousLastDiagnosisRequestId=c.lastDiagnosisRequestId??null;

    target.status='active';
    delete target.completedAt;
    target.updatedAt=now();
    c.currentRequestId=target.id;
    c.lastDiagnosisRequestId=target.id;
    if(!setLegacyView(target.id))return null;

    if(!persist()){
      for(const key of Object.keys(target))delete target[key];
      Object.assign(target,before);
      c.currentRequestId=previousCurrentRequestId;
      c.lastDiagnosisRequestId=previousLastDiagnosisRequestId;
      setLegacyView(previousViewedId);
      return null;
    }

    if(options.render!==false)render();
    emit(EVENTS.resumed,{
      clientId:c.id,
      requestId:target.id,
      source:options.source||'request-service-resume'
    });
    if(String(previousViewedId??'')!==String(target.id)){
      emit(EVENTS.selected,{
        clientId:c.id,
        requestId:target.id,
        previousRequestId:previousViewedId??null,
        source:options.source||'request-service-resume'
      });
    }
    if(String(previousActiveId??'')!==String(target.id)){
      emit(EVENTS.activated,{
        clientId:c.id,
        requestId:target.id,
        previousRequestId:previousActiveId??null,
        source:options.source||'request-service-resume'
      });
    }
    return target;
  }

  function remove(id,options={}){
    const c=resolveClient(options.client??options.clientId);
    const requests=list(c);
    const index=requests.findIndex(r=>r&&String(r.id)===String(id));
    if(!c||index<0)return null;

    const removed=requests[index];
    const previousActiveId=activeId(c);
    const previousViewedId=viewedId(c);
    const previousCurrentRequestId=c.currentRequestId??null;
    const previousLastDiagnosisRequestId=c.lastDiagnosisRequestId??null;

    requests.splice(index,1);

    let nextActive=active(c);
    if(String(previousActiveId??'')===String(id)){
      nextActive=requests.find(r=>r&&r.status!=='completed')||null;
      c.currentRequestId=nextActive?.id||null;
      if(String(c.lastDiagnosisRequestId??'')===String(id))c.lastDiagnosisRequestId=nextActive?.id||null;
    }

    let nextViewed=viewed(c);
    if(String(previousViewedId??'')===String(id)){
      nextViewed=nextActive||requests[Math.min(index,Math.max(0,requests.length-1))]||null;
      setLegacyView(nextViewed?.id||null);
    }

    if(!persist()){
      requests.splice(index,0,removed);
      c.currentRequestId=previousCurrentRequestId;
      c.lastDiagnosisRequestId=previousLastDiagnosisRequestId;
      setLegacyView(previousViewedId);
      return null;
    }

    if(options.render!==false)render();
    emit(EVENTS.deleted,{
      clientId:c.id,
      requestId:removed.id,
      selectedRequestId:nextViewed?.id||null,
      activeRequestId:nextActive?.id||null,
      source:options.source||'request-service-remove'
    });

    if(String(previousViewedId??'')!==String(nextViewed?.id??'')){
      emit(EVENTS.selected,{
        clientId:c.id,
        requestId:nextViewed?.id||null,
        previousRequestId:previousViewedId??null,
        reason:'request-deleted',
        source:options.source||'request-service-remove'
      });
    }
    if(String(previousActiveId??'')!==String(nextActive?.id??'')){
      emit(EVENTS.activated,{
        clientId:c.id,
        requestId:nextActive?.id||null,
        previousRequestId:previousActiveId??null,
        reason:'request-deleted',
        source:options.source||'request-service-remove'
      });
    }

    return removed;
  }

  function requestNumber(clientRef,requestRef){
    let c=resolveClient(clientRef);
    let target=requestRef;
    if(!target&&clientRef&&typeof clientRef==='object'&&clientRef.id&&!Array.isArray(clientRef.requests)){
      target=clientRef;
      c=resolveClient();
    }
    if(!c||!target)return 0;
    const id=typeof target==='object'?target.id:target;
    const index=list(c).findIndex(r=>r&&String(r.id)===String(id));
    return index>=0?index+1:0;
  }

  function refresh(){
    return render();
  }

  services.requests=Object.freeze({
    events:EVENTS,
    list,
    get,
    current,
    currentId,
    active,
    activeId,
    viewed,
    viewedId,
    view,
    select,
    activate,
    create,
    update,
    complete,
    resume,
    remove,
    requestNumber,
    refresh
  });
})();
