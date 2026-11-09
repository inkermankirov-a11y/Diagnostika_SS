'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const databaseSource=fs.readFileSync(path.join(root,'core/database.js'),'utf8');
const serviceSource=fs.readFileSync(path.join(root,'modules/clients/client-service.js'),'utf8');
const cardSource=fs.readFileSync(path.join(root,'modules/clients/ui/card.js'),'utf8');

test('database identifies quota failures without disclosing sensitive data',()=>{
  const values=new Map();
  let fail=false;
  const storage={
    setItem(key,value){
      if(fail){const error=new Error('full');error.name='QuotaExceededError';throw error;}
      values.set(key,value);
    },
    getItem:key=>values.get(key)??null,
    removeItem:key=>values.delete(key)
  };
  const window={localStorage:storage},console={error(){}};
  vm.runInNewContext(databaseSource,{window,console,Date,JSON,Object});
  const db=window.DiagnostikaDB;
  assert.equal(db.writeState({clients:[]}),true);
  assert.equal(db.lastError(),null);
  fail=true;
  assert.equal(db.writeState({clients:[{id:'1',name:'Sensitive name'}]}),false);
  assert.equal(db.lastError().reason,'quota-exceeded');
  assert.equal(db.lastError().name,'QuotaExceededError');
  assert.equal(JSON.stringify(db.lastError()).includes('Sensitive name'),false);
  fail=false;
  assert.equal(db.writeState({clients:[]}),true);
  assert.equal(db.lastError(),null);
});

test('client service restores previous field values when persistence fails',()=>{
  const client={id:'client-1',name:'Original',country:'',age:'30'};
  const state={clients:[client]};
  let shouldSave=false;
  const platform={
    services:{},
    store:{clients:()=>state.clients,state:()=>state,persist:()=>shouldSave},
    shell:{currentClientId:()=>client.id,renderClient:()=>true},
    events:{emit:()=>1}
  };
  const window={DiagnostikaPlatform:platform};
  vm.runInNewContext(serviceSource,{window,console:{error(){}},Object,Date,JSON});
  const svc=platform.services.clients;
  assert.equal(svc.update(client.id,{name:'Unsaved',country:'RU',addedField:'new'}),null);
  assert.equal(client.name,'Original');
  assert.equal(client.country,'');
  assert.equal(Object.hasOwn(client,'addedField'),false);
  assert.equal(client,svc.findById(client.id));
  shouldSave=true;
  assert.ok(svc.update(client.id,{name:'Saved',country:'RU'}));
  assert.equal(client.name,'Saved');
  assert.equal(client.country,'RU');
});

test('card retains editor on failure and exposes explicit local backup action',()=>{
  assert.match(cardSource,/ccSaveFailure/);
  assert.match(cardSource,/ccExportUnsavedBtn/);
  assert.match(cardSource,/showSaveFailure\(\);return;/);
  assert.match(cardSource,/snapshot\.clients/);
  assert.match(cardSource,/Object\.assign\(row,data\)/);
  assert.match(cardSource,/link\.click\(\)/);
  assert.doesNotMatch(cardSource,/if\(!updated\) return alert\('Не удалось сохранить карточку клиента\.'\)/);
});

test('only new .com modules are loaded by updated browser cache keys',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const loader=fs.readFileSync(path.join(root,'app-loader.js'),'utf8');
  assert.match(html,/core\/database\.js\?v=20261109-lossless-state-1/);
  assert.match(html,/modules\/clients\/ui\/card\.js\?v=20261109-save-diagnostics-1/);
  assert.match(loader,/modules\/clients\/client-service\.js\?v=20261109-save-rollback-1/);
});
