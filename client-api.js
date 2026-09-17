'use strict';

(() => {
  // Public boundary for client navigation from the new UI.
  // Legacy global state stays encapsulated here until the data core is split into modules.
  if (window.DiagnostikaClients?.select) return;

  const emit=(type,detail)=>window.DiagnostikaLegacyEvents?.emit?.(type,detail);

  function list(){
    return Array.isArray(state?.clients) ? state.clients : [];
  }

  function current(){
    return typeof client === 'function' ? client() : null;
  }

  function currentId(){
    return typeof clientId !== 'undefined' ? clientId : null;
  }

  function select(id){
    if (!id) return false;
    const target=list().find(c=>String(c.id)===String(id));
    if (!target) return false;

    const previousClientId=currentId();
    clientId=target.id;
    requestId=null;
    situationId=null;
    selected=null;

    if (typeof renderClient === 'function') renderClient();
    if(String(previousClientId??'')!==String(target.id)){
      emit('client:selected',{clientId:target.id,previousClientId:previousClientId??null,source:'client-api'});
    }
    return true;
  }

  function openDatabase(){
    if (typeof window.openDatabase !== 'function') return false;
    window.openDatabase();
    return true;
  }

  window.DiagnostikaClients=Object.freeze({list,current,currentId,select,openDatabase});
})();
