'use strict';

(() => {
  if(window.DiagnostikaAIUIContext)return;

  const platform=()=>window.DiagnostikaPlatform||null;

  function aiApi(){
    if(window.DiagnostikaAI?.moduleAware===true)return window.DiagnostikaAI;
    return platform()?.services?.ai||null;
  }

  function clientsApi(){
    if(window.DiagnostikaClients?.moduleAware===true)return window.DiagnostikaClients;
    return platform()?.services?.clients||null;
  }

  function requestsApi(){
    if(window.DiagnostikaRequests?.moduleAware===true)return window.DiagnostikaRequests;
    return platform()?.services?.requests||null;
  }

  function sessionsApi(){
    if(window.DiagnostikaSessions?.moduleAware===true)return window.DiagnostikaSessions;
    return platform()?.services?.sessions||null;
  }

  function currentClient(){
    return clientsApi()?.current?.()||null;
  }

  function currentRequest(clientRef=currentClient()){
    return requestsApi()?.current?.(clientRef)||null;
  }

  function requestById(id,clientRef=currentClient()){
    if(id===undefined||id===null||id==='')return null;
    return requestsApi()?.get?.(id,clientRef)||null;
  }

  function sessionById(id,clientRef=currentClient()){
    if(id===undefined||id===null||id==='')return null;
    return sessionsApi()?.get?.(id,clientRef)||null;
  }

  window.DiagnostikaAIUIContext=Object.freeze({
    aiApi,
    clientsApi,
    requestsApi,
    sessionsApi,
    currentClient,
    currentRequest,
    requestById,
    sessionById
  });
})();
