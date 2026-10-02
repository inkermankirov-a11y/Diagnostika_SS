import assert from 'node:assert/strict';
import fs from 'node:fs';

const header=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const workflow=fs.readFileSync('.github/workflows/update-weather.yml','utf8');
const locations=JSON.parse(fs.readFileSync('weather-locations.json','utf8'));

for(const forbidden of [
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'bigdatacloud.net',
  'yandex.ru/weather',
  'weather.yandex'
]){
  assert.equal(header.includes(forbidden),false,'Browser weather still calls external service: '+forbidden);
}
assert.ok(header.includes("./weather-data.json"),'Local weather-data.json source missing');
assert.ok(header.includes("weather-data.json?t="),'Weather JSON cache bust missing');
assert.ok(header.includes("navigator.geolocation"),'Automatic browser geolocation missing');
assert.ok(header.includes("nearestWeatherCity"),'Nearest local weather city selection missing');
assert.ok(header.includes("diagnostika-weather-mode')||'geo'"),'Geolocation must be the default weather mode');
assert.ok(header.includes('diagnostika-weather-current-local'),'Current weather local fallback missing');
assert.ok(header.includes('diagnostika-weather-forecast-local'),'Forecast local fallback missing');
assert.ok(header.includes('WEATHER_REFRESH_MS=15*60*1000'),'15-minute local refresh missing');
assert.ok(index.includes('header-utilities.js?v=20261002-weather-local1'),'Weather cache key not bumped');
assert.ok(workflow.includes("cron: '7,37 * * * *'"),'30-minute weather schedule missing');
assert.ok(workflow.includes('contents: write'),'Weather workflow write permission missing');
assert.ok(workflow.includes('workflow_dispatch:'),'Manual weather workflow dispatch missing');
assert.ok(locations.cities.some(city=>city.id==='kirov'&&city.latitude===58.6036&&city.longitude===49.668),'Kirov reference city missing');
assert.ok(locations.cities.length>=80,'Weather city catalog unexpectedly small');

console.log('WEATHER_LOCAL_DATA_AUDIT_OK',JSON.stringify({cities:locations.cities.length,defaultMode:'geo'}));
