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
    restored: 'client:restored'
  });

  function service(){
    return window.DiagnostikaPlatform?.clients
      || window.DiagnostikaPlatform?.services?.clients
      || null;
  }

  function legacyList(){
    try { return Array.isArray(state?.clients) ? state.clients : []; }
    catch (_) { return []; }
  }

  function legacyCurrent(){
    try { return typeof client === 'function' ? client() : null; }
    catch (_) { return null; }
  }

  function legacyCurrentId(){
    try { return typeof clientId !== 'undefined' ? clientId : null; }
    catch (_) { return null; }
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

  function openDatabase(){
    if(typeof window.openDatabase!=='function') return false;
    window.openDatabase();
    return true;
  }

  const api=Object.freeze({
    version:'2B1',
    moduleAware:true,
    events:service()?.events||EVENT_NAMES,
    list,
    current,
    currentId,
    findById,
    select,
    create,
    update,
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
