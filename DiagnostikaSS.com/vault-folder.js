'use strict';
(()=>{
 if(location.hostname!=='zabvenye.com')return;
 const NAME='database.zbv', DIR='Diagnostika', MODE='zabvenye-folder-encrypted-v1', BASE='zabvenye-folder-baseline-v1';
 const cryptoApi=()=>window.DiagnostikaVaultCrypto, db=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db, files=()=>window.DiagnostikaPlatform?.services?.files;
 let key=null,busy=false;
 const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const digest=async raw=>cryptoApi().b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))));
 const get=(k)=>localStorage.getItem(k);
 const set=(k,v)=>localStorage.setItem(k,v);
 function savedHandle(){return new Promise((resolve,reject)=>{const req=indexedDB.open('diagnostika-storage-handles-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('handles'))req.result.createObjectStore('handles')};req.onerror=()=>reject(req.error);req.onsuccess=()=>{const d=req.result,tx=d.transaction('handles','readonly'),r=tx.objectStore('handles').get('data-root');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>d.close();tx.onabort=()=>d.close()}})}
 async function saveRoot(handle){return new Promise((resolve,reject)=>{const req=indexedDB.open('diagnostika-storage-handles-v1',1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('handles'))req.result.createObjectStore('handles')};req.onerror=()=>reject(req.error);req.onsuccess=()=>{const d=req.result,tx=d.transaction('handles','readwrite');tx.objectStore('handles').put(handle,'data-root');tx.oncomplete=()=>{d.close();resolve(handle)};tx.onabort=tx.onerror=()=>{d.close();reject(tx.error||Error('Не удалось сохранить папку'))}}})}
 async function ensureRoot(){let root=await savedHandle();if(root){try{if(await root.queryPermission({mode:'readwrite'})==='granted'||await root.requestPermission({mode:'readwrite'})==='granted')return root}catch{}}if(!window.showDirectoryPicker)throw Error('Для подключения папки используйте Chrome или Edge.');root=await window.showDirectoryPicker({mode:'readwrite'});if(await root.queryPermission({mode:'readwrite'})!=='granted'&&await root.requestPermission({mode:'readwrite'})!=='granted')throw Error('Доступ к папке не разрешён.');await saveRoot(root);return root}
 async function app(root,create=false){try{return await root.getDirectoryHandle(DIR,{create})}catch(e){if(!create&&e.name==='NotFoundError')return null;throw e}}
 async function file(dir,name){if(!dir)return null;try{return await dir.getFileHandle(name)}catch(e){if(e.name==='NotFoundError')return null;throw e}}
 async function hasEncrypted(root){return Boolean(root&&await file(await app(root),NAME))}
 const mode=()=>get(MODE)==='1';
 async function mustEncrypt(root){return mode()||await hasEncrypted(root)}
 function managedDirectory(path){return /^clients(?:\/[^/]+(?:\/(?:receipts|sessions(?:\/[^/]+(?:\/(?:files|receipts))?)?))?)?$/.test(path)}
 function managed(path){return /^(database|settings)\.json$/.test(path)||/^clients\/[^/]+\/(client\.json|receipts\/[^/]+|sessions\/[^/]+\/(session\.json|files\/[^/]+|receipts\/[^/]+))$/.test(path)}
 async function scan(dir,prefix='',rows=[],dirs=[]){
  if(!dir)return {rows,dirs};
  for await(const [name,h] of dir.entries()){
   const path=prefix+name;
   if(h.kind==='directory'&&managedDirectory(path)){dirs.push({parent:dir,name,path});await scan(h,path+'/',rows,dirs)}
   else if(h.kind==='file'&&managed(path)){
    const f=await h.getFile();rows.push({parent:dir,name,path,bytes:cryptoApi().b64(new Uint8Array(await f.arrayBuffer()))});
   }
  }
  return {rows,dirs};
 }
 function tree(rows){return rows.map(({path,bytes})=>({path,bytes})).sort((a,b)=>a.path.localeCompare(b.path))}
 async function snapshot(){
  const data=db()?.readState();if(!Array.isArray(data?.clients)||!files()?.list)throw Error('База или вложения недоступны.');
  const records=[];for(const rec of await files().list({})){const {blob,...meta}=rec;if(!(blob instanceof Blob))throw Error('Вложение недоступно.');records.push({meta,bytes:cryptoApi().b64(new Uint8Array(await blob.arrayBuffer()))})}
  records.sort((a,b)=>String(a.meta.id).localeCompare(String(b.meta.id)));
  return {format:'zbv-backup-v1',state:data,files:records};
 }
 function same(a,b){return canonical(a.state)===canonical(b.state)&&canonical(a.files)===canonical(b.files)}
 function empty(pkg){if(pkg.files.length||pkg.state.archivedClients?.length||pkg.state.deletedClients?.length)return false;if(Object.entries(pkg.state).some(([k,v])=>!['version','clients','archivedClients','deletedClients','deletedClientTombstones'].includes(k)&&v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length)&&!(typeof v==='object'&&!Object.keys(v).length)))return false;return pkg.state.clients.every(c=>['','Новый клиент'].includes(c.name||'')&&!(c.sessions||[]).length&&!(c.requests||[]).length&&Object.keys(c).every(k=>['id','name','sessions','requests','photoCrop','ageAuto'].includes(k)||c[k]===''||c[k]==null));}
 async function write(dir,pkg,secret,expected=null,recovery=undefined){
  const before=await file(dir,NAME);if(before&&expected===null)throw Error('Зашифрованная база уже существует.');if(expected!==null&&(!before||await (await before.getFile()).text()!==expected))throw Error('Файл базы изменился. Синхронизация остановлена.');
  let raw=await cryptoApi().seal(pkg,secret,'backup');
  const envelope=recovery===undefined&&expected!==null?JSON.parse(expected).recovery:recovery;
  if(envelope)raw=JSON.stringify({...JSON.parse(raw),recovery:envelope});
  if(canonical(await cryptoApi().openDatabase(raw,secret))!==canonical(pkg))throw Error('Проверка ZBV не пройдена.');
  const check=await file(dir,NAME);if(expected===null&&check||expected!==null&&(!check||await (await check.getFile()).text()!==expected))throw Error('Файл изменился во время шифрования.');
  const handle=check||await dir.getFileHandle(NAME,{create:true});
  await cryptoApi().writeDatabase(handle,raw,secret);return raw;
 }
 // Trusted-device key storage. The non-extractable wrapping key is kept in
 // this browser's IndexedDB, never in the portable file or localStorage.
 const DEVICE_DB='zabvenye-trusted-device-v1',DEVICE_STORE='keys';
 async function account(){
  const r=await fetch('/account/api/me',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('Войдите в свою учётную запись для синхронизации.');
  const p=await r.json();if(!p.id||p.enabled===false||p.onboarding_required)throw Error('Учётная запись недоступна.');
  if(p.limits?.sync===false&&p.role!=='admin')throw Error('Синхронизация отключена для аккаунта.');
  return String(p.id);
 }
 function deviceStore(owner,entry){
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open(DEVICE_DB,1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DEVICE_STORE))req.result.createObjectStore(DEVICE_STORE)};
   req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Хранилище ключа недоступно'));
   req.onsuccess=()=>{const d=req.result;let tx,result;
    try{tx=d.transaction(DEVICE_STORE,entry===undefined?'readonly':'readwrite');const st=tx.objectStore(DEVICE_STORE);
     const q=entry===undefined?st.get(owner):st.put(entry,owner);q.onsuccess=()=>{result=q.result};}
    catch(e){d.close();reject(e);return}
    tx.oncomplete=()=>{d.close();resolve(result)};tx.onabort=tx.onerror=()=>{d.close();reject(tx.error||Error('Не удалось сохранить ключ устройства'))};
   };
  });
 }
 async function sameRoot(a,b){try{return !!(a&&b&&await a.isSameEntry(b))}catch{return false}}
 async function remember(root,secret,baseline,owner){
  const previous=await deviceStore(owner);
  const wrap=previous?.wrap||await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('zabvenye-device-v1:'+owner)},wrap,new TextEncoder().encode(secret));
  await deviceStore(owner,{root,wrap,iv,cipher,baseline});
 }
 async function remembered(root,owner){
  const saved=await deviceStore(owner);
  if(!saved||!await sameRoot(saved.root,root))return null;
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv,additionalData:new TextEncoder().encode('zabvenye-device-v1:'+owner)},saved.wrap,saved.cipher);
  return {secret:new TextDecoder().decode(bytes),baseline:saved.baseline};
 }
 function needsKey(){const e=Error('Один раз введите действующий ключ: этот компьютер ещё не настроен.');e.code='ZBV_KEY_REQUIRED';return e}
 async function mark(raw,secret,root,owner,trust=true){
  const baseline=trust?await digest(raw):null;
  await remember(root,secret,baseline,owner||await account());
  set(MODE,'1');if(trust)set(BASE,baseline);key=secret;
 }
 async function clean(dir,legacy){
  const scanned=await scan(dir),saved=new Map((legacy||[]).map(x=>[x.path,x.bytes]));
  for(const row of scanned.rows)if(saved.get(row.path)!==row.bytes)throw Error('Старая база изменена. Удаление отменено.');
  for(const row of scanned.rows){const live=await file(row.parent,row.name);if(!live||cryptoApi().b64(new Uint8Array(await (await live.getFile()).arrayBuffer()))!==row.bytes)throw Error('Старый файл изменён. Оставшиеся файлы сохранены.');await row.parent.removeEntry(row.name)}
  for(const d of scanned.dirs.reverse())try{await d.parent.removeEntry(d.name,{recursive:false})}catch(e){if(e.name!=='InvalidModificationError'&&e.name!=='NotFoundError')throw e}
 }
 async function run(fn){if(busy)throw Error('Операция с базой уже выполняется.');busy=true;try{return navigator.locks?await navigator.locks.request('zabvenye-folder-vault',fn):await fn()}finally{busy=false}}
 async function activate(secret,root=null){return run(async()=>{
  const owner=await account();
  root=root||await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку в хранилище.');
  const dir=await app(root,true),existing=await file(dir,NAME),current=await snapshot();
  if(existing){const raw=await (await existing.getFile()).text(),pkg=await cryptoApi().openDatabase(raw,secret);if(!same(pkg,current))throw Error('В папке уже есть другая зашифрованная база. Восстановите её отдельно.');await clean(dir,pkg.legacyDisk);await mark(raw,secret,root,owner);return {count:pkg.state.clients.length}}
  const scanned=await scan(dir),legacy=tree(scanned.rows),old=legacy.find(x=>x.path==='database.json');
  if(legacy.length&&!old)throw Error('Сначала синхронизируйте старую папку. Старые файлы не изменены.');
  if(old){const previous=JSON.parse(new TextDecoder().decode(cryptoApi().unb64(old.bytes)));if(canonical(previous)!==canonical(current.state))throw Error('Сначала синхронизируйте текущую и старую базы. Старые файлы не изменены.')}
  const pkg={...current,legacyDisk:legacy};
  const raw=await write(dir,pkg,secret);
  // The authenticated archive contains every managed legacy file byte-for-byte.
  if(canonical(tree((await scan(dir)).rows))!==canonical(legacy))throw Error('Старая папка изменилась. Удаление отменено.');
  await mark(raw,secret,root,owner);await clean(dir,legacy);
  return {count:pkg.state.clients.length};
 })}
 async function restore(pkg){
  const curr=await snapshot();if(!empty(curr))throw Error('В браузере уже есть другая база. Защитите её перед восстановлением.');
  const api=files(),added=[];try{for(const f of pkg.files){const m=f.meta;if(!m?.id||!m.clientId||!m.sessionId)throw Error('Некорректное вложение ZBV.');const blob=new Blob([cryptoApi().unb64(f.bytes)],{type:m.type||'application/octet-stream'});if(!await api.put({...m,blob},{source:'vault-restore'}))throw Error('Не удалось восстановить вложение.');added.push(m.id)}
  if(db().writeState(pkg.state,{source:'vault-restore'})!==true)throw Error('Не удалось восстановить базу.');}catch(e){for(const id of added)try{await api.remove(id,{source:'vault-restore-rollback'})}catch{}throw e}
  window.DiagnostikaStorageRefresh.apply();
 }
 async function sync(root,{ask=true,secret:provided=null}={}){
  const owner=await account();
  const dir=await app(root),handle=await file(dir,NAME);
  if(!handle){
   key=null;
   if(!mode()&&dir&&(await scan(dir)).rows.length)return null;
   if(!ask)throw Error('Файл database.zbv не найден. Проверьте подключённую папку.');
   const secret=provided||await cryptoApi().requestSecret({generate:true,title:'Ключ шифрования базы'});
   if(!secret)throw Error('Шифрование не выполнено: ключ не введён.');
   return activate(secret,root);
  }
  return run(async()=>{
   const raw=await (await handle.getFile()).text();
   let saved=null;try{saved=await remembered(root,owner)}catch(e){if(!ask&&!provided)throw needsKey()}
   let secret=provided||saved?.secret,pkg,manual=Boolean(provided);
   key=null;
   if(secret)try{pkg=await cryptoApi().openDatabase(raw,secret)}catch(e){if(provided)throw e;secret=null;if(!ask)throw needsKey()}
   if(!pkg){
    if(!ask)throw needsKey();
    secret=await cryptoApi().requestSecret({title:'Открыть зашифрованную базу'});
    if(!secret)throw Error('Ввод ключа отменён.');
    pkg=await cryptoApi().openDatabase(raw,secret);manual=true;
   }
   const current=await snapshot();pkg.files.sort((a,b)=>String(a.meta.id).localeCompare(String(b.meta.id)));
   if(same(pkg,current)){await clean(dir,pkg.legacyDisk);await mark(raw,secret,root,owner);return {count:pkg.state.clients.length}}
   const hash=await digest(raw);
   // Existing legacy browser gets one migration only after explicit key entry.
   const baseline=saved?saved.baseline:manual?get(BASE):null;
   if(baseline!==hash){
    if(ask&&empty(current)){await restore(pkg);await mark(raw,secret,root,owner);return {count:pkg.state.clients.length,restored:true}}
    throw Error('База в папке и браузере различается. Автоматическая перезапись запрещена.');
   }
   const next={...current,legacyDisk:pkg.legacyDisk||[]},out=await write(dir,next,secret,raw);
   await mark(out,secret,root,owner);await clean(dir,next.legacyDisk);return {count:current.state.clients.length}
  })
 }
 async function download(secret){const root=await savedHandle(),dir=root&&await app(root),h=await file(dir,NAME);if(!h)throw Error('Сначала зашифруйте базу.');await sync(root,{secret});const raw=await (await h.getFile()).text();await cryptoApi().openDatabase(raw,secret);return raw;}
 async function restoreFile(raw,secret,root=null){return run(async()=>{const owner=await account();const pkg=await cryptoApi().openDatabase(raw,secret);const current=await snapshot();if(!empty(current))throw Error('Восстановление возможно только в пустое рабочее пространство.');root=root||await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку.');const dir=await app(root,true);if((await scan(dir)).rows.length)throw Error('В папке найдена старая база. Выберите пустую папку.');const existing=await file(dir,NAME);if(existing&&await (await existing.getFile()).text()!==raw)throw Error('В папке уже есть другая база.');if(!existing)await cryptoApi().writeDatabase(await dir.getFileHandle(NAME,{create:true}),raw,secret);await restore(pkg);await mark(raw,secret,root,owner);return {count:pkg.state.clients.length};})}
 async function connected(){
  const root=await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку.');
  const dir=await app(root),h=await file(dir,NAME);if(!h)throw Error('Зашифрованная база не найдена.');return {root,dir,h,raw:await (await h.getFile()).text()};
 }
 async function verifyKey(secret){
  const root=await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')return {state:'unavailable'};
  const h=await file(await app(root),NAME);if(!h)return {state:'new'};
  const raw=await (await h.getFile()).text();await cryptoApi().openDatabase(raw,secret);
  return {state:'valid',enrolled:typeof JSON.parse(raw).recovery==='string'};
 }
 async function recoveryInfo(){
  try{const {raw}=await connected();return {available:true,enrolled:typeof JSON.parse(raw).recovery==='string'}}catch{return {available:false,enrolled:false}}
 }
 async function recoveryRequest(license,password,mode){
  const response=await fetch('/account/api/vault-recovery',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({license,password,mode})});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Не удалось подтвердить лицензию.');
  if(!/^ZBV1-[A-Za-z0-9_-]{43}$/.test(value.recovery_secret||''))throw Error('Некорректный ответ сервера восстановления.');
  return value.recovery_secret;
 }
 async function enrollRecovery(secret,license,password){return run(async()=>{
  const owner=await account(),{root,dir,raw}=await connected(),pkg=await cryptoApi().openDatabase(raw,secret);
  const recovery=await recoveryRequest(license,password,'enroll');
  const envelope=await cryptoApi().seal({secret},recovery,'backup');
  const checked=await cryptoApi().open(envelope,recovery,'backup');if(checked.secret!==secret)throw Error('Проверка ключа восстановления не пройдена.');
  const trusted=get(BASE)===await digest(raw);
  const out=await write(dir,pkg,secret,raw,envelope);
  await mark(out,secret,root,owner,trusted);
  return true;
 })}
 async function recoverKey(license,password){return run(async()=>{
  const owner=await account(),{root,dir,raw}=await connected(),envelope=JSON.parse(raw).recovery;
  if(typeof envelope!=='string')throw Error('Для этой базы восстановление заранее не подключено. Нужен исходный ключ.');
  const recovery=await recoveryRequest(license,password,'recover');
  const old=await cryptoApi().open(envelope,recovery,'backup');
  const pkg=await cryptoApi().openDatabase(raw,old.secret);
  const next=cryptoApi().recoveryKey(),wrapped=await cryptoApi().seal({secret:next},recovery,'backup');
  if((await cryptoApi().open(wrapped,recovery,'backup')).secret!==next)throw Error('Проверка нового ключа не пройдена.');
  const trusted=get(BASE)===await digest(raw);
  const out=await write(dir,pkg,next,raw,wrapped);
  await mark(out,next,root,owner,trusted);
  return next;
 })}
 window.DiagnostikaFolderVault=Object.freeze({activate,sync,hasEncrypted,mustEncrypt,mode,download,restoreFile,savedHandle,ensureRoot,verifyKey,recoveryInfo,enrollRecovery,recoverKey,keyUnlocked:()=>Boolean(key),lock:()=>{key=null}});
})();
