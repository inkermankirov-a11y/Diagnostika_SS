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
          {id:'f4',text:'Жалость к себе: время проходит, становлюсь старше, ничего не могу с этим сделать, не занимаюсь кожей, не могу найти причину, я старею с каждым годом, кожа становится хуже, я что то себе запрещаю из-за этого, пойти в люди.',level:8,comment:'',deep:[{id:'d1',text:'Не заполнено',level:5,comment:'',instincts:[{id:'i1',name:'Не выбран',level:5,comment:''}]},{id:'d2',text:'Ещё одно длинное вторичное убеждение, чтобы проверить, что вложенные строки тоже не накладываются друг на друга',level:5,comment:'',instincts:[{id:'i2',name:'Не выбран',level:5,comment:''}]}]},
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
const longFeeling=page.locator('#tree .tree-row.feeling').filter({hasText:'Жалость к себе'});
await longFeeling.waitFor({state:'visible',timeout:5000});
await longFeeling.locator('.feeling-child-toggle').click();
await page.locator('#tree .tree-row.deep').first().waitFor({state:'visible',timeout:5000});

const geometry=await page.evaluate(()=>{
  const longRow=[...document.querySelectorAll('#tree .tree-row.feeling')].find(row=>row.textContent.includes('Жалость к себе'));
  const label=longRow?.querySelector('.tree-row-label');
  const r=longRow?.getBoundingClientRect();
  const lr=label?.getBoundingClientRect();
  const cs=label?getComputedStyle(label):null;
  const visible=[...document.querySelectorAll('#tree .tree-row')].filter(el=>getComputedStyle(el).display!=='none');
  const overlaps=[];
  for(let i=0;i<visible.length-1;i++){
    const a=visible[i].getBoundingClientRect();
    const b=visible[i+1].getBoundingClientRect();
    if(a.bottom>b.top+0.5) overlaps.push({
      a:visible[i].textContent.slice(0,60),
      b:visible[i+1].textContent.slice(0,60),
      bottom:a.bottom,
      nextTop:b.top
    });
  }
  return {
    height:r?.height||0,
    labelWidth:lr?.width||0,
    rowWidth:r?.width||0,
    whiteSpace:cs?.whiteSpace||'',
    lineHeight:cs?.lineHeight||'',
    overflow:cs?.overflow||'',
    labelExists:Boolean(label),
    visibleRows:visible.length,
    overlaps
  };
});

assert(geometry.height>45,`Long diagnosis row did not grow: ${JSON.stringify(geometry)}`);
assert.equal(geometry.whiteSpace,'normal',`Long diagnosis row does not wrap normally: ${JSON.stringify(geometry)}`);
assert.equal(geometry.labelExists,true,`Diagnosis tree text is not wrapped in a label span: ${JSON.stringify(geometry)}`);
assert(geometry.labelWidth<geometry.rowWidth,`Diagnosis label did not reserve space for the disclosure control: ${JSON.stringify(geometry)}`);
assert.equal(geometry.overlaps.length,0,`Diagnosis rows overlap: ${JSON.stringify(geometry)}`);

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');

console.log('DIAGNOSIS_TREE_LAYOUT_OK',JSON.stringify(geometry));
await context.close();
await browser.close();
