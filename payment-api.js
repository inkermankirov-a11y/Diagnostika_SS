'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaPayments?.moduleAware===true)return;

  const legacy=window.DiagnostikaPayments&&typeof window.DiagnostikaPayments==='object'
    ? window.DiagnostikaPayments
    : {};
  const service=()=>platform.services?.payments||null;
  const invoke=(name,args,failValue)=>{
    if(platform.api?.invokeService)return platform.api.invokeService('payments',name,args,failValue);
    const fn=service()?.[name];
    try{return typeof fn==='function'?fn(...args):failValue;}catch(_){return failValue;}
  };

  const facade={
    ...legacy,
    version:'5D',
    moduleAware:true,
    events:Object.freeze({
      updated:'payment:updated',
      added:'payment:added',
      deleted:'payment:deleted',
      sessionUpdated:'session-payment:updated'
    }),
    request(requestRef,clientRef){return invoke('request',[requestRef,clientRef],null);},
    session(sessionRef,clientRef){return invoke('session',[sessionRef,clientRef],null);},
    updateRequest(requestRef,changes={},options={}){return invoke('updateRequest',[requestRef,changes,options],null);},
    replaceRequest(requestRef,payment=null,options={}){return invoke('replaceRequest',[requestRef,payment,options],null);},
    addPayment(requestRef,data={},options={}){return invoke('addPayment',[requestRef,data,options],null);},
    updatePayment(requestRef,paymentId,changes={},options={}){return invoke('updatePayment',[requestRef,paymentId,changes,options],null);},
    removePayment(requestRef,paymentId,options={}){return invoke('removePayment',[requestRef,paymentId,options],null);},
    replaceSession(sessionRef,payment=null,options={}){return invoke('replaceSession',[sessionRef,payment,options],null);},
    updateSession(sessionRef,changes={},options={}){return invoke('updateSession',[sessionRef,changes,options],null);}
  };

  window.DiagnostikaPayments=Object.freeze(facade);
})();
