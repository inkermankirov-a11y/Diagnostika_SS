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
 async function write(dir,pkg,secret,expected=null){
  const before=await file(dir,NAME);if(before&&expected===null)throw Error('Зашифрованная база уже существует.');if(expected!==null&&(!before||await (await before.getFile()).text()!==expected))throw Error('Файл базы изменился. Синхронизация остановлена.');
  const raw=await cryptoApi().seal(pkg,secret,'backup');
  if(canonical(await cryptoApi().openDatabase(raw,secret))!==canonical(pkg))throw Error('Проверка ZBV не пройдена.');
  const check=await file(dir,NAME);if(expected===null&&check||expected!==null&&(!check||await (await check.getFile()).text()!==expected))throw Error('Файл изменился во время шифрования.');
  const handle=check||await dir.getFileHandle(NAME,{create:true});
  await cryptoApi().writeDatabase(handle,raw,secret);return raw;
 }
 async function mark(raw,secret){set(MODE,'1');set(BASE,await digest(raw));key=secret}
 async function clean(dir,legacy){
  const scanned=await scan(dir),saved=new Map((legacy||[]).map(x=>[x.path,x.bytes]));
  for(const row of scanned.rows)if(saved.get(row.path)!==row.bytes)throw Error('Старая база изменена. Удаление отменено.');
  for(const row of scanned.rows){const live=await file(row.parent,row.name);if(!live||cryptoApi().b64(new Uint8Array(await (await live.getFile()).arrayBuffer()))!==row.bytes)throw Error('Старый файл изменён. Оставшиеся файлы сохранены.');await row.parent.removeEntry(row.name)}
  for(const d of scanned.dirs.reverse())try{await d.parent.removeEntry(d.name,{recursive:false})}catch(e){if(e.name!=='InvalidModificationError'&&e.name!=='NotFoundError')throw e}
 }
 async function run(fn){if(busy)throw Error('Операция с базой уже выполняется.');busy=true;try{return navigator.locks?await navigator.locks.request('zabvenye-folder-vault',fn):await fn()}finally{busy=false}}
 async function activate(secret,root=null){return run(async()=>{
  root=root||await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку в хранилище.');
  const dir=await app(root,true),existing=await file(dir,NAME),current=await snapshot();
  if(existing){const raw=await (await existing.getFile()).text(),pkg=await cryptoApi().openDatabase(raw,secret);if(!same(pkg,current))throw Error('В папке уже есть другая зашифрованная база. Восстановите её отдельно.');await clean(dir,pkg.legacyDisk);await mark(raw,secret);return {count:pkg.state.clients.length}}
  const scanned=await scan(dir),legacy=tree(scanned.rows),old=legacy.find(x=>x.path==='database.json');
  if(legacy.length&&!old)throw Error('Сначала синхронизируйте старую папку. Старые файлы не изменены.');
  if(old){const previous=JSON.parse(new TextDecoder().decode(cryptoApi().unb64(old.bytes)));if(canonical(previous)!==canonical(current.state))throw Error('Сначала синхронизируйте текущую и старую базы. Старые файлы не изменены.')}
  const pkg={...current,legacyDisk:legacy};
  const raw=await write(dir,pkg,secret);
  // The authenticated archive contains every managed legacy file byte-for-byte.
  if(canonical(tree((await scan(dir)).rows))!==canonical(legacy))throw Error('Старая папка изменилась. Удаление отменено.');
  await mark(raw,secret);await clean(dir,legacy);
  return {count:pkg.state.clients.length};
 })}
 async function restore(pkg){
  const curr=await snapshot();if(!empty(curr))throw Error('В браузере уже есть другая база. Защитите её перед восстановлением.');
  const api=files(),added=[];try{for(const f of pkg.files){const m=f.meta;if(!m?.id||!m.clientId||!m.sessionId)throw Error('Некорректное вложение ZBV.');const blob=new Blob([cryptoApi().unb64(f.bytes)],{type:m.type||'application/octet-stream'});if(!await api.put({...m,blob},{source:'vault-restore'}))throw Error('Не удалось восстановить вложение.');added.push(m.id)}
  if(db().writeState(pkg.state,{source:'vault-restore'})!==true)throw Error('Не удалось восстановить базу.');}catch(e){for(const id of added)try{await api.remove(id,{source:'vault-restore-rollback'})}catch{}throw e}
 }
 async function sync(root,{ask=true,secret:provided=null}={}){
  const dir=await app(root),handle=await file(dir,NAME);
  if(!handle){if(!mode()&&dir&&(await scan(dir)).rows.length)return null;const secret=provided||key||(ask&&await cryptoApi().requestSecret({generate:true,title:'Ключ шифрования базы'}));if(!secret)throw Error('Шифрование не выполнено: ключ не введён.');return activate(secret,root)}
  return run(async()=>{
   const raw=await (await handle.getFile()).text();
   let secret=provided||key,pkg;
   if(secret)try{pkg=await cryptoApi().openDatabase(raw,secret)}catch(e){if(provided)throw e;secret=null;key=null}
   if(!pkg){if(!ask)throw Error('Введите ключ шифрования в хранилище.');secret=await cryptoApi().requestSecret({title:'Открыть зашифрованную базу'});if(!secret)throw Error('Ввод ключа отменён.');pkg=await cryptoApi().openDatabase(raw,secret)}
   const current=await snapshot();pkg.files.sort((a,b)=>String(a.meta.id).localeCompare(String(b.meta.id)));
   if(same(pkg,current)){await clean(dir,pkg.legacyDisk);await mark(raw,secret);return {count:pkg.state.clients.length}}
   if(get(BASE)!==await digest(raw)){
    if(empty(current)){await restore(pkg);await mark(raw,secret);return {count:pkg.state.clients.length,reload:true}}
    throw Error('База в папке и браузере различается. Автоматическая перезапись запрещена.');
   }
   // A matching encrypted baseline authorizes updates from this browser only.
   const next={...current,legacyDisk:pkg.legacyDisk||[]},out=await write(dir,next,secret,raw);await mark(out,secret);await clean(dir,next.legacyDisk);return {count:current.state.clients.length}
  })
 }
 async function download(secret){const root=await savedHandle(),dir=root&&await app(root),h=await file(dir,NAME);if(!h)throw Error('Сначала зашифруйте базу.');const result=await sync(root,{secret});if(result?.reload)throw Error('Сначала обновите страницу после восстановления.');const raw=await (await h.getFile()).text();await cryptoApi().openDatabase(raw,secret);return raw;}
 async function restoreFile(raw,secret){return run(async()=>{const pkg=await cryptoApi().openDatabase(raw,secret);const current=await snapshot();if(!empty(current))throw Error('Восстановление возможно только в пустое рабочее пространство.');const root=await savedHandle();if(!root||await root.queryPermission({mode:'readwrite'})!=='granted')throw Error('Сначала подключите папку.');const dir=await app(root,true);if((await scan(dir)).rows.length)throw Error('В папке найдена старая база. Выберите пустую папку.');const existing=await file(dir,NAME);if(existing&&await (await existing.getFile()).text()!==raw)throw Error('В папке уже есть другая база.');if(!existing)await cryptoApi().writeDatabase(await dir.getFileHandle(NAME,{create:true}),raw,secret);await restore(pkg);await mark(raw,secret);return {count:pkg.state.clients.length};})}
 window.DiagnostikaFolderVault=Object.freeze({activate,sync,hasEncrypted,mustEncrypt,mode,download,restoreFile,savedHandle,keyUnlocked:()=>Boolean(key),lock:()=>{key=null}});
})();
