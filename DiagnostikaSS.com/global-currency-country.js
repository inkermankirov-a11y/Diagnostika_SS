'use strict';
/* Country -> legal-tender currencies (REST Countries v3.1);
   reference exchange rates (Frankfurter v2, official-source aggregation).
   Do not label blended cross-rates as direct central-bank quotations. */
(() => {
  if(window.DiagnostikaCountryCurrency)return;
  const COUNTRY_CACHE='diagnostika-country-currency-catalog-v1';
  const RATE_PREFIX='diagnostika-reference-rates-v2:';
  const DAY=86400000;
  const COUNTRY_TTL=30*DAY;
  const RATE_TTL=3*DAY;
  const fallbacks=Object.freeze({
    RU:'RUB',GE:'GEL',KZ:'KZT',BY:'BYN',UA:'UAH',AM:'AMD',
    US:'USD',GB:'GBP',CA:'CAD',AU:'AUD',NZ:'NZD',JP:'JPY',CN:'CNY',
    IN:'INR',TR:'TRY',CH:'CHF',NO:'NOK',SE:'SEK',DK:'DKK',
    PL:'PLN',CZ:'CZK',HU:'HUF',RO:'RON',BG:'BGN',
    MD:'MDL',AZ:'AZN',UZ:'UZS',KG:'KGS',TJ:'TJS',TM:'TMT',
    IL:'ILS',AE:'AED',SA:'SAR',QA:'QAR',KW:'KWD',BH:'BHD',OM:'OMR',
    SG:'SGD',TH:'THB',MY:'MYR',ID:'IDR',PH:'PHP',VN:'VND',KR:'KRW',
    BR:'BRL',MX:'MXN',AR:'ARS',CL:'CLP',CO:'COP',PE:'PEN',
    ZA:'ZAR',EG:'EGP',NG:'NGN',KE:'KES',MA:'MAD',TN:'TND',PK:'PKR',
    BD:'BDT',LK:'LKR',NP:'NPR',TW:'TWD',HK:'HKD',IS:'ISK',RS:'RSD',
    AL:'ALL',BA:'BAM',MK:'MKD',ME:'EUR',XK:'EUR',AD:'EUR',MC:'EUR',
    SM:'EUR',VA:'EUR',FR:'EUR',DE:'EUR',IT:'EUR',ES:'EUR',PT:'EUR',
    NL:'EUR',BE:'EUR',LU:'EUR',IE:'EUR',AT:'EUR',FI:'EUR',GR:'EUR',
    CY:'EUR',MT:'EUR',SI:'EUR',SK:'EUR',EE:'EUR',LV:'EUR',LT:'EUR',
    HR:'EUR',LI:'CHF',BO:'BOB',PY:'PYG',UY:'UYU',VE:'VES',CR:'CRC',
    PA:'PAB',EC:'USD',SV:'USD',GT:'GTQ',HN:'HNL',NI:'NIO',
    DO:'DOP',JM:'JMD',TT:'TTD',CU:'CUP',HT:'HTG',UY:'UYU'
  });
  const code=value=>String(value||'').trim().toUpperCase();
  const validCurrency=value=>/^[A-Z]{3}$/.test(value);
  const validCountry=value=>/^[A-Z]{2}$/.test(value);
  function get(key){
    try{const entry=JSON.parse(localStorage.getItem(key)||'null');return entry&&typeof entry==='object'?entry:null;}
    catch(_){return null;}
  }
  function put(key,data){try{localStorage.setItem(key,JSON.stringify({time:Date.now(),data}));}catch(_){}}
  let catalogPromise=null;
  async function countryCatalog(){
    const cached=get(COUNTRY_CACHE);
    if(cached?.data&&Date.now()-cached.time<COUNTRY_TTL)return cached.data;
    if(catalogPromise)return catalogPromise;
    catalogPromise=(async()=>{
      try{
        const res=await fetch('https://restcountries.com/v3.1/all?fields=cca2,currencies,name',{cache:'force-cache'});
        if(!res.ok)throw Error('country-list-'+res.status);
        const rows=await res.json();
        if(!Array.isArray(rows)||rows.length<150)throw Error('country-list-invalid');
        const map={};
        for(const row of rows){
          const country=code(row.cca2);
          const currencies=Object.keys(row.currencies||{}).map(code).filter(validCurrency);
          if(validCountry(country)&&currencies.length)map[country]={currencies,name:row.name?.common||country};
        }
        put(COUNTRY_CACHE,map);
        return map;
      }catch(error){
        if(cached?.data)return cached.data;
        throw Error('Справочник валют стран недоступен. Подключите интернет или повторите позже.');
      }
    })();
    try{return await catalogPromise;}finally{catalogPromise=null;}
  }
  async function currencyForCountry(country){
    const cc=code(country);
    if(!validCountry(cc))throw Error('Выберите страну из списка городов.');
    let map=null;
    try{map=await countryCatalog();}catch(error){
      if(!fallbacks[cc])throw error;
    }
    const options=map?.[cc]?.currencies||[];
    const currency=options[0]||fallbacks[cc]||'';
    if(!validCurrency(currency))throw Error('Для выбранной страны не определена валюта.');
    return {country:cc,currency,options:options.length?options:[currency],countryName:map?.[cc]?.name||cc};
  }
  function parseRates(rows,base){
    if(!Array.isArray(rows))throw Error('Неверный формат валютных котировок.');
    const usd={USD:1};let date='',providers=new Set();
    for(const row of rows){
      const quote=code(row.quote);
      const rate=Number(row.rate);
      if(code(row.base)!==base||!validCurrency(quote)||!(rate>0)||!Number.isFinite(rate))continue;
      usd[quote]=rate;
      if(row.date&&(!date||row.date>date))date=row.date;
      for(const p of (Array.isArray(row.providers)?row.providers:[]))if(typeof p==='string')providers.add(p);
    }
    if(Object.keys(usd).length<5)throw Error('Недостаточно официальных котировок для пересчёта.');
    return {perBase:usd,date,providers:[...providers]};
  }
  async function referenceRates(baseCurrency){
    const base=code(baseCurrency);
    if(!validCurrency(base))throw Error('Некорректная базовая валюта.');
    const key=RATE_PREFIX+base,cached=get(key);
    try{
      const url='https://api.frankfurter.dev/v2/rates?base=USD&expand=providers';
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw Error('Frankfurter: '+response.status);
      const raw=await response.json();
      const parsed=parseRates(raw,'USD');
      const localPerUsd=parsed.perBase[base];
      if(!(localPerUsd>0))throw Error('В агрегаторе пока нет справочного курса для '+base+'.');
      const rates={};
      for(const [currency,perUsd] of Object.entries(parsed.perBase)){
        rates[currency]={name:currency,rubPerUnit:localPerUsd/perUsd};
      }
      rates[base]={name:base,rubPerUnit:1};
      const result={rates,base,date:parsed.date,provider:'Frankfurter — центральные банки и официальные источники (агрегированные и кросс-курсы)',providers:parsed.providers,stale:false};
      put(key,result);return result;
    }catch(error){
      if(cached?.data&&Date.now()-cached.time<RATE_TTL)
        return {...cached.data,stale:true,error:error.message};
      throw error;
    }
  }
  window.DiagnostikaCountryCurrency=Object.freeze({currencyForCountry,referenceRates,fallbacks});
})();