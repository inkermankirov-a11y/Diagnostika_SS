'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'google-drive-sync-safe.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'google-drive-lazy-loader.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const auth=fs.readFileSync(path.join(root,'google-drive-auth-popup-fix.js'),'utf8');

function harness({validToken=true,connected=true}={}){
  const callbacks={},listeners={},intervals=[],timers=new Map(),storage=new Map();
  let nextTimer=0;
  const dbState={version:4,clients:[]};
  function node(){
    const nodes=new Map();
    return {
      textContent:'',title:'',innerHTML:'',dataset:{},disabled:false,
      setAttribute(){},appendChild(child){this.child=child;},
      insertAdjacentElement(position,child){this.inserted=child;card.nodes.set('.gdrive-beacon',child);},
      querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},
      addEventListener(event,callback){this[event]=callback;},
      cloneNode(){return node();},
      replaceWith(){}
    };
  }
  const card=node();
  card.nodes=new Map();
  const connect=node(),status=node(),sync=node(),restore=node(),copy=node(),note=node();
  const initial={'.gdrive-connect':connect,'.gdrive-status':status,
    '.gdrive-sync':sync,'.gdrive-restore':restore,'.gdrive-copy':copy,'.gdrive-note':note};
  card.querySelector=selector=>card.nodes.get(selector)||initial[selector]||null;
  if(validToken)storage.set('diagnostika-google-drive-token-v2',JSON.stringify({access_token:'test',
    expires_at:Date.now()+3600000}));
  if(connected)storage.set('diagnostika-google-drive-connected-v1','1');
  const store={
    getItem:key=>storage.get(key)||null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key)
  };
  const win={
    DiagnostikaDB:{stateKey:'diagnostika-web-v1',readState:()=>dbState,writeState:()=>true},
    DiagnostikaPlatform:{events:{on:(name,callback)=>{callbacks[name]=callback;}},ready:Promise.resolve()},
    addEventListener:(name,callback)=>{listeners[name]=callback}
  };
  const document={
    hidden:false,head:{appendChild(){}},
    createElement:node,
    querySelector:selector=>selector==='.gdrive-card'?card:
      selector==='.gdrive-card .gdrive-status'?status:null,
    addEventListener:(name,callback)=>listeners[name]=callback
  };
  const fakeSetTimeout=(callback,ms=0)=>{
    if(ms===0)return setTimeout(callback,0);
    const id=++nextTimer;timers.set(id,{callback,ms});return id;
  };
  const fetch=async url=>{
    let result={};
    if(url.includes('userinfo'))result={email:'example@example.test'};
    else if(url.includes('alt=media'))result=dbState;
    else if(url.includes('files?q=')){
      const text=decodeURIComponent(url);
      result=text.includes('mimeType=')?{files:[{id:'folder1',name:'Diagnostika'}]}:
        {files:[{id:'db1',name:'database.json',modifiedTime:'2026-11-11T16:00:00Z'}]};
    }
    return {ok:true,status:200,headers:{get:()=>'application/json'},json:async()=>result,text:async()=>JSON.stringify(result)};
  };
  class Headers{
    constructor(){this.fields=new Map();}
    set(k,v){this.fields.set(k,v);}
  }
  class AbortController{constructor(){this.signal={};}abort(){}}
  const context={window:win,document,localStorage:store,sessionStorage:store,
    setTimeout:fakeSetTimeout,clearTimeout:id=>timers.delete(id),
    setInterval:(callback,ms)=>{intervals.push({callback,ms});return intervals.length;},
    clearInterval(){},setImmediate,fetch,Headers,AbortController,
    indexedDB:undefined,console:{warn(){},error(){}},Date,Intl,Promise,JSON,Object,
    Blob,Map,Set,Math,structuredClone,Worker:function(){}};
  vm.runInNewContext(source,context);
  return {win,document,card,status,storage,callbacks,listeners,intervals,timers,
    get:()=>win.DiagnostikaGoogleDriveSyncStatus.getStatus(),
    async fireScheduled(){
      const first=[...timers.entries()].find(([id,t])=>t.ms>0);
      assert.ok(first,'expected a scheduled sync');
      timers.delete(first[0]);
      await first[1].callback();
      await new Promise(resolve=>setTimeout(resolve,20));
    }
  };
}

test('status beacon appears beside Google Drive connected button',()=>{
  const h=harness();
  assert.ok(h.card.nodes.get('.gdrive-beacon'));
  assert.equal(h.get().state,'pending');
  assert.match(h.card.nodes.get('.gdrive-beacon').innerHTML,/gdrive-beacon-dot/);
  assert.match(h.status.textContent,/автоматического сохранения/);
});

test('three-minute heartbeat and quick sync after successful local write',()=>{
  const h=harness();
  assert.equal(h.intervals.length,1);
  assert.equal(h.intervals[0].ms,180000);
  assert.equal(h.get().pending,true);
  h.callbacks['db:written']({key:'diagnostika-web-v1',source:'client-card-save'});
  assert.equal(h.get().state,'pending');
  assert.ok([...h.timers.values()].some(t=>t.ms>=2500&&t.ms<5000));
});

test('Google-originated writes do not cause sync recursion',()=>{
  const h=harness();
  const timers=h.timers.size;
  h.callbacks['db:written']({key:'diagnostika-web-v1',source:'google-drive-safe-sync'});
  assert.equal(h.timers.size,timers);
});

test('expired Google authorization is red, never green',()=>{
  const h=harness({validToken:false,connected:true});
  assert.equal(h.get().state,'auth');
  assert.equal(h.get().lastConfirmedAt,0);
  assert.equal(h.get().active,false);
  h.callbacks['db:written']({key:'diagnostika-web-v1',source:'client-card-save'});
  assert.equal(h.get().state,'auth');
  assert.equal(h.timers.size,0);
});

test('disconnection clears saved-success indicator',()=>{
  const h=harness();
  h.listeners['diagnostika:google-drive-disconnected']();
  assert.equal(h.get().state,'off');
  assert.equal(h.get().lastConfirmedAt,0);
  assert.equal(h.get().pending,false);
});

test('a verified, unchanged cloud database turns indicator green',async()=>{
  const h=harness();
  await h.fireScheduled();
  assert.equal(h.get().state,'synced');
  assert.ok(h.get().lastConfirmedAt>0);
  assert.equal(h.get().pending,false);
  assert.match(h.status.textContent,/проверена/);
});

test('versioned loader and disconnect event are wired',()=>{
  assert.match(loader,/google-drive-sync-safe\.js\?v=20261111-auto-beacon-1/);
  assert.match(loader,/google-drive-auth-popup-fix\.js\?v=20261111-auto-beacon-1/);
  assert.match(html,/google-drive-lazy-loader\.js\?v=20261111-auto-beacon-1/);
  assert.match(auth,/diagnostika:google-drive-disconnected/);
});
