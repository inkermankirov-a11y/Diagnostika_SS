import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={
  version:4,
  clients:[{
    id:'specialist-client',
    name:'Наталья Полонская',
    city:'Киров',
    age:'52',
    sessions:[],
    requests:[],
    specialistMeta:{currentSpecialist:'Евгений'}
  }],
  calendarEvents:[]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-ui-language','ru');
  localStorage.setItem('diagnostika-last-client-id','specialist-client');
  localStorage.setItem('diagnostika-specialist-name','Евгений');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(
  ()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')
    &&window.DiagnostikaClients?.moduleAware
    &&window.DiagnostikaHomeDashboard,
  null,{timeout:20000}
);

await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('specialist-client'));
await page.waitForSelector('#hdClientSpecialistSlot #clientSpecialistInfo',{state:'visible',timeout:8000});

const layout=await page.evaluate(()=>{
  const slot=document.getElementById('hdClientSpecialistSlot');
  const socials=document.getElementById('hdClientSocials');
  const stack=document.querySelector('.hd-client-photo-stack');
  const summary=document.getElementById('hdSummary');
  const rail=document.querySelector('.hd-client-right-rail');
  const info=document.getElementById('clientSpecialistInfo');
  const rect=el=>{
    const r=el?.getBoundingClientRect();
    return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null;
  };
  return {
    slotParent:slot?.parentElement?.className||'',
    profileContainsSlot:Boolean(document.querySelector('.hd-client-profile')?.contains(slot)),
    stackContainsSlot:Boolean(stack?.contains(slot)),
    railHasSlot:Boolean(rail?.querySelector('#hdClientSpecialistSlot')),
    slot:rect(slot),
    socials:rect(socials),
    stack:rect(stack),
    summary:rect(summary),
    specialistText:info?.innerText||''
  };
});

assert.equal(layout.profileContainsSlot,true,'Current specialist is not inside the client profile');
assert.equal(layout.stackContainsSlot,true,'Current specialist is not anchored under the client photo/social column');
assert(layout.slotParent.includes('hd-client-photo-stack'),'Current specialist direct parent is not the photo/social stack');
assert.equal(layout.railHasSlot,false,'Current specialist is still inside the reminder rail');
assert(layout.specialistText.includes('Текущий специалист'),'Current specialist control is missing');
assert(layout.specialistText.includes('Евгений'),'Current specialist name is missing');
assert(layout.slot&&layout.socials&&layout.stack&&layout.summary,'Required profile geometry is missing');
assert(layout.slot.top>=layout.socials.bottom+8,'Current specialist is not below the VK / MAX / Telegram row');
assert(Math.abs(layout.slot.left-layout.stack.left)<=2,'Current specialist is not aligned with the client photo/social column');
assert(layout.slot.width>=295&&layout.slot.width<=305,'Current specialist width is not the intended 300px');
assert(layout.summary.top>=layout.slot.bottom+16,'Summary cards overlap the current specialist control');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DASHBOARD_SPECIALIST_PLACEMENT_AUDIT_OK');
await context.close();
await browser.close();
