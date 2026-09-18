'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.ai)return;

  const EVENTS=Object.freeze({
    clientUpdated:'ai-client-chat:updated',
    clientMessageAdded:'ai-client-chat:message-added',
    sessionUpdated:'ai-session-chat:updated',
    sessionMessageAdded:'ai-session-chat:message-added'
  });

  const now=()=>new Date().toISOString();
  const clone=value=>{
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  };
  const makeId=prefix=>{
    try{if(crypto?.randomUUID)return crypto.randomUUID();}catch(_){}
    return prefix+'_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  };

  function clientsService(){
    return platform.services?.clients||window.DiagnostikaClients||null;
  }
  function sessionsService(){
    return platform.services?.sessions
      ||(window.DiagnostikaSessions?.moduleAware===true?window.DiagnostikaSessions:null)
      ||null;
  }

  function resolveClient(clientRef){
    if(clientRef&&typeof clientRef==='object'){
      const id=clientRef.id;
      if(id!==undefined&&id!==null&&id!==''){
        const via=clientsService()?.findById?.(id);
        if(via)return via;
        try{
          const rows=platform.store?.clients?.()||[];
          const found=rows.find(c=>c&&String(c.id)===String(id));
          if(found)return found;
        }catch(_){}
      }
      return clientRef;
    }
    if(clientRef!==undefined&&clientRef!==null&&clientRef!==''){
      const via=clientsService()?.findById?.(clientRef);
      if(via)return via;
      try{
        const rows=platform.store?.clients?.()||[];
        return rows.find(c=>c&&String(c.id)===String(clientRef))||null;
      }catch(_){return null;}
    }
    const current=clientsService()?.current?.();
    if(current)return current;
    try{return platform.store?.currentClient?.()||null;}catch(_){}
    try{return typeof client==='function'?client():null;}catch(_){return null;}
  }

  function resolveSession(sessionRef,c){
    if(!c)return null;
    if(sessionRef&&typeof sessionRef==='object'){
      const id=sessionRef.id;
      if(id!==undefined&&id!==null&&id!==''){
        return sessionsService()?.get?.(id,c)
          ||(c.sessions||[]).find(s=>s&&String(s.id)===String(id))
          ||null;
      }
      return sessionRef;
    }
    if(sessionRef===undefined||sessionRef===null||sessionRef==='')return null;
    return sessionsService()?.get?.(sessionRef,c)
      ||(c.sessions||[]).find(s=>s&&String(s.id)===String(sessionRef))
      ||null;
  }

  function persist(){
    try{
      return platform.store?.legacySave?.()===true;
    }catch(error){
      console.error('[DiagnostikaPlatform] AI persistence failed',error);
      return false;
    }
  }

  function emit(type,detail={}){
    const payload=Object.freeze({
      ...detail,
      source:detail.source||'ai-service',
      emittedAt:detail.emittedAt||now()
    });
    try{return platform.events?.emit?.(type,payload)||0;}catch(_){return 0;}
  }

  function normalizeRole(role){
    return role==='assistant'?'assistant':'user';
  }

  function normalizeMessage(data={},prefix='ai-chat'){
    if(!data||typeof data!=='object')return null;
    const text=String(data.text??'').trim();
    if(!text)return null;
    return {
      id:data.id||makeId(prefix),
      role:normalizeRole(data.role),
      text,
      createdAt:data.createdAt??Date.now(),
      ...(data.meta&&typeof data.meta==='object'?{meta:clone(data.meta)}:{})
    };
  }

  function clientChat(clientRef){
    const c=resolveClient(clientRef);
    return c&&Array.isArray(c.aiChat)?clone(c.aiChat):null;
  }

  function sessionChat(sessionRef,clientRef){
    const c=resolveClient(clientRef);
    const s=resolveSession(sessionRef,c);
    return s&&Array.isArray(s.aiChat)?clone(s.aiChat):null;
  }

  function replaceClientChat(clientRef,nextChat,options={}){
    const c=resolveClient(options.client??clientRef??options.clientId);
    if(!c||!Array.isArray(nextChat))return null;
    const before=clone(c.aiChat);
    c.aiChat=clone(nextChat)||[];
    if(!persist()){
      if(before===undefined)delete c.aiChat;else c.aiChat=before;
      return null;
    }
    emit(EVENTS.clientUpdated,{
      clientId:c.id,
      change:'replace',
      before,
      after:clone(c.aiChat),
      source:options.source||'ai-service-client-replace'
    });
    return clone(c.aiChat);
  }

  function appendClientMessage(clientRef,data={},options={}){
    const c=resolveClient(options.client??clientRef??options.clientId);
    const message=normalizeMessage(data,'client-chat');
    if(!c||!message)return null;
    const existed=Array.isArray(c.aiChat);
    if(!existed)c.aiChat=[];
    if(c.aiChat.some(x=>x&&String(x.id)===String(message.id)))return null;
    c.aiChat.push(message);
    if(!persist()){
      c.aiChat.pop();
      if(!existed)delete c.aiChat;
      return null;
    }
    emit(EVENTS.clientMessageAdded,{
      clientId:c.id,
      messageId:message.id,
      role:message.role,
      message:clone(message),
      source:options.source||'ai-service-client-message-add'
    });
    emit(EVENTS.clientUpdated,{
      clientId:c.id,
      change:'message-added',
      messageId:message.id,
      after:clone(c.aiChat),
      source:options.source||'ai-service-client-message-add'
    });
    return clone(message);
  }

  function clearClientChat(clientRef,options={}){
    return replaceClientChat(clientRef,[],{
      ...options,
      source:options.source||'ai-service-client-clear'
    });
  }

  function replaceSessionChat(sessionRef,nextChat,options={}){
    const c=resolveClient(options.client??options.clientId);
    const s=resolveSession(sessionRef,c);
    if(!c||!s||!Array.isArray(nextChat))return null;
    const before=clone(s.aiChat);
    s.aiChat=clone(nextChat)||[];
    if(!persist()){
      if(before===undefined)delete s.aiChat;else s.aiChat=before;
      return null;
    }
    emit(EVENTS.sessionUpdated,{
      clientId:c.id,
      requestId:s.requestId||null,
      sessionId:s.id,
      change:'replace',
      before,
      after:clone(s.aiChat),
      source:options.source||'ai-service-session-replace'
    });
    return clone(s.aiChat);
  }

  function appendSessionMessage(sessionRef,data={},options={}){
    const c=resolveClient(options.client??options.clientId);
    const s=resolveSession(sessionRef,c);
    const message=normalizeMessage(data,'session-chat');
    if(!c||!s||!message)return null;
    const existed=Array.isArray(s.aiChat);
    if(!existed)s.aiChat=[];
    if(s.aiChat.some(x=>x&&String(x.id)===String(message.id)))return null;
    s.aiChat.push(message);
    if(!persist()){
      s.aiChat.pop();
      if(!existed)delete s.aiChat;
      return null;
    }
    emit(EVENTS.sessionMessageAdded,{
      clientId:c.id,
      requestId:s.requestId||null,
      sessionId:s.id,
      messageId:message.id,
      role:message.role,
      message:clone(message),
      source:options.source||'ai-service-session-message-add'
    });
    emit(EVENTS.sessionUpdated,{
      clientId:c.id,
      requestId:s.requestId||null,
      sessionId:s.id,
      change:'message-added',
      messageId:message.id,
      after:clone(s.aiChat),
      source:options.source||'ai-service-session-message-add'
    });
    return clone(message);
  }

  function clearSessionChat(sessionRef,options={}){
    return replaceSessionChat(sessionRef,[],{
      ...options,
      source:options.source||'ai-service-session-clear'
    });
  }

  services.ai=Object.freeze({
    events:EVENTS,
    clientChat,
    sessionChat,
    appendClientMessage,
    replaceClientChat,
    clearClientChat,
    appendSessionMessage,
    replaceSessionChat,
    clearSessionChat
  });
})();
