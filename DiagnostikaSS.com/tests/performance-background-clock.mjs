import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
for(const [engine,launcher] of Object.entries({chromium,firefox,webkit})){
 const browser=await launcher.launch();
 try{
  const page=await browser.newPage({timezoneId:'UTC'});
  await page.clock.install({time:new Date('2026-11-21T12:34:30Z')});
  await page.setContent('<header class="app-header"><div class="header-buttons"></div></header>');
  await page.evaluate(()=>{
    let hidden=false;
    Object.defineProperty(document,'hidden',{get:()=>hidden,configurable:true});
    window.__setHidden=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
    const timer=window.setTimeout;
    window.__scheduled=[];
    window.setTimeout=function(fn,delay,...args){window.__scheduled.push(delay);return timer(fn,delay,...args);};
  });
  await page.addScriptTag({path:resolve('modules/header/flip-clock.js')});
  const label=()=>page.locator('#headerFlipClockWrap').getAttribute('aria-label');
  assert.match(await label(),/12:34$/);
  await page.clock.runFor(31000);
  assert.match(await label(),/12:35$/);
  assert.equal(await page.locator('[data-unit=minutes]').getAttribute('data-value'),'35');
  const scheduled=await page.evaluate(()=>window.__scheduled.filter(x=>x>=1000));
  assert.equal(scheduled.length,2,'Only one timer per minute boundary');
  assert(scheduled.every(x=>x>28000&&x<=60010),JSON.stringify(scheduled));
  await page.evaluate(()=>window.__setHidden(true));
  await page.clock.runFor(125000);
  assert.match(await label(),/12:35$/,'Hidden clock must not update');
  await page.evaluate(()=>window.__setHidden(false));
  assert.match(await label(),/12:37$/,'Clock must immediately resync on return');
  await page.evaluate(()=>window.DiagnostikaHeaderFlipClock.destroy());
  await page.clock.runFor(60000);
  assert.match(await label(),/12:37$/,'Destroyed clock must remain stopped');
  console.log('BACKGROUND_CLOCK_OK',engine,JSON.stringify(scheduled));
 }finally{await browser.close();}
}
