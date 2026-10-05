'use strict';

(() => {
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';
  const BROWSER_UPDATED_KEY='diagnostika-browser-updated-at';
  const DELETED_LEDGER_KEY='diagnostika-storage-deleted-client-ids-v1';

  const clone=v=>JSON.parse(JSON.stringify(v));

  function readDeletedLedger(){
    try{
      const raw=JSON.parse(localStorage.getItem(DELETED_LEDGER_KEY)||'[]');
      return new Set((Array.isArray(raw)?raw:[]).filter(Boolean).map(String));
    }catch(_){return new Set();}
  }

  function writeDeletedLedger(ids){
    try{localStorage.setItem(DELETED_LEDGER_KEY,JSON.stringify([...ids]));}catch(_){}
  }

  function seedDeletedLedger(data){
    const ids=readDeletedLedger();
    for(const item of data?.deletedClients||[]) if(item?.id) ids.add(String(item.id));
    for(const id of data?.deletedClientTombstones||[]) if(id) ids.add(String(id));
    writeDeletedLedger(ids);
    return ids;
  }

  function rememberDeletedClient(id){
    if(id===undefined||id===null||id==='')return;
    const ids=readDeletedLedger();
    ids.add(String(id));
    writeDeletedLedger(ids);
  }

  function forgetDeletedClient(id){
    if(id===undefined||id===null||id==='')return;
    const ids=readDeletedLedger();
    ids.delete(String(id));
    writeDeletedLedger(ids);
  }

  function markBrowserUpdated(){
    try{localStorage.setItem(BROWSER_UPDATED_KEY,new Date().toISOString());}catch(_){}
  }

  function filterDeletedFromClientSet(value,deletedIds){
    if(!value||!deletedIds?.size)return value;
    return {
      ...value,
      clients:(value.clients||[]).filter(c=>!c?.id||!deletedIds.has(String(c.id)))
    };
  }

  function latestDeletedAt(data){
    let latest=0;
    for(const item of data?.deletedClients||[]){
      const ts=Date.parse(item?.deletedAt||'')||0;
      if(ts>latest)latest=ts;
    }
    return latest;
  }

  function writeCanonicalDatabase(value,source){
    const db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
    if(!db?.writeState)throw new Error('Слой базы данных недоступен.');
    if(db.writeState(value,{source})!==true)throw new Error('Не удалось сохранить объединённую базу в браузере.');
    return true;
  }

  function isPlaceholderName(v){
    const s=String(v||'').trim().toLowerCase();
    return !s || ['новый клиент','new client','nouveau client','neuer kunde','nuovo cliente','клиент','client'].includes(s);
  }

  function isBlank(v,key=''){
    if(v===undefined || v===null || v==='') return true;
    if(key==='name' && isPlaceholderName(v)) return true;
    return false;
  }

  function mergeObjects(primary,secondary){
    if(Array.isArray(primary) || Array.isArray(secondary)) return mergeArrays(Array.isArray(primary)?primary:[],Array.isArray(secondary)?secondary:[]);
    if(primary && typeof primary==='object' && secondary && typeof secondary==='object'){
      const out={};
      const keys=new Set([...Object.keys(primary),...Object.keys(secondary)]);
      for(const k of keys){
        const a=primary[k], b=secondary[k];
        if(Array.isArray(a) || Array.isArray(b)) out[k]=mergeArrays(Array.isArray(a)?a:[],Array.isArray(b)?b:[]);
        else if(a && typeof a==='object' && b && typeof b==='object') out[k]=mergeObjects(a,b);
        else if(isBlank(a,k) && !isBlank(b,k)) out[k]=clone(b);
        else out[k]=clone(a);
      }
      return out;
    }
    if(isBlank(primary)) return clone(secondary);
    return clone(primary);
  }

  function mergeArrays(primary,secondary){
    const objects=[...primary,...secondary].filter(x=>x&&typeof x==='object');
    const allHaveIds=objects.length>0 && objects.every(x=>x.id);
    if(!allHaveIds){
      const seen=new Set(),out=[];
      for(const x of [...primary,...secondary]){
        const key=typeof x==='object'?JSON.stringify(x):String(x);
        if(!seen.has(key)){seen.add(key);out.push(clone(x));}
      }
      return out;
    }
    const map=new Map();
    for(const x of secondary) if(x?.id) map.set(x.id,clone(x));
    for(const x of primary){
      if(!x?.id) continue;
      map.set(x.id,map.has(x.id)?mergeObjects(x,map.get(x.id)):clone(x));
    }
    return [...map.values()];
  }

  function reconcileArchiveMembership(base,primary,secondary){
    const p=primary||{clients:[]};
    const s=secondary||{clients:[]};
    const pActive=new Map((p.clients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]));
    const pArchived=new Map((p.archivedClients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]));
    const sActive=new Map((s.clients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]));
    const sArchived=new Map((s.archivedClients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]));

    // The primary side is the fresher membership authority. Secondary may enrich
    // the record, but cannot move a client back out of the archive or into it.
    base.clients=[...(base.clients||[])].filter(c=>c?.id&&!pArchived.has(String(c.id)));
    base.archivedClients=[...(base.archivedClients||[])].filter(c=>c?.id&&!pActive.has(String(c.id)));

    const activeById=new Map((base.clients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]));
    for(const [id,item] of pActive){
      const other=sActive.get(id)||sArchived.get(id);
      activeById.set(id,other?mergeObjects(item,other):clone(item));
    }

    const archivedById=new Map((base.archivedClients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]));
    for(const [id,item] of pArchived){
      const other=sArchived.get(id)||sActive.get(id);
      archivedById.set(id,other?mergeObjects(item,other):clone(item));
    }

    for(const id of pActive.keys())archivedById.delete(id);
    for(const id of pArchived.keys())activeById.delete(id);
    base.clients=[...activeById.values()];
    base.archivedClients=[...archivedById.values()];
    return base;
  }

  function mergeStates(primary,secondary){
    const base=mergeObjects(primary||{clients:[]},secondary||{clients:[]});
    base.clients=mergeArrays(primary?.clients||[],secondary?.clients||[]);
    base.archivedClients=mergeArrays(primary?.archivedClients||[],secondary?.archivedClients||[]);
    return reconcileArchiveMembership(base,primary,secondary);
  }

  // Состав активных клиентов и архива берём ТОЛЬКО из primary.
  // secondary может дополнять данные существующих клиентов, но не менять
  // принадлежность клиента к основной базе или архиву.
  function mergeStatesKeepClientSet(primary,secondary){
    const p=primary||{clients:[]};
    const s=secondary||{clients:[]};
    const base=mergeObjects(p,s);
    const secondaryById=new Map([
      ...(s.clients||[]).filter(c=>c?.id).map(c=>[String(c.id),c]),
      ...(s.archivedClients||[]).filter(c=>c?.id).map(c=>[String(c.id),c])
    ]);
    base.clients=(p.clients||[]).map(c=>{
      const other=secondaryById.get(String(c?.id));
      return other?mergeObjects(c,other):clone(c);
    });
    base.archivedClients=(p.archivedClients||[]).map(c=>{
      const other=secondaryById.get(String(c?.id));
      return other?mergeObjects(c,other):clone(c);
    });
    return base;
  }

  function clientScore(c){
    if(!c||typeof c!=='object') return -1;
    let score=0;
    if(!isPlaceholderName(c.name)) score+=100;
    for(const [k,v] of Object.entries(c)){
      if(k==='name'||k==='id') continue;
      if(Array.isArray(v)) score+=Math.min(v.length,20)*3;
      else if(v&&typeof v==='object') score+=Object.keys(v).length;
      else if(v!==undefined&&v!==null&&String(v).trim()!=='') score+=2;
    }
    return score;
  }

  function folderNameCandidate(folderName){
    const base=String(folderName||'').replace(/_[a-zA-Z0-9_-]{1,40}$/,'').trim();
    return isPlaceholderName(base)?'':base;
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
    try{clientsDir=await app.getDirectoryHandle('clients',{create:false});}
    catch(e){if(e?.name==='NotFoundError')return{clients:[],folders:0,errors:0,duplicates:0,recoveredNames:0};throw e;}

    const byId=new Map();
    let folders=0,errors=0,duplicates=0,recoveredNames=0;
    for await (const [name,handle] of clientsDir.entries()){
      if(handle.kind!=='directory') continue;
      folders++;
      try{
        const client=await readJson(handle,'client.json');
        if(!client||typeof client!=='object') continue;
        if(!client.id){
          const suffix=String(name).split('_').pop();
          client.id=suffix||`folder-${folders}`;
        }
        const folderCandidate=folderNameCandidate(name);
        if(isPlaceholderName(client.name)&&folderCandidate){client.name=folderCandidate;recoveredNames++;}

        const old=byId.get(client.id);
        if(!old){byId.set(client.id,client);continue;}
        duplicates++;
        const better=clientScore(client)>clientScore(old)?client:old;
        const other=better===client?old:client;
        byId.set(client.id,mergeObjects(better,other));
      }catch(e){
        errors++;
        console.warn(`Не удалось прочитать клиента из папки ${name}`,e);
      }
    }
    return {clients:[...byId.values()],folders,errors,duplicates,recoveredNames};
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

  function permanentDeletedIds(data){
    return new Set((data?.deletedClientTombstones||[]).filter(Boolean).map(String));
  }

  async function removeClientFoldersByIds(app,ids){
    if(!app||!ids?.size)return 0;
    let clientsDir;
    try{clientsDir=await app.getDirectoryHandle('clients',{create:false});}
    catch(e){if(e?.name==='NotFoundError')return 0;throw e;}

    const removeNames=[];
    for await(const [name,handle] of clientsDir.entries()){
      if(handle?.kind!=='directory')continue;
      let match=false;
      try{
        const client=await readJson(handle,'client.json');
        if(client?.id&&ids.has(String(client.id)))match=true;
      }catch(_){}
      if(!match){
        for(const id of ids){
          if(name.endsWith('_'+shortId(id))){match=true;break;}
        }
      }
      if(match)removeNames.push(name);
    }

    let removed=0;
    for(const name of removeNames){
      try{
        await clientsDir.removeEntry(name,{recursive:true});
        removed++;
      }catch(e){
        if(e?.name!=='NotFoundError')throw e;
      }
    }
    return removed;
  }

  async function purgeClientFromConnectedStorage(id){
    if(id===undefined||id===null||id==='')return false;
    let root;
    try{root=await getSavedHandle();}catch(_){return false;}
    if(!root)return false;

    try{
      const access=await root.queryPermission({mode:'readwrite'});
      if(access!=='granted')return false;
    }catch(_){return false;}

    let app;
    try{app=await root.getDirectoryHandle(APP_DIR,{create:false});}
    catch(e){if(e?.name==='NotFoundError')return false;throw e;}

    const key=String(id);
    await removeClientFoldersByIds(app,new Set([key]));

    const database=await readJson(app,'database.json');
    if(database&&typeof database==='object'){
      database.clients=(database.clients||[]).filter(c=>!c?.id||String(c.id)!==key);
      database.deletedClients=(database.deletedClients||[]).filter(c=>!c?.id||String(c.id)!==key);
      if(!Array.isArray(database.deletedClientTombstones))database.deletedClientTombstones=[];
      if(!database.deletedClientTombstones.some(value=>String(value)===key))database.deletedClientTombstones.push(id);
      await writeJson(app,'database.json',database);

      const settings=await readJson(app,'settings.json')||{};
      await writeJson(app,'settings.json',{
        ...settings,
        updatedAt:new Date().toISOString(),
        clientCount:database.clients.length
      });
    }
    return true;
  }

  async function writeStateTree(app,data){
    await writeJson(app,'database.json',data);
    await writeJson(app,'settings.json',{
      format:'diagnostika-folder-v6',
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

  function browserLooksEmpty(data){
    const clients=data?.clients||[];
    if(!clients.length) return true;
    return clients.every(c=>isPlaceholderName(c.name)&&!(c.sessions||[]).length&&!(c.requests||[]).length);
  }

  async function synchronize(){
    if(!('showDirectoryPicker' in window)) throw new Error('Этот браузер не поддерживает синхронизацию с папкой. Используй Chrome или Edge.');
    const handle=await getWriteHandle();
    let app;
    try{app=await handle.getDirectoryHandle(APP_DIR,{create:false});}
    catch(e){if(e?.name==='NotFoundError')app=await handle.getDirectoryHandle(APP_DIR,{create:true});else throw e;}

    const deletedIds=seedDeletedLedger(state);
    const permanentIds=permanentDeletedIds(state);
    const removedPurgedFolders=await removeClientFoldersByIds(app,permanentIds);
    const databaseState=await readJson(app,'database.json');
    const scanned=await readClientsFromFolders(app);
    const suppressedDeleted=scanned.clients.filter(c=>c?.id&&deletedIds.has(String(c.id))).length;
    const folderOnlyState=filterDeletedFromClientSet({clients:scanned.clients},deletedIds);
    const safeDatabaseState=filterDeletedFromClientSet(databaseState,deletedIds);

    // database.json определяет состав папочной базы, но локальные удаления имеют
    // приоритет до явного восстановления клиента. Старые client.json больше не
    // могут воскресить удалённого клиента.
    const folderState=safeDatabaseState?mergeStatesKeepClientSet(safeDatabaseState,folderOnlyState):folderOnlyState;

    const folderSettings=await readJson(app,'settings.json');
    const browserUpdated=Math.max(
      Date.parse(localStorage.getItem(BROWSER_UPDATED_KEY)||'')||0,
      latestDeletedAt(state)
    );
    const folderUpdated=Date.parse(folderSettings?.updatedAt||'')||0;
    const emptyBrowser=browserLooksEmpty(state);

    let merged;
    if(!databaseState){
      // Папка ещё без общей базы. Если браузер рабочий — он формирует первый database.json.
      // Если браузер пустой — восстанавливаемся из найденных клиентских папок.
      merged=emptyBrowser && scanned.clients.length
        ? mergeStatesKeepClientSet(folderState,state)
        : mergeStates(state,folderState);
    }else if(emptyBrowser){
      // Новый/чистый браузер импортирует точный состав клиентов из database.json.
      merged=mergeStatesKeepClientSet(folderState,state);
    }else if(browserUpdated>folderUpdated){
      // Браузер новее: его состав клиентов главный. Это сохраняет удаления.
      merged=mergeStatesKeepClientSet(state,folderState);
    }else{
      // Папка новее: её состав клиентов главный. Удаления, сделанные в другом
      // браузере и уже синхронизированные в database.json, также сохраняются.
      merged=mergeStatesKeepClientSet(folderState,state);
    }

    merged=filterDeletedFromClientSet(merged,deletedIds);
    writeCanonicalDatabase(merged,'storage-simple-sync');
    await writeStateTree(app,merged);
    markBrowserUpdated();
    return {
      count:merged.clients?.length||0,
      folder:handle.name,
      scannedFolders:scanned.folders,
      scannedClients:scanned.clients.length,
      duplicates:scanned.duplicates,
      recoveredNames:scanned.recoveredNames,
      suppressedDeleted,
      removedPurgedFolders,
      errors:scanned.errors
    };
  }

  function simplifyDialog(){
    const dlg=document.querySelector('.storage-dialog');
    if(!dlg||dlg.dataset.simpleSync==='1')return;
    dlg.dataset.simpleSync='1';

    const info=dlg.querySelector('.storage-info');
    if(info)info.textContent='Изменения сохраняются в браузере автоматически. При синхронизации более свежая база определяет точный список клиентов; удалённые клиенты не восстанавливаются из старых папок.';

    const actions=dlg.querySelector('.storage-actions-main');
    if(!actions)return;
    actions.querySelector('#storageChoose')?.remove();
    actions.querySelector('#storageRestore')?.remove();
    actions.querySelector('#storageExport')?.remove();

    const sync=document.createElement('button');
    sync.id='storageSync';sync.type='button';sync.className='storage-primary';sync.textContent='Синхронизировать';actions.prepend(sync);

    const disconnect=actions.querySelector('#storageDisconnect');
    if(disconnect){disconnect.textContent='Отключить папку';disconnect.style.background='transparent';disconnect.style.boxShadow='none';disconnect.style.border='0';disconnect.style.textDecoration='underline';disconnect.style.opacity='.72';}

    sync.onclick=async()=>{
      try{
        sync.disabled=true;sync.textContent='Синхронизация…';
        const result=await synchronize();
        await AppDialog.alert(`Клиентов в базе: ${result.count}.`,'Синхронизация завершена');
        location.reload();
      }catch(e){
        if(e?.name!=='AbortError')await AppDialog.alert(e?.message||'Не удалось выполнить синхронизацию.','Ошибка');
      }finally{sync.disabled=false;sync.textContent='Синхронизировать';}
    };
  }

  if(typeof save==='function'){
    const prevSave=save;
    save=function(){markBrowserUpdated();return prevSave.apply(this,arguments);};
  }

  let lifecycleEventsBound=false;
  function bindClientLifecycleEvents(){
    if(lifecycleEventsBound)return true;
    const events=window.DiagnostikaPlatform?.events;
    if(!events?.on)return false;

    events.on('client:created',()=>markBrowserUpdated());
    events.on('client:updated',()=>markBrowserUpdated());
    events.on('client:deleted',detail=>{
      rememberDeletedClient(detail?.clientId);
      markBrowserUpdated();
    });
    events.on('client:restored',detail=>{
      forgetDeletedClient(detail?.clientId);
      markBrowserUpdated();
    });
    events.on('client:purged',detail=>{
      rememberDeletedClient(detail?.clientId);
      markBrowserUpdated();
      purgeClientFromConnectedStorage(detail?.clientId)
        .catch(error=>console.warn('Не удалось сразу удалить папку клиента из хранилища',error));
    });
    events.on('client:archived',()=>markBrowserUpdated());
    events.on('client:unarchived',()=>markBrowserUpdated());

    lifecycleEventsBound=true;
    return true;
  }

  seedDeletedLedger(typeof state!=='undefined'?state:null);
  bindClientLifecycleEvents();
  Promise.resolve(window.DiagnostikaPlatform?.ready).then(bindClientLifecycleEvents).catch(()=>{});

  simplifyDialog();
  const mo=new MutationObserver(()=>simplifyDialog());
  mo.observe(document.body,{childList:true,subtree:true});
})();
