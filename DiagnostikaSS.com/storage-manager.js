'use strict';

(() => {
  if(window.DiagnostikaStorageUI)return;
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';

  let rootHandle=null;
  let appHandle=null;
  let syncTimer=null;
  let syncing=false;
  let pendingSync=false;
  let folderState=null;
  let backupState='offline', armed=false, revision=0, verifiedRevision=-1, syncError='';
  let missingReceipts=[];
  const syncLabels={partial:'База сохранена и проверена; отсутствуют отдельные чеки',offline:'Папка не подключена или нет доступа',pending:'Есть несохранённые изменения',working:'Синхронизация выполняется',ready:'Данные синхронизированы',error:'Синхронизация не завершена',restore:'Найдена база — сначала восстановите её',locked:'Для этого компьютера требуется однократное подтверждение ключа'};
  function receiptDetails(data,ids){
    const entries=window.DiagnostikaPaymentReceipts?.receiptEntries?.(data)||[];
    const missing=new Set(ids.map(String));
    return entries.filter(e=>missing.has(String(e.id)));
  }
  function receiptDescription(e){
    return (e.clientName||'Клиент ID '+e.clientId)+' — '+(e.ordinal?'сессия № '+e.ordinal+(e.sessionDate?' ('+e.sessionDate+')':''):e.paymentId?'платёж '+e.paymentId:'платёж')+' — '+e.name+(e.date?' · '+e.date:'');
  }
  function showReceiptDetails(){
    const panel=document.querySelector('#localMissingReceipts');if(!panel)return;
    panel.hidden=backupState!=='partial'||!missingReceipts.length;
    const list=panel.querySelector('ul');list.replaceChildren();
    for(const e of missingReceipts){const li=document.createElement('li');li.textContent=receiptDescription(e);list.append(li);}
    panel.querySelector('summary').textContent='Отсутствующие чеки: '+missingReceipts.length+' — подробнее';
  }
  function paintSync(value){
    const vault=window.DiagnostikaFolderVault,encrypted=location.hostname==='zabvenye.com'&&vault?.mode();
    const message=value==='ready'&&encrypted?'Данные синхронизированы и зашифрованы':syncLabels[value];
    const keyIcon=document.querySelector('#storageVaultKey');if(keyIcon){const good=Boolean(vault?.keyUnlocked())&&!['error','locked','offline'].includes(value);keyIcon.style.color=good?'#15803d':'#b42318';keyIcon.setAttribute('aria-label',good?'Ключ подтверждён':'Ключ не подтверждён');keyIcon.setAttribute('title',good?'Ключ подтверждён':'Ключ не подтверждён');const label=keyIcon.querySelector('span');if(label)label.textContent=good?'Ключ подтверждён автоматически':'Ключ не подтверждён';}
    if(value==='ready'&&missingReceipts.length)value='partial';
    backupState=value;if(value!=='error')syncError='';
    for(const dot of document.querySelectorAll('.local-sync-dot')){
      dot.dataset.syncState=value;
      dot.title=message+(value==='error'&&syncError?': '+syncError:'');
      dot.setAttribute('aria-label',message);
    }
    const label=document.querySelector('#localSyncLabel');if(label)label.textContent=message+(value==='error'&&syncError?': '+syncError:'');
    showReceiptDetails();
    window.dispatchEvent(new Event('diagnostika:storage-setup-changed'));
  }
  function attachSyncDot(button){
    if(!button||button.querySelector('.local-sync-dot'))return;
    const dot=document.createElement('span');dot.className='local-sync-dot';dot.setAttribute('role','img');button.append(dot);paintSync(backupState);
  }
  function canonical(v){return JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)}
  async function verifyCore(expected=state){
    const saved=await readFolderState();
    if(!saved||canonical(saved)!==canonical(expected))throw Error('Проверка сохранённой базы не пройдена');
    folderState=saved;
  }
  function markDirty(){revision++;if(armed&&rootHandle){if(!syncing)paintSync('pending');scheduleSync();}}


  function writeCanonicalDatabase(value,source){
    const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
    if(!db?.writeState)throw new Error('Слой базы данных недоступен.');
    if(db.writeState(value,{source})!==true)throw new Error('Не удалось сохранить восстановленную базу в браузере.');
    return true;
  }

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

  function filesApi(){
    const facade=window.DiagnostikaFiles;
    if(facade?.moduleAware===true)return facade;
    return window.DiagnostikaPlatform?.services?.files||null;
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

  async function protectedFolder(){if(location.hostname!=='zabvenye.com')return false;if(localStorage.getItem('zabvenye-folder-encrypted-v1')==='1')return true;const a=await getExistingAppHandle();if(!a)return false;try{await a.getFileHandle('database.zbv');return true}catch(e){if(e.name==='NotFoundError')return false;throw e}}
  async function readFolderState(){
    if(await protectedFolder())return null;
    const app=await getExistingAppHandle();
    if(!app) return null;
    const data=await readJson(app,'database.json');
    if(!data || !Array.isArray(data.clients)) return null;
    return data;
  }

  async function writeBlob(dir,name,blob){
    if(await protectedFolder())throw Error('Запись незашифрованной базы запрещена.');
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

  async function findClientDirById(clientId){
    const app=await getExistingAppHandle();
    if(!app)return null;
    let clients;
    try{clients=await app.getDirectoryHandle('clients',{create:false});}
    catch(e){if(e?.name==='NotFoundError')return null;throw e;}

    const suffix='_'+shortId(clientId);
    for await(const [name,handle] of clients.entries()){
      if(handle?.kind==='directory'&&name.endsWith(suffix))return handle;
    }
    return null;
  }

  async function findSessionDirById(clientId,sessionId){
    const cd=await findClientDirById(clientId);
    if(!cd)return null;
    let sessions;
    try{sessions=await cd.getDirectoryHandle('sessions',{create:false});}
    catch(e){if(e?.name==='NotFoundError')return null;throw e;}

    const suffix='_'+shortId(sessionId);
    for await(const [name,handle] of sessions.entries()){
      if(handle?.kind==='directory'&&name.endsWith(suffix))return handle;
    }
    return null;
  }

  async function writeCoreState(data=state){
    if(!rootHandle) return;
    const app=await getOrCreateAppHandle();
    await writeJson(app,'database.json',data);
    await writeJson(app,'settings.json',{
      format:'diagnostika-folder-v2',
      updatedAt:new Date().toISOString(),
      clientCount:Array.isArray(data.clients)?data.clients.length:0
    });

    for(const c of data.clients||[]){
      const cd=await ensureClientDir(c);
      await writeJson(cd,'client.json',{...c,sessions:(c.sessions||[]).map(s=>({...s}))});
      const sessions=c.sessions||[];
      for(let i=0;i<sessions.length;i++){
        const sd=await ensureSessionDir(c,sessions[i],i);
        await writeJson(sd,'session.json',sessions[i]);
      }
    }
    folderState=JSON.parse(JSON.stringify(data));
  }

  async function mirrorRecord(rec,data=state){
    if(!rec?.blob || !rootHandle) return;
    const c=(data.clients||[]).find(x=>x.id===rec.clientId);
    if(!c) return;
    const index=(c.sessions||[]).findIndex(x=>x.id===rec.sessionId);
    if(index<0) return;
    const sd=await ensureSessionDir(c,c.sessions[index],index);
    const fd=await sd.getDirectoryHandle('files',{create:true});
    await writeBlob(fd,`${shortId(rec.id)}_${safeName(rec.name,'file')}`,rec.blob);
  }

  async function removeMirroredRecord(rec){
    if(!rec || !rootHandle || await protectedFolder()) return;
    try{
      const sd=await findSessionDirById(rec.clientId,rec.sessionId);
      if(!sd)return;
      let fd;
      try{fd=await sd.getDirectoryHandle('files',{create:false});}
      catch(e){if(e?.name==='NotFoundError')return;throw e;}
      await fd.removeEntry(`${shortId(rec.id)}_${safeName(rec.name,'file')}`);
    }catch(e){
      if(e?.name!=='NotFoundError')console.warn('Не удалось удалить зеркальную копию файла',e);
    }
  }

  async function syncReceiptDisk(data=state){
    if(!rootHandle){rootHandle=await loadHandle();appHandle=null;}
    if(!rootHandle||await permission(rootHandle,false)!=='granted')throw Error('Подключи папку на компьютере в разделе «Хранилище».');
    const receipts=window.DiagnostikaPaymentReceipts;
    if(!receipts)return {count:0,missing:[]};
    if(await protectedFolder()){const missing=[];let count=0;for(const entry of receipts.receiptEntries(data)){if((await filesApi()?.get(entry.id))?.blob)count++;else missing.push(entry.id)}return {count,missing};}
    async function dir(entry,create){
      const client=(data.clients||[]).find(c=>String(c.id)===entry.clientId);
      if(!client)return null;
      let cd=await findClientDirById(entry.clientId);
      if(!cd&&create)cd=await ensureClientDir(client);
      if(!cd)return null;
      let parent=cd;
      if(entry.sessionId){
        parent=await findSessionDirById(entry.clientId,entry.sessionId);
        if(!parent&&create){
          const index=(client.sessions||[]).findIndex(s=>String(s.id)===entry.sessionId);
          if(index<0)return null;
          parent=await ensureSessionDir(client,client.sessions[index],index);
        }
        if(!parent)return null;
      }
      try{return await parent.getDirectoryHandle('receipts',{create});}
      catch(e){if(e.name==='NotFoundError')return null;throw e;}
    }
    return receipts.syncReceiptFiles(data,{
      async find(entry){
        const d=await dir(entry,false);if(!d)return null;
        try{return await d.getFileHandle(safeName(entry.filename),{create:false});}
        catch(e){if(e.name==='NotFoundError')return null;throw e;}
      },
      async read(entry,h){return h.getFile();},
      async write(entry,blob){const d=await dir(entry,true);if(!d)throw Error('Не найдена папка чека.');await writeBlob(d,safeName(entry.filename),blob);}
    });
  }
  window.DiagnostikaReceiptDisk=Object.freeze({sync:syncReceiptDisk});
  window.addEventListener('diagnostika:payment-receipt-saved',()=>{
    markDirty();
  });

  async function fullExport(data=state){
    if(await protectedFolder())throw Error('Используйте синхронизацию ZBV.');
    const result=await syncReceiptDisk(data);
    missingReceipts=receiptDetails(data,result.missing);
    await writeCoreState(data);
    const api=filesApi();
    if(api?.list){
      for(const c of data.clients||[]){
        for(const s of c.sessions||[]){
          const files=await api.list({sessionId:s.id});
          for(const rec of files) await mirrorRecord(rec,data);
        }
      }
    }
    return missingReceipts.map(receiptDescription);
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
    const ok=await AppDialog.confirm(
      `Будет загружено клиентов: ${count}.\nТекущая база этого браузера будет заменена.`,
      'Восстановить базу из папки?',
      'Восстановить',
      'Отмена'
    );
    if(!ok) return false;

    if(!await window.DiagnostikaStorageRefresh.prepare())return false;
    const receiptResult=await syncReceiptDisk(folderState);
    missingReceipts=receiptDetails(folderState,receiptResult.missing);
    writeCanonicalDatabase(folderState,'storage-manager-restore');
    window.DiagnostikaStorageRefresh.apply();
    try{localStorage.setItem('diagnostika-folder-restore-confirmed','1');}catch(_){}

    await AppDialog.alert(`База восстановлена. Клиентов: ${count}.`+(missingReceipts.length?'\nОтсутствуют чеки (записи об оплатах сохранены):\n'+missingReceipts.map(receiptDescription).join('\n'):''),'Готово');
    return true;
  }

  async function doSync(){
    if(syncing){pendingSync=true;return;}
    if(!rootHandle||!armed) return;
    syncing=true;
    const started=revision;paintSync("working");
    try{
      if(await protectedFolder()){if(!window.DiagnostikaFolderVault)throw Error('Модуль шифрования недоступен.');const result=await window.DiagnostikaFolderVault.sync(rootHandle,{ask:false});if(!result||result.restored)throw Error('Необходимо открыть базу вручную.');missingReceipts=[];}else{if(location.hostname==='zabvenye.com')throw Error('Сначала зашифруйте базу в разделе «Хранилище».');const snapshot=JSON.parse(JSON.stringify(state));await fullExport(snapshot);await verifyCore(snapshot);}
      verifiedRevision=started;
      paintSync(revision===started?'ready':'pending');
      await updateStatus();
    }catch(e){
      if(e.code==='ZBV_KEY_REQUIRED'){armed=false;paintSync('locked');await updateStatus();return;}
      armed=false;syncError=e.message||'Ошибка записи';paintSync('error');
      console.warn('Синхронизация папки не выполнена',e);
      const status=document.querySelector('#storageStatus');if(status)status.textContent='Синхронизация не завершена: '+(e.message||'ошибка записи');
    }finally{
      syncing=false;
      if(pendingSync||revision!==verifiedRevision&&backupState==='pending'){pendingSync=false;scheduleSync();}
    }
  }

  // Both manual merge and automatic backup use this single lock and indicator.
  window.DiagnostikaLocalFolderSync=Object.freeze({
    async begin(handle){
      if(syncing)throw Error('Синхронизация уже выполняется. Повторите после её завершения.');
      if(!handle||await permission(handle,false)!=='granted')throw Error('Нет доступа к папке');
      if(syncing)throw Error('Синхронизация уже выполняется.');
      clearTimeout(syncTimer);syncing=true;armed=false;pendingSync=false;rootHandle=handle;appHandle=null;verifiedRevision=-1;paintSync('working');
    },
    async complete(data){
      if(!syncing)throw Error('Синхронизация не запущена');
      try{
        await fullExport(data);await verifyCore(data);
        verifiedRevision=revision;armed=true;paintSync('ready');void updateStatus().catch(()=>{});
        return missingReceipts.map(receiptDescription);
      }catch(e){armed=false;syncError=e.message||'Ошибка записи';paintSync('error');throw e;}
      finally{syncing=false;}
    },
    finishEncrypted(){syncing=false;armed=true;missingReceipts=[];verifiedRevision=revision;paintSync('ready');void updateStatus().catch(()=>{});},
    async folderSelected(handle){rootHandle=handle;appHandle=null;folderState=null;armed=false;verifiedRevision=-1;paintSync('pending');await updateStatus();},
    resumeTrusted(){if(syncing||!rootHandle||armed)return;armed=true;paintSync('pending');scheduleSync();void updateStatus().catch(()=>{});},
    fail(error){syncing=false;armed=false;syncError=error?.message||'Ошибка записи';paintSync(error?.code==='ZBV_KEY_REQUIRED'?'locked':'error');},
    folderChanged(){window.DiagnostikaFolderVault?.lock();if(syncing)throw Error('Синхронизация уже выполняется');clearTimeout(syncTimer);armed=false;rootHandle=null;appHandle=null;folderState=null;missingReceipts=[];paintSync('offline');},
    attach:attachSyncDot
  });
  function scheduleSync(){
    if(!armed||!rootHandle)return;
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
  dlg.id='storageDialog';
  dlg.className='storage-dialog';
  dlg.innerHTML=`
    <div class="storage-shell">
      <div class="storage-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px">ХРАНИЛИЩЕ ДАННЫХ<button id="storageHelp" type="button" aria-label="Инструкция по хранилищу" title="Инструкция по хранилищу" aria-expanded="false" aria-controls="storageHelpContent" style="min-width:28px;height:28px;border:1px solid #a9bfd5;border-radius:50%;background:#fff;color:#304e69;font-weight:700;cursor:pointer">?</button></div>
      <section id="storageHelpContent" hidden style="padding:12px;border:1px solid #b9cbdc;border-radius:8px;background:#f6f9fc;color:#24364a;font-size:13px;line-height:1.5">
        <p><strong>Что это такое?</strong><br>Хранилище сохраняет базу клиентов и файлы на вашем компьютере. Google Drive не используется.</p>
        <p><strong>Как сохранить данные?</strong><br>Выберите папку на компьютере. Нажмите «Сохранить текущую базу и файлы в папку». Для восстановления выберите папку и нажмите «Восстановить базу из папки».</p>
        <p><strong>Зачем нужно шифрование?</strong><br>Файл database.zbv в выбранной папке защищён шифрованием AES-256-GCM.</p>
        <p><strong>Как пользоваться шифрованием?</strong><br>Создайте ключ или введите пароль от 12 символов. Сохраните ключ отдельно, зашифруйте папку и скачайте файл .zbv. Для восстановления выберите этот файл и введите тот же ключ.</p>
        <p><strong>Если забыли ключ?</strong><br>Если восстановление по лицензии было подключено заранее, воспользуйтесь кнопкой «Восстановление ключа по лицензии».</p>
      </section>
      <div id="storageStatus" class="storage-status"></div><div class="local-sync-line"><span class="local-sync-dot" role="img"></span><span id="localSyncLabel" role="status"></span></div>
      <details id="localMissingReceipts" class="local-missing-receipts" hidden><summary></summary><p>Эти файлы не найдены ни в браузере, ни в выбранной папке. Записи об оплатах сохранены. При необходимости прикрепите чек заново или удалите его привязку в оплатах.</p><ul></ul></details>
      <div class="storage-info">
        База клиентов хранится и в браузере, и в выбранной папке. При работе с другого браузера или компьютера сначала восстанови базу из этой папки.
      </div>
      <div class="storage-actions-main">
        <button id="storageChoose" type="button" class="storage-primary">Выбрать папку на компьютере</button>
        <button id="storageRestore" type="button">Восстановить базу из папки</button>
        <button id="storageExport" type="button">Сохранить текущую базу и файлы в папку</button>
        <button id="storageDisconnect" type="button">Отключить папку</button>
      </div>
      <div class="storage-example">В выбранной папке хранится:<br><code>Diagnostika / database.zbv</code></div>
      <div class="storage-footer"><button id="storageClose" type="button">Закрыть</button></div>
    </div>`;
  document.body.appendChild(dlg);
  // Delegate the click instead of relying on the original header node.
  // Header recovery and settings updates may move or replace that node.
  function openStorage(){
    if(!dlg.open)dlg.showModal();
    Promise.resolve().then(updateStatus).catch(error=>{
      console.warn('Не удалось проверить состояние папки',error);
      const status=dlg.querySelector('#storageStatus');
      status.className='storage-status warn';
      status.textContent='Не удалось проверить папку. Выберите папку заново или повторите попытку.';
    });
  }
  async function setupStatus(){
    const vault=window.DiagnostikaFolderVault;
    if(location.hostname!=='zabvenye.com'||!vault)return 'unknown';
    const root=await loadHandle();
    if(!root)return 'folder';
    if(await permission(root,false)!=='granted')return vault.mode()&&localStorage.getItem('zabvenye-folder-baseline-v1')?'ready':'folder';
    if(!await vault.hasEncrypted(root))return 'encrypt';
    return (vault.mode()&&localStorage.getItem('zabvenye-folder-baseline-v1')||vault.keyUnlocked()&&backupState==='ready')?'ready':'existing';
  }
  window.DiagnostikaStorageUI=Object.freeze({open:openStorage,setupStatus});
  document.addEventListener('click',event=>{
    const control=event.target?.closest?.('#storageBtn');
    if(!control)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{openStorage()}catch(error){
      console.error('Не удалось открыть хранилище',error);
      if(window.AppDialog?.alert)window.AppDialog.alert('Не удалось открыть хранилище. Повторите попытку.','Хранилище');
    }
  },true);
  attachSyncDot(btn);attachSyncDot(dlg.querySelector("#storageExport"));paintSync("offline");

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
      paintSync('offline');
      status.className='storage-status neutral';
      status.textContent='Папка пока не выбрана.';
      restoreBtn.disabled=true;exportBtn.disabled=true;disconnectBtn.disabled=true;
      return;
    }

    let p='prompt';
    try{p=await permission(rootHandle,false);}catch(e){}
    if(p!=='granted'){
      paintSync('offline');
      status.className='storage-status warn';
      status.textContent=`Папка ${rootHandle.name} сохранена, но браузеру нужно снова разрешить доступ.`;
      restoreBtn.disabled=true;exportBtn.disabled=true;disconnectBtn.disabled=false;
      return;
    }

    if(await protectedFolder()){status.className='storage-status good';status.textContent='Подключено: '+rootHandle.name+' / '+APP_DIR+' / database.zbv';const badge=document.createElement('span');badge.id='storageVaultKey';badge.style.cssText='display:flex;align-items:center;gap:8px;margin-top:5px;font-weight:700';badge.innerHTML='<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12L21 2m-5 5 3 3m-6 0 3 3"/></svg><span></span>';status.append(badge);paintSync(backupState);restoreBtn.disabled=true;exportBtn.disabled=true;disconnectBtn.disabled=false;return;}
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
      if(await permission(h,true)!=='granted'){
        await AppDialog.alert('Доступ к папке не разрешён.','Нет доступа');
        return;
      }

      if(syncing)throw Error('Дождитесь окончания синхронизации');
      clearTimeout(syncTimer);armed=false;verifiedRevision=-1;paintSync('pending');
      rootHandle=h;
      appHandle=null;
      folderState=null;
      await saveHandle(h);
      folderState=await readFolderState();

      if(folderState){
        paintSync('restore');
        await updateStatus();
        await AppDialog.alert(
          `В папке найдена база: ${folderClientCount()} клиент(ов).\nОна НЕ будет перезаписана автоматически.\nНажми «Восстановить базу из папки», чтобы открыть её в этом браузере.`,
          'База найдена'
        );
      }else{
        syncing=true;paintSync('working');const started=revision;
        try{await fullExport();await verifyCore();armed=true;verifiedRevision=started;paintSync(revision===started?'ready':'pending');}finally{syncing=false;}
        await updateStatus();
        await AppDialog.alert('Новая папка подключена. Текущая база и файлы сохранены в неё.','Папка подключена');
      }
    }catch(e){
      if(e?.name!=='AbortError'){
        paintSync('error');console.error(e);
        await AppDialog.alert('Не удалось подключить папку.','Ошибка');
      }
    }
  };

  restoreBtn.onclick=async()=>{
    try{
      if(!rootHandle) return;
      if(await permission(rootHandle,true)!=='granted'){
        await AppDialog.alert('Разреши доступ к папке.','Нужен доступ');
        return;
      }
      await restoreFromFolder();
    }catch(e){
      console.error(e);
      await AppDialog.alert(e?.message||'Не удалось восстановить базу из папки.','Ошибка восстановления');
    }
  };

  exportBtn.onclick=async()=>{
    if(!rootHandle||syncing) return;
    try{
      if(await permission(rootHandle,true)!=='granted'){
        await AppDialog.alert('Разреши доступ к папке.','Нужен доступ');
        return;
      }

      folderState=await readFolderState();
      if(folderState){
        const fc=folderClientCount();
        const bc=browserClientCount();
        const ok=await AppDialog.confirm(
          `В браузере: ${bc} клиент(ов).\nВ папке сейчас: ${fc} клиент(ов).\n\nФайл database.json в папке будет заменён.`,
          'Сохранить базу этого браузера в папку?',
          'Сохранить',
          'Отмена'
        );
        if(!ok) return;
      }

      exportBtn.disabled=true;
      exportBtn.textContent='Сохраняю…';attachSyncDot(exportBtn);
      syncing=true;paintSync('working');const started=revision;
      await fullExport();await verifyCore();armed=true;verifiedRevision=started;paintSync(revision===started?'ready':'pending');
      await updateStatus();
      await AppDialog.alert('База клиентов и доступные файлы сохранены в папку.'+(missingReceipts.length?'\nОтсутствующие чеки:\n'+missingReceipts.map(receiptDescription).join('\n'):''),'Готово');
    }catch(e){
      paintSync('error');console.error(e);
      await AppDialog.alert('Не удалось сохранить данные в папку.','Ошибка');
    }finally{
      syncing=false;
      exportBtn.textContent='Сохранить текущую базу и файлы в папку';attachSyncDot(exportBtn);
      exportBtn.disabled=false;if(armed&&revision!==verifiedRevision)scheduleSync();
    }
  };

  disconnectBtn.onclick=async()=>{
    if(syncing)return;
    const ok=await AppDialog.confirm(
      'Данные в самой папке удалены не будут.',
      'Отключить папку?',
      'Отключить',
      'Отмена'
    );
    if(!ok) return;
    window.DiagnostikaFolderVault?.lock();armed=false;verifiedRevision=-1;paintSync('offline');
    rootHandle=null;
    appHandle=null;
    folderState=null;
    clearTimeout(syncTimer);
    await clearHandle();
    await updateStatus();
  };

  const helpButton=dlg.querySelector('#storageHelp'),helpContent=dlg.querySelector('#storageHelpContent');
  helpButton.onclick=()=>{helpContent.hidden=!helpContent.hidden;helpButton.setAttribute('aria-expanded',String(!helpContent.hidden));};
  dlg.querySelector('#storageClose').onclick=()=>dlg.close();
  btn.onclick=null;
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  const originalSave=save;
  save=function(){
    const ok=originalSave.apply(this,arguments);
    if(ok!==false)markDirty();return ok;
  };

  let fileEventsBound=false;
  function bindFileEvents(){
    if(fileEventsBound)return true;
    const bus=window.DiagnostikaPlatform?.events;
    if(!bus?.on)return false;

    bus.on('db:written',detail=>{if(detail?.key==='diagnostika-web-v1')markDirty();});
    bus.on('file:created',detail=>{
      Promise.resolve().then(async()=>{
        if(!rootHandle||!armed)return;
        markDirty();
      }).catch(e=>console.warn('Файл сохранён в браузере, но не скопирован в папку',e));
    });

    bus.on('file:deleted',detail=>{
      Promise.resolve().then(async()=>{
        if(!rootHandle||!armed||!detail?.record)return;
        await removeMirroredRecord(detail.record);markDirty();
      }).catch(e=>console.warn('Файл удалён из браузера, но зеркальная копия не удалена',e));
    });

    fileEventsBound=true;
    return true;
  }

  bindFileEvents();
  Promise.resolve(window.DiagnostikaPlatform?.ready).then(bindFileEvents).catch(()=>{});

  (async()=>{
    if(!('showDirectoryPicker' in window)) return;
    try{
      rootHandle=await loadHandle();
      if(rootHandle && await permission(rootHandle,false)==='granted'){
        appHandle=null;
        if(await protectedFolder()){await new Promise(resolve=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolve,{once:true});else resolve();});await window.DiagnostikaPlatform?.ready;if(!rootHandle||syncing)return;armed=true;await doSync();return;}
        folderState=await readFolderState();
        if(location.hostname==='zabvenye.com'){armed=false;paintSync('pending');}else if(folderState&&canonical(folderState)===canonical(state)){armed=true;paintSync('pending');scheduleSync();}else paintSync(folderState?'restore':'pending');
      }
    }catch(e){
      paintSync('error');console.warn('Не удалось восстановить выбранную папку',e);
    }
  })();
})();
