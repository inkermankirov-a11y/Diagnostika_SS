'use strict';

(() => {
  // Public boundary for client navigation from the new UI.
  // Legacy global state stays encapsulated here until the data core is split into modules.
  if (window.DiagnostikaClients?.select) return;

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

    clientId=target.id;
    requestId=null;
    situationId=null;
    selected=null;

    if (typeof renderClient === 'function') renderClient();
    return true;
  }

  function openDatabase(){
    if (typeof window.openDatabase !== 'function') return false;
    window.openDatabase();
    return true;
  }

  window.DiagnostikaClients=Object.freeze({list,current,currentId,select,openDatabase});
})();
