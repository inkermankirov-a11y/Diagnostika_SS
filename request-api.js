'use strict';

(() => {
  // Public boundary for request navigation from the new UI.
  // Legacy request state stays encapsulated here until the data core is split into modules.
  if (window.DiagnostikaRequests?.select) return;

  function currentClient(){
    return window.DiagnostikaClients?.current?.() || (typeof client === 'function' ? client() : null);
  }

  function list(){
    const c=currentClient();
    return Array.isArray(c?.requests) ? c.requests : [];
  }

  function current(){
    if (typeof request === 'function') return request();
    const id=currentId();
    return list().find(r=>String(r.id)===String(id)) || null;
  }

  function currentId(){
    return typeof requestId !== 'undefined' ? requestId : null;
  }

  function select(id){
    if (!id) return false;
    const target=list().find(r=>String(r.id)===String(id));
    if (!target) return false;

    requestId=target.id;
    situationId=null;
    selected=null;

    if (typeof renderRequests === 'function') renderRequests();
    return true;
  }

  window.DiagnostikaRequests=Object.freeze({list,current,currentId,select});
})();
