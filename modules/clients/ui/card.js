'use strict';

(() => {
  const dlg = document.createElement('dialog');
  dlg.id = 'clientCardDialog';
  dlg.className = 'client-card-dialog';
  dlg.innerHTML = `
    <div class="client-card-window">
      <div class="client-card-window-title">РАБОТА С КЛИЕНТОМ</div>
      <div class="client-card-sheet">
        <div class="cc-profile-layout">
          <div class="cc-photo-wrap">
            <button id="ccPhotoFrame" class="cc-photo-frame" type="button" title="Изменить фотографию">
              <img id="ccPhotoPreview" alt="Фото клиента">
              <span id="ccPhotoPlaceholder">Добавить фото</span>
            </button>
            <input id="ccPhotoInput" type="file" accept="image/*" hidden>
            <div class="cc-photo-help">Нажмите на фото: миниатюра, замена или удаление</div>
          </div>

          <div class="client-card-top-grid">
            <label class="cc-field cc-span-2 cc-name-field">ФИО<input id="ccName" type="text"></label>
            <label class="cc-field">Телефон<input id="ccPhone" type="text"></label>
            <label class="cc-field">E-mail<input id="ccEmail" type="text"></label>
            <label class="cc-field">Пол<select id="ccGender"><option value=""></option><option>Мужской</option><option>Женский</option></select></label>
            <label class="cc-field cc-place-field">Страна<input id="ccCountry" type="text" autocomplete="off" spellcheck="false"><div id="ccCountrySuggestions" class="cc-place-suggestions" hidden></div></label>
            <label class="cc-field cc-place-field">Город<input id="ccCity" type="text" autocomplete="off" spellcheck="false"><div id="ccCitySuggestions" class="cc-place-suggestions" hidden></div></label>
            <label class="cc-field">Дата рождения<input id="ccBirth" type="date" lang="ru-RU"></label>
            <label class="cc-field">Время рождения<input id="ccBirthTime" type="time"></label>
            <div class="cc-field cc-age-field"><div class="cc-field-head"><span>Возраст</span><label class="cc-age-auto"><input id="ccAgeAuto" type="checkbox"> авто</label></div><input id="ccAge" type="number" inputmode="numeric" min="0" max="130"></div>
            <div id="ccClientTime" class="cc-client-time cc-client-time-idle" role="status" aria-live="polite">
              <span class="cc-client-time-icon">🕒</span>
              <span class="cc-client-time-copy"><strong>Время клиента</strong><span class="cc-client-time-value">Укажите город</span></span>
            </div>
          </div>

          <div class="cc-social-column">
            <label class="cc-field cc-social-field"><span>VK</span><input id="ccVk" type="text"></label>
            <label class="cc-field cc-social-field"><span>Telegram</span><input id="ccTelegram" type="text"></label>
            <label class="cc-field cc-social-field"><span>MAX</span><input id="ccMax" type="text"></label>
          </div>

          <div class="cc-top-actions">
            <button id="ccCalendarBtn" type="button" class="cc-top-action-btn cc-calendar-btn">Календарь</button>
            <button id="ccFreeConsultBtn" type="button" class="cc-top-action-btn cc-free-consult-btn">Бесплатная консультация</button>
          </div>
        </div>

        <div class="cc-long-fields">
          <label>Исходный запрос<textarea id="ccInitialProblem"></textarea></label>
          <label>Ключевой запрос<textarea id="ccMainRequest"></textarea></label>
          <label>Предыдущие попытки решения<textarea id="ccTried"></textarea></label>
          <label>Желаемый результат<textarea id="ccDesiredOutcome"></textarea></label>
          <label>Рабочие заметки<textarea id="ccClientNotes"></textarea></label>
        </div>
      </div>
      <div class="client-card-footer">
        <div class="cc-footer-spacer"></div>
        <button id="ccCloseBtn" type="button" class="cc-close-btn">Закрыть</button>
        <button id="ccSaveBtn" type="button" class="cc-save-btn">Сохранить карточку</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const q = id => document.getElementById(id);
  const fieldIds=['ccName','ccPhone','ccEmail','ccGender','ccCountry','ccCity','ccBirth','ccBirthTime','ccAge','ccVk','ccTelegram','ccMax','ccInitialProblem','ccMainRequest','ccTried','ccDesiredOutcome','ccClientNotes'];
  let draftMode=false;
  let draft=null;
  let dirty=false;
  let photoData='';
  let photoSourceData='';
  let photoCrop={x:50,y:50,zoom:1};
  let locationCatalogPromise=null;
  let clientClockTimer=null;
  let clientTimeRequest=0;
  let selectedLocationMeta=null;
  let locationSuggestSeq=0;
  let citySuggestTimer=null;

  function clientsApi(){
    return window.DiagnostikaClients || null;
  }

  function currentClient(){
    return window.DiagnostikaClientUIContext?.currentClient?.()
      || clientsApi()?.current?.()
      || null;
  }

  function normalizePlace(value){
    return String(value||'')
      .trim()
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g,'е')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zа-я0-9]+/gi,' ')
      .trim()
      .replace(/\s+/g,' ');
  }

  const ISO_COUNTRY_CODES='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const POPULAR_COUNTRY_CODES=['RU','US','DE','GB','FR','IT','ES','PT','PL','CZ','FI','SE','NO','DK','NL','BE','CH','AT','CA','AU','NZ','JP','KR','CN','AE','TR','IL','GE','AM','KZ','BY','UA','LV','LT','EE'];
  const COUNTRY_CODE_ALIASES=Object.freeze({
    'ru':['россия','рф','russia','russian federation','российская федерация'],
    'us':['сша','сша америка','америка','штаты','соединенные штаты','соединенные штаты америки','usa','us','america','united states','united states of america'],
    'gb':['великобритания','англия','британия','uk','u k','united kingdom','great britain','england'],
    'de':['германия','germany','deutschland'],
    'fr':['франция','france'],
    'it':['италия','italy'],
    'es':['испания','spain'],
    'pt':['португалия','portugal'],
    'pl':['польша','poland'],
    'cz':['чехия','czechia','czech republic'],
    'fi':['финляндия','finland'],
    'se':['швеция','sweden'],
    'no':['норвегия','norway'],
    'dk':['дания','denmark'],
    'nl':['нидерланды','голландия','netherlands','holland'],
    'be':['бельгия','belgium'],
    'ch':['швейцария','switzerland'],
    'at':['австрия','austria'],
    'ca':['канада','canada'],
    'au':['австралия','australia'],
    'nz':['новая зеландия','new zealand'],
    'jp':['япония','japan'],
    'kr':['южная корея','корея','south korea','republic of korea','korea'],
    'cn':['китай','china'],
    'ae':['оаэ','эмираты','uae','united arab emirates','emirates'],
    'tr':['турция','turkey','turkiye','türkiye'],
    'il':['израиль','israel'],
    'ge':['грузия','georgia'],
    'am':['армения','armenia'],
    'kz':['казахстан','kazakhstan'],
    'by':['беларусь','белоруссия','belarus'],
    'ua':['украина','ukraine'],
    'lv':['латвия','latvia'],
    'lt':['литва','lithuania'],
    'ee':['эстония','estonia'],
    'in':['индия','india'],
    'sg':['сингапур','singapore'],
    'th':['таиланд','тайланд','thailand'],
    'vn':['вьетнам','vietnam'],
    'id':['индонезия','indonesia'],
    'my':['малайзия','malaysia'],
    'ph':['филиппины','philippines'],
    'mx':['мексика','mexico'],
    'br':['бразилия','brazil'],
    'ar':['аргентина','argentina'],
    'cl':['чили','chile'],
    'za':['юар','южная африка','south africa'],
    'sa':['саудовская аравия','saudi arabia'],
    'qa':['катар','qatar'],
    'gr':['греция','greece'],
    'cy':['кипр','cyprus'],
    'ie':['ирландия','ireland'],
    'is':['исландия','iceland'],
    'hr':['хорватия','croatia'],
    'rs':['сербия','serbia'],
    'me':['черногория','montenegro'],
    'bg':['болгария','bulgaria'],
    'ro':['румыния','romania'],
    'hu':['венгрия','hungary'],
    'sk':['словакия','slovakia'],
    'si':['словения','slovenia']
  });

  function displayNames(locale){
    try{return new Intl.DisplayNames([locale],{type:'region'});}catch(_){return null;}
  }
  const COUNTRY_NAMES_RU=displayNames('ru-RU');
  const COUNTRY_NAMES_EN=displayNames('en-US');

  function compactPlace(value){
    return normalizePlace(value).replace(/\s+/g,'');
  }

  function levenshtein(a,b){
    a=String(a||'');b=String(b||'');
    if(a===b)return 0;
    if(!a.length)return b.length;
    if(!b.length)return a.length;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++){
        cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      }
      prev=cur;
    }
    return prev[b.length];
  }

  function countryEntries(){
    return ISO_COUNTRY_CODES.map(code=>{
      const ru=COUNTRY_NAMES_RU?.of(code)||code;
      const en=COUNTRY_NAMES_EN?.of(code)||code;
      const aliases=[code,ru,en,...(COUNTRY_CODE_ALIASES[code.toLowerCase()]||[])];
      return {code,name:ru,en,aliases};
    });
  }

  function countryScore(entry,query){
    const q=compactPlace(query);
    if(!q)return POPULAR_COUNTRY_CODES.indexOf(entry.code)>=0?POPULAR_COUNTRY_CODES.indexOf(entry.code):1000;
    let best=Number.POSITIVE_INFINITY;
    for(const alias of entry.aliases){
      const key=compactPlace(alias);
      if(!key)continue;
      let score=levenshtein(q,key);
      if(key===q)score=-30;
      else if(key.startsWith(q))score=-20+(key.length-q.length)/100;
      else if(key.includes(q))score=-10+key.indexOf(q)/100;
      if(score<best)best=score;
    }
    return best;
  }

  function countryMatches(_rows,query){
    const q=compactPlace(query);
    const entries=countryEntries()
      .map(entry=>({...entry,score:countryScore(entry,query)}))
      .sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'ru'));
    const selected=q?entries.slice(0,10):entries.filter(x=>POPULAR_COUNTRY_CODES.includes(x.code)).slice(0,12);
    return selected.map(entry=>({name:entry.name,sub:entry.en!==entry.name?entry.code+' · '+entry.en:entry.code,code:entry.code,entry,score:entry.score}));
  }

  function resolvedCountryOption(value){
    const q=compactPlace(value);
    if(!q)return null;
    const entries=countryEntries();
    const exact=entries.find(entry=>entry.aliases.some(alias=>compactPlace(alias)===q));
    if(exact)return exact;
    const best=entries.map(entry=>({...entry,score:countryScore(entry,value)})).sort((a,b)=>a.score-b.score)[0]||null;
    if(!best)return null;
    const target=Math.min(...best.aliases.filter(Boolean).map(alias=>levenshtein(q,compactPlace(alias))));
    const threshold=Math.max(1,Math.min(3,Math.floor(q.length*0.22)));
    return target<=threshold?best:null;
  }

  function normalizeCountry(value){
    return resolvedCountryOption(value)?.name||normalizePlace(value);
  }

  function resolvedCountryForFilter(_rows,value){
    return resolvedCountryOption(value)?.code||'';
  }

  function localCityMatches(rows,query,country){
    const q=compactPlace(query);
    const countryOption=resolvedCountryOption(country);
    const pool=(rows||[]).filter(row=>!countryOption||normalizeCountry(row?.country)===countryOption.name);
    if(!q)return pool.slice(0,10).map(row=>({name:row.name,sub:row.country||'',row,score:0,source:'local'}));
    return pool.map(row=>{
      const names=[row?.name,...(Array.isArray(row?.aliases)?row.aliases:[])].filter(Boolean);
      let best=Number.POSITIVE_INFINITY;
      for(const name of names){
        const key=compactPlace(name);
        let score=levenshtein(q,key);
        if(key===q)score=-30;
        else if(key.startsWith(q))score=-20+(key.length-q.length)/100;
        else if(key.includes(q))score=-10+key.indexOf(q)/100;
        if(score<best)best=score;
      }
      return {name:row.name,sub:[row.admin,row.country].filter(Boolean).join(', '),row,score:best,source:'local'};
    }).sort((a,b)=>a.score-b.score||String(a.name).localeCompare(String(b.name),'ru')).slice(0,12);
  }

  const globalCityCache=new Map();
  async function fetchGlobalCities(query,countryCode='',count=30){
    const key=[compactPlace(query),countryCode,count].join('|');
    if(globalCityCache.has(key))return globalCityCache.get(key);
    const params=new URLSearchParams({name:String(query||'').trim(),count:String(count),language:'ru',format:'json'});
    if(countryCode)params.set('countryCode',countryCode);
    const request=fetch('https://geocoding-api.open-meteo.com/v1/search?'+params.toString(),{cache:'force-cache'})
      .then(response=>{
        if(!response.ok)throw new Error('global-geocoding-'+response.status);
        return response.json();
      })
      .then(data=>(Array.isArray(data?.results)?data.results:[])
        .filter(row=>!row?.feature_code||String(row.feature_code).startsWith('P'))
        .map(row=>({
        name:row.name||'',
        sub:[row.admin1,row.country].filter(Boolean).join(', '),
        code:row.country_code||'',
        row:{
          id:'openmeteo-'+row.id,
          name:row.name||'',
          aliases:[],
          country:row.country||'',
          admin:row.admin1||'',
          latitude:Number(row.latitude),
          longitude:Number(row.longitude),
          timezone:row.timezone||'',
          countryCode:row.country_code||''
        },
        score:0,
        source:'global'
      })))
      .catch(error=>{
        console.warn('[Diagnostika] global city search unavailable',error);
        return [];
      });
    globalCityCache.set(key,request);
    return request;
  }

  function rankGlobalCities(items,query){
    const q=compactPlace(query);
    return (items||[]).map(item=>{
      const key=compactPlace(item.name);
      let score=levenshtein(q,key);
      if(key===q)score=-30;
      else if(key.startsWith(q))score=-20+(key.length-q.length)/100;
      else if(key.includes(q))score=-10+key.indexOf(q)/100;
      return {...item,score};
    }).sort((a,b)=>a.score-b.score||String(a.name).localeCompare(String(b.name),'ru'));
  }

  async function globalCityMatches(query,country){
    const typed=String(query||'').trim();
    if(typed.length<2)return [];
    const countryCode=resolvedCountryOption(country)?.code||'';
    let rows=await fetchGlobalCities(typed,countryCode,30);
    let ranked=rankGlobalCities(rows,typed);

    // Open-Meteo uses prefix search. If the full spelling has a typo,
    // search by the first 3 characters and fuzzy-rank the returned places.
    if((!ranked.length||ranked[0].score>2)&&compactPlace(typed).length>=5){
      const prefix=String(typed).trim().slice(0,3);
      const broad=await fetchGlobalCities(prefix,countryCode,100);
      ranked=rankGlobalCities([...rows,...broad],typed);
    }
    return ranked.slice(0,12);
  }

  function mergeCityMatches(local,global){
    const seen=new Set();
    const merged=[];
    for(const item of [...(local||[]),...(global||[])]){
      const row=item.row||{};
      const key=[compactPlace(item.name),compactPlace(row.country||item.sub),row.timezone||''].join('|');
      if(seen.has(key))continue;
      seen.add(key);
      merged.push(item);
    }
    return merged.sort((a,b)=>a.score-b.score||String(a.name).localeCompare(String(b.name),'ru')).slice(0,12);
  }

  function correctionCandidate(kind,rows,value,country='',matches=null){
    const typed=String(value||'').trim();
    const q=compactPlace(typed);
    if(q.length<3)return null;
    const source=matches||(kind==='country'?countryMatches(rows,typed):localCityMatches(rows,typed,country));
    const best=source[0]||null;
    if(!best)return null;
    const target=compactPlace(best.name);
    if(q===target)return best;
    const distance=levenshtein(q,target);
    const threshold=Math.max(1,Math.min(3,Math.floor(q.length*0.22)));
    return distance<=threshold?best:null;
  }

  function suggestionBox(kind){
    return q(kind==='country'?'ccCountrySuggestions':'ccCitySuggestions');
  }

  function locationInput(kind){
    return q(kind==='country'?'ccCountry':'ccCity');
  }

  function hideLocationSuggestions(kind){
    const box=suggestionBox(kind);
    if(box){box.hidden=true;box.innerHTML='';}
  }

  function rememberLocationMeta(item){
    const row=item?.row;
    if(!row?.timezone)return;
    selectedLocationMeta={
      city:row.name||item.name||'',
      country:row.country||'',
      countryCode:row.countryCode||item.code||resolvedCountryOption(row.country||'')?.code||'',
      latitude:Number.isFinite(Number(row.latitude))?Number(row.latitude):null,
      longitude:Number.isFinite(Number(row.longitude))?Number(row.longitude):null,
      timezone:row.timezone||''
    };
  }

  function applyLocationSuggestion(kind,item){
    const input=locationInput(kind);
    if(!input||!item)return;
    input.value=item.name||'';
    dirty=true;
    hideLocationSuggestions(kind);
    if(kind==='country'){
      selectedLocationMeta=null;
      renderLocationSuggestions('city');
    }else{
      rememberLocationMeta(item);
      if(item.row?.country)q('ccCountry').value=item.row.country;
    }
    updateClientTime();
  }

  function renderSuggestionItems(kind,box,matches,value,correction){
    box.innerHTML=matches.map((item,index)=>{
      const isCorrection=correction&&index===0&&compactPlace(value)!==compactPlace(item.name);
      return `<button type="button" class="cc-place-suggestion${isCorrection?' correction':''}" data-index="${index}"><span class="cc-place-suggestion-main">${isCorrection?'Исправить на: ':''}${String(item.name||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</span>${item.sub?`<span class="cc-place-suggestion-sub">${String(item.sub).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}</span>`:''}</button>`;
    }).join('');
    box.hidden=false;
    box.querySelectorAll('.cc-place-suggestion').forEach((button,index)=>{
      button.addEventListener('pointerdown',event=>{
        event.preventDefault();
        applyLocationSuggestion(kind,matches[index]);
      });
    });
  }

  async function renderLocationSuggestions(kind){
    const input=locationInput(kind);
    const box=suggestionBox(kind);
    if(!input||!box)return;
    const seq=++locationSuggestSeq;
    const value=input.value;
    const rows=await loadLocationCatalog();
    if(seq!==locationSuggestSeq||document.activeElement!==input)return;

    if(kind==='country'){
      const matches=countryMatches(rows,value);
      const correction=correctionCandidate(kind,rows,value,'',matches);
      renderSuggestionItems(kind,box,matches,value,correction);
      return;
    }

    const local=localCityMatches(rows,value,q('ccCountry')?.value||'');
    if(local.length)renderSuggestionItems(kind,box,local,value,correctionCandidate(kind,rows,value,q('ccCountry')?.value||'',local));
    else hideLocationSuggestions(kind);
    clearTimeout(citySuggestTimer);
    citySuggestTimer=setTimeout(async()=>{
      const global=await globalCityMatches(value,q('ccCountry')?.value||'');
      if(seq!==locationSuggestSeq||document.activeElement!==input)return;
      const matches=mergeCityMatches(local,global);
      if(!matches.length){hideLocationSuggestions(kind);return;}
      const correction=correctionCandidate(kind,rows,value,q('ccCountry')?.value||'',matches);
      renderSuggestionItems(kind,box,matches,value,correction);
    },220);
  }

  async function autocorrectLocation(kind){
    const input=locationInput(kind);
    if(!input)return;
    const value=input.value.trim();
    if(!value){hideLocationSuggestions(kind);return;}
    const rows=await loadLocationCatalog();

    if(kind==='country'){
      const matches=countryMatches(rows,value);
      const best=correctionCandidate(kind,rows,value,'',matches);
      if(best&&value!==best.name){
        input.value=best.name;
        selectedLocationMeta=null;
        dirty=true;
      }
      hideLocationSuggestions(kind);
      updateClientTime();
      return;
    }

    const local=localCityMatches(rows,value,q('ccCountry')?.value||'');
    const global=await globalCityMatches(value,q('ccCountry')?.value||'');
    const matches=mergeCityMatches(local,global);
    const best=correctionCandidate(kind,rows,value,q('ccCountry')?.value||'',matches);
    if(best&&value!==best.name){
      input.value=best.name;
      if(best.row?.country)q('ccCountry').value=best.row.country;
      rememberLocationMeta(best);
      dirty=true;
    }else if(matches[0]&&compactPlace(matches[0].name)===compactPlace(value)){
      rememberLocationMeta(matches[0]);
      if(matches[0].row?.country)q('ccCountry').value=matches[0].row.country;
    }
    hideLocationSuggestions(kind);
    updateClientTime();
  }

  function loadLocationCatalog(){
    if(locationCatalogPromise)return locationCatalogPromise;
    locationCatalogPromise=fetch('./weather-locations.json?v=20261002-client-time-1',{cache:'force-cache',credentials:'same-origin'})
      .then(response=>{
        if(!response.ok)throw new Error('location-catalog-'+response.status);
        return response.json();
      })
      .then(data=>Array.isArray(data?.cities)?data.cities:[])
      .catch(error=>{
        console.warn('[Diagnostika] client timezone catalog unavailable',error);
        return [];
      });
    return locationCatalogPromise;
  }

  function findClientLocation(rows,city,country){
    const cityKey=compactPlace(city);
    if(!cityKey)return null;
    const countryOption=resolvedCountryOption(country);
    const candidates=(rows||[]).filter(row=>{
      const names=[row?.name,...(Array.isArray(row?.aliases)?row.aliases:[])].map(compactPlace);
      return names.includes(cityKey);
    });
    if(!candidates.length)return null;
    if(candidates.length===1)return candidates[0];
    if(countryOption){
      const matched=candidates.find(row=>normalizeCountry(row?.country)===countryOption.name);
      if(matched)return matched;
    }
    return null;
  }

  function timeZoneOffsetMinutes(date,timeZone){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone,year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(date);
    const map=Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
    const utcLike=Date.UTC(
      Number(map.year),Number(map.month)-1,Number(map.day),
      Number(map.hour),Number(map.minute),Number(map.second)
    );
    const instant=Math.floor(date.getTime()/1000)*1000;
    return Math.round((utcLike-instant)/60000);
  }

  function formatTimeDifference(minutes){
    const rounded=Math.round(minutes);
    if(!rounded)return 'то же время, что у вас';
    const abs=Math.abs(rounded);
    const hours=Math.floor(abs/60);
    const mins=abs%60;
    const amount=[hours?hours+' ч':'',mins?mins+' мин':''].filter(Boolean).join(' ');
    return rounded>0?'на '+amount+' впереди вас':'на '+amount+' позади вас';
  }

  function setClientTimeState(state,value,detail=''){
    const root=q('ccClientTime');
    if(!root)return;
    root.className='cc-client-time cc-client-time-'+state;
    const valueNode=root.querySelector('.cc-client-time-value');
    if(valueNode)valueNode.textContent=detail?value+' · '+detail:value;
  }

  async function updateClientTime(){
    const requestId=++clientTimeRequest;
    const city=q('ccCity')?.value?.trim()||'';
    const country=q('ccCountry')?.value?.trim()||'';
    if(!city){
      setClientTimeState('idle','Укажите город');
      return;
    }

    setClientTimeState('loading','Определяю время…');
    const rows=await loadLocationCatalog();
    if(requestId!==clientTimeRequest)return;
    const metaMatches=selectedLocationMeta
      && compactPlace(selectedLocationMeta.city)===compactPlace(city)
      && (!country||!selectedLocationMeta.country||normalizeCountry(selectedLocationMeta.country)===normalizeCountry(country));
    const location=metaMatches?selectedLocationMeta:findClientLocation(rows,city,country);
    if(!location?.timezone){
      setClientTimeState('unknown','Выберите город из подсказки',city);
      return;
    }

    try{
      const now=new Date();
      const formatter=new Intl.DateTimeFormat('ru-RU',{
        timeZone:location.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'
      });
      const time=formatter.format(now);
      const hourPart=formatter.formatToParts(now).find(part=>part.type==='hour')?.value;
      const hour=Number(hourPart);
      const clientOffset=timeZoneOffsetMinutes(now,location.timezone);
      const localOffset=-now.getTimezoneOffset();
      const difference=formatTimeDifference(clientOffset-localOffset);
      const state=hour>=0&&hour<6?'night':(hour>=22||hour<8?'caution':'ok');
      const label=state==='night'?'ночь у клиента':(state==='caution'?'позднее/раннее время':'');
      setClientTimeState(state,time,label?difference+' · '+label:difference);
      q('ccClientTime').title=(location.name||city)+' · '+location.timezone;
    }catch(error){
      console.warn('[Diagnostika] client timezone formatting failed',error);
      setClientTimeState('unknown','Не удалось показать время',city);
    }
  }

  function startClientClock(){
    if(clientClockTimer)clearInterval(clientClockTimer);
    updateClientTime();
    clientClockTimer=setInterval(updateClientTime,30000);
  }

  function stopClientClock(){
    if(clientClockTimer){clearInterval(clientClockTimer);clientClockTimer=null;}
  }

  function ageFromBirth(value){
    if(!value) return '';
    const parts=String(value).split('-').map(Number);
    if(parts.length!==3||!parts[0]||!parts[1]||!parts[2])return '';
    const n=new Date();
    let a=n.getFullYear()-parts[0];
    if(n.getMonth()+1<parts[1]||(n.getMonth()+1===parts[1]&&n.getDate()<parts[2]))a--;
    return a>=0?String(a):'';
  }

  function applyAgeMode(){
    const auto=q('ccAgeAuto')?.checked===true;
    const age=q('ccAge');
    if(!age)return;
    age.readOnly=auto;
    age.classList.toggle('cc-age-readonly',auto);
    if(auto)age.value=ageFromBirth(q('ccBirth')?.value||'');
  }

  function setPhoto(data,source=data,crop={x:50,y:50,zoom:1}){
    photoData=data||'';
    photoSourceData=source||data||'';
    photoCrop={
      x:Math.max(0,Math.min(100,Number(crop?.x)||50)),
      y:Math.max(0,Math.min(100,Number(crop?.y)||50)),
      zoom:Math.max(1,Math.min(3,Number(crop?.zoom)||1))
    };
    const img=q('ccPhotoPreview');
    const ph=q('ccPhotoPlaceholder');
    if(photoData){img.src=photoData;img.style.display='block';ph.style.display='none';}
    else{img.removeAttribute('src');img.style.display='none';ph.style.display='grid';}
  }

  const photoActionsDlg=document.createElement('dialog');
  photoActionsDlg.className='cc-photo-actions-dialog';
  photoActionsDlg.innerHTML='<div class="cc-photo-actions-card"><div class="cc-photo-actions-title">Фотография клиента</div><button type="button" data-photo-action="edit">Изменить миниатюру</button><button type="button" data-photo-action="replace">Загрузить новую</button><button type="button" data-photo-action="delete" class="danger">Удалить фотографию</button><button type="button" data-photo-action="cancel" class="ghost">Отмена</button></div>';
  document.body.appendChild(photoActionsDlg);

  const photoEditorDlg=document.createElement('dialog');
  photoEditorDlg.className='cc-photo-editor-dialog';
  photoEditorDlg.innerHTML='<div class="cc-photo-editor-card"><div class="cc-photo-editor-title">Миниатюра фотографии</div><div class="cc-photo-editor-hint">Перетащи фото, чтобы выбрать область. Масштаб меняется ползунком.</div><div class="cc-photo-editor-preview"><img alt=""></div><div class="cc-photo-editor-zoom"><span>Масштаб</span><input type="range" min="1" max="3" step="0.05" value="1"><strong>100%</strong></div><div class="cc-photo-editor-buttons"><button type="button" class="ghost" data-editor-action="cancel">Отмена</button><button type="button" class="primary" data-editor-action="save">Сохранить миниатюру</button></div></div>';
  document.body.appendChild(photoEditorDlg);

  const photoEditorPreview=photoEditorDlg.querySelector('.cc-photo-editor-preview');
  const photoEditorImg=photoEditorPreview.querySelector('img');
  const photoZoom=photoEditorDlg.querySelector('input[type="range"]');
  const photoZoomValue=photoEditorDlg.querySelector('.cc-photo-editor-zoom strong');
  let photoEditorSource=null;
  let photoEditorSourceData='';
  let editorCrop={x:50,y:50,zoom:1};
  let editorDragging=false,editorStartX=0,editorStartY=0,editorStartCropX=50,editorStartCropY=50;

  function clampPhoto(n,min,max){return Math.max(min,Math.min(max,n));}
  function loadPhotoImage(data){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});
  }
  function compressPhotoSource(img){
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,max=1800,scale=Math.min(1,max/Math.max(w,h));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.9);
  }
  function paintPhotoEditor(){
    photoEditorImg.style.objectPosition=editorCrop.x+'% '+editorCrop.y+'%';
    photoEditorImg.style.transform='scale('+editorCrop.zoom+')';
    photoEditorImg.style.transformOrigin=editorCrop.x+'% '+editorCrop.y+'%';
    photoZoom.value=String(editorCrop.zoom);
    photoZoomValue.textContent=Math.round(editorCrop.zoom*100)+'%';
  }
  async function openPhotoEditor(data,crop=photoCrop){
    if(!data)return;
    try{
      photoEditorSource=await loadPhotoImage(data);
      photoEditorSourceData=data;
      editorCrop={
        x:clampPhoto(Number(crop?.x)||50,0,100),
        y:clampPhoto(Number(crop?.y)||50,0,100),
        zoom:clampPhoto(Number(crop?.zoom)||1,1,3)
      };
      photoEditorImg.src=data;
      paintPhotoEditor();
      photoEditorDlg.showModal();
    }catch(error){console.warn('[Diagnostika] client photo editor failed',error);}
  }
  function cropClientPhoto(img,crop){
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,targetRatio=190/220;
    let baseW,baseH;
    if(w/h>targetRatio){baseH=h;baseW=h*targetRatio;}else{baseW=w;baseH=w/targetRatio;}
    const zoom=clampPhoto(Number(crop.zoom)||1,1,3);
    const cropW=baseW/zoom,cropH=baseH/zoom;
    const sx=(w-cropW)*(clampPhoto(Number(crop.x)||50,0,100)/100);
    const sy=(h-cropH)*(clampPhoto(Number(crop.y)||50,0,100)/100);
    const canvas=document.createElement('canvas');canvas.width=570;canvas.height=660;
    canvas.getContext('2d').drawImage(img,sx,sy,cropW,cropH,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.9);
  }

  photoEditorPreview.addEventListener('pointerdown',e=>{
    if(!photoEditorSource)return;
    editorDragging=true;photoEditorPreview.classList.add('dragging');photoEditorPreview.setPointerCapture?.(e.pointerId);
    editorStartX=e.clientX;editorStartY=e.clientY;editorStartCropX=editorCrop.x;editorStartCropY=editorCrop.y;e.preventDefault();
  });
  photoEditorPreview.addEventListener('pointermove',e=>{
    if(!editorDragging)return;
    const r=photoEditorPreview.getBoundingClientRect(),sensitivity=100/Math.max(1,editorCrop.zoom);
    editorCrop.x=clampPhoto(editorStartCropX-(e.clientX-editorStartX)/Math.max(1,r.width)*sensitivity,0,100);
    editorCrop.y=clampPhoto(editorStartCropY-(e.clientY-editorStartY)/Math.max(1,r.height)*sensitivity,0,100);
    paintPhotoEditor();e.preventDefault();
  });
  function stopPhotoEditorDrag(){editorDragging=false;photoEditorPreview.classList.remove('dragging');}
  photoEditorPreview.addEventListener('pointerup',stopPhotoEditorDrag);
  photoEditorPreview.addEventListener('pointercancel',stopPhotoEditorDrag);
  photoZoom.addEventListener('input',()=>{editorCrop.zoom=clampPhoto(Number(photoZoom.value)||1,1,3);paintPhotoEditor();});

  photoActionsDlg.querySelector('[data-photo-action="edit"]').onclick=()=>{photoActionsDlg.close();openPhotoEditor(photoSourceData||photoData,photoCrop);};
  photoActionsDlg.querySelector('[data-photo-action="replace"]').onclick=()=>{photoActionsDlg.close();q('ccPhotoInput').click();};
  photoActionsDlg.querySelector('[data-photo-action="delete"]').onclick=()=>{setPhoto('','',{x:50,y:50,zoom:1});dirty=true;photoActionsDlg.close();};
  photoActionsDlg.querySelector('[data-photo-action="cancel"]').onclick=()=>photoActionsDlg.close();
  photoEditorDlg.querySelector('[data-editor-action="cancel"]').onclick=()=>{photoEditorSource=null;photoEditorSourceData='';photoEditorDlg.close();};
  photoEditorDlg.querySelector('[data-editor-action="save"]').onclick=()=>{
    if(!photoEditorSource){photoEditorDlg.close();return;}
    const cropped=cropClientPhoto(photoEditorSource,editorCrop);
    setPhoto(cropped,photoEditorSourceData,{...editorCrop});
    dirty=true;photoEditorSource=null;photoEditorSourceData='';photoEditorDlg.close();
  };
  photoActionsDlg.addEventListener('cancel',e=>{e.preventDefault();photoActionsDlg.close();});
  photoEditorDlg.addEventListener('cancel',e=>{e.preventDefault();photoEditorDlg.close();});

  function sourceClient(){
    if(draftMode) return draft;
    return currentClient();
  }

  function fillFrom(c){
    c=c||{};
    q('ccName').value = c.name && c.name!=='Новый клиент' ? c.name : '';
    q('ccPhone').value = c.phone || '';
    q('ccEmail').value = c.email || '';
    q('ccGender').value = c.gender || '';
    q('ccCountry').value = c.country || '';
    q('ccCity').value = c.city || '';
    selectedLocationMeta=c.timezone?{
      city:c.city||'',
      country:c.country||'',
      countryCode:c.countryCode||'',
      latitude:Number.isFinite(Number(c.latitude))?Number(c.latitude):null,
      longitude:Number.isFinite(Number(c.longitude))?Number(c.longitude):null,
      timezone:c.timezone||''
    }:null;
    q('ccBirth').value = c.birth || '';
    q('ccBirthTime').value = c.birthTime || '';
    const autoAge = c.ageAuto !== undefined ? c.ageAuto === true : Boolean(c.birth);
    q('ccAgeAuto').checked = autoAge;
    q('ccAge').value = autoAge ? (ageFromBirth(c.birth) || '') : (c.age || '');
    applyAgeMode();
    q('ccVk').value = c.vk || '';
    q('ccTelegram').value = c.telegram || '';
    q('ccMax').value = c.max || '';
    q('ccInitialProblem').value = c.initialProblem || '';
    q('ccMainRequest').value = c.mainRequest || '';
    q('ccTried').value = c.tried || '';
    q('ccDesiredOutcome').value = c.desiredOutcome || '';
    q('ccClientNotes').value = c.clientNotes || c.notes || '';
    setPhoto(c.photoData||'',c.photoSourceData||c.photoData||'',c.photoCrop||{x:50,y:50,zoom:1});
    dirty=false;
    updateClientTime();
  }

  function collectData(){
    const birth=q('ccBirth').value;
    return {
      name:q('ccName').value.trim() || 'Новый клиент',
      phone:q('ccPhone').value.trim(),
      email:q('ccEmail').value.trim(),
      gender:q('ccGender').value,
      country:q('ccCountry').value.trim(),
      city:q('ccCity').value.trim(),
      countryCode:selectedLocationMeta?.countryCode||'',
      timezone:selectedLocationMeta?.timezone||'',
      latitude:selectedLocationMeta?.latitude??null,
      longitude:selectedLocationMeta?.longitude??null,
      birth,
      birthTime:q('ccBirthTime').value,
      ageAuto:q('ccAgeAuto').checked===true,
      age:(q('ccAgeAuto').checked===true ? ageFromBirth(birth) : q('ccAge').value.trim()) || '',
      vk:q('ccVk').value.trim(),
      telegram:q('ccTelegram').value.trim(),
      max:q('ccMax').value.trim(),
      initialProblem:q('ccInitialProblem').value,
      mainRequest:q('ccMainRequest').value,
      tried:q('ccTried').value,
      desiredOutcome:q('ccDesiredOutcome').value,
      clientNotes:q('ccClientNotes').value,
      photoData:photoData || '',
      photoSourceData:photoSourceData || photoData || '',
      photoCrop:{...photoCrop}
    };
  }

  function hasAnyDraftData(){
    if(photoData) return true;
    return fieldIds.some(id=>String(q(id)?.value||'').trim()!=='');
  }

  function saveCard(){
    const api=clientsApi();
    if(!api) return alert('Модуль клиентов не загрузился. Обновите страницу.');

    if(draftMode){
      if(!draft) return;
      const created=api.create?.({...draft,...collectData()},{source:'client-card-create'});
      if(!created) return alert('Не удалось сохранить клиента.');
      draftMode=false;draft=null;dirty=false;
      dlg.close();
      return;
    }

    const c=sourceClient();
    if(!c) return;
    const updated=api.update?.(c.id,collectData(),{source:'client-card'});
    if(!updated) return alert('Не удалось сохранить карточку клиента.');
    dirty=false;
    dlg.close();
  }

  function closeDraftAware(){
    if(draftMode){
      if(!hasAnyDraftData()){
        draftMode=false;draft=null;dirty=false;dlg.close();return;
      }
      if(window.confirm('Сохранить клиента?')){saveCard();return;}
      draftMode=false;draft=null;dirty=false;dlg.close();return;
    }
    dlg.close();
  }

  function openExisting(){
    const c=currentClient();
    if(!c) return alert('Сначала выбери клиента.');
    draftMode=false;draft=null;
    q('ccSaveBtn').textContent='Сохранить карточку';
    fillFrom(c);
    dlg.showModal();
    startClientClock();
  }

  function openNew(){
    draftMode=true;
    draft=typeof newClient==='function' ? newClient() : {id:(crypto.randomUUID?crypto.randomUUID():Date.now()+''),name:'Новый клиент',city:'',age:'',ageAuto:false,birth:'',birthTime:'',photoData:'',photoSourceData:'',photoCrop:{x:50,y:50,zoom:1},vk:'',telegram:'',max:'',sessions:[],requests:[]};
    q('ccSaveBtn').textContent='Сохранить клиента';
    fillFrom(draft);
    dlg.showModal();
    startClientClock();
    setTimeout(()=>q('ccName')?.focus(),0);
  }

  q('ccBirth').addEventListener('input',()=>{if(q('ccAgeAuto').checked)applyAgeMode();dirty=true;});
  q('ccAgeAuto').addEventListener('change',()=>{applyAgeMode();dirty=true;});
  q('ccAge').addEventListener('input',()=>{if(q('ccAgeAuto').checked)q('ccAgeAuto').checked=false;applyAgeMode();dirty=true;});
  fieldIds.filter(id=>id!=='ccAge'&&id!=='ccBirth').forEach(id=>q(id)?.addEventListener('input',()=>{dirty=true;}));
  q('ccCountry')?.addEventListener('input',()=>{selectedLocationMeta=null;updateClientTime();renderLocationSuggestions('country');});
  q('ccCity')?.addEventListener('input',()=>{selectedLocationMeta=null;updateClientTime();renderLocationSuggestions('city');});
  q('ccCountry')?.addEventListener('focus',()=>renderLocationSuggestions('country'));
  q('ccCity')?.addEventListener('focus',()=>renderLocationSuggestions('city'));
  q('ccCountry')?.addEventListener('blur',()=>setTimeout(()=>autocorrectLocation('country'),80));
  q('ccCity')?.addEventListener('blur',()=>setTimeout(()=>autocorrectLocation('city'),80));
  q('ccCountry')?.addEventListener('keydown',e=>{if(e.key==='Escape')hideLocationSuggestions('country');});
  q('ccCity')?.addEventListener('keydown',e=>{if(e.key==='Escape')hideLocationSuggestions('city');});
  q('ccGender')?.addEventListener('change',()=>{dirty=true;});
  q('ccCloseBtn').onclick = closeDraftAware;
  q('ccSaveBtn').onclick = saveCard;
  q('ccPhotoFrame').onclick=()=>{
    if(photoData)photoActionsDlg.showModal();
    else q('ccPhotoInput').click();
  };
  q('ccPhotoInput').onchange=e=>{
    const file=e.target.files?.[0];e.target.value='';
    if(!file||!file.type.startsWith('image/'))return;
    const reader=new FileReader();
    reader.onload=async()=>{
      try{
        const original=await loadPhotoImage(String(reader.result||''));
        const source=compressPhotoSource(original);
        await openPhotoEditor(source,{x:50,y:50,zoom:1});
      }catch(error){console.warn('[Diagnostika] client photo load failed',error);}
    };
    reader.readAsDataURL(file);
  };

  dlg.addEventListener('cancel',e=>{e.preventDefault();closeDraftAware();});
  dlg.addEventListener('close',stopClientClock);

  window.DiagnostikaClientCard={openExisting,openNew,isDraft:()=>draftMode};
})();