'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const profile=read('account-settings.js');
const currency=read('header-utilities.js');
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
test('Russian and Georgian currency reference data have independent country caches',()=>{
  assert.match(currency,/country==='GE'/);
  assert.match(currency,/nbg\.gov\.ge\/gw\/api\/ct\/monetarypolicy\/currencies\/en\/json/);
  assert.match(currency,/cbr-xml-daily\.ru\/daily_json\.js/);
  assert.match(currency,/diagnostika-currency-rates-'\+country/);
  assert.match(currency,/rate\/quantity/);
  assert.match(currency,/country!=='RU'&&country!=='GE'/);
});
test('new scripts are cache-busted in production HTML',()=>{
  assert.match(html,/account-settings\.js\?v=20261116-specialist-location-1/);
  assert.match(html,/header-utilities\.js\?v=20261116-country-fx-1/);
});
