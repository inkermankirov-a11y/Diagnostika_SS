import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,clients:[{
  id:'unsaved-client',name:'Тест сохранения',currentRequestId:'unsaved-r1',lastDiagnosisRequestId:'unsaved-r1',
  requests:[{id:'unsaved-r1',title:'Запрос',status:'active',situations:[{
    id:'unsaved-s1',name:'Ситуация',level:5,comment:'',result:'',beliefs:[{
      id:'b1',text:'Первичное',level:7,comment:'',feelings:[{
        id:'f1',text:'Страх',level:8,comment:'',deep:[
          {id:'d1',text:'Не заполнено',level:5,comment:'',instincts:[]},
          {id:'d2',text:'Второе убеждение',level:6,comment:'',instincts:[]}
        ]
      }]
    }]
  }]}],sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:950}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','unsaved-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

await page.goto('http://127.0.0.1:8000/index.html?unsaved-guard=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')&&window.DiagnostikaDiagnosis?.moduleAware===true&&window.DiagnostikaEditorGuard,null,{timeout:20000});
await page.evaluate(()=>window.DiagnostikaDiagnosis.open());
const feeling=page.locator('#tree .tree-row.feeling').filter({hasText:'Страх'});
await feeling.locator('.feeling-child-toggle').click();

const deepRows=page.locator('#tree .tree-row.deep');
await deepRows.nth(0).click();
await page.locator('#editorText').fill('Я обязательно это сохраню');

await page.evaluate(()=>{
  window.__savePromptCalls=0;
  window.AppDialog.savePrompt=async()=>{window.__savePromptCalls++;return 'save';};
});
await deepRows.nth(1).click();
await page.waitForFunction(()=>document.querySelector('#editorText')?.value==='Второе убеждение');

const saved=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  const r=window.DiagnostikaRequests.get('unsaved-r1',c);
  const d=r.situations[0].beliefs[0].feelings[0].deep.find(x=>x.id==='d1');
  const stored=JSON.parse(localStorage.getItem('diagnostika-web-v1')||'{}');
  const sd=stored.clients?.find(x=>x.id==='unsaved-client')?.requests?.[0]?.situations?.[0]?.beliefs?.[0]?.feelings?.[0]?.deep?.find(x=>x.id==='d1');
  return {calls:window.__savePromptCalls,live:d?.text,stored:sd?.text,dirty:window.DiagnostikaEditorGuard.hasUnsaved()};
});
assert.equal(saved.calls,1,'Save prompt was not shown exactly once');
assert.equal(saved.live,'Я обязательно это сохраню','Live diagnosis value was not saved');
assert.equal(saved.stored,'Я обязательно это сохраню','Persisted diagnosis value was not saved');
assert.equal(saved.dirty,false,'Editor remained dirty after guarded save');

await page.locator('#editorText').fill('ЭТО НЕ СОХРАНЯТЬ');
await page.evaluate(()=>{window.AppDialog.savePrompt=async()=> 'discard';});
await deepRows.nth(0).click();
const discarded=await page.evaluate(()=>{
  const c=window.DiagnostikaClients.current();
  return window.DiagnostikaRequests.get('unsaved-r1',c).situations[0].beliefs[0].feelings[0].deep.find(x=>x.id==='d2')?.text;
});
assert.equal(discarded,'Второе убеждение','Discard changed persisted data');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('DIAGNOSIS_UNSAVED_GUARD_OK',JSON.stringify(saved));
await browser.close();
