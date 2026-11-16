import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const crashes=[];
page.on('pageerror',error=>crashes.push(error.message));
let slowSearch=false;
await page.route('https://geocoding-api.open-meteo.com/v1/search**',async route=>{
  if(slowSearch)await new Promise(resolve=>setTimeout(resolve,1300));
  await route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({results:[
      {name:'Киров',admin1:'Кировская область',country:'Россия',country_code:'RU'},
      {name:'Киров',admin1:'Калужская область',country:'Россия',country_code:'RU'}
    ]})
  }).catch(()=>{});
});
try{
  await page.goto('http://127.0.0.1:8107/index.html?profile-interactions='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#settingsMenuBtn').waitFor({state:'visible',timeout:25000});
  await page.locator('#settingsMenuBtn').click();
  await page.locator('.settings-accounts-btn').click();
  await page.locator('.settings-account-content.open').waitFor({state:'visible',timeout:12000});
  const surname=page.locator('.account-surname');
  const initial=await surname.inputValue();
  const changed=initial+'-проверка';
  await surname.fill(changed);
  await page.mouse.move(8,200);
  await page.mouse.move(1250,740);
  await page.waitForTimeout(350);
  assert.equal(await surname.inputValue(),changed,'Mouse motion destroyed entered surname');
  assert.equal(await page.locator('.settings-account-content.open').count(),1,'Mouse motion closed account');
  await page.locator('body').click({position:{x:10,y:500}});
  assert.equal(await page.locator('.settings-account-content.open').count(),1,'Outside click unexpectedly closed account');
  await page.evaluate(()=>window.dispatchEvent(new Event('diagnostika-language-changed')));
  await page.waitForTimeout(250);
  assert.equal(await surname.inputValue(),changed,'Language rerender destroyed account draft');

  await page.locator('#settingsMenuBtn').click();
  const modal=page.locator('.app-message-dialog[open]');
  await modal.waitFor({state:'visible',timeout:6000});
  await modal.locator('.app-message-no').click();
  assert.equal(await surname.inputValue(),changed,'Stay action failed to keep draft');
  assert.equal(await page.locator('.settings-account-content.open').count(),1,'Stay action unexpectedly closed account');
  await page.locator('#settingsMenuBtn').click();
  await modal.waitFor({state:'visible',timeout:6000});
  await modal.locator('.app-message-discard').click();
  await page.waitForFunction(()=>!document.querySelector('.settings-wrap')?.classList.contains('open'),null,{timeout:6000});
  await page.locator('#settingsMenuBtn').click();
  await page.locator('.settings-accounts-btn').click();
  assert.equal(await surname.inputValue(),initial,'Discard did not restore last saved profile');

  const city=page.locator('.account-city');
  await city.fill('Киров');
  await page.locator('.account-city-suggestions button').first().waitFor({state:'visible',timeout:7000});
  assert.equal(await page.locator('.account-city-suggestions').isVisible(),true);
  await page.locator('.account-city-suggestions button').first().click();
  assert.match(await city.inputValue(),/Кировская область/,'Selecting a city did not persist its region');
  await page.locator('body').click({position:{x:10,y:500}});
  assert.equal(await page.locator('.settings-account-content.open').count(),1,'Selecting portal option closed profile');
  await page.locator('.account-city-clear').click();
  assert.equal(await city.inputValue(),'','Clear-city button did not clear text');
  assert.equal(await page.locator('.account-currency').isDisabled(),true,'Clear-city button retained currency selection');

  // A response received after explicit closing must never resurrect the menu.
  slowSearch=true;
  await city.fill('Киров');
  await page.waitForTimeout(450);
  await page.locator('#settingsMenuBtn').click();
  await modal.waitFor({state:'visible',timeout:6000});
  await modal.locator('.app-message-discard').click();
  await page.waitForTimeout(1600);
  assert.equal(await page.locator('.account-city-suggestions').isVisible(),false,
    'Late geocoder response displayed a floating popup on the dashboard');
  assert.equal(await page.locator('.settings-wrap').evaluate(el=>el.classList.contains('open')),false);
  assert.deepEqual(crashes,[],'Unexpected JS exceptions');

  console.log('SETTINGS_ACCOUNT_INTERACTIONS_OK',JSON.stringify({
    movedMouseSafe:true,clickOutsideSafe:true,languageDraftSafe:true,
    guardedExit:true,discardRestores:true,cityPickerSafe:true,stalePopupPrevented:true
  }));
}finally{
  await context.close();
  await browser.close();
}
