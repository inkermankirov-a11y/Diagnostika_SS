import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const legacy=fs.readFileSync('core/legacy-event-bridge.js','utf8');
const service=fs.readFileSync('modules/sessions/session-service.js','utf8');
const testData=fs.readFileSync('test-data.js','utf8');
const editor=fs.readFileSync('session-attachments.js','utf8');
const paymentFiles=[
  'session-payment-data-repair.js',
  'session-payment-editor.js',
  'session-payment-ui-sync.js',
  'payment-system.js',
  'session-payment-button-authority.js',
  'payment-consistency-core.js',
  'payment-save-guard.js'
];
const paymentLinkFiles=new Set([
  'session-payment-data-repair.js',
  'session-payment-editor.js',
  'session-payment-ui-sync.js',
  'session-payment-button-authority.js',
  'payment-consistency-core.js'
]);

assert.equal(legacy.includes('diagnostika:sessions-changed'),false,'legacy bridge still observes session DOM changes');
assert.equal(legacy.includes('legacy-session-store'),false,'legacy bridge still emits session lifecycle events');
assert.equal(legacy.includes('sessionSnapshots'),false,'legacy bridge still owns session snapshots');
assert.equal(legacy.includes('resyncSessions'),false,'legacy bridge still exposes session resync');
assert.equal(service.includes('syncLegacySnapshot'),false,'SessionService still coordinates legacy session snapshots');
assert.equal(service.includes('resyncSessions'),false,'SessionService still calls legacy session resync');

assert.equal(/c\.sessions\s*=/.test(testData),false,'test-data still replaces c.sessions directly');
assert.equal(/c\.sessions\.push\s*\(/.test(testData),false,'test-data still pushes sessions directly');
assert.match(testData,/test-data-session-reset/);
assert.match(testData,/test-data-session-create/);
assert.match(testData,/sessionApi\.remove/);
assert.match(testData,/sessionApi\.create/);

assert.equal(editor.includes("dlg.addEventListener('close',()=>{dlg.remove();renderSessions();}"),false,'editor close still fires legacy renderSessions');
assert.match(editor,/dlg\.addEventListener\('close',\(\)=>dlg\.remove\(\)/);

const directRequestAssignment=/(?:\bs|\bsession|\bsessionNow|item\.session)\.requestId\s*=(?!=)/;
for(const path of paymentFiles){
  const src=fs.readFileSync(path,'utf8');
  assert.equal(directRequestAssignment.test(src),false,path+' still mutates session.requestId directly');
  directRequestAssignment.lastIndex=0;
  if(paymentLinkFiles.has(path)){
    assert(src.includes('DiagnostikaSessions')||src.includes('linkSessionRequest'),path+' has no SessionService boundary');
  }
}

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const blankPayment=()=>({mode:'',total:0,payments:[],currency:'RUB',sessionAmount:0,sessionDiscount:0});

async function waitReady(page){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaSessions?.moduleAware===true
    && window.DiagnostikaSessions?.version==='4C'
    && window.DiagnostikaRequests?.moduleAware===true
    && !!window.DiagnostikaClients?.current?.(),null,{timeout:15000});
}

const browser=await chromium.launch({headless:true});

// Phase 1: test-data owns no session storage and emits only SessionService lifecycle events.
{
  const fixture={version:4,clients:[{
    id:'sessions-4c-test-client',
    name:'Новый клиент',
    city:'',
    sessions:[],
    requests:[]
  }]};
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(data=>{
    if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
    if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','sessions-4c-test-client');
    if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
  },fixture);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.goto(base,{waitUntil:'commit',timeout:10000});
  await waitReady(page);

  await page.evaluate(()=>{
    window.__sessions4cEvents=[];
    for(const type of ['session:created','session:updated','session:deleted']){
      window.DiagnostikaPlatform.events.on(type,detail=>window.__sessions4cEvents.push({type,detail:{...detail}}));
    }
  });

  assert.equal(await page.evaluate(()=>!!document.getElementById('testFillBtn')),true,'test-data button missing');
  await page.evaluate(()=>document.getElementById('testFillBtn').click());
  await page.waitForFunction(()=>window.DiagnostikaSessions.list().length===2,null,{timeout:8000});
  await page.waitForTimeout(120);

  let result=await page.evaluate(()=>({
    sessions:window.DiagnostikaSessions.list().map(s=>({id:s.id,requestId:s.requestId,notes:s.notes})),
    requests:window.DiagnostikaRequests.list().map(r=>r.id),
    events:window.__sessions4cEvents
  }));
  assert.equal(result.sessions.length,2);
  assert(result.requests.length>=1);
  assert(result.sessions.every(s=>result.requests.includes(s.requestId)),'test sessions are not linked to created requests');
  assert.equal(result.events.filter(x=>x.type==='session:created').length,2);
  assert.equal(result.events.filter(x=>x.type==='session:created'&&x.detail.source==='test-data-session-create').length,2);
  assert.equal(result.events.some(x=>x.detail.source==='legacy-session-store'),false,'legacy bridge emitted session lifecycle event');

  await page.evaluate(()=>{window.__sessions4cEvents=[];document.getElementById('testFillBtn').click();});
  await page.waitForFunction(()=>window.__sessions4cEvents?.filter(x=>x.type==='session:deleted').length>=2
    && window.__sessions4cEvents?.filter(x=>x.type==='session:created').length>=2,null,{timeout:8000});
  await page.waitForTimeout(120);

  result=await page.evaluate(()=>({
    count:window.DiagnostikaSessions.list().length,
    events:window.__sessions4cEvents
  }));
  assert.equal(result.count,2,'test-data reset did not recreate exactly two sessions');
  assert.equal(result.events.filter(x=>x.type==='session:deleted'&&x.detail.source==='test-data-session-reset').length,2);
  assert.equal(result.events.filter(x=>x.type==='session:created'&&x.detail.source==='test-data-session-create').length,2);
  assert.equal(result.events.some(x=>x.detail.source==='legacy-session-store'),false);

  await page.reload({waitUntil:'commit',timeout:10000});
  await waitReady(page);
  assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.list().length),2,'test-data sessions did not persist after reload');
  assert.deepEqual(errors,[],'test-data phase runtime errors');
  await context.close();
}

// Phase 2: Payment may own payment fields, but root session.requestId must move through SessionService.
{
  const stamp='2026-09-18T12:00:00.000Z';
  const fixture={version:4,clients:[{
    id:'sessions-4c-pay-client',
    name:'Sessions 4C Payment Client',
    city:'Киров',
    currentRequestId:'sessions-4c-r1',
    lastDiagnosisRequestId:'sessions-4c-r1',
    requests:[
      {id:'sessions-4c-r1',title:'Запрос 1',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],payment:{mode:'session',total:0,currency:'RUB',sessionAmount:3000,sessionDiscount:0,payments:[]}},
      {id:'sessions-4c-r2',title:'Запрос 2',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],payment:{mode:'session',total:0,currency:'RUB',sessionAmount:3500,sessionDiscount:0,payments:[]}}
    ],
    sessions:[{
      id:'sessions-4c-pay-session',
      requestId:'',
      date:'2026-09-18',
      createdAt:stamp,
      notes:'',
      payment:{paid:false,amount:0,receiptUrl:'',note:'',requestId:'sessions-4c-r2'}
    }]
  }]};

  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(data=>{
    localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
    localStorage.setItem('diagnostika-last-client-id','sessions-4c-pay-client');
    localStorage.setItem('diagnostika-ui-language','ru');
  },fixture);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.goto(base,{waitUntil:'commit',timeout:10000});
  await waitReady(page);
  await page.waitForFunction(()=>!!window.DiagnostikaSessionPaymentRepair,null,{timeout:10000});

  await page.evaluate(()=>{
    window.__sessions4cPaymentEvents=[];
    window.DiagnostikaPlatform.events.on('session:updated',detail=>window.__sessions4cPaymentEvents.push({...detail}));
    const s=window.DiagnostikaSessions.get('sessions-4c-pay-session');
    s.payment.paid=true;
    s.payment.amount=0;
    window.DiagnostikaSessionPaymentRepair.repairAll();
  });

  await page.waitForFunction(()=>window.DiagnostikaSessions.get('sessions-4c-pay-session')?.requestId==='sessions-4c-r2',null,{timeout:5000});
  await page.waitForTimeout(120);

  const linked=await page.evaluate(()=>({
    requestId:window.DiagnostikaSessions.get('sessions-4c-pay-session')?.requestId,
    activeRequestId:window.DiagnostikaRequests.currentId(),
    amount:Number(window.DiagnostikaSessions.get('sessions-4c-pay-session')?.payment?.amount)||0,
    events:window.__sessions4cPaymentEvents
  }));
  assert.equal(linked.requestId,'sessions-4c-r2');
  assert.equal(linked.activeRequestId,'sessions-4c-r1','payment repair changed active request');
  assert(linked.amount>0,'payment repair did not restore the configured session amount');
  assert(linked.events.some(x=>x.sessionId==='sessions-4c-pay-session'&&x.requestId==='sessions-4c-r2'&&x.source==='session-payment-repair-link'),
    'Payment repair did not link request through SessionService');
  assert.equal(linked.events.some(x=>x.source==='legacy-session-store'),false,'legacy bridge emitted payment-driven session update');

  await page.reload({waitUntil:'commit',timeout:10000});
  await waitReady(page);
  assert.equal(await page.evaluate(()=>window.DiagnostikaSessions.get('sessions-4c-pay-session')?.requestId),'sessions-4c-r2');
  assert.deepEqual(errors,[],'payment-link phase runtime errors');
  await context.close();
}

console.log('SESSION_FINAL_4C_SUCCESS');
await browser.close();
