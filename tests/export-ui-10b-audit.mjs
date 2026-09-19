import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appSource=fs.readFileSync('app.js','utf8');
const uiSource=fs.readFileSync('export-txt-classic.js','utf8');

assert(uiSource.includes("source:'export-txt-ui'"),'TXT UI ExportService source missing');
assert(uiSource.includes('api.diagnosisTxt(c,r'),'TXT UI does not use ExportService');
assert(uiSource.includes('api.download(payload'),'TXT UI does not use export browser facade');
assert.equal(uiSource.includes("typeof download==='function'"),false,'TXT UI still calls legacy download');
assert(appSource.includes("source:'export-backup-ui'"),'Backup UI ExportService source missing');
assert(appSource.includes('api.stateBackup(snapshot'),'Backup UI does not use ExportService');
assert.equal(appSource.includes("download('diagnostika-backup-"),false,'Backup button still calls legacy download');

const fixture={version:4,clients:[{
  id:'export-ui-client',
  name:'Экспорт Тест',
  phone:'123',
  email:'a@b.c',
  currentRequestId:'export-ui-r1',
  requests:[{
    id:'export-ui-r1',
    title:'Тестовый запрос',
    status:'active',
    situations:[{id:'s1',name:'Ситуация',level:5,comment:'',result:'Результат',beliefs:[]}]
  }],
  sessions:[],
  quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','export-ui-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?export-10b=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:20000});
await page.waitForFunction(()=>window.DiagnostikaExport?.version==='10A',null,{timeout:15000});

const txtDownloadPromise=page.waitForEvent('download');
await page.locator('#exportTxtBtn').click();
const txtDownload=await txtDownloadPromise;
assert(txtDownload.suggestedFilename().endsWith('_диагностика.txt'));
const txtPath=await txtDownload.path();
const txt=fs.readFileSync(txtPath,'utf8');
assert(txt.includes('КЛИЕНТ: Экспорт Тест'));
assert(txt.includes('Тестовый запрос'));
assert(txt.includes('СИТУАЦИЯ 1: Ситуация'));

const jsonDownloadPromise=page.waitForEvent('download');
await page.locator('#saveHistoryBtn').click();
const jsonDownload=await jsonDownloadPromise;
assert(/^diagnostika-backup-\d{4}-\d{2}-\d{2}\.json$/.test(jsonDownload.suggestedFilename()));
const jsonPath=await jsonDownload.path();
const backup=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
assert.equal(backup.clients[0].id,'export-ui-client');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('EXPORT_10B_SUCCESS',JSON.stringify({
  txt:txtDownload.suggestedFilename(),
  backup:jsonDownload.suggestedFilename()
}));

await context.close();
await browser.close();
