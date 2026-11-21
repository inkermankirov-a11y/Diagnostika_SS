import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8149/';
const deferred=['about-program.js','calculator-digit-grouping.js','currency-calculator-direct.js'];
for(const [engine,launcher] of Object.entries({chromium,firefox,webkit})){
 const browser=await launcher.launch({headless:true});
 try{
 for(const mobile of (engine==='firefox'?[false]:[false,true])){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,locale:'ru-RU'});
   const page=await context.newPage();const requests=[],errors=[];
   page.on('request',r=>{if(r.url().startsWith(base))requests.push(new URL(r.url()).pathname.split('/').pop());});
   page.on('pageerror',e=>errors.push(e.message));
   // Synthetic quotes only, no real customer data or credentials.
   await page.route('https://api.frankfurter.dev/**',route=>route.fulfill({json:['RUB','EUR','GBP','JPY','CNY'].map((quote,i)=>({base:'USD',quote,rate:[80,.9,.8,150,7][i],date:'2026-11-21'}))}));
   await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.classList.contains('diagnostika-dashboard-ready'));
   await page.waitForFunction(()=>window.DiagnostikaRuntimeGate?.status==='ready');
   for(const name of deferred)assert(!requests.includes(name),'Eager request: '+name);
   await page.locator('#settingsMenuBtn').click();
   await page.locator('#aboutProgramBtn').click();
   await page.locator('.about-program-dialog[open]').waitFor();
   assert((await page.locator('.about-program-license').innerText()).includes('2026'));
   await page.locator('.about-program-close').click();
   assert.equal(requests.filter(n=>n==='about-program.js').length,1);
   await page.evaluate(()=>{const menu=document.querySelector('#settingsMenuBtn');if(menu.getAttribute('aria-expanded')==='true')menu.click();});
   if(mobile)await page.locator('#mobileBottomNav [data-mobile-action="currency"]').click();
   else await page.locator('#headerCurrencyBtn').click();
   await page.locator('.currency-calculator-direct .ccd-screen').waitFor({timeout:25000});
   const box=page.locator('.currency-calculator-direct');
   await box.locator('[data-k="2"]').click();await box.locator('[data-k="+"]').click();await box.locator('[data-k="3"]').click();await box.locator('[data-action="equals"]').click();
   assert.equal(await box.locator('.ccd-screen').inputValue(),'5');
   await box.locator('.ccd-use').click();assert.equal(await page.locator('#utilCurAmount').inputValue(),'5');
   await box.locator('[data-action="clear"]').click();
   for(let i=0;i<13;i++)await box.locator('[data-k="1"]').click();
   assert.equal((await box.locator('.ccd-screen').inputValue()).replace(/\s/g,'').length,12);
   await page.locator('.utility-close').click();
   if(mobile)await page.locator('#mobileBottomNav [data-mobile-action="currency"]').click();else await page.locator('#headerCurrencyBtn').click();
   await page.locator('.currency-calculator-direct .ccd-screen').waitFor();
   for(const name of deferred)assert.equal(requests.filter(n=>n===name).length,1,'Duplicate load: '+name);
   assert.deepEqual(errors,[]);
   console.log('LAZY_UTILITIES_OK',engine,mobile?'mobile':'desktop');
   await context.close();
 }
 }finally{await browser.close();}
}
