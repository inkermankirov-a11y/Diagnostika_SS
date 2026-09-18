'use strict';

(() => {
  if (window.DiagnostikaFreeConsultation) return;

  const style=document.createElement('style');
  style.textContent=`
    .fc-dialog,.fc-result-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .fc-dialog::backdrop,.fc-result-dialog::backdrop{background:rgba(15,23,42,.55);backdrop-filter:blur(6px)}
    .fc-window{width:min(1040px,calc(100vw - 28px));max-height:92vh;overflow:auto;background:#f8fafc;border:1px solid #d6e0eb;border-radius:16px;box-shadow:0 28px 80px rgba(15,23,42,.34);padding:18px;box-sizing:border-box;color:#243447}
    .fc-head,.fc-result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
    .fc-title,.fc-result-head strong{font-size:22px;font-weight:900;color:#1f344d}.fc-client{margin-top:3px;font-size:12px;color:#71839c}
    .fc-close,.fc-result-close{width:38px;height:38px!important;padding:0!important;font-size:19px!important}
    .fc-intro{padding:10px 12px;border:1px solid #d8e5f4;border-radius:10px;background:#eef6ff;color:#46617f;font-size:12px;line-height:1.45;margin-bottom:14px}
    .fc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fc-field{display:grid;gap:6px}.fc-field span{font-size:12px;font-weight:900;color:#3f526a}
    .fc-field textarea{width:100%;min-height:116px;resize:vertical;box-sizing:border-box;border:1px solid #c8d4e2;border-radius:10px;background:#fff;padding:10px 11px;font:500 13px/1.5 'Segoe UI',Arial,sans-serif;color:#243447;outline:none}
    .fc-field textarea:focus,.fc-result-main:focus,.fc-situation-name:focus{border-color:#6aa4ee;box-shadow:0 0 0 3px rgba(47,128,237,.1)}
    .fc-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #dbe4ee}.fc-actions-left,.fc-actions-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .fc-ai{height:40px!important;padding:0 16px!important;background:linear-gradient(#3f8af5,#236ddd)!important;color:#fff!important;border-color:#236ddd!important;font-weight:900!important}.fc-save,.fc-create-diagnosis{height:40px!important;padding:0 16px!important;background:linear-gradient(#48a873,#278656)!important;color:#fff!important;font-weight:900!important}.fc-status{font-size:11px;color:#71839c}
    .fc-result-window{width:min(900px,calc(100vw - 28px));max-height:92vh;overflow:auto;background:#fff;border:1px solid #d7e0ea;border-radius:15px;box-shadow:0 24px 70px rgba(15,23,42,.3);padding:18px;box-sizing:border-box}
    .fc-result-note{padding:10px 12px;border:1px solid #f0d7a7;border-radius:9px;background:#fff8e8;color:#815a14;font-size:12px;line-height:1.4;margin-bottom:12px}.fc-result-label{font-size:12px;font-weight:900;color:#3f526a;margin:12px 0 6px}
    .fc-result-main{width:100%;min-height:105px;resize:vertical;box-sizing:border-box;border:1px solid #c7d4e2;border-radius:9px;padding:10px;font:600 14px/1.5 'Segoe UI',Arial,sans-serif;color:#20344c}
    .fc-short-list{display:grid;gap:8px}.fc-short-option{display:grid;grid-template-columns:auto 72px 1fr;align-items:center;gap:9px;border:1px solid #dbe4ee;border-radius:10px;padding:9px 10px;background:#f8fafc;cursor:pointer}.fc-short-option.selected{border-color:#5b8def;background:#eef5ff;box-shadow:0 0 0 2px rgba(47,128,237,.08)}.fc-short-option input[type=radio]{width:17px;height:17px}.fc-priority{font-weight:900;color:#315f9e;font-size:13px}.fc-short-title{width:100%;box-sizing:border-box;border:0;background:transparent;font:700 13px/1.35 'Segoe UI',Arial,sans-serif;color:#23384f;outline:none}
    .fc-result-sections{display:grid;gap:10px;margin-top:12px}.fc-result-section{border:1px solid #e1e8f0;border-radius:9px;background:#f8fafc;padding:10px}.fc-result-section strong{display:block;font-size:11px;color:#60758f;margin-bottom:5px}.fc-result-section div{font-size:12px;line-height:1.5;color:#31465f;white-space:pre-wrap}
    .fc-situations{display:grid;gap:8px}.fc-situation-row{display:grid;grid-template-columns:auto 1fr 135px;gap:8px;align-items:center}.fc-situation-name{width:100%;box-sizing:border-box;border:1px solid #cbd7e5;border-radius:8px;padding:8px 9px;background:#fff;color:#26384b;font:600 12px 'Segoe UI',Arial,sans-serif;outline:none}.fc-situation-level{width:100%;box-sizing:border-box;border:1px solid #cbd7e5;border-radius:8px;padding:8px;background:#fff}.fc-situation-row small{display:block;color:#71839c}.fc-result-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #e3eaf2}
    @media(max-width:720px){.fc-grid{grid-template-columns:1fr}.fc-field textarea{min-height:100px}.fc-actions{align-items:stretch}.fc-actions-left,.fc-actions-right{width:100%}.fc-ai,.fc-save{flex:1}.fc-short-option{grid-template-columns:auto 58px 1fr}.fc-situation-row{grid-template-columns:auto 1fr}.fc-situation-level{grid-column:2}}
  `;
  document.head.appendChild(style);

  const dlg=document.createElement('dialog');
  dlg.id='freeConsultationDialog';
  dlg.className='fc-dialog';
  dlg.innerHTML=`
    <section class="fc-window">
      <div class="fc-head">
        <div><div class="fc-title">Бесплатная консультация</div><div class="fc-client"></div></div>
        <button type="button" class="tk-btn fc-close">×</button>
      </div>
      <div class="fc-intro">Записывай слова клиента по ходу разговора. ИИ разделит развёрнутый основной запрос, короткое препятствие для Диагностики и конкретные ситуации, которые клиент уже назвал.</div>
      <div class="fc-grid">
        <label class="fc-field"><span>Боль клиента</span><textarea class="fc-pain" placeholder="Что болит, беспокоит, повторяется — словами клиента..."></textarea></label>
        <label class="fc-field"><span>Где проявляется</span><textarea class="fc-manifestations" placeholder="Конкретные моменты, отношения, работа, деньги, семья, тело..."></textarea></label>
        <label class="fc-field"><span>Как мешает жить</span><textarea class="fc-impact" placeholder="Что из-за этого делает или не делает, что теряет, чего избегает..."></textarea></label>
        <label class="fc-field"><span>Чего хочет вместо этого</span><textarea class="fc-desired" placeholder="Как хочет чувствовать себя, действовать и жить вместо текущего сценария..."></textarea></label>
        <label class="fc-field"><span>Почему обратился именно сейчас</span><textarea class="fc-why-now" placeholder="Что произошло или изменилось, почему решил заняться этим именно сейчас..."></textarea></label>
        <label class="fc-field"><span>Как изменится жизнь после решения проблемы</span><textarea class="fc-life-after" placeholder="Что станет по-другому в жизни, отношениях, работе, деньгах, состоянии, поведении..."></textarea></label>
      </div>
      <div class="fc-actions">
        <div class="fc-actions-left"><button type="button" class="tk-btn fc-ai">✨ Проанализировать консультацию</button><span class="fc-status"></span></div>
        <div class="fc-actions-right"><button type="button" class="tk-btn fc-cancel">Закрыть</button><button type="button" class="tk-btn fc-save">Сохранить консультацию</button></div>
      </div>
    </section>`;
  document.body.appendChild(dlg);

  const resultDlg=document.createElement('dialog');
  resultDlg.id='freeConsultationAiResultDialog';
  resultDlg.className='fc-result-dialog';
  resultDlg.innerHTML=`
    <section class="fc-result-window">
      <div class="fc-result-head"><strong>ИИ — анализ бесплатной консультации</strong><button type="button" class="tk-btn fc-result-close">×</button></div>
      <div class="fc-result-note">Проверь формулировки перед сохранением и созданием Диагностики.</div>
      <div class="fc-result-label">Развёрнутый основной запрос клиента</div>
      <textarea class="fc-result-main" placeholder="Здесь появится развёрнутый основной запрос"></textarea>

      <div class="fc-result-label">Короткий запрос для Диагностики — препятствие</div>
      <div class="fc-short-list"></div>

      <div class="fc-result-sections">
        <div class="fc-result-section"><strong>Обоснование</strong><div class="fc-result-rationale">—</div></div>
        <div class="fc-result-section"><strong>Желаемый результат — что находится за препятствием</strong><div class="fc-result-desired">—</div></div>
        <div class="fc-result-section"><strong>Что стоит уточнить</strong><div class="fc-result-questions">—</div></div>
        <div class="fc-result-section"><strong>Ситуации для Диагностики</strong><div class="fc-situations"></div></div>
      </div>

      <div class="fc-result-actions">
        <button type="button" class="tk-btn fc-result-copy">Копировать основной запрос</button>
        <button type="button" class="tk-btn fc-result-save-main">Сохранить основной запрос</button>
        <button type="button" class="tk-btn fc-create-diagnosis">Создать запрос в Диагностике</button>
        <button type="button" class="tk-btn fc-result-close2">Закрыть</button>
      </div>
    </section>`;
  document.body.appendChild(resultDlg);

  const q=sel=>dlg.querySelector(sel);
  const rq=sel=>resultDlg.querySelector(sel);
  const fields={
    pain:q('.fc-pain'),
    manifestations:q('.fc-manifestations'),
    impact:q('.fc-impact'),
    desired:q('.fc-desired'),
    whyNow:q('.fc-why-now'),
    lifeAfter:q('.fc-life-after')
  };
  const status=q('.fc-status');
  const resultMain=rq('.fc-result-main');
  const resultNote=rq('.fc-result-note');
  let currentClient=null;
  let currentAiResult=null;
  let selectedShortIndex=0;

  function getClient(){
    try{const c=typeof client==='function'?client():null;if(c)return c;}catch(_){}
    try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){return null;}
  }
  function readData(){return Object.fromEntries(Object.entries(fields).map(([k,el])=>[k,el.value]));}
  function writeData(data){data=data||{};Object.entries(fields).forEach(([k,el])=>{el.value=data[k]||'';});}
  function persist(showMessage=true){
    if(!currentClient)return;
    currentClient.freeConsultation={...(currentClient.freeConsultation||{}),...readData(),updatedAt:new Date().toISOString()};
    try{if(typeof save==='function')save();}catch(_){}
    if(showMessage){status.textContent='Сохранено';setTimeout(()=>{if(status.textContent==='Сохранено')status.textContent='';},1600);}
  }
  function open(){
    currentClient=getClient();
    if(!currentClient)return alert('Сначала выбери клиента.');
    q('.fc-client').textContent=currentClient.name||'Без имени';
    writeData(currentClient.freeConsultation||{});
    status.textContent='';
    if(!dlg.open)dlg.showModal();
  }
  function close(){persist(false);if(dlg.open)dlg.close();}

  function normalizeShorts(list){
    const arr=Array.isArray(list)?list:[];
    return arr.map((x,i)=>({title:String(x?.title||x||'').trim(),priority:Math.max(0,Math.min(100,Math.round(Number(x?.priority) || (i===0?100:0))))})).filter(x=>x.title).slice(0,4).sort((a,b)=>b.priority-a.priority);
  }

  function renderShortRequests(list){
    const root=rq('.fc-short-list');root.innerHTML='';
    const shorts=normalizeShorts(list);
    selectedShortIndex=Math.min(selectedShortIndex,Math.max(0,shorts.length-1));
    if(!shorts.length){root.innerHTML='<div style="font-size:12px;color:#8a5b10;padding:8px 0">Короткий запрос пока не определён. Используй уточняющие вопросы ниже.</div>';return;}
    shorts.forEach((item,i)=>{
      const label=document.createElement('label');label.className='fc-short-option'+(i===selectedShortIndex?' selected':'');
      label.innerHTML=`<input type="radio" name="fcShortRequest" ${i===selectedShortIndex?'checked':''}><span class="fc-priority">${item.priority}%</span><input class="fc-short-title" value="">`;
      const titleInput=label.querySelector('.fc-short-title');titleInput.value=item.title;
      const choose=()=>{selectedShortIndex=i;root.querySelectorAll('.fc-short-option').forEach((x,j)=>x.classList.toggle('selected',j===i));label.querySelector('input[type=radio]').checked=true;};
      label.addEventListener('click',e=>{if(e.target!==titleInput)choose();});
      label.querySelector('input[type=radio]').onchange=choose;
      root.appendChild(label);
    });
  }

  function renderQuestions(list){
    const arr=Array.isArray(list)?list.map(x=>String(x||'').trim()).filter(Boolean):[];
    rq('.fc-result-questions').textContent=arr.length?arr.map((x,i)=>`${i+1}. ${x}`).join('\n'):'Информации достаточно.';
  }

  function renderSituations(list){
    const root=rq('.fc-situations');root.innerHTML='';
    const arr=Array.isArray(list)?list.map(x=>String(x||'').trim()).filter(Boolean):[];
    if(!arr.length){root.innerHTML='<div style="font-size:12px;color:#71839c">Конкретные ситуации пока не выделены.</div>';return;}
    arr.forEach(name=>{
      const row=document.createElement('label');row.className='fc-situation-row';
      row.innerHTML=`<input type="checkbox" class="fc-situation-use" checked><input class="fc-situation-name" value=""><input class="fc-situation-level" type="number" min="1" max="10" placeholder="Дискомфорт 1–10 — не указан">`;
      row.querySelector('.fc-situation-name').value=name;
      root.appendChild(row);
    });
  }

  function showResult(result,payload){
    currentAiResult=result||{};
    resultNote.textContent='ИИ предлагает варианты. Развёрнутый запрос остаётся в консультации; выбранный короткий запрос пойдёт отдельным новым запросом в Диагностику.';
    resultMain.value=currentAiResult.mainRequest||'';
    selectedShortIndex=0;
    renderShortRequests(currentAiResult.shortRequests||[]);
    rq('.fc-result-rationale').textContent=currentAiResult.rationale||'—';
    rq('.fc-result-desired').textContent=currentAiResult.desiredResult||payload?.desired||'—';
    renderQuestions(currentAiResult.clarifyingQuestions||[]);
    renderSituations(currentAiResult.situations||[]);
    if(!resultDlg.open)resultDlg.showModal();
  }

  async function generate(){
    persist(false);
    const payload={clientId:currentClient?.id||'',clientName:currentClient?.name||'',...readData()};
    const generator=window.DiagnostikaRequestAI?.generate;
    if(typeof generator!=='function')return alert('ИИ-модуль не подключён.');
    q('.fc-ai').disabled=true;status.textContent='Анализирую консультацию…';
    try{
      const result=await generator(payload);
      currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult:result};
      try{if(typeof save==='function')save();}catch(_){}
      showResult(result,payload);
    }catch(err){
      resultNote.textContent='Не удалось получить ответ ИИ: '+(err?.message||'ошибка запроса');
      resultMain.value='';renderShortRequests([]);rq('.fc-result-rationale').textContent='—';rq('.fc-result-desired').textContent='—';renderQuestions([]);renderSituations([]);
      if(!resultDlg.open)resultDlg.showModal();
    }finally{q('.fc-ai').disabled=false;status.textContent='';}
  }

  function saveMainRequest(showMessage=true){
    const text=resultMain.value.trim();
    if(!text||!currentClient)return false;
    currentClient.mainRequest=text;
    currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult:{...(currentClient.freeConsultation?.aiResult||{}),mainRequest:text}};
    try{if(typeof save==='function')save();}catch(_){}
    try{const el=document.getElementById('ccMainRequest');if(el)el.value=text;}catch(_){}
    if(showMessage){resultNote.textContent='Развёрнутый основной запрос сохранён в бесплатной консультации. Диагностический запрос не изменён.';}
    return true;
  }

  function selectedShortTitle(){
    const rows=[...rq('.fc-short-list').querySelectorAll('.fc-short-option')];
    const row=rows[selectedShortIndex]||rows.find(x=>x.querySelector('input[type=radio]')?.checked);
    return row?.querySelector('.fc-short-title')?.value?.trim()||'';
  }

  function collectSituations(){
    return [...rq('.fc-situations').querySelectorAll('.fc-situation-row')].map(row=>{
      const use=row.querySelector('.fc-situation-use')?.checked;
      const name=row.querySelector('.fc-situation-name')?.value?.trim()||'';
      const raw=row.querySelector('.fc-situation-level')?.value?.trim()||'';
      const n=raw===''?null:Number(raw);
      return {use,name,level:Number.isFinite(n)&&n>=1&&n<=10?n:null};
    }).filter(x=>x.use&&x.name);
  }

  function createDiagnosis(){
    currentClient=typeof client==='function'?client():currentClient;
    if(!currentClient)return;
    const api=window.DiagnostikaRequests?.moduleAware===true
      ? window.DiagnostikaRequests
      : window.DiagnostikaPlatform?.services?.requests||null;
    if(!api?.create)return alert('Модуль запросов ещё не готов.');

    const title=selectedShortTitle();
    if(!title)return alert('ИИ пока не выделил короткий запрос. Сначала уточни данные консультации и запусти анализ ещё раз.');
    saveMainRequest(false);

    const situations=[];
    for(const item of collectSituations()){
      const s=typeof newSituation==='function'?newSituation():{id:typeof uid==='function'?uid():String(Date.now()+Math.random()),name:'',comment:'',result:'',beliefs:[]};
      s.name=item.name;
      s.level=item.level;
      s.levelUnknown=item.level===null;
      if(item.level===null)s.comment='Уровень дискомфорта не указан на бесплатной консультации — уточнить у клиента.';
      situations.push(s);
    }

    const created=api.create({
      title,
      source:'free-consultation-ai',
      situations
    },{
      client:currentClient,
      source:'free-consultation-create'
    });
    if(!created)return alert('Не удалось создать запрос в Диагностике.');

    currentClient.freeConsultation={
      ...(currentClient.freeConsultation||{}),
      aiResult:{
        ...(currentClient.freeConsultation?.aiResult||{}),
        mainRequest:resultMain.value.trim(),
        selectedShortRequest:title,
        diagnosisRequestId:created.id
      }
    };
    try{if(typeof save==='function')save();}catch(_){}

    resultNote.textContent=`Создан новый запрос в Диагностике: «${title}»${situations.length?`. Ситуаций добавлено: ${situations.length}.`:'.'}`;
    if(resultDlg.open)resultDlg.close();
    if(dlg.open)dlg.close();
    setTimeout(()=>window.DiagnostikaDiagnosis?.open?.(),0);
  }

  q('.fc-close').onclick=close;q('.fc-cancel').onclick=close;q('.fc-save').onclick=()=>persist(true);q('.fc-ai').onclick=generate;
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
  Object.values(fields).forEach(el=>el.addEventListener('input',()=>{status.textContent='Есть несохранённые изменения';}));
  rq('.fc-result-close').onclick=()=>resultDlg.close();rq('.fc-result-close2').onclick=()=>resultDlg.close();
  rq('.fc-result-save-main').onclick=()=>saveMainRequest(true);
  rq('.fc-create-diagnosis').onclick=createDiagnosis;
  rq('.fc-result-copy').onclick=async()=>{const text=resultMain.value.trim();if(!text)return;try{await navigator.clipboard.writeText(text);rq('.fc-result-copy').textContent='Скопировано';setTimeout(()=>rq('.fc-result-copy').textContent='Копировать основной запрос',1200);}catch(_){}};

  function attach(){const btn=document.getElementById('ccFreeConsultBtn');if(!btn||btn.dataset.freeConsultReady==='1')return;btn.dataset.freeConsultReady='1';btn.onclick=open;}
  attach();const mo=new MutationObserver(attach);mo.observe(document.body,{childList:true,subtree:true});

  window.DiagnostikaFreeConsultation={open,save:()=>persist(true)};
})();
