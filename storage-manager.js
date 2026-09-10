'use strict';

(() => {
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';
  let rootHandle=null;
  let appHandle=null;
  let syncTimer=null;
  let syncing=false;
  let pendingSync=false;

  function handleDb(){
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

  async function saveHandle(handle){
    const db=await handleDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');
      tx.objectStore(HANDLE_STORE).put(handle,HANDLE_KEY);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }

  async function loadHandle(){
    const db=await handleDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readonly');
      const req=tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>db.close();
    });
  }

  async function clearHandle(){
    const db=await handleDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');
      tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }

  function safeName(v,fallback='item'){
    const s=String(v||'').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/[. ]+$/g,'').slice(0,80);
    return s||fallback;
  }

  function shortId(v){ return String(v||'id').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,8)||'id'; }

  async function getAppHandle(){
    if(appHandle) return appHandle;
    if(!rootHandle) throw new Error('Папка не выбрана.');
    appHandle=await rootHandle.getDirectoryHandle(APP_DIR,{create:true});
    return appHandle;
  }

  async function writeBlob(dir,name,blob){
    const file=await dir.getFileHandle(name,{create:true});
    const w=await file.createWritable();
    await w.write(blob);
    await w.close();
  }

  async function writeJson(dir,name,data){
    await writeBlob(dir,name,new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));
  }

  async function ensureClientDir(c){
    const app=await getAppHandle();
    const clients=await app.getDirectoryHandle('clients',{create:true});
    return clients.getDirectoryHandle(`${safeName(c.name,'client')}_${shortId(c.id)}`,{create:true});
  }

  async function ensureSessionDir(c,s,index){
    const cd=await ensureClientDir(c);
    const sessions=await cd.getDirectoryHandle('sessions',{create:true});
    return sessions.getDirectoryHandle(`session_${String(index+1).padStart(3,'0')}_${shortId(s.id)}`,{create:true});
  }

  async function writeCoreState(){
    if(!appHandle && !rootHandle) return;
    const app=await getAppHandle();
    await writeJson(app,'database.json',state);
    await writeJson(app,'settings.json',{
      format:'diagnostika-folder-v1',
      updatedAt:new Date().toISOString(),
      clientCount:Array.isArray(state.clients)?state.clients.length:0
    });
    for(const c of state.clients||[]){
      const cd=await ensureClientDir(c);
      const compact={...c,sessions:(c.sessions||[]).map(s=>({...s}))};
      await writeJson(cd,'client.json',compact);
      const sessions=c.sessions||[];
      for(let i=0;i<sessions.length;i++){
        const sd=await ensureSessionDir(c,sessions[i],i);
        await writeJson(sd,'session.json',sessions[i]);
      }
    }
  }

  async function mirrorRecord(rec){
    if(!rec?.blob || (!appHandle && !rootHandle)) return;
    const c=(state.clients||[]).find(x=>x.id===rec.clientId);
    if(!c) return;
    const index=(c.sessions||[]).findIndex(x=>x.id===rec.sessionId);
    if(index<0) return;
    const s=c.sessions[index];
    const sd=await ensureSessionDir(c,s,index);
    const fd=await sd.getDirectoryHandle('files',{create:true});
    const name=`${shortId(rec.id)}_${safeName(rec.name,'file')}`;
    await writeBlob(fd,name,rec.blob);
  }

  async function removeMirroredRecord(rec){
    if(!rec || (!appHandle && !rootHandle)) return;
    try{
      const c=(state.clients||[]).find(x=>x.id===rec.clientId);
      if(!c) return;
      const index=(c.sessions||[]).findIndex(x=>x.id===rec.sessionId);
      if(index<0) return;
      const sd=await ensureSessionDir(c,c.sessions[index],index);
      const fd=await sd.getDirectoryHandle('files',{create:true});
      await fd.removeEntry(`${shortId(rec.id)}_${safeName(rec.name,'file')}`);
    }catch(e){ console.warn('Не удалось удалить зеркальную копию файла',e); }
  }

  async function fullExport(){
    await writeCoreState();
    if(typeof mediaDbList==='function'){
      for(const c of state.clients||[]){
        for(const s of c.sessions||[]){
          const files=await mediaDbList(s.id);
          for(const rec of files) await mirrorRecord(rec);
        }
      }
    }
  }

  async function doSync(){
    if(syncing){pendingSync=true;return;}
    if(!rootHandle && !appHandle) return;
    syncing=true;
    try{ await writeCoreState(); updateStatus(); }
    catch(e){ console.warn('Синхронизация папки не выполнена',e); }
    finally{
      syncing=false;
      if(pendingSync){pendingSync=false;scheduleSync();}
    }
  }

  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(doSync,450);
  }

  async function permission(handle,ask=false){
    if(!handle) return 'denied';
    const opts={mode:'readwrite'};
    let p=await handle.queryPermission(opts);
    if(p!=='granted' && ask) p=await handle.requestPermission(opts);
    return p;
  }

  let btn=document.querySelector('#storageBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='storageBtn';
    btn.className='header-btn storage-btn';
    btn.textContent='Хранилище';
    const anchor=document.querySelector('#clientBaseBtn');
    if(anchor) anchor.insertAdjacentElement('afterend',btn);
  }else{
    btn.classList.add('storage-btn');
  }

  const dlg=document.createElement('dialog');
  dlg.className='storage-dialog';
  dlg.innerHTML=`
    <div class="storage-shell">
      <div class="storage-title">ХРАНИЛИЩЕ ДАННЫХ</div>
      <div id="storageStatus" class="storage-status"></div>
      <div class="storage-info">
        Программа продолжает хранить рабочую копию в браузере. Выбранная папка используется как переносимая копия базы и файлов.
      </div>
      <div class="storage-actions-main">
        <button id="storageChoose" type="button" class="storage-primary">Выбрать папку на компьютере</button>
        <button id="storageExport" type="button">Перенести текущую базу и файлы</button>
        <button id="storageDisconnect" type="button">Отключить папку</button>
      </div>
      <div class="storage-example">В выбранной папке будет создано:<br><code>Diagnostika / database.json / clients / ...</code></div>
      <div class="storage-footer"><button id="storageClose" type="button">Закрыть</button></div>
    </div>`;
  document.body.appendChild(dlg);

  const status=dlg.querySelector('#storageStatus');
  const exportBtn=dlg.querySelector('#storageExport');
  const disconnectBtn=dlg.querySelector('#storageDisconnect');

  async function updateStatus(){
    if(!('showDirectoryPicker' in window)){
      status.className='storage-status bad';
      status.textContent='Этот браузер не поддерживает прямую работу с папками. Используй Chrome или Edge.';
      exportBtn.disabled=true;disconnectBtn.disabled=true;return;
    }
    if(!rootHandle){
      status.className='storage-status neutral';
      status.textContent='Папка пока не выбрана.';
      exportBtn.disabled=true;disconnectBtn.disabled=true;return;
    }
    let p='prompt';
    try{p=await permission(rootHandle,false);}catch(e){}
    status.className='storage-status '+(p==='granted'?'good':'warn');
    status.textContent=p==='granted' ? `Подключено: ${rootHandle.name} / ${APP_DIR}` : `Папка ${rootHandle.name} сохранена, но браузеру нужно снова разрешить доступ.`;
    exportBtn.disabled=false;disconnectBtn.disabled=false;
  }

  dlg.querySelector('#storageChoose').onclick=async()=>{
    if(!('showDirectoryPicker' in window)) return updateStatus();
    try{
      const h=await window.showDirectoryPicker({mode:'readwrite'});
      if(await permission(h,true)!=='granted') return alert('Доступ к папке не разрешён.');
      rootHandle=h;appHandle=null;
      await saveHandle(h);
      await getAppHandle();
      await fullExport();
      await updateStatus();
      alert('Папка подключена. Текущая база и файлы перенесены.');
    }catch(e){ if(e?.name!=='AbortError'){console.error(e);alert('Не удалось подключить папку.');} }
  };

  exportBtn.onclick=async()=>{
    if(!rootHandle) return;
    try{
      if(await permission(rootHandle,true)!=='granted') return alert('Разреши доступ к папке.');
      exportBtn.disabled=true;exportBtn.textContent='Переношу…';
      await fullExport();
      alert('База и файлы обновлены в папке.');
    }catch(e){console.error(e);alert('Не удалось перенести данные.');}
    finally{exportBtn.textContent='Перенести текущую базу и файлы';exportBtn.disabled=false;}
  };

  disconnectBtn.onclick=async()=>{
    if(!confirm('Отключить папку? Данные в самой папке удалены не будут.')) return;
    rootHandle=null;appHandle=null;
    await clearHandle();
    await updateStatus();
  };

  dlg.querySelector('#storageClose').onclick=()=>dlg.close();
  btn.onclick=async()=>{await updateStatus();dlg.showModal();};
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  const originalSave=save;
  save=function(){ originalSave(); scheduleSync(); };

  if(typeof mediaDbPut==='function'){
    const originalPut=mediaDbPut;
    mediaDbPut=async function(record){
      const result=await originalPut(record);
      try{await mirrorRecord(record);}catch(e){console.warn('Файл сохранён в браузере, но не скопирован в папку',e);}
      return result;
    };
  }

  if(typeof mediaDbDelete==='function'){
    const originalDelete=mediaDbDelete;
    mediaDbDelete=async function(id){
      let rec=null;
      try{if(typeof mediaDbGet==='function')rec=await mediaDbGet(id);}catch(e){}
      const result=await originalDelete(id);
      if(rec) await removeMirroredRecord(rec);
      return result;
    };
  }

  (async()=>{
    if(!('showDirectoryPicker' in window)) return;
    try{
      rootHandle=await loadHandle();
      if(rootHandle && await permission(rootHandle,false)==='granted'){
        appHandle=null;
        await getAppHandle();
        scheduleSync();
      }
    }catch(e){console.warn('Не удалось восстановить выбранную папку',e);}
  })();
})();
