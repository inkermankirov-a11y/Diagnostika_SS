'use strict';

(() => {
  // Compatibility facade for the current UI.
  // New code should use DiagnostikaPlatform.services.requests / module "requests".
  if(window.DiagnostikaRequests?.moduleAware===true)return;

  const legacy=window.DiagnostikaRequests||{};
  const EVENT_NAMES=Object.freeze({
    created:'request:created',
    selected:'request:selected',
    updated:'request:updated',
    activated:'request:activated',
    completed:'request:completed',
    resumed:'request:resumed',
    deleted:'request:deleted'
  });

  function service(){
    return window.DiagnostikaPlatform?.requests
      || window.DiagnostikaPlatform?.services?.requests
      || null;
  }

  function resolveClient(clientRef){
    if(clientRef&&typeof clientRef==='object')return clientRef;
    if(clientRef!==undefined&&clientRef!==null&&clientRef!==''){
      return window.DiagnostikaClients?.findById?.(clientRef)
        || window.DiagnostikaClients?.list?.().find(c=>c&&String(c.id)===String(clientRef))
        || null;
    }
    return window.DiagnostikaClients?.current?.()
      || (typeof client==='function'?client():null);
  }

  function fallbackList(clientRef){
    const c=resolveClient(clientRef);
    return Array.isArray(c?.requests)?c.requests:[];
  }

  function list(clientRef){
    return service()?.list?.(clientRef)||fallbackList(clientRef);
  }

  function get(id,clientRef){
    const viaService=service()?.get?.(id,clientRef);
    if(viaService)return viaService;
    if(id===undefined||id===null||id==='')return null;
    return fallbackList(clientRef).find(r=>r&&String(r.id)===String(id))||null;
  }

  function current(clientRef){
    const viaService=service()?.current?.(clientRef);
    if(viaService)return viaService;
    const c=resolveClient(clientRef);
    if(!c)return null;
    if(typeof legacy.current==='function'){
      const remembered=legacy.current(c);
      if(remembered&&get(remembered.id,c))return remembered;
    }
    return get(c.currentRequestId,c)||null;
  }

  function currentId(clientRef){
    const value=service()?.currentId?.(clientRef);
    if(value!==undefined)return value;
    return current(clientRef)?.id||null;
  }

  function active(clientRef){
    return service()?.active?.(clientRef)||current(clientRef);
  }

  function activeId(clientRef){
    const value=service()?.activeId?.(clientRef);
    return value!==undefined?value:(active(clientRef)?.id||null);
  }

  function viewed(clientRef){
    const viaService=service()?.viewed?.(clientRef);
    if(viaService)return viaService;
    let id=null;
    try{id=typeof requestId!=='undefined'?requestId:null;}catch(_){}
    return get(id,clientRef);
  }

  function viewedId(clientRef){
    const value=service()?.viewedId?.(clientRef);
    return value!==undefined?value:(viewed(clientRef)?.id||null);
  }

  function refresh(){
    let result=true;
    try{
      if(service()?.refresh)result=service().refresh()!==false;
      else if(typeof renderRequests==='function')renderRequests();
    }catch(_){result=false;}
    try{if(typeof legacy.refresh==='function')legacy.refresh();}catch(_){}
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
    return result;
  }

  function view(id,options={}){
    const moduleService=service();
    if(moduleService?.view)return moduleService.view(id,options);
    const target=get(id,options.client??options.clientId);
    if(!target)return false;
    const previousRequestId=viewedId();
    try{
      requestId=target.id;
      situationId=null;
      selected=null;
      if(options.render!==false&&typeof renderRequests==='function')renderRequests();
    }catch(_){return false;}
    if(String(previousRequestId??'')!==String(target.id)){
      window.DiagnostikaLegacyEvents?.emit?.(EVENT_NAMES.selected,{
        clientId:resolveClient()?.id||null,
        requestId:target.id,
        previousRequestId:previousRequestId??null,
        source:options.source||'request-api-fallback-view'
      });
    }
    return true;
  }

  function activate(id,options={}){
    const moduleService=service();
    if(moduleService?.activate)return moduleService.activate(id,options);
    const c=resolveClient(options.client??options.clientId);
    const target=get(id,c);
    if(!c||!target||target.status==='completed')return false;
    const previousActiveId=c.currentRequestId||null;
    const previousViewedId=viewedId(c);
    c.currentRequestId=target.id;
    c.lastDiagnosisRequestId=target.id;
    try{requestId=target.id;situationId=null;selected=null;}catch(_){return false;}
    try{if(typeof save==='function')save();}catch(_){return false;}
    if(options.render!==false&&typeof renderRequests==='function')renderRequests();
    if(String(previousViewedId??'')!==String(target.id)){
      window.DiagnostikaLegacyEvents?.emit?.(EVENT_NAMES.selected,{
        clientId:c.id,requestId:target.id,previousRequestId:previousViewedId??null,
        source:options.source||'request-api-fallback-activate'
      });
    }
    if(String(previousActiveId??'')!==String(target.id)){
      window.DiagnostikaLegacyEvents?.emit?.(EVENT_NAMES.activated,{
        clientId:c.id,requestId:target.id,previousRequestId:previousActiveId??null,
        source:options.source||'request-api-fallback-activate'
      });
    }
    return true;
  }

  function select(id,options={}){
    return activate(id,options);
  }

  function callService(method,fallbackValue,...args){
    const fn=service()?.[method];
    return typeof fn==='function'?fn(...args):fallbackValue;
  }

  function create(data={},options={}){
    return callService('create',null,data,options);
  }

  function update(id,changes={},options={}){
    return callService('update',null,id,changes,options);
  }

  function complete(id,options={}){
    return callService('complete',null,id,options);
  }

  function resume(id,options={}){
    return callService('resume',null,id,options);
  }

  function remove(id,options={}){
    return callService('remove',null,id,options);
  }

  function requestNumber(clientRef,requestRef){
    const value=service()?.requestNumber?.(clientRef,requestRef);
    if(value!==undefined)return value;
    if(typeof legacy.requestNumber==='function')return legacy.requestNumber(clientRef,requestRef);
    const c=resolveClient(clientRef);
    const target=requestRef;
    const id=typeof target==='object'?target?.id:target;
    const index=fallbackList(c).findIndex(r=>r&&String(r.id)===String(id));
    return index>=0?index+1:0;
  }

  if(typeof window.renderClient==='function'&&!window.renderClient.__requestApiBoundaryPatched){
    const previous=window.renderClient;
    const wrapped=function(){
      const selected=active();
      if(selected){
        try{
          requestId=selected.id;
          situationId=null;
          selected=null;
        }catch(_){}
      }
      const result=previous.apply(this,arguments);
      setTimeout(refresh,0);
      return result;
    };
    wrapped.__requestApiBoundaryPatched=true;
    window.renderClient=wrapped;
  }

  const selected=active();
  if(selected){
    try{requestId=selected.id;situationId=null;selected=null;}catch(_){}
    if(typeof renderRequests==='function')renderRequests();
  }

  window.DiagnostikaRequests=Object.freeze({
    ...legacy,
    version:'3A',
    moduleAware:true,
    events:service()?.events||EVENT_NAMES,
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
