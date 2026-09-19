'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaFiles?.moduleAware===true)return;

  const service=()=>platform.services?.files||null;
  const invoke=(name,args,failValue)=>{
    const fn=service()?.[name];
    return typeof fn==='function'?fn(...args):failValue;
  };

  window.DiagnostikaFiles=Object.freeze({
    version:'9A',
    moduleAware:true,
    events:Object.freeze({
      created:'file:created',
      deleted:'file:deleted',
      sessionCleared:'file:session-cleared',
      clientCleared:'file:client-cleared'
    }),
    get(id){return invoke('get',[id],Promise.resolve(null));},
    list(filter={}){return invoke('list',[filter],Promise.resolve([]));},
    put(record={},options={}){return invoke('put',[record,options],Promise.resolve(null));},
    add(file,context={},options={}){return invoke('add',[file,context,options],Promise.resolve(null));},
    remove(id,options={}){return invoke('remove',[id,options],Promise.resolve(null));},
    removeForSession(sessionId,options={}){return invoke('removeForSession',[sessionId,options],Promise.resolve([]));},
    removeForClient(clientId,options={}){return invoke('removeForClient',[clientId,options],Promise.resolve([]));},
    count(filter={}){return invoke('count',[filter],Promise.resolve(0));}
  });
})();