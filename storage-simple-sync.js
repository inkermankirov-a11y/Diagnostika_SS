'use strict';

(() => {
  const HANDLE_DB='diagnostika-storage-handles-v1';
  const HANDLE_STORE='handles';
  const HANDLE_KEY='data-root';
  const APP_DIR='Diagnostika';
  const STATE_KEY='diagnostika-web-v1';
  const BROWSER_UPDATED_KEY='diagnostika-browser-updated-at';

  const clone=v=>JSON.parse(JSON.stringify(v));

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

  function mergeStates(primary,secondary){
    const base=mergeObjects(primary||{clients:[]},secondary||{clients:[]});
    base.clients=mergeArrays(primary?.clients||[],secondary?.clients||[]);
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

  async function writeStateTree(app,data){
    await writeJson(app,'database.json',data);
    await writeJson(app,'settings.json',{
      format:'diagnostika-folder-v5',
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

    const databaseState=await readJson(app,'database.json');
    const scanned=await readClientsFromFolders(app);
    const folderOnlyState={clients:scanned.clients};

    // database.json — основной источник для уже существующих клиентов.
    // client.json из отдельных папок используется только как резерв: добавляет
    // отсутствующих клиентов и заполняет реально пустые поля. Заглушка
    // «Новый клиент» никогда не должна затирать настоящее имя.
    const folderState=databaseState?mergeStates(databaseState,folderOnlyState):folderOnlyState;

    const folderSettings=await readJson(app,'settings.json');
    const browserUpdated=Date.parse(localStorage.getItem(BROWSER_UPDATED_KEY)||'')||0;
    const folderUpdated=Date.parse(folderSettings?.updatedAt||'')||0;
    const emptyBrowser=browserLooksEmpty(state);

    let merged;
    if(!databaseState){
      merged=mergeStates(state,folderState);
    }else if(emptyBrowser){
      // Новый/чистый браузер обязан сначала импортировать существующую базу,
      // а не записывать поверх неё стартового «Нового клиента».
      merged=mergeStates(folderState,state);
    }else if(browserUpdated>folderUpdated){
      // Обычный рабочий браузер с более свежими изменениями имеет приоритет,
      // но пустые поля дополняются из папки.
      merged=mergeStates(state,folderState);
    }else{
      merged=mergeStates(folderState,state);
    }

    localStorage.setItem(STATE_KEY,JSON.stringify(merged));
    await writeStateTree(app,merged);
    localStorage.setItem(BROWSER_UPDATED_KEY,new Date().toISOString());
    return {
      count:merged.clients?.length||0,
      folder:handle.name,
      scannedFolders:scanned.folders,
      scannedClients:scanned.clients.length,
      duplicates:scanned.duplicates,
      recoveredNames:scanned.recoveredNames,
      errors:scanned.errors
    };
  }

  function simplifyDialog(){
    const dlg=document.querySelector('.storage-dialog');
    if(!dlg||dlg.dataset.simpleSync==='1')return;
    dlg.dataset.simpleSync='1';

    const info=dlg.querySelector('.storage-info');
    if(info)info.textContent='Изменения сохраняются в браузере автоматически. «Синхронизировать» безопасно объединяет браузер с выбранной папкой. database.json имеет приоритет перед старыми копиями client.json.';

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
        const details=[];
        if(result.duplicates)details.push(`Объединено дубликатов папок: ${result.duplicates}.`);
        if(result.recoveredNames)details.push(`Восстановлено имён из названий папок: ${result.recoveredNames}.`);
        if(result.errors)details.push(`Не удалось прочитать папок: ${result.errors}.`);
        await AppDialog.alert(`Проверено папок клиентов: ${result.scannedFolders}.\nУникальных client.json: ${result.scannedClients}.\nВ базе после синхронизации: ${result.count} клиент(ов).${details.length?'\n'+details.join('\n'):''}`,'Синхронизация завершена');
        location.reload();
      }catch(e){
        if(e?.name!=='AbortError')await AppDialog.alert(e?.message||'Не удалось выполнить синхронизацию.','Ошибка');
      }finally{sync.disabled=false;sync.textContent='Синхронизировать';}
    };
  }

  if(typeof save==='function'){
    const prevSave=save;
    save=function(){localStorage.setItem(BROWSER_UPDATED_KEY,new Date().toISOString());return prevSave.apply(this,arguments);};
  }

  simplifyDialog();
  const mo=new MutationObserver(()=>simplifyDialog());
  mo.observe(document.body,{childList:true,subtree:true});
})();
