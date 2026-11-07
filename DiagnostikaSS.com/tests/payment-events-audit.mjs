import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const stamp='2026-09-18T12:00:00.000Z';
const fixture={version:4,clients:[{
  id:'pay-client-1',name:'CORE Payment Client',city:'Киров',
  currentRequestId:'pay-request-1',lastDiagnosisRequestId:'pay-request-1',
  requests:[{
    id:'pay-request-1',title:'Платёжный запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],
    payment:{mode:'',total:0,currency:'RUB',sessionAmount:3000,sessionDiscount:0,payments:[]}
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

const watched=['payment:updated','payment:added','payment:deleted','session-payment:updated'];
await page.evaluate(types=>{
  window.__paymentEventAudit=[];
  for(const type of types){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__paymentEventAudit.push({type,detail}));
  }
},watched);

const opened=await page.evaluate(()=>{
  const button=[...document.querySelectorAll('#hdHeroActions button')].find(b=>b.textContent.trim()==='Оплата');
  if(!button)return false;
  button.click();
  return true;
});
assert.equal(opened,true,'Dashboard payment button is missing');
const paymentDialog=page.locator('dialog.payment-dialog:has(#paymentMode)').first();
await paymentDialog.waitFor({state:'visible',timeout:5000});

// Request payment settings -> payment:updated.
await paymentDialog.locator('#paymentMode').selectOption('parts');
await paymentDialog.locator('#paymentTotal').fill('12000');
await paymentDialog.locator('#paymentCurrency').selectOption('EUR');

// Add -> update -> delete a concrete payment record.
await paymentDialog.locator('#paymentAmount').fill('5000');
await paymentDialog.locator('#paymentNote').fill('CORE EVENT PAYMENT');
await paymentDialog.locator('#paymentAddBtn').click();
await page.waitForTimeout(50);
const paymentId=await page.evaluate(()=>client()?.requests?.[0]?.payment?.payments?.[0]?.id||null);
assert(paymentId,'Added payment has no id');

const row=paymentDialog.locator('#paymentList .payment-row').first();
await row.locator('.pr-amount').fill('5500');
await row.locator('.pr-save').click();
await row.locator('.pr-delete').click();
await page.waitForTimeout(50);
assert.equal(await page.evaluate(()=>client()?.requests?.[0]?.payment?.payments?.length||0),0,'Payment was not deleted');

// Switch to per-session mode, close the payment dialog and save a session payment.
await paymentDialog.locator('#paymentMode').selectOption('session');
await page.evaluate(()=>document.querySelector('dialog.payment-dialog:has(#paymentMode)')?.close());
await paymentDialog.waitFor({state:'hidden'});

const sessionOpened=await page.evaluate(()=>{
  const c=typeof client==='function'?client():null;
  const s=c?.sessions?.find(x=>x.id==='pay-session-1');
  if(!c||!s||typeof openSessionEditor!=='function')return false;
  openSessionEditor(c,s,1);
  return true;
});
assert.equal(sessionOpened,true,'Session editor could not be opened');
const sessionDialog=page.locator('dialog.session-edit-dialog').last();
await sessionDialog.waitFor({state:'visible',timeout:5000});
const sessionPayButton=sessionDialog.locator('.session-editor-payment-state');
await sessionPayButton.waitFor({state:'visible',timeout:5000});
await sessionPayButton.click();
await sessionDialog.locator('.session-edit-actions .primary').click();
await page.waitForTimeout(100);

const sessionState=await page.evaluate(()=>{
  const s=client()?.sessions?.find(x=>x.id==='pay-session-1');
  return {paid:s?.payment?.paid===true,amount:Number(s?.payment?.amount)||0};
});
assert.equal(sessionState.paid,true,'Session payment was not saved as paid');
assert(sessionState.amount>0,'Session payment amount was not saved');

const events=await page.evaluate(()=>window.__paymentEventAudit);
const types=events.map(x=>x.type);
for(const type of watched){
  assert(types.includes(type),`Missing CORE payment event: ${type}\n${JSON.stringify(events,null,2)}`);
}

const added=events.find(x=>x.type==='payment:added'&&x.detail.paymentId===paymentId);
const edited=events.find(x=>x.type==='payment:updated'&&x.detail.paymentId===paymentId&&x.detail.change==='record');
const deleted=events.find(x=>x.type==='payment:deleted'&&x.detail.paymentId===paymentId);
const sessionUpdated=events.find(x=>x.type==='session-payment:updated'&&x.detail.sessionId==='pay-session-1'&&x.detail.paid===true);
assert(added,'payment:added has wrong payment id');
assert.equal(Number(added.detail.amount),5000,'payment:added has wrong amount');
assert(edited,'Edited payment did not emit payment:updated');
assert.equal(Number(edited.detail.amount),5500,'payment:updated has wrong edited amount');
assert(deleted,'payment:deleted has wrong payment id');
assert(sessionUpdated,'session-payment:updated has wrong session state');
assert.equal(sessionUpdated.detail.clientId,'pay-client-1');
assert.equal(sessionUpdated.detail.requestId,'pay-request-1');
assert(events.some(x=>x.type==='payment:updated'&&x.detail.requestId==='pay-request-1'&&x.detail.change==='settings'));
assert.deepEqual(pageErrors,[],'Unexpected runtime errors');

console.log('PAYMENT_EVENTS_AUDIT_SUCCESS',JSON.stringify(events));
await context.close();
await browser.close();