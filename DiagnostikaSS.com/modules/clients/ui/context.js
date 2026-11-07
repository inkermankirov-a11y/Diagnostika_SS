'use strict';

(() => {
  if(window.DiagnostikaClientUIContext)return;

  const clients=()=>window.DiagnostikaClients?.moduleAware===true?window.DiagnostikaClients:null;

  function currentClient(){
    return clients()?.current?.()||null;
  }

  function clientList(){
    return clients()?.list?.()||[];
  }

  function refreshDatabase(){
    const render=window.renderClientDatabaseTable;
    if(typeof render!=='function')return false;
    render();
    return true;
  }

  function openDatabase(){
    const open=window.openDatabase;
    if(typeof open!=='function')return false;
    open();
    return true;
  }

  window.DiagnostikaClientUIContext=Object.freeze({
    currentClient,
    clientList,
    refreshDatabase,
    openDatabase
  });
})();
