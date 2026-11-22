'use strict';
(()=>{
 if(location.hostname!=='zabvenye.com')return;
 const NAME='database.zbv', DIR='Diagnostika', MODE='zabvenye-folder-encrypted-v1', BASE='zabvenye-folder-baseline-v1';
 const cryptoApi=()=>window.DiagnostikaVaultCrypto, db=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db, files=()=>window.DiagnostikaPlatform?.services?.files;
 const media=()=>window.DiagnostikaVaultMedia;
 let key=null,busy=false,rememberedOwner=null;
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
 async function snapshot(){
  const data=db()?.readState();if(!Array.isArray(data?.clients)||!files()?.list)throw Error('База или вложения недоступны.');
  const records=[];for(const rec of await files().list({})){const {blob,...meta}=rec;if(!(blob instanceof Blob))throw Error('Вложение недоступно.');records.push({meta,bytes:cryptoApi().b64(new Uint8Array(await blob.arrayBuffer()))})}
  records.sort((a,b)=>String(a.meta.id).localeCompare(String(b.meta.id)));
  return {format:'zbv-backup-v1',state:data,files:records};
 }
 function same(a,b){return canonical(a.state)===canonical(b.state)&&canonical(a.files)===canonical(b.files)}
 function empty(pkg){if(pkg.files.length||pkg.photos?.length||pkg.state.archivedClients?.length||pkg.state.deletedClients?.length)return false;if(Object.entries(pkg.state).some(([k,v])=>!['version','clients','archivedClients','deletedClients','deletedClientTombstones'].includes(k)&&v!==null&&v!==undefined&&v!==''&&!(Array.isArray(v)&&!v.length)&&!(typeof v==='object'&&!Object.keys(v).length)))return false;return pkg.state.clients.every(c=>['','Новый клиент'].includes(c.name||'')&&!(c.sessions||[]).length&&!(c.requests||[]).length&&Object.keys(c).every(k=>['id','name','sessions','requests','photoCrop','ageAuto'].includes(k)||c[k]===''||c[k]==null));}
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
  if(!saved)return null;
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.iv,additionalData:new TextEncoder().encode('zabvenye-device-v1:'+owner)},saved.wrap,saved.cipher);
  // Always authenticate the actual ZBV bytes; folder handles may be reissued by the browser.
  // A baseline is the hash of the exact previously authenticated file, never a directory name.
  return {secret:new TextDecoder().decode(bytes),baseline:saved.baseline};
 }
 function needsKey(){const e=Error('Один раз введите действующий ключ: этот компьютер ещё не настроен.');e.code='ZBV_KEY_REQUIRED';return e}
 async function mark(raw,secret,root,owner,trust=true){
  const baseline=trust?await digest(raw):null;
  owner=owner||await account();await remember(root,secret,baseline,owner);
  set(MODE,'1');if(trust)set(BASE,baseline);key=secret;rememberedOwner=owner||await account();
 }
 async function run(fn){if(busy)throw Error('Операция с базой уже выполняется.');busy=true;try{return navigator.locks?await navigator.locks.request('zabvenye-folder-vault',fn):await fn()}finally{busy=false}}
 async function currentData(){
  const state=db()?.readState();if(!Array.isArray(state?.clients)||!files()?.list)throw Error('База или вложения недоступны.');
  return {state,records:await files().list({})};
 }
 const isEmpty=d=>empty({state:d.state,files:d.records});
 async function matches(pkg,d){
  if(pkg.format===media().FORMAT)return media().matches(pkg,d.state,d.records);
  const current=await snapshot();pkg.files.sort((a,b)=>String(a.meta.id).localeCompare(String(b.meta.id)));return same(pkg,current);
 }
 function consent(){
  const message='Новый формат ZABVENYE: записи базы останутся зашифрованными. Все прикреплённые файлы, включая фото, записи консультаций и чеки, будут доступны в обычных папках без ключа. За их конфиденциальность отвечает владелец папки. Продолжить?';
  if(!window.confirm(window.DiagnostikaI18n?.translate(message)||message)){const e=Error('Переход отменён. Старая зашифрованная база сохранена. Для перехода нажмите «Синхронизировать».');e.code='ZBV_MIGRATION_CONSENT';throw e;}
 }
 async function preserveV1(dir,raw){
  const hash=(await digest(raw)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const backups=await dir.getDirectoryHandle('backups',{create:true}),name='database-v1-'+hash+'.zbv';
  let h=await file(backups,name);
  if(h){if(await (await h.getFile()).text()!==raw)throw Error('Существующая резервная копия отличается. Исходная база не изменена.');return;}
  h=await backups.getFileHandle(name,{create:true});const w=await h.createWritable({keepExistingData:false});
  try{await w.write(new Blob([raw]));await w.close()}catch(e){try{await w.abort()}catch{}throw e}
  if(await (await h.getFile()).text()!==raw)throw Error('Резервная копия не прошла проверку. Исходная база не изменена.');
 }
 async function checkLegacyMetadata(dir){
  if(await file(dir,'database.json')||await file(dir,'settings.json'))throw Error('В папке осталась старая открытая база. Сохраните её отдельно и выберите чистую папку; данные не изменены.');
  let clients;try{clients=await dir.getDirectoryHandle('clients')}catch(e){if(e.name!=='NotFoundError')throw e}
  if(clients)throw Error('В папке остались старые папки клиентов. Сохраните их отдельно и выберите чистую папку; данные не изменены.');
 }
 function checkReceipts(d){
  const expected=window.DiagnostikaPaymentReceipts?.receiptEntries?.(d.state)||[],ids=new Set(d.records.map(x=>String(x.id)));
  const missing=expected.filter(x=>!ids.has(String(x.id)));
  if(missing.length)throw Error('Не найдены прикреплённые чеки ('+missing.length+'). Восстановите файлы или удалите потерянные привязки. Исходная база не изменена.');
 }
 async function activate(secret,root=null){
  root=root||await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку в хранилище.');
  if(await hasEncrypted(root))return sync(root,{secret,ask:true});
  return run(async()=>{
   const owner=await account(),dir=await app(root,true);
   if(await file(dir,NAME))throw Error('База появилась в другой вкладке. Повторите синхронизацию.');
   await checkLegacyMetadata(dir);consent();
   const current=await currentData();checkReceipts(current);
   const pkg=await media().build(dir,current.state,current.records);
   const checked=await media().hydrate(dir,pkg,{verifyFiles:false});
   if(canonical(checked.state)!==canonical(current.state))throw Error('Проверка фотографий не пройдена');
   const raw=await write(dir,pkg,secret);await mark(raw,secret,root,owner);
   return {count:pkg.state.clients.length};
  });
 }
 async function restore(pkg,dir,prepared=null){
  const curr=await currentData();if(!isEmpty(curr))throw Error('В браузере уже есть другая база. Защитите её перед восстановлением.');
  const hydrated=prepared||(pkg.format===media().FORMAT?await media().hydrate(dir,pkg):{state:pkg.state,records:pkg.files.map(f=>({...f.meta,blob:new Blob([cryptoApi().unb64(f.bytes)],{type:f.meta.type||'application/octet-stream'})}))});
  const api=files(),added=[];
  try{
   for(const rec of hydrated.records){if(!rec.id||!rec.clientId||!rec.sessionId)throw Error('Некорректное вложение ZBV.');if(!await api.put(rec,{source:'vault-restore'}))throw Error('Не удалось восстановить вложение.');added.push(rec.id);}
   if(db().writeState(hydrated.state,{source:'vault-restore'})!==true)throw Error('Не удалось восстановить базу.');
  }catch(e){for(const id of added)try{await api.remove(id,{source:'vault-restore-rollback'})}catch{}throw e}
  window.DiagnostikaStorageRefresh.apply();
 }
 async function sync(root,{ask=true,secret:provided=null}={}){
  const owner=await account(),dir=await app(root),handle=await file(dir,NAME);
  if(!handle){
   key=null;if(!ask)throw Error('Файл database.zbv не найден. Проверьте подключённую папку.');
   const secret=provided||await cryptoApi().requestSecret({generate:true,title:'Ключ шифрования базы'});
   if(!secret)throw Error('Шифрование не выполнено: ключ не введён.');
   return activate(secret,root);
  }
  return run(async()=>{
   const raw=await (await handle.getFile()).text();let saved=null;
   try{saved=await remembered(root,owner)}catch(e){if(!provided)throw Error('Не удалось прочитать сохранённый ключ устройства. Данные не изменены.');}
   let secret=provided||saved?.secret||(rememberedOwner===owner?key:null);
   if(!secret){if(!ask)throw needsKey();secret=await cryptoApi().requestSecret({title:'Однократная настройка ключа на этом компьютере'});if(!secret)throw Error('Ввод ключа отменён.');}
   const pkg=await cryptoApi().openDatabase(raw,secret),hash=await digest(raw);
   const current=await currentData(),baseline=saved?saved.baseline:(provided?get(BASE):null);
   if(isEmpty(current)&&!empty(pkg)){
    if(!ask)throw Error('В браузере нет базы. Нажмите «Шифрование» → «Открыть / синхронизировать базу».');
    if(!window.confirm('Восстановить базу из подключённой папки в пустой браузер?'))throw Error('Восстановление отменено.');
    await restore(pkg,dir);await mark(raw,secret,root,owner);
    return {count:pkg.state.clients.length,restored:true};
   }
   if(baseline!==hash&&!await matches(pkg,current))throw Error('База в папке и браузере различается. Автоматическая перезапись запрещена.');
   const migrating=pkg.format!==media().FORMAT;
   if(migrating){consent();await preserveV1(dir,raw);await checkLegacyMetadata(dir);}
   checkReceipts(current);
   const localIds=new Set(current.records.map(x=>String(x.id)));
   const deleted=new Set((await files().deletedIds()).map(String));
   const missing=pkg.files.filter(x=>!localIds.has(String(x.meta.id))&&!deleted.has(String(x.meta.id)));
   if(missing.length)throw Error('В браузере отсутствуют вложения из сохранённой базы ('+missing.length+'). Автоматическое удаление запрещено. Восстановите базу в отдельном чистом профиле браузера.');
   const next=await media().build(dir,current.state,current.records,migrating?null:pkg);
   if(migrating){
    const checked=await media().hydrate(dir,next,{verifyFiles:true});
    if(canonical(checked.state)!==canonical(current.state)||checked.records.length!==current.records.length)throw Error('Проверка миграции не пройдена. Исходная база сохранена.');
   }
   if(!migrating&&canonical(pkg)===canonical(next)){await mark(raw,secret,root,owner);return {count:pkg.state.clients.length};}
   const out=await write(dir,next,secret,raw);await mark(out,secret,root,owner);
   return {count:current.state.clients.length,migrated:migrating};
  });
 }
 async function download(secret){
  const root=await savedHandle(),dir=root&&await app(root),h=await file(dir,NAME);if(!h)throw Error('Сначала зашифруйте базу.');
  await sync(root,{secret,ask:true});const raw=await (await h.getFile()).text();await cryptoApi().openDatabase(raw,secret);return raw;
 }
 async function restoreFile(raw,secret,root=null){return run(async()=>{
  const owner=await account(),pkg=await cryptoApi().openDatabase(raw,secret),current=await currentData();
  if(!isEmpty(current))throw Error('Восстановление возможно только в пустое рабочее пространство.');
  root=root||await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку.');
  const dir=await app(root,true);await checkLegacyMetadata(dir);
  const existing=await file(dir,NAME);if(existing&&await (await existing.getFile()).text()!==raw)throw Error('В папке уже есть другая база.');
  const prepared=pkg.format===media().FORMAT?await media().hydrate(dir,pkg):null;
  if(!existing)await cryptoApi().writeDatabase(await dir.getFileHandle(NAME,{create:true}),raw,secret);
  await restore(pkg,dir,prepared);await mark(raw,secret,root,owner);return {count:pkg.state.clients.length};
 })}
 async function connected(){
  const root=await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку.');
  const dir=await app(root),h=await file(dir,NAME);if(!h)throw Error('Зашифрованная база не найдена.');return {root,dir,h,raw:await (await h.getFile()).text()};
 }
 async function verifyKey(secret,{rememberDevice=false}={}){
  const root=await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')return {state:'unavailable'};
  const h=await file(await app(root),NAME);if(!h)return {state:'new'};
  if(!rememberDevice){const raw=await (await h.getFile()).text();await cryptoApi().openDatabase(raw,secret);return {state:'valid',enrolled:typeof JSON.parse(raw).recovery==='string'};}
  return run(async()=>{
   const owner=await account(),raw=await (await h.getFile()).text(),pkg=await cryptoApi().openDatabase(raw,secret);
   const hash=await digest(raw),saved=await remembered(root,owner).catch(()=>null);
   const trusted=saved?.baseline===hash||(!saved&&get(BASE)===hash)||await matches(pkg,await currentData());
   if(await (await h.getFile()).text()!==raw)throw Error('Файл изменился во время проверки. Повторите проверку.');
   // Do not turn an unrelated or newer file into an authorized overwrite.
   if(!saved||saved.secret!==secret||saved.baseline!==(trusted?hash:null))await mark(raw,secret,root,owner,trusted);
   else{key=secret;rememberedOwner=owner;set(MODE,'1');if(trusted)set(BASE,hash);}
   if(navigator.storage?.persist)void navigator.storage.persist().catch(()=>{});
   return {state:'valid',remembered:true,enrolled:typeof JSON.parse(raw).recovery==='string'};
  });
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
 window.DiagnostikaFolderVault=Object.freeze({activate,sync,hasEncrypted,mustEncrypt,mode,download,restoreFile,savedHandle,ensureRoot,verifyKey,recoveryInfo,enrollRecovery,recoverKey,keyUnlocked:()=>Boolean(key),lock:()=>{key=null;rememberedOwner=null}});
})();
