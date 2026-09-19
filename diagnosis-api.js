'use strict';

(() => {
  if(window.DiagnostikaDiagnosis?.moduleAware===true)return;

  function apiAllowed(){
    const api=window.DiagnostikaPlatform?.api;
    return !api||api.allowed('diagnosis')!==false;
  }

  function currentClient(){
    if(!apiAllowed())return null;
    return window.DiagnostikaClients?.current?.()
      || (typeof client === 'function' ? client() : null);
  }

  function requestsApi(){
    return window.DiagnostikaRequests?.moduleAware===true
      ? window.DiagnostikaRequests
      : window.DiagnostikaPlatform?.services?.requests||null;
  }

  function service(){
    if(!apiAllowed())return null;
    return window.DiagnostikaPlatform?.services?.diagnosis||null;
  }

  function showChooser(){
    const launch=document.querySelector('#diagnosisLaunchDialog');
    if(launch&&!launch.open)launch.showModal();
  }

  function open(){
    if(!apiAllowed())return false;
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

  const call=(method,...args)=>{
    const api=service();
    return typeof api?.[method]==='function'?api[method](...args):null;
  };

  window.DiagnostikaDiagnosis=Object.freeze({
    version:'7D',
    moduleAware:true,
    open,
    snapshot:(requestRef,clientRef)=>call('snapshot',requestRef,clientRef),
    situations:(requestRef,clientRef)=>call('situations',requestRef,clientRef)||[],
    getSituation:(id,requestRef,clientRef)=>call('getSituation',id,requestRef,clientRef),
    findElement:(type,id,requestRef,clientRef)=>call('findElement',type,id,requestRef,clientRef),
    addSituation:(data,options)=>call('addSituation',data,options),
    updateSituation:(id,changes,options)=>call('updateSituation',id,changes,options),
    removeSituation:(id,options)=>call('removeSituation',id,options),
    addBelief:(situationId,data,options)=>call('addBelief',situationId,data,options),
    addFeeling:(beliefId,data,options)=>call('addFeeling',beliefId,data,options),
    replaceFeelings:(beliefId,feelings,options)=>call('replaceFeelings',beliefId,feelings,options),
    addDeep:(feelingId,data,options)=>call('addDeep',feelingId,data,options),
    addInstinct:(deepId,data,options)=>call('addInstinct',deepId,data,options),
    updateElement:(type,id,changes,options)=>call('updateElement',type,id,changes,options),
    removeElement:(type,id,options)=>call('removeElement',type,id,options),
    refresh:()=>call('refresh')
  });
})();
