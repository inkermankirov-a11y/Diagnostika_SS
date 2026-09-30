'use strict';

(() => {
  if(window.DiagnostikaPaymentUIContext)return;

  const clients=()=>window.DiagnostikaClients?.moduleAware===true?window.DiagnostikaClients:null;
  const requests=()=>window.DiagnostikaRequests?.moduleAware===true?window.DiagnostikaRequests:null;
  const sessions=()=>window.DiagnostikaSessions?.moduleAware===true?window.DiagnostikaSessions:null;

  function currentClient(){
    return clients()?.current?.()||null;
  }

  function clientList(){
    return clients()?.list?.()||[];
  }

  function currentRequest(clientRef=currentClient()){
    return requests()?.current?.(clientRef)||null;
  }

  function requestById(clientRef,id){
    if(!clientRef||id==null)return null;
    return requests()?.get?.(id,clientRef)||null;
  }

  function requestList(clientRef=currentClient()){
    return requests()?.list?.(clientRef)||[];
  }

  function sessionList(clientRef=currentClient()){
    return sessions()?.list?.(clientRef)||[];
  }

  function sessionById(clientRef,id){
    if(!clientRef||id==null)return null;
    return sessions()?.get?.(id,clientRef)||null;
  }

  function sessionsForRequest(clientRef,requestRef){
    return sessions()?.forRequest?.(requestRef,clientRef)||[];
  }

  function refreshSessions(){
    window.DiagnostikaDashboardSessions?.refresh?.();
    return true;
  }

  function refreshDashboard(){
    window.DiagnostikaHomeDashboard?.refresh?.();
    return true;
  }

  function openSessionEditor(clientRef,sessionRef,number){
    const open=window.openSessionEditor;
    if(typeof open!=='function'||!clientRef||!sessionRef)return false;
    open(clientRef,sessionRef,number);
    return true;
  }

  window.DiagnostikaPaymentUIContext=Object.freeze({
    currentClient,
    clientList,
    currentRequest,
    requestById,
    requestList,
    sessionList,
    sessionById,
    sessionsForRequest,
    refreshSessions,
    refreshDashboard,
    openSessionEditor
  });
})();
