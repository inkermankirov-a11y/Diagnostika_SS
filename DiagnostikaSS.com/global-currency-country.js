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
    PL:'PLN',CZ:'CZK',HU:'HUF',RO:'RON',BG:'EUR',
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
  // Verified provider keys from the Frankfurter v2 provider registry.
  // The institution is only shown when its own provider feed succeeds.
  const bankByCountry=Object.freeze({
    RU:{key:'cbr',name:'Центральный банк России'},
    GE:{key:'nbg',name:'Национальный банк Грузии'},
    KZ:{key:'nbk',name:'Национальный банк Казахстана'},
    US:{key:'fred',name:'Федеральный резервный банк Сент-Луиса'},
    GB:{key:'boe',name:'Банк Англии'},
    CA:{key:'boc',name:'Банк Канады'},
    JP:{key:'boj',name:'Банк Японии'},
    PL:{key:'nbp',name:'Национальный банк Польши'},
    CZ:{key:'cnb',name:'Чешский национальный банк'},
    HU:{key:'mnb',name:'Национальный банк Венгрии'},
    RO:{key:'bnr',name:'Национальный банк Румынии'},
    NO:{key:'nb',name:'Банк Норвегии'},
    DK:{key:'dnb',name:'Национальный банк Дании'},
    AM:{key:'cba',name:'Центральный банк Армении'},
    AZ:{key:'cbar',name:'Центральный банк Азербайджана'},
    UZ:{key:'cbu',name:'Центральный банк Узбекистана'},
    KG:{key:'nbkr',name:'Национальный банк Кыргызстана'},
    TJ:{key:'nbt',name:'Национальный банк Таджикистана'},
    MD:{key:'nbm',name:'Национальный банк Молдовы'},
    IL:{key:'boi',name:'Банк Израиля'},
    TH:{key:'bot',name:'Банк Таиланда'},
    MY:{key:'bnm',name:'Центральный банк Малайзии'},
    ID:{key:'bi',name:'Банк Индонезии'},
    SG:{key:'mas',name:'Денежно-кредитное управление Сингапура'},
    SA:{key:'sama',name:'Центральный банк Саудовской Аравии'},
    KW:{key:'cbkkw',name:'Центральный банк Кувейта'},
    OM:{key:'cbo',name:'Центральный банк Омана'},
    LK:{key:'cbsl',name:'Центральный банк Шри-Ланки'},
    PK:{key:'sbp',name:'Государственный банк Пакистана'},
    BD:{key:'bb',name:'Банк Бангладеш'},
    NP:{key:'nrb',name:'Центральный банк Непала'},
    MN:{key:'bom',name:'Банк Монголии'},
    KH:{key:'nbc',name:'Национальный банк Камбоджи'},
    BA:{key:'cbbh',name:'Центральный банк Боснии и Герцеговины'},
    PY:{key:'bcp',name:'Центральный банк Парагвая'},
    AR:{key:'bcra',name:'Центральный банк Аргентины'},
    UY:{key:'bcu',name:'Центральный банк Уругвая'},
    VE:{key:'bcv',name:'Центральный банк Венесуэлы'},
    JM:{key:'boja',name:'Банк Ямайки'},
    TT:{key:'cbtt',name:'Центральный банк Тринидада и Тобаго'},
    AE:{key:'cbu',name:'Центральный банк ОАЭ'}
  });
  const euroCountries=new Set(['AT','BE','BG','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT','LT','LU','LV','MT','NL','PT','SI','SK']);
  function providerFor(country){
    const cc=String(country||'').toUpperCase();
    if(euroCountries.has(cc))return {key:'ecb',name:'Европейский центральный банк'};
    return bankByCountry[cc]||null;
  }
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
  async function referenceRates(baseCurrency,countryCode=''){
    const base=code(baseCurrency),country=code(countryCode);
    if(!validCurrency(base))throw Error('Некорректная базовая валюта.');
    const bank=providerFor(country);
    const key=RATE_PREFIX+base+':'+(bank?.key||'reference'),cached=get(key);
    async function fetchRates(url,label,mode){
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw Error('Котировки недоступны: '+response.status);
      const parsed=parseRates(await response.json(),'USD');
      const localPerUsd=parsed.perBase[base];
      if(!(localPerUsd>0))throw Error('Нет курса '+base+' в выбранном наборе.');
      const rates={};
      for(const [currency,perUsd] of Object.entries(parsed.perBase))
        rates[currency]={name:currency,rubPerUnit:localPerUsd/perUsd};
      rates[base]={name:base,rubPerUnit:1};
      const result={rates,base,date:parsed.date,provider:label,providers:parsed.providers,mode,stale:false};
      put(key,result);return result;
    }
    try{
      if(bank){
        try{
          const url='https://api.frankfurter.dev/v2/providers/'+encodeURIComponent(bank.key)+'/rates?base=USD';
          return await fetchRates(url,bank.name,'bank');
        }catch(error){
          // Availability and currency coverage vary by national source.
          // Never mislabel a blended quote as a direct central-bank rate.
        }
      }
      return await fetchRates('https://api.frankfurter.dev/v2/rates?base=USD','Справочные валютные курсы (официальные источники)','reference');
    }catch(error){
      if(cached?.data&&Date.now()-cached.time<RATE_TTL)
        return {...cached.data,stale:true,error:error.message};
      throw error;
    }
  }
  window.DiagnostikaCountryCurrency=Object.freeze({currencyForCountry,referenceRates,providerFor,fallbacks});
})();