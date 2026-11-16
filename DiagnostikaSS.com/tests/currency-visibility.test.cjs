'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const display=read('header-currency-display.js');
const style=read('currency-ui-readability.js');
const converter=read('header-utilities.js');
const catalog=read('global-currency-country.js');
const html=read('index.html');

test('header rate remains within badge, preserves national symbol, and observer avoids redundant edits',()=>{
  assert.match(display,/icon\.textContent !== '\$'/);
  assert.doesNotMatch(display,/clean=main\.textContent/);
  assert.match(style,/grid-template-columns:26px minmax\(0,1fr\)/);
  assert.match(style,/text-overflow:ellipsis/);
  assert.match(converter,/currencySymbol\(baseCurrency\)/);
});
test('calculator note and source are high contrast and source is one concise bank label',()=>{
  assert.match(style,/\.ccd-history-note/);
  assert.match(style,/color:#354b64!important/);
  assert.match(style,/\.utility-source/);
  assert.match(style,/background:#fff!important/);
  assert.match(converter,/rateSource=data\.provider/);
  assert.match(converter,/sourceNode\.title=rateDetails/);
});
test('national bank provider is authoritative only when that provider supplies rates',()=>{
  assert.match(catalog,/v2\/providers\/.*\/rates\?base=USD/);
  assert.match(catalog,/mode:'bank'/);
  assert.match(catalog,/mode:'reference'/);
  assert.match(catalog,/Справочные валютные курсы/);
  assert.match(catalog,/cbr-xml-daily\.ru\/daily_json\.js/);
  assert.match(catalog,/nbg\.gov\.ge\/gw\/api/);
});
test('cache-busted national rate and styling modules are deployed',()=>{
  for(const f of [
    'global-currency-country.js?v=20261116-bank-sources-2',
    'header-utilities.js?v=20261116-bank-sources-2',
    'header-currency-display.js?v=20261116-header-currency-2',
    'currency-ui-readability.js?v=20261116-visible-1'
  ])assert.ok(html.includes(f),f);
});
