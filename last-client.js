'use strict';

(() => {
  const LAST_CLIENT_KEY = 'diagnostika-last-client-id';
  let eventsBound=false;
  let attempts=0;

  const clientsApi=()=>window.DiagnostikaClients
    || window.DiagnostikaPlatform?.clients
    || window.DiagnostikaPlatform?.services?.clients
    || null;

  function rememberClient(id){
    const value=id||clientsApi()?.currentId?.()||null;
    if(value) localStorage.setItem(LAST_CLIENT_KEY,String(value));
  }

  function restoreLastClient(){
    const api=clientsApi();
    if(!api?.select||!api?.findById) return false;

    const savedId=localStorage.getItem(LAST_CLIENT_KEY);
    if(savedId && api.findById(savedId)){
      if(String(api.currentId?.()||'')!==String(savedId)){
        api.select(savedId,{source:'last-client-restore'});
      }else{
        rememberClient(savedId);
      }
    }else{
      rememberClient(api.currentId?.());
    }
    return true;
  }

  function bindEvents(){
    if(eventsBound) return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on) return false;
    events.on('client:selected',detail=>rememberClient(detail?.clientId));
    events.on('clients:ready',()=>restoreLastClient());
    eventsBound=true;
    return true;
  }

  function init(){
    bindEvents();
    if(restoreLastClient()) return;
    attempts+=1;
    if(attempts<80) setTimeout(init,50);
  }

  window.addEventListener('diagnostika:platform-core-ready',()=>{
    bindEvents();
    restoreLastClient();
  },{once:true});

  init();
})();
