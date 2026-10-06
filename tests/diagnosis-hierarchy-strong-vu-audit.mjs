import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const fixture={version:4,clients:[{
  id:'hier-client',name:'Иерархия',currentRequestId:'hier-r1',lastDiagnosisRequestId:'hier-r1',
  requests:[{id:'hier-r1',title:'Запрос',status:'active',situations:[
    {id:'s1',name:'Ситуация 1',level:3,comment:'',result:'',beliefs:[{
      id:'b1',text:'Я некрасивая',level:9,comment:'',feelings:[
        {id:'f1',text:'Злость',level:10,comment:'',deep:[
          {id:'d1',text:'Бессильная',level:8,comment:'',instincts:[{id:'i1',name:'Замри / спрятаться',level:10,comment:''}]},
          {id:'d-empty',text:'',level:5,comment:'',instincts:[{id:'i-hidden',name:'Беги / убежать',level:9,comment:''}]}
        ]},
        {id:'f2',text:'Страх отвержения',level:10,comment:'',deep:[
          {id:'d2',text:'Какая-то не такая',level:5,comment:'',instincts:[{id:'i2',name:'',level:5,comment:''}]}
        ]},
        {id:'f3',text:'Вина перед собой',level:8,comment:'',deep:[]},
        {id:'f-empty',text:'',level:7,comment:'',deep:[{id:'d-hidden',text:'Скрытое',level:9,comment:'',instincts:[]}]}
      ]
    }]},
    {id:'s2',name:'Ситуация 2',level:6,comment:'',result:'',beliefs:[{
      id:'b2',text:'Со мной что-то не так',level:8,comment:'',feelings:[
        {id:'f4',text:'Грусть',level:8,comment:'',deep:[
          {id:'d3',text:'Я бессильная',level:7,comment:'',instincts:[]},
          {id:'d4',text:'Беспомощная',level:10,comment:'',instincts:[]}
        ]}
      ]
    }]}
  ]}],sessions:[],quickNotes:[],questionnaires:[]
}]};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:950}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','hier-client');
  localStorage.setItem('diagnostika-ui-language','ru');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

await page.goto('http://127.0.0.1:8000/index.html?hierarchy-audit=1',{waitUntil:'commit',timeout:10000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready')&&window.DiagnostikaDiagnosis?.moduleAware===true&&window.DiagnostikaFeelingCollapse,null,{timeout:20000});
await page.evaluate(()=>window.DiagnostikaDiagnosis.open());
await page.locator('#tree .tree-row.primary').waitFor({state:'visible',timeout:5000});
await page.waitForFunction(()=>document.querySelector('#strongVuPanel')?.dataset.count!==undefined);

const initial=await page.evaluate(()=>{
  const rows=[...document.querySelectorAll('#tree .tree-row')];
  const by=cls=>rows.filter(r=>r.classList.contains(cls));
  const rect=el=>el?.getBoundingClientRect();
  const deep=by('deep')[0],instinct=by('instinct')[0];
  const style=el=>el?getComputedStyle(el):null;
  return{
    treeText:document.querySelector('#tree')?.innerText||'',
    primary:by('primary').map(r=>({kind:r.querySelector('.tree-row-kind')?.textContent,label:r.querySelector('.tree-row-label')?.textContent,level:r.querySelector('.tree-row-level')?.textContent,bg:style(r)?.backgroundColor})),
    feelings:by('feeling').map(r=>({id:r.dataset.elementId,kind:r.querySelector('.tree-row-kind')?.textContent,label:r.querySelector('.tree-row-label')?.textContent,level:r.querySelector('.tree-row-level')?.textContent,status:!!r.querySelector('.tree-row-status'),display:style(r)?.display})),
    deepCount:by('deep').length,
    instinctCount:by('instinct').length,
    deepDisplay:style(deep)?.display,
    instinctDisplay:style(instinct)?.display,
    deepLeft:rect(deep)?.left||0,
    instinctLeft:rect(instinct)?.left||0,
    groupToggle:!!document.querySelector('.feeling-group-toggle'),
    summary:[...document.querySelectorAll('.strong-vu-row')].map(r=>({text:r.querySelector('.strong-vu-text')?.textContent,level:r.querySelector('.strong-vu-level')?.textContent,count:r.querySelector('.strong-vu-count')?.textContent||'',repeat:r.classList.contains('is-repeat'),bg:style(r)?.backgroundColor}))
  };
});

console.log('HIERARCHY_INITIAL',JSON.stringify(initial));
assert.equal(initial.groupToggle,false,'Legacy secondary-feelings group row still exists');
assert.equal(initial.primary[0].kind,'ПУ');
assert.equal(initial.primary[0].label,'Я некрасивая');
assert.equal(initial.primary[0].level,'9');
assert(initial.primary[0].bg.includes('53, 104, 212'),'PU is not blue');
assert.equal(initial.feelings.length,3,'Empty VCh should not be rendered');
assert(initial.feelings.every(x=>x.kind==='ВЧ'),'VCh label missing');
assert(initial.feelings.every(x=>/^\d+$/.test(x.level)),'VCh level must be a bare number');
assert.equal(initial.feelings.find(x=>x.id==='f3')?.status,true,'Incomplete VCh marker missing');
assert(!initial.treeText.includes('/10'),'Tree still renders /10');
assert(!initial.treeText.includes('Не заполнено'),'Tree still renders empty VU placeholder');
assert(!initial.treeText.includes('Не выбран'),'Tree still renders empty instinct placeholder');
assert(!initial.treeText.includes('Скрытое'),'Child of empty VCh should not be rendered');
assert.equal(initial.deepCount,2,'Only filled VU in current situation should exist in DOM');
assert.equal(initial.instinctCount,1,'Only filled instincts should exist in DOM');
assert.equal(initial.deepDisplay,'none','VU should start collapsed');
assert.equal(initial.instinctDisplay,'none','Instinct should start collapsed');

await page.locator('#tree .tree-row.feeling[data-element-id="f1"] .feeling-child-toggle').click();
await page.waitForFunction(()=>getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d1"]')).display!=='none');
const expanded1=await page.evaluate(()=>({
  d1:getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d1"]')).display,
  i1:getComputedStyle(document.querySelector('#tree .tree-row.instinct[data-element-id="i1"]')).display,
  d2:getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d2"]')).display,
  deepLeft:document.querySelector('#tree .tree-row.deep[data-element-id="d1"]').getBoundingClientRect().left,
  instinctLeft:document.querySelector('#tree .tree-row.instinct[data-element-id="i1"]').getBoundingClientRect().left
}));
assert.notEqual(expanded1.d1,'none');
assert.notEqual(expanded1.i1,'none');
assert.equal(expanded1.d2,'none');
assert(expanded1.instinctLeft>expanded1.deepLeft+20,'Instinct is not visibly indented beyond VU');

await page.locator('#tree .tree-row.feeling[data-element-id="f2"] .feeling-child-toggle').click();
await page.waitForFunction(()=>getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d2"]')).display!=='none');
const accordion=await page.evaluate(()=>({
  d1:getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d1"]')).display,
  d2:getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d2"]')).display
}));
assert.equal(accordion.d1,'none','Previous VCh branch did not collapse');
assert.notEqual(accordion.d2,'none','New VCh branch did not expand');

assert.equal(initial.summary.length,2,'Strong VU summary should contain two normalized groups');
assert.equal(initial.summary[0].text,'Бессильная');
assert.equal(initial.summary[0].level,'8');
assert.equal(initial.summary[0].count,'×2');
assert.equal(initial.summary[0].repeat,true,'Repeated VU is not marked');
assert(initial.summary[0].bg.includes('249, 218, 218'),'Repeated VU is not red');
assert.equal(initial.summary[1].text,'Беспомощная');
assert.equal(initial.summary[1].level,'10');
assert.equal(initial.summary[1].repeat,false);

await page.locator('.strong-vu-row.is-repeat').click();
await page.waitForFunction(()=>window.DiagnostikaPlatform?.shell?.currentSituationId?.()==='s1');
await page.waitForFunction(()=>window.DiagnostikaPlatform?.shell?.currentSelection?.()?.obj?.id==='d1');
await page.waitForFunction(()=>getComputedStyle(document.querySelector('#tree .tree-row.deep[data-element-id="d1"]')).display!=='none');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
assert.deepEqual(serious,[],'Unexpected runtime errors');
console.log('DIAGNOSIS_HIERARCHY_STRONG_VU_OK',JSON.stringify(initial.summary));
await browser.close();
