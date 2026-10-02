import assert from 'node:assert/strict';
import fs from 'node:fs';

const card=fs.readFileSync('modules/clients/ui/card.js','utf8');
const calendar=fs.readFileSync('modules/calendar/ui/calendar.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.ok(card.includes("ISO_COUNTRY_CODES='AD AE AF"),'full ISO country catalog missing');
assert.ok(card.includes("'us':['сша'"),'USA aliases missing');
assert.ok(card.includes("'америка'"),'America alias missing');
assert.ok(card.includes("new Intl.DisplayNames([locale],{type:'region'})"),'localized country names missing');
assert.ok(card.includes("https://geocoding-api.open-meteo.com/v1/search?"),'global city geocoder missing');
assert.ok(card.includes("params.set('countryCode',countryCode)"),'city search does not respect selected country');
assert.ok(card.includes("const prefix=String(typed).trim().slice(0,3)"),'fuzzy typo fallback for global cities missing');
assert.ok(card.includes("count,String(count)".replace(',String',':String'))||card.includes("count:String(count)"),'global city result count missing');
assert.ok(card.includes("timezone:row.timezone||''"),'global city timezone is not retained');
assert.ok(card.includes("countryCode:selectedLocationMeta?.countryCode||''"),'client country code is not persisted');
assert.ok(card.includes("timezone:selectedLocationMeta?.timezone||''"),'client timezone is not persisted');
assert.ok(card.includes("latitude:selectedLocationMeta?.latitude??null"),'client latitude is not persisted');
assert.ok(card.includes("longitude:selectedLocationMeta?.longitude??null"),'client longitude is not persisted');
assert.ok(calendar.includes("const location=c.timezone?{"),'calendar does not prefer saved client timezone');
assert.ok(index.includes('modules/clients/ui/card.js?v=20261002-global-location-1'),'client card cache key missing');
assert.ok(index.includes('modules/calendar/ui/calendar.js?v=20261002-global-location-1'),'calendar cache key missing');

console.log('GLOBAL_COUNTRY_CITY_SEARCH_AUDIT_OK');
