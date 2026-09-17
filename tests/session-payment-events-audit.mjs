import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const stamp='2026-09-18T12:00:00.000Z';
const fixture={version:4,clients:[{
  id:'pay-client-1',name:'CORE Payment Client',city:'Киров',
  currentRequestId:'pay-request-1',lastDiagnosisRequestId:'pay-request-1',
  requests:[{
    id:'pay-request-1',title:'Платёжный запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],
    payment:{mode:'session',total:0,currency:'RUB',sessionAmount:3000,sessionDiscount:0,payments:[]}
  }],
  sessions:[{
    id:'pay-session-1',requestId:'pay-request-1',date:'2026-09-18',createdAt:stamp,notes:'',
    payment:{paid:false,amount:3000,receiptUrl:'',note:'',requestId:'pay-request-1'}
  }]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','pay-client-1');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('dialog',d=>d.accept().catch(()=>{}));
await page.goto(base);
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaPlatform?.status==='ready'&&!!window.DiagnostikaPlatform?.paymentEvents,null,{timeout:10000});

await page.evaluate(()=>{
  window.__sessionPaymentEvents=[];
  window.DiagnostikaPlatform.events.on('session-payment:updated',detail=>window.__sessionPaymentEvents.push(detail));
});

const opened=await page.evaluate(()=>{
  const c=typeof client==='function'?client():null;
  const s=c?.sessions?.find(x=>x.id==='pay-session-1');
  if(!c||!s||typeof openSessionEditor!=='function')return false;
  try{selectedSessionId=s.id;}catch(_){}
  openSessionEditor(c,s,1);
  return true;
});
assert.equal(opened,true,'Session editor could not be opened');
const dlg=page.locator('dialog.session-edit-dialog').last();
await dlg.waitFor({state:'visible',timeout:5000});

await page.evaluate(()=>{
  window.DiagnostikaSessionPaymentRepair?.refresh?.();
  window.DiagnostikaSessionPaymentUiSync?.refresh?.();
  window.DiagnostikaSessionPaymentButtonAuthority?.refresh?.();
});
const paymentToggle=dlg.locator('.session-payment-toggle-stable');
await paymentToggle.waitFor({state:'visible',timeout:5000});

await paymentToggle.click();
await page.waitForFunction(()=>{
  const s=client()?.sessions?.find(x=>x.id==='pay-session-1');
  return s?.payment?.paid===true;
},null,{timeout:5000});

let stateNow=await page.evaluate(()=>{
  const s=client()?.sessions?.find(x=>x.id==='pay-session-1');
  return {paid:s?.payment?.paid===true,amount:Number(s?.payment?.amount)||0};
});
assert.equal(stateNow.paid,true,'Authoritative payment toggle did not persist paid state');
assert(stateNow.amount>0,'Session payment amount is zero after toggle');

await dlg.locator('.session-edit-actions .primary').click();
await page.waitForTimeout(120);
stateNow=await page.evaluate(()=>{
  const s=client()?.sessions?.find(x=>x.id==='pay-session-1');
  return {paid:s?.payment?.paid===true,amount:Number(s?.payment?.amount)||0};
});
assert.equal(stateNow.paid,true,'Session save rolled paid state back');
assert(stateNow.amount>0,'Session payment amount is zero after session save');

const events=await page.evaluate(()=>window.__sessionPaymentEvents);
const event=events.find(x=>x.sessionId==='pay-session-1'&&x.paid===true);
assert(event,`Missing session-payment:updated: ${JSON.stringify(events)}`);
assert.equal(event.clientId,'pay-client-1');
assert.equal(event.requestId,'pay-request-1');
assert(Number(event.amount)>0);
assert.deepEqual(pageErrors,[],'Unexpected runtime errors');
console.log('SESSION_PAYMENT_EVENTS_AUDIT_SUCCESS',JSON.stringify(events));
await context.close();
await browser.close();