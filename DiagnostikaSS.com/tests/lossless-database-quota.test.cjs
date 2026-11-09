'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const codecSource=fs.readFileSync(path.join(root,'core/state-codec.js'),'utf8');
const databaseSource=fs.readFileSync(path.join(root,'core/database.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
function harness({limit=Infinity,withCodec=true,rejectCompact=false}={}){
  const stored=new Map();
  const backend={
    setItem(key,value){
      if((rejectCompact&&value.startsWith('DSS15V1:'))||value.length>limit){
        const error=new Error('Quota exceeded');
        error.name='QuotaExceededError';
        throw error;
      }
      stored.set(key,value);
    },
    getItem(key){return stored.get(key)??null;},
    removeItem(key){stored.delete(key);}
  };
  const window={localStorage:backend};
  const ctx={window,console:{error(){},warn(){}},TextEncoder,TextDecoder,Date,Math,Uint8Array,JSON};
  if(withCodec)vm.runInNewContext(codecSource,ctx);
  vm.runInNewContext(databaseSource,ctx);
  return {db:window.DiagnostikaDB,codec:window.DiagnostikaStateCodec,stored,backend};
}
function fakeState(extra=''){
  return {version:4,clients:[
    {id:'one',name:'Ирина Волкова',gender:'Женский',photoData:'data:image/jpeg;base64,'+
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/'.repeat(2500),
      request:'Глубинные убеждения и другие личные данные '+extra},
    {id:'two',name:'Вика',notes:'Заметки и запросы'}
  ]};
}

test('round trips personal state, Unicode, photo data and surrogate pairs exactly',()=>{
  const {codec}=harness();
  const state=fakeState('😀 / 🇷🇺 / 情');
  const raw=JSON.stringify(state);
  const packed=codec.pack(raw);
  assert.ok(packed.startsWith(codec.prefix));
  assert.ok(packed.length<raw.length*0.6,'state should use materially less storage');
  assert.equal(codec.unpack(packed),raw);
  assert.deepEqual(JSON.parse(codec.unpack(packed)),state);
});

test('legacy JSON state transparently upgrades on next successful save',()=>{
  const {db,stored}=harness();
  const state=fakeState();
  stored.set('diagnostika-web-v1',JSON.stringify(state));
  assert.equal(db.readState().clients[0].name,'Ирина Волкова');
  assert.equal(db.writeState(state),true);
  assert.match(stored.get('diagnostika-web-v1'),/^DSS15V1:/);
  assert.deepEqual(db.readState(),state);
});

test('overfilled legacy data can be saved compactly without deleting any client or image',()=>{
  const state=fakeState();
  const raw=JSON.stringify(state);
  const {db,stored}=harness({limit:raw.length*0.78});
  stored.set('diagnostika-web-v1',raw);
  const changed=fakeState('Дополнение карточки');
  assert.equal(db.writeState(changed),true);
  assert.equal(db.lastError(),null);
  assert.ok(stored.get('diagnostika-web-v1').length<raw.length*0.78);
  assert.deepEqual(db.readState(),changed);
});

test('quota failure preserves existing saved state and signals explicit reason',()=>{
  const {db,stored}=harness({limit:110});
  const older={version:4,clients:[{id:'before',name:'Original'}]};
  assert.equal(db.writeState(older),true);
  const before=stored.get('diagnostika-web-v1');
  assert.equal(db.writeState(fakeState()),false);
  assert.equal(db.lastError().reason,'quota-exceeded');
  assert.equal(stored.get('diagnostika-web-v1'),before);
  assert.deepEqual(db.readState(),older);
});

test('corrupted compact state is never silently replaced with an empty database',()=>{
  const {db,stored,codec}=harness();
  const encoded=codec.pack(JSON.stringify(fakeState()));
  stored.set('diagnostika-web-v1',encoded.slice(0,-5)+'invalid');
  assert.throws(()=>db.readState(),/Сохранённую базу не удалось безопасно прочитать/);
  assert.equal(stored.get('diagnostika-web-v1'),encoded.slice(0,-5)+'invalid');
});

test('fallback writes ordinary JSON if compact text is rejected',()=>{
  const state=fakeState();
  const {db,stored}=harness({rejectCompact:true});
  assert.equal(db.writeState(state),true);
  assert.ok(stored.get('diagnostika-web-v1').startsWith('{'));
  assert.deepEqual(db.readState(),state);
});

test('older runtime without compact codec still saves ordinary JSON',()=>{
  const state=fakeState();
  const {db,stored}=harness({withCodec:false});
  assert.equal(db.writeState(state),true);
  assert.ok(stored.get('diagnostika-web-v1').startsWith('{'));
  assert.deepEqual(db.readState(),state);
});

test('codec script loads before core database, both versioned',()=>{
  const a=index.indexOf('core/state-codec.js?v=20261109-lossless-state-1');
  const b=index.indexOf('core/database.js?v=20261109-lossless-state-1');
  assert.ok(a!==-1&&b!==-1&&a<b);
});

test('short and heavily Cyrillic JSON never expands browser database when raw is smaller',()=>{
  const {db,stored}=harness();
  assert.equal(db.writeState({clients:[],version:4}),true);
  assert.match(stored.get('diagnostika-web-v1'),/^\{/);
  assert.equal(db.writeState({clients:[{id:'1',name:'Проверка'.repeat(1000)}]}),true);
  assert.deepEqual(db.readState().clients[0].name,'Проверка'.repeat(1000));
});
