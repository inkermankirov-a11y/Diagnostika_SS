'use strict';

(() => {
  if(window.DiagnostikaHypothesis)return;

  const TEST_URL='https://lugovoyn8n.ru/webhook-test/diagnostika-client-chat-v1';
  const PROD_URL='https://lugovoyn8n.ru/webhook/diagnostika-client-chat-v1';

  const PROMPT_TEMPLATE=`Ты — специалист по психологической диагностике.

На основании заполненной диагностической таблицы сформируй ДВЕ рабочие гипотезы о механизме проблемы клиента:

1. РАСШИРЕННАЯ ГИПОТЕЗА
2. КОРОТКАЯ ГИПОТЕЗА

ГИПОТЕЗА — это не пересказ таблицы и не перечисление всех найденных чувств, страхов и убеждений.

Твоя задача — найти главную причинно-следственную конструкцию клиента и связать её с исходным запросом.

ЛОГИКА:

ГЛУБОКОЕ УБЕЖДЕНИЕ / САМООПРЕДЕЛЕНИЕ
↓
ВТОРИЧНЫЕ УБЕЖДЕНИЯ И САМООПРЕДЕЛЕНИЯ
↓
ВТОРИЧНЫЕ ЧУВСТВА / СТРАХИ / РЕАКЦИИ
↓
ПЕРВИЧНОЕ УБЕЖДЕНИЕ В КОНКРЕТНОЙ СИТУАЦИИ
↓
ПОВТОРЯЮЩИЕСЯ СИТУАЦИИ
↓
СФЕРА ЖИЗНИ
↓
ИСХОДНЫЙ ЗАПРОС КЛИЕНТА

Гипотезу формулируй ОТ ГЛУБОКОГО К ПОВЕРХНОСТНОМУ — с конца диагностики обратно к первоначальному запросу клиента.

Перед написанием гипотезы внутренне проанализируй:

— Какие негативные самоопределения повторяются в разных ветках диагностики?
— Какие убеждения имеют самый высокий уровень дискомфорта?
— Какие глубокие убеждения возникают через разные вторичные чувства?
— Какие разные слова клиента описывают один и тот же смысл?
— Какое убеждение или связка убеждений лучше всего объединяет несколько элементов диагностики?
— Какие чувства, страхи и реакции возникают на их фоне?
— Какие первичные убеждения включаются в конкретных ситуациях?
— В каких ситуациях эта конструкция повторяется?
— В какой сфере жизни это проявляется?
— Как всё это связано с исходным запросом клиента?

ВАЖНО:

Не выбирай главное убеждение только потому, что оно имеет максимальную оценку.

Приоритет имеет убеждение, которое:
— повторяется;
— встречается в нескольких ветках;
— связано с несколькими чувствами или ситуациями;
— лучше всего объясняет общую картину.

Если одно глубокое убеждение не объясняет картину полностью, допускается связка из 2–3 близких убеждений.

Не придумывай причин, которых нет в диагностике.

Не добавляй самостоятельно:
— детские травмы;
— родителей;
— события прошлого;
— травматический опыт;
— скрытые мотивы;
— психиатрические или психологические диагнозы.

Добавляй их только тогда, когда они прямо присутствуют в данных клиента.

Не путай между собой:
— ситуацию;
— чувство;
— страх;
— инстинктивную реакцию;
— убеждение;
— самоопределение клиента.

Основой гипотезы являются прежде всего УБЕЖДЕНИЯ И САМООПРЕДЕЛЕНИЯ.

Используй преимущественно слова самого клиента.

Допускается объединять смысловые дубли.

Например:
«глупый», «несмышлёный», «неспособный» могут относиться к более общей конструкции «я недостаточно способен».

Но не объединяй слова автоматически. Учитывай контекст, в котором клиент их произносит.

РАСШИРЕННАЯ ГИПОТЕЗА

Напиши один цельный абзац.

Ориентировочная длина: 80–180 слов.

Раскрой причинную цепочку:

1. Как клиент глубоко воспринимает себя.
2. Какие чувства, страхи и внутренние реакции из этого возникают.
3. Как он воспринимает себя непосредственно в проблемных ситуациях.
4. Какие ситуации запускают эту конструкцию.
5. Как эта конструкция влияет на поведение или восприятие.
6. Как из неё формируется поверхностный запрос клиента.

Пример логики:

«В глубине ты воспринимаешь себя нереализованным, слабым, бедным, потерпевшим неудачу. Поэтому в ситуации долгов у тебя возникают вина, разочарование в себе, злость, боль и страх не выполнить обещанное. В звонке кредитора ты видишь подтверждение тому, что ты мошенник, лжец и неудачник. Из-за этого усиливается страх потерять последнее, что осталось ценным, — семью. Поэтому на поверхности тебе кажется, что главная проблема — страх потери семьи, хотя глубже находится переживание собственной нереализованности».

НЕ КОПИРУЙ этот пример.
Каждый раз строй гипотезу исключительно по данным конкретного клиента.

Текст должен звучать как цельное объяснение механизма проблемы, а не как перечень пунктов из таблицы.

КОРОТКАЯ ГИПОТЕЗА

Сформулируй главный вывод в 1–3 предложениях.

Короткая гипотеза должна показать:

ПОВЕРХНОСТНЫЙ ЗАПРОС → ЧТО НА САМОМ ДЕЛЕ ПОВТОРЯЕТСЯ ПОД НИМ.

Примеры формы:

«Похоже, проблема не только в продажах. Когда ты не получаешь результат, у тебя снова включается убеждение, что ты беспомощный и неспособный повлиять на ситуацию. И уже из этой конструкции строится твоя реакция на продажи».

Или:

«Твоя тревожность не возникает сама по себе. В разных ситуациях под ней повторяется одно и то же восприятие себя: “я глупый, неполноценный, не справляюсь”. Похоже, именно эта конструкция поддерживает тревогу».

Или при очень явной связи:

«На поверхности это выглядит как страх потерять семью. Но глубже снова и снова появляется переживание собственной нереализованности и несостоятельности».

КОРОТКАЯ ГИПОТЕЗА НЕ ДОЛЖНА:
— пересказывать всю диагностику;
— перечислять десять убеждений;
— объяснять каждый шаг;
— содержать рекомендации.

Найди одну главную мысль, которая связывает весь запрос.

ТОН:

— прямой;
— понятный;
— человеческий;
— без канцелярита;
— без эзотерики;
— без лишних психологических терминов;
— без обвинений;
— без морализаторства;
— без чрезмерной категоричности.

Гипотеза остаётся гипотезой.

Если причинная связь не подтверждена однозначно, используй формулировки:

«Похоже…»
«По диагностике здесь повторяется…»
«Можно предположить…»
«Здесь прослеживается…»
«Судя по ответам…»

Не утверждай:
«Это стопроцентная причина».
«Вся проблема именно в этом».
«У тебя на самом деле нет другой проблемы».

Если данных недостаточно для качественной гипотезы — не додумывай. Сформулируй то, что подтверждается данными, и обозначь, какая связь пока остаётся неясной.

НЕ ПИШИ:

— рекомендации;
— способы проработки;
— план терапии;
— количество сессий;
— советы;
— диагнозы;
— объяснение таблицы;
— дополнительные гипотезы;
— анализ качества диагностики.

ФОРМАТ ОТВЕТА:

РАСШИРЕННАЯ ГИПОТЕЗА:
[один цельный абзац]

КОРОТКАЯ ГИПОТЕЗА:
[1–3 предложения]

ДАННЫЕ КЛИЕНТА:
{{DIAGNOSTIC_DATA}}`;

  let overlay=null;
  let busy=false;
  let openedRequestId='';

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
    const s=String(value??'').trim();
    return s||'';
  }

  function buildDiagnosticData(){
    const c=currentClient();
    const r=currentRequest(c);
    if(!c||!r)return null;

    const snapshot=window.DiagnostikaDiagnosis?.snapshot?.(r.id,c.id);
    const situations=Array.isArray(snapshot?.situations)
      ? snapshot.situations
      : Array.isArray(r.situations)?r.situations:[];

    return {
      клиент:{
        имя:cleanText(c.name)
      },
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
          уровень: Number.isFinite(Number(b?.level))?Number(b.level):null,
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

  function buildPrompt(data=buildDiagnosticData()){
    if(!data)return '';
    return PROMPT_TEMPLATE.replace('{{DIAGNOSTIC_DATA}}',JSON.stringify(data,null,2));
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
    for(const key of ['reply','answer','message','text','output_text']){
      if(data?.[key])return String(data[key]).trim();
    }
    let out='';
    for(const item of data?.output||[]){
      for(const part of item?.content||[]){
        if(part?.type==='output_text'&&part?.text)out+=String(part.text);
      }
    }
    return out.trim();
  }

  async function askAi(c,r,data){
    const message=buildPrompt(data);
    const payload={
      accessKey:getAccessKey(),
      clientId:String(c.id||''),
      clientName:c.name||'',
      message,
      clientContext:{
        purpose:'diagnosis-hypothesis',
        selectedRequestId:String(r.id||''),
        diagnosticData:data
      },
      chatHistory:[]
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
    if([404,405,409,410].includes(prod.response.status))throw new Error('AI для гипотезы сейчас недоступен.');
    if(!prod.response.ok)throw new Error(`AI: HTTP ${prod.response.status}`);

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

  function resultHtml(raw){
    const parsed=parseAnswer(raw);
    if(parsed.expanded||parsed.short){
      return `
        ${parsed.expanded?`<section class="diagnosis-hypothesis-result-section diagnosis-hypothesis-result-expanded"><h3>Расширенная гипотеза</h3><div>${esc(parsed.expanded).replace(/\n/g,'<br>')}</div></section>`:''}
        ${parsed.short?`<section class="diagnosis-hypothesis-result-section diagnosis-hypothesis-result-short"><h3>Короткая гипотеза</h3><div>${esc(parsed.short).replace(/\n/g,'<br>')}</div></section>`:''}
      `;
    }
    return `<div class="diagnosis-hypothesis-raw">${esc(parsed.raw).replace(/\n/g,'<br>')}</div>`;
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
        <div class="diagnosis-hypothesis-note">Гипотеза формируется только по выбранному запросу и заполненной диагностике этого запроса.</div>
        <div class="diagnosis-hypothesis-result" aria-live="polite">
          <div class="diagnosis-hypothesis-empty">Нажмите «Сформировать», чтобы получить расширенную и короткую гипотезу.</div>
        </div>
        <div class="diagnosis-hypothesis-status" aria-live="polite"></div>
        <footer class="diagnosis-hypothesis-actions">
          <button type="button" class="tk-btn diagnosis-hypothesis-generate">Сформировать</button>
          <button type="button" class="tk-btn diagnosis-hypothesis-cancel">Закрыть</button>
        </footer>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.diagnosis-hypothesis-close').addEventListener('click',close);
    overlay.querySelector('.diagnosis-hypothesis-cancel').addEventListener('click',close);
    overlay.querySelector('.diagnosis-hypothesis-generate').addEventListener('click',generate);
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
    root.querySelector('.diagnosis-hypothesis-request').textContent=`Запрос: ${r.title||'Без названия'}`;
    root.querySelector('.diagnosis-hypothesis-result').innerHTML='<div class="diagnosis-hypothesis-empty">Нажмите «Сформировать», чтобы получить расширенную и короткую гипотезу.</div>';
    setStatus('');
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
      result.innerHTML=resultHtml(answer);
      setStatus('Гипотеза сформирована.','success');
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
    buildPrompt,
    parseAnswer,
    promptTemplate:PROMPT_TEMPLATE,
    testUrl:TEST_URL,
    productionUrl:PROD_URL
  });

  document.addEventListener('diagnostika:mode-rendered',()=>setTimeout(bindButton,0));
  init();
})();
