'use strict';
(() => {
  if(window.DiagnostikaBrowserVault)return;
  const DB='zabvenye-encrypted-vault-v1',STORE='vault',ID='database.zbv';
  let secret=null,tail=Promise.resolve(),epoch=0,closing=false;
  const api=()=>window.DiagnostikaVaultCrypto;
  const enqueue=fn=>{const p=tail.then(fn);tail=p.catch(()=>{});return p};
  function connect(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB,1);
      req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function transaction(mode,fn){
    const db=await connect();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
      let req;
      try{req=fn(store)}catch(e){tx.abort();reject(e);return}
      tx.oncomplete=()=>resolve(req.result);
      tx.onabort=tx.onerror=()=>reject(tx.error||Error('ZBV transaction failed'));
    })}finally{db.close()}
  }
  const read=()=>transaction('readonly',s=>s.get(ID));
  async function replace(previous,raw){
    const db=await connect();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite'),s=tx.objectStore(STORE),req=s.get(ID);
      req.onsuccess=()=>{if(req.result!==previous){tx.abort();return} s.put(raw,ID)};
      tx.oncomplete=resolve;
      tx.onabort=tx.onerror=()=>reject(tx.error||Error('База изменена в другой вкладке. Повторите открытие.'));
    })}finally{db.close()}
  }
  let baseline;
  const requireOpen=()=>{if(!secret||closing)throw Error('База ZBV заблокирована')};
  async function unlock(key){
    return enqueue(async()=>{
      if(secret||closing)throw Error('Сначала заблокируйте текущую базу');
      const raw=await read();
      if(raw===undefined)return null;
      const pkg=await api().openDatabase(raw,key);
      baseline=raw;secret=key;epoch++;
      return pkg;
    });
  }
  async function initialize(key,state,records){
    return enqueue(async()=>{
      if(secret||closing)throw Error('База уже открыта');
      if(await read()!==undefined)throw Error('База уже существует');
      const raw=await api().packDatabase(state,records,key);
      await replace(undefined,raw);
      if(await read()!==raw)throw Error('Проверка записи ZBV не пройдена');
      baseline=raw;secret=key;epoch++;
      return api().openDatabase(raw,key);
    });
  }
  function save(state,records){
    requireOpen();
    const snapshot=structuredClone(state),files=structuredClone(records),generation=epoch;
    return enqueue(async()=>{
      if(!secret||generation!==epoch)throw Error('Сеанс ZBV завершён');
      const raw=await api().packDatabase(snapshot,files,secret);
      await replace(baseline,raw);
      baseline=raw;
      return true;
    });
  }
  function exportEncrypted(){
    requireOpen();
    const generation=epoch;
    return enqueue(async()=>{
      if(!secret||generation!==epoch)throw Error('Сеанс ZBV завершён');
      const raw=await read();
      if(raw!==baseline)throw Error('База изменена в другой вкладке');
      await api().openDatabase(raw,secret);
      return new Blob([raw],{type:'application/octet-stream'});
    });
  }
  async function lock(){
    closing=true;
    return enqueue(async()=>{secret=null;baseline=undefined;epoch++;closing=false});
  }
  window.DiagnostikaBrowserVault=Object.freeze({exists:async()=>await read()!==undefined,unlock,initialize,save,exportEncrypted,lock,isUnlocked:()=>Boolean(secret)&&!closing});
})();
