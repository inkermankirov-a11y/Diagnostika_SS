import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[{
  id:'bridge-client',name:'Bridge Client',sessions:[],currentRequestId:'bridge-request',lastDiagnosisRequestId:'bridge-request',
  requests:[{id:'bridge-request',title:'Bridge Request',status:'active',situations:[],payment:{mode:'',total:0,currency:'RUB',payments:[]}}]
}]};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','bridge-client');
},fixture);
const page=await context.newPage();
await page.goto(base);
await page.waitForFunction(()=>window.DiagnostikaPlatform?.status==='ready'&&!!window.DiagnostikaPlatform?.paymentEvents,null,{timeout:20000});
const result=await page.evaluate(()=>{
  const events=[];
  for(const type of ['payment:updated','payment:added','payment:deleted']){
    window.DiagnostikaPlatform.events.on(type,detail=>events.push({type,detail}));
  }
  const c=client();
  const r=c.requests.find(x=>x.id==='bridge-request');
  r.payment.mode='parts';
  r.payment.total=10000;
  save();
  const pay={id:'bridge-payment',date:'2026-09-18',amount:4000,note:'bridge',receiptUrl:''};
  r.payment.payments.push(pay);
  save();
  pay.amount=4500;
  save();
  r.payment.payments=[];
  save();
  return {events,wrapped:!!save.__diagnostikaPaymentEventsWrapped};
});
assert.equal(result.wrapped,true,'Global save() is not wrapped by payment bridge');
assert(result.events.some(x=>x.type==='payment:updated'&&x.detail.change==='settings'),JSON.stringify(result.events));
assert(result.events.some(x=>x.type==='payment:added'&&x.detail.paymentId==='bridge-payment'&&Number(x.detail.amount)===4000),JSON.stringify(result.events));
assert(result.events.some(x=>x.type==='payment:updated'&&x.detail.paymentId==='bridge-payment'&&Number(x.detail.amount)===4500),JSON.stringify(result.events));
assert(result.events.some(x=>x.type==='payment:deleted'&&x.detail.paymentId==='bridge-payment'),JSON.stringify(result.events));
console.log('PAYMENT_EVENT_BRIDGE_SMOKE_SUCCESS',JSON.stringify(result.events));
await context.close();
await browser.close();