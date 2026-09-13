'use strict';

(() => {
  if (window.__diagnostikaIntegrationStorageReady) return;
  window.__diagnostikaIntegrationStorageReady = true;

  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';
  const FILE_NAME='integrations.json';
  const LS_KEY='diagnostika-integrations-v1';

  const clone=v=>JSON.parse(JSON.stringify(v ?? {}));

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(HANDLE_DB,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  async function getSavedHandle(){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readonly');
      const req=tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>db.close();
    });
  }

  async function saveHandle(handle){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');
      tx.objectStore(HANDLE_STORE).put(handle,HANDLE_KEY);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }

  async function permission(handle,mode='read',request=false){
    if(!handle) return false;
    try{
      let p=await handle.queryPermission({mode});
      if(p!=='granted' && request) p=await handle.requestPermission({mode});
      return p==='granted';
    }catch(_){return false;}
  }

  async function rootHandle({request=false}={}){
    let handle=await getSavedHandle();
    if(handle && await permission(handle,'readwrite',request)) return handle;
    if(!request || !('showDirectoryPicker' in window)) return null;
    handle=await window.showDirectoryPicker({mode:'readwrite'});
    if(!(await permission(handle,'readwrite',true))) throw new Error('Доступ к подключённой папке не разрешён.');
    await saveHandle(handle);
    return handle;
  }

  async function appDir({request=false,create=false}={}){
    const root=await rootHandle({request});
    if(!root) return null;
    try{return await root.getDirectoryHandle(APP_DIR,{create});}
    catch(e){if(e?.name==='NotFoundError'&&!create)return null;throw e;}
  }

  async function readFolder(){
    const dir=await appDir({request:false,create:false});
    if(!dir) return null;
    try{
      const fh=await dir.getFileHandle(FILE_NAME,{create:false});
      const file=await fh.getFile();
      const value=JSON.parse(await file.text());
      return value&&typeof value==='object'?value:null;
    }catch(e){
      if(e?.name==='NotFoundError') return null;
      throw e;
    }
  }

  async function writeFolder(config,{request=true}={}){
    const dir=await appDir({request,create:true});
    if(!dir) return false;
    const fh=await dir.getFileHandle(FILE_NAME,{create:true});
    const w=await fh.createWritable();
    await w.write(JSON.stringify(config,null,2));
    await w.close();
    return true;
  }

  function readLocal(){
    try{return JSON.parse(localStorage.getItem(LS_KEY)||'null')||null;}catch(_){return null;}
  }

  function writeLocal(config){
    localStorage.setItem(LS_KEY,JSON.stringify(config||{}));
  }

  function merge(local,folder){
    if(!local&&!folder) return {};
    if(!folder) return clone(local);
    if(!local) return clone(folder);
    return {
      ...clone(local),
      ...clone(folder),
      yandex:{...(local.yandex||{}),...(folder.yandex||{})},
      google:{...(local.google||{}),...(folder.google||{})}
    };
  }

  async function load(){
    const local=readLocal();
    let folder=null;
    try{folder=await readFolder();}catch(e){console.warn('Не удалось прочитать integrations.json',e);}
    const cfg=merge(local,folder);
    if(Object.keys(cfg).length) writeLocal(cfg);
    return cfg;
  }

  async function saveConfig(config,{folder=true,requestFolder=true}={}){
    const clean={...clone(config),updatedAt:new Date().toISOString()};
    writeLocal(clean);
    let folderSaved=false;
    let folderError='';
    if(folder){
      try{folderSaved=await writeFolder(clean,{request:requestFolder});}
      catch(e){folderError=e?.message||String(e);}
    }
    return {config:clean,folderSaved,folderError};
  }

  function mask(v){
    v=String(v||'');
    if(v.length<=8) return v?'••••••••':'';
    return v.slice(0,4)+'••••••••'+v.slice(-4);
  }

  window.DiagnostikaIntegrationStorage={load,save:saveConfig,readLocal,writeLocal,readFolder,writeFolder,mask};
})();