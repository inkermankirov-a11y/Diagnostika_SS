'use strict';

(() => {
  if(window.__diagnostikaGoogleDriveSafeSyncReady)return;
  window.__diagnostikaGoogleDriveSafeSyncReady=true;

  const TOKEN_KEY='diagnostika-google-drive-token-v2';
  const FOLDER_KEY='diagnostika-google-drive-folder-v2';
  const STATE_KEY='diagnostika-web-v1';
  const FOLDER_NAME='Diagnostika';
  const BACKUP_FOLDER_NAME='Backups';
  const SYNC_DB='diagnostika-google-sync-v1';
  const SYNC_STORE='sync';
  const BASE_KEY='base';
  const MAX_BACKUPS=20;
  const FETCH_TIMEOUT=45000;
  const MERGE_TIMEOUT=45000;
  let active=false;

  const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  const clone=value=>{
    if(value==null)return value;
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };

  function getSession(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
  function token(){
    const t=getSession(TOKEN_KEY);
    return t?.access_token&&Date.now()<Number(t.expires_at||0)-30000?t:null;
  }
  async function notify(message,title='Google Drive'){
    if(window.AppDialog?.alert)return AppDialog.alert(message,title);
    alert(message);
  }
  async function confirmAction(message,title,ok='Продолжить'){
    if(window.AppDialog?.confirm)return AppDialog.confirm(message,title,ok,'Отмена');
    return confirm(`${title}\n\n${message}`);
  }

  async function driveFetch(url,options={}){
    const t=token();
    if(!t)throw new Error('Сессия Google истекла. Подключи Google Drive снова.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT);
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${t.access_token}`);
    try{
      const res=await fetch(url,{...options,headers,signal:controller.signal});
      if(res.status===401)throw new Error('Сессия Google истекла. Подключи Google Drive снова.');
      if(!res.ok){
        let message=`Google Drive: ${res.status}`;
        try{message=(await res.json())?.error?.message||message;}catch{}
        throw new Error(message);
      }
      if(res.status===204)return null;
      const ct=res.headers.get('content-type')||'';
      return ct.includes('application/json')?res.json():res.text();
    }catch(error){
      if(error?.name==='AbortError')throw new Error('Google Drive не ответил за 45 секунд. Синхронизация остановлена без перезаписи основной облачной базы.');
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }

  function esc(value){return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  async function findFolder(parentId,name){
    const parent=parentId?` and '${parentId}' in parents`:'';
    const q=encodeURIComponent(`name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent}`);
    const data=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=20`);
    return data?.files?.[0]||null;
  }
  async function createFolder(name,parentId){
    const body={name,mimeType:'application/vnd.google-apps.folder'};
    if(parentId)body.parents=[parentId];
    return driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  async function ensureFolder(){
    const cached=getSession(FOLDER_KEY);
    if(cached?.id)return cached;
    let folder=await findFolder(null,FOLDER_NAME);
    if(!folder)folder=await createFolder(FOLDER_NAME);
    return folder;
  }
  async function ensureBackupFolder(parentId){
    let folder=await findFolder(parentId,BACKUP_FOLDER_NAME);
    if(!folder)folder=await createFolder(BACKUP_FOLDER_NAME,parentId);
    return folder;
  }
  async function findFile(folderId,name){
    const q=encodeURIComponent(`name='${esc(name)}' and '${folderId}' in parents and trashed=false`);
    const data=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime)&spaces=drive&pageSize=20`);
    return data?.files?.[0]||null;
  }
  async function listFiles(folderId){
    const q=encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    return driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime)&orderBy=createdTime desc&pageSize=100`);
  }
  async function uploadJson(folderId,name,data,existingId=null){
    const boundary='diagnostika_'+Math.random().toString(36).slice(2);
    const meta={name,mimeType:'application/json'};
    if(!existingId)meta.parents=[folderId];
    const json=JSON.stringify(data);
    const body=new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(meta),
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      json,
      `\r\n--${boundary}--`
    ]);
    const url=existingId
      ?`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,name,modifiedTime`
      :'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
    return driveFetch(url,{method:existingId?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  }
  async function downloadJson(fileId){
    const text=await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    try{return typeof text==='string'?JSON.parse(text):text;}
    catch{throw new Error('Файл database.json на Google Drive повреждён.');}
  }
  async function remoteDatabase(){
    const folder=await ensureFolder();
    const file=await findFile(folder.id,'database.json');
    if(!file)return {folder,file:null,data:null};
    return {folder,file,data:await downloadJson(file.id)};
  }

  function currentDatabase(){
    try{
      const raw=localStorage.getItem(STATE_KEY);
      const db=raw?JSON.parse(raw):null;
      if(db&&Array.isArray(db.clients))return db;
    }catch{}
    try{
      if(window.state&&Array.isArray(window.state.clients))return clone(window.state);
    }catch{}
    return null;
  }

  function syncDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(SYNC_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(SYNC_STORE))req.result.createObjectStore(SYNC_STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function getBase(){
    try{
      const db=await syncDb();
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(SYNC_STORE,'readonly');
        const req=tx.objectStore(SYNC_STORE).get(BASE_KEY);
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
        tx.oncomplete=()=>db.close();
      });
    }catch{return null;}
  }
  async function setBase(value){
    try{
      const db=await syncDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(SYNC_STORE,'readwrite');
        tx.objectStore(SYNC_STORE).put(value,BASE_KEY);
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error);};
      });
    }catch(error){console.warn('[Google safe sync base]',error);}
  }

  function mergeInWorker(base,local,remote){
    return new Promise((resolve,reject)=>{
      let settled=false;
      const worker=new Worker('google-drive-merge-worker.js?v=20260914-1');
      const timer=setTimeout(()=>{
        if(settled)return;
        settled=true;
        worker.terminate();
        reject(new Error('Объединение базы заняло больше 45 секунд. Операция остановлена, основная база Google не изменена.'));
      },MERGE_TIMEOUT);
      worker.onmessage=event=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        worker.terminate();
        const data=event.data||{};
        if(!data.ok)return reject(new Error(data.error||'Не удалось объединить базы.'));
        resolve({merged:data.merged,conflicts:Array.isArray(data.conflicts)?data.conflicts:[]});
      };
      worker.onerror=event=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(event.message||'Ошибка фонового объединения базы.'));
      };
      worker.postMessage({base,local,remote});
    });
  }

  async function backupSnapshot(folderId,prefix,data,backupFolder=null){
    if(!data||!Array.isArray(data.clients))return null;
    const backups=backupFolder||await ensureBackupFolder(folderId);
    return uploadJson(backups.id,`${prefix}-${stamp()}.json`,data);
  }
  async function cleanupBackups(folderId){
    try{
      const backups=await ensureBackupFolder(folderId);
      const list=await listFiles(backups.id);
      const files=(list?.files||[]).filter(file=>file.name.endsWith('.json'));
      const stale=files.slice(MAX_BACKUPS);
      for(let i=0;i<stale.length;i+=4){
        await Promise.allSettled(stale.slice(i,i+4).map(file=>driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}`,{method:'DELETE'})));
      }
    }catch(error){console.warn('[Google safe backup cleanup]',error);}
  }

  async function safeSync(setStatus){
    setStatus('Подготавливаю локальную базу…');
    const local=currentDatabase();
    if(!local)throw new Error('Не удалось получить текущую базу браузера.');
    await pause();

    setStatus('Загружаю базу из Google Drive…');
    const remote=await remoteDatabase();
    const base=await getBase();
    await pause();

    setStatus('Создаю страховочные копии…');
    const backupFolder=await ensureBackupFolder(remote.folder.id);
    const jobs=[backupSnapshot(remote.folder.id,'local-before-sync',local,backupFolder)];
    if(remote.data)jobs.push(backupSnapshot(remote.folder.id,'cloud-before-sync',remote.data,backupFolder));
    await Promise.all(jobs);
    await pause();

    setStatus('Объединяю данные в фоновом режиме…');
    const {merged,conflicts}=await mergeInWorker(base,local,remote.data||{version:4,clients:[]});
    await pause();

    setStatus('Сохраняю объединённую базу в Google Drive…');
    await uploadJson(remote.folder.id,'database.json',merged,remote.file?.id||null);
    await pause();

    setStatus('Сохраняю локальную копию…');
    let serialized;
    try{serialized=JSON.stringify(merged);localStorage.setItem(STATE_KEY,serialized);}
    catch{throw new Error('Объединённая база уже сохранена в Google, но браузеру не хватило места для локальной копии. Не удаляй резервные копии в Diagnostika/Backups.');}
    await setBase(merged);

    setStatus(`Готово: ${merged.clients?.length||0} клиент(ов)`);
    cleanupBackups(remote.folder.id);
    return {
      merged,
      conflicts,
      localCount:local.clients?.length||0,
      remoteCount:remote.data?.clients?.length||0
    };
  }

  async function safeRestore(setStatus){
    setStatus('Загружаю базу из Google Drive…');
    const local=currentDatabase();
    const remote=await remoteDatabase();
    if(!remote.data)throw new Error('На Google Drive ещё нет database.json.');

    setStatus('Создаю страховочную копию локальной базы…');
    if(local){
      const backupFolder=await ensureBackupFolder(remote.folder.id);
      await backupSnapshot(remote.folder.id,'local-before-restore',local,backupFolder);
    }

    setStatus('Сохраняю облачную базу в браузер…');
    try{localStorage.setItem(STATE_KEY,JSON.stringify(remote.data));}
    catch{throw new Error('Не удалось сохранить облачную базу в браузере. Текущая локальная база не изменена.');}
    await setBase(remote.data);
    cleanupBackups(remote.folder.id);
    return remote.data;
  }

  function install(){
    const card=document.querySelector('.gdrive-card');
    const oldSync=card?.querySelector('.gdrive-sync');
    const oldRestore=card?.querySelector('.gdrive-restore');
    if(!card||!oldSync||!oldRestore)return false;
    if(card.dataset.safeSyncInstalled==='1')return true;
    card.dataset.safeSyncInstalled='1';

    const status=card.querySelector('.gdrive-status');
    const connect=card.querySelector('.gdrive-connect');
    const sync=oldSync.cloneNode(true);
    const restore=oldRestore.cloneNode(true);
    oldSync.replaceWith(sync);
    oldRestore.replaceWith(restore);

    const setStatus=text=>{if(status)status.textContent=text;};
    const busy=value=>{
      active=value;
      sync.disabled=value;
      restore.disabled=value;
      if(connect)connect.disabled=value;
    };

    sync.addEventListener('click',async()=>{
      if(active)return;
      const ok=await confirmAction(
        'Сначала будут созданы резервные копии локальной и облачной базы. Затем объединение выполнится в отдельном потоке, чтобы интерфейс не зависал. Основной database.json изменится только после успешного объединения.',
        'Безопасная синхронизация',
        'Синхронизировать'
      );
      if(!ok)return;

      const oldText=sync.textContent;
      busy(true);
      sync.textContent='Синхронизирую…';
      try{
        const result=await safeSync(setStatus);
        await notify(
          `Готово.\nНа этом ПК было: ${result.localCount}.\nВ Google было: ${result.remoteCount}.\nПосле объединения: ${result.merged.clients?.length||0}.\nРезервные копии находятся в Diagnostika/Backups.${result.conflicts.length?`\nКонфликтов: ${result.conflicts.length}.`:''}`,
          'Синхронизация завершена'
        );
        location.reload();
      }catch(error){
        setStatus(error.message||'Ошибка синхронизации');
        await notify(error.message||String(error),'Ошибка синхронизации');
      }finally{
        sync.textContent=oldText;
        busy(false);
      }
    });

    restore.addEventListener('click',async()=>{
      if(active)return;
      const ok=await confirmAction(
        'Локальная база сначала будет сохранена в Diagnostika/Backups. Затем текущая база браузера будет заменена версией из Google Drive.',
        'Восстановить из Google Drive?',
        'Восстановить'
      );
      if(!ok)return;

      const oldText=restore.textContent;
      busy(true);
      restore.textContent='Восстанавливаю…';
      try{
        const db=await safeRestore(setStatus);
        await notify(`Восстановлено клиентов: ${db.clients?.length||0}. Локальная версия до восстановления сохранена в Backups.`,'Готово');
        location.reload();
      }catch(error){
        setStatus(error.message||'Ошибка восстановления');
        await notify(error.message||String(error),'Ошибка восстановления');
      }finally{
        restore.textContent=oldText;
        busy(false);
      }
    });

    const note=card.querySelector('.gdrive-note');
    if(note)note.textContent='Безопасная синхронизация: резервные копии создаются до записи, объединение выполняется в отдельном потоке, запросы Google имеют таймаут. Основная облачная база перезаписывается только после успешного объединения.';
    return true;
  }

  if(!install()){
    let tries=0;
    const retry=()=>{
      tries+=1;
      if(install()||tries>=30)return;
      setTimeout(retry,100);
    };
    setTimeout(retry,0);
  }
})();
