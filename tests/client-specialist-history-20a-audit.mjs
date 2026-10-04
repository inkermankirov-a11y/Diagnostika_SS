import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const transferSource=fs.readFileSync('modules/clients/ui/transfer.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const appLoader=fs.readFileSync('app-loader.js','utf8');

assert(!transferSource.includes('Первичный специалист'),'Legacy primary specialist label still exists');
assert(transferSource.includes('client-specialist-history-btn'),'Current specialist button missing');
assert(transferSource.includes('clientSpecialistHistoryDialog'),'Specialist history dialog missing');
assert(transferSource.includes('requests:requestsForPeriod(incoming,start,transferredAt)'),'Transfer does not snapshot requests');
assert(index.includes('modules/clients/ui/transfer.js?v=20261003-specialist-right-rail-4'),'Specialist row module/cache marker missing');
assert(appLoader.includes('home-dashboard.css?v=20261004-profile-row-align-1'),'Dashboard profile alignment CSS cache marker missing');

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
await page.waitForFunction(()=>window.DiagnostikaHomeDashboard?.openClient,null,{timeout:10000});
await page.evaluate(()=>window.DiagnostikaHomeDashboard.openClient('specialist20a-client'));
await page.waitForSelector('#hdClientView',{state:'visible',timeout:10000});
await page.waitForSelector('#clientSpecialistInfo .client-specialist-history-btn',{state:'visible',timeout:10000});

const hero=await page.evaluate(()=>{
  const info=document.querySelector('#clientSpecialistInfo');
  const button=info?.querySelector('.client-specialist-history-btn');
  const name=info?.querySelector('.client-specialist-name');
  const slot=document.querySelector('#hdClientSpecialistSlot');
  const reminderSlot=document.querySelector('.hd-reminder-slot');
  const socials=document.querySelector('#hdClientSocials');
  const clientCardButton=document.querySelector('#hdHeroActions .hd-secondary');
  const infoBox=info?.getBoundingClientRect();
  const buttonBox=button?.getBoundingClientRect();
  const nameBox=name?.getBoundingClientRect();
  const slotBox=slot?.getBoundingClientRect();
  const reminderBox=reminderSlot?.getBoundingClientRect();
  const socialsBox=socials?.getBoundingClientRect();
  const clientCardBox=clientCardButton?.getBoundingClientRect();
  return {
    text:info?.innerText||'',
    buttonTag:button?.tagName||'',
    buttonText:button?.textContent||'',
    nameTag:name?.tagName||'',
    nameText:name?.textContent||'',
    width:infoBox?.width||0,
    buttonCenterY:buttonBox?buttonBox.y+buttonBox.height/2:0,
    nameCenterY:nameBox?nameBox.y+nameBox.height/2:0,
    parentId:info?.parentElement?.id||'',
    slotWidth:slotBox?.width||0,
    specialistTop:slotBox?.top||0,
    specialistInfoTop:infoBox?.top||0,
    specialistInfoBottom:infoBox?.bottom||0,
    specialistButtonTop:buttonBox?.top||0,
    specialistButtonBottom:buttonBox?.bottom||0,
    reminderBottom:reminderBox?.bottom||0,
    socialsTop:socialsBox?.top||0,
    clientCardTop:clientCardBox?.top||0,
    bodyText:document.body.innerText
  };
});

assert.equal(hero.buttonTag,'BUTTON','Current specialist label is not a button');
assert.equal(hero.buttonText.trim(),'Текущий специалист');
assert.equal(hero.nameTag,'SPAN','Specialist name should be plain text');
assert.equal(hero.nameText.trim(),'Евгений');
assert(hero.width>=210,`Specialist row is too narrow: ${hero.width}px`);
assert(Math.abs(hero.buttonCenterY-hero.nameCenterY)<=1,`Button/name vertical alignment differs: ${hero.buttonCenterY} vs ${hero.nameCenterY}`);
assert.equal(hero.parentId,'hdClientSpecialistSlot','Specialist row is not inside the dedicated right-side slot');
assert(hero.slotWidth>=210,`Specialist slot is too narrow: ${hero.slotWidth}px`);
assert(hero.specialistTop>=hero.reminderBottom-1,`Specialist overlaps the reserved reminder area: ${hero.specialistTop} < ${hero.reminderBottom}`);
assert(Math.abs(hero.socialsTop-hero.specialistInfoTop)<=1,`Social row is not level with specialist row: ${hero.socialsTop} vs ${hero.specialistInfoTop}`);
assert(Math.abs(hero.clientCardTop-hero.specialistInfoTop)<=1,`Client card button is not level with specialist row: ${hero.clientCardTop} vs ${hero.specialistInfoTop}`);
const specialistTopInset=hero.specialistButtonTop-hero.specialistInfoTop;
const specialistBottomInset=hero.specialistInfoBottom-hero.specialistButtonBottom;
assert(Math.abs(specialistTopInset-specialistBottomInset)<=0.5,`Current specialist button is not vertically centered inside its field: top=${specialistTopInset}, bottom=${specialistBottomInset}`);
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
  labelButton:true,
  namePlainText:true,
  aligned:true,
  historyDialog:true,
  specialistPeriods:periods.length,
  requestHistory:true,
  rowWidth:hero.width
}));

await context.close();
await browser.close();
