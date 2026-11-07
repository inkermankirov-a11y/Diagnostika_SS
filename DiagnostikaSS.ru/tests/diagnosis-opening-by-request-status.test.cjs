'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','diagnosis-api.js'),'utf8');
const navigation=fs.readFileSync(path.join(__dirname,'..','modules/diagnosis/ui/navigation.js'),'utf8');

function setup(requests,options={}){
  const c={id:'client-1',requests:requests.map(r=>({...r})),currentRequestId:options.activeId||null};
  let viewedId=options.viewedId||null;
  let activated=0,viewed=0,rendered=0;
  const previous={hidden:false,disabled:false};
  const remove={hidden:false,disabled:false};
  const subtitle={textContent:''};
  const launch={open:false,showModal(){this.open=true;},close(){this.open=false;},
    querySelector(s){return s==='.diag-launch-sub'?subtitle:s==='#diagPreviousBtn'?previous:s==='#diagDeleteBtn'?remove:null;}};
  const history={open:false,close(){this.open=false;}};
  const document={querySelector(s){return s==='#diagnosisLaunchDialog'?launch:s==='#requestHistoryDialog'?history:null;}};
  const api={
    moduleAware:true,
    list:()=>c.requests,
    active:()=>c.requests.find(r=>String(r.id)===String(c.currentRequestId))||null,
    activeId:()=>c.currentRequestId,
    viewed:()=>c.requests.find(r=>String(r.id)===String(viewedId))||null,
    viewedId:()=>viewedId,
    activate(id){activated++;c.currentRequestId=id;viewedId=id;return true;},
    view(id){viewed++;viewedId=id;return true;}
  };
  const window={DiagnostikaClients:{current:()=>c},DiagnostikaRequests:api,DiagnostikaPlatform:{api:{allowed:()=>true}}};
  const context={window,document,mode:options.mode||'client',situationId:'old-situation',selected:{old:true},
    renderRequests(){rendered++;},renderMode(){rendered++;}};
  vm.runInNewContext(source,context,{filename:'diagnosis-api.js'});
  return {open:()=>window.DiagnostikaDiagnosis.open(),c,context,launch,previous,remove,subtitle,
    metrics:()=>({activated,viewed,rendered})};
}

test('new client sees only New diagnosis, no old-history action',()=>{
  const x=setup([]);assert.equal(x.open(),true);
  assert.equal(x.launch.open,true);assert.equal(x.previous.hidden,true);
  assert.equal(x.remove.hidden,true);assert.equal(x.context.mode,'client');
});

test('all completed requests offer new or previous diagnoses',()=>{
  const x=setup([{id:'old',status:'completed'}],{activeId:'old'});
  assert.equal(x.open(),true);assert.equal(x.launch.open,true);
  assert.equal(x.previous.hidden,false);assert.equal(x.context.mode,'client');
  assert.equal(x.c.requests.length,1);
});

test('unfinished request opens directly without a chooser',()=>{
  const x=setup([{id:'live',status:'active',situations:[{id:'s1'}]}],{activeId:'live',viewedId:'live'});
  assert.equal(x.open(),true);assert.equal(x.launch.open,false);
  assert.equal(x.context.mode,'diagnosis');assert.equal(x.context.situationId,'s1');
  assert.equal(x.c.requests.length,1);
});

test('missing active pointer restores an existing unfinished request',()=>{
  const x=setup([{id:'live',status:'active'}]);
  assert.equal(x.open(),true);assert.equal(x.launch.open,false);
  assert.equal(x.c.currentRequestId,'live');assert.equal(x.metrics().activated,1);
});

test('completed pointer does not hide another active request',()=>{
  const x=setup([{id:'done',status:'completed'},{id:'live',status:'active'}],
    {activeId:'done',viewedId:'done'});
  assert.equal(x.open(),true);assert.equal(x.c.currentRequestId,'live');
  assert.equal(x.c.requests.length,2);assert.equal(x.launch.open,false);
});

test('already open working diagnosis does not reset selection or redraw',()=>{
  const x=setup([{id:'live',status:'active'}],{activeId:'live',viewedId:'live',mode:'diagnosis'});
  assert.equal(x.open(),true);assert.equal(x.context.situationId,'old-situation');
  assert.deepEqual(JSON.parse(JSON.stringify(x.context.selected)),{old:true});
  assert.equal(x.metrics().rendered,0);
});

test('old requests without a status are still in progress',()=>{
  const x=setup([{id:'legacy',situations:[]}]);
  assert.equal(x.open(),true);assert.equal(x.launch.open,false);
  assert.equal(x.c.currentRequestId,'legacy');
});

test('new diagnosis button guards against duplicate unfinished requests',()=>{
  assert.match(navigation,/const unfinished=\(api\.list\(c\)\|\|\[\]\)\.some\(r=>r&&r\.status!=='completed'\)/);
});
