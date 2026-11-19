'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const serviceCode=read('global-currency-country.js');
const headerCode=read('header-utilities.js');
const iconCode=read('header-currency-display.js');
const key='diagnostika-reference-rates-v2:RUB:cbr';

function setup(fetcher=async()=>{throw Error('offline');}){
  const items=new Map();
  const localStorage={
    getItem:k=>items.get(k)||null,
    setItem:(k,v)=>items.set(k,String(v)),
    removeItem:k=>items.delete(k)
  };
  const window={};
  vm.runInNewContext(serviceCode,{window,localStorage,fetch:fetcher,Date});
  return {api:window.DiagnostikaCountryCurrency,items};
}
function seed(items,date){
  items.set(key,JSON.stringify({
    time:date.getTime(),data:{
      base:'RUB',date:'2026-11-18',mode:'bank',provider:'Центральный банк России',
      stale:false,rates:{RUB:{rubPerUnit:1},USD:{rubPerUnit:88},EUR:{rubPerUnit:95}}
    }
  }));
}
test('same-day cached USD/RUB is ready immediately and does not fetch again',async()=>{
  let calls=0;
  const {api,items}=setup(async()=>{calls++;throw Error('No request expected');});
  seed(items,new Date());
  const cached=api.cachedRates('RUB','RU');
  assert.equal(cached.rates.USD.rubPerUnit,88);
  assert.equal(cached.stale,false);
  const found=await api.referenceRates('RUB','RU');
  assert.equal(found.rates.USD.rubPerUnit,88);
  assert.equal((await api.currencyForCountry('RU')).currency,'RUB');
  assert.equal(calls,0);
});
test('yesterday quote is visible instantly, but downloaded only once today',async()=>{
  let calls=0;
  const {api,items}=setup(async()=>{
    calls++;
    return {ok:true,json:async()=>['RUB','EUR','GBP','JPY','CNY','KZT'].map((quote,i)=>({
      base:'USD',quote,rate:[89,.9,.8,150,7.3,470][i],date:'2026-11-19'
    }))};
  });
  const now=new Date();
  seed(items,new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,12));
  assert.equal(api.cachedRates('RUB','RU').stale,true);
  assert.equal(api.cachedRates('RUB','RU').rates.USD.rubPerUnit,88);
  const latest=await api.referenceRates('RUB','RU');
  assert.equal(latest.rates.USD.rubPerUnit,89);
  assert.equal(latest.stale,false);
  assert.equal(calls,1);
  await api.referenceRates('RUB','RU');
  assert.equal(calls,1);
});
test('when offline, a recently saved quote is retained and marked stale',async()=>{
  const {api,items}=setup();
  const now=new Date();
  seed(items,new Date(now.getFullYear(),now.getMonth(),now.getDate()-1,12));
  const stale=await api.referenceRates('RUB','RU');
  assert.equal(stale.rates.USD.rubPerUnit,88);
  assert.equal(stale.stale,true);
  assert.ok(stale.error);
});
test('rate indicator has all three states and the header prefers cache',()=>{
  assert.match(headerCode,/const saved=showSavedRate\(country,service\)/);
  assert.match(headerCode,/if\(saved&&!saved.stale\)/);
  assert.match(headerCode,/setRateState\('sync'\)/);
  assert.match(headerCode,/setRateState\(rateError\|\|!rates\?'error':'ready'\)/);
  for(const state of ['sync','error','ready']){
    assert.ok(iconCode.includes('data-rate-state="'+state+'"'),state);
  }
  assert.match(iconCode,/diagnostika-currency-sync/);
});
