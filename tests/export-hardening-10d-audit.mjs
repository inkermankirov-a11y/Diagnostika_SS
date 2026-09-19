import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/export/export-service.js','utf8');
const apiSource=fs.readFileSync('export-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

assert(serviceSource.includes("version:'10D'"),'ExportService is not 10D');
assert(apiSource.includes("version:'10D'"),'Export facade is not 10D');
assert(serviceSource.includes("if(Number.isNaN(d.getTime()))d=new Date();"),'ExportService invalid-date hardening missing');
assert.equal(serviceSource.includes('document.'),false,'ExportService still knows DOM');
assert.equal(serviceSource.includes('URL.createObjectURL'),false,'ExportService still owns browser download');
for(const marker of [
  'modules/export/export-service.js?v=20260919-export10d',
  'modules/export/index.js?v=20260919-export10d',
  'export-api.js?v=20260919-export10d'
])assert(loaderSource.includes(marker),'Export 10D loader marker missing '+marker);
for(const marker of [
  '<meta name="diagnostika-build" content="20260919-export10d">',
  'app.js?v=20260919-export10d',
  'export-txt-classic.js?v=20260919-export10d',
  'app-loader.js?v=20260919-export10d'
])assert(indexSource.includes(marker),'Export 10D build marker missing '+marker);

const fixture={version:4,clients:[{
  id:'export-10d-client',
  name:'Export 10D',
  currentRequestId:'export-10d-r1',
  requests:[{id:'export-10d-r1',title:'Hardening request',status:'active',situations:[]}],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','export-10d-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?export-10d=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaExport?.version==='10D'
  && window.DiagnostikaPlatform?.services?.export?.version==='10D'
  && window.DiagnostikaPlatform?.modules?.get?.('export')?.status==='started',
  null,{timeout:15000});

const result=await page.evaluate(()=>{
  const api=window.DiagnostikaExport;
  const service=window.DiagnostikaPlatform.services.export;
  const c=window.DiagnostikaClients.current();
  const r=c.requests[0];

  const txt=api.diagnosisTxt(c,r,{date:'2026-09-19T15:45:00',source:'export-10d-hardening'});
  const backup=api.stateBackup(window.DiagnostikaPlatform.store.snapshot(),{
    date:'2026-09-19T15:45:00',
    filename:'backup?.json',
    source:'export-10d-hardening-backup'
  });

  return {
    facadeFrozen:Object.isFrozen(api),
    serviceFrozen:Object.isFrozen(service),
    eventsFrozen:Object.isFrozen(service.events),
    module:window.DiagnostikaPlatform.modules.get('export'),
    txt,
    backup,
    invalidSafe:service.safeName(' bad:/name. '),
    invalidDate:service.dateTime('not-a-date')
  };
});

assert.equal(result.facadeFrozen,true);
assert.equal(result.serviceFrozen,true);
assert.equal(result.eventsFrozen,true);
assert.equal(result.module.status,'started');
assert(result.txt.filename.includes('2026-09-19_15-45'));
assert.equal(result.backup.filename,'backup?.json');
assert.equal(result.invalidSafe,'bad__name');
assert(/^[0-9]{2}\.[0-9]{2}\.[0-9]{4} [0-9]{2}:[0-9]{2}$/.test(result.invalidDate.display));

const isolated=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const r=c.requests[0];
  const payload=window.DiagnostikaExport.diagnosisTxt(c,r,{date:'2026-09-19T15:46:00'});
  c.name='MUTATED AFTER EXPORT';
  r.title='MUTATED REQUEST';
  return {text:payload.text,filename:payload.filename,frozen:Object.isFrozen(payload)};
});
assert.equal(isolated.frozen,true);
assert.equal(isolated.text.includes('MUTATED AFTER EXPORT'),false);
assert.equal(isolated.text.includes('MUTATED REQUEST'),false);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('EXPORT_10D_SUCCESS',JSON.stringify({
  module:result.module.status,
  frozen:result.facadeFrozen&&result.serviceFrozen,
  isolated:true
}));

await context.close();
await browser.close();
