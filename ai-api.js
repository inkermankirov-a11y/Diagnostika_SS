'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||window.DiagnostikaAI?.moduleAware===true)return;

  const legacy=window.DiagnostikaAI&&typeof window.DiagnostikaAI==='object'
    ? window.DiagnostikaAI
    : {};
  const service=()=>platform.services?.ai||null;
  const invoke=(name,args,failValue)=>{
    const fn=service()?.[name];
    return typeof fn==='function'?fn(...args):failValue;
  };

  window.DiagnostikaAI={
    ...legacy,
    version:'6B',
    moduleAware:true,
    events:Object.freeze({
      clientUpdated:'ai-client-chat:updated',
      clientMessageAdded:'ai-client-chat:message-added',
      sessionUpdated:'ai-session-chat:updated',
      sessionMessageAdded:'ai-session-chat:message-added'
    }),
    clientChat(clientRef){return invoke('clientChat',[clientRef],null);},
    sessionChat(sessionRef,clientRef){return invoke('sessionChat',[sessionRef,clientRef],null);},
    appendClientMessage(clientRef,data={},options={}){return invoke('appendClientMessage',[clientRef,data,options],null);},
    replaceClientChat(clientRef,chat=[],options={}){return invoke('replaceClientChat',[clientRef,chat,options],null);},
    clearClientChat(clientRef,options={}){return invoke('clearClientChat',[clientRef,options],null);},
    appendSessionMessage(sessionRef,data={},options={}){return invoke('appendSessionMessage',[sessionRef,data,options],null);},
    replaceSessionChat(sessionRef,chat=[],options={}){return invoke('replaceSessionChat',[sessionRef,chat,options],null);},
    clearSessionChat(sessionRef,options={}){return invoke('clearSessionChat',[sessionRef,options],null);}
  };
})();
