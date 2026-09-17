import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const stamp='2026-09-18T12:00:00.000Z';
const fixture={version:4,clients:[{
  id:'pay-client-1',name:'CORE Payment Client',city:'Киров',sessions:[],
  currentRequestId:'pay-request-1',lastDiagnosisRequestId:'pay-request-1',
  requests:[{id:'pay-request-1',title:'Платёжный запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],payment:{mode:'',total:0,currency:'RUB',payments:[]}}]
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
  window.__paymentRequestEvents=[];
  for(const type of ['payment:updated','payment:added','payment:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>window.__paymentRequestEvents.push({type,detail}));
  }
});

window;
const opened=await page.evaluate(()=>{
  const button=[...document.querySelectorAll('#hdHeroActions button')].find(b=>b.textContent.trim()==='Оплата');
  if(!button)return false;
  button.click();
  return true;
});
assert.equal(opened,true,'Dashboard payment button is missing');
const dlg=page.locator('dialog.payment-dialog:has(#paymentMode)').first();
await dlg.waitFor({state:'visible',timeout:5000});
await dlg.locator('#paymentMode').selectOption('parts');
await dlg.locator('#paymentTotal').fill('12000');
await dlg.locator('#paymentCurrency').selectOption('EUR');
await dlg.locator('#paymentAmount').fill('5000');
await dlg.locator('#paymentNote').fill('CORE EVENT PAYMENT');
await dlg.locator('#paymentAddBtn').click();
await page.waitForTimeout(50);
const paymentId=await page.evaluate(()=>client()?.requests?.[0]?.payment?.payments?.[0]?.id||null);
assert(paymentId,'Added payment has no id');

const row=dlg.locator('#paymentList .payment-row').first();
await row.locator('.pr-amount').fill('5500');
await row.locator('.pr-save').click();
await row.locator('.pr-delete').click();
await page.waitForTimeout(50);

const events=await page.evaluate(()=>window.__paymentRequestEvents);
assert(events.some(x=>x.type==='payment:updated'&&x.detail.requestId==='pay-request-1'&&x.detail.change==='settings'),`Missing settings update: ${JSON.stringify(events)}`);
const added=events.find(x=>x.type==='payment:added'&&x.detail.paymentId===paymentId);
const edited=events.find(x=>x.type==='payment:updated'&&x.detail.paymentId===paymentId&&x.detail.change==='record');
const deleted=events.find(x=>x.type==='payment:deleted'&&x.detail.paymentId===paymentId);
assert(added,`Missing payment:added: ${JSON.stringify(events)}`);
assert.equal(Number(added.detail.amount),5000);
assert(edited,`Missing record payment:updated: ${JSON.stringify(events)}`);
assert.equal(Number(edited.detail.amount),5500);
assert(deleted,`Missing payment:deleted: ${JSON.stringify(events)}`);
assert.equal(await page.evaluate(()=>client()?.requests?.[0]?.payment?.payments?.length||0),0);
assert.deepEqual(pageErrors,[],'Unexpected runtime errors');
console.log('PAYMENT_REQUEST_EVENTS_AUDIT_SUCCESS',JSON.stringify(events));
await context.close();
await browser.close();