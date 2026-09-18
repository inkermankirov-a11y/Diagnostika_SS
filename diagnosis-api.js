'use strict';

(() => {
  if (window.DiagnostikaDiagnosis?.open) return;

  function currentClient(){
    return window.DiagnostikaClients?.current?.()
      || (typeof client === 'function' ? client() : null);
  }

  function requestsApi(){
    return window.DiagnostikaRequests?.moduleAware===true
      ? window.DiagnostikaRequests
      : window.DiagnostikaPlatform?.services?.requests||null;
  }

  function showChooser(){
    const launch=document.querySelector('#diagnosisLaunchDialog');
    if(launch&&!launch.open)launch.showModal();
  }

  function open(){
    const c=currentClient();
    const api=requestsApi();
    if(!c){
      if(window.AppDialog?.alert)window.AppDialog.alert('Сначала выберите клиента.','Диагностика');
      else window.alert('Сначала выберите клиента.');
      return false;
    }

    if(typeof mode!=='undefined'&&mode==='diagnosis'){
      showChooser();
      return true;
    }

    const r=api?.active?.(c)||null;
    if(!api||!r){
      showChooser();
      return false;
    }

    if(!api.view(r.id,{client:c,source:'diagnosis-api-open',render:false}))return false;

    try{
      situationId=r.situations?.[0]?.id||null;
      selected=null;
      mode='diagnosis';
    }catch(_){return false;}

    if(typeof renderRequests==='function')renderRequests();
    if(typeof renderMode==='function')renderMode();
    return true;
  }

  window.DiagnostikaDiagnosis=Object.freeze({open});
})();
