import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const phase=process.env.PAYMENT_PHASE||'settings';
const stamp='2026-09-18T12:00:00.000Z';
const existing=phase==='editdelete'
  ?[{id:'pay-existing',date:'2026-09-18',amount:5000,note:'EXISTING',receiptUrl:''}]
  :[];
const fixture={version:4,clients:[{
  id:'pay-client-1',name:'CORE Payment Client',city:'Киров',sessions:[],
  currentRequestId:'pay-request-1',lastDiagnosisRequestId:'pay-request-1',
  requests:[{id:'pay-request-1',title:'Платёжный запрос',status:'active',createdAt:stamp,updatedAt:stamp,situations:[],payment:{mode:phase==='settings'?'':'parts',total:phase==='settings'?0:12000,currency:'RUB',payments:existing}}]
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

const opened=await page.evaluate(()=>{
  const button=[...document.querySelectorAll('#hdHeroActions button')].find(b=>b.textContent.trim()==='Оплата');
  if(!button)return false;
  button.click();
  return true;
});
assert.equal(opened,true,'Dashboard payment button is missing');
const dlg=page.locator('dialog.payment-dialog:has(#paymentMode)').first();
await dlg.waitFor({state:'visible',timeout:5000});

if(phase==='settings'){
  await dlg.locator('#paymentMode').selectOption('parts');
  await dlg.locator('#paymentTotal').fill('12000');
  await dlg.locator('#paymentTotal').blur();
  await dlg.locator('#paymentCurrency').selectOption('EUR');
  await page.waitForTimeout(50);
  const events=await page.evaluate(()=>window.__paymentRequestEvents);
  const updates=events.filter(x=>x.type==='payment:updated'&&x.detail.requestId==='pay-request-1'&&x.detail.change==='settings');
  assert(updates.length>=3,`Expected settings updates, got ${JSON.stringify(events)}`);
  const saved=await page.evaluate(()=>client()?.requests?.[0]?.payment||null);
  assert.equal(saved?.mode,'parts');
  assert.equal(Number(saved?.total),12000);
  assert.equal(saved?.currency,'EUR');
}

if(phase==='add'){
  await dlg.locator('#paymentAmount').fill('5000');
  await dlg.locator('#paymentNote').fill('CORE EVENT PAYMENT');
  await dlg.locator('#paymentAddBtn').click();
  await page.waitForTimeout(50);
  const payment=await page.evaluate(()=>client()?.requests?.[0]?.payment?.payments?.[0]||null);
  assert(payment?.id,'Added payment has no id');
  const events=await page.evaluate(()=>window.__paymentRequestEvents);
  const added=events.find(x=>x.type==='payment:added'&&x.detail.paymentId===String(payment.id));
  assert(added,`Missing payment:added: ${JSON.stringify(events)}`);
  assert.equal(Number(added.detail.amount),5000);
  assert.equal(Number(payment.amount),5000);
}

if(phase==='editdelete'){
  await dlg.locator('#paymentList .payment-row').first().waitFor({state:'visible',timeout:5000});
  const editedThroughUi=await page.evaluate(()=>{
    const dlg=[...document.querySelectorAll('dialog.payment-dialog')].find(x=>x.querySelector('#paymentMode'));
    const row=dlg?.querySelector('#paymentList .payment-row');
    const amount=row?.querySelector('.pr-amount');
    const saveButton=row?.querySelector('.pr-save');
    if(!amount||!saveButton)return false;
    amount.value='5500';
    amount.dispatchEvent(new Event('input',{bubbles:true}));
    amount.dispatchEvent(new Event('change',{bubbles:true}));
    saveButton.click();
    return true;
  });
  assert.equal(editedThroughUi,true,'Could not invoke payment row save handler');
  await page.waitForTimeout(50);
  let events=await page.evaluate(()=>window.__paymentRequestEvents);
  const edited=events.find(x=>x.type==='payment:updated'&&x.detail.paymentId==='pay-existing'&&x.detail.change==='record');
  assert(edited,`Missing edited payment:updated: ${JSON.stringify(events)}`);
  assert.equal(Number(edited.detail.amount),5500);

  const deletedThroughUi=await page.evaluate(()=>{
    const dlg=[...document.querySelectorAll('dialog.payment-dialog')].find(x=>x.querySelector('#paymentMode'));
    const row=dlg?.querySelector('#paymentList .payment-row');
    const deleteButton=row?.querySelector('.pr-delete');
    if(!deleteButton)return false;
    deleteButton.click();
    return true;
  });
  assert.equal(deletedThroughUi,true,'Could not invoke payment row delete handler');
  await page.waitForTimeout(80);
  events=await page.evaluate(()=>window.__paymentRequestEvents);
  assert(events.some(x=>x.type==='payment:deleted'&&x.detail.paymentId==='pay-existing'),`Missing payment:deleted: ${JSON.stringify(events)}`);
  assert.equal(await page.evaluate(()=>client()?.requests?.[0]?.payment?.payments?.length||0),0);
}

assert.deepEqual(pageErrors,[],'Unexpected runtime errors');
console.log(`PAYMENT_REQUEST_${phase.toUpperCase()}_AUDIT_SUCCESS`,JSON.stringify(await page.evaluate(()=>window.__paymentRequestEvents)));
await context.close();
await browser.close();