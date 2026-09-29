import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('header-utilities.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(index.includes('header-utilities.js?v=20260929-weather21a'),'Weather cache marker missing');
assert(src.includes("const WEATHER_CACHE_KEY='diagnostika-weather-cache-v2'"),'Weather cache missing');
assert(src.includes('current_weather=true'),'Legacy Open-Meteo fallback missing');
assert(src.includes('window.DiagnostikaWeather=Object.freeze'),'Weather diagnostics missing');

const browser=await chromium.launch({headless:true});

const daily={
  time:['2026-09-29','2026-09-30'],
  weather_code:[1,2],
  temperature_2m_max:[8,9],
  temperature_2m_min:[1,2],
  precipitation_probability_max:[10,20]
};

async function makePage({mode='city',cache=null,handler}={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({mode,cache})=>{
    localStorage.setItem('diagnostika-ui-language','ru');
    localStorage.setItem('diagnostika-weather-mode',mode);
    localStorage.setItem('diagnostika-weather-city',JSON.stringify({name:'Киров',latitude:58.6036,longitude:49.6680}));
    if(cache)localStorage.setItem('diagnostika-weather-cache-v2',JSON.stringify(cache));
  },{mode,cache});
  const page=await context.newPage();
  if(handler)await page.route('https://api.open-meteo.com/**',handler);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8000/index.html?weather21a='+Date.now(),{waitUntil:'commit',timeout:15000});
  await page.waitForFunction(()=>window.DiagnostikaWeather?.state,null,{timeout:15000});
  return {context,page,errors};
}

// Modern API success.
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
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:8000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    sub:document.querySelector('#headerWeatherBtn .hu-sub')?.textContent||''
  }));
  assert.equal(state.main,'+6°');
  assert.equal(state.sub,'Киров');
  assert.equal(state.weather.cached,false);
  assert.equal(state.weather.error,'');
  assert.deepEqual(errors,[]);
  await context.close();
}

// Modern request fails, legacy current_weather succeeds.
{
  let modernCalls=0;
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
      modernCalls++;
      return route.fulfill({status:500,contentType:'application/json',body:'{}'});
    }
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().ready===true,null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||''
  }));
  assert(modernCalls>=1,'Modern weather request was not attempted');
  assert(legacyCalls>=1,'Legacy weather fallback was not attempted');
  assert.equal(state.main,'-3°');
  assert.equal(state.weather.temperature,-3.2);
  assert.deepEqual(errors,[]);
  await context.close();
}

// Both requests fail: valid cache must keep temperature visible.
{
  const cache={
    savedAt:Date.now()-10*60*1000,
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

// No API and no cache: show explicit error state, not a fake successful value.
{
  const {context,page}=await makePage({
    handler:route=>route.fulfill({status:503,contentType:'application/json',body:'{}'})
  });
  await page.waitForFunction(()=>window.DiagnostikaWeather.state().error!=='',null,{timeout:10000});
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    icon:document.querySelector('#headerWeatherBtn .hu-icon')?.textContent||'',
    title:document.querySelector('#headerWeatherBtn')?.title||''
  }));
  assert.equal(state.weather.ready,false);
  assert.equal(state.main,'—°');
  assert.equal(state.icon,'⚠️');
  assert.equal(state.title,'Нет данных');
  await context.close();
}


// Live provider diagnostic: do not mock Open-Meteo.
{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{
    localStorage.setItem('diagnostika-ui-language','ru');
    localStorage.setItem('diagnostika-weather-mode','city');
    localStorage.setItem('diagnostika-weather-city',JSON.stringify({name:'Киров',latitude:58.6036,longitude:49.6680}));
    localStorage.removeItem('diagnostika-weather-cache-v2');
  });
  const page=await context.newPage();
  const consoleErrors=[];
  const failed=[];
  page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
  page.on('requestfailed',req=>failed.push({url:req.url(),failure:req.failure()?.errorText||''}));
  page.on('response',res=>{
    if(res.url().includes('open-meteo')||res.url().includes('bigdatacloud')){
      console.log('WEATHER_LIVE_RESPONSE',res.status(),res.url());
    }
  });
  await page.goto('http://127.0.0.1:8000/index.html?weather-live='+Date.now(),{waitUntil:'commit',timeout:15000});
  await page.waitForFunction(()=>window.DiagnostikaWeather?.state,null,{timeout:15000});
  await page.waitForTimeout(10000);
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    sub:document.querySelector('#headerWeatherBtn .hu-sub')?.textContent||'',
    title:document.querySelector('#headerWeatherBtn')?.title||''
  }));
  console.log('WEATHER_LIVE_STATE',JSON.stringify(state));
  console.log('WEATHER_LIVE_FAILED',JSON.stringify(failed));
  console.log('WEATHER_LIVE_CONSOLE_ERRORS',JSON.stringify(consoleErrors));
  await context.close();
}


// Production weather diagnostic against deployed GitHub Pages.
{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{
    localStorage.setItem('diagnostika-ui-language','ru');
    localStorage.setItem('diagnostika-weather-mode','city');
    localStorage.setItem('diagnostika-weather-city',JSON.stringify({name:'Киров',latitude:58.6036,longitude:49.6680}));
    localStorage.removeItem('diagnostika-weather-cache-v2');
  });
  const page=await context.newPage();
  const consoleErrors=[];
  const failed=[];
  page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
  page.on('requestfailed',req=>failed.push({url:req.url(),failure:req.failure()?.errorText||''}));
  page.on('response',res=>{
    if(res.url().includes('open-meteo')||res.url().includes('bigdatacloud')||res.url().includes('header-utilities')){
      console.log('WEATHER_PROD_RESPONSE',res.status(),res.url());
    }
  });
  await page.goto('https://inkermankirov-a11y.github.io/Diagnostika_SS/?weather-prod='+Date.now(),{waitUntil:'commit',timeout:20000});
  await page.waitForFunction(()=>window.DiagnostikaWeather?.state,null,{timeout:20000});
  await page.waitForTimeout(10000);
  const state=await page.evaluate(()=>({
    weather:window.DiagnostikaWeather.state(),
    main:document.querySelector('#headerWeatherBtn .hu-main')?.textContent||'',
    sub:document.querySelector('#headerWeatherBtn .hu-sub')?.textContent||'',
    title:document.querySelector('#headerWeatherBtn')?.title||'',
    hasButton:Boolean(document.querySelector('#headerWeatherBtn')),
    readyClass:document.documentElement.classList.contains('diagnostika-dashboard-ready')
  }));
  console.log('WEATHER_PROD_STATE',JSON.stringify(state));
  console.log('WEATHER_PROD_FAILED',JSON.stringify(failed));
  console.log('WEATHER_PROD_CONSOLE_ERRORS',JSON.stringify(consoleErrors));
  await context.close();
}

await browser.close();
console.log('WEATHER_21A_SUCCESS',JSON.stringify({
  modern:true,
  legacyFallback:true,
  cachedFallback:true,
  explicitFailure:true
}));

// rerun production weather diagnostic after WEATHER 21B deploy
