import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/clients/client-service.js','utf8');
const apiSource=fs.readFileSync('client-api.js','utf8');
const dashboardSource=fs.readFileSync('home-dashboard.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');

assert(serviceSource.includes('const PIN_LIMIT = 10'),'Client pin limit is not 10');
for(const token of ['function pinnedIds()', 'function isPinned(', 'function pin(', 'function unpin(']){
  assert(serviceSource.includes(token),'Client service missing '+token);
}
for(const token of ['pinnedIds,','isPinned,','pin,','unpin,']){
  assert(apiSource.includes(token),'Client facade missing '+token);
}
assert(dashboardSource.includes("pinned?'Открепить клиента':'Закрепить клиента'"),'Dashboard pin menu action missing');
assert(dashboardSource.includes('const pinRank=new Map('),'Pinned-first dashboard ordering missing');
assert(loaderSource.includes('client-service.js?v=20260918-clients2b2&db=14b&pin=18a'),'Client service pin cache marker missing');
assert(loaderSource.includes('client-api.js?v=20260918-clients2b2&api=13d&pin=18a'),'Client API pin cache marker missing');
assert(loaderSource.includes('home-dashboard.js?v=20260918-clients2d&pin=18a'),'Dashboard pin cache marker missing');

const clients=Array.from({length:12},(_,i)=>{
  const n=String(i+1).padStart(2,'0');
  return {
    id:'pin-client-'+n,
    name:'Клиент '+n,
    city:i%2?'Москва':'Киров',
    sessions:[],
    requests:[],
    quickNotes:[],
    questionnaires:[]
  };
});
const fixture={version:4,clients};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1'))localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id'))localStorage.setItem('diagnostika-last-client-id','pin-client-12');
  if(!localStorage.getItem('diagnostika-ui-language'))localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function ready(){
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaClients?.moduleAware===true
    && typeof window.DiagnostikaClients.pin==='function'
    && typeof window.DiagnostikaClients.unpin==='function'
    && document.querySelectorAll('.hd-client-row').length===12,
    null,{timeout:15000});
}

await page.goto('http://127.0.0.1:8000/index.html?clients-18a=1',{waitUntil:'commit',timeout:10000});
await ready();

const initial=await page.evaluate(()=>({
  selected:window.DiagnostikaClients.currentId(),
  pinLimit:window.DiagnostikaClients.pinLimit,
  pinned:window.DiagnostikaClients.pinnedIds(),
  order:[...document.querySelectorAll('.hd-client-row')].map(x=>x.dataset.id)
}));
assert.equal(initial.selected,'pin-client-12');
assert.equal(initial.pinLimit,10);
assert.deepEqual(initial.pinned,[]);
assert.equal(initial.order[0],'pin-client-01');

// Pin client 05 from the actual three-dot menu. Opening actions must not select that client.
const row05=page.locator('.hd-client-row[data-id="pin-client-05"]');
await row05.locator('.hd-client-more').click();
const menu=page.locator('.hd-client-menu');
await menu.waitFor({state:'visible',timeout:5000});
assert.equal(await menu.locator('.hd-client-menu-item').textContent(),'📌Закрепить клиента');
await menu.locator('.hd-client-menu-item').click();
await page.waitForFunction(()=>document.querySelector('.hd-client-row')?.dataset.id==='pin-client-05');

const afterMenuPin=await page.evaluate(()=>({
  selected:window.DiagnostikaClients.currentId(),
  pinned:window.DiagnostikaClients.pinnedIds(),
  first:document.querySelector('.hd-client-row')?.dataset.id,
  canonical:window.DiagnostikaDB.readState({source:'clients18a-menu-pin'}).pinnedClientIds
}));
assert.equal(afterMenuPin.selected,'pin-client-12','Opening pin menu changed selected client');
assert.deepEqual(afterMenuPin.pinned,['pin-client-05']);
assert.equal(afterMenuPin.first,'pin-client-05');
assert.deepEqual(afterMenuPin.canonical,['pin-client-05']);

// A newly pinned client becomes first even above an already pinned client.
const pin03=await page.evaluate(()=>window.DiagnostikaClients.pin('pin-client-03',{source:'clients18a-test'}));
assert.equal(pin03.ok,true);
await page.waitForFunction(()=>document.querySelector('.hd-client-row')?.dataset.id==='pin-client-03');

const afterSecondPin=await page.evaluate(()=>({
  pinned:window.DiagnostikaClients.pinnedIds(),
  top:[...document.querySelectorAll('.hd-client-row')].slice(0,2).map(x=>x.dataset.id)
}));
assert.deepEqual(afterSecondPin.pinned,['pin-client-03','pin-client-05']);
assert.deepEqual(afterSecondPin.top,['pin-client-03','pin-client-05']);

// Fill all ten slots.
const fillIds=['pin-client-01','pin-client-02','pin-client-04','pin-client-06','pin-client-07','pin-client-08','pin-client-09','pin-client-10'];
for(const id of fillIds){
  const result=await page.evaluate(value=>window.DiagnostikaClients.pin(value,{source:'clients18a-fill'}),id);
  assert.equal(result.ok,true,id+' failed to pin');
}
const ten=await page.evaluate(()=>window.DiagnostikaClients.pinnedIds());
assert.equal(ten.length,10);
assert.equal(ten[0],'pin-client-10','Latest pin must be first');

// Eleventh pin must be rejected without changing persisted order.
const beforeLimit=await page.evaluate(()=>JSON.stringify(window.DiagnostikaDB.readState({source:'clients18a-before-limit'}).pinnedClientIds));
const rejected=await page.evaluate(()=>window.DiagnostikaClients.pin('pin-client-11',{source:'clients18a-limit'}));
const afterLimit=await page.evaluate(()=>JSON.stringify(window.DiagnostikaDB.readState({source:'clients18a-after-limit'}).pinnedClientIds));
assert.equal(rejected.ok,false);
assert.equal(rejected.reason,'limit');
assert.equal(rejected.limit,10);
assert.equal(afterLimit,beforeLimit,'Rejected 11th pin changed canonical state');

// Unpin from the actual menu.
const firstPinned=ten[0];
const firstRow=page.locator('.hd-client-row').first();
assert.equal(await firstRow.getAttribute('data-id'),firstPinned);
await firstRow.locator('.hd-client-more').click();
await menu.waitFor({state:'visible'});
assert.equal(await menu.locator('.hd-client-menu-item').textContent(),'📌Открепить клиента');
await menu.locator('.hd-client-menu-item').click();
await page.waitForFunction(id=>!window.DiagnostikaClients.isPinned(id),firstPinned,{timeout:5000});

const afterUnpin=await page.evaluate(id=>({
  pinned:window.DiagnostikaClients.pinnedIds(),
  isPinned:window.DiagnostikaClients.isPinned(id),
  canonical:window.DiagnostikaDB.readState({source:'clients18a-unpin'}).pinnedClientIds,
  first:document.querySelector('.hd-client-row')?.dataset.id
}),firstPinned);
assert.equal(afterUnpin.isPinned,false);
assert.equal(afterUnpin.pinned.length,9);
assert.equal(afterUnpin.canonical.length,9);
assert.notEqual(afterUnpin.first,firstPinned);

// Reload must keep pin order and count.
const beforeReload=[...afterUnpin.pinned];
await page.reload({waitUntil:'commit',timeout:10000});
await ready();
const restored=await page.evaluate(()=>({
  pinned:window.DiagnostikaClients.pinnedIds(),
  top:[...document.querySelectorAll('.hd-client-row')].slice(0,9).map(x=>x.dataset.id),
  canonical:window.DiagnostikaDB.readState({source:'clients18a-restored'}).pinnedClientIds
}));
assert.deepEqual(restored.pinned,beforeReload);
assert.deepEqual(restored.top,beforeReload);
assert.deepEqual(restored.canonical,beforeReload);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CLIENTS_18A_PINNING_SUCCESS',JSON.stringify({
  menuPin:true,
  latestPinFirst:true,
  limit:10,
  rejectedEleventh:true,
  menuUnpin:true,
  persistedAcrossReload:true
}));

await context.close();
await browser.close();
