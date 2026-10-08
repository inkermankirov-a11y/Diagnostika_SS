'use strict';

(() => {
  if(window.DiagnostikaHypothesis)return;

  const TEST_URL='https://lugovoyn8n.ru/webhook-test/diagnostika-hypothesis-v1';
  const PROD_URL='https://lugovoyn8n.ru/webhook/diagnostika-hypothesis-v1';

  let overlay=null;
  let busy=false;
  let openedRequestId='';
  let lastGeneratedRaw='';
  let lastGeneratedRequestId='';

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function currentClient(){
    return window.DiagnostikaClients?.current?.()||null;
  }

  function currentRequest(c=currentClient()){
    if(!c)return null;
    return window.DiagnostikaRequests?.viewed?.(c)
      ||window.DiagnostikaRequests?.active?.(c)
      ||null;
  }

  function cleanText(value){
    return String(value??'').trim();
  }

  function buildDiagnosticData(){
    const c=currentClient();
    const r=currentRequest(c);
    if(!c||!r)return null;

    const snapshot=window.DiagnostikaDiagnosis?.snapshot?.(r.id,c.id);
    const situations=Array.isArray(snapshot?.situations)
      ? snapshot.situations
      : Array.isArray(r.situations)?r.situations:[];

    // Include every Strong VU shown in the sidebar (level >= 6), not just
    // one or two chosen by the model. Use the column's exact grouping,
    // normalization and ordering, including entries behind "Показать ещё".
    const strongVuGroups=window.DiagnostikaStrongVuSummary?.collectForRequest?.({situations})||[];
    const strongVu=strongVuGroups.map(group=>({
      убеждение:group.displayText,
      максимальный_уровень:group.maxLevel,
      повторений:group.count,
      ветки:group.occurrences.map(occurrence=>{
        const s=situations.find(x=>String(x?.id||'')===String(occurrence.situationId||''));
        const b=(s?.beliefs||[]).find(x=>String(x?.id||'')===String(occurrence.beliefId||''));
        const f=(b?.feelings||[]).find(x=>String(x?.id||'')===String(occurrence.feelingId||''));
        const d=(f?.deep||[]).find(x=>String(x?.id||'')===String(occurrence.deepId||''));
        return {
          ситуация:cleanText(s?.name),
          первичное_убеждение:cleanText(b?.text),
          вторичное_чувство:cleanText(f?.text),
          уровень_ВУ:occurrence.level,
          реакции:(d?.instincts||[]).map(x=>cleanText(x?.name)).filter(Boolean)
        };
      })
    }));

    return {
      клиент:{имя:cleanText(c.name)},
      сильные_ВУ:strongVu,
      исходный_запрос:{
        id:String(r.id||''),
        формулировка:cleanText(r.title),
        статус:cleanText(r.status)
      },
      ситуации:situations.map(s=>({
        ситуация:cleanText(s?.name),
        уровень_дискомфорта:Number.isFinite(Number(s?.level))?Number(s.level):null,
        комментарий:cleanText(s?.comment),
        желаемый_результат:cleanText(s?.result),
        первичные_убеждения:(Array.isArray(s?.beliefs)?s.beliefs:[]).map(b=>({
          убеждение:cleanText(b?.text),
          уровень:Number.isFinite(Number(b?.level))?Number(b.level):null,
          комментарий:cleanText(b?.comment),
          вторичные_чувства:(Array.isArray(b?.feelings)?b.feelings:[]).map(f=>({
            чувство_или_реакция:cleanText(f?.text),
            уровень:Number.isFinite(Number(f?.level))?Number(f.level):null,
            комментарий:cleanText(f?.comment),
            вторичные_убеждения:(Array.isArray(f?.deep)?f.deep:[]).map(d=>({
              убеждение_или_самоопределение:cleanText(d?.text),
              уровень:Number.isFinite(Number(d?.level))?Number(d.level):null,
              комментарий:cleanText(d?.comment),
              инстинктивные_реакции:(Array.isArray(d?.instincts)?d.instincts:[]).map(x=>({
                реакция:cleanText(x?.name),
                уровень:Number.isFinite(Number(x?.level))?Number(x.level):null,
                комментарий:cleanText(x?.comment)
              }))
            }))
          }))
        }))
      }))
    };
  }

  function getAccessKey(){
    let cfg=null;
    try{cfg=window.DiagnostikaRequestAI?.getConfig?.()||null;}catch(_){}
    if(!cfg?.key){
      try{cfg=window.DiagnostikaRequestAI?.configure?.()||null;}catch(err){throw err;}
    }
    const key=String(cfg?.key||'').trim();
    if(!key)throw new Error('Для формирования гипотезы нужен ключ доступа AI.');
    return key;
  }

  async function fetchJson(url,payload){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),60000);
    try{
      const response=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        cache:'no-store',
        credentials:'omit',
        signal:controller.signal
      });
      const text=await response.text();
      let data={};
      try{data=text?JSON.parse(text):{};}catch(_){data={text};}
      return {response,data};
    }finally{
      clearTimeout(timer);
    }
  }

  function replyText(data){
    if(typeof data==='string')return data.trim();
    if(data?.reply)return String(data.reply).trim();
    const expanded=String(data?.expandedHypothesis||'').trim();
    const short=String(data?.shortHypothesis||'').trim();
    if(expanded||short){
      return `РАСШИРЕННАЯ ГИПОТЕЗА:\n${expanded}\n\nКОРОТКАЯ ГИПОТЕЗА:\n${short}`.trim();
    }
    return '';
  }

  function selectedAddressMode(){
    const checked=ensureOverlay().querySelector('input[name="diagnosisHypothesisAddress"]:checked');
    const mode=String(checked?.value||'ty');
    return ['ty','vy','third'].includes(mode)?mode:'ty';
  }

  async function askAi(c,r,data){
    const payload={
      accessKey:getAccessKey(),
      clientId:String(c.id||''),
      clientName:c.name||'',
      requestId:String(r.id||''),
      addressMode:selectedAddressMode(),
      diagnosticData:data
    };

    let test=null;
    try{test=await fetchJson(TEST_URL,payload);}catch(_){test=null;}
    if(test?.response?.ok){
      const text=replyText(test.data);
      if(text)return text;
    }
    if(test?.response&&[401,403].includes(test.response.status))throw new Error('n8n отклонил ключ доступа.');

    const prod=await fetchJson(PROD_URL,payload);
    if([401,403].includes(prod.response.status))throw new Error('n8n отклонил ключ доступа.');
    if([404,405,409,410].includes(prod.response.status)){
      throw new Error('Отдельный workflow «Гипотеза» ещё не включён в n8n.');
    }
    if(!prod.response.ok)throw new Error(`Гипотеза AI: HTTP ${prod.response.status}`);

    const text=replyText(prod.data);
    if(!text)throw new Error('AI не вернул текст гипотезы.');
    return text;
  }

  function parseAnswer(raw){
    const text=String(raw||'').trim();
    const expandedMatch=text.match(/РАСШИРЕННАЯ\s+ГИПОТЕЗА\s*:\s*([\s\S]*?)(?=\n\s*КОРОТКАЯ\s+ГИПОТЕЗА\s*:|$)/i);
    const shortMatch=text.match(/КОРОТКАЯ\s+ГИПОТЕЗА\s*:\s*([\s\S]*?)$/i);
    return {
      raw:text,
      expanded:expandedMatch?.[1]?.trim()||'',
      short:shortMatch?.[1]?.trim()||''
    };
  }

  function expandedParagraphs(text){
    // One coherent block is an explicit requirement of the hypothesis format.
    // Legacy multi-paragraph results are displayed as one paragraph too.
    const source=String(text||'').trim()
      .replace(/^(Глубинная конструкция|Что запускается|Как это проявляется|Связь с запросом)\s*:\s*/gim,'')
      .replace(/\s+/g,' ')
      .trim();
    return source?[source]:[];
  }

    function expandedHtml(text){
    return expandedParagraphs(text)
      .map(p=>`<p>${esc(p).replace(/\n/g,'<br>')}</p>`)
      .join('');
  }

  function resultHtml(raw){
    const parsed=parseAnswer(raw);
    if(parsed.expanded||parsed.short){
      return `
        ${parsed.expanded?`<section class="diagnosis-hypothesis-result-section diagnosis-hypothesis-result-expanded"><h3>Расширенная гипотеза</h3><div class="diagnosis-hypothesis-expanded-content">${expandedHtml(parsed.expanded)}</div></section>`:''}
        ${parsed.short?`<section class="diagnosis-hypothesis-result-section diagnosis-hypothesis-result-short"><h3>Короткая гипотеза</h3><div>${esc(parsed.short).replace(/\n/g,'<br>')}</div></section>`:''}
      `;
    }
    return `<div class="diagnosis-hypothesis-raw">${esc(parsed.raw).replace(/\n/g,'<br>')}</div>`;
  }

  function savedHypothesis(request){
    const h=request?.hypothesis;
    if(!h||typeof h!=='object'||!String(h.raw||'').trim())return null;
    return h;
  }

  function formatSavedAt(value){
    if(!value)return '';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    return d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  function setSaveState(saved){
    const btn=ensureOverlay().querySelector('.diagnosis-hypothesis-save');
    if(saved){
      btn.disabled=true;
      btn.textContent='Сохранено';
    }else{
      btn.disabled=!lastGeneratedRaw;
      btn.textContent='Сохранить гипотезу';
    }
  }

  function ensureOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='diagnosisHypothesisOverlay';
    overlay.className='diagnosis-hypothesis-overlay';
    overlay.hidden=true;
    overlay.innerHTML=`
      <section class="diagnosis-hypothesis-modal" role="dialog" aria-modal="true" aria-labelledby="diagnosisHypothesisTitle">
        <header class="diagnosis-hypothesis-head">
          <div>
            <h2 id="diagnosisHypothesisTitle">Гипотеза по запросу</h2>
            <div class="diagnosis-hypothesis-request"></div>
          </div>
          <button type="button" class="diagnosis-hypothesis-close" aria-label="Закрыть">×</button>
        </header>
        <fieldset class="diagnosis-hypothesis-address">
          <legend>Форма обращения</legend>
          <label><input type="radio" name="diagnosisHypothesisAddress" value="ty" checked><span>Ты</span></label>
          <label><input type="radio" name="diagnosisHypothesisAddress" value="vy"><span>Вы</span></label>
          <label><input type="radio" name="diagnosisHypothesisAddress" value="third"><span>Третье лицо</span></label>
        </fieldset>
        <div class="diagnosis-hypothesis-note">Гипотеза формируется отдельным AI-сценарием только по выбранному запросу и его диагностике.</div>
        <div class="diagnosis-hypothesis-result" aria-live="polite">
          <div class="diagnosis-hypothesis-empty">Нажмите «Сформировать», чтобы получить расширенную и короткую гипотезу.</div>
        </div>
        <div class="diagnosis-hypothesis-status" aria-live="polite"></div>
        <footer class="diagnosis-hypothesis-actions">
          <button type="button" class="tk-btn diagnosis-hypothesis-save" disabled>Сохранить гипотезу</button>
          <button type="button" class="tk-btn diagnosis-hypothesis-generate">Сформировать</button>
          <button type="button" class="tk-btn diagnosis-hypothesis-cancel">Закрыть</button>
        </footer>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.diagnosis-hypothesis-close').addEventListener('click',close);
    overlay.querySelector('.diagnosis-hypothesis-cancel').addEventListener('click',close);
    overlay.querySelector('.diagnosis-hypothesis-generate').addEventListener('click',generate);
    overlay.querySelector('.diagnosis-hypothesis-save').addEventListener('click',saveHypothesis);
    overlay.querySelectorAll('input[name="diagnosisHypothesisAddress"]').forEach(input=>{
      input.addEventListener('change',()=>{
        if(input.checked){
          try{localStorage.setItem('diagnostika-hypothesis-address-mode',input.value);}catch(_){}
        }
      });
    });
    overlay.addEventListener('mousedown',e=>{if(e.target===overlay)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
    return overlay;
  }

  function setStatus(text='',kind=''){
    const el=ensureOverlay().querySelector('.diagnosis-hypothesis-status');
    el.textContent=text;
    el.className=`diagnosis-hypothesis-status ${kind}`.trim();
  }

  function setBusy(value){
    busy=Boolean(value);
    const btn=ensureOverlay().querySelector('.diagnosis-hypothesis-generate');
    btn.disabled=busy;
    btn.textContent=busy?'Формирую…':'Сформировать';
  }

  function open(){
    const c=currentClient();
    const r=currentRequest(c);
    const root=ensureOverlay();
    if(!c||!r){
      window.AppDialog?.alert?.('Сначала выберите запрос для диагностики.','Гипотеза');
      return false;
    }
    openedRequestId=String(r.id||'');
    const saved=savedHypothesis(r);
    let savedMode=String(saved?.addressMode||'');
    if(!['ty','vy','third'].includes(savedMode)){
      try{savedMode=localStorage.getItem('diagnostika-hypothesis-address-mode')||'ty';}catch(_){savedMode='ty';}
    }
    if(!['ty','vy','third'].includes(savedMode))savedMode='ty';
    const modeInput=root.querySelector(`input[name="diagnosisHypothesisAddress"][value="${savedMode}"]`);
    if(modeInput)modeInput.checked=true;
    root.querySelector('.diagnosis-hypothesis-request').textContent=`Запрос: ${r.title||'Без названия'}`;

    if(saved){
      lastGeneratedRaw=String(saved.raw||'');
      lastGeneratedRequestId=String(r.id||'');
      root.querySelector('.diagnosis-hypothesis-result').innerHTML=resultHtml(lastGeneratedRaw);
      const stamp=formatSavedAt(saved.savedAt);
      setStatus(stamp?`Сохранённая гипотеза · ${stamp}`:'Сохранённая гипотеза','saved');
      setSaveState(true);
    }else{
      lastGeneratedRaw='';
      lastGeneratedRequestId='';
      root.querySelector('.diagnosis-hypothesis-result').innerHTML='<div class="diagnosis-hypothesis-empty">Нажмите «Сформировать», чтобы получить расширенную и короткую гипотезу.</div>';
      setStatus('');
      setSaveState(false);
    }
    setBusy(false);
    root.hidden=false;
    document.documentElement.classList.add('diagnosis-hypothesis-open');
    return true;
  }

  function close(){
    if(busy)return;
    const root=ensureOverlay();
    root.hidden=true;
    document.documentElement.classList.remove('diagnosis-hypothesis-open');
  }

  async function generate(){
    if(busy)return null;
    const c=currentClient();
    const r=currentRequest(c);
    if(!c||!r){
      setStatus('Запрос не выбран.','error');
      return null;
    }
    if(openedRequestId&&String(r.id||'')!==openedRequestId){
      setStatus('Выбран другой запрос. Закройте окно и откройте «Гипотеза» снова.','error');
      return null;
    }

    const data=buildDiagnosticData();
    if(!data?.ситуации?.length){
      setStatus('В выбранном запросе пока нет заполненных ситуаций для гипотезы.','error');
      return null;
    }

    setBusy(true);
    setStatus('Анализирую диагностику выбранного запроса…','busy');
    const result=ensureOverlay().querySelector('.diagnosis-hypothesis-result');
    result.innerHTML='<div class="diagnosis-hypothesis-loading"><span></span> Формируется гипотеза…</div>';

    try{
      const answer=await askAi(c,r,data);
      lastGeneratedRaw=answer;
      lastGeneratedRequestId=String(r.id||'');
      result.innerHTML=resultHtml(answer);
      setSaveState(false);
      setStatus('Гипотеза сформирована. Сохраните её, чтобы она осталась у этого запроса.','success');
      return answer;
    }catch(err){
      console.warn('Diagnosis hypothesis generation failed',err);
      result.innerHTML='<div class="diagnosis-hypothesis-empty">Не удалось сформировать гипотезу.</div>';
      setStatus(err?.message||'Не удалось получить ответ AI.','error');
      return null;
    }finally{
      setBusy(false);
    }
  }

  function saveHypothesis(){
    if(busy)return false;
    const c=currentClient();
    const r=currentRequest(c);
    if(!c||!r||!lastGeneratedRaw){
      setStatus('Сначала сформируйте гипотезу.','error');
      return false;
    }
    if(String(r.id||'')!==String(openedRequestId||'')||String(r.id||'')!==String(lastGeneratedRequestId||'')){
      setStatus('Запрос изменился. Откройте гипотезу заново.','error');
      return false;
    }

    const parsed=parseAnswer(lastGeneratedRaw);
    const savedAt=new Date().toISOString();
    const updated=window.DiagnostikaRequests?.update?.(
      r.id,
      {
        hypothesis:{
          raw:lastGeneratedRaw,
          expanded:parsed.expanded,
          short:parsed.short,
          addressMode:selectedAddressMode(),
          savedAt
        }
      },
      {source:'diagnosis-hypothesis-save',render:false}
    );

    if(!updated){
      setStatus('Не удалось сохранить гипотезу.','error');
      return false;
    }

    setSaveState(true);
    setStatus(`Гипотеза сохранена · ${formatSavedAt(savedAt)}`,'saved');
    return true;
  }

  function bindButton(){
    const btn=document.querySelector('.diagnosis-hypothesis-btn');
    if(!btn)return false;
    if(btn.dataset.hypothesisBound==='1')return true;
    btn.dataset.hypothesisBound='1';
    btn.addEventListener('click',open);
    return true;
  }

  let tries=0;
  function init(){
    if(bindButton())return;
    tries++;
    if(tries<60)setTimeout(init,100);
  }

  window.DiagnostikaHypothesis=Object.freeze({
    open,
    close,
    generate,
    buildDiagnosticData,
    parseAnswer,
    selectedAddressMode,
    saveHypothesis,
    expandedParagraphs,
    testUrl:TEST_URL,
    productionUrl:PROD_URL,
    workflow:'diagnostika-hypothesis-v1'
  });

  document.addEventListener('diagnostika:mode-rendered',()=>setTimeout(bindButton,0));
  init();
})();
