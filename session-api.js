'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaSessions?.moduleAware===true)return;

  const service=()=>platform.services?.sessions||null;
  const invoke=(name,args,failValue)=>{
    const fn=service()?.[name];
    return typeof fn==='function'?fn(...args):failValue;
  };

  window.DiagnostikaSessions=Object.freeze({
    version:'4B',
    moduleAware:true,
    events:Object.freeze({
      created:'session:created',
      updated:'session:updated',
      deleted:'session:deleted'
    }),
    list(clientRef){return invoke('list',[clientRef],[]);},
    get(id,clientRef){return invoke('get',[id,clientRef],null);},
    create(data={},options={}){return invoke('create',[data,options],null);},
    update(id,changes={},options={}){return invoke('update',[id,changes,options],null);},
    remove(id,options={}){return invoke('remove',[id,options],null);},
    forRequest(requestRef,clientRef){return invoke('forRequest',[requestRef,clientRef],[]);},
    requestId(sessionRef){return invoke('requestId',[sessionRef],null);},
    sessionNumber(clientRef,sessionRef){return invoke('sessionNumber',[clientRef,sessionRef],null);},
    refresh(){return invoke('refresh',[],false);}
  });
})();
