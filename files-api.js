'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaFiles?.moduleAware===true)return;

  const service=()=>platform.services?.files||null;
  const invoke=(name,args,failValue)=>{
    if(platform.api?.invokeServiceAsync)return platform.api.invokeServiceAsync('files',name,args,failValue);
    const fn=service()?.[name];
    try{return typeof fn==='function'?Promise.resolve(fn(...args)):Promise.resolve(failValue);}
    catch(_){return Promise.resolve(failValue);}
  };

  window.DiagnostikaFiles=Object.freeze({
    version:'9D',
    moduleAware:true,
    events:Object.freeze({
      created:'file:created',
      deleted:'file:deleted',
      sessionCleared:'file:session-cleared',
      clientCleared:'file:client-cleared'
    }),
    get(id){return invoke('get',[id],null);},
    list(filter={}){return invoke('list',[filter],[]);},
    put(record={},options={}){return invoke('put',[record,options],null);},
    add(file,context={},options={}){return invoke('add',[file,context,options],null);},
    remove(id,options={}){return invoke('remove',[id,options],null);},
    removeForSession(sessionId,options={}){return invoke('removeForSession',[sessionId,options],[]);},
    removeForClient(clientId,options={}){return invoke('removeForClient',[clientId,options],[]);},
    count(filter={}){return invoke('count',[filter],0);}
  });
})();