'use strict';

(() => {
  const dlg=document.getElementById('freeConsultationDialog');
  const resultDlg=document.getElementById('freeConsultationAiResultDialog');
  if(!dlg||!resultDlg||dlg.dataset.v2Ready==='1')return;
  dlg.dataset.v2Ready='1';

  const style=document.createElement('style');
  style.textContent=`
    .fc-v2-grid-note{grid-column:1/-1;font-size:11px;color:#75859a;margin-top:-3px}
    .fc-v2-short-list{display:grid;gap:8px}
    .fc-v2-short-option{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;width:100%;text-align:left;border:1px solid #d7e1ec;background:#fff;border-radius:10px;padding:10px 11px;cursor:pointer;color:#26384b}
    .fc-v2-short-option:hover{border-color:#8eb7ef;background:#f7fbff}
    .fc-v2-short-option.selected{border-color:#3f8af5;background:#eef6ff;box-shadow:0 0 0 2px rgba(63,138,245,.10)}
    .fc-v2-short-radio{width:16px;height:16px;border:2px solid #8aa0b8;border-radius:50%;display:block;position:relative}
    .fc-v2-short-option.selected .fc-v2-short-radio{border-color:#2d78e6}
    .fc-v2-short-option.selected .fc-v2-short-radio:after{content:'';position:absolute;inset:3px;background:#2d78e6;border-radius:50%}
    .fc-v2-short-title{font-weight:800;font-size:13px;line-height:1.3}
    .fc-v2-short-percent{font-size:12px;font-weight:900;color:#2b6ecb;white-space:nowrap}
    .fc-v2-selected-edit{display:grid;gap:5px;margin-top:9px}.fc-v2-selected-edit span{font-size:11px;font-weight:900;color:#60758f}
    .fc-v2-selected-edit input{width:100%;box-sizing:border-box;border:1px solid #c7d4e2;border-radius:8px;padding:9px 10px;font:600 13px 'Segoe UI',Arial,sans-serif;color:#20344c}
    .fc-v2-situations{display:grid;gap:7px}
    .fc-v2-situation-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:center}
    .fc-v2-situation-row input{width:100%;box-sizing:border-box;border:1px solid #cbd6e2;border-radius:8px;padding:8px 9px;font:500 12px 'Segoe UI',Arial,sans-serif}
    .fc-v2-situation-row button{width:32px;height:32px!important;padding:0!important}
    .fc-v2-add-situation{justify-self:start;margin-top:2px}
    .fc-v2-questions{display:grid;gap:6px}.fc-v2-question{padding:8px 9px;border-radius:8px;background:#fff;border:1px solid #e0e7ef;font-size:12px;line-height:1.4;color:#31465f}
    .fc-v2-created{padding:9px 10px;border:1px solid #b9dfc8;background:#eefbf3;color:#267047;border-radius:8px;font-size:12px;font-weight:700;margin-top:10px;display:none}
    .fc-v2-created.show{display:block}
    .fc-v2-main-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .fc-v2-primary{background:linear-gradient(#4b90f5,#2871da)!important;color:#fff!important;border-color:#2871da!important;font-weight:900!important}
    .fc-v2-create{background:linear-gradient(#48a873,#278656)!important;color:#fff!important;border-color:#278656!important;font-weight:900!important}
    .fc-v2-warning{font-size:11px;color:#7c6542;margin-top:6px}
    @media(max-width:720px){.fc-v2-short-option{grid-template-columns:auto 1fr}.fc-v2-short-percent{grid-column:2}.fc-v2-situation-row{grid-template-columns:1fr auto}}
  `;
  document.head.appendChild(style);

  const grid=dlg.querySelector('.fc-grid');
  if(grid&&!grid.querySelector('.fc-why-now')){
    grid.insertAdjacentHTML('beforeend',`
      <label class="fc-field"><span>Почему сейчас</span><textarea class="fc-why-now" placeholder="Почему клиент обратился именно сейчас? Что изменилось, обострилось или стало особенно важным..."></textarea></label>
      <label class="fc-field"><span>Как изменится жизнь после решения проблемы</span><textarea class="fc-life-after" placeholder="Что изменится в отношениях, работе, деньгах, состоянии и поведении, если проблема перестанет мешать..."></textarea></label>
      <div class="fc-v2-grid-note">Записывай слова клиента максимально близко к тому, как он их говорит. ИИ не должен придумывать причины, которых клиент не называл.</div>
    `);
  }
  const intro=dlg.querySelector('.fc-intro');
  if(intro)intro.textContent='Записывай слова клиента по ходу разговора. ИИ отделит развёрнутый основной запрос от короткого запроса-препятствия для Диагностики и выделит уже названные клиентом конкретные ситуации.';
  const aiBtn=dlg.querySelector('.fc-ai');
  if(aiBtn)aiBtn.textContent='✨ Проанализировать консультацию';

  resultDlg.innerHTML=`
    <section class="fc-result-window">
      <div class="fc-result-head"><strong>ИИ — анализ бесплатной консультации</strong><button type="button" class="tk-btn fc-v2-result-close">×</button></div>
      <div class="fc-result-note">Проверь формулировки перед сохранением и созданием диагностики.</div>

      <div class="fc-result-label">Развёрнутый основной запрос клиента</div>
      <textarea class="fc-result-main" placeholder="Развёрнутая формулировка запроса клиента"></textarea>
      <div class="fc-v2-main-actions">
        <button type="button" class="tk-btn fc-v2-save-main">Сохранить основной запрос</button>
        <button type="button" class="tk-btn fc-v2-copy-main">Копировать</button>
      </div>

      <div class="fc-result-sections">
        <div class="fc-result-section">
          <strong>КОРОТКИЙ ЗАПРОС ДЛЯ ДИАГНОСТИКИ</strong>
          <div class="fc-v2-short-list"></div>
          <label class="fc-v2-selected-edit"><span>Выбранный короткий запрос — можно отредактировать</span><input class="fc-v2-selected-short" placeholder="Короткий запрос-препятствие"></label>
        </div>
        <div class="fc-result-section"><strong>Почему ИИ предлагает этот запрос</strong><div class="fc-v2-rationale">—</div></div>
        <div class="fc-result-section"><strong>Желаемый результат — что находится «за камнем»</strong><div class="fc-v2-desired">—</div></div>
        <div class="fc-result-section">
          <strong>Ситуации для Диагностики</strong>
          <div class="fc-v2-situations"></div>
          <button type="button" class="tk-btn fc-v2-add-situation">+ Добавить ситуацию</button>
          <div class="fc-v2-warning">ИИ не ставит уровень дискомфорта. Для перенесённых ситуаций он останется неуказанным, пока ты не уточнишь его у клиента.</div>
        </div>
        <div class="fc-result-section"><strong>Что стоит уточнить у клиента</strong><div class="fc-v2-questions"></div></div>
      </div>

      <div class="fc-v2-created"></div>
      <div class="fc-result-actions">
        <button type="button" class="tk-btn fc-v2-regenerate">Сформировать заново</button>
        <button type="button" class="tk-btn fc-v2-create fc-v2-create-diagnosis">Создать запрос в Диагностике</button>
        <button type="button" class="tk-btn fc-v2-result-close2">Закрыть</button>
      </div>
    </section>`;

  const q=sel=>dlg.querySelector(sel);
  const rq=sel=>resultDlg.querySelector(sel);
  const pain=q('.fc-pain');
  const manifestations=q('.fc-manifestations');
  const impact=q('.fc-impact');
  const desired=q('.fc-desired');
  const whyNow=q('.fc-why-now');
  const lifeAfter=q('.fc-life-after');
  const status=q('.fc-status');
  const resultMain=rq('.fc-result-main');
  const shortList=rq('.fc-v2-short-list');
  const selectedShortInput=rq('.fc-v2-selected-short');
  const situationsRoot=rq('.fc-v2-situations');
  const createdNote=rq('.fc-v2-created');

  let currentClient=null;
  let lastResult=null;
  let selectedShortIndex=0;

  function makeId(){
    try{if(typeof uid==='function')return uid();}catch(_){}
    return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2);
  }

  function getClient(){
    try{const c=typeof client==='function'?client():null;if(c)return c;}catch(_){}
    try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){return null;}
  }

  function saveState(){try{if(typeof save==='function')save();}catch(_){} }

  function readData(){
    return {
      pain:pain?.value||'',
      manifestations:manifestations?.value||'',
      impact:impact?.value||'',
      desired:desired?.value||'',
      whyNow:whyNow?.value||'',
      lifeAfter:lifeAfter?.value||''
    };
  }

  function loadFields(){
    currentClient=getClient();
    if(!currentClient)return;
    const d=currentClient.freeConsultation||{};
    if(pain)pain.value=d.pain||'';
    if(manifestations)manifestations.value=d.manifestations||'';
    if(impact)impact.value=d.impact||'';
    if(desired)desired.value=d.desired||'';
    if(whyNow)whyNow.value=d.whyNow||'';
    if(lifeAfter)lifeAfter.value=d.lifeAfter||'';
    if(status)status.textContent='';
  }

  function persist(showMessage=false){
    currentClient=getClient()||currentClient;
    if(!currentClient)return;
    currentClient.freeConsultation={...(currentClient.freeConsultation||{}),...readData(),updatedAt:new Date().toISOString()};
    saveState();
    if(showMessage&&status){status.textContent='Сохранено';setTimeout(()=>{if(status.textContent==='Сохранено')status.textContent='';},1400);}
  }

  function normalizeShorts(result){
    const arr=Array.isArray(result?.shortRequests)?result.shortRequests:[];
    return arr.map((x,i)=>({
      title:String(x?.title||'').trim(),
      priority:Number.isFinite(Number(x?.priority))?Math.max(0,Math.min(100,Math.round(Number(x.priority)))):(i===0?100:0)
    })).filter(x=>x.title).slice(0,4);
  }

  function renderShortRequests(){
    shortList.innerHTML='';
    const items=normalizeShorts(lastResult);
    if(!items.length){
      shortList.innerHTML='<div style="font-size:12px;color:#7b8796">ИИ пока не выделил короткий запрос. Используй уточняющие вопросы и сформируй анализ заново.</div>';
      selectedShortInput.value='';
      return;
    }
    if(selectedShortIndex<0||selectedShortIndex>=items.length)selectedShortIndex=0;
    items.forEach((item,index)=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='fc-v2-short-option'+(index===selectedShortIndex?' selected':'');
      b.innerHTML=`<span class="fc-v2-short-radio"></span><span class="fc-v2-short-title"></span><span class="fc-v2-short-percent"></span>`;
      b.querySelector('.fc-v2-short-title').textContent=item.title;
      b.querySelector('.fc-v2-short-percent').textContent=item.priority+'%';
      b.onclick=()=>{selectedShortIndex=index;selectedShortInput.value=item.title;renderShortRequests();selectedShortInput.value=item.title;persistAiEdits();};
      shortList.appendChild(b);
    });
    selectedShortInput.value=items[selectedShortIndex]?.title||'';
  }

  function addSituationRow(text=''){
    const row=document.createElement('div');
    row.className='fc-v2-situation-row';
    const input=document.createElement('input');
    input.value=String(text||'').trim();
    input.placeholder='Когда я ...';
    input.addEventListener('input',persistAiEdits);
    const del=document.createElement('button');
    del.type='button';del.className='tk-btn';del.textContent='×';del.title='Удалить ситуацию';
    del.onclick=()=>{row.remove();persistAiEdits();};
    row.append(input,del);situationsRoot.appendChild(row);
  }

  function getSituationTexts(){
    return [...situationsRoot.querySelectorAll('input')].map(x=>x.value.trim()).filter(Boolean);
  }

  function renderSituations(items){
    situationsRoot.innerHTML='';
    const list=Array.isArray(items)?items:[];
    if(!list.length)addSituationRow('');
    else list.forEach(addSituationRow);
  }

  function renderQuestions(items){
    const root=rq('.fc-v2-questions');root.innerHTML='';
    const list=Array.isArray(items)?items.filter(Boolean):[];
    if(!list.length){root.innerHTML='<div class="fc-v2-question">Информации достаточно.</div>';return;}
    list.forEach(text=>{const d=document.createElement('div');d.className='fc-v2-question';d.textContent=text;root.appendChild(d);});
  }

  function renderResult(result){
    lastResult=result||{};
    selectedShortIndex=0;
    resultMain.value=lastResult.mainRequest||'';
    rq('.fc-v2-rationale').textContent=lastResult.rationale||'—';
    rq('.fc-v2-desired').textContent=lastResult.desiredResult||desired?.value.trim()||'—';
    renderShortRequests();
    renderSituations(lastResult.situations||[]);
    renderQuestions(lastResult.clarifyingQuestions||[]);
    createdNote.classList.remove('show');createdNote.textContent='';
    if(!resultDlg.open)resultDlg.showModal();
  }

  function persistAiEdits(){
    currentClient=getClient()||currentClient;
    if(!currentClient||!lastResult)return;
    const shorts=normalizeShorts(lastResult);
    const selectedTitle=selectedShortInput.value.trim();
    const selectedPriority=shorts[selectedShortIndex]?.priority||0;
    const aiResult={
      ...lastResult,
      mainRequest:resultMain.value.trim(),
      selectedShortRequest:selectedTitle?{title:selectedTitle,priority:selectedPriority}:null,
      situations:getSituationTexts()
    };
    lastResult=aiResult;
    currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult};
    saveState();
  }

  async function generate(){
    currentClient=getClient();
    if(!currentClient)return alert('Сначала выбери клиента.');
    persist(false);
    const generator=window.DiagnostikaRequestAI?.generate;
    if(typeof generator!=='function')return alert('ИИ-модуль не подключён.');
    aiBtn.disabled=true;if(status)status.textContent='Анализирую консультацию…';
    try{
      const result=await generator({clientId:currentClient.id||'',clientName:currentClient.name||'',...readData()});
      currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult:result};
      saveState();
      renderResult(result);
    }catch(err){
      resultMain.value='';
      rq('.fc-result-note').textContent='Не удалось получить ответ ИИ: '+(err?.message||'ошибка запроса');
      shortList.innerHTML='';rq('.fc-v2-rationale').textContent='—';rq('.fc-v2-desired').textContent='—';renderSituations([]);renderQuestions([]);
      if(!resultDlg.open)resultDlg.showModal();
    }finally{aiBtn.disabled=false;if(status)status.textContent='';}
  }

  function saveMainRequest(){
    currentClient=getClient()||currentClient;
    const text=resultMain.value.trim();
    if(!currentClient||!text)return;
    currentClient.mainRequest=text;
    currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult:{...(currentClient.freeConsultation?.aiResult||{}),...(lastResult||{}),mainRequest:text}};
    saveState();
    try{const el=document.getElementById('ccMainRequest');if(el)el.value=text;}catch(_){}
    rq('.fc-v2-save-main').textContent='Сохранено';setTimeout(()=>rq('.fc-v2-save-main').textContent='Сохранить основной запрос',1200);
  }

  function makeSituation(name){
    return {id:makeId(),name:String(name||'').trim(),level:5,levelPending:true,comment:'',result:'',beliefs:[]};
  }

  function createDiagnosis(){
    currentClient=getClient()||currentClient;
    if(!currentClient)return alert('Клиент не выбран.');
    const api=window.DiagnostikaRequests?.moduleAware===true
      ? window.DiagnostikaRequests
      : window.DiagnostikaPlatform?.services?.requests||null;
    if(!api?.create)return alert('Модуль запросов ещё не готов.');

    persistAiEdits();
    const title=selectedShortInput.value.trim();
    if(!title)return alert('Сначала выбери или введи короткий запрос для Диагностики.');

    const situations=getSituationTexts();
    const created=api.create({
      id:makeId(),
      title,
      situations:situations.map(makeSituation),
      source:'freeConsultationAI'
    },{
      client:currentClient,
      source:'free-consultation-v2-create'
    });
    if(!created)return alert('Не удалось создать запрос в Диагностике.');

    if(currentClient.freeConsultation?.aiResult){
      currentClient.freeConsultation.aiResult.diagnosisRequestId=created.id;
      currentClient.freeConsultation.aiResult.selectedShortRequest={title,priority:normalizeShorts(lastResult)[selectedShortIndex]?.priority||0};
      currentClient.freeConsultation.aiResult.situations=situations;
    }
    saveState();

    createdNote.textContent=`Создан запрос «${title}»${situations.length?` и добавлено ситуаций: ${situations.length}`:''}.`;
    createdNote.classList.add('show');
    const btn=rq('.fc-v2-create-diagnosis');
    btn.disabled=true;
    btn.textContent='Создано в Диагностике';
    setTimeout(()=>window.DiagnostikaDiagnosis?.open?.(),80);
  }

  function patchPendingSituationLevels(){
    if(typeof window.renderSituationList==='function'&&!window.renderSituationList.__fcPendingPatched){
      const old=window.renderSituationList;
      const wrapped=function(){
        const out=old.apply(this,arguments);
        try{
          const r=typeof request==='function'?request():null;
          const rows=[...document.querySelectorAll('#situationList .situation-item')];
          (r?.situations||[]).forEach((s,i)=>{if(s?.levelPending&&rows[i])rows[i].textContent=(s.name||'Без названия')+'   [—/10]';});
        }catch(_){}
        return out;
      };
      wrapped.__fcPendingPatched=true;window.renderSituationList=wrapped;
    }
    if(typeof window.renderTree==='function'&&!window.renderTree.__fcPendingPatched){
      const old=window.renderTree;
      const wrapped=function(){
        const out=old.apply(this,arguments);
        try{const s=typeof situation==='function'?situation():null;if(s?.levelPending){const el=document.getElementById('situationInfo');if(el)el.textContent='Дискомфорт: —/10';}}catch(_){}
        return out;
      };
      wrapped.__fcPendingPatched=true;window.renderTree=wrapped;
    }
    const edit=document.getElementById('editSituationBtn');
    if(edit&&!edit.dataset.fcPendingPatched){
      edit.dataset.fcPendingPatched='1';
      edit.onclick=()=>{
        let s=null;try{s=typeof situation==='function'?situation():null;}catch(_){}
        if(!s)return;
        const n=prompt('Название ситуации',s.name||'');if(n!==null)s.name=n;
        const current=s.levelPending?'':s.level;
        const l=prompt('Дискомфорт 1–10',current);
        if(l!==null&&String(l).trim()!==''){
          const num=Math.max(1,Math.min(10,Number(l)||1));s.level=num;s.levelPending=false;
        }
        saveState();
        try{if(typeof renderSituationList==='function')renderSituationList();}catch(_){}
      };
    }
  }

  aiBtn.onclick=generate;
  q('.fc-save').onclick=()=>persist(true);
  dlg.addEventListener('close',()=>persist(false));
  new MutationObserver(()=>{if(dlg.open)loadFields();}).observe(dlg,{attributes:true,attributeFilter:['open']});
  [whyNow,lifeAfter].forEach(el=>el?.addEventListener('input',()=>{if(status)status.textContent='Есть несохранённые изменения';}));

  rq('.fc-v2-result-close').onclick=()=>resultDlg.close();
  rq('.fc-v2-result-close2').onclick=()=>resultDlg.close();
  rq('.fc-v2-save-main').onclick=saveMainRequest;
  rq('.fc-v2-copy-main').onclick=async()=>{const text=resultMain.value.trim();if(!text)return;try{await navigator.clipboard.writeText(text);rq('.fc-v2-copy-main').textContent='Скопировано';setTimeout(()=>rq('.fc-v2-copy-main').textContent='Копировать',1100);}catch(_){}};
  rq('.fc-v2-regenerate').onclick=()=>{resultDlg.close();generate();};
  rq('.fc-v2-create-diagnosis').onclick=createDiagnosis;
  rq('.fc-v2-add-situation').onclick=()=>addSituationRow('');
  resultMain.addEventListener('input',persistAiEdits);
  selectedShortInput.addEventListener('input',persistAiEdits);

  patchPendingSituationLevels();
  loadFields();

  window.DiagnostikaFreeConsultationV2={generate,createDiagnosis,persist,renderResult};
})();
