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
  const MAX_SAVED_RATE_AGE=7*DAY;
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
    // For countries without a verified bank provider use labeled reference rates.
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
    // RU always uses RUB. Avoid a needless country-directory request on startup.
    if(cc==='RU')return {country:cc,currency:'RUB',options:['RUB'],countryName:'Россия'};
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
  const localDay=t=>{
    const d=new Date(t);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  };
  function cachedRates(baseCurrency,countryCode=''){
    const base=code(baseCurrency),country=code(countryCode);
    if(!validCurrency(base))return null;
    const bank=providerFor(country);
    const saved=get(RATE_PREFIX+base+':'+(bank?.key||'reference'));
    const age=Date.now()-Number(saved?.time);
    const data=saved?.data;
    // A previously saved, verified rate can be shown instantly while refreshing.
    if(!data||!Number.isFinite(age)||age<0||age>MAX_SAVED_RATE_AGE
      ||data.base!==base||!data.rates||typeof data.rates!=='object'
      ||!(Number(data.rates.USD?.rubPerUnit)>0)
      ||!(Number(data.rates[base]?.rubPerUnit)>0))return null;
    return {...data,cachedAt:Number(saved.time),
      stale:Boolean(data.stale)||localDay(saved.time)!==localDay(Date.now())};
  }
  async function referenceRates(baseCurrency,countryCode=''){
    const base=code(baseCurrency),country=code(countryCode);
    if(!validCurrency(base))throw Error('Некорректная базовая валюта.');
    const bank=providerFor(country);
    const key=RATE_PREFIX+base+':'+(bank?.key||'reference'),cached=get(key);
    const saved=cachedRates(base,country);
    // A successfully retrieved quote is stable for the current local calendar day.
    // Reopening the converter or reloading the page does not call the providers.
    if(saved&&!saved.stale)return saved;
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
    async function nationalFallback(){
      if(country==='RU'&&base==='RUB'){
        const response=await fetch('https://www.cbr-xml-daily.ru/daily_json.js',{cache:'no-store'});
        if(!response.ok)throw Error('Недоступны курсы Банка России');
        const data=await response.json(),rates={RUB:{name:'RUB',rubPerUnit:1}};
        for(const entry of Object.values(data.Valute||{})){
          const nominal=Number(entry.Nominal),value=Number(entry.Value);
          if(validCurrency(entry.CharCode)&&nominal>0&&value>0)
            rates[entry.CharCode]={name:entry.CharCode,rubPerUnit:value/nominal};
        }
        if(!rates.USD)throw Error('Нет долларового курса Банка России');
        const result={rates,base,date:String(data.Date||'').slice(0,10),
          provider:'Центральный банк России',mode:'bank',transport:'Публикация через cbr-xml-daily.ru',providers:['CBR'],stale:false};
        put(key,result);return result;
      }
      if(country==='GE'&&base==='GEL'){
        const response=await fetch('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/',{cache:'no-store'});
        if(!response.ok)throw Error('Национальный банк Грузии недоступен');
        const data=await response.json(),day=Array.isArray(data)?data[0]:null;
        if(!day||!Array.isArray(day.currencies))throw Error('Неверные данные Национального банка Грузии');
        const rates={GEL:{name:'GEL',rubPerUnit:1}};
        for(const entry of day.currencies){
          const rate=Number(entry.rate),qty=Number(entry.quantity),currency=code(entry.code);
          if(validCurrency(currency)&&rate>0&&qty>0)rates[currency]={name:currency,rubPerUnit:rate/qty};
        }
        if(!rates.USD)throw Error('Нет долларового курса Национального банка Грузии');
        const result={rates,base,date:String(day.date||'').slice(0,10),provider:'Национальный банк Грузии',
          mode:'bank',transport:'Официальный API Национального банка Грузии',providers:['NBG'],stale:false};
        put(key,result);return result;
      }
      throw Error('Нет отдельного адаптера для этой страны');
    }
    try{
      if(bank){
        try{
          const url='https://api.frankfurter.dev/v2/providers/'+encodeURIComponent(bank.key)+'/rates?base=USD';
          return await fetchRates(url,bank.name,'bank');
        }catch(error){
          if(country==='RU'||country==='GE'){
            try{return await nationalFallback();}catch(_){}
          }
          // National provider is unavailable: disclose that the next
          // quote is a blended reference rate instead of inventing attribution.
        }
      }
      return await fetchRates('https://api.frankfurter.dev/v2/rates?base=USD','Справочные валютные курсы (официальные источники)','reference');
    }catch(error){
      if(saved)return {...saved,stale:true,error:error.message};
      throw error;
    }
  }
  window.DiagnostikaCountryCurrency=Object.freeze({currencyForCountry,referenceRates,cachedRates,providerFor,fallbacks});
})();