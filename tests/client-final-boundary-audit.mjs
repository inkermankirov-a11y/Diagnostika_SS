import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboardSource=fs.readFileSync('home-dashboard.js','utf8');
assert.equal(/\brenderClient\s*=/.test(dashboardSource),false,'home dashboard must not replace renderClient');
for(const eventName of [
  'client:created','client:selected','client:updated','client:deleted','client:restored','client:purged'
]){
  assert.equal(dashboardSource.includes(`'${eventName}'`),true,'dashboard event missing: '+eventName);
}
assert.match(dashboardSource,/events\.on\(type,\(\)=>setTimeout\(refresh,0\)\)/);

const base=process.env.AUDIT_URL||'http://127.0.0.1:8000/index.html';
const fixture={version:4,clients:[
  {id:'client-2d-a',name:'Клиент А',city:'Киров',phone:'+70000000001',sessions:[],requests:[]},
  {id:'client-2d-b',name:'Клиент Б',city:'Москва',phone:'+70000000002',sessions:[],requests:[]}
]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1')) localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  if(!localStorage.getItem('diagnostika-last-client-id')) localStorage.setItem('diagnostika-last-client-id','client-2d-a');
  if(!localStorage.getItem('diagnostika-ui-language')) localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')pageErrors.push(m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto(base,{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaClients?.moduleAware&&window.DiagnostikaHomeDashboard&&window.DiagnostikaPlatform?.events,null,{timeout:15000});
await page.waitForFunction(()=>window.DiagnostikaClients.currentId()==='client-2d-a',null,{timeout:5000});

const originalRenderIdentity=await page.evaluate(()=>String(window.renderClient));

const updated=await page.evaluate(()=>window.DiagnostikaClients.update(
  'client-2d-a',
  {name:'Клиент А обновлён',city:'Пермь'},
  {source:'clients-2d-dashboard-update',render:false}
));
assert.equal(updated?.name,'Клиент А обновлён');
await page.waitForFunction(()=>document.getElementById('hdHeroTitle')?.textContent==='Клиент А обновлён',null,{timeout:5000});
await page.waitForFunction(()=>document.getElementById('hdClientList')?.textContent.includes('Клиент А обновлён'),null,{timeout:5000});

const created=await page.evaluate(()=>window.DiagnostikaClients.create(
  {id:'client-2d-c',name:'Клиент В',city:'Тула',sessions:[],requests:[]},
  {source:'clients-2d-dashboard-create',select:false,render:false}
));
assert.equal(created?.id,'client-2d-c');
await page.waitForFunction(()=>document.getElementById('hdClientList')?.textContent.includes('Клиент В'),null,{timeout:5000});
await page.waitForFunction(()=>document.getElementById('hdClientCount')?.textContent==='Клиентов: 3',null,{timeout:5000});

await page.evaluate(()=>window.DiagnostikaClients.select('client-2d-b',{source:'clients-2d-dashboard-select',render:false}));
await page.waitForFunction(()=>document.getElementById('hdHeroTitle')?.textContent==='Клиент Б',null,{timeout:5000});
await page.waitForFunction(()=>document.querySelector('.hd-client-row.active')?.dataset.id==='client-2d-b',null,{timeout:5000});

const removed=await page.evaluate(()=>window.DiagnostikaClients.remove(
  'client-2d-c',
  {source:'clients-2d-dashboard-delete',render:false}
));
assert.equal(removed?.clientId,'client-2d-c');
await page.waitForFunction(()=>!document.getElementById('hdClientList')?.textContent.includes('Клиент В'),null,{timeout:5000});
await page.waitForFunction(()=>document.getElementById('hdClientCount')?.textContent==='Клиентов: 2',null,{timeout:5000});

const restored=await page.evaluate(()=>window.DiagnostikaClients.restore(
  'client-2d-c',
  {source:'clients-2d-dashboard-restore',render:false}
));
assert.equal(restored?.id,'client-2d-c');
await page.waitForFunction(()=>document.getElementById('hdClientList')?.textContent.includes('Клиент В'),null,{timeout:5000});
await page.waitForFunction(()=>document.getElementById('hdClientCount')?.textContent==='Клиентов: 3',null,{timeout:5000});

const afterRenderIdentity=await page.evaluate(()=>String(window.renderClient));
assert.equal(afterRenderIdentity,originalRenderIdentity,'home dashboard must not replace renderClient at runtime');

const state=await page.evaluate(()=>({
  currentId:window.DiagnostikaClients.currentId(),
  hero:document.getElementById('hdHeroTitle')?.textContent||'',
  count:document.getElementById('hdClientCount')?.textContent||'',
  names:[...document.querySelectorAll('.hd-client-name')].map(x=>x.textContent)
}));
assert.equal(state.currentId,'client-2d-b');
assert.equal(state.hero,'Клиент Б');
assert.equal(state.count,'Клиентов: 3');
assert.deepEqual(state.names.sort(),['Клиент А обновлён','Клиент Б','Клиент В'].sort());

const serious=pageErrors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('CLIENT_FINAL_BOUNDARY_2D_SUCCESS',JSON.stringify(state));
await context.close();
await browser.close();
