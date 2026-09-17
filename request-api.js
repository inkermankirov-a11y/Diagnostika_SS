'use strict';

(() => {
  // Public boundary for request navigation from the new UI.
  // Legacy request state stays encapsulated here until the data core is split into modules.
  if (window.DiagnostikaRequests?.select && window.DiagnostikaRequests?.get && Object.isFrozen(window.DiagnostikaRequests)) return;

  const legacy=window.DiagnostikaRequests||{};
  const emit=(type,detail)=>window.DiagnostikaLegacyEvents?.emit?.(type,detail);

  function resolveClient(clientRef){
    if(clientRef&&typeof clientRef==='object'&&Array.isArray(clientRef.requests))return clientRef;
    if(clientRef!==undefined&&clientRef!==null){
      return window.DiagnostikaClients?.list?.().find(c=>String(c.id)===String(clientRef))||null;
    }
    return window.DiagnostikaClients?.current?.() || (typeof client === 'function' ? client() : null);
  }

  function list(clientRef){
    const c=resolveClient(clientRef);
    return Array.isArray(c?.requests) ? c.requests : [];
  }

  function get(id,clientRef){
    if(!id)return null;
    return list(clientRef).find(r=>String(r.id)===String(id))||null;
  }

  function current(clientRef){
    const c=resolveClient(clientRef);
    if(!c)return null;
    if(typeof legacy.current==='function'){
      const remembered=legacy.current(c);
      if(remembered&&get(remembered.id,c))return remembered;
    }
    return get(c.currentRequestId,c)||null;
  }

  function currentId(clientRef){
    return current(clientRef)?.id||null;
  }

  function syncLegacySelection(target){
    if(!target)return;
    requestId=target.id;
    situationId=null;
    selected=null;
  }

  function refresh(){
    if(typeof legacy.refresh==='function')legacy.refresh();
    window.DiagnostikaHomeDashboard?.refresh?.();
    return true;
  }

  function select(id){
    if (!id) return false;
    const c=resolveClient();
    const target=get(id,c);
    if (!target) return false;
    if(target.status==='completed')return false;

    const previousRequestId=c.currentRequestId||null;
    const previousSelectedId=typeof requestId!=='undefined'?requestId:null;
    c.currentRequestId=target.id;
    c.lastDiagnosisRequestId=target.id;
    syncLegacySelection(target);

    if(typeof save==='function')save();
    if (typeof renderRequests === 'function') renderRequests();
    refresh();

    if(String(previousSelectedId??'')!==String(target.id)){
      emit('request:selected',{clientId:c.id,requestId:target.id,previousRequestId:previousSelectedId??null,source:'request-api'});
    }
    if(String(previousRequestId??'')!==String(target.id)){
      emit('request:activated',{clientId:c.id,requestId:target.id,previousRequestId:previousRequestId??null,source:'request-api'});
    }
    return true;
  }

  if(typeof window.renderClient==='function'&&!window.renderClient.__requestApiBoundaryPatched){
    const previous=window.renderClient;
    const wrapped=function(){
      const active=current();
      if(active)syncLegacySelection(active);
      const result=previous.apply(this,arguments);
      setTimeout(refresh,0);
      return result;
    };
    wrapped.__requestApiBoundaryPatched=true;
    window.renderClient=wrapped;
  }

  const active=current();
  if(active){
    syncLegacySelection(active);
    if(typeof renderRequests==='function')renderRequests();
  }

  window.DiagnostikaRequests=Object.freeze({...legacy,list,get,current,currentId,select,refresh});
})();
