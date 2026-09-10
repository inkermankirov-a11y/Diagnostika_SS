'use strict';

(() => {
  const headerButtons=document.querySelector('.header-buttons');
  const settingsWrap=document.querySelector('.settings-wrap');
  if(!headerButtons||!settingsWrap||document.querySelector('#headerUtilityGroup')) return;

  const LANG={
    ru:{weather:'Погода',forecast:'Погода · 7 дней',converter:'Конвертер валют',from:'Из',to:'В',amount:'Сумма',loading:'Загрузка…',close:'Закрыть',local:'Текущая',sourceWeather:'Данные Open-Meteo',sourceCurrency:'Курсы ЦБ РФ'},
    en:{weather:'Weather',forecast:'Weather · 7 days',converter:'Currency converter',from:'From',to:'To',amount:'Amount',loading:'Loading…',close:'Close',local:'Current',sourceWeather:'Data: Open-Meteo',sourceCurrency:'Central Bank of Russia rates'},
    fr:{weather:'Météo',forecast:'Météo · 7 jours',converter:'Convertisseur de devises',from:'De',to:'Vers',amount:'Montant',loading:'Chargement…',close:'Fermer',local:'Actuelle',sourceWeather:'Données Open-Meteo',sourceCurrency:'Taux de la Banque centrale de Russie'},
    de:{weather:'Wetter',forecast:'Wetter · 7 Tage',converter:'Währungsrechner',from:'Von',to:'Nach',amount:'Betrag',loading:'Laden…',close:'Schließen',local:'Aktuell',sourceWeather:'Daten: Open-Meteo',sourceCurrency:'Kurse der Zentralbank Russlands'},
    it:{weather:'Meteo',forecast:'Meteo · 7 giorni',converter:'Convertitore valuta',from:'Da',to:'A',amount:'Importo',loading:'Caricamento…',close:'Chiudi',local:'Attuale',sourceWeather:'Dati Open-Meteo',sourceCurrency:'Tassi della Banca centrale russa'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
  const tr=()=>LANG[lang()]||LANG.en;

  const style=document.createElement('style');
  style.textContent=`
    .header-utility-group{display:flex;align-items:center;gap:7px;margin-right:7px}
    .header-util-btn{height:42px;min-width:76px;padding:5px 10px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;display:grid;grid-template-columns:auto auto;grid-template-areas:'icon main' 'sub sub';column-gap:5px;row-gap:1px;align-content:center;justify-content:center;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.22);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
    .header-util-btn:hover{transform:translateY(-1px);filter:brightness(1.08);box-shadow:0 6px 14px rgba(30,41,59,.24)}
    .header-util-btn:active{transform:translateY(1px)}
    .hu-icon{grid-area:icon;font-size:15px;line-height:1}.hu-main{grid-area:main;font-size:12px;font-weight:800;white-space:nowrap}.hu-sub{grid-area:sub;font-size:9px;opacity:.82;text-align:center;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis}
    .utility-overlay{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.54);backdrop-filter:blur(6px)}
    .utility-panel{width:min(620px,calc(100vw - 24px));max-height:86dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:16px;box-sizing:border-box;color:#243447}
    .utility-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.utility-head h2{margin:0;font-size:20px}.utility-close{width:36px;height:36px;padding:0!important;border-radius:8px!important}
    .weather-current-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:14px;border:1px solid #d8e3ec;border-radius:12px;background:#fff;margin-bottom:10px}.weather-current-icon{font-size:34px}.weather-current-temp{font-size:28px;font-weight:800}.weather-current-meta{text-align:right;font-size:12px;color:#64748b}
    .weather-days{display:grid;gap:7px}.weather-day{display:grid;grid-template-columns:90px 35px 1fr auto;gap:9px;align-items:center;padding:10px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;font-size:12px}.weather-day strong:last-child{white-space:nowrap}
    .currency-card{padding:14px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}.currency-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end}.currency-field{display:grid;gap:5px;font-size:11px;font-weight:800;color:#64748b}.currency-field select,.currency-field input{height:42px;border:1px solid #b9c6d4;border-radius:9px;padding:0 10px;background:#fff;font:inherit;box-sizing:border-box;width:100%}.currency-swap{height:42px!important;width:42px!important;padding:0!important;border-radius:9px!important}.currency-amount-wrap{margin-top:10px}.currency-result{margin-top:12px;padding:13px;border-radius:11px;background:#eef7f4;border:1px solid #c9e1d8}.currency-result-main{font-size:24px;font-weight:800}.currency-rate{margin-top:5px;font-size:12px;color:#64748b}.utility-source{margin-top:10px;text-align:center;color:#94a3b8;font-size:10px}
    @media(max-width:760px){.header-utility-group{gap:5px;margin-right:5px}.header-util-btn{min-width:50px;width:50px;padding:3px}.hu-sub{display:none}.hu-main{font-size:10px}.app-header h1{font-size:18px!important}.utility-overlay{place-items:end center;padding:0}.utility-panel{width:100%;max-height:88dvh;border-radius:18px 18px 0 0}.weather-day{grid-template-columns:72px 30px 1fr auto}.weather-day .desc{display:none}}
  `;
  document.head.appendChild(style);

  const group=document.createElement('div');group.id='headerUtilityGroup';group.className='header-utility-group';
  group.innerHTML=`<button id="headerWeatherBtn" type="button" class="header-util-btn"><span class="hu-icon">🌤️</span><span class="hu-main">—°</span><span class="hu-sub">${tr().weather}</span></button><button id="headerCurrencyBtn" type="button" class="header-util-btn"><span class="hu-icon">💱</span><span class="hu-main">USD —</span><span class="hu-sub">${tr().converter}</span></button>`;
  headerButtons.insertBefore(group,settingsWrap);
  const weatherBtn=group.querySelector('#headerWeatherBtn'),currencyBtn=group.querySelector('#headerCurrencyBtn');

  const overlay=document.createElement('div');overlay.className='utility-overlay';overlay.hidden=true;document.body.appendChild(overlay);
  function openPanel(html){overlay.innerHTML=`<section class="utility-panel">${html}</section>`;overlay.hidden=false;document.documentElement.style.overflow='hidden';const close=overlay.querySelector('.utility-close');if(close)close.onclick=closePanel;}
  function closePanel(){overlay.hidden=true;overlay.innerHTML='';document.documentElement.style.overflow='';}
  overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closePanel();});

  function weatherIcon(code,isDay=true){if(code===0)return isDay?'☀️':'🌙';if(code<=2)return'🌤️';if(code===3)return'☁️';if(code===45||code===48)return'🌫️';if(code>=51&&code<=67)return'🌧️';if(code>=71&&code<=77)return'🌨️';if(code>=80&&code<=82)return'🌦️';if(code>=85&&code<=86)return'🌨️';if(code>=95)return'⛈️';return'🌡️';}
  const signed=n=>`${Number(n)>0?'+':''}${Math.round(Number(n))}°`;
  let weatherData=null,weatherLabel='';
  async function fetchWeather(lat,lon,label){
    weatherLabel=label;
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
    const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('weather');weatherData=await r.json();
    weatherBtn.querySelector('.hu-icon').textContent=weatherIcon(Number(weatherData.current?.weather_code),Boolean(weatherData.current?.is_day));weatherBtn.querySelector('.hu-main').textContent=signed(weatherData.current?.temperature_2m);weatherBtn.querySelector('.hu-sub').textContent=weatherLabel;
  }
  function initWeather(){
    const fallback=()=>fetchWeather(58.6036,49.6680,'Киров').catch(()=>{});
    if(!navigator.geolocation){fallback();return;}
    navigator.geolocation.getCurrentPosition(p=>fetchWeather(p.coords.latitude,p.coords.longitude,tr().local).catch(fallback),fallback,{enableHighAccuracy:false,timeout:5000,maximumAge:1800000});
  }
  function showWeather(){
    const t=tr();if(!weatherData){openPanel(`<div class="utility-head"><h2>${t.forecast}</h2><button class="utility-close">×</button></div><div>${t.loading}</div>`);return;}
    const c=weatherData.current||{},d=weatherData.daily||{};
    const rows=(d.time||[]).map((date,i)=>{const day=new Intl.DateTimeFormat(lang()==='ru'?'ru-RU':lang(),{weekday:'short',day:'numeric',month:'short'}).format(new Date(date+'T12:00:00'));return `<div class="weather-day"><strong>${day}</strong><span>${weatherIcon(Number(d.weather_code?.[i]))}</span><span class="desc">💧 ${Math.round(Number(d.precipitation_probability_max?.[i]||0))}%</span><strong>${signed(d.temperature_2m_max?.[i])} / ${signed(d.temperature_2m_min?.[i])}</strong></div>`;}).join('');
    openPanel(`<div class="utility-head"><div><h2>${t.forecast}</h2><div style="font-size:12px;color:#64748b">${weatherLabel}</div></div><button class="utility-close">×</button></div><div class="weather-current-card"><div class="weather-current-icon">${weatherIcon(Number(c.weather_code),Boolean(c.is_day))}</div><div class="weather-current-temp">${signed(c.temperature_2m)}</div><div class="weather-current-meta">${t.local}<br><strong>${signed(c.apparent_temperature)}</strong></div></div><div class="weather-days">${rows}</div><div class="utility-source">${t.sourceWeather}</div>`);
  }
  weatherBtn.onclick=showWeather;

  let rates=null,rateDate='';
  const rubPer=code=>code==='RUB'?1:rates?.[code]?.rubPerUnit;
  const fmt=n=>Number(n).toLocaleString(lang()==='ru'?'ru-RU':lang(),{maximumFractionDigits:4});
  async function loadRates(){
    try{const r=await fetch('https://www.cbr-xml-daily.ru/daily_json.js',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();rates={RUB:{name:'Российский рубль',rubPerUnit:1}};for(const v of Object.values(data.Valute||{}))rates[v.CharCode]={name:v.Name,rubPerUnit:Number(v.Value)/Number(v.Nominal)};rateDate=data.Date?new Date(data.Date).toLocaleDateString('ru-RU'):'';localStorage.setItem('diagnostika-currency-rates',JSON.stringify({rates,rateDate}));}
    catch(e){try{const s=JSON.parse(localStorage.getItem('diagnostika-currency-rates')||'null');if(s?.rates){rates=s.rates;rateDate=s.rateDate||'';}}catch(_){}}
    if(rates?.USD){currencyBtn.querySelector('.hu-main').textContent=`USD ${fmt(rates.USD.rubPerUnit)} ₽`;}
  }
  function showConverter(){
    const t=tr();if(!rates){openPanel(`<div class="utility-head"><h2>${t.converter}</h2><button class="utility-close">×</button></div><div>${t.loading}</div>`);loadRates().then(()=>{if(!overlay.hidden)showConverter();});return;}
    const priority=['RUB','USD','EUR','KZT','CNY','GBP','CHF','JPY','TRY'];const all=Object.keys(rates).sort((a,b)=>{const ai=priority.indexOf(a),bi=priority.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b);});const opts=(sel)=>all.map(code=>`<option value="${code}" ${code===sel?'selected':''}>${code}</option>`).join('');
    openPanel(`<div class="utility-head"><h2>${t.converter}</h2><button class="utility-close">×</button></div><div class="currency-card"><div class="currency-row"><label class="currency-field">${t.from}<select id="utilCurFrom">${opts('USD')}</select></label><button type="button" class="tk-btn currency-swap">⇄</button><label class="currency-field">${t.to}<select id="utilCurTo">${opts('RUB')}</select></label></div><label class="currency-field currency-amount-wrap">${t.amount}<input id="utilCurAmount" inputmode="decimal" value="1"></label><div class="currency-result"><div id="utilCurResult" class="currency-result-main">—</div><div id="utilCurRate" class="currency-rate"></div></div></div><div class="utility-source">${t.sourceCurrency}${rateDate?' · '+rateDate:''}</div>`);
    const from=overlay.querySelector('#utilCurFrom'),to=overlay.querySelector('#utilCurTo'),amount=overlay.querySelector('#utilCurAmount'),result=overlay.querySelector('#utilCurResult'),rate=overlay.querySelector('#utilCurRate'),swap=overlay.querySelector('.currency-swap');
    const update=()=>{const v=Number(amount.value.replace(',','.').replace(/\s/g,'')),a=rubPer(from.value),b=rubPer(to.value);if(!Number.isFinite(v)||!a||!b){result.textContent='—';return;}const x=v*a/b,one=a/b;result.textContent=`${fmt(x)} ${to.value}`;rate.textContent=`1 ${from.value} = ${fmt(one)} ${to.value}`;};
    from.onchange=update;to.onchange=update;amount.oninput=update;swap.onclick=()=>{const v=from.value;from.value=to.value;to.value=v;update();};update();
  }
  currencyBtn.onclick=showConverter;

  function refreshLanguage(){weatherBtn.querySelector('.hu-sub').textContent=weatherLabel||tr().weather;currencyBtn.querySelector('.hu-sub').textContent=tr().converter;}
  const oldSet=window.DiagnostikaI18n?.setLanguage;if(oldSet){window.DiagnostikaI18n.setLanguage=function(l){const r=oldSet.call(this,l);setTimeout(refreshLanguage,0);return r;};}
  initWeather();loadRates();setTimeout(refreshLanguage,0);
})();