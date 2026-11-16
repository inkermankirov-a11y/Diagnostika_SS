'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const profile=read('account-settings.js');
const currency=read('header-utilities.js');
const global=read('global-currency-country.js');
const html=read('index.html');

test('specialist keeps separate surname, validated city and country code',()=>{
  assert.match(profile,/surname:String\(value\?\.surname/);
  assert.match(profile,/countryCode:String\(value\?\.countryCode/);
  assert.match(profile,/geocoding-api\.open-meteo\.com\/v1\/search/);
  assert.match(profile,/chosenCity&&cityInput\.value\.trim\(\)/);
});
test('experience explicitly labeled in specialist summary',()=>{
  assert.match(profile,/years\+' опыта'/);
  assert.match(profile,/profile\.title,expLabel/);
});
test('global catalog maps country codes to local currency including Eurasian and eurozone examples',()=>{
  assert.match(global,/restcountries\.com\/v3\.1\/all\?fields=cca2,currencies,name/);
  for(const item of ['RU:\'RUB\'','GE:\'GEL\'','KZ:\'KZT\'','JP:\'JPY\'','US:\'USD\'','DE:\'EUR\''])
    assert.ok(global.includes(item),item);
  assert.match(global,/currencyForCountry/);
});
test('official-provider aggregator supports global FX cross rates with attribution and cache isolation',()=>{
  assert.match(global,/api\.frankfurter\.dev\/v2\/providers/);
  assert.match(global,/api\.frankfurter\.dev\/v2\/rates\?base=USD/);
  assert.match(global,/nationalFallback/);
  assert.match(global,/Справочные валютные курсы/);
  assert.match(global,/central/);
  assert.match(global,/RATE_PREFIX\+base/);
  assert.match(global,/localPerUsd\/perUsd/);
  assert.match(currency,/service\.currencyForCountry\(country\)/);
  assert.match(currency,/service\.referenceRates\(base,country\)/);
  assert.match(currency,/rateSource=data\.provider/);
});
test('new scripts are cache-busted in production HTML',()=>{
  assert.match(html,/account-settings\.js\?v=20261116-city-dropdown-fix-1/);
  assert.match(html,/global-currency-country\.js\?v=20261116-bank-sources-2/);
  assert.match(html,/header-utilities\.js\?v=20261116-global-fx-1/);
});
