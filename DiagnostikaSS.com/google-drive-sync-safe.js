'use strict';

(() => {
  if(window.__diagnostikaGoogleDriveSafeSyncReady)return;
  window.__diagnostikaGoogleDriveSafeSyncReady=true;

  const TOKEN_KEY='diagnostika-google-drive-token-v2';
  const FOLDER_KEY='diagnostika-google-drive-folder-v2';
  const USER_KEY='diagnostika-google-drive-user-v2';
  const CONNECTED_KEY='diagnostika-google-drive-connected-v1';
  const FOLDER_NAME='Diagnostika';
  const BACKUP_FOLDER_NAME='Backups';
  const SYNC_DB='diagnostika-google-sync-v1';
  const SYNC_STORE='sync';
  const BASE_KEY='base';
  const MAX_BACKUPS=20;
  const FETCH_TIMEOUT=45000;
  const MERGE_TIMEOUT=45000;
  const AUTO_SYNC_DEBOUNCE=2500;
  const AUTO_SYNC_MIN_INTERVAL=12000;
  const AUTO_SYNC_POLL_INTERVAL=180000;
  const AUTO_SYNC_RETRY_INTERVAL=45000;
  let active=false;
  let autoSyncTimer=null;
  let autoSyncPollTimer=null;
  let autoSyncPending=false;
  let autoSyncBound=false;
  let lastAutoSyncAt=0;
  let localRevision=0;
  let lastConfirmedAt=0;
  let syncState='unknown';

  const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const clone=value=>{
    if(value==null)return value;
    if(typeof structuredClone==='function')return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const databaseApi=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db||null;
  function readCanonicalDatabase(source){
    try{return databaseApi()?.readState?.({source})||null;}catch{return null;}
  }
  function writeCanonicalDatabase(value,source){
    try{return databaseApi()?.writeState?.(value,{source})===true;}catch{return false;}
  }

  function getSession(key){
    try{
      const raw=localStorage.getItem(key)||sessionStorage.getItem(key);
      return JSON.parse(raw||'null');
    }catch{return null;}
  }
  function setSession(key,value){
    const raw=JSON.stringify(value);
    try{localStorage.setItem(key,raw);}catch{}
    try{sessionStorage.setItem(key,raw);}catch{}
  }
  function token(){
    const t=getSession(TOKEN_KEY);
    return t?.access_token&&Date.now()<Number(t.expires_at||0)-30000?t:null;
  }
  function rememberedConnection(){
    try{return localStorage.getItem(CONNECTED_KEY)==='1';}
    catch{return false;}
  }
  function clearToken(){
    try{sessionStorage.removeItem(TOKEN_KEY);}catch{}
    try{localStorage.removeItem(TOKEN_KEY);}catch{}
  }
  async function ensureAuthToken(){
    // Automatic synchronization is deliberately UI-silent.
    // If the token expired, stop and wait for an explicit user click on
    // «Восстановить Google Drive» instead of opening a Google OAuth popup.
    return token();
  }
  async function notify(message,title='Google Drive'){
    if(window.AppDialog?.alert)return AppDialog.alert(message,title);
    alert(message);
  }
  async function confirmAction(message,title,ok='Продолжить'){
    if(window.AppDialog?.confirm)return AppDialog.confirm(message,title,ok,'Отмена');
    return confirm(`${title}\n\n${message}`);
  }

  async function driveFetch(url,options={},retry=true){
    let t=await ensureAuthToken(false);
    if(!t)throw new Error('Не удалось автоматически восстановить доступ Google Drive.');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),FETCH_TIMEOUT);
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${t.access_token}`);
    try{
      const res=await fetch(url,{...options,headers,signal:controller.signal});
      if(res.status===401&&retry){
        clearToken();
        t=await ensureAuthToken(true);
        if(t)return driveFetch(url,options,false);
      }
      if(res.status===401)throw new Error('Доступ Google Drive требует повторного подтверждения.');
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
  const remoteTime=value=>Date.parse(value?.modifiedTime||value?.createdTime||'')||0;

  async function listFoldersByName(parentId,name){
    const parent=parentId?` and '${parentId}' in parents`:'';
    const q=encodeURIComponent(`name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent}`);
    const data=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime)&spaces=drive&orderBy=modifiedTime desc&pageSize=100`);
    return Array.isArray(data?.files)?data.files:[];
  }
  async function findFolder(parentId,name){
    return (await listFoldersByName(parentId,name))[0]||null;
  }
  async function createFolder(name,parentId){
    const body={name,mimeType:'application/vnd.google-apps.folder'};
    if(parentId)body.parents=[parentId];
    return driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime,createdTime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  async function ensureFolder(){
    const folders=await listFoldersByName(null,FOLDER_NAME);
    if(folders.length){
      const cached=getSession(FOLDER_KEY);
      const folder=folders.find(item=>String(item.id)===String(cached?.id))||folders[0];
      setSession(FOLDER_KEY,folder);
      return folder;
    }
    const folder=await createFolder(FOLDER_NAME);
    setSession(FOLDER_KEY,folder);
    return folder;
  }
  async function ensureBackupFolder(parentId){
    let folder=await findFolder(parentId,BACKUP_FOLDER_NAME);
    if(!folder)folder=await createFolder(BACKUP_FOLDER_NAME,parentId);
    return folder;
  }
  async function listNamedFiles(folderId,name){
    const q=encodeURIComponent(`name='${esc(name)}' and '${folderId}' in parents and trashed=false`);
    const data=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime)&spaces=drive&orderBy=modifiedTime desc&pageSize=100`);
    return Array.isArray(data?.files)?data.files:[];
  }
  async function findFile(folderId,name){
    return (await listNamedFiles(folderId,name))[0]||null;
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
  async function googleAccountEmail(){
    const cached=getSession(USER_KEY);
    if(cached?.email)return cached.email;
    try{
      const user=await driveFetch('https://openidconnect.googleapis.com/v1/userinfo');
      if(user?.email){setSession(USER_KEY,user);return user.email;}
    }catch{}
    return '';
  }
  async function remoteDatabase(){
    let folders=await listFoldersByName(null,FOLDER_NAME);
    if(!folders.length)folders=[await createFolder(FOLDER_NAME)];

    const copies=[];
    for(const folder of folders){
      const files=await listNamedFiles(folder.id,'database.json');
      for(const file of files){
        try{
          const data=await downloadJson(file.id);
          if(data&&Array.isArray(data.clients))copies.push({folder,file,data});
        }catch(error){
          console.warn('[Google safe sync] skipped unreadable database.json',file?.id,error);
        }
      }
    }

    copies.sort((a,b)=>remoteTime(b.file)-remoteTime(a.file));
    const cached=getSession(FOLDER_KEY);
    const folder=copies[0]?.folder||folders.find(item=>String(item.id)===String(cached?.id))||folders[0];
    setSession(FOLDER_KEY,folder);
    const file=copies.find(item=>String(item.folder.id)===String(folder.id))?.file||null;

    if(!copies.length)return {folder,file,data:null,copies:[],folders,cloudConflicts:[]};

    let data=clone(copies[0].data);
    const cloudConflicts=[];
    for(let index=1;index<copies.length;index++){
      const merged=await mergeInWorker(null,data,copies[index].data);
      data=merged.merged;
      cloudConflicts.push(...merged.conflicts);
    }
    return {folder,file,data,copies,folders,cloudConflicts};
  }
  async function convergeRemoteCopies(remote,data){
    const folders=Array.isArray(remote?.folders)&&remote.folders.length?remote.folders:[remote.folder].filter(Boolean);
    let writes=0;
    for(const folder of folders){
      const existing=(remote?.copies||[]).filter(copy=>String(copy.folder?.id)===String(folder.id));
      if(existing.length){
        for(const copy of existing){
          await uploadJson(folder.id,'database.json',data,copy.file.id);
          writes++;
        }
      }else{
        await uploadJson(folder.id,'database.json',data,null);
        writes++;
      }
    }
    return writes;
  }

  async function assertRemoteUnchanged(remote){
    // Re-check cloud revision immediately before overwriting: another PC may
    // have saved a newer copy while our merge and backups were in progress.
    const folders=Array.isArray(remote?.folders)?remote.folders:[];
    for(const folder of folders){
      const before=(remote.copies||[]).filter(copy=>String(copy.folder?.id)===String(folder.id));
      const latest=await listNamedFiles(folder.id,'database.json');
      if(latest.length!==before.length)throw new Error('Данные Google Drive изменились на другом устройстве. Автосинхронизация повторится после новой сверки.');
      const previous=new Map(before.map(copy=>[String(copy.file.id),copy.file.modifiedTime||'']));
      for(const file of latest){
        if(!previous.has(String(file.id))||previous.get(String(file.id))!==(file.modifiedTime||'')){
          throw new Error('Данные Google Drive изменились на другом устройстве. Автосинхронизация повторится после новой сверки.');
        }
      }
    }
  }
  async function verifyRemoteSaved(expected){
    // Google write response is not proof of persisted contents. Read the
    // committed files back before showing a green indicator.
    const verified=await remoteDatabase();
    if(!verified.data||!verified.copies?.length
      ||!verified.copies.every(copy=>equal(copy.data,expected))){
      throw new Error('Google Drive не подтвердил сохранение всех копий базы. Изменения будут перепроверены.');
    }
  }

  function currentDatabase(){
    const db=readCanonicalDatabase('google-drive-safe-current');
    if(db&&Array.isArray(db.clients))return db;
    try{
      if(typeof state!=='undefined'&&state&&Array.isArray(state.clients))return clone(state);
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
      const worker=new Worker('google-drive-merge-worker.js?v=20261005-client-archive-1');
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

  function applyDatabaseToRuntime(db){
    if(!db||!Array.isArray(db.clients))return false;
    try{
      if(typeof state!=='undefined'){
        state=db;
        if(typeof clientId!=='undefined'){
          const exists=state.clients.some(c=>String(c?.id)===String(clientId));
          if(!exists)clientId=state.clients[0]?.id||null;
        }
        if(typeof requestId!=='undefined')requestId=null;
        if(typeof situationId!=='undefined')situationId=null;
        if(typeof selected!=='undefined')selected=null;
        if(typeof renderClient==='function')renderClient();
        return true;
      }
    }catch(error){console.warn('[Google safe runtime refresh]',error);}
    return false;
  }

  async function safeSync(setStatus){
    setStatus('Подготавливаю локальную базу…');
    try{window.DiagnostikaRequestAI?.migrateLegacyKey?.();}catch(error){console.warn('[Google Drive auto sync] AI key migration skipped',error);}
    const local=currentDatabase();
    if(!local)throw new Error('Не удалось получить текущую базу браузера.');
    const accountEmail=await googleAccountEmail();
    await pause();

    setStatus('Ищу все базы Diagnostika в Google Drive…');
    const remote=await remoteDatabase();
    const base=await getBase();
    await pause();

    const coveredFolders=new Set((remote.copies||[]).map(copy=>String(copy.folder?.id||'')));
    const cloudAligned=Boolean(remote.data)
      &&(remote.folders||[]).every(folder=>coveredFolders.has(String(folder.id)))
      &&(remote.copies||[]).every(copy=>equal(copy.data,remote.data));

    if(remote.data&&equal(local,remote.data)&&cloudAligned){
      await setBase(local);
      setStatus(`Актуально: ${local.clients?.length||0} клиент(ов)`);
      return {
        merged:local,
        conflicts:[],
        localCount:local.clients?.length||0,
        remoteCount:remote.data?.clients?.length||0,
        remoteCopyCount:remote.copies?.length||0,
        folderCount:remote.folders?.length||0,
        accountEmail,
        unchanged:true,
        pendingLocalChanges:!equal(currentDatabase(),local)
      };
    }

    setStatus('Создаю страховочные копии…');
    const backupFolder=await ensureBackupFolder(remote.folder.id);
    const jobs=[backupSnapshot(remote.folder.id,'local-before-sync',local,backupFolder)];
    (remote.copies||[]).forEach((copy,index)=>{
      jobs.push(backupSnapshot(
        remote.folder.id,
        `cloud-copy-${index+1}-before-sync`,
        copy.data,
        backupFolder
      ));
    });
    await Promise.all(jobs);
    await pause();

    setStatus('Объединяю локальную и все облачные базы…');
    const localMerge=await mergeInWorker(base,local,remote.data||{version:4,clients:[]});
    const merged=localMerge.merged;
    const conflicts=[...(remote.cloudConflicts||[]),...(localMerge.conflicts||[])];
    await pause();

    setStatus('Проверяю, не менялась ли база на другом устройстве…');
    await assertRemoteUnchanged(remote);
    setStatus('Привожу все database.json в Google Drive к одной базе…');
    const remoteWrites=await convergeRemoteCopies(remote,merged);
    setStatus('Проверяю сохранённые файлы на Google Drive…');
    await verifyRemoteSaved(merged);
    await pause();

    // A local edit may have occurred during the network/merge operations.
    // Never overwrite that newer in-memory/local state with the old snapshot.
    const pendingLocalChanges=!equal(currentDatabase(),local);
    if(pendingLocalChanges){
      await setBase(merged);
      return {
        merged,conflicts,localCount:local.clients?.length||0,
        remoteCount:remote.data?.clients?.length||0,
        remoteCopyCount:remote.copies?.length||0,
        folderCount:remote.folders?.length||0,
        remoteWrites,accountEmail,unchanged:false,pendingLocalChanges:true
      };
    }

    setStatus('Сохраняю объединённую базу на этом ПК…');
    if(!writeCanonicalDatabase(merged,'google-drive-safe-sync'))throw new Error('Объединённая база уже сохранена в Google, но локальную копию сохранить не удалось. Не удаляй резервные копии в Diagnostika/Backups.');
    await setBase(merged);
    // setBase() is asynchronous: another local save may have happened
    // while IndexedDB was being updated. Never apply the older merged
    // snapshot over those newly saved edits.
    const laterChanges=!equal(currentDatabase(),merged);
    if(!laterChanges)applyDatabaseToRuntime(merged);

    setStatus(laterChanges
      ? 'В облаке сохранено; появились новые локальные правки — отправлю их следующим циклом.'
      : `Готово: ${merged.clients?.length||0} клиент(ов)`);
    cleanupBackups(remote.folder.id);
    return {
      merged,
      conflicts,
      localCount:local.clients?.length||0,
      remoteCount:remote.data?.clients?.length||0,
      remoteCopyCount:remote.copies?.length||0,
      folderCount:remote.folders?.length||0,
      remoteWrites,
      accountEmail,
      unchanged:false,
      pendingLocalChanges:laterChanges
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
    if(!writeCanonicalDatabase(remote.data,'google-drive-safe-restore'))throw new Error('Не удалось сохранить облачную базу в браузере. Текущая локальная база не изменена.');
    await setBase(remote.data);
    applyDatabaseToRuntime(remote.data);
    cleanupBackups(remote.folder.id);
    return remote.data;
  }

  // Green is reserved for a confirmed Drive operation, never for connection alone.
  function ensureBeacon(){
    const card=document.querySelector('.gdrive-card');
    const connect=card?.querySelector('.gdrive-connect');
    if(!connect)return null;
    let beacon=card.querySelector('.gdrive-beacon');
    if(!beacon){
      beacon=document.createElement('span');
      beacon.className='gdrive-beacon';
      beacon.setAttribute('role','status');
      beacon.setAttribute('aria-live','polite');
      beacon.innerHTML='<span class="gdrive-beacon-dot" aria-hidden="true"></span><span class="gdrive-beacon-label"></span>';
      connect.insertAdjacentElement('beforebegin',beacon);
    }
    let verified=card.querySelector('.gdrive-verified-at');
    if(!verified){
      verified=document.createElement('div');
      verified.className='gdrive-verified-at';
      card.querySelector('.gdrive-copy')?.appendChild(verified);
    }
    return {beacon,verified};
  }
  function formatTime(timestamp){
    return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));
  }
  function showBeacon(kind,message=''){
    syncState=kind;
    // Broadcast the same verified status to the header gear. No separate
    // timer, second network request, or misleading local-save signal.
    try{
      if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function'){
        window.dispatchEvent(new CustomEvent('diagnostika:google-drive-sync-status',{
          detail:{state:kind,message,lastConfirmedAt}
        }));
      }
    }catch(_){}
    const elements=ensureBeacon();
    if(!elements)return;
    const {beacon,verified}=elements;
    beacon.dataset.state=kind;
    const labels={synced:'Сохранено',working:'Синхронизация',pending:'Ожидает',auth:'Нужен вход',error:'Ошибка',off:'Не подключено',unknown:'Проверка'};
    beacon.querySelector('.gdrive-beacon-label').textContent=labels[kind]||labels.unknown;
    beacon.title=message||beacon.querySelector('.gdrive-beacon-label').textContent;
    verified.textContent=lastConfirmedAt
      ? 'Последняя подтверждённая синхронизация: '+formatTime(lastConfirmedAt)
      : 'Облачное сохранение пока не подтверждено';
  }
  function autoStatus(text){
    const status=document.querySelector('.gdrive-card .gdrive-status');
    if(status)status.textContent=text;
  }
  function publishStatus(kind,message){
    showBeacon(kind,message);
    autoStatus(message);
    if(kind==='auth'&&rememberedConnection()){
      const connect=document.querySelector('.gdrive-card .gdrive-connect');
      if(connect&&!connect.disabled)connect.textContent='Восстановить Google Drive';
    }
  }
  function confirmSync(result){
    if(result?.pendingLocalChanges){
      autoSyncPending=true;
      publishStatus('pending','Google Drive: появились новые изменения, отправляю следующим циклом.');
      return;
    }
    lastConfirmedAt=Date.now();
    publishStatus('synced',result?.unchanged
      ? 'Google Drive: база проверена, новых изменений нет · '+formatTime(lastConfirmedAt)
      : 'Google Drive: изменения записаны и проверены · '+formatTime(lastConfirmedAt));
  }

  const beaconCss=document.createElement('style');
  beaconCss.textContent=[
    '.gdrive-beacon{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:7px 8px;border:1px solid #d9e4eb;border-radius:9px;background:#f5f8fa;font-size:10px;font-weight:800;color:#627487;white-space:nowrap}',
    '.gdrive-beacon-dot{display:inline-block;flex:0 0 11px;width:11px;height:11px;border-radius:50%;background:#98a9b6;box-shadow:0 0 0 3px rgba(152,169,182,.13)}',
    '.gdrive-beacon[data-state="synced"]{background:#eff9f3;border-color:#bfe5d0;color:#24744b}',
    '.gdrive-beacon[data-state="synced"] .gdrive-beacon-dot{background:#27b576;box-shadow:0 0 0 3px rgba(39,181,118,.17)}',
    '.gdrive-beacon[data-state="working"],.gdrive-beacon[data-state="pending"]{background:#fff8eb;border-color:#f3dca4;color:#996412}',
    '.gdrive-beacon[data-state="working"] .gdrive-beacon-dot,.gdrive-beacon[data-state="pending"] .gdrive-beacon-dot{background:#e6a333;box-shadow:0 0 0 3px rgba(230,163,51,.15)}',
    '.gdrive-beacon[data-state="working"] .gdrive-beacon-dot{animation:gdrive-beacon-pulse 1.25s ease-in-out infinite}',
    '.gdrive-beacon[data-state="error"],.gdrive-beacon[data-state="auth"]{background:#fff1f0;border-color:#f1c3bd;color:#ae4337}',
    '.gdrive-beacon[data-state="error"] .gdrive-beacon-dot,.gdrive-beacon[data-state="auth"] .gdrive-beacon-dot{background:#de5a4e;box-shadow:0 0 0 3px rgba(222,90,78,.14)}',
    '.gdrive-verified-at{font-size:10px;line-height:1.35;color:#7b8fa3;margin-top:4px}',
    '@keyframes gdrive-beacon-pulse{50%{opacity:.35;transform:scale(.76)}}',
    '@media(max-width:700px){.gdrive-main-row{flex-wrap:wrap}.gdrive-beacon{margin-left:auto}.gdrive-main-row .gdrive-connect{flex:0 0 auto;width:auto}}',
    '@media(prefers-reduced-motion:reduce){.gdrive-beacon-dot{animation:none!important}}'
  ].join('');
  document.head.appendChild(beaconCss);

  function scheduleAutoSync(delay=AUTO_SYNC_DEBOUNCE){
    autoSyncPending=true;
    if(!token()){
      if(rememberedConnection()){
        publishStatus('auth','Google Drive: доступ истёк. Нажмите «Восстановить Google Drive» для продолжения автоматического сохранения.');
      }else{
        showBeacon('off','Google Drive не подключён');
      }
      return;
    }
    if(active)return;
    clearTimeout(autoSyncTimer);
    const sinceLast=Date.now()-lastAutoSyncAt;
    const wait=Math.max(delay,AUTO_SYNC_MIN_INTERVAL-Math.max(0,sinceLast));
    publishStatus('pending','Google Drive: изменения ожидают автоматического сохранения.');
    autoSyncTimer=setTimeout(runAutoSync,Math.max(0,wait));
  }

  async function runAutoSync(){
    clearTimeout(autoSyncTimer);
    autoSyncTimer=null;
    if(!token()){
      if(rememberedConnection()){
        autoSyncPending=true;
        publishStatus('auth','Google Drive: доступ истёк. Нажмите «Восстановить Google Drive».');
      }else showBeacon('off','Google Drive не подключён');
      return;
    }
    // Attempt cloud saving even when the tab is in the background.
    // Browsers can throttle timers, so visibility return also rechecks.
    if(active){
      autoSyncPending=true;
      return;
    }

    active=true;
    autoSyncPending=false;
    const startedAtRevision=localRevision;
    publishStatus('working','Google Drive: автоматическая синхронизация и проверка данных…');
    let retry=false;
    try{
      const result=await safeSync(text=>autoStatus('Google Drive: '+text));
      lastAutoSyncAt=Date.now();
      // A save during upload is a NEW pending change, not a completed sync.
      if(startedAtRevision!==localRevision)result.pendingLocalChanges=true;
      confirmSync(result);
    }catch(error){
      retry=true;
      autoSyncPending=true;
      console.warn('[Google Drive auto sync]',error?.name||'Error',error?.message||'');
      if(!token()){
        publishStatus('auth','Google Drive: требуется восстановить доступ. Нажмите «Восстановить Google Drive».');
      }else{
        publishStatus('error','Google Drive: данные не подтверждены. '+(error?.message||'Повторная попытка через 45 секунд.'));
      }
    }finally{
      active=false;
      if(autoSyncPending&&token()){
        scheduleAutoSync(retry?AUTO_SYNC_RETRY_INTERVAL:AUTO_SYNC_MIN_INTERVAL);
      }
    }
  }

  function bindAutoSync(){
    if(autoSyncBound)return true;
    const bus=window.DiagnostikaPlatform?.events;
    if(!bus?.on)return false;
    autoSyncBound=true;

    bus.on('db:written',detail=>{
      const db=databaseApi();
      if(detail?.key!==db?.stateKey)return;
      const source=String(detail?.source||'');
      if(source.startsWith('google-drive-'))return;
      localRevision+=1;
      scheduleAutoSync();
    });

    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){
        if(autoSyncPending&&token()&&!active)runAutoSync();
        return;
      }
      scheduleAutoSync(autoSyncPending?250:750);
    });
    window.addEventListener('focus',()=>scheduleAutoSync(500));
    window.addEventListener('online',()=>scheduleAutoSync(500));
    window.addEventListener('storage',event=>{
      // A second tab may write the same local database.
      if(event.key!==databaseApi()?.stateKey)return;
      localRevision+=1;
      scheduleAutoSync(750);
    });
    window.addEventListener('diagnostika:google-drive-auth-restored',()=>{
      autoSyncPending=true;
      scheduleAutoSync(100);
    });

    window.addEventListener('offline',()=>{
      if(rememberedConnection())publishStatus('error','Google Drive: нет подключения к интернету. Данные остаются локально, отправка возобновится после подключения.');
    });
    window.addEventListener('diagnostika:google-drive-disconnected',()=>{
      clearTimeout(autoSyncTimer);
      autoSyncTimer=null;
      autoSyncPending=false;
      lastConfirmedAt=0;
      publishStatus('off','Google Drive отключён.');
    });

    clearInterval(autoSyncPollTimer);
    autoSyncPollTimer=setInterval(()=>{
      if(token()||rememberedConnection())scheduleAutoSync(0);
    },AUTO_SYNC_POLL_INTERVAL);

    if(token())scheduleAutoSync(2000);
    else if(rememberedConnection())publishStatus('auth','Google Drive: нужно восстановить доступ для автоматической синхронизации.');
    else showBeacon('off','Google Drive не подключён');
    return true;
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
    ensureBeacon();
    if(token())showBeacon(syncState==='pending'?'pending':'unknown',autoSyncPending?'Google Drive: ожидается автоматическая синхронизация.':'Google Drive: проверяю актуальность сохранённой базы.');
    else if(rememberedConnection())showBeacon('auth','Google Drive: доступ истёк, нажмите «Восстановить Google Drive».');
    else showBeacon('off','Google Drive не подключён.');
    const sync=oldSync.cloneNode(true);
    const restore=oldRestore.cloneNode(true);
    oldSync.replaceWith(sync);
    oldRestore.replaceWith(restore);

    const setStatus=text=>{
      if(status)status.textContent=text;
      if(syncState!=='working')showBeacon('working',text);
    };
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
      publishStatus('working','Google Drive: ручная синхронизация…');
      sync.textContent='Синхронизирую…';
      const startedAtRevision=localRevision;
      try{
        const result=await safeSync(setStatus);
        if(startedAtRevision!==localRevision)result.pendingLocalChanges=true;
        lastAutoSyncAt=Date.now();
        confirmSync(result);
        const accountLine=result.accountEmail?`Google аккаунт: ${result.accountEmail}\n`:'';
        const copiesLine=(result.folderCount>1||result.remoteCopyCount>1)
          ? `\nНайдено папок Diagnostika: ${result.folderCount}.\nНайдено database.json: ${result.remoteCopyCount}.\nВсе найденные облачные копии объединены и приведены к одной базе.`
          : '';
        await notify(
          result.unchanged
            ? `${accountLine}Локальная база и Google Drive уже совпадают.\nНа этом ПК: ${result.localCount}.\nВ Google: ${result.remoteCount}.${copiesLine}`
            : `${accountLine}Готово.\nНа этом ПК было: ${result.localCount}.\nВ Google найдено: ${result.remoteCount}.\nПосле объединения: ${result.merged.clients?.length||0}.${copiesLine}\nРезервные копии находятся в Diagnostika/Backups.${result.conflicts.length?`\nКонфликтов: ${result.conflicts.length}.`:''}\n\nПерезагрузка страницы не требуется.`,
          'Синхронизация завершена'
        );
      }catch(error){
        publishStatus(token()?'error':'auth','Google Drive: '+(error?.message||'Ошибка синхронизации'));
        await notify(error.message||String(error),'Ошибка синхронизации');
      }finally{
        sync.textContent=oldText;
        busy(false);
        if(autoSyncPending)scheduleAutoSync(AUTO_SYNC_MIN_INTERVAL);
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
      publishStatus('working','Google Drive: восстанавливаю облачную копию…');
      restore.textContent='Восстанавливаю…';
      try{
        const db=await safeRestore(setStatus);
        lastAutoSyncAt=Date.now();
        confirmSync({unchanged:true,pendingLocalChanges:false});
        await notify(`Восстановлено клиентов: ${db.clients?.length||0}. Локальная версия до восстановления сохранена в Backups. Перезагрузка страницы не требуется.`,'Готово');
      }catch(error){
        publishStatus(token()?'error':'auth','Google Drive: '+(error?.message||'Ошибка восстановления'));
        await notify(error.message||String(error),'Ошибка восстановления');
      }finally{
        restore.textContent=oldText;
        busy(false);
        if(autoSyncPending)scheduleAutoSync(AUTO_SYNC_MIN_INTERVAL);
      }
    });

    const note=card.querySelector('.gdrive-note');
    if(note)note.textContent='Изменения сохраняются в браузере и отправляются на Google Drive автоматически после редактирования. Каждые 3 минуты при открытом приложении выполняется контрольная сверка. Зелёный индикатор означает подтверждённую облачную запись; если Google запросит повторный вход, индикатор это покажет.';
    bindAutoSync();
    return true;
  }

  window.DiagnostikaGoogleDriveSyncStatus=Object.freeze({
    getStatus:()=>Object.freeze({state:syncState,lastConfirmedAt,pending:autoSyncPending,active}),
    requestSync:()=>scheduleAutoSync(0)
  });

  bindAutoSync();
  Promise.resolve(window.DiagnostikaPlatform?.ready).then(bindAutoSync).catch(()=>{});

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
