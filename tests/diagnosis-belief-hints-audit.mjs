import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('diagnostika-ui-language','ru'));
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.goto('http://127.0.0.1:8000/index.html?belief-hints='+Date.now(),{waitUntil:'commit',timeout:10000});
await page.locator('.home-dashboard').waitFor({state:'visible',timeout:10000});
await page.waitForFunction(()=>!!window.DiagnostikaClients?.current?.());
await page.evaluate(()=>document.getElementById('testFillBtn')?.click());
await page.locator('#diagnosisWorkspace').waitFor({state:'visible',timeout:5000});

assert.equal((await page.locator('#addBeliefBtn').textContent()).trim(),'+ Первичное убеждение');
assert.equal((await page.locator('#addFeelingBtn').textContent()).trim(),'+ Вторичные чувства');
assert.equal((await page.locator('#addDeepBtn').textContent()).trim(),'+ Вторичное убеждение');

const colors=await page.evaluate(()=>Object.fromEntries(
  ['addBeliefBtn','addFeelingBtn','addDeepBtn'].map(id=>{
    const s=getComputedStyle(document.getElementById(id));
    return [id,{backgroundImage:s.backgroundImage,color:s.color,borderColor:s.borderColor}];
  })
));
assert.match(colors.addBeliefBtn.backgroundImage,/rgb\(36, 79, 175\)|rgb\(18, 53, 127\)/,'Primary belief button is not deep blue');
assert.match(colors.addFeelingBtn.backgroundImage,/rgb\(255, 216, 90\)|rgb\(231, 173, 22\)/,'Secondary feelings button is not yellow');
assert.match(colors.addDeepBtn.backgroundImage,/rgb\(139, 99, 216\)|rgb\(101, 61, 179\)/,'Secondary belief button is not purple');

const primary=page.locator('#tree .tree-row.primary').first();
await primary.waitFor({state:'visible',timeout:5000});
await primary.click();
assert.equal((await page.locator('#editorType').textContent()).trim(),'Первичное убеждение');
await page.locator('#beliefInlineHint').waitFor({state:'visible',timeout:3000});
await page.locator('#beliefInlineHint button').click();
await page.locator('.belief-hints-dialog').waitFor({state:'visible',timeout:3000});
assert.equal(await page.locator('.belief-hint-item').count(),61);
assert.equal((await page.locator('.belief-hints-title').textContent()).trim(),'Первичные убеждения');
await page.locator('.belief-hints-search').fill('никому');
const visiblePrimary=page.locator('.belief-hint-item:visible');
assert((await visiblePrimary.count())>0,'Primary hints search returned no results');
await page.locator('.belief-hints-close').click();

await page.locator('#tree .feeling-group-toggle').first().click();
await page.locator('#tree .tree-row.feeling').first().waitFor({state:'visible',timeout:3000});
await page.locator('#tree .tree-row.feeling .feeling-child-toggle').first().click();
const deep=page.locator('#tree .tree-row.deep').first();
await deep.waitFor({state:'visible',timeout:5000});
await deep.click();
assert.equal((await page.locator('#editorType').textContent()).trim(),'Вторичное убеждение');
await page.locator('#deepBeliefInlineHint').waitFor({state:'visible',timeout:3000});
await page.locator('#deepBeliefInlineHint button').click();
await page.locator('.deep-belief-hints-dialog').waitFor({state:'visible',timeout:3000});
assert.equal(await page.locator('.deep-belief-hint-item').count(),42);
assert.equal((await page.locator('.deep-belief-hints-title').textContent()).trim(),'Вторичные убеждения');

const firstHint=page.locator('.deep-belief-hint-item').first();
const hintText=(await firstHint.locator('span').last().textContent()).trim();
await firstHint.click();
assert.equal((await page.locator('#editorText').inputValue()).trim(),hintText);

assert(!(await page.locator('body').innerText()).includes('Убеждение 1'),'Old primary terminology remains visible');
assert(!(await page.locator('body').innerText()).includes('Убеждение 2'),'Old secondary terminology remains visible');

const serious=errors.filter(x=>!x.includes('Failed to fetch')&&!x.includes('ERR_')&&!x.includes('favicon')&&!x.includes('429 (Too Many Requests)'));
console.log('BELIEF_HINTS_ERRORS:',JSON.stringify(errors));
if(serious.length)throw new Error(serious.join(' | '));

await browser.close();
console.log('DIAGNOSIS_BELIEF_HINTS_SUCCESS');
