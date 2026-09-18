import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexSource=fs.readFileSync('index.html','utf8');
const paymentSystemSource=fs.readFileSync('payment-system.js','utf8');
const enhancementsSource=fs.readFileSync('payment-enhancements.js','utf8');
const sessionFixSource=fs.readFileSync('payment-session-fix.js','utf8');
const consistencySource=fs.readFileSync('payment-consistency-core.js','utf8');
const totalStabilitySource=fs.readFileSync('payment-total-input-stability.js','utf8');

assert.equal(indexSource.includes('payment-observer-scope.js'),false,'Global payment observer shim must be retired');
assert.equal(paymentSystemSource.includes('previousOpenSessionEditor'),false,'Legacy session-payment editor wrapper still exists');
assert.equal(paymentSystemSource.includes("className='session-payment-field'"),false,'Legacy session-payment field injection still exists');
assert.equal(/\bsave\s*\(/.test(consistencySource),false,'Consistency UI must not call global save()');
assert.equal(totalStabilitySource.includes('new MutationObserver'),false,'Static payment total field must not need a body observer');
assert.equal(enhancementsSource.includes("source:'payment-session-price'"),false,'Typing session price must not persist through PaymentService');
assert.equal(sessionFixSource.includes("document.addEventListener('input'"),false,'Session settings fix still autosaves on input');
for(const source of [enhancementsSource,sessionFixSource]){
  assert.equal(source.includes('new MutationObserver(()=>'),false,'Payment observer must filter relevant added nodes');
}

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'payment-5d-client',
  name:'Payment 5D Client',
  currentRequestId:'payment-5d-r1',
  lastDiagnosisRequestId:'payment-5d-r1',
  requests:[{
    id:'payment-5d-r1',
    title:'5D request',
    status:'active',
    createdAt:'2026-09-18T10:00:00.000Z',
    updatedAt:'2026-09-18T10:00:00.000Z',
    situations:[],
    payment:{mode:'session',total:0,currency:'RUB',sessionAmount:7000,sessionDiscount:0,payments:[]}
  }],
  sessions:[{
    id:'payment-5d-s1',
    requestId:'payment-5d-r1',
    date:'2026-09-18',
    createdAt:'2026-09-18T12:00:00.000Z',
    notes:'',
    payment:{paid:false,amount:0,receiptUrl:'',note:'',requestId:'payment-5d-r1'}
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','payment-5d-client');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaPayments?.version==='5D'
  && typeof window.DiagnostikaPayments?.open==='function'
  && typeof window.DiagnostikaPayments?.updateRequest==='function',
  null,{timeout:15000});

const scripts=await page.evaluate(()=>[...document.scripts].map(s=>s.src).filter(Boolean));
assert.equal(scripts.some(src=>src.includes('payment-observer-scope.js')),false,'Observer shim loaded at runtime');

await page.evaluate(()=>{
  window.__payment5dUpdateCalls=[];
  const api=window.DiagnostikaPayments;
  const original=api.updateRequest.bind(api);
  api.updateRequest=function(...args){
    const options=args[args.length-1];
    window.__payment5dUpdateCalls.push({source:options?.source||'',changes:{...(args[1]||{})}});
    return original(...args);
  };
  api.open();
});

const dialog=page.locator('dialog.payment-dialog:has(#paymentMode)').first();
await dialog.waitFor({state:'visible',timeout:5000});
if((await dialog.locator('#paymentMode').inputValue())!=='session'){
  await dialog.locator('#paymentMode').selectOption('session');
}
await page.locator('#sessionBasePrice').waitFor({state:'visible',timeout:5000});
await page.locator('#paymentSaveSettings').waitFor({state:'visible',timeout:5000});

await page.evaluate(()=>{window.__payment5dUpdateCalls=[];});
await page.locator('#sessionBasePrice').fill('9000');
await page.locator('#sessionDiscount').fill('10');
await page.waitForTimeout(120);

let before=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5d-client');
  const r=c.requests.find(x=>x.id==='payment-5d-r1');
  return {
    amount:Number(r.payment.sessionAmount)||0,
    discount:Number(r.payment.sessionDiscount)||0,
    calls:window.__payment5dUpdateCalls||[],
    preview:document.querySelector('#sessionFinalPrice')?.textContent||''
  };
});
assert.equal(before.amount,7000,'Typing session amount persisted before explicit save');
assert.equal(before.discount,0,'Typing session discount persisted before explicit save');
assert.equal(before.calls.filter(x=>x.source==='payment-session-settings').length,0,'Explicit-save writer fired while typing');
assert(before.preview.includes('8')||before.preview.includes('100'),'Draft preview did not update while typing');

await page.locator('#paymentSaveSettings').click();
await page.waitForTimeout(150);
const after=await page.evaluate(()=>{
  const c=state.clients.find(x=>x.id==='payment-5d-client');
  const r=c.requests.find(x=>x.id==='payment-5d-r1');
  return {
    amount:Number(r.payment.sessionAmount)||0,
    discount:Number(r.payment.sessionDiscount)||0,
    calls:window.__payment5dUpdateCalls||[],
    stored:JSON.parse(localStorage.getItem('diagnostika-web-v1')||'null')
  };
});
assert.equal(after.amount,9000);
assert.equal(after.discount,10);
const saveCalls=after.calls.filter(x=>x.source==='payment-session-settings');
assert.equal(saveCalls.length,1,'Session pricing must persist exactly once per explicit save');
const storedClient=after.stored?.clients?.find(x=>x.id==='payment-5d-client');
const storedRequest=storedClient?.requests?.find(x=>x.id==='payment-5d-r1');
assert.equal(Number(storedRequest?.payment?.sessionAmount)||0,9000);
assert.equal(Number(storedRequest?.payment?.sessionDiscount)||0,10);

await page.evaluate(()=>{
  document.querySelector('dialog.payment-dialog:has(#paymentMode)')?.close();
  const c=state.clients.find(x=>x.id==='payment-5d-client');
  const s=c.sessions.find(x=>x.id==='payment-5d-s1');
  if(typeof selectedSessionId!=='undefined')selectedSessionId=s.id;
  if(typeof openSessionEditor!=='function')throw new Error('openSessionEditor unavailable');
  openSessionEditor(c,s,1);
});
const sessionDialog=page.locator('dialog.session-edit-dialog').last();
await sessionDialog.waitFor({state:'visible',timeout:5000});
await page.waitForTimeout(100);
assert.equal(await sessionDialog.locator('.session-payment-field').count(),0,'Retired legacy session-payment field reappeared');
await sessionDialog.locator('.session-editor-payment-state,.session-payment-toggle-stable').first().waitFor({state:'visible',timeout:5000});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('PAYMENT_MODULE_5D_SUCCESS',JSON.stringify({before,after:{amount:after.amount,discount:after.discount,calls:after.calls}}));

await context.close();
await browser.close();
