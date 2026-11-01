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

  function showChooser(c,requests){
    const launch=document.querySelector('#diagnosisLaunchDialog');
    if(!launch)return false;
    const hasHistory=requests.length>0;
    const subtitle=launch.querySelector('.diag-launch-sub');
    if(subtitle)subtitle.textContent=hasHistory
      ? 'Все запросы завершены. Начать новую диагностику или открыть предыдущую?'
      : 'У клиента ещё нет запросов. Начните диагностику с первого запроса.';
    for(const id of ['diagPreviousBtn','diagDeleteBtn']){
      const button=launch.querySelector('#'+id);
      if(button){button.hidden=!hasHistory;button.disabled=!hasHistory;}
    }
    if(!launch.open)launch.showModal();
    return true;
  }

  function isUnfinished(request){
    // Legacy requests without a status were always treated as active.
    return !!request && request.status!=='completed';
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
    if(!api?.list||!api?.view)return false;

    const requests=api.list(c)||[];
    const unfinished=requests.filter(isUnfinished);
    if(!unfinished.length){
      // Neither a questionnaire nor a consultation alone creates a diagnosis.
      // The chooser only appears when no unfinished diagnostic request exists.
      return showChooser(c,requests);
    }

    // Active request takes precedence, then the already viewed unfinished one.
    // Recover a forgotten currentRequestId instead of showing a wrong chooser.
    const active=api.active?.(c);
    const viewed=api.viewed?.(c);
    const request=[active,viewed].find(r=>isUnfinished(r)&&unfinished.some(x=>String(x.id)===String(r.id)))
      ||unfinished[unfinished.length-1];

    if(String(api.activeId?.(c)??'')!==String(request.id)){
      if(typeof api.activate!=='function'||!api.activate(request.id,{
        client:c,source:'diagnosis-auto-restore-active',render:false
      }))return false;
    }else if(String(api.viewedId?.(c)??'')!==String(request.id)){
      if(!api.view(request.id,{client:c,source:'diagnosis-auto-open',render:false}))return false;
    }

    // An already open diagnosis is not a reason to show the chooser.
    const alreadyInDiagnosis=typeof mode!=='undefined'&&mode==='diagnosis';
    const alreadyViewing=String(api.viewedId?.(c)??'')===String(request.id);
    try{
      if(!alreadyInDiagnosis||!alreadyViewing){
        situationId=request.situations?.[0]?.id||null;
        selected=null;
      }
      mode='diagnosis';
    }catch(_){return false;}

    const launch=document.querySelector('#diagnosisLaunchDialog');
    if(launch?.open)launch.close();
    const history=document.querySelector('#requestHistoryDialog');
    if(history?.open)history.close();
    if(typeof renderRequests==='function')renderRequests();
    if(typeof renderMode==='function')renderMode();
    return true;
  }

  const call=(method,...args)=>{
    const api=service();
    return typeof api?.[method]==='function'?api[method](...args):null;
  };

  window.DiagnostikaDiagnosis=Object.freeze({
    version:'7E',
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
