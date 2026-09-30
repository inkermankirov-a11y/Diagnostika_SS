'use strict';

(() => {
  if(window.DiagnostikaRequestUIContext)return;

  const platform=()=>window.DiagnostikaPlatform||null;

  function requestsApi(){
    if(window.DiagnostikaRequests?.moduleAware===true)return window.DiagnostikaRequests;
    return platform()?.services?.requests||null;
  }

  function clientsApi(){
    if(window.DiagnostikaClients?.moduleAware===true)return window.DiagnostikaClients;
    return platform()?.services?.clients||null;
  }

  function currentClient(){
    return clientsApi()?.current?.()||null;
  }

  function currentMode(){
    return platform()?.shell?.currentMode?.()??null;
  }

  function list(clientRef=currentClient()){
    return requestsApi()?.list?.(clientRef)||[];
  }

  function viewed(clientRef=currentClient()){
    return requestsApi()?.viewed?.(clientRef)||null;
  }

  function viewedId(clientRef=currentClient()){
    return requestsApi()?.viewedId?.(clientRef)||null;
  }

  function active(clientRef=currentClient()){
    return requestsApi()?.active?.(clientRef)||null;
  }

  function activeId(clientRef=currentClient()){
    return requestsApi()?.activeId?.(clientRef)||null;
  }

  window.DiagnostikaRequestUIContext=Object.freeze({
    requestsApi,
    clientsApi,
    currentClient,
    currentMode,
    list,
    viewed,
    viewedId,
    active,
    activeId
  });
})();
