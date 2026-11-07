import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const serviceSource=fs.readFileSync('modules/export/export-service.js','utf8');
const moduleSource=fs.readFileSync('modules/export/index.js','utf8');
const apiSource=fs.readFileSync('export-api.js','utf8');
const loaderSource=fs.readFileSync('app-loader.js','utf8');

for(const token of ['function safeName(','function dateTime(','function situationText(','function diagnosisTxt(','function stateBackup(']){
  assert(serviceSource.includes(token),'ExportService method missing '+token);
}
assert(serviceSource.includes("services.export=Object.freeze({"),'ExportService export is not frozen');
assert.equal(serviceSource.includes('querySelector('),false,'ExportService knows UI/HTML');
assert.equal(serviceSource.includes('createObjectURL'),false,'ExportService owns browser download');
assert(moduleSource.includes("MODULE_ID='export'"),'Export module registration missing');
assert(apiSource.includes("version:'10D'"),'Export facade version is not 10A');
for(const marker of [
  'modules/export/export-service.js?v=20260919-export10d',
  'modules/export/index.js?v=20260919-export10d',
  'export-api.js?v=20260919-export10d'
])assert(loaderSource.includes(marker),'Export loader missing '+marker);

const fixture={version:4,clients:[{
  id:'export-client',
  name:'Иван / Тест',
  phone:'+7 900 000-00-00',
  email:'test@example.com',
  currentRequestId:'export-r1',
  requests:[{
    id:'export-r1',
    title:'Страх проявляться',
    status:'active',
    situations:[{
      id:'export-sit1',
      name:'Публичное выступление',
      level:8,
      comment:'Сжимается грудь',
      result:'Говорю спокойно',
      beliefs:[{
        id:'b1',text:'Я ошибусь',level:9,comment:'',feelings:[{
          id:'f1',text:'Стыд',level:7,comment:'',deep:[{
            id:'d1',text:'Я недостаточно хорош',level:8,comment:'',instincts:[
              {id:'i1',name:'Замри / спрятаться',level:6,comment:''}
            ]
          }]
        }]
      }]
    }]
  }],
  sessions:[
    {id:'sess1',date:'2026-09-18',requestId:'export-r1',notes:''},
    {id:'sess2',date:'2026-09-19',requestId:'export-r1',notes:''}
  ],
  quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','export-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?export-10a=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaExport?.version==='10D'
  && window.DiagnostikaExport?.moduleAware===true
  && window.DiagnostikaPlatform?.services?.export
  && window.DiagnostikaPlatform?.modules?.get?.('export')?.status==='started',
  null,{timeout:15000});

const result=await page.evaluate(()=>{
  const api=window.DiagnostikaExport;
  const c=window.DiagnostikaClients.current();
  const r=c.requests.find(x=>x.id==='export-r1');
  window.__export10aEvents=[];
  window.DiagnostikaPlatform.events.on('export:generated',detail=>window.__export10aEvents.push({...detail}));

  const txt=api.diagnosisTxt(c,r,{date:'2026-09-19T14:05:00',source:'export-10a-test'});
  const backup=api.stateBackup(window.DiagnostikaPlatform.store.snapshot(),{
    date:'2026-09-19T14:05:00',
    source:'export-10a-backup-test'
  });
  return {
    facadeFrozen:Object.isFrozen(api),
    serviceFrozen:Object.isFrozen(window.DiagnostikaPlatform.services.export),
    module:window.DiagnostikaPlatform.modules.get('export'),
    txt,
    backup,
    events:window.__export10aEvents
  };
});

assert.equal(result.facadeFrozen,true);
assert.equal(result.serviceFrozen,true);
assert.equal(result.module.status,'started');
assert.equal(result.txt.filename,'Иван _ Тест_2026-09-19_14-05_диагностика.txt');
assert.equal(result.txt.mimeType,'text/plain;charset=utf-8');
for(const token of [
  'ПСИХОЛОГИЧЕСКАЯ ДИАГНОСТИКА',
  'КЛИЕНТ: Иван / Тест',
  'ЗАНЯТИЕ №: 2',
  'ОБЩИЙ ЗАПРОС',
  'Страх проявляться',
  'СИТУАЦИЯ 1: Публичное выступление',
  'ПЕРВ. УБЕЖДЕНИЕ 1: Я ошибусь',
  'ВТОР. ЧУВСТВО 1: Стыд',
  'ВТОР. УБЕЖДЕНИЕ 1: Я недостаточно хорош',
  'ИНСТИНКТ 1: Замри / спрятаться',
  'Говорю спокойно'
])assert(result.txt.text.includes(token),'Diagnosis TXT missing '+token);

assert.equal(result.backup.filename,'diagnostika-backup-2026-09-19.json');
const backupJson=JSON.parse(result.backup.text);
assert.equal(backupJson.clients[0].id,'export-client');
assert.equal(backupJson.clients[0].requests[0].id,'export-r1');
assert(result.events.some(x=>x.source==='export-10a-test'),'TXT generated event missing');
assert(result.events.some(x=>x.source==='export-10a-backup-test'),'Backup generated event missing');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('EXPORT_10A_SUCCESS',JSON.stringify({
  module:result.module.status,
  txtBytes:result.txt.text.length,
  backupClients:backupJson.clients.length
}));

await context.close();
await browser.close();
