'use strict';

(() => {
  // Compatibility facade for the current UI.
  // New code should use DiagnostikaPlatform.services.clients / module "clients".
  if (window.DiagnostikaClients?.moduleAware === true) return;

  const EVENT_NAMES = Object.freeze({
    created: 'client:created',
    selected: 'client:selected',
    updated: 'client:updated',
    deleted: 'client:deleted',
    restored: 'client:restored',
    purged: 'client:purged'
  });
  const PIN_LIMIT=10;

  function apiAllowed(){
    const api=window.DiagnostikaPlatform?.api;
    return !api||api.allowed('clients')!==false;
  }

  function service(){
    if(!apiAllowed())return null;
    return window.DiagnostikaPlatform?.clients
      || window.DiagnostikaPlatform?.services?.clients
      || null;
  }

  function legacyList(){
    if(!apiAllowed())return [];
    try { return Array.isArray(state?.clients) ? state.clients : []; }
    catch (_) { return []; }
  }

  function legacyCurrent(){
    if(!apiAllowed())return null;
    try { return typeof client === 'function' ? client() : null; }
    catch (_) { return null; }
  }

  function legacyCurrentId(){
    if(!apiAllowed())return null;
    try { return typeof clientId !== 'undefined' ? clientId : null; }
    catch (_) { return null; }
  }

  function legacyPinnedIds(){
    if(!apiAllowed())return [];
    try{
      const active=new Map(legacyList().filter(c=>c?.id!=null).map(c=>[String(c.id),c.id]));
      const raw=Array.isArray(state?.pinnedClientIds)?state.pinnedClientIds:[];
      const out=[],seen=new Set();
      for(const value of raw){
        const key=String(value);
        if(seen.has(key)||!active.has(key))continue;
        seen.add(key);out.push(active.get(key));
        if(out.length>=PIN_LIMIT)break;
      }
      return out;
    }catch(_){return [];}
  }

  function pinnedIds(){
    const moduleService=service();
    return moduleService?.pinnedIds?.()||legacyPinnedIds();
  }

  function isPinned(id){
    const moduleService=service();
    if(moduleService?.isPinned)return moduleService.isPinned(id);
    const key=String(id??'');
    return key!==''&&legacyPinnedIds().some(value=>String(value)===key);
  }

  function legacyPin(id,options={}){
    if(!apiAllowed())return {ok:false,reason:'blocked',limit:PIN_LIMIT};
    const target=findById(id);
    if(!target)return {ok:false,reason:'missing',limit:PIN_LIMIT};
    const current=legacyPinnedIds(),key=String(target.id),already=current.some(v=>String(v)===key);
    if(!already&&current.length>=PIN_LIMIT)return {ok:false,reason:'limit',limit:PIN_LIMIT,pinnedIds:current};
    const before=Array.isArray(state?.pinnedClientIds)?[...state.pinnedClientIds]:null;
    const next=[target.id,...current.filter(v=>String(v)!==key)].slice(0,PIN_LIMIT);
    state.pinnedClientIds=next;
    if(!legacyPersist()){
      if(before)state.pinnedClientIds=before;else delete state.pinnedClientIds;
      return {ok:false,reason:'persist',limit:PIN_LIMIT};
    }
    emit(EVENT_NAMES.updated,{clientId:target.id,fields:['pinnedClientIds'],change:'pinned',source:options.source||'client-api-fallback-pin'});
    return {ok:true,changed:!already||String(current[0]??'')!==key,clientId:target.id,limit:PIN_LIMIT,pinnedIds:[...next]};
  }

  function pin(id,options={}){
    const moduleService=service();
    if(moduleService?.pin)return moduleService.pin(id,options);
    return legacyPin(id,options);
  }

  function legacyUnpin(id,options={}){
    if(!apiAllowed())return {ok:false,reason:'blocked',limit:PIN_LIMIT};
    const target=findById(id);
    if(!target)return {ok:false,reason:'missing',limit:PIN_LIMIT};
    const current=legacyPinnedIds(),key=String(target.id);
    if(!current.some(v=>String(v)===key))return {ok:true,changed:false,clientId:target.id,limit:PIN_LIMIT,pinnedIds:current};
    const before=Array.isArray(state?.pinnedClientIds)?[...state.pinnedClientIds]:null;
    const next=current.filter(v=>String(v)!==key);
    state.pinnedClientIds=next;
    if(!legacyPersist()){
      if(before)state.pinnedClientIds=before;else delete state.pinnedClientIds;
      return {ok:false,reason:'persist',limit:PIN_LIMIT};
    }
    emit(EVENT_NAMES.updated,{clientId:target.id,fields:['pinnedClientIds'],change:'unpinned',source:options.source||'client-api-fallback-unpin'});
    return {ok:true,changed:true,clientId:target.id,limit:PIN_LIMIT,pinnedIds:[...next]};
  }

  function unpin(id,options={}){
    const moduleService=service();
    if(moduleService?.unpin)return moduleService.unpin(id,options);
    return legacyUnpin(id,options);
  }

  function legacyPersist(){
    try {
      if(typeof save==='function'){ save(); return true; }
    } catch (_) {}
    return false;
  }

  function legacyRender(){
    try {
      if(typeof renderClient==='function') renderClient();
      return true;
    } catch (_) {
      return false;
    }
  }

  function emit(type,detail){
    window.DiagnostikaLegacyEvents?.emit?.(type,detail);
  }

  function list(){
    return service()?.list?.() || legacyList();
  }

  function current(){
    return service()?.current?.() || legacyCurrent();
  }

  function currentId(){
    const value=service()?.currentId?.();
    return value !== undefined ? value : legacyCurrentId();
  }

  function findById(id){
    const viaService=service()?.findById?.(id);
    if(viaService) return viaService;
    if(id===undefined||id===null||id==='') return null;
    return legacyList().find(c=>c&&String(c.id)===String(id))||null;
  }

  function legacySelect(id,options={}){
    if(!apiAllowed())return false;
    const target=findById(id);
    if(!target) return false;

    const previousClientId=legacyCurrentId();
    try{
      clientId=target.id;
      requestId=null;
      situationId=null;
      selected=null;
      if(options.render!==false) legacyRender();
    }catch(_){
      return false;
    }

    if(String(previousClientId??'')!==String(target.id)){
      emit(EVENT_NAMES.selected,{
        clientId:target.id,
        previousClientId:previousClientId??null,
        source:options.source||'client-api-fallback'
      });
    }
    return true;
  }

  function select(id,options={}){
    const moduleService=service();
    if(moduleService?.select) return moduleService.select(id,options);
    return legacySelect(id,options);
  }

  function fallbackNewClient(data={}){
    let base=null;
    try{ if(typeof newClient==='function') base=newClient(); }catch(_){}
    if(!base){
      base={
        id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2),
        name:'Новый клиент',city:'',age:'',birth:'',photoData:'',vk:'',telegram:'',max:'',sessions:[],requests:[]
      };
    }
    const created={...base,...data};
    if(!Array.isArray(created.sessions)) created.sessions=[];
    if(!Array.isArray(created.requests)) created.requests=[];
    return created;
  }

  function legacyCreate(data={},options={}){
    if(!apiAllowed())return null;
    const created=fallbackNewClient(data);
    if(findById(created.id)) return null;
    const clients=legacyList();
    clients.push(created);
    if(!legacyPersist()){
      clients.splice(clients.indexOf(created),1);
      return null;
    }

    emit(EVENT_NAMES.created,{clientId:created.id,source:options.source||'client-api-fallback'});
    if(options.select!==false){
      legacySelect(created.id,{
        source:options.selectSource||options.source||'client-api-fallback-create',
        render:options.render
      });
    }else if(options.render===true){
      legacyRender();
    }
    return created;
  }

  function create(data={},options={}){
    const moduleService=service();
    if(moduleService?.create) return moduleService.create(data,options);
    return legacyCreate(data,options);
  }

  function legacyUpdate(id,changes={},options={}){
    if(!apiAllowed())return null;
    const target=findById(id);
    if(!target||!changes||typeof changes!=='object') return null;
    const patch={...changes};
    delete patch.id;
    Object.assign(target,patch);
    if(!legacyPersist()) return null;
    if(options.render!==false) legacyRender();
    emit(EVENT_NAMES.updated,{
      clientId:target.id,
      fields:Object.keys(patch),
      source:options.source||'client-api-fallback'
    });
    return target;
  }

  function update(id,changes={},options={}){
    const moduleService=service();
    if(moduleService?.update) return moduleService.update(id,changes,options);
    return legacyUpdate(id,changes,options);
  }

  function legacyTrashState(){
    if(!apiAllowed())return null;
    try{
      if(!Array.isArray(state.deletedClients)) state.deletedClients=[];
      if(!Array.isArray(state.deletedClientTombstones)) state.deletedClientTombstones=[];
      const blocked=new Set(state.deletedClientTombstones.map(String));
      const active=new Set(legacyList().map(x=>x?.id).filter(Boolean).map(String));
      state.deletedClients=state.deletedClients.filter(x=>x?.id&&!blocked.has(String(x.id))&&!active.has(String(x.id)));
      return {deletedClients:state.deletedClients,tombstones:state.deletedClientTombstones};
    }catch(_){
      return null;
    }
  }

  function trashList(){
    const moduleService=service();
    if(moduleService?.trashList) return moduleService.trashList();
    const trash=legacyTrashState();
    return trash ? JSON.parse(JSON.stringify(trash.deletedClients)) : [];
  }

  function findDeletedById(id){
    const moduleService=service();
    if(moduleService?.findDeletedById) return moduleService.findDeletedById(id);
    return trashList().find(x=>x&&String(x.id)===String(id))||null;
  }

  function legacyRemove(id,options={}){
    if(!apiAllowed())return null;
    const clients=legacyList();
    const index=clients.findIndex(x=>x&&String(x.id)===String(id));
    if(index<0) return null;
    const trash=legacyTrashState();
    if(!trash) return null;

    const previousClientId=legacyCurrentId();
    const target=clients[index];
    const archived=JSON.parse(JSON.stringify(target));
    archived.deletedAt=new Date().toISOString();

    state.deletedClients=trash.deletedClients.filter(x=>x&&String(x.id)!==String(id));
    state.deletedClients.push(archived);
    state.deletedClientTombstones=trash.tombstones.filter(x=>String(x)!==String(id));
    clients.splice(index,1);

    let replacementCreated=false;
    let selectionChanged=false;
    if(!clients.length){
      const replacement=fallbackNewClient();
      clients.push(replacement);
      clientId=replacement.id;
      replacementCreated=true;
      selectionChanged=true;
    }else if(!clients.some(x=>x&&String(x.id)===String(previousClientId))){
      const replacement=clients[Math.min(index,clients.length-1)];
      clientId=replacement.id;
      selectionChanged=true;
    }

    if(selectionChanged){
      requestId=null;
      situationId=null;
      selected=null;
      try{ mode='card'; }catch(_){}
    }

    if(!legacyPersist()) return null;
    if(options.render!==false) legacyRender();

    emit(EVENT_NAMES.deleted,{
      clientId:target.id,
      selectedClientId:legacyCurrentId(),
      replacementCreated,
      source:options.source||'client-api-fallback'
    });
    if(selectionChanged&&legacyCurrentId()){
      emit(EVENT_NAMES.selected,{
        clientId:legacyCurrentId(),
        previousClientId:previousClientId??null,
        reason:'client-deleted',
        source:options.source||'client-api-fallback'
      });
    }
    return {clientId:target.id,selectedClientId:legacyCurrentId(),replacementCreated};
  }

  function remove(id,options={}){
    const moduleService=service();
    if(moduleService?.remove) return moduleService.remove(id,options);
    return legacyRemove(id,options);
  }

  function legacyRestore(id,options={}){
    if(!apiAllowed())return null;
    const trash=legacyTrashState();
    if(!trash) return null;
    const index=trash.deletedClients.findIndex(x=>x&&String(x.id)===String(id));
    if(index<0||findById(id)) return null;
    const restored=JSON.parse(JSON.stringify(trash.deletedClients[index]));
    delete restored.deletedAt;
    state.deletedClients.splice(index,1);
    state.deletedClientTombstones=trash.tombstones.filter(x=>String(x)!==String(id));
    legacyList().push(restored);
    if(!legacyPersist()) return null;
    emit(EVENT_NAMES.restored,{clientId:restored.id,source:options.source||'client-api-fallback'});
    if(options.select===true) legacySelect(restored.id,{source:options.source||'client-api-fallback-restore',render:options.render});
    else if(options.render!==false) legacyRender();
    return restored;
  }

  function restore(id,options={}){
    const moduleService=service();
    if(moduleService?.restore) return moduleService.restore(id,options);
    return legacyRestore(id,options);
  }

  function legacyPurge(id,options={}){
    if(!apiAllowed())return false;
    const trash=legacyTrashState();
    if(!trash) return false;
    const index=trash.deletedClients.findIndex(x=>x&&String(x.id)===String(id));
    if(index<0) return false;
    state.deletedClients.splice(index,1);
    if(!state.deletedClientTombstones.some(x=>String(x)===String(id))) state.deletedClientTombstones.push(id);
    if(!legacyPersist()) return false;
    emit(EVENT_NAMES.purged,{clientId:id,source:options.source||'client-api-fallback'});
    return true;
  }

  function purge(id,options={}){
    const moduleService=service();
    if(moduleService?.purge) return moduleService.purge(id,options);
    return legacyPurge(id,options);
  }

  function openDatabase(){
    if(!apiAllowed())return false;
    if(typeof window.openDatabase!=='function') return false;
    window.openDatabase();
    return true;
  }

  const api=Object.freeze({
    version:'2B2',
    moduleAware:true,
    events:service()?.events||EVENT_NAMES,
    list,
    current,
    currentId,
    findById,
    select,
    create,
    update,
    trashList,
    findDeletedById,
    remove,
    restore,
    purge,
    pinLimit:PIN_LIMIT,
    pinnedIds,
    isPinned,
    pin,
    unpin,
    openDatabase
  });
  window.DiagnostikaClients=api;

  // Compatibility path for the old "+ Новый клиент" button in the database dialog.
  // It keeps the old instant-create behavior, but mutation now goes through ClientService.
  const addButton=document.querySelector('#dialogAddClientBtn');
  if(addButton){
    addButton.onclick=()=>{
      let seed={};
      try{ if(typeof newClient==='function') seed=newClient(); }catch(_){}
      const created=create(seed,{source:'client-database-create'});
      if(created){
        const dlg=document.querySelector('#clientDialog');
        if(dlg?.open) dlg.close();
      }
    };
  }
})();
