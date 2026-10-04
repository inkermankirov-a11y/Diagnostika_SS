import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{localStorage.setItem('diagnostika-ui-language','ru');localStorage.setItem('diagnostika-help-tooltips-enabled','1');});
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

assert.equal(await page.locator('#addBeliefBtn').evaluate(el=>el.firstChild?.textContent?.trim()),'+ Первичное убеждение');
assert.equal(await page.locator('#addFeelingBtn').evaluate(el=>el.firstChild?.textContent?.trim()),'+ Вторичные чувства');
assert.equal(await page.locator('#addDeepBtn').evaluate(el=>el.firstChild?.textContent?.trim()),'+ Вторичное убеждение');

const colors=await page.evaluate(()=>Object.fromEntries(
  ['addBeliefBtn','addFeelingBtn','addDeepBtn'].map(id=>{
    const s=getComputedStyle(document.getElementById(id));
    return [id,{backgroundImage:s.backgroundImage,color:s.color,borderColor:s.borderColor}];
  })
));
assert.match(colors.addBeliefBtn.backgroundImage,/rgb\(36, 79, 175\)|rgb\(18, 53, 127\)/,'Primary belief button is not deep blue');
assert.match(colors.addFeelingBtn.backgroundImage,/rgb\(255, 216, 90\)|rgb\(231, 173, 22\)/,'Secondary feelings button is not yellow');
assert.match(colors.addDeepBtn.backgroundImage,/rgb\(139, 99, 216\)|rgb\(101, 61, 179\)/,'Secondary belief button is not purple');

// Verify the top action row lines up with the client header frame.
const actionLayout=await page.evaluate(()=>{
  const ids=['addBeliefBtn','addFeelingBtn','addDeepBtn','deleteElementBtn'];
  const data=Object.fromEntries(ids.map(id=>{
    const el=document.getElementById(id);
    const s=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    return [id,{fontFamily:s.fontFamily,width:r.width,height:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,whiteSpace:s.whiteSpace,writingMode:s.writingMode}];
  }));
  const bar=document.querySelector('.center-actions');
  const clientHeader=document.getElementById('diagnosisClientHeader');
  return {
    ...data,
    bar:{scrollWidth:bar.scrollWidth,clientWidth:bar.clientWidth},
    clientHeaderTop:clientHeader.getBoundingClientRect().top,
    actionTop:document.getElementById('addBeliefBtn').getBoundingClientRect().top
  };
});
for(const id of ['addBeliefBtn','addFeelingBtn','addDeepBtn','deleteElementBtn']){
  assert.match(actionLayout[id].fontFamily,/Tahoma/i,id+' did not switch to Tahoma');
}
assert(actionLayout.deleteElementBtn.width>=77,'Delete button is still squeezed');
assert(actionLayout.deleteElementBtn.scrollWidth<=actionLayout.deleteElementBtn.clientWidth+1,'Delete text is clipped');
assert.equal(actionLayout.deleteElementBtn.whiteSpace,'nowrap','Delete text can wrap');
assert.match(actionLayout.deleteElementBtn.writingMode,/horizontal/i,'Delete button is not horizontal');
assert(actionLayout.bar.scrollWidth<=actionLayout.bar.clientWidth+1,'Diagnosis action bar overflows');

const leftSections=await page.evaluate(()=>{
  const request=document.querySelector('.diagnosis-request-card');
  const situations=document.querySelector('.diagnosis-situations-card');
  const result=document.querySelector('.diagnosis-result-card');
  const footer=document.querySelector('.left-footer-actions');
  const styleOf=el=>{
    const s=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    return {
      top:r.top,
      bottom:r.bottom,
      borderTopStyle:s.borderTopStyle,
      borderTopColor:s.borderTopColor,
      borderRadius:s.borderRadius,
      backgroundImage:s.backgroundImage
    };
  };
  return {
    request:styleOf(request),
    situations:styleOf(situations),
    result:styleOf(result),
    footerInsideSituations:footer?.parentElement===situations,
    mainBlockCount:document.querySelectorAll('#diagnosticsLeft>.diagnosis-main-block').length
  };
});
assert.equal(leftSections.mainBlockCount,3,'Diagnosis left column must contain exactly three primary blocks');
assert.equal(leftSections.footerInsideSituations,true,'Situation actions must stay inside the Situations block');
for(const name of ['request','situations','result']){
  assert.equal(leftSections[name].borderTopStyle,'solid',name+' block has no independent border');
  assert.notEqual(leftSections[name].backgroundImage,'none',name+' block has no independent background');
  assert.match(leftSections[name].borderRadius,/10px/,name+' block is not visually card-like');
}
assert.notEqual(leftSections.request.borderTopColor,leftSections.situations.borderTopColor,'Request and Situations blocks are not visually distinguished');
assert.notEqual(leftSections.situations.borderTopColor,leftSections.result.borderTopColor,'Situations and Result blocks are not visually distinguished');
assert(Math.abs(actionLayout.actionTop-actionLayout.clientHeaderTop)<=1.5,'Diagnosis action buttons are not aligned to the client header top edge');

async function expectHelpIcon(id,fragment){
  const button=page.locator('#'+id);
  const icon=button.locator('.diagnosis-help-trigger');
  await icon.waitFor({state:'visible',timeout:2000});

  const buttonBox=await button.boundingBox();
  const iconBox=await icon.boundingBox();
  assert(buttonBox&&iconBox,id+' geometry unavailable');
  assert(iconBox.x>buttonBox.x+buttonBox.width-35,id+' help icon is not in the top-right corner');
  assert(iconBox.y<buttonBox.y+25,id+' help icon is not in the top-right corner');

  await page.mouse.move(buttonBox.x+12,buttonBox.y+buttonBox.height/2);
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#diagnosisHelpIconTooltip').isVisible(),false,id+' tooltip opens from the whole button');

  await icon.hover();
  const tip=page.locator('#diagnosisHelpIconTooltip');
  await tip.waitFor({state:'visible',timeout:2000});
  const text=(await tip.textContent()).trim();
  assert(text.includes(fragment),id+' icon help missing: '+text);
  await page.mouse.move(10,10);
  await tip.waitFor({state:'hidden',timeout:2000});
}
await page.evaluate(()=>window.DiagnostikaHelpHints?.setEnabled(false));
await expectHelpIcon('addBeliefBtn','То, что клиент говорит о себе в первую очередь.');
await expectHelpIcon('addFeelingBtn','То, что клиент чувствует, когда активируется первичное убеждение.');
await expectHelpIcon('addDeepBtn','Скрытое, глубокое убеждение о себе');

await page.waitForFunction(()=>[...document.querySelectorAll('#addBeliefBtn .diagnosis-help-trigger,#addFeelingBtn .diagnosis-help-trigger,#addDeepBtn .diagnosis-help-trigger')].every(el=>!el.hidden));
await page.evaluate(()=>window.DiagnostikaHelpHints?.setEnabled(true));

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
