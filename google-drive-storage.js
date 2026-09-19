'use strict';

(() => {
  if(window.__diagnostikaGoogleDriveStorageReady) return;
  window.__diagnostikaGoogleDriveStorageReady=true;

  const CLIENT_ID=String(window.DIAGNOSTIKA_GOOGLE_CLIENT_ID||'').trim();
  const DRIVE_SCOPE='openid email profile https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY='diagnostika-google-drive-token-v2';
  const FOLDER_KEY='diagnostika-google-drive-folder-v2';
  const USER_KEY='diagnostika-google-drive-user-v2';
  const FOLDER_NAME='Diagnostika';
  const BACKUP_FOLDER_NAME='Backups';
  const SYNC_DB='diagnostika-google-sync-v1';
  const SYNC_STORE='sync';
  const BASE_KEY='base';
  const MAX_BACKUPS=20;

  const driveIcon=`<svg class="gdrive-icon" viewBox="0 0 87.3 78" aria-hidden="true" focusable="false"><path fill="#0066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"/><path fill="#00AC47" d="M43.65 25L29.9 1.2C28.55.4 27 0 25.4 0c-3.1 0-6.2 1.65-7.8 4.5L1.2 32.9C.4 34.3 0 35.85 0 37.4V53h27.5L43.65 25z"/><path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.75l5.85 11.5 7.95 12.3z"/><path fill="#00832D" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H25.4c1.6 0 3.15.45 4.5 1.2L43.65 25z"/><path fill="#2684FC" d="M59.75 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2L59.75 53z"/><path fill="#FFBA00" d="M73.4 26.5L65.2 12.3l-4.05-7c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.1 28H87.2c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z"/></svg>`;

  const style=document.createElement('style');
  style.textContent=`
    .storage-cloud-section{margin-top:14px;padding-top:14px;border-top:1px solid #dce4eb}.storage-cloud-title{font-size:12px;font-weight:800;color:#66778a;letter-spacing:.04em;margin-bottom:8px}.gdrive-card{border:1px solid #d9e1e8;background:#fff;border-radius:11px;padding:12px}.gdrive-main-row{display:flex;align-items:center;gap:11px}.gdrive-icon{width:32px;height:29px;flex:0 0 auto}.gdrive-copy{min-width:0;flex:1}.gdrive-name{font-size:14px;font-weight:800;color:#2e4053}.gdrive-status{font-size:11px;color:#74869a;margin-top:3px;line-height:1.4}.gdrive-connect,.gdrive-action{border:1px solid #cfd8e3;background:#fff;color:#33485d;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:700}.gdrive-connect:hover,.gdrive-action:hover{background:#f7f9fc}.gdrive-connect.connected{border-color:#b6dfc5;background:#edf8f1;color:#287047}.gdrive-note{margin-top:10px;padding-top:9px;border-top:1px solid #edf1f5;font-size:10.5px;line-height:1.45;color:#7b8b9d}.gdrive-tools{display:none;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.gdrive-card.connected .gdrive-tools{display:grid}.gdrive-sync{grid-column:1/-1;background:#edf8f1;border-color:#b6dfc5;color:#287047}.gdrive-disconnect{grid-column:1/-1;border:0;background:transparent;color:#a34a4a;text-decoration:underline;cursor:pointer;font-size:10.5px}.gdrive-action:disabled,.gdrive-connect:disabled{opacity:.6;cursor:wait}@media(max-width:520px){.gdrive-main-row{align-items:flex-start;flex-wrap:wrap}.gdrive-copy{flex:1 1 180px}.gdrive-connect{width:100%}.gdrive-tools{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  let googlePromise=null;
  let tokenClient=null;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
  const databaseApi=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db||null;
  function readCanonicalDatabase(source){
    try{return databaseApi()?.readState?.({source})||null;}catch{return null;}
  }
  function writeCanonicalDatabase(value,source){
    try{return databaseApi()?.writeState?.(value,{source})===true;}catch{return false;}
  }

  function getSession(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
  function setSession(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
  function delSession(key){try{sessionStorage.removeItem(key);}catch{}}
  function token(){const t=getSession(TOKEN_KEY);return t?.access_token&&Date.now()<Number(t.expires_at||0)-30000?t:null;}
  async function notify(message,title='Google Drive'){if(window.AppDialog?.alert)return AppDialog.alert(message,title);alert(message);}
  async function confirmAction(message,title,ok='Продолжить'){if(window.AppDialog?.confirm)return AppDialog.confirm(message,title,ok,'Отмена');return confirm(`${title}\n\n${message}`);}

  function syncDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(SYNC_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(SYNC_STORE))req.result.createObjectStore(SYNC_STORE);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function getBase(){try{const db=await syncDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(SYNC_STORE,'readonly'),r=tx.objectStore(SYNC_STORE).get(BASE_KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();});}catch{return null;}}
  async function setBase(value){try{const db=await syncDb();await new Promise((resolve,reject)=>{const tx=db.transaction(SYNC_STORE,'readwrite');tx.objectStore(SYNC_STORE).put(clone(value),BASE_KEY);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}catch(e){console.warn('[Google sync base]',e);}}

  function loadGoogle(){
    if(window.google?.accounts?.oauth2)return Promise.resolve();
    if(googlePromise)return googlePromise;
    googlePromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('Не удалось загрузить авторизацию Google.'));document.head.appendChild(s);});
    return googlePromise;
  }
  async function driveFetch(url,options={}){
    const t=token();if(!t)throw new Error('Сессия Google истекла. Подключи Google Drive снова.');
    const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${t.access_token}`);
    const res=await fetch(url,{...options,headers});
    if(res.status===401){delSession(TOKEN_KEY);throw new Error('Сессия Google истекла. Подключи Google Drive снова.');}
    if(!res.ok){let m=`Google Drive: ${res.status}`;try{m=(await res.json())?.error?.message||m;}catch{}throw new Error(m);}
    if(res.status===204)return null;const ct=res.headers.get('content-type')||'';return ct.includes('application/json')?res.json():res.text();
  }
  async function getUser(){const u=getSession(USER_KEY);if(u?.email)return u;const data=await driveFetch('https://openidconnect.googleapis.com/v1/userinfo');setSession(USER_KEY,data);return data;}
  function esc(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  async function findFolder(parentId,name){const parent=parentId?` and '${parentId}' in parents`:'';const q=encodeURIComponent(`name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parent}`);const found=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=20`);return found?.files?.[0]||null;}
  async function createFolder(name,parentId){const body={name,mimeType:'application/vnd.google-apps.folder'};if(parentId)body.parents=[parentId];return driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
  async function ensureFolder(){const cached=getSession(FOLDER_KEY);if(cached?.id)return cached;let folder=await findFolder(null,FOLDER_NAME);if(!folder)folder=await createFolder(FOLDER_NAME);setSession(FOLDER_KEY,folder);return folder;}
  async function ensureBackupFolder(parentId){let folder=await findFolder(parentId,BACKUP_FOLDER_NAME);if(!folder)folder=await createFolder(BACKUP_FOLDER_NAME,parentId);return folder;}
  async function findFile(folderId,name){const q=encodeURIComponent(`name='${esc(name)}' and '${folderId}' in parents and trashed=false`);const data=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime)&spaces=drive&pageSize=20`);return data?.files?.[0]||null;}
  async function listFiles(folderId){const q=encodeURIComponent(`'${folderId}' in parents and trashed=false`);return driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,createdTime)&orderBy=createdTime desc&pageSize=100`);}
  async function uploadJson(folderId,name,data,existingId=null){const boundary='diagnostika_'+Math.random().toString(36).slice(2),meta={name,mimeType:'application/json'};if(!existingId)meta.parents=[folderId];const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(meta),`\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(data,null,2),`\r\n--${boundary}--`]);const url=existingId?`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,name,modifiedTime`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';return driveFetch(url,{method:existingId?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});}
  async function downloadJson(fileId){const text=await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);try{return typeof text==='string'?JSON.parse(text):text;}catch{throw new Error('Файл базы на Google Drive повреждён.');}}
  async function remoteDatabase(){const folder=await ensureFolder(),file=await findFile(folder.id,'database.json');if(!file)return {folder,file:null,data:null};return {folder,file,data:await downloadJson(file.id)};}

  function currentDatabase(){try{if(window.state&&Array.isArray(window.state.clients))return clone(window.state);}catch{}const db=readCanonicalDatabase('google-drive-storage-current');return db&&Array.isArray(db.clients)?db:null;}

  function mergeArray(base,local,remote,path,conflicts){
    const b=Array.isArray(base)?base:[],l=Array.isArray(local)?local:[],r=Array.isArray(remote)?remote:[];
    const allObjects=[...b,...l,...r].filter(v=>v!=null);
    const idBased=allObjects.length>0&&allObjects.every(v=>isObj(v)&&v.id!=null);
    if(!idBased){
      if(eq(l,r))return clone(l);if(eq(l,b))return clone(r);if(eq(r,b))return clone(l);
      const out=[],seen=new Set();for(const v of [...l,...r]){const k=JSON.stringify(v);if(!seen.has(k)){seen.add(k);out.push(clone(v));}}
      if(!eq(l,r))conflicts.push(path||'array');return out;
    }
    const bm=new Map(b.map(v=>[String(v.id),v])),lm=new Map(l.map(v=>[String(v.id),v])),rm=new Map(r.map(v=>[String(v.id),v]));
    const order=[];for(const v of [...l,...r,...b]){const id=String(v.id);if(!order.includes(id))order.push(id);}
    const out=[];
    for(const id of order){const bv=bm.get(id),lv=lm.get(id),rv=rm.get(id);const p=`${path}[${id}]`;
      if(!bv){if(lv&&rv)out.push(mergeValue(undefined,lv,rv,p,conflicts));else if(lv)out.push(clone(lv));else if(rv)out.push(clone(rv));continue;}
      if(!lv&&!rv)continue;
      if(!lv&&rv){if(eq(rv,bv))continue;conflicts.push(`${p}: удалено локально, изменено в облаке`);out.push(clone(rv));continue;}
      if(lv&&!rv){if(eq(lv,bv))continue;conflicts.push(`${p}: удалено в облаке, изменено локально`);out.push(clone(lv));continue;}
      out.push(mergeValue(bv,lv,rv,p,conflicts));
    }
    return out;
  }
  function mergeValue(base,local,remote,path,conflicts){
    if(eq(local,remote))return clone(local);
    if(eq(local,base))return clone(remote);
    if(eq(remote,base))return clone(local);
    if(Array.isArray(local)||Array.isArray(remote)||Array.isArray(base))return mergeArray(base,local,remote,path,conflicts);
    if(isObj(local)||isObj(remote)||isObj(base)){
      const b=isObj(base)?base:{},l=isObj(local)?local:{},r=isObj(remote)?remote:{};const out={};
      const keys=new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)]);
      for(const k of keys){const hasL=Object.prototype.hasOwnProperty.call(l,k),hasR=Object.prototype.hasOwnProperty.call(r,k),hasB=Object.prototype.hasOwnProperty.call(b,k);const p=path?`${path}.${k}`:k;
        if(!hasL&&!hasR)continue;
        if(!hasB){if(hasL&&hasR)out[k]=mergeValue(undefined,l[k],r[k],p,conflicts);else out[k]=clone(hasL?l[k]:r[k]);continue;}
        if(!hasL&&hasR){if(eq(r[k],b[k]))continue;conflicts.push(`${p}: удалено локально, изменено в облаке`);out[k]=clone(r[k]);continue;}
        if(hasL&&!hasR){if(eq(l[k],b[k]))continue;conflicts.push(`${p}: удалено в облаке, изменено локально`);out[k]=clone(l[k]);continue;}
        out[k]=mergeValue(b[k],l[k],r[k],p,conflicts);
      }return out;
    }
    conflicts.push(path||'value');return clone(local);
  }
  function applyClientDeletionRules(merged,base,local,remote,conflicts){
    merged.deletedClientTombstones=[...new Set([...(base?.deletedClientTombstones||[]),...(local?.deletedClientTombstones||[]),...(remote?.deletedClientTombstones||[])])];
    const tomb=new Set(merged.deletedClientTombstones.map(String));
    merged.clients=(merged.clients||[]).filter(c=>!tomb.has(String(c?.id)));
    merged.deletedClients=(merged.deletedClients||[]).filter(c=>!tomb.has(String(c?.id)));
    const baseActive=new Map((base?.clients||[]).map(c=>[String(c.id),c]));
    const localDeleted=new Map((local?.deletedClients||[]).map(c=>[String(c.id),c]));
    const remoteDeleted=new Map((remote?.deletedClients||[]).map(c=>[String(c.id),c]));
    const localActive=new Map((local?.clients||[]).map(c=>[String(c.id),c]));
    const remoteActive=new Map((remote?.clients||[]).map(c=>[String(c.id),c]));
    const softDeleted=new Set([...localDeleted.keys(),...remoteDeleted.keys()]);
    for(const id of softDeleted){if(tomb.has(id))continue;const bv=baseActive.get(id),la=localActive.get(id),ra=remoteActive.get(id),ld=localDeleted.get(id),rd=remoteDeleted.get(id);let deletionWins=false;
      if(ld&&!la){if(!ra||!bv||eq(ra,bv))deletionWins=true;else conflicts.push(`client[${id}]: удалён локально, но изменён в облаке`);}
      if(rd&&!ra){if(!la||!bv||eq(la,bv))deletionWins=true;else conflicts.push(`client[${id}]: удалён в облаке, но изменён локально`);}
      if(deletionWins){merged.clients=(merged.clients||[]).filter(c=>String(c.id)!==id);const deleted=clone(ld||rd);if(deleted&&!merged.deletedClients.some(c=>String(c.id)===id))merged.deletedClients.push(deleted);}
    }
    const activeIds=new Set((merged.clients||[]).map(c=>String(c.id)));merged.deletedClients=(merged.deletedClients||[]).filter(c=>!activeIds.has(String(c.id)));
    return merged;
  }
  function mergeDatabases(base,local,remote){const conflicts=[];const b=base&&Array.isArray(base.clients)?base:{version:4,clients:[]};const l=local&&Array.isArray(local.clients)?local:{version:4,clients:[]};const r=remote&&Array.isArray(remote.clients)?remote:{version:4,clients:[]};let merged=mergeValue(b,l,r,'',conflicts);merged=applyClientDeletionRules(merged,b,l,r,conflicts);merged.version=Math.max(Number(l.version)||4,Number(r.version)||4,Number(b.version)||4);return {merged,conflicts};}

  async function backupSnapshot(folderId,prefix,data){if(!data||!Array.isArray(data.clients))return null;const backups=await ensureBackupFolder(folderId);return uploadJson(backups.id,`${prefix}-${stamp()}.json`,data);}
  async function cleanupBackups(folderId){try{const backups=await ensureBackupFolder(folderId),list=await listFiles(backups.id),files=(list?.files||[]).filter(f=>f.name.endsWith('.json'));for(const f of files.slice(MAX_BACKUPS))await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}`,{method:'DELETE'});}catch(e){console.warn('[Google backup cleanup]',e);}}
  async function writeRemote(folder,file,data){return uploadJson(folder.id,'database.json',data,file?.id||null);}

  async function safeSync(){
    const local=currentDatabase();if(!local)throw new Error('Не удалось получить текущую базу браузера.');
    const remote=await remoteDatabase();const base=await getBase();
    await backupSnapshot(remote.folder.id,'local-before-sync',local);
    if(remote.data)await backupSnapshot(remote.folder.id,'cloud-before-sync',remote.data);
    const {merged,conflicts}=mergeDatabases(base,local,remote.data||{version:4,clients:[]});
    await writeRemote(remote.folder,remote.file,merged);
    if(!writeCanonicalDatabase(merged,'google-drive-storage-sync'))throw new Error('Объединённая база сохранена в Google, но локальную копию сохранить не удалось. Перезагружать страницу не нужно.');
    await setBase(merged);await cleanupBackups(remote.folder.id);
    return {merged,conflicts,localCount:local.clients.length,remoteCount:remote.data?.clients?.length||0};
  }
  async function safeRestore(){
    const local=currentDatabase(),remote=await remoteDatabase();if(!remote.data)throw new Error('На Google Drive ещё нет database.json.');
    if(local)await backupSnapshot(remote.folder.id,'local-before-restore',local);
    if(!writeCanonicalDatabase(remote.data,'google-drive-storage-restore'))throw new Error('Не удалось сохранить облачную базу в браузере. Текущая локальная база не изменена.');
    await setBase(remote.data);await cleanupBackups(remote.folder.id);return remote.data;
  }

  function mount(){
    const dlg=document.querySelector('.storage-dialog'),shell=dlg?.querySelector('.storage-shell'),footer=shell?.querySelector('.storage-footer');if(!dlg||!shell||!footer||shell.querySelector('.gdrive-card'))return false;
    const section=document.createElement('div');section.className='storage-cloud-section';section.innerHTML=`<div class="storage-cloud-title">ОБЛАЧНЫЕ ХРАНИЛИЩА</div><div class="gdrive-card"><div class="gdrive-main-row">${driveIcon}<div class="gdrive-copy"><div class="gdrive-name">Google Drive</div><div class="gdrive-status">Не подключён</div></div><button type="button" class="gdrive-connect">Подключить Google Drive</button></div><div class="gdrive-note">Безопасная синхронизация: перед изменением облачной базы создаются резервные копии локальной и облачной версий. Клиенты и вложенные записи объединяются по ID, удалённые навсегда клиенты не восстанавливаются.</div><div class="gdrive-tools"><button type="button" class="gdrive-action gdrive-sync">Синхронизировать с Google Drive</button><button type="button" class="gdrive-action gdrive-restore">Восстановить только из Google Drive</button><button type="button" class="gdrive-disconnect">Отключить Google Drive</button></div></div>`;shell.insertBefore(section,footer);
    const card=section.querySelector('.gdrive-card'),status=section.querySelector('.gdrive-status'),connect=section.querySelector('.gdrive-connect'),sync=section.querySelector('.gdrive-sync'),restore=section.querySelector('.gdrive-restore'),disconnect=section.querySelector('.gdrive-disconnect');
    function busy(v){connect.disabled=v;sync.disabled=v;restore.disabled=v;}
    async function ui(){const t=token();if(!t){card.classList.remove('connected');connect.classList.remove('connected');connect.textContent='Подключить Google Drive';status.textContent=CLIENT_ID?'Не подключён':'Google OAuth ещё не настроен';return;}try{const u=await getUser();await ensureFolder();card.classList.add('connected');connect.classList.add('connected');connect.textContent='Google Drive подключён';status.textContent=u?.email?`Подключён: ${u.email}`:'Подключён';}catch(e){status.textContent=e.message;}}
    connect.onclick=async()=>{if(token())return;if(!CLIENT_ID){await notify('Google OAuth Client ID не настроен.','Нужна настройка Google');return;}busy(true);status.textContent='Открываю Google…';try{await loadGoogle();tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:DRIVE_SCOPE,callback:async r=>{busy(false);if(r?.error){status.textContent=`Google: ${r.error}`;return;}setSession(TOKEN_KEY,{access_token:r.access_token,expires_at:Date.now()+(Number(r.expires_in)||3600)*1000});delSession(USER_KEY);delSession(FOLDER_KEY);await ui();}});tokenClient.requestAccessToken({prompt:'consent'});}catch(e){busy(false);status.textContent=e.message;}};
    sync.onclick=async()=>{const ok=await confirmAction('Программа сначала сохранит страховочные копии обеих баз, затем объединит данные этого компьютера и Google Drive. Данные с уникальными ID не будут просто заменяться.','Безопасная синхронизация','Синхронизировать');if(!ok)return;busy(true);const old=sync.textContent;sync.textContent='Синхронизирую…';try{const r=await safeSync();status.textContent=`Синхронизировано: ${r.merged.clients.length} клиент(ов). Резервные копии созданы.${r.conflicts.length?` Конфликтов: ${r.conflicts.length}.`:''}`;await notify(`Готово.\nНа этом ПК было: ${r.localCount}.\nВ Google было: ${r.remoteCount}.\nПосле объединения: ${r.merged.clients.length}.\nРезервные копии сохранены в Diagnostika/Backups.${r.conflicts.length?`\nКонфликтов полей: ${r.conflicts.length}. При конфликте сохранена локальная версия, обе исходные базы есть в Backups.`:''}\n\nСтраница будет перезагружена.`,'Синхронизация завершена');location.reload();}catch(e){await notify(e.message,'Ошибка синхронизации');}finally{sync.textContent=old;busy(false);}};
    restore.onclick=async()=>{const ok=await confirmAction('Текущая база этого браузера будет предварительно сохранена в Diagnostika/Backups, после чего локальная база будет заменена облачной.','Восстановить из Google Drive?','Восстановить');if(!ok)return;busy(true);const old=restore.textContent;restore.textContent='Восстанавливаю…';try{const db=await safeRestore();await notify(`Восстановлено клиентов: ${db.clients.length}. Локальная версия до восстановления сохранена в Backups. Страница будет перезагружена.`,'Готово');location.reload();}catch(e){await notify(e.message,'Ошибка восстановления');}finally{restore.textContent=old;busy(false);}};
    disconnect.onclick=async()=>{const t=token();if(t?.access_token){try{await loadGoogle();window.google.accounts.oauth2.revoke(t.access_token,()=>{});}catch{}}delSession(TOKEN_KEY);delSession(USER_KEY);delSession(FOLDER_KEY);await ui();};
    ui();return true;
  }

  if(!mount())setTimeout(mount,50);
})();
