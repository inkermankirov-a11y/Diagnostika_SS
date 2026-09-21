import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const startup=fs.readFileSync('app-startup.js','utf8');
const observerGuard=fs.readFileSync('i18n-observer-guard.js','utf8');
const mobileCss=fs.readFileSync('mobile-responsive.css','utf8');
const releaseWorkflow=fs.readFileSync('.github/workflows/release-production-smoke.yml','utf8');

assert(!index.includes('diagnostikaRepairStatus'),'Obsolete repair banner still exists');
assert(!index.includes('<script src="test-data.js'),'Production still loads test-data.js directly');
assert(index.includes('dev-tools-loader.js?v=20260921-hardening19a'),'Dev tools loader missing');
assert(index.includes('id="testFillBtn"')&&index.includes('testFillBtn')&&index.includes(' hidden>ТЕСТ</button>'),'TEST control is not hidden by default');
assert(loader.includes("publishRuntimeGate('unhealthy'"),'Runtime unhealthy gate missing');
assert(loader.includes("publishRuntimeGate('error'"),'Runtime load-error gate missing');
assert(!loader.includes('runtime.onerror=finish'),'Runtime load failure still opens dashboard');
assert(startup.includes('Безопасный запуск остановлен'),'Safe startup failure UI missing');
assert(observerGuard.includes("body:childList+subtree"),'Shared body observer hub missing');
assert(observerGuard.includes('sharedSubscribers'),'Observer sharing stats missing');
assert(mobileCss.includes('@media (max-width: 960px)'),'Tablet hardening CSS missing');
assert(!/push:[\s\S]{0,180}?paths:/m.test(releaseWorkflow),'Production smoke is still path-filtered');
assert(releaseWorkflow.includes('Wait for this commit to reach GitHub Pages'),'Production smoke does not wait for same-SHA deployment');

const fixture={
  version:4,
  clients:[{
    id:'hardening-client',
    name:'Hardening Client',
    city:'Киров',
    sessions:[],
    requests:[],
    quickNotes:[],
    questionnaires:[]
  }],
  pinnedClientIds:[]
};

const browser=await chromium.launch({headless:true});

async function init(context){
  await context.addInitScript(data=>{
    localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
    localStorage.setItem('diagnostika-last-client-id','hardening-client');
    localStorage.setItem('diagnostika-ui-language','ru');
  },fixture);
}

async function verifyViewport(name,viewport){
  const context=await browser.newContext({viewport});
  await init(context);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to fetch'))errors.push(m.text())});

  await page.goto('http://127.0.0.1:8000/index.html?hardening='+name+'-'+Date.now(),{waitUntil:'commit',timeout:10000});
  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaRuntimeGate?.status==='ready',null,{timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaDevTools?.enabled===true,null,{timeout:5000});
  await page.evaluate(()=>window.DiagnostikaDevTools.ready);
  await page.locator('#testFillBtn').waitFor({state:'visible',timeout:5000});

  const state=await page.evaluate(()=>({
    runtimeGate:window.DiagnostikaRuntimeGate?.status||null,
    repairPresent:Boolean(document.getElementById('diagnostikaRepairStatus')),
    devEnabled:window.DiagnostikaDevTools?.enabled===true,
    testVisible:Boolean(document.getElementById('testFillBtn')&&!document.getElementById('testFillBtn').hidden),
    dashboardVisible:Boolean(document.querySelector('.home-dashboard')&&getComputedStyle(document.querySelector('.home-dashboard')).display!=='none'),
    innerWidth:window.innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    observer:window.DiagnostikaObserverGuard?.stats?.()||null
  }));

  assert.equal(state.runtimeGate,'ready',name+' runtime gate not ready');
  assert.equal(state.repairPresent,false,name+' repair banner present');
  assert.equal(state.devEnabled,true,name+' local dev tools disabled');
  assert.equal(state.testVisible,true,name+' local TEST control not available');
  assert.equal(state.dashboardVisible,true,name+' dashboard hidden');
  assert(state.scrollWidth<=state.innerWidth+2,`${name} horizontal overflow: ${state.scrollWidth} > ${state.innerWidth}`);
  assert(state.observer?.sharedSubscribers>=3,`${name} body observers were not shared: ${JSON.stringify(state.observer)}`);
  assert.equal(state.observer?.sharedHubs,1,`${name} expected one shared body observer hub`);

  const more=page.locator('.hd-client-more').first();
  await more.waitFor({state:'visible',timeout:5000});
  await more.click();
  const menu=page.locator('.hd-client-menu');
  await menu.waitFor({state:'visible',timeout:5000});
  const bounds=await menu.boundingBox();
  assert(bounds,name+' client menu missing bounds');
  assert(bounds.x>=-1,name+' menu exceeds left viewport');
  assert(bounds.x+bounds.width<=viewport.width+1,name+' menu exceeds right viewport');
  assert(bounds.y>=-1,name+' menu exceeds top viewport');
  assert(bounds.y+bounds.height<=viewport.height+1,name+' menu exceeds bottom viewport');

  assert.deepEqual(errors,[],name+' browser errors');
  await context.close();
  return state;
}

const desktop=await verifyViewport('desktop',{width:1440,height:1000});
const tablet=await verifyViewport('tablet',{width:820,height:1180});
const mobile=await verifyViewport('mobile',{width:390,height:844});

const failContext=await browser.newContext({viewport:{width:1280,height:900}});
await init(failContext);
const failPage=await failContext.newPage();
await failPage.route('**/core/runtime-contract.js*',route=>route.abort('failed'));
await failPage.goto('http://127.0.0.1:8000/index.html?runtime-fail='+Date.now(),{waitUntil:'commit',timeout:10000});
await failPage.waitForFunction(()=>window.DiagnostikaRuntimeGate?.status==='error',null,{timeout:15000});
await failPage.waitForFunction(()=>document.querySelector('#appStartupStatus h2')?.textContent.includes('Безопасный запуск остановлен'),null,{timeout:5000});

const failedState=await failPage.evaluate(()=>({
  gate:window.DiagnostikaRuntimeGate?.status||null,
  readyClass:document.documentElement.classList.contains('diagnostika-dashboard-ready'),
  dashboardPresent:Boolean(document.querySelector('.home-dashboard')),
  startupHidden:Boolean(document.getElementById('appStartupStatus')?.hidden),
  title:document.querySelector('#appStartupStatus h2')?.textContent||''
}));
assert.equal(failedState.gate,'error');
assert.equal(failedState.readyClass,false,'Runtime failure marked application ready');
assert.equal(failedState.dashboardPresent,false,'Runtime failure still created dashboard');
assert.equal(failedState.startupHidden,false,'Runtime failure hid startup error');
assert(failedState.title.includes('Безопасный запуск остановлен'));

await failContext.close();
await browser.close();

console.log('SITE_HARDENING_19A_SUCCESS',JSON.stringify({
  productionDevIsolation:true,
  repairBannerRemoved:true,
  runtimeFailClosed:true,
  sharedBodyObservers:desktop.observer,
  tabletNoOverflow:tablet.scrollWidth<=tablet.innerWidth+2,
  mobileNoOverflow:mobile.scrollWidth<=mobile.innerWidth+2
}));
