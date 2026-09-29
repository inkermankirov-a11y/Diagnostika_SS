import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const transferSource=fs.readFileSync('client-transfer.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(!transferSource.includes('Первичный специалист'),'Legacy primary specialist label still exists');
assert(transferSource.includes('client-specialist-history-btn'),'Current specialist button missing');
assert(transferSource.includes('clientSpecialistHistoryDialog'),'Specialist history dialog missing');
assert(transferSource.includes('requests:requestsForPeriod(incoming,start,transferredAt)'),'Transfer does not snapshot requests');
assert(index.includes('client-transfer.js?v=20260929-specialists20a'),'Specialist history cache marker missing');

const fixture={
  version:4,
  clients:[{
    id:'specialist20a-client',
    name:'Наталья Полонская',
    city:'Киров',
    age:'52',
    currentRequestId:'r2',
    lastDiagnosisRequestId:'r2',
    requests:[
      {
        id:'r1',
        title:'Тревожность',
        status:'completed',
        createdAt:'2026-07-01T10:00:00.000Z',
        completedAt:'2026-08-10T10:00:00.000Z',
        situations:[]
      },
      {
        id:'r2',
        title:'Трудности с отстаиванием личных границ',
        status:'active',
        createdAt:'2026-08-20T10:00:00.000Z',
        situations:[]
      }
    ],
    sessions:[],
    quickNotes:[],
    questionnaires:[],
    specialistMeta:{
      originalSpecialist:'Анна',
      currentSpecialist:'Евгений',
      firstAssignedAt:'2026-07-01T10:00:00.000Z',
      transferHistory:[
        {from:'Анна',to:'Евгений',at:'2026-08-15T10:00:00.000Z'}
      ]
    }
  }],
  pinnedClientIds:[]
};

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(data=>{
  localStorage.setItem('diagnostika-web-v1',JSON.stringify(data));
  localStorage.setItem('diagnostika-last-client-id','specialist20a-client');
  localStorage.setItem('diagnostika-ui-language','ru');
  localStorage.setItem('diagnostika-specialist-name','Евгений');
},fixture);

const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to fetch'))errors.push(m.text())});

await page.goto('http://127.0.0.1:8000/index.html?specialist20a='+Date.now(),{waitUntil:'commit',timeout:15000});
await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'),null,{timeout:30000});
await page.waitForFunction(()=>window.DiagnostikaClientTransfer?.buildSpecialistPeriods,null,{timeout:10000});
await page.waitForSelector('#clientSpecialistInfo .client-specialist-history-btn',{state:'visible',timeout:10000});

const hero=await page.evaluate(()=>({
  text:document.querySelector('#clientSpecialistInfo')?.innerText||'',
  tag:document.querySelector('#clientSpecialistInfo .client-specialist-history-btn')?.tagName||'',
  buttonText:document.querySelector('#clientSpecialistInfo .client-specialist-history-btn')?.textContent||'',
  width:document.querySelector('#clientSpecialistInfo')?.getBoundingClientRect().width||0,
  bodyText:document.body.innerText
}));

assert(hero.text.includes('Текущий специалист:'),'Current specialist label missing');
assert.equal(hero.tag,'BUTTON','Specialist name is not a button');
assert.equal(hero.buttonText.trim(),'Евгений');
assert(hero.width>=500,`Specialist row is still too narrow: ${hero.width}px`);
assert(!hero.bodyText.includes('Первичный специалист'),'Primary specialist is still visible');

const periods=await page.evaluate(()=>window.DiagnostikaClientTransfer.buildSpecialistPeriods());
assert.equal(periods.length,2,JSON.stringify(periods));
assert.equal(periods[0].specialist,'Анна');
assert.equal(periods[0].current,false);
assert(periods[0].requests.some(x=>x.title==='Тревожность'),JSON.stringify(periods[0]));
assert.equal(periods[1].specialist,'Евгений');
assert.equal(periods[1].current,true);
assert(periods[1].requests.some(x=>x.title==='Трудности с отстаиванием личных границ'),JSON.stringify(periods[1]));

await page.locator('#clientSpecialistInfo .client-specialist-history-btn').click();
const dialog=page.locator('#clientSpecialistHistoryDialog');
await dialog.waitFor({state:'visible',timeout:5000});

const dialogState=await page.evaluate(()=>({
  title:document.querySelector('#clientSpecialistHistoryDialog .csh-title')?.textContent||'',
  specialists:[...document.querySelectorAll('#clientSpecialistHistoryDialog .csh-name')].map(x=>x.textContent),
  requestTexts:[...document.querySelectorAll('#clientSpecialistHistoryDialog .csh-requests li')].map(x=>x.textContent),
  badges:[...document.querySelectorAll('#clientSpecialistHistoryDialog .csh-badge')].map(x=>x.textContent),
  periods:[...document.querySelectorAll('#clientSpecialistHistoryDialog .csh-meta')].map(x=>x.textContent)
}));

assert.equal(dialogState.title,'История специалистов');
assert.deepEqual(dialogState.specialists,['Анна','Евгений']);
assert(dialogState.requestTexts.includes('Тревожность'));
assert(dialogState.requestTexts.includes('Трудности с отстаиванием личных границ'));
assert.deepEqual(dialogState.badges,['Текущий']);
assert(dialogState.periods.every(x=>x.includes('Период:')));

assert.deepEqual(errors,[],'Browser errors: '+JSON.stringify(errors));

console.log('CLIENT_SPECIALIST_HISTORY_20A_SUCCESS',JSON.stringify({
  currentOnly:true,
  nameButton:true,
  historyDialog:true,
  specialistPeriods:periods.length,
  requestHistory:true,
  rowWidth:hero.width
}));

await context.close();
await browser.close();
