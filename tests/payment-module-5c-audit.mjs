import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'payment-5c-client',
  name:'Payment 5C Client',
  currentRequestId:'payment-5c-r1',
  lastDiagnosisRequestId:'payment-5c-r1',
  requests:[
    {id:'payment-5c-r1',title:'Session payment request',status:'active',createdAt:'2026-09-18T10:00:00.000Z',updatedAt:'2026-09-18T10:00:00.000Z',situations:[],payment:{mode:'session',total:0,currency:'RUB',sessionAmount:10000,sessionDiscount:10,payments:[]}},
    {id:'payment-5c-r2',title:'Other request',status:'active',createdAt:'2026-09-18T11:00:00.000Z',updatedAt:'2026-09-18T11:00:00.000Z',situations:[],payment:{mode:'session',total:0,currency:'RUB',sessionAmount:8000,sessionDiscount:0,payments:[]}}
  ],
  sessions:[
    {id:'payment-5c-s1',requestId:'payment-5c-r1',date:'2026-09-18',createdAt:'2026-09-18T12:00:00.000Z',notes:'',payment:{paid:false,amount:0,receiptUrl:'',note:'',requestId:'payment-5c-r1'}}
  ]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','payment-5c-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>/^5[C-D]$/.test(window.DiagnostikaPayments?.version||'')
    && typeof window.DiagnostikaPayments?.updateSession==='function'
    && typeof window.DiagnostikaPayments?.replaceSession==='function'
    && window.DiagnostikaSessions?.moduleAware===true,
    null,{timeout:15000});
}

await page.goto(base,{waitUntil:'commit',timeout:10000});
await ready();

await page.evaluate(()=>{
  window.__payment5cEvents=[];
  window.DiagnostikaPlatform.events.on('session-payment:updated',detail=>window.__payment5cEvents.push({...detail}));
});

await page.evaluate(()=>{window.__payment5cEvents=[];});
const updated=await page.evaluate(()=>window.DiagnostikaPayments.updateSession(
  'payment-5c-s1',
  {paid:true,amount:9000,requestId:'payment-5c-r2',paidAt:'2026-09-18'},
  {source:'payment-5c-api-update'}
));
assert.equal(updated?.paid,true);
assert.equal(updated?.amount,9000);
assert.equal(updated?.requestId,'payment-5c-r2');
let state=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5c-client');
  const s=c.sessions.find(x=>x.id==='payment-5c-s1');
  return {rootRequestId:s.requestId,payment:{...s.payment},currentRequestId:c.currentRequestId};
});
assert.equal(state.rootRequestId,'payment-5c-r1','PaymentService must not own root session.requestId');
assert.equal(state.payment.requestId,'payment-5c-r2');
assert.equal(state.currentRequestId,'payment-5c-r1');
let events=await page.evaluate(()=>window.__payment5cEvents);
assert.equal(events.length,1,'updateSession emitted duplicate session-payment event');
assert.equal(events[0].source,'payment-5c-api-update');

await page.evaluate(()=>{window.__payment5cEvents=[];});
const replaced=await page.evaluate(()=>window.DiagnostikaPayments.replaceSession(
  'payment-5c-s1',
  {paid:false,amount:0,receiptUrl:'',note:'',requestId:'payment-5c-r1'},
  {source:'payment-5c-api-replace'}
));
assert.equal(replaced?.paid,false);
state=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5c-client');
  const s=c.sessions.find(x=>x.id==='payment-5c-s1');
  return {rootRequestId:s.requestId,payment:{...s.payment},currentRequestId:c.currentRequestId};
});
assert.equal(state.rootRequestId,'payment-5c-r1','replaceSession changed root session.requestId');
assert.equal(state.payment.requestId,'payment-5c-r1');
assert.equal(state.currentRequestId,'payment-5c-r1');
events=await page.evaluate(()=>window.__payment5cEvents);
assert.equal(events.length,1,'replaceSession emitted duplicate session-payment event');
assert.equal(events[0].source,'payment-5c-api-replace');

await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const persisted=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5c-client');
  const s=c.sessions.find(x=>x.id==='payment-5c-s1');
  return {rootRequestId:s.requestId,payment:{...s.payment},currentRequestId:c.currentRequestId};
});
assert.equal(persisted.rootRequestId,'payment-5c-r1');
assert.equal(persisted.payment.paid,false);
assert.equal(persisted.payment.amount,0);
assert.equal(persisted.payment.requestId,'payment-5c-r1');
assert.equal(persisted.currentRequestId,'payment-5c-r1');

await page.evaluate(()=>{
  window.__payment5cCalls=[];
  const originalApi=window.DiagnostikaPayments;
  const api={...originalApi};
  for(const name of ['updateSession','replaceSession']){
    const original=originalApi[name].bind(originalApi);
    api[name]=function(...args){
      const options=args[args.length-1];
      window.__payment5cCalls.push({name,source:options?.source||''});
      return original(...args);
    };
  }
  window.DiagnostikaPayments=api;
  const c=state.clients.find(x=>x.id==='payment-5c-client');
  const s=c.sessions.find(x=>x.id==='payment-5c-s1');
  if(typeof openSessionEditor!=='function')throw new Error('openSessionEditor unavailable');
  if(typeof selectedSessionId!=='undefined')selectedSessionId=s.id;
  openSessionEditor(c,s,1);
});

const sessionDialog=page.locator('dialog.session-edit-dialog').last();
await sessionDialog.waitFor({state:'visible',timeout:5000});
const toggle=sessionDialog.locator('.session-payment-toggle-stable,.session-editor-payment-state').first();
await toggle.waitFor({state:'visible',timeout:5000});
await toggle.click();
await page.waitForTimeout(150);

state=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5c-client');
  const s=c.sessions.find(x=>x.id==='payment-5c-s1');
  return {rootRequestId:s.requestId,payment:{...s.payment},currentRequestId:c.currentRequestId,calls:window.__payment5cCalls||[]};
});
assert.equal(state.rootRequestId,'payment-5c-r1','UI toggle changed root session.requestId outside Sessions API');
assert.equal(state.payment.paid,true);
assert.equal(state.payment.amount,9000);
assert.equal(state.payment.requestId,'payment-5c-r1');
assert.equal(state.currentRequestId,'payment-5c-r1');
assert(state.calls.some(x=>x.name==='replaceSession'&&['session-payment-authority-toggle','session-payment-editor-toggle'].includes(x.source)),
  'Session payment toggle did not use PaymentService.replaceSession');

await toggle.click();
await page.waitForTimeout(150);
state=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5c-client');
  const s=c.sessions.find(x=>x.id==='payment-5c-s1');
  return {rootRequestId:s.requestId,payment:{...s.payment},currentRequestId:c.currentRequestId};
});
assert.equal(state.rootRequestId,'payment-5c-r1');
assert.equal(state.payment.paid,false);
assert.equal(Object.prototype.hasOwnProperty.call(state.payment,'paidAt'),false,'Unpaid session kept paidAt');
assert.equal(state.currentRequestId,'payment-5c-r1');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('PAYMENT_MODULE_5C_SUCCESS',JSON.stringify({persisted,state}));

await context.close();
await browser.close();
