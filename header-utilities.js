'use strict';

(() => {
  const headerButtons=document.querySelector('.header-buttons');
  const settingsWrap=document.querySelector('.settings-wrap');
  if(!headerButtons||!settingsWrap||document.querySelector('#headerUtilityGroup')) return;

  const LANG={
    ru:{calendar:'Календарь',weather:'Погода',forecast:'Погода · 7 дней',weatherUnavailable:'Нет данных',retry:'Повторить',cached:'Последние данные',converter:'Конвертер валют',from:'Из',to:'В',amount:'Сумма',loading:'Загрузка…',close:'Закрыть',local:'Моя геолокация',sourceWeather:'Данные обновляются автоматически',sourceCurrency:'Курсы ЦБ РФ',weatherSettings:'Настройка погоды',locationMode:'Источник погоды',myLocation:'Моя геолокация',chosenCity:'Выбранный город',city:'Город',findCity:'Найти',saveCity:'Сохранить город',cityNotFound:'Город не найден'},
    en:{calendar:'Calendar',weather:'Weather',forecast:'Weather · 7 days',weatherUnavailable:'No data',retry:'Retry',cached:'Last data',converter:'Currency converter',from:'From',to:'To',amount:'Amount',loading:'Loading…',close:'Close',local:'My location',sourceWeather:'Updates automatically',sourceCurrency:'Central Bank of Russia rates',weatherSettings:'Weather settings',locationMode:'Weather source',myLocation:'My location',chosenCity:'Selected city',city:'City',findCity:'Find',saveCity:'Save city',cityNotFound:'City not found'},
    fr:{calendar:'Calendrier',weather:'Météo',forecast:'Météo · 7 jours',weatherUnavailable:'Indisponible',retry:'Réessayer',cached:'Dernières données',converter:'Convertisseur de devises',from:'De',to:'Vers',amount:'Montant',loading:'Chargement…',close:'Fermer',local:'Ma position',sourceWeather:'Mise à jour automatique',sourceCurrency:'Taux de la Banque centrale de Russie',weatherSettings:'Réglages météo',locationMode:'Source météo',myLocation:'Ma position',chosenCity:'Ville choisie',city:'Ville',findCity:'Rechercher',saveCity:'Enregistrer la ville',cityNotFound:'Ville introuvable'},
    de:{calendar:'Kalender',weather:'Wetter',forecast:'Wetter · 7 Tage',weatherUnavailable:'Keine Daten',retry:'Erneut',cached:'Letzte Daten',converter:'Währungsrechner',from:'Von',to:'Nach',amount:'Betrag',loading:'Laden…',close:'Schließen',local:'Mein Standort',sourceWeather:'Automatische Aktualisierung',sourceCurrency:'Kurse der Zentralbank Russlands',weatherSettings:'Wettereinstellungen',locationMode:'Wetterquelle',myLocation:'Mein Standort',chosenCity:'Gewählte Stadt',city:'Stadt',findCity:'Suchen',saveCity:'Stadt speichern',cityNotFound:'Stadt nicht gefunden'},
    it:{calendar:'Calendario',weather:'Meteo',forecast:'Meteo · 7 giorni',weatherUnavailable:'Nessun dato',retry:'Riprova',cached:'Ultimi dati',converter:'Convertitore valuta',from:'Da',to:'A',amount:'Importo',loading:'Caricamento…',close:'Chiudi',local:'La mia posizione',sourceWeather:'Aggiornamento automatico',sourceCurrency:'Tassi della Banca centrale russa',weatherSettings:'Impostazioni meteo',locationMode:'Fonte meteo',myLocation:'La mia posizione',chosenCity:'Città selezionata',city:'Città',findCity:'Cerca',saveCity:'Salva città',cityNotFound:'Città non trovata'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
  const tr=()=>LANG[lang()]||LANG.en;
  const weatherMode=()=>localStorage.getItem('diagnostika-weather-mode')||'geo';
  const savedCity=()=>{try{return JSON.parse(localStorage.getItem('diagnostika-weather-city')||'null')}catch(_){return null}};
  const cityOnly=v=>String(v||'').split(',')[0].trim()||tr().weather;

  const style=document.createElement('style');
  style.textContent=`
    .header-utility-group{display:flex;align-items:center;gap:8px;margin-right:8px}
    .header-util-btn{height:42px;width:94px;min-width:94px;max-width:94px;padding:4px 8px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;display:grid;grid-template-columns:auto 1fr;grid-template-areas:'icon main' 'sub sub';column-gap:5px;row-gap:1px;align-content:center;justify-content:center;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.22);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
    .header-util-btn:hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 6px 14px rgba(30,41,59,.24)}
    .header-util-btn:active{transform:translateY(1px)}
    .header-calendar-btn{width:122px;min-width:122px;max-width:122px;padding:4px 12px 4px 8px;grid-template-areas:'icon main';grid-template-rows:1fr;align-items:center}
    .header-calendar-btn .hu-main{text-align:center}
    .hu-icon{grid-area:icon;font-size:17px;line-height:1}.hu-main{grid-area:main;font-size:14px;line-height:1;font-weight:800;white-space:nowrap;min-width:0;text-align:left;letter-spacing:.1px}.hu-sub{grid-area:sub;font-size:12px;line-height:1;font-weight:700;opacity:1;text-align:center;white-space:nowrap;max-width:82px;overflow:hidden;text-overflow:ellipsis;margin:0 auto;color:#fff}
    .utility-overlay{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.54);backdrop-filter:blur(6px)}
    .utility-overlay[hidden]{display:none!important}
    .utility-panel{width:min(620px,calc(100vw - 24px));max-height:86dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:16px;box-sizing:border-box;color:#243447}
    .utility-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.utility-head h2{margin:0;font-size:20px}.utility-location-title{font-size:20px;font-weight:800;color:#243447;margin-top:4px}.utility-close{width:36px;height:36px;padding:0!important;border-radius:8px!important}
    .weather-current-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:14px;border:1px solid #d8e3ec;border-radius:12px;background:#fff;margin-bottom:10px}.weather-current-icon{font-size:34px}.weather-current-temp{font-size:28px;font-weight:800}.weather-current-meta{text-align:right;font-size:12px;color:#64748b}
    .weather-days{display:grid;gap:7px}.weather-day{display:grid;grid-template-columns:90px 35px 1fr auto;gap:9px;align-items:center;padding:10px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;font-size:12px}.weather-day strong:last-child{white-space:nowrap}
    .weather-settings{margin-top:12px;padding:13px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}.weather-settings-title{font-size:13px;font-weight:800;margin-bottom:9px}.weather-setting-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.weather-setting-row select,.weather-city-row input{height:40px;border:1px solid #b9c6d4;border-radius:9px;padding:0 10px;background:#fff;box-sizing:border-box;width:100%}.weather-city-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:8px}.weather-city-results{display:grid;gap:5px;margin-top:8px}.weather-city-option{padding:8px 10px;border:1px solid #dbe4ed;border-radius:8px;background:#f8fafc;cursor:pointer;font-size:12px}.weather-city-option:hover{background:#eef6ff}
    .currency-card{padding:14px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}.currency-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end}.currency-field{display:grid;gap:5px;font-size:11px;font-weight:800;color:#64748b}.currency-field select,.currency-field input{height:42px;border:1px solid #b9c6d4;border-radius:9px;padding:0 10px;background:#fff;font:inherit;box-sizing:border-box;width:100%}.currency-swap{height:42px!important;width:42px!important;padding:0!important;border-radius:9px!important}.currency-amount-wrap{margin-top:10px}.currency-result{margin-top:12px;padding:13px;border-radius:11px;background:#eef7f4;border:1px solid #c9e1d8}.currency-result-main{font-size:24px;font-weight:800}.currency-rate{margin-top:5px;font-size:12px;color:#64748b}.utility-source{margin-top:10px;text-align:center;color:#94a3b8;font-size:10px}
    @media(max-width:760px){.header-utility-group{gap:5px;margin-right:5px}.header-util-btn{width:78px;min-width:78px;max-width:78px;height:42px;padding:4px 6px}.hu-icon{font-size:15px}.hu-main{font-size:12px}.hu-sub{font-size:10px;max-width:68px}.app-header h1{font-size:18px!important}.utility-overlay{place-items:end center;padding:0}.utility-panel{width:100%;max-height:88dvh;border-radius:18px 18px 0 0}.weather-day{grid-template-columns:72px 30px 1fr auto}.weather-day .desc{display:none}.weather-setting-row{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const calendarDateLabel=()=>new Intl.DateTimeFormat(lang()==='ru'?'ru-RU':lang(),{day:'numeric',month:'long'}).format(new Date());
  const group=document.createElement('div');group.id='headerUtilityGroup';group.className='header-utility-group';
  group.innerHTML=`<button id="headerWeatherBtn" type="button" class="header-util-btn"><span class="hu-icon">🌤️</span><span class="hu-main">—°</span><span class="hu-sub">${tr().weather}</span></button><button id="headerCalendarBtn" type="button" class="header-util-btn header-calendar-btn" title="${tr().calendar}" aria-label="${tr().calendar}"><span class="hu-icon">📅</span><span class="hu-main">${calendarDateLabel()}</span></button><button id="headerCurrencyBtn" type="button" class="header-util-btn"><span class="hu-icon">💱</span><span class="hu-main">— ₽</span><span class="hu-sub">USD</span></button>`;
  headerButtons.insertBefore(group,settingsWrap);
  const weatherBtn=group.querySelector('#headerWeatherBtn'),calendarBtn=group.querySelector('#headerCalendarBtn'),currencyBtn=group.querySelector('#headerCurrencyBtn');

  function openExistingCalendar(){
    if(typeof window.DiagnostikaCalendar?.open==='function'){
      window.DiagnostikaCalendar.open({mode:'overview'});
      return true;
    }
    if(typeof window.DiagnostikaCalendarUI?.open==='function'){
      window.DiagnostikaCalendarUI.open({mode:'overview'});
      return true;
    }
    const clientCalendar=document.getElementById('ccCalendarBtn');
    if(clientCalendar){
      clientCalendar.click();
      return true;
    }
    return false;
  }
  calendarBtn.onclick=openExistingCalendar;

  const overlay=document.createElement('div');overlay.className='utility-overlay';overlay.hidden=true;document.body.appendChild(overlay);
  function openPanel(html){overlay.innerHTML=`<section class="utility-panel">${html}</section>`;overlay.hidden=false;document.documentElement.style.overflow='hidden';const close=overlay.querySelector('.utility-close');if(close)close.onclick=closePanel;}
  function closePanel(){overlay.hidden=true;overlay.innerHTML='';document.documentElement.style.overflow='';}
  overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closePanel();});

  function weatherIcon(code,isDay=true){if(code===0)return isDay?'☀️':'🌙';if(code<=2)return'🌤️';if(code===3)return'☁️';if(code===45||code===48)return'🌫️';if(code>=51&&code<=67)return'🌧️';if(code>=71&&code<=77)return'🌨️';if(code>=80&&code<=82)return'🌦️';if(code>=85&&code<=86)return'🌨️';if(code>=95)return'⛈️';return'🌡️';}
  const finite=n=>Number.isFinite(Number(n));
  const signed=n=>finite(n)?`${Number(n)>0?'+':''}${Math.round(Number(n))}°`:'—°';
  const WEATHER_FEED_URL='./weather-data.json';
  const WEATHER_FEED_CACHE_KEY='diagnostika-weather-feed-local-v1';
  const WEATHER_CURRENT_KEY='diagnostika-weather-current-local';
  const WEATHER_FORECAST_KEY='diagnostika-weather-forecast-local';
  const WEATHER_LAST_CITY_KEY='diagnostika-weather-last-city';
  const WEATHER_REFRESH_MS=15*60*1000;
  let weatherFeed=null,weatherData=null,weatherLabel='',weatherError='',weatherFromCache=false,weatherUpdatedAt='';

  function normalizeWeatherEntry(entry){
    if(!entry||typeof entry!=='object')throw Error('weather-entry');
    if(!finite(entry.current?.temperature_2m))throw Error('weather-temperature');
    if(!Array.isArray(entry.daily?.time)||entry.daily.time.length<7)throw Error('weather-forecast');
    return entry;
  }

  function normalizeWeatherFeed(feed){
    if(!feed||typeof feed!=='object'||!Array.isArray(feed.cities))throw Error('weather-feed');
    const cities=feed.cities.map(normalizeWeatherEntry);
    if(!cities.length)throw Error('weather-feed-empty');
    return {...feed,cities};
  }

  function readFeedCache(){
    try{
      const cached=JSON.parse(localStorage.getItem(WEATHER_FEED_CACHE_KEY)||'null');
      return cached?.feed?normalizeWeatherFeed(cached.feed):null;
    }catch(_){return null;}
  }

  function saveFeedCache(feed){
    try{localStorage.setItem(WEATHER_FEED_CACHE_KEY,JSON.stringify({savedAt:Date.now(),feed}));}catch(_){}
  }

  function saveWeatherLocal(entry){
    try{
      const city={id:entry.id,name:entry.name,country:entry.country||'',admin:entry.admin||'',latitude:entry.latitude,longitude:entry.longitude};
      localStorage.setItem(WEATHER_CURRENT_KEY,JSON.stringify({savedAt:Date.now(),city,current:entry.current}));
      localStorage.setItem(WEATHER_FORECAST_KEY,JSON.stringify({savedAt:Date.now(),city,daily:entry.daily}));
      localStorage.setItem(WEATHER_LAST_CITY_KEY,String(entry.id||entry.name||''));
    }catch(_){}
  }

  async function loadWeatherFeed({force=false}={}){
    if(weatherFeed&&!force)return weatherFeed;
    try{
      const response=await fetch(`./weather-data.json?t=${Date.now()}`,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw Error(`weather-json-${response.status}`);
      const feed=normalizeWeatherFeed(await response.json());
      weatherFeed=feed;
      weatherFromCache=false;
      weatherUpdatedAt=feed._updated_utc||'';
      saveFeedCache(feed);
      return feed;
    }catch(error){
      const cached=readFeedCache();
      if(cached){
        weatherFeed=cached;
        weatherFromCache=true;
        weatherUpdatedAt=cached._updated_utc||'';
        return cached;
      }
      throw error;
    }
  }

  function haversineKm(aLat,aLon,bLat,bLon){
    const rad=x=>Number(x)*Math.PI/180;
    const dLat=rad(Number(bLat)-Number(aLat)),dLon=rad(Number(bLon)-Number(aLon));
    const a=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }

  function nearestWeatherCity(cities,lat,lon){
    let best=null,bestDistance=Infinity;
    for(const city of cities||[]){
      if(!finite(city.latitude)||!finite(city.longitude))continue;
      const distance=haversineKm(lat,lon,city.latitude,city.longitude);
      if(distance<bestDistance){best=city;bestDistance=distance;}
    }
    return best;
  }

  function findWeatherCity(feed,ref){
    if(!feed?.cities?.length||!ref)return null;
    const id=String(ref.id||ref||'').toLowerCase();
    const name=String(ref.name||'').toLowerCase();
    return feed.cities.find(city=>String(city.id||'').toLowerCase()===id)
      ||feed.cities.find(city=>String(city.name||'').toLowerCase()===name)
      ||null;
  }

  function lastWeatherCity(feed){
    const id=localStorage.getItem(WEATHER_LAST_CITY_KEY)||'';
    return findWeatherCity(feed,id)||findWeatherCity(feed,savedCity());
  }

  function applyWeatherEntry(entry,{cached=weatherFromCache}={}){
    entry=normalizeWeatherEntry(entry);
    weatherData={current:entry.current,daily:entry.daily};
    weatherLabel=cityOnly(entry.name);
    weatherError='';
    weatherFromCache=Boolean(cached);
    const current=entry.current||{};
    weatherBtn.querySelector('.hu-icon').textContent=weatherIcon(Number(current.weather_code),current.is_day!==0);
    weatherBtn.querySelector('.hu-main').textContent=signed(current.temperature_2m);
    weatherBtn.querySelector('.hu-sub').textContent=weatherLabel;
    weatherBtn.title=weatherFromCache?`${tr().cached}: ${weatherLabel}`:weatherLabel;
    saveWeatherLocal(entry);
    return entry;
  }

  function showWeatherUnavailable(label=''){
    weatherData=null;
    weatherLabel=cityOnly(label||tr().weather);
    weatherBtn.querySelector('.hu-icon').textContent='⚠️';
    weatherBtn.querySelector('.hu-main').textContent='—°';
    weatherBtn.querySelector('.hu-sub').textContent=weatherLabel;
    weatherBtn.title=tr().weatherUnavailable;
  }

  function geolocationWeather(feed){
    return new Promise(resolve=>{
      const fallback=()=>{
        const last=lastWeatherCity(feed);
        if(last){resolve(applyWeatherEntry(last));return;}
        showWeatherUnavailable();
        resolve(null);
      };
      if(!navigator.geolocation){fallback();return;}
      navigator.geolocation.getCurrentPosition(position=>{
        const city=nearestWeatherCity(feed.cities,position.coords.latitude,position.coords.longitude);
        if(city){resolve(applyWeatherEntry(city));return;}
        fallback();
      },fallback,{enableHighAccuracy:false,timeout:6000,maximumAge:30*60*1000});
    });
  }

  async function initWeather({force=false}={}){
    try{
      const feed=await loadWeatherFeed({force});
      if(weatherMode()==='city'){
        const selected=findWeatherCity(feed,savedCity());
        if(selected)return applyWeatherEntry(selected);
      }
      return await geolocationWeather(feed);
    }catch(error){
      weatherError=String(error?.message||error||'weather');
      showWeatherUnavailable(weatherLabel);
      return null;
    }
  }

  function searchCities(q){
    const needle=String(q||'').trim().toLowerCase();
    if(!needle||!weatherFeed?.cities?.length)return [];
    return weatherFeed.cities
      .filter(city=>{
        const values=[city.name,city.admin,city.country,...(Array.isArray(city.aliases)?city.aliases:[])];
        return values.some(value=>String(value||'').toLowerCase().includes(needle));
      })
      .slice(0,12);
  }

  function showWeather(){
    const t=tr();
    if(!weatherData){
      openPanel(`<div class="utility-head"><h2>${t.forecast}</h2><button class="utility-close">×</button></div><div id="weatherLoadState">${t.loading}</div><div style="margin-top:12px"><button type="button" id="weatherRetryBtn" class="tk-btn">${t.retry}</button></div>`);
      const retry=overlay.querySelector('#weatherRetryBtn');
      const state=overlay.querySelector('#weatherLoadState');
      const run=async()=>{
        if(retry)retry.disabled=true;
        if(state)state.textContent=t.loading;
        await initWeather({force:true});
        if(overlay.hidden)return;
        if(weatherData){showWeather();return;}
        if(state)state.textContent=t.weatherUnavailable;
        if(retry)retry.disabled=false;
      };
      if(retry)retry.onclick=run;
      run();
      return;
    }

    const c=weatherData.current||{},d=weatherData.daily||{};
    const rows=(d.time||[]).map((date,i)=>{
      const locale=lang()==='ru'?'ru-RU':lang();
      const day=new Intl.DateTimeFormat(locale,{weekday:'short',day:'numeric',month:'short'}).format(new Date(date+'T12:00:00'));
      const rain=Math.round(Number(d.precipitation_probability_max?.[i]||0));
      const wind=Math.round(Number(d.wind_speed_10m_max?.[i]||0));
      return `<div class="weather-day"><strong>${day}</strong><span>${weatherIcon(Number(d.weather_code?.[i]))}</span><span class="desc">💧 ${rain}% · 💨 ${wind} км/ч</span><strong>${signed(d.temperature_2m_max?.[i])} / ${signed(d.temperature_2m_min?.[i])}</strong></div>`;
    }).join('');

    const selected=savedCity();
    openPanel(`<div class="utility-head"><div><h2>${t.forecast}</h2><div class="utility-location-title">📍 ${weatherLabel}</div></div><button class="utility-close">×</button></div><div class="weather-current-card"><div class="weather-current-icon">${weatherIcon(Number(c.weather_code),c.is_day!==0)}</div><div class="weather-current-temp">${signed(c.temperature_2m)}</div><div class="weather-current-meta">${weatherFromCache?t.cached:t.sourceWeather}<br><strong>${signed(c.apparent_temperature)}</strong></div></div><div class="weather-days">${rows}</div><div class="weather-settings"><div class="weather-settings-title">⚙ ${t.weatherSettings}</div><div class="weather-setting-row"><label>${t.locationMode}<select id="weatherModeSelect"><option value="geo" ${weatherMode()==='geo'?'selected':''}>${t.myLocation}</option><option value="city" ${weatherMode()==='city'?'selected':''}>${t.chosenCity}</option></select></label><label>${t.city}<div class="weather-city-row"><input id="weatherCityInput" value="${String(selected?.name||'').replace(/"/g,'&quot;')}" autocomplete="off"><button id="weatherCityFind" type="button" class="tk-btn">${t.findCity}</button></div></label></div><div id="weatherCityResults" class="weather-city-results"></div></div><div class="utility-source">${t.sourceWeather}${weatherUpdatedAt?' · '+new Date(weatherUpdatedAt).toLocaleString(lang()==='ru'?'ru-RU':lang()):''}</div>`);

    const modeSelect=overlay.querySelector('#weatherModeSelect');
    const input=overlay.querySelector('#weatherCityInput');
    const find=overlay.querySelector('#weatherCityFind');
    const results=overlay.querySelector('#weatherCityResults');

    modeSelect.onchange=async()=>{
      localStorage.setItem('diagnostika-weather-mode',modeSelect.value);
      if(modeSelect.value==='geo'){
        await initWeather();
        showWeather();
        return;
      }
      const selectedCity=findWeatherCity(weatherFeed,savedCity());
      if(selectedCity){applyWeatherEntry(selectedCity);showWeather();return;}
      input?.focus();
    };

    const runSearch=()=>{
      const found=searchCities(input?.value);
      if(!found.length){results.textContent=t.cityNotFound;return;}
      results.innerHTML=found.map((city,i)=>`<div class="weather-city-option" data-i="${i}"><strong>${city.name}</strong>${city.admin?', '+city.admin:''}${city.country?', '+city.country:''}</div>`).join('');
      results.querySelectorAll('.weather-city-option').forEach(el=>el.onclick=()=>{
        const city=found[Number(el.dataset.i)];
        const cityObj={id:city.id,name:city.name,latitude:city.latitude,longitude:city.longitude};
        localStorage.setItem('diagnostika-weather-city',JSON.stringify(cityObj));
        localStorage.setItem('diagnostika-weather-mode','city');
        applyWeatherEntry(city);
        showWeather();
      });
    };
    find.onclick=runSearch;
    input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();runSearch();}};
  }
  weatherBtn.onclick=showWeather;

  let rates=null,rateDate='';
  const rubPer=code=>code==='RUB'?1:rates?.[code]?.rubPerUnit;
  const fmt2=n=>Number(n).toLocaleString(lang()==='ru'?'ru-RU':lang(),{minimumFractionDigits:2,maximumFractionDigits:2});
  async function loadRates(){
    try{const r=await fetch('https://www.cbr-xml-daily.ru/daily_json.js',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();rates={RUB:{name:'Российский рубль',rubPerUnit:1}};for(const v of Object.values(data.Valute||{}))rates[v.CharCode]={name:v.Name,rubPerUnit:Number(v.Value)/Number(v.Nominal)};rateDate=data.Date?new Date(data.Date).toLocaleDateString('ru-RU'):'';localStorage.setItem('diagnostika-currency-rates',JSON.stringify({rates,rateDate}));}
    catch(e){try{const s=JSON.parse(localStorage.getItem('diagnostika-currency-rates')||'null');if(s?.rates){rates=s.rates;rateDate=s.rateDate||'';}}catch(_){}}
    if(rates?.USD){currencyBtn.querySelector('.hu-main').textContent=`${fmt2(rates.USD.rubPerUnit)} ₽`;currencyBtn.querySelector('.hu-sub').textContent='USD';}
  }
  function showConverter(){
    const t=tr();if(!rates){openPanel(`<div class="utility-head"><h2>${t.converter}</h2><button class="utility-close">×</button></div><div>${t.loading}</div>`);loadRates().then(()=>{if(!overlay.hidden)showConverter();});return;}
    const priority=['RUB','USD','EUR','KZT','CNY','GBP','CHF','JPY','TRY'];const all=Object.keys(rates).sort((a,b)=>{const ai=priority.indexOf(a),bi=priority.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b);});const opts=(sel)=>all.map(code=>`<option value="${code}" ${code===sel?'selected':''}>${code}</option>`).join('');
    openPanel(`<div class="utility-head"><h2>${t.converter}</h2><button class="utility-close">×</button></div><div class="currency-card"><div class="currency-row"><label class="currency-field">${t.from}<select id="utilCurFrom">${opts('USD')}</select></label><button type="button" class="tk-btn currency-swap">⇄</button><label class="currency-field">${t.to}<select id="utilCurTo">${opts('RUB')}</select></label></div><label class="currency-field currency-amount-wrap">${t.amount}<input id="utilCurAmount" inputmode="decimal" value="1"></label><div class="currency-result"><div id="utilCurResult" class="currency-result-main">—</div><div id="utilCurRate" class="currency-rate"></div></div></div><div class="utility-source">${t.sourceCurrency}${rateDate?' · '+rateDate:''}</div>`);
    const from=overlay.querySelector('#utilCurFrom'),to=overlay.querySelector('#utilCurTo'),amount=overlay.querySelector('#utilCurAmount'),result=overlay.querySelector('#utilCurResult'),rate=overlay.querySelector('#utilCurRate'),swap=overlay.querySelector('.currency-swap');
    const update=()=>{const v=Number(amount.value.replace(',','.').replace(/\s/g,'')),a=rubPer(from.value),b=rubPer(to.value);if(!Number.isFinite(v)||!a||!b){result.textContent='—';return;}const x=v*a/b,one=a/b;result.textContent=`${fmt2(x)} ${to.value}`;rate.textContent=`1 ${from.value} = ${fmt2(one)} ${to.value}`;};
    from.onchange=update;to.onchange=update;amount.oninput=update;swap.onclick=()=>{const v=from.value;from.value=to.value;to.value=v;update();};update();
  }
  currencyBtn.onclick=showConverter;

  function refreshLanguage(){
    weatherBtn.querySelector('.hu-sub').textContent=weatherLabel||tr().weather;
    calendarBtn.querySelector('.hu-main').textContent=calendarDateLabel();
    calendarBtn.title=tr().calendar;
    calendarBtn.setAttribute('aria-label',tr().calendar);
  }
  const oldSet=window.DiagnostikaI18n?.setLanguage;if(oldSet){window.DiagnostikaI18n.setLanguage=function(l){const r=oldSet.call(this,l);setTimeout(()=>{refreshLanguage();initWeather();},0);return r;};}
  window.DiagnostikaWeather=Object.freeze({
    refresh:()=>initWeather(),
    state:()=>Object.freeze({
      ready:Boolean(weatherData),
      label:weatherLabel,
      temperature:weatherData?.current?.temperature_2m??null,
      cached:weatherFromCache,
      error:weatherError,
      mode:weatherMode()
    })
  });

  initWeather();loadRates();setTimeout(refreshLanguage,0);setInterval(()=>initWeather({force:true}),WEATHER_REFRESH_MS);
})();