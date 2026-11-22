'use strict';
(()=>{
 const FORMAT='zbv-folder-v2', ROOT='clients-v2', BLOCK=4*1024*1024;
 const api=()=>window.DiagnostikaVaultCrypto;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const token=v=>{const s=encodeURIComponent(String(v)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16));if(!s||s.length>100||s==='.'||s==='..')throw Error('Некорректный идентификатор файла или клиента');return s;};
 const name=v=>{const s=String(v||'file').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[ .]+$/g,'')||'file';const ext=/\.[a-zA-Z0-9]{1,12}$/.exec(s)?.[0]||'';return Array.from(ext?s.slice(0,-ext.length):s).slice(0,20).join('')+ext;};
 function path(meta,revision=''){
  const base=ROOT+'/client_'+token(meta.clientId);
  const id=token(meta.id)+(revision?'_'+token(revision):'');
  const scope=String(meta.sessionId||'');
  if(meta.photoField)return base+'/photos/'+id+'_'+name(meta.name);
  if(scope.startsWith('receipt:session:'))return base+'/sessions/session_'+token(scope.slice(16).replace(/:issued$/,''))+'/receipts/'+id+'_'+name(meta.name);
  if(scope.startsWith('receipt:payment:'))return base+'/receipts/'+id+'_'+name(meta.name);
  return base+'/sessions/session_'+token(scope)+'/files/'+id+'_'+name(meta.name);
 }
 function segments(value){
  if(typeof value!=='string')throw Error('Отсутствует путь вложения');
  const p=value.split('/');
  if(p[0]!==ROOT||p.length<4||p.some(x=>!x||x==='.'||x==='..'||/[\\\x00-\x1f]/.test(x)))throw Error('Небезопасный путь вложения');
  return p;
 }
 async function fileAt(dir,value,create=false){
  const p=segments(value);let d=dir;
  try{for(const s of p.slice(0,-1))d=await d.getDirectoryHandle(s,{create});return await d.getFileHandle(p.at(-1),{create});}
  catch(e){if(!create&&e.name==='NotFoundError')return null;throw e}
 }
 const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
 async function fingerprint(blob){
  const chunks=[];for(let p=0;p<blob.size;p+=BLOCK)chunks.push(hex(await crypto.subtle.digest('SHA-256',await blob.slice(p,p+BLOCK).arrayBuffer())));
  return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(blob.size+':'+chunks.join(':'))));
 }
 async function verify(blob,entry){
  if(!blob||blob.size!==entry.size||await fingerprint(blob)!==entry.hash)throw Error('Вложение отсутствует или изменено: '+entry.meta.name);
 }
 async function write(dir,where,blob,hash){
  let h=await fileAt(dir,where);
  if(h){const old=await h.getFile();if(old.size!==blob.size||await fingerprint(old)!==hash)throw Error('Файл с таким именем уже существует. Перезапись запрещена: '+where);return old;}
  h=await fileAt(dir,where,true);const w=await h.createWritable({keepExistingData:false});
  try{await w.write(blob);await w.close()}catch(e){try{await w.abort()}catch{}throw e}
  const saved=await h.getFile();await verify(saved,{size:blob.size,hash,meta:{name:where}});return saved;
 }
 function photoState(value){
  const state=clone(value),records=[];
  function walk(o,parts,owner){
   if(!o||typeof o!=='object')return;
   if(Array.isArray(o)){o.forEach((x,i)=>walk(x,[...parts,i],owner));return}
   if(typeof o.id==='string'&&('photoData' in o||'photoSourceData' in o))owner=o.id;
   for(const [k,v] of Object.entries(o)){
    if(owner&&['photoData','photoSourceData'].includes(k)&&typeof v==='string'){
     const m=/^(data:image\/[a-zA-Z0-9.+-]+;base64,)([A-Za-z0-9+/=]+)$/.exec(v);
     if(m){const bytes=api().unb64(m[2]);if(api().b64(bytes)!==m[2])continue;
      const mime=m[1].slice(5,-8),ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/bmp':'bmp','image/avif':'avif'})[mime]||'img';
      const field=[...parts,k],id='photo_'+k+'_'+String(records.length);
      const blob=new Blob([bytes],{type:mime});records.push({meta:{id,clientId:owner,sessionId:'profile',name:(k==='photoData'?'photo':'photo-original')+'.'+ext,type:mime,photoField:field,prefix:m[1]},blob});o[k]='';continue;
     }
    }
    if(v&&typeof v==='object')walk(v,[...parts,k],owner);
   }
  }
  walk(state,[],null);return {state,records};
 }
 function manifest(pkg){
  if(pkg?.format!==FORMAT||!Array.isArray(pkg.state?.clients)||!Array.isArray(pkg.files)||!Array.isArray(pkg.photos))throw Error('Некорректная база ZBV 2');
  const ids=new Set(),paths=new Set();
  for(const entry of [...pkg.files,...pkg.photos]){
   const m=entry?.meta;
   if(!m?.id||!m.clientId||!m.sessionId||!Number.isSafeInteger(entry.size)||entry.size<0||!/^[a-f0-9]{64}$/.test(entry.hash)||!Number.isFinite(entry.modified))throw Error('Некорректная запись вложения');
   segments(entry.path);
   if(ids.has(m.id)||paths.has(entry.path))throw Error('Повторяющееся вложение');ids.add(m.id);paths.add(entry.path);
   if(m.photoField&&(!Array.isArray(m.photoField)||!m.photoField.length||!['photoData','photoSourceData'].includes(m.photoField.at(-1))||m.photoField.some(k=>['__proto__','constructor','prototype'].includes(k))||!/^data:image\/[a-zA-Z0-9.+-]+;base64,$/.test(m.prefix)))throw Error('Некорректная фотография');
  }
  if(pkg.files.some(x=>x.meta.photoField)||pkg.photos.some(x=>!x.meta.photoField))throw Error('Некорректный тип вложения');
  return pkg;
 }
 function describe(state,records){
  const photo=photoState(state), regular=records.map(({blob,...meta})=>({meta,blob}));
  const sort=(a,b)=>String(a.meta.id).localeCompare(String(b.meta.id));
  return {state:photo.state,files:regular.sort(sort),photos:photo.records.sort(sort)};
 }
 async function matches(pkg,state,records){
  if(pkg.format!==FORMAT)return false;
  const d=describe(state,records);
  if(canonical(d.state)!==canonical(pkg.state)||d.files.length!==pkg.files.length||d.photos.length!==pkg.photos.length)return false;
  for(const [list,stored] of [[d.files,pkg.files],[d.photos,pkg.photos]]){
   const map=new Map(stored.map(x=>[x.meta.id,x]));
   for(const item of list){const old=map.get(item.meta.id);if(!old||canonical(item.meta)!==canonical(old.meta)||item.blob.size!==old.size)return false;if(await fingerprint(item.blob)!==old.hash)return false;}
  }
  return true;
 }
 async function build(dir,state,records,prior=null){
  const d=describe(state,records),out={format:FORMAT,state:d.state,files:[],photos:[]};
  for(const type of ['files','photos']){
   const old=new Map((prior?.[type]||[]).map(x=>[x.meta.id,x]));
   for(const {meta,blob} of d[type]){
    if(!meta.id||!meta.clientId||!meta.sessionId||!(blob instanceof Blob))throw Error('Вложение недоступно или не имеет привязки');
    const previous=old.get(meta.id),unchanged=previous&&canonical(previous.meta)===canonical(meta)&&previous.size===blob.size&&!meta.photoField;
    if(unchanged){
     const h=await fileAt(dir,previous.path),f=h&&await h.getFile();
     if(f&&f.size===previous.size&&f.lastModified===previous.modified){out[type].push(previous);continue;}
     if(f){await verify(f,previous);out[type].push({...previous,modified:f.lastModified});continue;}
     await verify(blob,previous);
     const saved=await write(dir,previous.path,blob,previous.hash);out[type].push({...previous,modified:saved.lastModified});continue;
    }
    const hash=await fingerprint(blob);
    if(previous&&canonical(previous.meta)===canonical(meta)&&previous.hash===hash){
     const h=await fileAt(dir,previous.path),f=h&&await h.getFile();if(f){await verify(f,previous);out[type].push({...previous,modified:f.lastModified});continue;}
    }
    let where=path(meta,hash.slice(0,24));
    // An interrupted copy may leave an empty file. Never overwrite it or an unrelated file.
    const candidate=await fileAt(dir,where);
    if(candidate){const f=await candidate.getFile();if(f.size!==blob.size||await fingerprint(f)!==hash)where=path(meta,hash.slice(0,12)+'_'+crypto.randomUUID());}
    const saved=await write(dir,where,blob,hash);
    out[type].push({meta,path:where,size:blob.size,hash,modified:saved.lastModified});
   }
  }
  return manifest(out);
 }
 async function hydrate(dir,pkg,{verifyFiles=true}={}){
  manifest(pkg);const state=clone(pkg.state),records=[];
  for(const entry of [...pkg.files,...pkg.photos]){
   const h=await fileAt(dir,entry.path),f=h&&await h.getFile();
   if(!f||f.size!==entry.size)throw Error('Вложение не найдено: '+entry.meta.name);
   if(verifyFiles||entry.meta.photoField)await verify(f,entry);
   const m=entry.meta;
   if(m.photoField){
    let o=state;for(const k of m.photoField.slice(0,-1)){if(!o||!Object.prototype.hasOwnProperty.call(o,k))throw Error('Карточка фотографии не найдена');o=o[k]}
    if(!o||o[m.photoField.at(-1)]!=='')throw Error('Некорректная привязка фотографии');
    o[m.photoField.at(-1)]=m.prefix+api().b64(new Uint8Array(await f.arrayBuffer()));
   }else records.push({...m,blob:f});
  }
  return {state,records};
 }
 window.DiagnostikaVaultMedia=Object.freeze({FORMAT,ROOT,manifest,build,matches,hydrate,fingerprint});
})();
