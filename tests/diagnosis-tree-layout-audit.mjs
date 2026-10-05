import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,clients:[{
  id:'diag-tree-wrap-client',
  name:'Наталья Полонская',
  currentRequestId:'diag-tree-wrap-r1',
  lastDiagnosisRequestId:'diag-tree-wrap-r1',
  requests:[{
    id:'diag-tree-wrap-r1',
    title:'Длинные строки дерева',
    status:'active',
    situations:[{
      id:'diag-tree-wrap-s1',
      name:'Когда я выхожу погулять',
      level:3,
      comment:'',
      result:'',
      beliefs:[{
        id:'diag-tree-wrap-b1',
        text:'я не красивая',
        level:9,
        comment:'',
        feelings:[
          {id:'f1',text:'Злость',level:10,comment:'',deep:[]},
          {id:'f2',text:'Страх: отвержения других участников процесса',level:10,comment:'',deep:[]},
          {id:'f3',text:'Стыд: перед другими',level:10,comment:'',deep:[]},
          {id:'f4',text:'Жалость к себе: время проходит, становлюсь старше, ничего не могу с этим сделать, не занимаюсь кожей, не могу найти причину, я старею с каждым годом, кожа становится хуже, я что то себе запрещаю из-за этого, пойти в люди.',level:8,comment:'',deep:[]},
          {id:'f5',text:'Чувство долга: должна себе',level:10,comment:'',deep:[]}
        ]
      }]
    }]
  }],
  sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','diag-tree-wrap-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?diag-tree-wrap=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')&&window.DiagnostikaDiagnosis?.moduleAware===true,null,{timeout:20000});
await page.evaluate(()=>window.DiagnostikaDiagnosis.open());
await page.locator('#diagnosisWorkspace').waitFor({state:'visible',timeout:5000});
await page.locator('#tree .tree-row.primary').waitFor({state:'visible',timeout:5000});
await page.locator('#tree .feeling-group-toggle').click();
await page.locator('#tree .tree-row.feeling').filter({hasText:'Жалость к себе'}).waitFor({state:'visible',timeout:5000});

const geometry=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('#tree .tree-row.feeling')];
  const longRow=rows.find(row=>row.textContent.includes('Жалость к себе'));
  const next=longRow?.nextElementSibling?.classList?.contains('tree-row')
    ? longRow.nextElementSibling
    : rows[rows.indexOf(longRow)+1]||null;
  const r=longRow?.getBoundingClientRect();
  const n=next?.getBoundingClientRect();
  const cs=longRow?getComputedStyle(longRow):null;
  return {
    height:r?.height||0,
    bottom:r?.bottom||0,
    nextTop:n?.top||0,
    whiteSpace:cs?.whiteSpace||'',
    lineHeight:cs?.lineHeight||'',
    overflow:cs?.overflow||''
  };
});

assert(geometry.height>45,`Long diagnosis row did not grow: ${JSON.stringify(geometry)}`);
assert.equal(geometry.whiteSpace,'normal',`Long diagnosis row does not wrap normally: ${JSON.stringify(geometry)}`);
assert(geometry.nextTop===0||geometry.bottom<=geometry.nextTop+0.5,`Diagnosis rows overlap: ${JSON.stringify(geometry)}`);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DIAGNOSIS_TREE_LAYOUT_OK',JSON.stringify(geometry));
await context.close();
await browser.close();
