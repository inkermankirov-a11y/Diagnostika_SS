import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/payments/payment-service.js','utf8');
const moduleSource=fs.readFileSync('modules/payments/index.js','utf8');
const apiSource=fs.readFileSync('payment-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');

assert.match(serviceSource,/services\.payments=Object\.freeze/);
for(const token of ['function requestPayment(','function sessionPayment(','function updateRequest(','function replaceRequest(','function addPayment(','function updatePayment(','function removePayment(','function updateSession(']){
  assert(serviceSource.includes(token),'PaymentService method missing '+token);
}
for(const forbidden of ['querySelector(','payment-dialog','session-edit-dialog']){
  assert.equal(serviceSource.includes(forbidden),false,'PaymentService must not know UI/HTML: '+forbidden);
}
assert.match(moduleSource,/MODULE_ID='payments'/);
assert.match(apiSource,/moduleAware:true/);
assert.match(apiSource,/version:'5[A-D]'/);
for(const token of [
  'modules/payments/payment-service.js?v=20260918-payment5',
  'modules/payments/index.js?v=20260918-payment5',
  'payment-api.js?v=20260918-payment5'
]){
  assert(loaderSource.includes(token),'Payment 5A loader missing '+token);
}

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'payment-5a-client',
  name:'Payment 5A Client',
  city:'Киров',
  currentRequestId:'payment-5a-r1',
  lastDiagnosisRequestId:'payment-5a-r1',
  requests:[
    {id:'payment-5a-r1',title:'Первый запрос',status:'active',createdAt:'2026-09-18T10:00:00.000Z',updatedAt:'2026-09-18T10:00:00.000Z',situations:[],payment:{mode:'',total:0,currency:'RUB',sessionAmount:0,sessionDiscount:0,payments:[]}},
    {id:'payment-5a-r2',title:'Второй запрос',status:'active',createdAt:'2026-09-18T11:00:00.000Z',updatedAt:'2026-09-18T11:00:00.000Z',situations:[],payment:{mode:'parts',total:10000,currency:'RUB',sessionAmount:0,sessionDiscount:0,payments:[]}}
  ],
  sessions:[
    {id:'payment-5a-s1',requestId:'payment-5a-r1',date:'2026-09-18',createdAt:'2026-09-18T12:00:00.000Z',notes:'',payment:{paid:false,amount:0,receiptUrl:'',note:'',requestId:'payment-5a-r1'}}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','payment-5a-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>{
    const p=window.DiagnostikaPlatform;
    return p?.services?.payments
      && p?.modules?.get?.('payments')?.status==='started'
      && p?.payments===p?.services?.payments
      && window.DiagnostikaPayments?.moduleAware===true
      && /^5[A-D]$/.test(window.DiagnostikaPayments?.version||'')
      && typeof window.DiagnostikaPayments?.open==='function';
  },null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

const architecture=await page.evaluate(()=>({
  module:window.DiagnostikaPlatform.modules.get('payments'),
  sameService:window.DiagnostikaPlatform.payments===window.DiagnostikaPlatform.services.payments,
  version:window.DiagnostikaPayments.version,
  moduleAware:window.DiagnostikaPayments.moduleAware,
  legacyOpen:typeof window.DiagnostikaPayments.open,
  legacyRefresh:typeof window.DiagnostikaPayments.refresh,
  methods:['request','session','updateRequest','replaceRequest','addPayment','updatePayment','removePayment','updateSession']
    .reduce((out,key)=>(out[key]=typeof window.DiagnostikaPayments[key],out),{}),
  scripts:[...document.scripts].map(s=>s.src).filter(Boolean).map(src=>new URL(src).pathname)
}));
assert.equal(architecture.module.status,'started');
assert.deepEqual(architecture.module.roles,['specialist','admin']);
assert.equal(architecture.sameService,true);
assert.match(architecture.version,/^5[A-D]$/);
assert.equal(architecture.moduleAware,true);
assert.equal(architecture.legacyOpen,'function');
assert.equal(architecture.legacyRefresh,'function');
for(const [name,type] of Object.entries(architecture.methods))assert.equal(type,'function',name+' API missing');

const order=name=>architecture.scripts.findIndex(x=>x.endsWith(name));
assert(order('/session-api.js')>=0,'session facade missing');
assert(order('/modules/payments/payment-service.js')>order('/session-api.js'),'PaymentService must load after Session facade');
assert(order('/modules/payments/index.js')>order('/modules/payments/payment-service.js'),'Payments module must load after PaymentService');
assert(order('/payment-api.js')>order('/modules/payments/index.js'),'Payment facade must load after Payments module');
assert(order('/home-dashboard.js')>order('/payment-api.js'),'Dashboard must load after Payment facade');

await page.evaluate(()=>{
  window.__payment5aEvents=[];
  for(const type of ['payment:updated','payment:added','payment:deleted','session-payment:updated']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__payment5aEvents.push({type,detail:{...detail}}));
  }
});

await page.evaluate(()=>{window.__payment5aEvents=[];});
const settings=await page.evaluate(()=>window.DiagnostikaPayments.updateRequest(
  'payment-5a-r1',
  {mode:'parts',total:12000,currency:'EUR'},
  {source:'payment-5a-settings'}
));
assert.equal(settings?.mode,'parts');
assert.equal(settings?.total,12000);
assert.equal(settings?.currency,'EUR');
await page.waitForTimeout(100);
let events=await page.evaluate(()=>window.__payment5aEvents);
assert.equal(events.filter(x=>x.type==='payment:updated').length,1,'settings emitted duplicate payment:updated');
assert.equal(events[0].detail.source,'payment-5a-settings');

await page.evaluate(()=>{window.__payment5aEvents=[];});
const added=await page.evaluate(()=>window.DiagnostikaPayments.addPayment(
  'payment-5a-r1',
  {id:'payment-5a-p1',date:'2026-09-18',amount:5000,note:'Первый платёж'},
  {source:'payment-5a-add'}
));
assert.equal(added?.id,'payment-5a-p1');
assert.equal(added?.amount,5000);
await page.waitForTimeout(100);
events=await page.evaluate(()=>window.__payment5aEvents);
assert.equal(events.filter(x=>x.type==='payment:added').length,1,'add emitted duplicate payment:added');
assert.equal(events[0].detail.source,'payment-5a-add');

await page.evaluate(()=>{window.__payment5aEvents=[];});
const edited=await page.evaluate(()=>window.DiagnostikaPayments.updatePayment(
  'payment-5a-r1',
  'payment-5a-p1',
  {amount:5500,note:'Изменённый платёж'},
  {source:'payment-5a-edit'}
));
assert.equal(edited?.amount,5500);
assert.equal(edited?.note,'Изменённый платёж');
await page.waitForTimeout(100);
events=await page.evaluate(()=>window.__payment5aEvents);
assert.equal(events.filter(x=>x.type==='payment:updated').length,1,'record edit emitted duplicate payment:updated');
assert.equal(events[0].detail.change,'record');
assert.equal(events[0].detail.source,'payment-5a-edit');

await page.evaluate(()=>{window.__payment5aEvents=[];});
const sessionPayment=await page.evaluate(()=>window.DiagnostikaPayments.updateSession(
  'payment-5a-s1',
  {paid:true,amount:7000,requestId:'payment-5a-r1',paidAt:'2026-09-18'},
  {source:'payment-5a-session'}
));
assert.equal(sessionPayment?.paid,true);
assert.equal(sessionPayment?.amount,7000);
await page.waitForTimeout(100);
events=await page.evaluate(()=>window.__payment5aEvents);
assert.equal(events.filter(x=>x.type==='session-payment:updated').length,1,'session update emitted duplicate session-payment:updated');
assert.equal(events[0].detail.source,'payment-5a-session');

await page.evaluate(()=>{window.__payment5aEvents=[];});
const removed=await page.evaluate(()=>window.DiagnostikaPayments.removePayment(
  'payment-5a-r1','payment-5a-p1',{source:'payment-5a-remove'}
));
assert.equal(removed?.id,'payment-5a-p1');
await page.waitForTimeout(100);
events=await page.evaluate(()=>window.__payment5aEvents);
assert.equal(events.filter(x=>x.type==='payment:deleted').length,1,'remove emitted duplicate payment:deleted');
assert.equal(events[0].detail.source,'payment-5a-remove');

const beforeReload=await page.evaluate(()=>({
  request:window.DiagnostikaPayments.request('payment-5a-r1'),
  session:window.DiagnostikaPayments.session('payment-5a-s1'),
  activeRequestId:window.DiagnostikaRequests.currentId()
}));
assert.equal(beforeReload.request.mode,'parts');
assert.equal(beforeReload.request.total,12000);
assert.equal(beforeReload.request.currency,'EUR');
assert.equal(beforeReload.request.payments.length,0);
assert.equal(beforeReload.session.paid,true);
assert.equal(beforeReload.session.amount,7000);
assert.equal(beforeReload.activeRequestId,'payment-5a-r1');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(()=>({
  request:window.DiagnostikaPayments.request('payment-5a-r1'),
  session:window.DiagnostikaPayments.session('payment-5a-s1'),
  module:window.DiagnostikaPlatform.modules.get('payments')?.status,
  sameService:window.DiagnostikaPlatform.payments===window.DiagnostikaPlatform.services.payments,
  activeRequestId:window.DiagnostikaRequests.currentId()
}));
assert.equal(restored.module,'started');
assert.equal(restored.sameService,true);
assert.equal(restored.request.mode,'parts');
assert.equal(restored.request.total,12000);
assert.equal(restored.request.currency,'EUR');
assert.equal(restored.request.payments.length,0);
assert.equal(restored.session.paid,true);
assert.equal(restored.session.amount,7000);
assert.equal(restored.activeRequestId,'payment-5a-r1');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('PAYMENT_MODULE_5A_SUCCESS',JSON.stringify({architecture,beforeReload,restored}));

await context.close();
await browser.close();
