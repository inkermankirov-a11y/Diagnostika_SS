'use strict';

(() => {
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';
  const STATE_KEY='diagnostika-web-v1';
  const BROWSER_UPDATED_KEY='diagnostika-browser-updated-at';

  const clone=v=>JSON.parse(JSON.stringify(v));

  function isBlank(v){
    return v===undefined || v===null || v==='';
  }

  function mergeObjects(a,b,preferA=true){
    if(Array.isArray(a) || Array.isArray(b)) return mergeArrays(Array.isArray(a)?a:[],Array.isArray(b)?b:[],preferA);
    if(a && typeof a==='object' && b && typeof b==='object'){
      const out={};
      const keys=new Set([...Object.keys(a),...Object.keys(b)]);
      for(const k of keys){
        const av=a[k], bv=b[k];
        if(Array.isArray(av) || Array.isArray(bv)) out[k]=mergeArrays(Array.isArray(av)?av:[],Array.isArray(bv)?bv:[],preferA);
        else if(av && typeof av==='object' && bv && typeof bv==='object') out[k]=mergeObjects(av,bv,preferA);
        else if(isBlank(av) && !isBlank(bv)) out[k]=bv;
        else if(isBlank(bv) && !isBlank(av)) out[k]=av;
        else out[k]=preferA ? av : bv;
      }
      return out;
    }
    if(isBlank(a)) return b;
    if(isBlank(b)) return a;
    return preferA?a:b;
  }

  function mergeArrays(a,b,preferA=true){
    const objects=[...a,...b].filter(x=>x&&typeof x==='object');
    const allHaveIds=objects.length>0 && objects.every(x=>x.id);
    if(!allHaveIds){
      const seen=new Set();
      const out=[];
      for(const x of [...a,...b]){
        const key=typeof x==='object'?JSON.stringify(x):String(x);
        if(!seen.has(key)){seen.add(key);out.push(x);}
      }
      return out;
    }
    const map=new Map();
    for(const x of b) if(x?.id) map.set(x.id,clone(x));
    for(const x of a){
      if(!x?.id) continue;
      map.set(x.id,map.has(x.id)?mergeObjects(x,map.get(x.id),preferA):clone(x));
    }
    return [...map.values()];
  }

  function mergeStates(a,b,preferA){
    const base=mergeObjects(a||{clients:[]},b||{clients:[]},preferA);
    base.clients=mergeArrays(a?.clients||[],b?.clients||[],preferA);
    return base;
  }

  function openHandleDb(){
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
    const db=await openHandleDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readonly');
      const req=tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>db.close();
    });
  }

  async function saveHandle(handle){
    const db=await openHandleDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');
      tx.objectStore(HANDLE_STORE).put(handle,HANDLE_KEY);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }

  async function getWriteHandle(){
    let handle=await getSavedHandle();
    if(handle){
      try{
        let p=await handle.queryPermission({mode:'readwrite'});
        if(p!=='granted') p=await handle.requestPermission({mode:'readwrite'});
        if(p==='granted') return handle;
      }catch(e){}
    }
    handle=await window.showDirectoryPicker({mode:'readwrite'});
    let p=await handle.queryPermission({mode:'readwrite'});
    if(p!=='granted') p=await handle.requestPermission({mode:'readwrite'});
    if(p!=='granted') throw new Error('Доступ к папке не разрешён.');
    await saveHandle(handle);
    return handle;
  }

  async function readJson(dir,name){
    try{
      const fh=await dir.getFileHandle(name,{create:false});
      const f=await fh.getFile();
      return JSON.parse(await f.text());
    }catch(e){
      if(e?.name==='NotFoundError') return null;
      throw e;
    }
  }

  async function readClientsFromFolders(app){
    let clientsDir;
    try{
      clientsDir=await app.getDirectoryHandle('clients',{create:false});
    }catch(e){
      if(e?.name==='NotFoundError') return {clients:[],folders:0,errors:0};
      throw e;
    }

    const clients=[];
    let folders=0;
    let errors=0;
    for await (const [name,handle] of clientsDir.entries()){
      if(handle.kind!=='directory') continue;
      folders++;
      try{
        const client=await readJson(handle,'client.json');
        if(client && typeof client==='object'){
          if(!client.id){
            const suffix=String(name).split('_').pop();
            client.id=suffix || `folder-${folders}`;
          }
          if(!client.name){
            client.name=String(name).replace(/_[^_]+$/,'') || 'Клиент';
          }
          clients.push(client);
        }
      }catch(e){
        errors++;
        console.warn(`Не удалось прочитать клиента из папки ${name}`,e);
      }
    }
    return {clients,folders,errors};
  }

  async function writeJson(dir,name,data){
    const fh=await dir.getFileHandle(name,{create:true});
    const w=await fh.createWritable();
    await w.write(JSON.stringify(data,null,2));
    await w.close();
  }

  function safeName(v,fallback='item'){
    const s=String(v||'').trim().replace(/[<>:\"/\\|?*\x00-\x1F]/g,'_').replace(/[. ]+$/g,'').slice(0,80);
    return s||fallback;
  }
  function shortId(v){return String(v||'id').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,8)||'id';}

  async function writeStateTree(app,data){
    await writeJson(app,'database.json',data);
    await writeJson(app,'settings.json',{
      format:'diagnostika-folder-v4',
      updatedAt:new Date().toISOString(),
      clientCount:Array.isArray(data.clients)?data.clients.length:0
    });
    const clientsDir=await app.getDirectoryHandle('clients',{create:true});
    for(const c of data.clients||[]){
      const cd=await clientsDir.getDirectoryHandle(`${safeName(c.name,'client')}_${shortId(c.id)}`,{create:true});
      await writeJson(cd,'client.json',c);
      const sessionsDir=await cd.getDirectoryHandle('sessions',{create:true});
      for(let i=0;i<(c.sessions||[]).length;i++){
        const s=c.sessions[i];
        const sd=await sessionsDir.getDirectoryHandle(`session_${String(i+1).padStart(3,'0')}_${shortId(s.id)}`,{create:true});
        await writeJson(sd,'session.json',s);
      }
    }
  }

  async function synchronize(){
    if(!('showDirectoryPicker' in window)) throw new Error('Этот браузер не поддерживает синхронизацию с папкой. Используй Chrome или Edge.');
    const handle=await getWriteHandle();
    let app;
    try{app=await handle.getDirectoryHandle(APP_DIR,{create:false});}
    catch(e){if(e?.name==='NotFoundError') app=await handle.getDirectoryHandle(APP_DIR,{create:true}); else throw e;}

    const databaseState=await readJson(app,'database.json');
    const scanned=await readClientsFromFolders(app);
    const clientsState={clients:scanned.clients};

    // Папки clients являются полноценным источником данных. Сначала добавляем
    // в database.json всех клиентов, найденных в отдельных client.json.
    const folderState=mergeStates(clientsState,databaseState,true);

    const folderSettings=await readJson(app,'settings.json');
    const browserUpdated=Date.parse(localStorage.getItem(BROWSER_UPDATED_KEY)||'')||0;
    const folderUpdated=Date.parse(folderSettings?.updatedAt||'')||0;
    const preferBrowser=!databaseState || browserUpdated>folderUpdated;
    const merged=mergeStates(state,folderState,preferBrowser);

    localStorage.setItem(STATE_KEY,JSON.stringify(merged));
    await writeStateTree(app,merged);
    localStorage.setItem(BROWSER_UPDATED_KEY,new Date().toISOString());
    return {
      count:merged.clients?.length||0,
      folder:handle.name,
      scannedFolders:scanned.folders,
      scannedClients:scanned.clients.length,
      errors:scanned.errors
    };
  }

  function simplifyDialog(){
    const dlg=document.querySelector('.storage-dialog');
    if(!dlg || dlg.dataset.simpleSync==='1') return;
    dlg.dataset.simpleSync='1';

    const info=dlg.querySelector('.storage-info');
    if(info) info.textContent='Изменения сохраняются автоматически. «Синхронизировать» дополнительно проверяет все отдельные папки клиентов и возвращает в базу клиентов, которых нет в браузере.';

    const actions=dlg.querySelector('.storage-actions-main');
    if(!actions) return;
    actions.querySelector('#storageChoose')?.remove();
    actions.querySelector('#storageRestore')?.remove();
    actions.querySelector('#storageExport')?.remove();

    const sync=document.createElement('button');
    sync.id='storageSync';
    sync.type='button';
    sync.className='storage-primary';
    sync.textContent='Синхронизировать';
    actions.prepend(sync);

    const disconnect=actions.querySelector('#storageDisconnect');
    if(disconnect){
      disconnect.textContent='Отключить папку';
      disconnect.style.background='transparent';
      disconnect.style.boxShadow='none';
      disconnect.style.border='0';
      disconnect.style.textDecoration='underline';
      disconnect.style.opacity='.72';
    }

    sync.onclick=async()=>{
      try{
        sync.disabled=true;
        sync.textContent='Синхронизация…';
        const result=await synchronize();
        const extra=result.errors?`\nНе удалось прочитать папок: ${result.errors}.`:'';
        await AppDialog.alert(
          `Проверено папок клиентов: ${result.scannedFolders}.\nНайдено client.json: ${result.scannedClients}.\nВ базе после синхронизации: ${result.count} клиент(ов).${extra}`,
          'Синхронизация завершена'
        );
        location.reload();
      }catch(e){
        if(e?.name!=='AbortError') await AppDialog.alert(e?.message||'Не удалось выполнить синхронизацию.','Ошибка');
      }finally{
        sync.disabled=false;
        sync.textContent='Синхронизировать';
      }
    };
  }

  if(typeof save==='function'){
    const prevSave=save;
    save=function(){
      localStorage.setItem(BROWSER_UPDATED_KEY,new Date().toISOString());
      return prevSave.apply(this,arguments);
    };
  }

  simplifyDialog();
  const mo=new MutationObserver(()=>simplifyDialog());
  mo.observe(document.body,{childList:true,subtree:true});
})();
