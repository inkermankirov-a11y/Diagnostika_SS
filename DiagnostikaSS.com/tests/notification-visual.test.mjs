
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const script=fs.readFileSync(new URL('../account-limits.js',import.meta.url),'utf8');
const demo='Администрация ZABVENYE предоставила вам бессрочный доступ по тарифу VIP. Оплата больше не требуется. Благодарим за доверие и желаем продуктивной работы!\nПоследняя строка должна оставаться видимой.';
const items=[{id:'a',title:'Поздравляем! Ваш тариф — VIP',body:demo,created:1795368845,read:false,archived:false},{id:'b',title:'Второе уведомление',body:'Другое непрочитанное сообщение',created:1795368844,read:false,archived:false}];
const unread=()=>items.filter(x=>!x.read&&!x.archived).length;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:544,height:650}});
 await page.route('https://zabvenye.com/**',async r=>{
  const u=new URL(r.request().url()),p=u.pathname;
  if(p==='/')return r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ru"><head><style>button{background:linear-gradient(#fff,#eee)!important;color:#7590a6!important;box-shadow:0 3px 5px #777!important;font-size:10px!important;min-height:30px!important}p{max-height:32px;overflow:hidden}.app-header{height:38px;background:#17304a}.header-title-group{display:flex;align-items:center}.header-title-group h1{margin:0;color:white;font-size:15px}</style></head><body><header class="app-header"><div class="header-title-group"><h1>Психологическая диагностика</h1></div></header><script src="/account-limits.js"></script></body></html>`});
  if(p==='/account-limits.js')return r.fulfill({contentType:'application/javascript',body:script});
  let data={};
  if(p==='/account/api/workspace-status')data={id:'test',role:'specialist',limits:{ai_daily:10,ai_detailed:true},billing:{plan:'VIP'},ai_usage:{total:0},ui_language:'ru',notifications_unread:unread()};
  else if(p==='/account/api/notifications'){const filtered=items.filter(x=>x.archived===(u.searchParams.get('view')==='archive'));data={items:filtered,total:filtered.length,unread:unread()};}
  else if(p.endsWith('/read')){const b=r.request().postDataJSON();for(const x of items)if(x.id===b.id||(b.id==='all'&&!x.archived))x.read=true;data={ok:true,unread:unread()};}
  else if(p.endsWith('/archive')){const b=r.request().postDataJSON();items.find(x=>x.id===b.id).archived=b.archived;data={ok:true,unread:unread()};}
  await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('https://zabvenye.com/');
 await page.locator('#workspaceNotifications').click();
 const panel=page.locator('#workspaceNoticePanel');
 await panel.locator('.wn-card').first().waitFor();
 assert.equal(await panel.locator('.wn-body').first().textContent(),demo);
 const style=await panel.locator('.wn-body').first().evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,clamp:getComputedStyle(e).webkitLineClamp,color:getComputedStyle(e).color,font:getComputedStyle(e).fontSize}));
 assert(style.height>=style.scroll-1,'Text was clipped: '+JSON.stringify(style));
 assert.equal(style.font,'13px');
 assert.equal(style.color,'rgb(38, 59, 82)');
 const active=await panel.getByRole('button',{name:'Входящие'}).evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow}));
 assert.deepEqual(active,{fg:'rgb(255, 255, 255)',bg:'rgb(36, 84, 126)',shadow:'none'});
 assert.equal(await panel.locator('[data-unread=true]').count(),2);
 await panel.getByRole('button',{name:'Прочитать',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelectorAll('#workspaceNoticePanel .wn-card[data-unread=true]').length===1);
 await panel.getByRole('button',{name:'Архивировать',exact:true}).first().click();
 await page.waitForFunction(()=>document.querySelectorAll('#workspaceNoticePanel .wn-card').length===1);
 await panel.getByRole('button',{name:'Архив',exact:true}).click();
 await panel.getByRole('button',{name:'Вернуть',exact:true}).waitFor();
 assert.equal(await panel.locator('.wn-body').textContent(),demo);
 assert.equal(await panel.getByRole('button',{name:'Архив',exact:true}).getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:320,height:568});
 await page.waitForTimeout(100);
 const rect=await panel.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=320&&rect.y+rect.height<=568,'Popover outside viewport');
 await panel.getByRole('button',{name:'Вернуть',exact:true}).click();
 await panel.getByText('Нет уведомлений').waitFor();
 await panel.getByRole('button',{name:'Входящие',exact:true}).click();
 await panel.locator('.wn-card').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('#workspaceNoticePanel .wn-card').length===2);
 assert.equal(await panel.locator('[data-unread=true]').count(),1);
 await panel.getByRole('button',{name:'Прочитать все',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#workspaceNoticePanel .wn-card[data-unread=true]').length===0);
 await page.keyboard.press('Escape');assert.equal(await panel.isVisible(),false);
 console.log('PASS: complete text, contrast despite conflicting global CSS, archive, read status, mobile viewport, Escape');
}finally{await browser.close()}
