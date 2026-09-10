'use strict';

(() => {
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';
  const STATE_KEY='diagnostika-web-v1';

  let rootHandle=null;
  let appHandle=null;
  let syncTimer=null;
  let syncing=false;
  let pendingSync=false;
  let folderState=null;

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
    const s=String(v||'').trim().replace(/[<>:\"/\\|?*\x00-\x1F]/g,'_').replace(/[. ]+$/g,'').slice(0,80);
    return s||fallback;
  }

  function shortId(v){
    return String(v||'id').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,8)||'id';
  }

  async function permission(handle,ask=false){
    if(!handle) return 'denied';
    const opts={mode:'readwrite'};
    let p=await handle.queryPermission(opts);
    if(p!=='granted' && ask) p=await handle.requestPermission(opts);
    return p;
  }

  async function getExistingAppHandle(){
    if(appHandle) return appHandle;
    if(!rootHandle) return null;
    try{
      appHandle=await rootHandle.getDirectoryHandle(APP_DIR,{create:false});
      return appHandle;
    }catch(e){
      if(e?.name==='NotFoundError') return null;
      throw e;
    }
  }

  async function getOrCreateAppHandle(){
    if(appHandle) return appHandle;
    if(!rootHandle) throw new Error('Папка не выбрана.');
    appHandle=await rootHandle.getDirectoryHandle(APP_DIR,{create:true});
    return appHandle;
  }

  async function readJson(dir,name){
    try{
      const h=await dir.getFileHandle(name,{create:false});
      const f=await h.getFile();
      return JSON.parse(await f.text());
    }catch(e){
      if(e?.name==='NotFoundError') return null;
      console.warn(`Не удалось прочитать ${name}`,e);
      return null;
    }
  }

  async function readFolderState(){
    const app=await getExistingAppHandle();
    if(!app) return null;
    const data=await readJson(app,'database.json');
    if(!data || !Array.isArray(data.clients)) return null;
    return data;
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
    const app=await getOrCreateAppHandle();
    const clients=await app.getDirectoryHandle('clients',{create:true});
    return clients.getDirectoryHandle(`${safeName(c.name,'client')}_${shortId(c.id)}`,{create:true});
  }

  async function ensureSessionDir(c,s,index){
    const cd=await ensureClientDir(c);
    const sessions=await cd.getDirectoryHandle('sessions',{create:true});
    return sessions.getDirectoryHandle(`session_${String(index+1).padStart(3,'0')}_${shortId(s.id)}`,{create:true});
  }

  async function writeCoreState(){
    if(!rootHandle) return;
    const app=await getOrCreateAppHandle();
    await writeJson(app,'database.json',state);
    await writeJson(app,'settings.json',{
      format:'diagnostika-folder-v2',
      updatedAt:new Date().toISOString(),
      clientCount:Array.isArray(state.clients)?state.clients.length:0
    });

    for(const c of state.clients||[]){
      const cd=await ensureClientDir(c);
      await writeJson(cd,'client.json',{...c,sessions:(c.sessions||[]).map(s=>({...s}))});
      const sessions=c.sessions||[];
      for(let i=0;i<sessions.length;i++){
        const sd=await ensureSessionDir(c,sessions[i],i);
        await writeJson(sd,'session.json',sessions[i]);
      }
    }
    folderState=JSON.parse(JSON.stringify(state));
  }

  async function mirrorRecord(rec){
    if(!rec?.blob || !rootHandle) return;
    const c=(state.clients||[]).find(x=>x.id===rec.clientId);
    if(!c) return;
    const index=(c.sessions||[]).findIndex(x=>x.id===rec.sessionId);
    if(index<0) return;
    const sd=await ensureSessionDir(c,c.sessions[index],index);
    const fd=await sd.getDirectoryHandle('files',{create:true});
    await writeBlob(fd,`${shortId(rec.id)}_${safeName(rec.name,'file')}`,rec.blob);
  }

  async function removeMirroredRecord(rec){
    if(!rec || !rootHandle) return;
    try{
      const c=(state.clients||[]).find(x=>x.id===rec.clientId);
      if(!c) return;
      const index=(c.sessions||[]).findIndex(x=>x.id===rec.sessionId);
      if(index<0) return;
      const sd=await ensureSessionDir(c,c.sessions[index],index);
      const fd=await sd.getDirectoryHandle('files',{create:true});
      await fd.removeEntry(`${shortId(rec.id)}_${safeName(rec.name,'file')}`);
    }catch(e){
      console.warn('Не удалось удалить зеркальную копию файла',e);
    }
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

  function browserClientCount(){
    return Array.isArray(state?.clients)?state.clients.length:0;
  }

  function folderClientCount(){
    return Array.isArray(folderState?.clients)?folderState.clients.length:0;
  }

  async function restoreFromFolder(){
    folderState=await readFolderState();
    if(!folderState) throw new Error('В выбранной папке не найден корректный database.json.');

    const count=folderClientCount();
    if(!confirm(`Восстановить базу из папки?\n\nБудет загружено клиентов: ${count}.\nТекущая база этого браузера будет заменена.`)) return false;

    try{ localStorage.setItem(STATE_KEY,JSON.stringify(folderState)); }
    catch(e){ throw new Error('Не удалось сохранить восстановленную базу в браузере.'); }

    alert(`База восстановлена. Клиентов: ${count}.\nСтраница сейчас перезагрузится.`);
    location.reload();
    return true;
  }

  async function doSync(){
    if(syncing){pendingSync=true;return;}
    if(!rootHandle) return;
    syncing=true;
    try{
      await writeCoreState();
      await updateStatus();
    }catch(e){
      console.warn('Синхронизация папки не выполнена',e);
    }finally{
      syncing=false;
      if(pendingSync){pendingSync=false;scheduleSync();}
    }
  }

  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(doSync,450);
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
        База клиентов хранится и в браузере, и в выбранной папке. При работе с другого браузера или компьютера сначала восстанови базу из этой папки.
      </div>
      <div class="storage-actions-main">
        <button id="storageChoose" type="button" class="storage-primary">Выбрать папку на компьютере</button>
        <button id="storageRestore" type="button">Восстановить базу из папки</button>
        <button id="storageExport" type="button">Сохранить текущую базу и файлы в папку</button>
        <button id="storageDisconnect" type="button">Отключить папку</button>
      </div>
      <div class="storage-example">В выбранной папке хранится:<br><code>Diagnostika / database.json / clients / sessions / files</code></div>
      <div class="storage-footer"><button id="storageClose" type="button">Закрыть</button></div>
    </div>`;
  document.body.appendChild(dlg);

  const status=dlg.querySelector('#storageStatus');
  const restoreBtn=dlg.querySelector('#storageRestore');
  const exportBtn=dlg.querySelector('#storageExport');
  const disconnectBtn=dlg.querySelector('#storageDisconnect');

  async function updateStatus(){
    if(!('showDirectoryPicker' in window)){
      status.className='storage-status bad';
      status.textContent='Этот браузер не поддерживает прямую работу с папками. Используй Chrome или Edge.';
      restoreBtn.disabled=true;exportBtn.disabled=true;disconnectBtn.disabled=true;
      return;
    }

    if(!rootHandle){
      status.className='storage-status neutral';
      status.textContent='Папка пока не выбрана.';
      restoreBtn.disabled=true;exportBtn.disabled=true;disconnectBtn.disabled=true;
      return;
    }

    let p='prompt';
    try{p=await permission(rootHandle,false);}catch(e){}
    if(p!=='granted'){
      status.className='storage-status warn';
      status.textContent=`Папка ${rootHandle.name} сохранена, но браузеру нужно снова разрешить доступ.`;
      restoreBtn.disabled=true;exportBtn.disabled=true;disconnectBtn.disabled=false;
      return;
    }

    folderState=await readFolderState();
    const fc=folderClientCount();
    const bc=browserClientCount();
    status.className='storage-status good';
    status.textContent=folderState
      ? `Подключено: ${rootHandle.name} / ${APP_DIR}. В папке: ${fc} клиент(ов). В браузере: ${bc}.`
      : `Подключено: ${rootHandle.name}. В папке пока нет базы Diagnostika.`;
    restoreBtn.disabled=!folderState;
    exportBtn.disabled=false;
    disconnectBtn.disabled=false;
  }

  dlg.querySelector('#storageChoose').onclick=async()=>{
    if(!('showDirectoryPicker' in window)) return updateStatus();
    try{
      const h=await window.showDirectoryPicker({mode:'readwrite'});
      if(await permission(h,true)!=='granted') return alert('Доступ к папке не разрешён.');

      rootHandle=h;
      appHandle=null;
      folderState=null;
      await saveHandle(h);
      folderState=await readFolderState();

      if(folderState){
        await updateStatus();
        alert(`В папке найдена база: ${folderClientCount()} клиент(ов).\nОна НЕ будет перезаписана автоматически.\nНажми «Восстановить базу из папки», чтобы открыть её в этом браузере.`);
      }else{
        await fullExport();
        await updateStatus();
        alert('Новая папка подключена. Текущая база и файлы сохранены в неё.');
      }
    }catch(e){
      if(e?.name!=='AbortError'){
        console.error(e);
        alert('Не удалось подключить папку.');
      }
    }
  };

  restoreBtn.onclick=async()=>{
    try{
      if(!rootHandle) return;
      if(await permission(rootHandle,true)!=='granted') return alert('Разреши доступ к папке.');
      await restoreFromFolder();
    }catch(e){
      console.error(e);
      alert(e?.message||'Не удалось восстановить базу из папки.');
    }
  };

  exportBtn.onclick=async()=>{
    if(!rootHandle) return;
    try{
      if(await permission(rootHandle,true)!=='granted') return alert('Разреши доступ к папке.');

      folderState=await readFolderState();
      if(folderState){
        const fc=folderClientCount();
        const bc=browserClientCount();
        if(!confirm(`Сохранить базу ЭТОГО браузера в папку?\n\nВ браузере: ${bc} клиент(ов).\nВ папке сейчас: ${fc} клиент(ов).\n\nФайл database.json в папке будет заменён.`)) return;
      }

      exportBtn.disabled=true;
      exportBtn.textContent='Сохраняю…';
      await fullExport();
      await updateStatus();
      alert('База клиентов и файлы сохранены в папку.');
    }catch(e){
      console.error(e);
      alert('Не удалось сохранить данные в папку.');
    }finally{
      exportBtn.textContent='Сохранить текущую базу и файлы в папку';
      exportBtn.disabled=false;
    }
  };

  disconnectBtn.onclick=async()=>{
    if(!confirm('Отключить папку? Данные в самой папке удалены не будут.')) return;
    rootHandle=null;
    appHandle=null;
    folderState=null;
    clearTimeout(syncTimer);
    await clearHandle();
    await updateStatus();
  };

  dlg.querySelector('#storageClose').onclick=()=>dlg.close();
  btn.onclick=async()=>{await updateStatus();dlg.showModal();};
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  const originalSave=save;
  save=function(){
    originalSave();
    if(rootHandle && folderState) scheduleSync();
  };

  if(typeof mediaDbPut==='function'){
    const originalPut=mediaDbPut;
    mediaDbPut=async function(record){
      const result=await originalPut(record);
      try{if(rootHandle) await mirrorRecord(record);}catch(e){console.warn('Файл сохранён в браузере, но не скопирован в папку',e);}
      return result;
    };
  }

  if(typeof mediaDbDelete==='function'){
    const originalDelete=mediaDbDelete;
    mediaDbDelete=async function(id){
      let rec=null;
      try{if(typeof mediaDbGet==='function') rec=await mediaDbGet(id);}catch(e){}
      const result=await originalDelete(id);
      if(rec && rootHandle) await removeMirroredRecord(rec);
      return result;
    };
  }

  (async()=>{
    if(!('showDirectoryPicker' in window)) return;
    try{
      rootHandle=await loadHandle();
      if(rootHandle && await permission(rootHandle,false)==='granted'){
        appHandle=null;
        folderState=await readFolderState();
        // ВАЖНО: при старте ничего не записываем автоматически в папку.
        // Это защищает существующую базу от пустого/старого браузера.
      }
    }catch(e){
      console.warn('Не удалось восстановить выбранную папку',e);
    }
  })();
})();
