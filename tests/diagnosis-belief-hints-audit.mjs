import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{
  localStorage.setItem('diagnostika-ui-language','ru');
  localStorage.setItem('diagnostika-help-tooltips-enabled','1');
  localStorage.setItem('diagnostika-ai-n8n-access-key','diagnosis-hypothesis-test-key');
});
const page=await context.newPage();
let hypothesisPayload=null;
await page.route('https://lugovoyn8n.ru/webhook-test/diagnostika-hypothesis-v1',async route=>{
  hypothesisPayload=route.request().postDataJSON();
  await route.fulfill({
    status:200,
    contentType:'application/json',
    body:JSON.stringify({
      reply:'РАСШИРЕННАЯ ГИПОТЕЗА:\nВ первую очередь здесь не сами границы, а повторяющееся ощущение, что ты недостаточно способен и можешь не справиться. Когда тебя критикуют, тебе отказывают или нужно попросить о помощи, у тебя включается это восприятие себя, а вместе с ним — тревога и страх оценки.\n\nИз-за этого тебе становится сложнее спокойно выдерживать чужое недовольство и прямо говорить о своих потребностях. Поэтому трудность отстаивать границы здесь строится на повторяющемся переживании собственной несостоятельности.\n\nКОРОТКАЯ ГИПОТЕЗА:\nПохоже, трудность с границами строится на повторяющемся ощущении, что ты не справишься и недостаточно способен выдержать чужую реакцию.'
    })
  });
});
const errors=[];
const workflow=JSON.parse(fs.readFileSync('n8n/diagnostika-hypothesis-v1.json','utf8'));
assert.equal(workflow.name,'Diagnostika_SS — Гипотеза по диагностике v1');
const webhookNode=workflow.nodes.find(x=>x.name==='Webhook — Гипотеза');
assert.equal(webhookNode?.parameters?.path,'diagnostika-hypothesis-v1','Dedicated hypothesis webhook path is wrong');
const prepareNode=workflow.nodes.find(x=>x.name==='Подготовить гипотезу');
const prepareCode=String(prepareNode?.parameters?.jsCode||'');
assert(prepareCode.includes('РАСШИРЕННАЯ ГИПОТЕЗА'),'Dedicated workflow lost expanded hypothesis instruction');
assert(prepareCode.includes('КОРОТКАЯ ГИПОТЕЗА'),'Dedicated workflow lost short hypothesis instruction');
assert(prepareCode.includes('Запрещено самостоятельно придумывать:'),'Dedicated workflow lost anti-fabrication rule');
assert(prepareCode.includes('Объём: примерно 70–130 слов.'),'Dedicated workflow lost concise expanded-hypothesis length');
assert(prepareCode.includes('2–3 коротких абзаца БЕЗ подзаголовков'),'Dedicated workflow lost paragraph-only expanded format');
assert(!prepareCode.includes('Используй ровно четыре смысловых блока'),'Old four-block hypothesis format is still present');
assert(prepareCode.includes("addressMode==='vy'"),'Dedicated workflow lost Вы addressing mode');
assert(prepareCode.includes("addressMode==='third'"),'Dedicated workflow lost third-person addressing mode');
assert(prepareCode.includes("на «ты»"),'Dedicated workflow lost Ты addressing mode');
assert(prepareCode.includes("const prompt='ДАННЫЕ ДИАГНОСТИКИ:"),'Dedicated workflow does not append diagnostic data');
const openAiNode=workflow.nodes.find(x=>x.name==='OpenAI — Responses API');
assert(String(openAiNode?.parameters?.url||'').includes('api.openai.com/v1/responses'),'Dedicated workflow is not wired to OpenAI Responses API');

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

const compactHeader=await page.evaluate(()=>{
  const back=document.querySelector('.diagnosis-compact-back');
  const name=document.querySelector('.diagnosis-compact-name');
  const hypothesis=document.querySelector('.diagnosis-hypothesis-btn');
  const currency=document.querySelector('#headerCurrencyBtn');
  const header=document.querySelector('#diagnosisClientHeader');
  if(!back||!name||!hypothesis||!currency||!header)return null;
  const read=el=>{
    const r=el.getBoundingClientRect();
    const s=getComputedStyle(el);
    return {
      x:r.x,y:r.y,right:r.right,width:r.width,height:r.height,
      backgroundImage:s.backgroundImage,
      borderColor:s.borderColor,
      borderRadius:s.borderRadius,
      color:s.color,
      boxShadow:s.boxShadow
    };
  };
  return {
    back:read(back),
    name:read(name),
    hypothesis:read(hypothesis),
    currency:read(currency),
    header:read(header),
    text:hypothesis.textContent.trim()
  };
});
assert(compactHeader,'Diagnosis compact header controls are missing');
assert.equal(compactHeader.text,'Гипотеза','Hypothesis button label is wrong');
assert(Math.abs(compactHeader.hypothesis.width-compactHeader.currency.width)<=0.5,'Hypothesis button width does not match currency button');
assert(Math.abs(compactHeader.hypothesis.height-compactHeader.currency.height)<=0.5,'Hypothesis button height does not match currency button');
assert.equal(compactHeader.hypothesis.borderRadius,compactHeader.currency.borderRadius,'Hypothesis button radius does not match currency button');
assert.equal(compactHeader.hypothesis.backgroundImage,compactHeader.currency.backgroundImage,'Hypothesis button glass texture does not match currency button');
assert.equal(compactHeader.hypothesis.borderColor,compactHeader.currency.borderColor,'Hypothesis button border color does not match currency button');
assert.equal(compactHeader.hypothesis.boxShadow,compactHeader.currency.boxShadow,'Hypothesis button glass shadow does not match currency button');
assert(compactHeader.hypothesis.x>compactHeader.name.x,'Hypothesis button is not to the right of client name');
assert(compactHeader.header.right-compactHeader.hypothesis.right<=14,'Hypothesis button is not aligned to the far right of the client header');
assert.equal(compactHeader.back.color,'rgb(255, 255, 255)','Back-to-client button is not visually emphasized');
assert.match(compactHeader.back.backgroundImage,/rgb\(79, 134, 255\)|rgb\(36, 87, 214\)/,'Back-to-client button did not receive the vivid blue treatment');

await page.locator('.diagnosis-hypothesis-btn').click();
const hypothesisOverlay=page.locator('#diagnosisHypothesisOverlay');
await hypothesisOverlay.waitFor({state:'visible',timeout:3000});
assert.equal((await hypothesisOverlay.locator('#diagnosisHypothesisTitle').textContent()).trim(),'Гипотеза по запросу');
assert.equal((await hypothesisOverlay.locator('.diagnosis-hypothesis-generate').textContent()).trim(),'Сформировать');
assert.equal((await hypothesisOverlay.locator('.diagnosis-hypothesis-save').textContent()).trim(),'Сохранить гипотезу');
assert.equal(await hypothesisOverlay.locator('.diagnosis-hypothesis-save').isDisabled(),true,'Save hypothesis must be disabled before generation');
assert.equal(await hypothesisOverlay.locator('input[name="diagnosisHypothesisAddress"]').count(),3,'Hypothesis addressing selector must have three choices');
assert.equal(await hypothesisOverlay.locator('input[name="diagnosisHypothesisAddress"][value="ty"]').isChecked(),true,'Ты must be the default hypothesis addressing mode');
const modalBox=await hypothesisOverlay.locator('.diagnosis-hypothesis-modal').boundingBox();
assert(modalBox&&modalBox.y>=75,'Hypothesis modal top is still hidden behind the app header');

const hypothesisData=await page.evaluate(()=>window.DiagnostikaHypothesis?.buildDiagnosticData?.());
assert(hypothesisData,'Hypothesis diagnostic data was not built');
assert(hypothesisData.исходный_запрос?.формулировка,'Hypothesis payload has no request title');
assert(Array.isArray(hypothesisData.ситуации),'Hypothesis payload has no situations array');
assert(hypothesisData.ситуации.length>0,'Hypothesis payload has no diagnostic situations');
await hypothesisOverlay.locator('.diagnosis-hypothesis-generate').click();
await hypothesisOverlay.locator('.diagnosis-hypothesis-result-expanded').waitFor({state:'visible',timeout:5000});
assert((await hypothesisOverlay.locator('.diagnosis-hypothesis-result-expanded').innerText()).includes('несостоятельности'));
assert.equal(await hypothesisOverlay.locator('.diagnosis-hypothesis-part').count(),0,'Old structured hypothesis cards are still visible');
const expandedParagraphCount=await hypothesisOverlay.locator('.diagnosis-hypothesis-expanded-content p').count();
assert(expandedParagraphCount>=2&&expandedParagraphCount<=3,'Expanded hypothesis must render as 2–3 plain paragraphs');
assert(!(await hypothesisOverlay.locator('.diagnosis-hypothesis-result-expanded').innerText()).includes('Глубинная конструкция'),'Old structured hypothesis heading is still visible');
assert.equal(await hypothesisOverlay.locator('.diagnosis-hypothesis-save').isDisabled(),false,'Save hypothesis must be enabled after generation');
assert((await hypothesisOverlay.locator('.diagnosis-hypothesis-result-short').innerText()).includes('не справишься'));
assert(hypothesisPayload,'Hypothesis request was not sent to AI endpoint');
assert.equal(String(hypothesisPayload.requestId||''),String(hypothesisData.исходный_запрос.id||''),'Dedicated workflow requestId mismatch');
assert.deepEqual(hypothesisPayload.diagnosticData,hypothesisData,'Dedicated workflow did not receive the exact diagnostic payload');
assert.equal(hypothesisPayload.addressMode,'ty','Default hypothesis addressing mode was not sent to n8n');
assert.equal('message' in hypothesisPayload,false,'Frontend still sends the hypothesis prompt instead of letting the dedicated workflow own it');
assert.equal('chatHistory' in hypothesisPayload,false,'Dedicated hypothesis request must not include client AI chat history');
await hypothesisOverlay.locator('label:has(input[name="diagnosisHypothesisAddress"][value="vy"])').click();
assert.equal(await page.evaluate(()=>window.DiagnostikaHypothesis?.selectedAddressMode?.()),'vy','Вы addressing mode cannot be selected');
assert.equal(await page.evaluate(()=>localStorage.getItem('diagnostika-hypothesis-address-mode')),'vy','Addressing preference was not persisted');

await hypothesisOverlay.locator('.diagnosis-hypothesis-save').click();
assert.equal(await hypothesisOverlay.locator('.diagnosis-hypothesis-save').isDisabled(),true,'Saved hypothesis button did not switch to saved state');
assert.equal((await hypothesisOverlay.locator('.diagnosis-hypothesis-save').textContent()).trim(),'Сохранено');
const savedHypothesis=await page.evaluate(()=>{
  const r=window.DiagnostikaRequests?.viewed?.()||window.DiagnostikaRequests?.active?.();
  return r?.hypothesis||null;
});
assert(savedHypothesis?.raw?.includes('РАСШИРЕННАЯ ГИПОТЕЗА'),'Hypothesis was not persisted on the request');
assert.equal(savedHypothesis?.addressMode,'vy','Saved hypothesis lost addressing mode');
assert(savedHypothesis?.savedAt,'Saved hypothesis timestamp is missing');

await hypothesisOverlay.locator('.diagnosis-hypothesis-cancel').click();
await hypothesisOverlay.waitFor({state:'hidden',timeout:3000});
await page.locator('.diagnosis-hypothesis-btn').click();
await hypothesisOverlay.waitFor({state:'visible',timeout:3000});
assert((await hypothesisOverlay.locator('.diagnosis-hypothesis-result-expanded').innerText()).includes('несостоятельности'),'Saved hypothesis was not restored without another AI request');
assert.equal((await hypothesisOverlay.locator('.diagnosis-hypothesis-save').textContent()).trim(),'Сохранено','Saved hypothesis state was not restored');
assert.equal(await hypothesisOverlay.locator('input[name="diagnosisHypothesisAddress"][value="vy"]').isChecked(),true,'Saved addressing mode was not restored');
await hypothesisOverlay.locator('.diagnosis-hypothesis-cancel').click();
await hypothesisOverlay.waitFor({state:'hidden',timeout:3000});

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
  const hypothesis=document.querySelector('.diagnosis-hypothesis-btn');
  const hypothesisBox=hypothesis.getBoundingClientRect();
  const actionBox=document.getElementById('addBeliefBtn').getBoundingClientRect();
  return {
    ...data,
    bar:{scrollWidth:bar.scrollWidth,clientWidth:bar.clientWidth},
    hypothesisTop:hypothesisBox.top,
    hypothesisHeight:hypothesisBox.height,
    actionTop:actionBox.top,
    actionHeight:actionBox.height
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
assert(Math.abs(actionLayout.actionTop-actionLayout.hypothesisTop)<=1,'Diagnosis action row is not level with Hypothesis button');
assert(Math.abs(actionLayout.actionHeight-actionLayout.hypothesisHeight)<=0.5,'Diagnosis action row height does not match Hypothesis button');

// Diagnosis buttons must keep a stationary hit box on hover.
// The old global translateY(-2px) made the pointer repeatedly enter/leave at button edges.
for(const id of ['addBeliefBtn','addFeelingBtn','addDeepBtn','deleteElementBtn','addRequestBtn','deleteRequestBtn','addSituationBtn','editSituationBtn','deleteSituationBtn','hintBtn']){
  const button=page.locator('#'+id);
  if(!(await button.isVisible())) continue;
  const before=await button.boundingBox();
  assert(before,id+' has no pre-hover geometry');
  await button.hover();
  await page.waitForTimeout(180);
  const after=await button.boundingBox();
  assert(after,id+' has no post-hover geometry');
  assert(Math.abs(after.x-before.x)<0.1,id+' moves horizontally on hover');
  assert(Math.abs(after.y-before.y)<0.1,id+' moves vertically on hover');
  const transform=await button.evaluate(el=>getComputedStyle(el).transform);
  assert.equal(transform,'none',id+' still applies a hover transform');
}


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
  const requestStyle=styleOf(request);
  const situationsStyle=styleOf(situations);
  const resultStyle=styleOf(result);
  const clientHeader=document.getElementById('diagnosisClientHeader');
  const leftPanel=document.querySelector('.left-panel');
  const lavenderToolbar=document.querySelector('.diagnosis-request-card .query-toolbar');
  return {
    request:requestStyle,
    situations:situationsStyle,
    result:resultStyle,
    headerToRequestGap:requestStyle.top-clientHeader.getBoundingClientRect().bottom,
    requestToSituationsGap:situationsStyle.top-requestStyle.bottom,
    situationsToResultGap:resultStyle.top-situationsStyle.bottom,
    leftPanelBackground:getComputedStyle(leftPanel).backgroundColor,
    lavenderToolbarBackground:getComputedStyle(lavenderToolbar).backgroundImage,
    footerInsideSituations:footer?.parentElement===situations,
    mainBlockCount:document.querySelectorAll('#diagnosticsLeft>.diagnosis-main-block').length
  };
});
console.log('LEFT_SECTIONS',JSON.stringify(leftSections));
assert.equal(leftSections.mainBlockCount,3,'Diagnosis left column must contain exactly three primary blocks');
assert.equal(leftSections.footerInsideSituations,true,'Situation actions must stay inside the Situations block');
for(const name of ['request','situations','result']){
  assert.equal(leftSections[name].borderTopStyle,'solid',name+' block has no independent border');
  assert.notEqual(leftSections[name].backgroundImage,'none',name+' block has no independent background');
  assert.match(leftSections[name].borderRadius,/10px/,name+' block is not visually card-like');
}
assert.notEqual(leftSections.request.borderTopColor,leftSections.situations.borderTopColor,'Request and Situations blocks are not visually distinguished');
assert.notEqual(leftSections.situations.borderTopColor,leftSections.result.borderTopColor,'Situations and Result blocks are not visually distinguished');
assert(leftSections.headerToRequestGap>=17&&leftSections.headerToRequestGap<=19.5,'Header-to-Request gap is not about 5 mm');
assert(leftSections.requestToSituationsGap>=17&&leftSections.requestToSituationsGap<=19.5,'Request-to-Situations gap is not about 5 mm');
assert(leftSections.situationsToResultGap>=17&&leftSections.situationsToResultGap<=19.5,'Situations-to-Result gap is not about 5 mm');
assert.equal(leftSections.leftPanelBackground,'rgb(237, 243, 248)','Left diagnosis column is not on the light background');
assert.match(leftSections.request.backgroundImage,/rgb\(189, 220, 248\)|rgb\(147, 195, 239\)/,'Request block is not the richer blue palette');
assert.match(leftSections.lavenderToolbarBackground,/rgba?\(235, 222, 249|rgba?\(220, 200, 242/,'Client requests accent is not lavender');
assert.match(leftSections.situations.backgroundImage,/rgb\(175, 231, 215\)|rgb\(132, 214, 191\)/,'Situations block is not the richer mint palette');
assert.match(leftSections.result.backgroundImage,/rgb\(255, 200, 179\)|rgb\(243, 162, 132\)/,'Result block is not the richer peach palette');

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
