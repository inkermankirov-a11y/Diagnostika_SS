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

  function legacySelect(id){
    const target=findById(id);
    if(!target) return false;

    const previousClientId=legacyCurrentId();
    try{
      clientId=target.id;
      requestId=null;
      situationId=null;
      selected=null;
      if(typeof renderClient==='function') renderClient();
    }catch(_){
      return false;
    }

    if(String(previousClientId??'')!==String(target.id)){
      window.DiagnostikaLegacyEvents?.emit?.(EVENT_NAMES.selected,{
        clientId:target.id,
        previousClientId:previousClientId??null,
        source:'client-api-fallback'
      });
    }
    return true;
  }

  function select(id){
    const moduleService=service();
    if(moduleService?.select) return moduleService.select(id);
    return legacySelect(id);
  }

  function openDatabase(){
    if(typeof window.openDatabase!=='function') return false;
    window.openDatabase();
    return true;
  }

  window.DiagnostikaClients=Object.freeze({
    version:'2A',
    moduleAware:true,
    events:service()?.events||EVENT_NAMES,
    list,
    current,
    currentId,
    findById,
    select,
    openDatabase
  });
})();
