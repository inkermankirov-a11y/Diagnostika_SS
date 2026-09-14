'use strict';

const cloneValue=value=>{
  if(value==null)return value;
  if(typeof structuredClone==='function')return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};
const isObj=value=>value&&typeof value==='object'&&!Array.isArray(value);

function deepEqual(a,b){
  if(a===b)return true;
  if(a==null||b==null)return false;
  if(typeof a!==typeof b)return false;
  if(typeof a!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){
    if(a.length!==b.length)return false;
    for(let i=0;i<a.length;i+=1)if(!deepEqual(a[i],b[i]))return false;
    return true;
  }
  const ak=Object.keys(a),bk=Object.keys(b);
  if(ak.length!==bk.length)return false;
  for(const key of ak){
    if(!Object.prototype.hasOwnProperty.call(b,key))return false;
    if(!deepEqual(a[key],b[key]))return false;
  }
  return true;
}

function mergeArray(base,local,remote,path,conflicts){
  const b=Array.isArray(base)?base:[];
  const l=Array.isArray(local)?local:[];
  const r=Array.isArray(remote)?remote:[];
  const all=[...b,...l,...r].filter(v=>v!=null);
  const idBased=all.length>0&&all.every(v=>isObj(v)&&v.id!=null);

  if(!idBased){
    if(deepEqual(l,r))return cloneValue(l);
    if(deepEqual(l,b))return cloneValue(r);
    if(deepEqual(r,b))return cloneValue(l);
    const out=[];
    const seen=new Set();
    for(const value of [...l,...r]){
      let key;
      try{key=JSON.stringify(value);}catch{key=String(value);}
      if(seen.has(key))continue;
      seen.add(key);
      out.push(cloneValue(value));
    }
    conflicts.push(path||'array');
    return out;
  }

  const bm=new Map(b.map(v=>[String(v.id),v]));
  const lm=new Map(l.map(v=>[String(v.id),v]));
  const rm=new Map(r.map(v=>[String(v.id),v]));
  const order=[];
  const seenIds=new Set();
  for(const value of [...l,...r,...b]){
    const id=String(value.id);
    if(seenIds.has(id))continue;
    seenIds.add(id);
    order.push(id);
  }

  const out=[];
  for(const id of order){
    const bv=bm.get(id),lv=lm.get(id),rv=rm.get(id);
    const p=`${path}[${id}]`;
    if(!bv){
      if(lv&&rv)out.push(mergeValue(undefined,lv,rv,p,conflicts));
      else if(lv)out.push(cloneValue(lv));
      else if(rv)out.push(cloneValue(rv));
      continue;
    }
    if(!lv&&!rv)continue;
    if(!lv&&rv){
      if(deepEqual(rv,bv))continue;
      conflicts.push(`${p}: удалено локально, изменено в облаке`);
      out.push(cloneValue(rv));
      continue;
    }
    if(lv&&!rv){
      if(deepEqual(lv,bv))continue;
      conflicts.push(`${p}: удалено в облаке, изменено локально`);
      out.push(cloneValue(lv));
      continue;
    }
    out.push(mergeValue(bv,lv,rv,p,conflicts));
  }
  return out;
}

function mergeValue(base,local,remote,path,conflicts){
  if(deepEqual(local,remote))return cloneValue(local);
  if(deepEqual(local,base))return cloneValue(remote);
  if(deepEqual(remote,base))return cloneValue(local);

  if(Array.isArray(local)||Array.isArray(remote)||Array.isArray(base)){
    return mergeArray(base,local,remote,path,conflicts);
  }

  if(isObj(local)||isObj(remote)||isObj(base)){
    const b=isObj(base)?base:{};
    const l=isObj(local)?local:{};
    const r=isObj(remote)?remote:{};
    const out={};
    const keys=new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)]);
    for(const key of keys){
      const hasL=Object.prototype.hasOwnProperty.call(l,key);
      const hasR=Object.prototype.hasOwnProperty.call(r,key);
      const hasB=Object.prototype.hasOwnProperty.call(b,key);
      const p=path?`${path}.${key}`:key;
      if(!hasL&&!hasR)continue;
      if(!hasB){
        if(hasL&&hasR)out[key]=mergeValue(undefined,l[key],r[key],p,conflicts);
        else out[key]=cloneValue(hasL?l[key]:r[key]);
        continue;
      }
      if(!hasL&&hasR){
        if(deepEqual(r[key],b[key]))continue;
        conflicts.push(`${p}: удалено локально, изменено в облаке`);
        out[key]=cloneValue(r[key]);
        continue;
      }
      if(hasL&&!hasR){
        if(deepEqual(l[key],b[key]))continue;
        conflicts.push(`${p}: удалено в облаке, изменено локально`);
        out[key]=cloneValue(l[key]);
        continue;
      }
      out[key]=mergeValue(b[key],l[key],r[key],p,conflicts);
    }
    return out;
  }

  conflicts.push(path||'value');
  return cloneValue(local);
}

function applyClientDeletionRules(merged,base,local,remote,conflicts){
  merged.deletedClientTombstones=[...new Set([
    ...(base?.deletedClientTombstones||[]),
    ...(local?.deletedClientTombstones||[]),
    ...(remote?.deletedClientTombstones||[])
  ])];
  const tomb=new Set(merged.deletedClientTombstones.map(String));
  merged.clients=(merged.clients||[]).filter(c=>!tomb.has(String(c?.id)));
  merged.deletedClients=(merged.deletedClients||[]).filter(c=>!tomb.has(String(c?.id)));

  const baseActive=new Map((base?.clients||[]).map(c=>[String(c.id),c]));
  const localDeleted=new Map((local?.deletedClients||[]).map(c=>[String(c.id),c]));
  const remoteDeleted=new Map((remote?.deletedClients||[]).map(c=>[String(c.id),c]));
  const localActive=new Map((local?.clients||[]).map(c=>[String(c.id),c]));
  const remoteActive=new Map((remote?.clients||[]).map(c=>[String(c.id),c]));
  const softDeleted=new Set([...localDeleted.keys(),...remoteDeleted.keys()]);

  for(const id of softDeleted){
    if(tomb.has(id))continue;
    const bv=baseActive.get(id),la=localActive.get(id),ra=remoteActive.get(id),ld=localDeleted.get(id),rd=remoteDeleted.get(id);
    let deletionWins=false;
    if(ld&&!la){
      if(!ra||!bv||deepEqual(ra,bv))deletionWins=true;
      else conflicts.push(`client[${id}]: удалён локально, но изменён в облаке`);
    }
    if(rd&&!ra){
      if(!la||!bv||deepEqual(la,bv))deletionWins=true;
      else conflicts.push(`client[${id}]: удалён в облаке, но изменён локально`);
    }
    if(deletionWins){
      merged.clients=(merged.clients||[]).filter(c=>String(c.id)!==id);
      const deleted=cloneValue(ld||rd);
      if(deleted&&!merged.deletedClients.some(c=>String(c.id)===id))merged.deletedClients.push(deleted);
    }
  }

  const activeIds=new Set((merged.clients||[]).map(c=>String(c.id)));
  merged.deletedClients=(merged.deletedClients||[]).filter(c=>!activeIds.has(String(c.id)));
  return merged;
}

function mergeDatabases(base,local,remote){
  const conflicts=[];
  const b=base&&Array.isArray(base.clients)?base:{version:4,clients:[]};
  const l=local&&Array.isArray(local.clients)?local:{version:4,clients:[]};
  const r=remote&&Array.isArray(remote.clients)?remote:{version:4,clients:[]};
  let merged=mergeValue(b,l,r,'',conflicts);
  merged=applyClientDeletionRules(merged,b,l,r,conflicts);
  merged.version=Math.max(Number(l.version)||4,Number(r.version)||4,Number(b.version)||4);
  return {merged,conflicts};
}

self.onmessage=event=>{
  try{
    const {base,local,remote}=event.data||{};
    const result=mergeDatabases(base,local,remote);
    self.postMessage({ok:true,...result});
  }catch(error){
    self.postMessage({ok:false,error:error?.message||String(error)});
  }
};
