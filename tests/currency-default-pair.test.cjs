'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const src=fs.readFileSync(path.join(__dirname,'..','currency-default-pair.js'),'utf8');
const utilities=fs.readFileSync(path.join(__dirname,'..','header-utilities.js'),'utf8');
const page=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const available=['USD','RUB','EUR','GBP'];
function setup(){
  const items=new Map();
  const storage={
    getItem(key){return items.has(key)?items.get(key):null;},
    setItem(key,value){items.set(key,String(value));},
    removeItem(key){items.delete(key);}
  };
  const window={};
  vm.runInNewContext(src,{window,localStorage:storage});
  return {prefs:window.DiagnostikaCurrencyDefaultPair,items,storage,window};
}
test('default pair starts USD → RUB without saving until button pressed',()=>{
  const {prefs,items}=setup();
  assert.equal(prefs.read(),null);
  assert.deepEqual(JSON.parse(JSON.stringify(prefs.resolve(available))),{from:'USD',to:'RUB'});
  assert.equal(items.size,0);
});
test('explicitly saved pair restores after a new runtime starts',()=>{
  const {prefs,storage}=setup();
  assert.equal(prefs.save('EUR','GBP',available),true);
  const window={};
  vm.runInNewContext(src,{window,localStorage:storage});
  assert.deepEqual(JSON.parse(JSON.stringify(window.DiagnostikaCurrencyDefaultPair.resolve(available))),
    {from:'EUR',to:'GBP'});
});
test('rates missing temporarily fall back without deleting saved pair',()=>{
  const {prefs}=setup();
  assert.equal(prefs.save('EUR','GBP',available),true);
  assert.deepEqual(JSON.parse(JSON.stringify(prefs.resolve(['USD','RUB']))),{from:'USD',to:'RUB'});
  assert.equal(prefs.read().from,'EUR');
  assert.equal(prefs.resolve(available).to,'GBP');
});
test('corrupted storage and invalid currencies fail safely',()=>{
  const {prefs,items}=setup();
  items.set('diagnostika-currency-default-pair-v1','{bad json');
  assert.equal(prefs.read(),null);
  assert.equal(prefs.save('XYZ','RUB',available),false);
  assert.equal(prefs.save('BAD!','USD',available),false);
});
test('UI button saves the selected pair while changing or swapping only previews',()=>{
  const {window,prefs}=setup();
  const body=utilities.slice(
    utilities.indexOf('  function showConverter(){'),
    utilities.indexOf('  currencyBtn.onclick=showConverter;')
  );
  assert.ok(body.includes('function showConverter()'));
  const rates={RUB:{rubPerUnit:1},USD:{rubPerUnit:90},EUR:{rubPerUnit:100},GBP:{rubPerUnit:115}};
  let controls={};
  const make=value=>({value,textContent:'',disabled:false});
  const overlay={hidden:false,querySelector:selector=>controls[selector]||null};
  const labels={converter:'Converter',from:'From',to:'To',amount:'Amount',
    sourceCurrency:'Rates',setDefaultPair:'Set as default',defaultPair:'Default pair',
    pairIsDefault:'Saved as default',saveDefaultError:'Could not save'};
  function openPanel(html){
    function selected(id){
      const field=html.match(new RegExp('<select id="'+id+'">([\\s\\S]*?)<\\/select>'));
      return field?.[1]?.match(/<option value="([^"]+)" selected>/)?.[1]||'';
    }
    controls={
      '#utilCurFrom':make(selected('utilCurFrom')),
      '#utilCurTo':make(selected('utilCurTo')),
      '#utilCurAmount':make('1'),
      '#utilCurResult':make(''),
      '#utilCurRate':make(''),
      '#utilCurDefaultInfo':make(''),
      '#utilCurSetDefault':make(''),
      '.currency-swap':make('')
    };
  }
  const context={window,overlay,openPanel,rates,tr:()=>labels,
    rubPer:code=>rates[code]?.rubPerUnit,fmt2:n=>Number(n).toFixed(2),
    rateDate:'',loadRates:async()=>{}};
  vm.runInNewContext(body+'\nthis.showConverter=showConverter;',context);
  context.showConverter();
  assert.equal(controls['#utilCurFrom'].value,'USD');
  assert.equal(controls['#utilCurTo'].value,'RUB');
  controls['#utilCurFrom'].value='EUR';
  controls['#utilCurTo'].value='GBP';
  controls['#utilCurFrom'].onchange();
  assert.equal(prefs.read(),null);
  context.showConverter();
  assert.equal(controls['#utilCurFrom'].value,'USD');
  controls['#utilCurFrom'].value='EUR';
  controls['#utilCurTo'].value='GBP';
  controls['#utilCurTo'].onchange();
  controls['#utilCurSetDefault'].onclick();
  assert.equal(prefs.read().from,'EUR');
  assert.equal(prefs.read().to,'GBP');
  assert.equal(controls['#utilCurSetDefault'].disabled,true);
  context.showConverter();
  assert.equal(controls['#utilCurFrom'].value,'EUR');
  assert.equal(controls['#utilCurTo'].value,'GBP');
  controls['.currency-swap'].onclick();
  assert.equal(controls['#utilCurFrom'].value,'GBP');
  assert.equal(prefs.read().from,'EUR');
  context.showConverter();
  assert.equal(controls['#utilCurFrom'].value,'EUR');
  assert.equal(controls['#utilCurTo'].value,'GBP');
});
test('storage loads before converter and scripts use cache-busting versions',()=>{
  assert.ok(page.indexOf('src="currency-default-pair.js')<page.indexOf('src="header-utilities.js'));
  assert.match(page,/header-utilities\.js\?v=20261101-default-pair-1/);
  assert.match(page,/currency-default-pair\.js\?v=20261101-default-pair-1/);
});
