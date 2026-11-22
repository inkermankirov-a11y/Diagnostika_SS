import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base=fileURLToPath(new URL('../',import.meta.url));
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(_,fn)=>fn()},storage:{persist:async()=>true}},configurable:true});
globalThis.location={hostname:'zabvenye.com'};
const local=new Map();
globalThis.localStorage={getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,String(v))};
globalThis.fetch=async()=>({ok:true,json:async()=>({id:'owner',role:'admin',limits:{sync:true}})});
const databases=new Map();
globalThis.indexedDB={
 open(name){
  const req={};queueMicrotask(()=>{
   const fresh=!databases.has(name);if(fresh)databases.set(name,new Map());const stores=databases.get(name);
   const db={close(){},objectStoreNames:{contains:n=>stores.has(n)},createObjectStore(n){stores.set(n,new Map());},transaction(n){
    const tx={objectStore(){return {
     get(k){const r={};queueMicrotask(()=>{r.result=stores.get(n).get(k);r.onsuccess?.();tx.oncomplete?.();});return r;},
     put(v,k){const r={};queueMicrotask(()=>{stores.get(n).set(k,v);r.onsuccess?.();tx.oncomplete?.();});return r;}
    };}};return tx;
   }};
   req.result=db;if(fresh)req.onupgradeneeded?.();req.onsuccess?.();
  });return req;
 }
};
let clock=100,failMedia=false;
const err=()=>new DOMException('not found','NotFoundError');
class Handle {
 constructor(path){this.path=path;this.blob=new Blob([]);this.modified=++clock;this.writes=0;}
 async getFile(){const data=this.blob.slice();Object.defineProperty(data,'lastModified',{value:this.modified});return data;}
 async createWritable(){
  let pending;
  return {write:async b=>{if(failMedia&&this.path.includes('clients-v2/')){failMedia=false;throw new Error('simulated write failure');}pending=b;},close:async()=>{this.blob=pending;this.modified=++clock;this.writes++;},abort:async()=>{}};
 }
}
class Dir {
 constructor(path=''){this.path=path;this.children=new Map();}
 async getDirectoryHandle(n,{create=false}={}){if(!this.children.has(n)&&create)this.children.set(n,new Dir(this.path+n+'/'));const h=this.children.get(n);if(!h)throw err();if(!(h instanceof Dir))throw new DOMException('wrong type','TypeMismatchError');return h;}
 async getFileHandle(n,{create=false}={}){if(!this.children.has(n)&&create)this.children.set(n,new Handle(this.path+n));const h=this.children.get(n);if(!h)throw err();if(!(h instanceof Handle))throw new DOMException('wrong type','TypeMismatchError');return h;}
 async queryPermission(){return 'granted';}
 async requestPermission(){return 'granted';}
 async isSameEntry(other){return this===other;}
 async *entries(){for(const [n,h] of this.children)yield [n,Object.assign(h,{kind:h instanceof Dir?'directory':'file'})];}
}
const root=new Dir(),folder=await root.getDirectoryHandle('Diagnostika',{create:true});
const json=v=>JSON.parse(JSON.stringify(v));
const original={version:4,clients:[{id:'client1',name:'Test client',note:'old',photoData:'data:image/png;base64,AQID',photoSourceData:'data:image/png;base64,BAUG',sessions:[{id:'session1'}]}]};
let state=json(original);
const file1={id:'video1',clientId:'client1',sessionId:'session1',name:'very-long-original-video-name-123456789012345678901234567890.mp4',type:'video/mp4',size:8,createdAt:'2026-01-01',blob:new Blob(['12345678'])};
const file2={id:'receipt1',clientId:'client1',sessionId:'receipt:session:session1:issued',name:'check.pdf',type:'application/pdf',size:3,createdAt:'2026-01-01',blob:new Blob(['pdf'])};
let records=[file1,file2],deleted=[],approved=true;
globalThis.window={
 confirm:()=>approved,showDirectoryPicker:async()=>root,
 DiagnostikaDB:{readState:()=>json(state),writeState:v=>{state=json(v);return true;}},
 DiagnostikaPlatform:{services:{files:{list:async()=>records.slice(),put:async r=>{if(records.some(x=>x.id===r.id))return null;records.push(r);return r;},remove:async id=>{records=records.filter(r=>r.id!==id);},deletedIds:async()=>deleted.slice()}}},
 DiagnostikaStorageRefresh:{apply(){}}
};
for(const f of ['vault-crypto.js','vault-media.js','vault-folder.js'])vm.runInThisContext(fs.readFileSync(base+f,'utf8'),{filename:f});
const c=window.DiagnostikaVaultCrypto,m=window.DiagnostikaVaultMedia,v=window.DiagnostikaFolderVault;
const key=c.recoveryKey();
const payload={format:'zbv-backup-v1',state:json(state),files:await Promise.all(records.map(async({blob,...meta})=>({meta,bytes:c.b64(new Uint8Array(await blob.arrayBuffer()))}))),legacyDisk:[{path:'database.json',bytes:'e30='}]};
const recovery=await c.seal({secret:key},c.recoveryKey(),'backup');
const old=JSON.stringify({...JSON.parse(await c.seal(payload,key,'backup')),recovery});
const active=await folder.getFileHandle('database.zbv',{create:true});
await c.writeDatabase(active,old,key);
await v.ensureRoot();
assert.equal((await v.verifyKey(key,{rememberDevice:true})).state,'valid');
approved=false;await assert.rejects(v.sync(root,{ask:false}),/Переход отменён/);
assert.equal(await (await active.getFile()).text(),old);
assert.equal(folder.children.has('clients-v2'),false);
approved=true;failMedia=true;
await assert.rejects(v.sync(root,{ask:false}),/simulated write failure/);
assert.equal(await (await active.getFile()).text(),old);
const backups=await folder.getDirectoryHandle('backups');
assert.equal(backups.children.size,1);
assert.equal(await (await [...backups.children.values()][0].getFile()).text(),old);
const migrated=await v.sync(root,{ask:false});
assert.equal(migrated.migrated,true);
let raw=await (await active.getFile()).text(),pkg=await c.openDatabase(raw,key);
assert.equal(pkg.format,m.FORMAT);
assert.equal(JSON.parse(raw).recovery,recovery);
assert.equal(pkg.files.length,2);
assert.equal(pkg.photos.length,2);
assert.equal(pkg.state.clients[0].photoData,'');
assert.equal(pkg.state.clients[0].photoSourceData,'');
assert(!JSON.stringify(pkg).includes('MTIzNDU2Nzg='));
assert(pkg.files.find(e=>e.meta.id==='video1').path.endsWith('.mp4'));
assert(pkg.files.find(e=>e.meta.id==='receipt1').path.includes('/sessions/session_session1/receipts/'));
const recovered=await m.hydrate(folder,pkg);
assert.deepEqual(recovered.state,original);
assert.equal(await recovered.records.find(e=>e.id==='video1').blob.text(),'12345678');
const walk=async(path)=>{let d=folder,parts=path.split('/');for(const n of parts.slice(0,-1))d=await d.getDirectoryHandle(n);return d.getFileHandle(parts.at(-1));};
const video=await walk(pkg.files.find(e=>e.meta.id==='video1').path);
const writes=video.writes;
class Unreadable extends Blob {slice(){throw Error('unchanged attachment was read');}arrayBuffer(){throw Error('unchanged attachment was read');}}
records[0]={...file1,blob:new Unreadable(['12345678'])};
state.clients[0].note='new note';
await v.sync(root,{ask:false});
assert.equal(video.writes,writes);
raw=await (await active.getFile()).text();pkg=await c.openDatabase(raw,key);
assert.equal(pkg.state.clients[0].note,'new note');
records=[file2];
await assert.rejects(v.sync(root,{ask:false}),/отсутствуют вложения/);
assert.equal(await (await active.getFile()).text(),raw);
records=[file1,file2];
const clean=new Dir(),missingDir=await clean.getDirectoryHandle('Diagnostika',{create:true});
const savedState=json(state),savedRecords=records;
state={version:4,clients:[]};records=[];
await assert.rejects(v.restoreFile(raw,key,clean),/Вложение не найдено/);
assert.equal(missingDir.children.has('database.zbv'),false);
const restored=await v.sync(root,{ask:true});
assert.equal(restored.restored,true);
assert.deepEqual(state,savedState);
assert.equal(records.length,savedRecords.length);
assert.equal(await records.find(r=>r.id==='video1').blob.text(),'12345678');
await assert.rejects(v.sync(root,{ask:true,secret:c.recoveryKey()}),/Неверный ключ/);
assert.equal(await (await active.getFile()).text(),raw);
records=records.filter(r=>r.id!=='video1');deleted=['video1'];
await v.sync(root,{ask:false});
pkg=await c.openDatabase(await (await active.getFile()).text(),key);
assert.equal(pkg.files.length,1);
assert.equal(await (await video.getFile()).text(),'12345678'); // physical file intentionally retained
assert.equal(await (await [...backups.children.values()][0].getFile()).text(),old);
console.log('ZBV_SPLIT_V2_AUDIT_OK');
