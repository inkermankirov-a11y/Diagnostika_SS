import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base=(process.env.PRODUCTION_URL||'https://inkermankirov-a11y.github.io/Diagnostika_SS/').replace(/\/$/,'');
const requireRelease=process.env.REQUIRE_RELEASE_MARKER==='1';

const fixture={version:4,clients:[{
  id:'release16a-client',
  name:'Release 16A Client',
  city:'',
  currentRequestId:'release16a-r1',
  lastDiagnosisRequestId:'release16a-r1',
  requests:[{
    id:'release16a-r1',
    title:'Release baseline',
    status:'active',
    situations:[]
  }],
  sessions:[],
  quickNotes:[],
  questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  if(!localStorage.getItem('diagnostika-web-v1')){
    localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  }
  if(!localStorage.getItem('diagnostika-last-client-id')){
    localStorage.setItem('diagnostika-last-client-id','release16a-client');
  }
  if(!localStorage.getItem('diagnostika-ui-language')){
    localStorage.setItem('diagnostika-ui-language','ru');
  }
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

async function openProduction({waitForRelease=false}={}){
  const deadline=Date.now()+240000;
  let lastRelease=null;

  do{
    const url=base+'/?release-16a='+Date.now();
    await page.goto(url,{waitUntil:'commit',timeout:20000});
    await page.waitForFunction(()=>document.querySelector('meta[name="diagnostika-build"]'),null,{timeout:10000});
    lastRelease=await page.locator('meta[name="diagnostika-release"]').getAttribute('content').catch(()=>null);
    if(!waitForRelease||lastRelease==='v1.0.0')break;
    await page.waitForTimeout(5000);
  }while(Date.now()<deadline);

  if(waitForRelease)assert.equal(lastRelease,'v1.0.0','Production did not publish v1.0.0 release marker');

  await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:30000});
  await page.waitForFunction(()=>window.DiagnostikaRuntime?.version==='15A',null,{timeout:30000});
  await page.waitForFunction(async()=>{
    const report=await window.DiagnostikaRuntime.refresh({source:'release16a-ready',timeoutMs:10000});
    return report?.ready===true;
  },null,{timeout:30000});
}

await openProduction({waitForRelease:requireRelease});

const launch=await page.evaluate(async()=>{
  const report=await window.DiagnostikaRuntime.refresh({source:'release16a-launch'});
  const dashboard=document.querySelector('.home-dashboard');
  return {
    href:location.href,
    release:document.querySelector('meta[name="diagnostika-release"]')?.content||null,
    runtime:report,
    dashboardPresent:Boolean(dashboard),
    dashboardVisible:Boolean(dashboard&&!dashboard.hidden&&getComputedStyle(dashboard).display!=='none'),
    runtimeGate:window.DiagnostikaRuntimeGate?.status||null,
    testButtonPresent:Boolean(document.getElementById('testFillBtn')),
    repairStatusPresent:Boolean(document.getElementById('diagnostikaRepairStatus'))
  };
});

assert.equal(launch.runtime.ready,true,JSON.stringify(launch.runtime.issues));
assert.equal(launch.runtime.version,'15A');
assert.equal(launch.runtime.versions.db,'14D');
assert.equal(launch.runtime.versions.api,'13D');
assert.equal(launch.runtime.role,'specialist');
assert.equal(launch.dashboardPresent,true);
assert.equal(launch.dashboardVisible,true);
assert.equal(launch.runtimeGate,'ready');
assert.equal(launch.testButtonPresent,false,'Production exposed the destructive TEST control');
assert.equal(launch.repairStatusPresent,false,'Production still renders the obsolete repair banner');

const mutated=await page.evaluate(async()=>{
  const clients=window.DiagnostikaClients;
  const requests=window.DiagnostikaRequests;
  const sessions=window.DiagnostikaSessions;
  const payments=window.DiagnostikaPayments;
  const calendar=window.DiagnostikaCalendar;
  const files=window.DiagnostikaFiles;

  const clientUpdated=clients.update(
    'release16a-client',
    {city:'Release City'},
    {source:'release16a-client',render:false}
  );

  const request=requests.create({
    id:'release16a-r2',
    title:'Release user flow',
    situations:[]
  },{
    clientId:'release16a-client',
    source:'release16a-request',
    render:false
  });

  const session=sessions.create({
    id:'release16a-s1',
    requestId:'release16a-r2',
    date:'2026-09-19',
    notes:'Release smoke session'
  },{
    clientId:'release16a-client',
    source:'release16a-session',
    render:false
  });

  const paymentSettings=payments.updateRequest(
    'release16a-r2',
    {mode:'session',currency:'RUB',sessionAmount:8000,sessionDiscount:0,total:8000},
    {clientId:'release16a-client',source:'release16a-payment-settings'}
  );

  const payment=payments.addPayment(
    'release16a-r2',
    {
      id:'release16a-pay1',
      date:'2026-09-19',
      amount:8000,
      note:'Release smoke payment',
      sessionId:'release16a-s1'
    },
    {clientId:'release16a-client',source:'release16a-payment'}
  );

  const event=calendar.create({
    id:'release16a-cal1',
    title:'Release smoke calendar',
    date:'2026-09-20',
    time:'19:00',
    duration:60,
    clientId:'release16a-client',
    requestId:'release16a-r2',
    type:'session',
    note:'Release smoke calendar event'
  },{source:'release16a-calendar'});

  const file=await files.add(
    new Blob(['release 16a file persistence'],{type:'text/plain'}),
    {
      id:'release16a-file1',
      clientId:'release16a-client',
      sessionId:'release16a-s1',
      name:'release-smoke.txt'
    },
    {source:'release16a-file'}
  );

  const fileRead=await files.get('release16a-file1');
  const stored=window.DiagnostikaDB.readState({source:'release16a-before-reload'});
  const c=stored?.clients?.find(x=>x.id==='release16a-client');
  const r=c?.requests?.find(x=>x.id==='release16a-r2');
  const s=c?.sessions?.find(x=>x.id==='release16a-s1');
  const cal=stored?.calendarEvents?.find(x=>x.id==='release16a-cal1');

  return {
    clientUpdated:Boolean(clientUpdated),
    requestId:request?.id||null,
    sessionId:session?.id||null,
    paymentMode:paymentSettings?.mode||null,
    paymentId:payment?.id||null,
    calendarId:event?.id||null,
    fileId:file?.id||null,
    fileText:fileRead?.blob?await fileRead.blob.text():null,
    city:c?.city||null,
    requestTitle:r?.title||null,
    sessionNotes:s?.notes||null,
    paymentAmount:r?.payment?.payments?.find(x=>x.id==='release16a-pay1')?.amount??null,
    calendarTitle:cal?.title||null
  };
});

assert.equal(mutated.clientUpdated,true);
assert.equal(mutated.requestId,'release16a-r2');
assert.equal(mutated.sessionId,'release16a-s1');
assert.equal(mutated.paymentMode,'session');
assert.equal(mutated.paymentId,'release16a-pay1');
assert.equal(mutated.calendarId,'release16a-cal1');
assert.equal(mutated.fileId,'release16a-file1');
assert.equal(mutated.fileText,'release 16a file persistence');
assert.equal(mutated.city,'Release City');
assert.equal(mutated.requestTitle,'Release user flow');
assert.equal(mutated.sessionNotes,'Release smoke session');
assert.equal(Number(mutated.paymentAmount),8000);
assert.equal(mutated.calendarTitle,'Release smoke calendar');

await page.reload({waitUntil:'commit',timeout:20000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:30000});
await page.waitForFunction(()=>window.DiagnostikaRuntime?.version==='15A',null,{timeout:30000});

const restored=await page.evaluate(async()=>{
  const report=await window.DiagnostikaRuntime.refresh({source:'release16a-after-reload'});
  const stored=window.DiagnostikaDB.readState({source:'release16a-after-reload-state'});
  const c=stored?.clients?.find(x=>x.id==='release16a-client');
  const r=c?.requests?.find(x=>x.id==='release16a-r2');
  const s=c?.sessions?.find(x=>x.id==='release16a-s1');
  const cal=stored?.calendarEvents?.find(x=>x.id==='release16a-cal1');
  const file=await window.DiagnostikaFiles.get('release16a-file1');
  return {
    runtimeReady:report.ready,
    issues:[...report.issues],
    city:c?.city||null,
    requestTitle:r?.title||null,
    sessionNotes:s?.notes||null,
    paymentAmount:r?.payment?.payments?.find(x=>x.id==='release16a-pay1')?.amount??null,
    calendarTitle:cal?.title||null,
    fileName:file?.name||null,
    fileText:file?.blob?await file.blob.text():null
  };
});

assert.equal(restored.runtimeReady,true,JSON.stringify(restored.issues));
assert.deepEqual(restored.issues,[]);
assert.equal(restored.city,'Release City');
assert.equal(restored.requestTitle,'Release user flow');
assert.equal(restored.sessionNotes,'Release smoke session');
assert.equal(Number(restored.paymentAmount),8000);
assert.equal(restored.calendarTitle,'Release smoke calendar');
assert.equal(restored.fileName,'release-smoke.txt');
assert.equal(restored.fileText,'release 16a file persistence');

await page.evaluate(async()=>{
  await window.DiagnostikaFiles.remove('release16a-file1',{source:'release16a-cleanup'});
});

const serious=errors.filter(x=>
  !x.includes('Failed to fetch')
  &&!x.includes('ERR_')
  &&!x.includes('favicon')
  &&!x.includes('429 (Too Many Requests)')
);
assert.deepEqual(serious,[],'Unexpected production runtime errors');

console.log('RELEASE_16A_PRODUCTION_SUCCESS',JSON.stringify({
  production:base,
  releaseMarker:launch.release,
  runtime:'15A',
  client:true,
  request:true,
  session:true,
  payment:true,
  calendar:true,
  files:true,
  reloadPersistence:true
}));

await context.close();

async function verifyResponsiveProduction(name, viewport){
  const c=await browser.newContext({viewport});
  await c.addInitScript(data=>{
    localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
    localStorage.setItem('diagnostika-last-client-id','release16a-client');
    localStorage.setItem('diagnostika-ui-language','ru');
  },fixture);
  const p=await c.newPage();
  const pageErrors=[];
  p.on('pageerror',e=>pageErrors.push(e.message));
  await p.goto(base+'/?responsive-'+name+'='+Date.now(),{waitUntil:'commit',timeout:20000});
  await p.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:30000});
  await p.waitForFunction(()=>window.DiagnostikaRuntimeGate?.status==='ready',null,{timeout:30000});

  const layout=await p.evaluate(()=>({
    innerWidth:window.innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    dashboardVisible:Boolean(document.querySelector('.home-dashboard')&&getComputedStyle(document.querySelector('.home-dashboard')).display!=='none'),
    testButtonPresent:Boolean(document.getElementById('testFillBtn')),
    repairStatusPresent:Boolean(document.getElementById('diagnostikaRepairStatus'))
  }));
  assert.equal(layout.dashboardVisible,true,name+' dashboard hidden');
  assert.equal(layout.testButtonPresent,false,name+' exposed TEST control');
  assert.equal(layout.repairStatusPresent,false,name+' repair banner present');
  assert(layout.scrollWidth<=layout.innerWidth+2,`${name} horizontal overflow: ${layout.scrollWidth} > ${layout.innerWidth}`);

  const more=p.locator('.hd-client-more').first();
  await more.waitFor({state:'visible',timeout:5000});
  await more.click();
  const menu=p.locator('.hd-client-menu');
  await menu.waitFor({state:'visible',timeout:5000});
  const bounds=await menu.boundingBox();
  assert(bounds,name+' client menu has no bounds');
  assert(bounds.x>=-1,name+' menu exceeds left edge');
  assert(bounds.x+bounds.width<=viewport.width+1,name+' menu exceeds right edge');
  assert(bounds.y>=-1,name+' menu exceeds top edge');
  assert(bounds.y+bounds.height<=viewport.height+1,name+' menu exceeds bottom edge');
  assert.deepEqual(pageErrors,[],name+' page errors');
  await c.close();
}

await verifyResponsiveProduction('tablet',{width:820,height:1180});
await verifyResponsiveProduction('mobile',{width:390,height:844});
await browser.close();
