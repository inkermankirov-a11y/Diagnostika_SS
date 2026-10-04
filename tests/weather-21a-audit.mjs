import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(index.includes('header-utilities.js?v=20261004-weather-local-5min-1'),'Weather cache marker missing');
assert(src.includes("const WEATHER_FEED_URL='./weather-data.json'"),'Local weather feed missing');
assert(src.includes("const WEATHER_REFRESH_MS=5*60*1000"),'Weather must refresh every 5 minutes');
assert(src.includes("weather-data.json"),'weather-data.json usage missing');
assert(src.includes("navigator.geolocation"),'Geolocation selection missing');
assert(src.includes("nearestWeatherCity"),'Nearest city selection missing');
assert(src.includes("window.DiagnostikaWeather=Object.freeze"),'Weather diagnostics missing');
for(const forbidden of ['api.open-meteo.com','geocoding-api.open-meteo.com','bigdatacloud.net']){
  assert.equal(src.includes(forbidden),false,'Browser weather must not depend on external API: '+forbidden);
}

const browser=await chromium.launch({headless:true});

function payload(temp=5.2,time='2026-10-04T11:55'){
  const daily={
    time:['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'],
    weather_code:[1,2,3,61,2,3,1],
    temperature_2m_max:[8,9,10,11,12,13,14],
    temperature_2m_min:[1,2,3,4,5,6,7],
    precipitation_probability_max:[10,20,30,40,50,60,70],
    wind_speed_10m_max:[5,6,7,8,9,10,11]
  };
  const current={time,temperature_2m:temp,apparent_temperature:temp-1.2,weather_code:1,is_day:1};
  const city={
    id:'kirov',name:'Киров',aliases:['Kirov'],country:'Россия',admin:'Кировская область',
    latitude:58.6036,longitude:49.668,timezone:'Europe/Moscow',current,daily
  };
  return {_updated_utc:'2026-10-04T08:55:00Z',current,daily,cities:[city]};
}

async function makePage({feed=payload(),failFeed=false,cache=null}={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({cache})=>{
    localStorage.setItem('diagnostika-ui-language','ru');
    localStorage.setItem('diagnostika-weather-mode','city');
    localStorage.setItem('diagnostika-weather-city',JSON.stringify({id:'kirov',name:'Киров',latitude:58.6036,longitude:49.668}));
    localStorage.removeItem('diagnostika-weather-feed-local-v2');
    if(cache)localStorage.setItem('diagnostika-weather-feed-local-v2',JSON.stringify(cache));
  },{cache});
  const page=await context.newPage();
  let currentFeed=feed;
  await page.route('**/weather-data.json**',route=>{
    if(failFeed)return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(currentFeed)});
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/index.html?weather-local='+Date.now(),{waitUntil:'commit',timeout:15000});
  await page.waitForFunction(()=>window.DiagnostikaWeather?.state,null,{timeout:15000});
  return {context,page,errors,setFeed:value=>{currentFeed=value;}};
}

// Same-origin weather feed loads current values.
{
  const {context,page,errors}=await makePage();
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    sub:document.querySelector('#headerWeatherBtn .hu-sub')?.textContent||''
  }));
  assert.equal(state.main,'+5°');
  assert.equal(state.sub,'Киров');
  assert.equal(state.weather.cached,false);
  assert.deepEqual(errors,[]);
  await context.close();
}

// Refresh updates header and an already-open weather popup.
{
  const {context,page,errors,setFeed}=await makePage();
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  await page.click('#headerWeatherBtn');
  await page.waitForSelector('.weather-current-temp');
  assert.equal(await page.locator('.weather-current-temp').textContent(),'+5°');
  assert((await page.locator('.utility-source').textContent()).includes('11:55'));

  setFeed(payload(7.4,'2026-10-04T12:00'));
  await page.evaluate(()=>window.DiagnostikaWeather.refresh());
  await page.waitForFunction(()=>document.querySelector('#headerWeatherBtn .hu-main')?.textContent==='+7°',null,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('.weather-current-temp')?.textContent==='+7°',null,{timeout:10000});
  assert((await page.locator('.utility-source').textContent()).includes('12:00'));
  assert.deepEqual(errors,[]);
  await context.close();
}

// If same-origin file temporarily fails, cached local feed remains visible.
{
  const cachedFeed=payload(4.1,'2026-10-04T11:50');
  const cache={savedAt:Date.now()-2*60*1000,feed:cachedFeed};
  const {context,page,errors}=await makePage({failFeed:true,cache});
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||''
  }));
  assert.equal(state.main,'+4°');
  assert.equal(state.weather.cached,true);
  assert.deepEqual(errors,[]);
  await context.close();
}

await browser.close();
console.log('WEATHER_LOCAL_5MIN_SUCCESS');
