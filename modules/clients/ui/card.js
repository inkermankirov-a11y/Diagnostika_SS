'use strict';

(() => {
  const dlg = document.createElement('dialog');
  dlg.id = 'clientCardDialog';
  dlg.className = 'client-card-dialog';
  dlg.innerHTML = `
    <div class="client-card-window">
      <div class="client-card-window-title">РАБОТА С КЛИЕНТОМ</div>
      <div class="client-card-sheet">
        <div class="cc-photo-wrap">
          <button id="ccPhotoFrame" class="cc-photo-frame" type="button" title="Добавить или изменить фото">
            <img id="ccPhotoPreview" alt="Фото клиента">
            <span id="ccPhotoPlaceholder">Добавить фото</span>
          </button>
          <input id="ccPhotoInput" type="file" accept="image/*" hidden>
          <div class="cc-photo-help">Нажмите на фото, чтобы добавить или заменить его</div>
        </div>

        <div class="client-card-top-grid">
          <label class="cc-field cc-span-2">ФИО<input id="ccName" type="text"></label>
          <label class="cc-field">Телефон<input id="ccPhone" type="text"></label>
          <label class="cc-field">E-mail<input id="ccEmail" type="text"></label>
          <label class="cc-field">Пол<select id="ccGender"><option value=""></option><option>Мужской</option><option>Женский</option></select></label>
          <label class="cc-field cc-place-field">Страна<input id="ccCountry" type="text" autocomplete="off" spellcheck="false"><div id="ccCountrySuggestions" class="cc-place-suggestions" hidden></div></label>
          <label class="cc-field cc-place-field">Город<input id="ccCity" type="text" autocomplete="off" spellcheck="false"><div id="ccCitySuggestions" class="cc-place-suggestions" hidden></div></label>
          <label class="cc-field">Дата рождения<input id="ccBirth" type="date"></label>
          <label class="cc-field">Возраст<input id="ccAge" type="text" inputmode="numeric"></label>
          <label class="cc-field cc-social-field"><span>VK</span><input id="ccVk" type="text"></label>
          <label class="cc-field cc-social-field"><span>Telegram</span><input id="ccTelegram" type="text"></label>
          <label class="cc-field cc-social-field"><span>MAX</span><input id="ccMax" type="text"></label>
          <div class="cc-top-actions">
            <button id="ccFreeConsultBtn" type="button" class="cc-top-action-btn cc-free-consult-btn">Бесплатная консультация</button>
            <button id="ccCalendarBtn" type="button" class="cc-top-action-btn cc-calendar-btn">Календарь</button>
          </div>
          <div id="ccClientTime" class="cc-client-time cc-client-time-idle" role="status" aria-live="polite">
            <span class="cc-client-time-icon">🕒</span>
            <span class="cc-client-time-copy"><strong>Время клиента</strong><span class="cc-client-time-value">Укажите город</span></span>
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
  const fieldIds=['ccName','ccPhone','ccEmail','ccGender','ccCountry','ccCity','ccBirth','ccAge','ccVk','ccTelegram','ccMax','ccInitialProblem','ccMainRequest','ccTried','ccDesiredOutcome','ccClientNotes'];
  let draftMode=false;
  let draft=null;
  let dirty=false;
  let photoData='';
  let locationCatalogPromise=null;
  let clientClockTimer=null;
  let clientTimeRequest=0;

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

  const COUNTRY_ALIASES=Object.freeze({
    'russia':'россия','russian federation':'россия','российская федерация':'россия',
    'germany':'германия','deutschland':'германия',
    'poland':'польша','czechia':'чехия','czech republic':'чехия',
    'finland':'финляндия','belarus':'беларусь','kazakhstan':'казахстан',
    'georgia':'грузия','armenia':'армения','turkey':'турция','turkiye':'турция',
    'france':'франция','united kingdom':'великобритания','uk':'великобритания',
    'great britain':'великобритания','italy':'италия'
  });

  function normalizeCountry(value){
    const key=normalizePlace(value);
    return COUNTRY_ALIASES[key]||key;
  }

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
        cur[j]=Math.min(
          cur[j-1]+1,
          prev[j]+1,
          prev[j-1]+(a[i-1]===b[j-1]?0:1)
        );
      }
      prev=cur;
    }
    return prev[b.length];
  }

  function countryEntries(rows){
    const map=new Map();
    for(const row of rows||[]){
      const name=String(row?.country||'').trim();
      if(name&&!map.has(normalizeCountry(name)))map.set(normalizeCountry(name),name);
    }
    return [...map.values()].sort((a,b)=>a.localeCompare(b,'ru'));
  }

  function countryMatches(rows,query){
    const q=compactPlace(query);
    if(!q)return countryEntries(rows).slice(0,8).map(name=>({name,sub:''}));
    const entries=countryEntries(rows);
    return entries.map(name=>{
      const key=compactPlace(name);
      const aliasKey=compactPlace(COUNTRY_ALIASES[normalizePlace(query)]||'');
      let score=levenshtein(q,key);
      if(key.startsWith(q))score=-10+(key.length-q.length)/100;
      else if(key.includes(q))score=-5+key.indexOf(q)/100;
      if(aliasKey&&aliasKey===key)score=-20;
      return {name,sub:'',score};
    }).sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,'ru')).slice(0,8);
  }

  function resolvedCountryForFilter(rows,value){
    const typed=normalizeCountry(value);
    if(!typed)return '';
    const exact=countryEntries(rows).find(name=>normalizeCountry(name)===typed);
    if(exact)return normalizeCountry(exact);
    const best=countryMatches(rows,value)[0];
    if(best&&levenshtein(compactPlace(value),compactPlace(best.name))<=2)return normalizeCountry(best.name);
    return '';
  }

  function cityMatches(rows,query,country){
    const q=compactPlace(query);
    const countryKey=resolvedCountryForFilter(rows,country);
    const pool=(rows||[]).filter(row=>!countryKey||normalizeCountry(row?.country)===countryKey);
    if(!q)return pool.slice(0,10).map(row=>({name:row.name,sub:row.country||'',row,score:0}));
    return pool.map(row=>{
      const names=[row?.name,...(Array.isArray(row?.aliases)?row.aliases:[])].filter(Boolean);
      let best=Number.POSITIVE_INFINITY;
      for(const name of names){
        const key=compactPlace(name);
        let score=levenshtein(q,key);
        if(key.startsWith(q))score=-10+(key.length-q.length)/100;
        else if(key.includes(q))score=-5+key.indexOf(q)/100;
        if(score<best)best=score;
      }
      return {name:row.name,sub:row.country||'',row,score:best};
    }).sort((a,b)=>a.score-b.score||String(a.name).localeCompare(String(b.name),'ru')).slice(0,10);
  }

  function correctionCandidate(kind,rows,value,country=''){
    const typed=String(value||'').trim();
    const q=compactPlace(typed);
    if(q.length<3)return null;
    const matches=kind==='country'?countryMatches(rows,typed):cityMatches(rows,typed,country);
    const best=matches[0]||null;
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

  function applyLocationSuggestion(kind,item){
    const input=locationInput(kind);
    if(!input||!item)return;
    input.value=item.name||'';
    dirty=true;
    hideLocationSuggestions(kind);
    if(kind==='country'){
      renderLocationSuggestions('city');
    }
    updateClientTime();
  }

  async function renderLocationSuggestions(kind){
    const input=locationInput(kind);
    const box=suggestionBox(kind);
    if(!input||!box)return;
    const rows=await loadLocationCatalog();
    if(document.activeElement!==input){
      hideLocationSuggestions(kind);
      return;
    }
    const value=input.value;
    const matches=kind==='country'
      ?countryMatches(rows,value)
      :cityMatches(rows,value,q('ccCountry')?.value||'');
    if(!matches.length){
      hideLocationSuggestions(kind);
      return;
    }
    const correction=correctionCandidate(kind,rows,value,q('ccCountry')?.value||'');
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

  async function autocorrectLocation(kind){
    const input=locationInput(kind);
    if(!input)return;
    const value=input.value.trim();
    if(!value){hideLocationSuggestions(kind);return;}
    const rows=await loadLocationCatalog();
    const best=correctionCandidate(kind,rows,value,q('ccCountry')?.value||'');
    if(best&&compactPlace(value)!==compactPlace(best.name)){
      input.value=best.name;
      dirty=true;
      updateClientTime();
    }else if(best&&compactPlace(value)===compactPlace(best.name)&&value!==best.name){
      input.value=best.name;
      dirty=true;
      updateClientTime();
    }
    hideLocationSuggestions(kind);
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
    const cityKey=normalizePlace(city);
    if(!cityKey)return null;
    const countryKey=normalizeCountry(country);
    const candidates=(rows||[]).filter(row=>{
      const names=[row?.name,...(Array.isArray(row?.aliases)?row.aliases:[])].map(normalizePlace);
      return names.includes(cityKey);
    });
    if(!candidates.length)return null;
    if(candidates.length===1)return candidates[0];
    if(countryKey){
      const matched=candidates.find(row=>normalizeCountry(row?.country)===countryKey);
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
    const location=findClientLocation(rows,city,country);
    if(!location?.timezone){
      setClientTimeState('unknown','Часовой пояс не найден',city);
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
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return '';
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if(m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a >= 0 ? String(a) : '';
  }

  function setPhoto(data){
    photoData=data||'';
    const img=q('ccPhotoPreview');
    const ph=q('ccPhotoPlaceholder');
    if(photoData){img.src=photoData;img.style.display='block';ph.style.display='none';}
    else{img.removeAttribute('src');img.style.display='none';ph.style.display='grid';}
  }

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
    q('ccBirth').value = c.birth || '';
    q('ccAge').value = c.age || ageFromBirth(c.birth) || '';
    q('ccVk').value = c.vk || '';
    q('ccTelegram').value = c.telegram || '';
    q('ccMax').value = c.max || '';
    q('ccInitialProblem').value = c.initialProblem || '';
    q('ccMainRequest').value = c.mainRequest || '';
    q('ccTried').value = c.tried || '';
    q('ccDesiredOutcome').value = c.desiredOutcome || '';
    q('ccClientNotes').value = c.clientNotes || c.notes || '';
    setPhoto(c.photoData||'');
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
      birth,
      age:q('ccAge').value.trim() || ageFromBirth(birth) || '',
      vk:q('ccVk').value.trim(),
      telegram:q('ccTelegram').value.trim(),
      max:q('ccMax').value.trim(),
      initialProblem:q('ccInitialProblem').value,
      mainRequest:q('ccMainRequest').value,
      tried:q('ccTried').value,
      desiredOutcome:q('ccDesiredOutcome').value,
      clientNotes:q('ccClientNotes').value,
      photoData:photoData || ''
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
    draft=typeof newClient==='function' ? newClient() : {id:(crypto.randomUUID?crypto.randomUUID():Date.now()+''),name:'Новый клиент',city:'',age:'',birth:'',photoData:'',vk:'',telegram:'',max:'',sessions:[],requests:[]};
    q('ccSaveBtn').textContent='Сохранить клиента';
    fillFrom(draft);
    dlg.showModal();
    startClientClock();
    setTimeout(()=>q('ccName')?.focus(),0);
  }

  q('ccBirth').addEventListener('input', e => { q('ccAge').value = ageFromBirth(e.target.value); dirty=true; });
  fieldIds.forEach(id=>q(id)?.addEventListener('input',()=>{dirty=true;}));
  q('ccCountry')?.addEventListener('input',()=>{updateClientTime();renderLocationSuggestions('country');});
  q('ccCity')?.addEventListener('input',()=>{updateClientTime();renderLocationSuggestions('city');});
  q('ccCountry')?.addEventListener('focus',()=>renderLocationSuggestions('country'));
  q('ccCity')?.addEventListener('focus',()=>renderLocationSuggestions('city'));
  q('ccCountry')?.addEventListener('blur',()=>setTimeout(()=>autocorrectLocation('country'),80));
  q('ccCity')?.addEventListener('blur',()=>setTimeout(()=>autocorrectLocation('city'),80));
  q('ccCountry')?.addEventListener('keydown',e=>{if(e.key==='Escape')hideLocationSuggestions('country');});
  q('ccCity')?.addEventListener('keydown',e=>{if(e.key==='Escape')hideLocationSuggestions('city');});
  q('ccGender')?.addEventListener('change',()=>{dirty=true;});
  q('ccCloseBtn').onclick = closeDraftAware;
  q('ccSaveBtn').onclick = saveCard;
  q('ccPhotoFrame').onclick=()=>q('ccPhotoInput').click();
  q('ccPhotoInput').onchange=e=>{
    const f=e.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{setPhoto(r.result);dirty=true;};
    r.readAsDataURL(f);
    e.target.value='';
  };

  dlg.addEventListener('click', e => { if(e.target === dlg) closeDraftAware(); });
  dlg.addEventListener('cancel',e=>{e.preventDefault();closeDraftAware();});
  dlg.addEventListener('close',stopClientClock);

  window.DiagnostikaClientCard={openExisting,openNew,isDraft:()=>draftMode};
})();