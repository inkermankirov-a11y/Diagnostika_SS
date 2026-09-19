'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.files)return;

  const DB_NAME='diagnostika-session-media-v1';
  const STORE_NAME='files';
  const DB_VERSION=1;

  const EVENTS=Object.freeze({
    created:'file:created',
    deleted:'file:deleted',
    sessionCleared:'file:session-cleared',
    clientCleared:'file:client-cleared'
  });

  const now=()=>new Date().toISOString();

  function clone(value){
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    if(value instanceof Blob)return value;
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  }

  function makeId(){
    try{if(typeof uid==='function')return uid();}catch(_){}
    try{if(crypto?.randomUUID)return crypto.randomUUID();}catch(_){}
    return 'file_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          const store=db.createObjectStore(STORE_NAME,{keyPath:'id'});
          store.createIndex('sessionId','sessionId',{unique:false});
          store.createIndex('clientId','clientId',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('File database open failed.'));
    });
  }

  function emit(type,detail={}){
    if(!platform.events?.emit)return 0;
    return platform.events.emit(type,Object.freeze({
      ...detail,
      source:detail.source||'file-service',
      emittedAt:detail.emittedAt||now()
    }));
  }

  async function get(id){
    if(id===undefined||id===null||id==='')return null;
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readonly');
        const req=tx.objectStore(STORE_NAME).get(id);
        req.onsuccess=()=>resolve(clone(req.result||null));
        req.onerror=()=>reject(req.error||tx.error);
      });
    }finally{db.close();}
  }

  async function list(filter={}){
    const db=await openDb();
    try{
      const rows=await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readonly');
        const store=tx.objectStore(STORE_NAME);
        let req;
        if(filter.sessionId!==undefined&&filter.sessionId!==null&&filter.sessionId!==''){
          req=store.index('sessionId').getAll(IDBKeyRange.only(filter.sessionId));
        }else if(filter.clientId!==undefined&&filter.clientId!==null&&filter.clientId!==''){
          req=store.index('clientId').getAll(IDBKeyRange.only(filter.clientId));
        }else{
          req=store.getAll();
        }
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error||tx.error);
      });

      return rows
        .filter(row=>{
          if(filter.sessionId!==undefined&&String(row?.sessionId??'')!==String(filter.sessionId??''))return false;
          if(filter.clientId!==undefined&&String(row?.clientId??'')!==String(filter.clientId??''))return false;
          return true;
        })
        .sort((a,b)=>String(a?.createdAt||'').localeCompare(String(b?.createdAt||'')))
        .map(clone);
    }finally{db.close();}
  }

  async function put(record={},options={}){
    if(!record||typeof record!=='object')return null;
    if(!record.sessionId||!record.clientId)return null;

    const created={...clone(record)};
    created.id=created.id||makeId();
    created.name=String(created.name||'Файл');
    created.type=String(created.type||created.blob?.type||'application/octet-stream');
    created.size=Number(created.size??created.blob?.size??0)||0;
    created.createdAt=created.createdAt||now();

    const db=await openDb();
    try{
      const exists=await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readonly');
        const req=tx.objectStore(STORE_NAME).get(created.id);
        req.onsuccess=()=>resolve(Boolean(req.result));
        req.onerror=()=>reject(req.error||tx.error);
      });
      if(exists&&!options.overwrite)return null;

      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readwrite');
        tx.objectStore(STORE_NAME).put(created);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error||new Error('File write aborted.'));
      });
    }finally{db.close();}

    emit(EVENTS.created,{
      fileId:created.id,
      clientId:created.clientId,
      sessionId:created.sessionId,
      record:clone(created),
      source:options.source||'file-service-put'
    });
    return clone(created);
  }

  async function add(file,context={},options={}){
    if(!(file instanceof Blob))return null;
    if(!context.sessionId||!context.clientId)return null;
    try{navigator.storage?.persist?.().catch(()=>{});}catch(_){}

    return put({
      id:context.id,
      clientId:context.clientId,
      sessionId:context.sessionId,
      name:context.name||file.name||'Файл',
      type:context.type||file.type||'application/octet-stream',
      size:context.size??file.size??0,
      createdAt:context.createdAt,
      blob:file
    },{...options,source:options.source||'file-service-add'});
  }

  async function remove(id,options={}){
    const existing=await get(id);
    if(!existing)return null;

    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error||new Error('File delete aborted.'));
      });
    }finally{db.close();}

    emit(EVENTS.deleted,{
      fileId:existing.id,
      clientId:existing.clientId,
      sessionId:existing.sessionId,
      record:clone(existing),
      source:options.source||'file-service-remove'
    });
    return existing;
  }

  async function removeForSession(sessionId,options={}){
    if(sessionId===undefined||sessionId===null||sessionId==='')return [];
    const rows=await list({sessionId});
    const removed=[];
    for(const row of rows){
      const one=await remove(row.id,{source:options.source||'file-service-session-clear'});
      if(one)removed.push(one);
    }
    emit(EVENTS.sessionCleared,{
      sessionId,
      clientId:options.clientId||removed[0]?.clientId||null,
      count:removed.length,
      source:options.source||'file-service-session-clear'
    });
    return removed;
  }

  async function removeForClient(clientId,options={}){
    if(clientId===undefined||clientId===null||clientId==='')return [];
    const rows=await list({clientId});
    const removed=[];
    for(const row of rows){
      const one=await remove(row.id,{source:options.source||'file-service-client-clear'});
      if(one)removed.push(one);
    }
    emit(EVENTS.clientCleared,{
      clientId,
      count:removed.length,
      source:options.source||'file-service-client-clear'
    });
    return removed;
  }

  async function count(filter={}){
    const rows=await list(filter);
    return rows.length;
  }

  services.files=Object.freeze({
    version:'9D',
    events:EVENTS,
    dbName:DB_NAME,
    storeName:STORE_NAME,
    get,
    list,
    put,
    add,
    remove,
    removeForSession,
    removeForClient,
    count
  });
})();