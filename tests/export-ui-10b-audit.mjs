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

await page.evaluate(()=>{
  window.__exportUiDownloads=[];
  window.__exportUiOriginalRevoke=URL.revokeObjectURL;
  URL.revokeObjectURL=()=>{};
  const originalClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    window.__exportUiDownloads.push({filename:this.download,href:this.href});
    return originalClick.call(this);
  };
});

await page.evaluate(()=>document.getElementById('exportTxtBtn')?.click());
await page.waitForFunction(()=>window.__exportUiDownloads.length>=1,null,{timeout:5000});
const txtCapture=await page.evaluate(async()=>{
  const item=window.__exportUiDownloads[0];
  return {filename:item.filename,text:await (await fetch(item.href)).text()};
});
assert(txtCapture.filename.endsWith('_диагностика.txt'));
assert(txtCapture.text.includes('КЛИЕНТ: Экспорт Тест'));
assert(txtCapture.text.includes('Тестовый запрос'));
assert(txtCapture.text.includes('СИТУАЦИЯ 1: Ситуация'));

await page.evaluate(()=>document.getElementById('saveHistoryBtn')?.click());
await page.waitForFunction(()=>window.__exportUiDownloads.length>=2,null,{timeout:5000});
const jsonCapture=await page.evaluate(async()=>{
  const item=window.__exportUiDownloads[1];
  return {filename:item.filename,text:await (await fetch(item.href)).text()};
});
assert(/^diagnostika-backup-\d{4}-\d{2}-\d{2}\.json$/.test(jsonCapture.filename));
const backup=JSON.parse(jsonCapture.text);
assert.equal(backup.clients[0].id,'export-ui-client');

await page.evaluate(()=>{
  if(window.__exportUiOriginalRevoke)URL.revokeObjectURL=window.__exportUiOriginalRevoke;
});

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('EXPORT_10B_SUCCESS',JSON.stringify({
  txt:txtCapture.filename,
  backup:jsonCapture.filename
}));

await context.close();
await browser.close();
