import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(index.includes('header-utilities.js?v=20261004-weather-live-audit-1'),'Weather cache marker missing');
assert(src.includes("const WEATHER_CACHE_KEY='diagnostika-weather-cache-v3'"),'Live weather cache missing');
assert(src.includes("const WEATHER_REFRESH_MS=5*60*1000"),'Weather must refresh every 5 minutes');
assert(src.includes("const DEFAULT_CITY=Object.freeze({name:'Киров',latitude:58.6036,longitude:49.6680"),'Kirov fallback missing');
assert(src.includes('for(const url of [modern,modern,legacy])'),'Weather retry sequence missing');
assert(src.includes('current_weather=true'),'Legacy Open-Meteo fallback missing');
assert(src.includes('setInterval(()=>refreshWeather({rerender:true}),WEATHER_REFRESH_MS)'),'5-minute UI refresh missing');
assert(src.includes('window.DiagnostikaWeather=Object.freeze'),'Weather diagnostics missing');

const browser=await chromium.launch({headless:true});

const daily={
  time:['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'],
  weather_code:[1,2,3,61,2,3,1],
  temperature_2m_max:[8,9,10,11,12,13,14],
  temperature_2m_min:[1,2,3,4,5,6,7],
  precipitation_probability_max:[10,20,30,40,50,60,70],
  wind_speed_10m_max:[5,6,7,8,9,10,11]
};

async function makePage({mode='city',cache=null,handler}={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({mode,cache})=>{
    localStorage.setItem('diagnostika-ui-language','ru');
    localStorage.setItem('diagnostika-weather-mode',mode);
    localStorage.setItem('diagnostika-weather-city',JSON.stringify({
      name:'Киров',latitude:58.6036,longitude:49.6680,timezone:'Europe/Kirov'
    }));
    localStorage.removeItem('diagnostika-weather-cache-v3');
    if(cache)localStorage.setItem('diagnostika-weather-cache-v3',JSON.stringify(cache));
  },{mode,cache});
  const page=await context.newPage();
  if(handler)await page.route('https://api.open-meteo.com/**',handler);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/index.html?weather-audit='+Date.now(),{waitUntil:'commit',timeout:15000});
  await page.waitForFunction(()=>window.DiagnostikaWeather?.state,null,{timeout:15000});
  return {context,page,errors};
}

// Modern live API success.
{
  const {context,page,errors}=await makePage({
    handler:route=>route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        current:{temperature_2m:6.4,apparent_temperature:4.9,weather_code:1,is_day:1},
        daily
      })
    })
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    sub:document.querySelector('#headerWeatherBtn .hu-sub')?.textContent||''
  }));
  assert.equal(state.main,'+6°');
  assert.equal(state.sub,'Киров');
  assert.equal(state.weather.cached,false);
  assert.equal(state.weather.error,'');
  assert(state.weather.updatedAt);
  assert.deepEqual(errors,[]);
  await context.close();
}

// First modern request fails; immediate retry recovers.
{
  let modernCalls=0;
  const {context,page,errors}=await makePage({
    handler:route=>{
      const url=route.request().url();
      if(url.includes('current_weather=true'))return route.fulfill({status:500,contentType:'application/json',body:'{}'});
      modernCalls++;
      if(modernCalls===1)return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      return route.fulfill({
        status:200,
        contentType:'application/json',
        body:JSON.stringify({
          current:{temperature_2m:7.1,apparent_temperature:5.8,weather_code:2,is_day:1},
          daily
        })
      });
    }
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  const state=await page.evaluate(()=>window.DiagnostikaWeather.state());
  assert(modernCalls>=2,'Transient modern failure must retry');
  assert.equal(state.temperature,7.1);
  assert.equal(state.cached,false);
  assert.deepEqual(errors,[]);
  await context.close();
}

// Modern API fails twice, legacy current_weather succeeds.
{
  let legacyCalls=0;
  const {context,page,errors}=await makePage({
    handler:route=>{
      const url=route.request().url();
      if(url.includes('current_weather=true')){
        legacyCalls++;
        return route.fulfill({
          status:200,
          contentType:'application/json',
          body:JSON.stringify({
            current_weather:{temperature:-3.2,weathercode:3,is_day:1},
            daily
          })
        });
      }
      return route.fulfill({status:500,contentType:'application/json',body:'{}'});
    }
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  const state=await page.evaluate(()=>window.DiagnostikaWeather.state());
  assert(legacyCalls>=1,'Legacy fallback missing');
  assert.equal(state.temperature,-3.2);
  assert.deepEqual(errors,[]);
  await context.close();
}

// API unavailable: recent cache is shown and marked as cached.
{
  const cache={
    savedAt:Date.now()-5*60*1000,
    label:'Киров',
    latitude:58.6036,
    longitude:49.6680,
    data:{
      current:{temperature_2m:4.1,apparent_temperature:2.7,weather_code:2,is_day:1},
      daily
    }
  };
  const {context,page,errors}=await makePage({
    cache,
    handler:route=>route.fulfill({status:503,contentType:'application/json',body:'{}'})
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().cached===true,null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    title:document.querySelector('#headerWeatherBtn')?.title||''
  }));
  assert.equal(state.main,'+4°');
  assert.equal(state.weather.ready,true);
  assert.equal(state.weather.cached,true);
  assert(state.title.includes('Последние данные'));
  assert.deepEqual(errors,[]);
  await context.close();
}

// API unavailable and no valid cache: explicit error, never stale static weather-data.json.
{
  const {context,page}=await makePage({
    handler:route=>route.fulfill({status:503,contentType:'application/json',body:'{}'})
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().error!=='',null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    icon:document.querySelector('#headerWeatherBtn .hu-icon')?.textContent||''
  }));
  assert.equal(state.weather.ready,false);
  assert.equal(state.main,'—°');
  assert.equal(state.icon,'⚠️');
  await context.close();
}

// Manual refresh updates both header and already-open popup.
{
  let temperature=5.2;
  const {context,page,errors}=await makePage({
    handler:route=>route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        current:{temperature_2m:temperature,apparent_temperature:temperature-1,weather_code:1,is_day:1},
        daily
      })
    })
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  await page.click('#headerWeatherBtn');
  await page.waitForSelector('.weather-current-temp');
  assert.equal(await page.locator('.weather-current-temp').textContent(),'+5°');
  temperature=9.2;
  await page.evaluate(()=>window.DiagnostikaWeather.refresh());
  await page.waitForFunction(()=>document.querySelector('.weather-current-temp')?.textContent==='+9°',null,{timeout:10000});
  assert.equal(await page.locator('#headerWeatherBtn .hu-main').textContent(),'+9°');
  assert.deepEqual(errors,[]);
  await context.close();
}

await browser.close();
console.log('WEATHER_LIVE_AUDIT_SUCCESS');
