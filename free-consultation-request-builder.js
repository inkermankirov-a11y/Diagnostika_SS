'use strict';

(() => {
  if (window.DiagnostikaFreeConsultation) return;

  const style=document.createElement('style');
  style.textContent=`
    .fc-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .fc-dialog::backdrop{background:rgba(15,23,42,.55);backdrop-filter:blur(6px)}
    .fc-window{width:min(980px,calc(100vw - 28px));max-height:90vh;overflow:auto;background:#f8fafc;border:1px solid #d6e0eb;border-radius:16px;box-shadow:0 28px 80px rgba(15,23,42,.34);padding:18px;box-sizing:border-box;color:#243447}
    .fc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px}
    .fc-title{font-size:22px;font-weight:900;color:#1f344d}.fc-client{margin-top:3px;font-size:12px;color:#71839c}
    .fc-close{width:38px;height:38px!important;padding:0!important;font-size:19px!important}
    .fc-intro{padding:10px 12px;border:1px solid #d8e5f4;border-radius:10px;background:#eef6ff;color:#46617f;font-size:12px;line-height:1.45;margin-bottom:14px}
    .fc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .fc-field{display:grid;gap:6px}.fc-field span{font-size:12px;font-weight:900;color:#3f526a}
    .fc-field textarea{width:100%;min-height:128px;resize:vertical;box-sizing:border-box;border:1px solid #c8d4e2;border-radius:10px;background:#fff;padding:10px 11px;font:500 13px/1.5 'Segoe UI',Arial,sans-serif;color:#243447;outline:none}
    .fc-field textarea:focus{border-color:#6aa4ee;box-shadow:0 0 0 3px rgba(47,128,237,.1)}
    .fc-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #dbe4ee}
    .fc-actions-left,.fc-actions-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .fc-ai{height:40px!important;padding:0 16px!important;background:linear-gradient(#3f8af5,#236ddd)!important;color:#fff!important;border-color:#236ddd!important;font-weight:900!important}
    .fc-save{height:40px!important;padding:0 16px!important;background:linear-gradient(#48a873,#278656)!important;color:#fff!important;font-weight:900!important}
    .fc-status{font-size:11px;color:#71839c}
    .fc-result-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .fc-result-dialog::backdrop{background:rgba(15,23,42,.55);backdrop-filter:blur(5px)}
    .fc-result-window{width:min(760px,calc(100vw - 28px));max-height:88vh;overflow:auto;background:#fff;border:1px solid #d7e0ea;border-radius:15px;box-shadow:0 24px 70px rgba(15,23,42,.3);padding:18px;box-sizing:border-box}
    .fc-result-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.fc-result-head strong{font-size:19px;color:#26384b}
    .fc-result-note{padding:10px 12px;border:1px solid #f0d7a7;border-radius:9px;background:#fff8e8;color:#815a14;font-size:12px;line-height:1.4;margin-bottom:12px}
    .fc-result-label{font-size:12px;font-weight:900;color:#3f526a;margin-bottom:6px}.fc-result-main{width:100%;min-height:110px;resize:vertical;box-sizing:border-box;border:1px solid #c7d4e2;border-radius:9px;padding:10px;font:600 14px/1.5 'Segoe UI',Arial,sans-serif;color:#20344c}
    .fc-result-sections{display:grid;gap:10px;margin-top:12px}.fc-result-section{border:1px solid #e1e8f0;border-radius:9px;background:#f8fafc;padding:10px}.fc-result-section strong{display:block;font-size:11px;color:#60758f;margin-bottom:5px}.fc-result-section div{font-size:12px;line-height:1.45;color:#31465f;white-space:pre-wrap}
    .fc-result-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}
    @media(max-width:720px){.fc-grid{grid-template-columns:1fr}.fc-field textarea{min-height:105px}.fc-actions{align-items:stretch}.fc-actions-left,.fc-actions-right{width:100%}.fc-ai,.fc-save{flex:1}}
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
      <div class="fc-intro">Записывай слова клиента по ходу разговора. Эти четыре блока нужны именно для того, чтобы затем собрать из материала один ясный основной запрос.</div>
      <div class="fc-grid">
        <label class="fc-field"><span>Боль клиента</span><textarea class="fc-pain" placeholder="Что клиент говорит своими словами: что болит, беспокоит, повторяется..."></textarea></label>
        <label class="fc-field"><span>Где проявляется</span><textarea class="fc-manifestations" placeholder="Отношения, работа, деньги, семья, тело, конкретные ситуации..."></textarea></label>
        <label class="fc-field"><span>Как мешает жить</span><textarea class="fc-impact" placeholder="Что человек из-за этого делает или не делает, что теряет, чего избегает..."></textarea></label>
        <label class="fc-field"><span>Чего хочет вместо этого</span><textarea class="fc-desired" placeholder="Как человек хочет чувствовать себя, действовать и жить вместо текущего сценария..."></textarea></label>
      </div>
      <div class="fc-actions">
        <div class="fc-actions-left">
          <button type="button" class="tk-btn fc-ai">✨ Сформировать основной запрос</button>
          <span class="fc-status"></span>
        </div>
        <div class="fc-actions-right">
          <button type="button" class="tk-btn fc-cancel">Закрыть</button>
          <button type="button" class="tk-btn fc-save">Сохранить консультацию</button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(dlg);

  const resultDlg=document.createElement('dialog');
  resultDlg.id='freeConsultationAiResultDialog';
  resultDlg.className='fc-result-dialog';
  resultDlg.innerHTML=`
    <section class="fc-result-window">
      <div class="fc-result-head"><strong>ИИ — формирование основного запроса</strong><button type="button" class="tk-btn fc-result-close">×</button></div>
      <div class="fc-result-note"></div>
      <div class="fc-result-label">Предлагаемый основной запрос</div>
      <textarea class="fc-result-main" placeholder="Здесь появится формулировка основного запроса"></textarea>
      <div class="fc-result-sections">
        <div class="fc-result-section"><strong>Что видно в описании клиента</strong><div class="fc-result-analysis">—</div></div>
        <div class="fc-result-section"><strong>Желаемый результат</strong><div class="fc-result-desired">—</div></div>
        <div class="fc-result-section"><strong>Что стоит уточнить</strong><div class="fc-result-question">—</div></div>
      </div>
      <div class="fc-result-actions">
        <button type="button" class="tk-btn fc-result-copy">Копировать</button>
        <button type="button" class="tk-btn fc-result-use">Использовать основной запрос</button>
        <button type="button" class="tk-btn fc-result-close2">Закрыть</button>
      </div>
    </section>`;
  document.body.appendChild(resultDlg);

  const q=sel=>dlg.querySelector(sel);
  const rq=sel=>resultDlg.querySelector(sel);
  const pain=q('.fc-pain'),manifestations=q('.fc-manifestations'),impact=q('.fc-impact'),desired=q('.fc-desired'),status=q('.fc-status');
  const resultMain=rq('.fc-result-main'),resultNote=rq('.fc-result-note');
  let currentClient=null;

  function getClient(){
    try{const c=typeof client==='function'?client():null;if(c)return c;}catch(_){}
    try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){return null;}
  }
  function currentRequest(c){
    if(!c)return null;
    try{const r=window.DiagnostikaRequests?.current?.(c);if(r)return r;}catch(_){}
    try{if(typeof requestId!=='undefined'&&requestId){const r=(c.requests||[]).find(x=>String(x.id)===String(requestId));if(r)return r;}}catch(_){}
    return (c.requests||[]).find(r=>String(r.id)===String(c.currentRequestId||''))||(c.requests||[])[0]||null;
  }
  function readData(){return {pain:pain.value,manifestations:manifestations.value,impact:impact.value,desired:desired.value};}
  function writeData(data){data=data||{};pain.value=data.pain||'';manifestations.value=data.manifestations||'';impact.value=data.impact||'';desired.value=data.desired||'';}
  function persist(showMessage=true){
    if(!currentClient)return;
    const previous=currentClient.freeConsultation||{};
    currentClient.freeConsultation={...previous,...readData(),updatedAt:new Date().toISOString()};
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

  async function generate(){
    persist(false);
    const payload={clientId:currentClient?.id||'',clientName:currentClient?.name||'',...readData()};
    const generator=window.DiagnostikaRequestAI?.generate;
    if(typeof generator!=='function'){
      resultNote.textContent='Форма бесплатной консультации готова. Сам ИИ-модуль ещё не подключён к серверу, поэтому программа сейчас не будет придумывать ответ вместо модели.';
      resultMain.value=currentClient?.freeConsultation?.aiResult?.mainRequest||'';
      rq('.fc-result-analysis').textContent='ИИ не подключён';
      rq('.fc-result-desired').textContent=desired.value.trim()||'—';
      rq('.fc-result-question').textContent='После подключения ИИ здесь будут появляться уточняющие вопросы.';
      if(!resultDlg.open)resultDlg.showModal();
      return;
    }
    q('.fc-ai').disabled=true;status.textContent='Формирую запрос…';
    try{
      const out=await generator(payload);
      const result=typeof out==='string'?{mainRequest:out}:out||{};
      resultNote.textContent='Проверь формулировку перед использованием.';
      resultMain.value=result.mainRequest||'';
      rq('.fc-result-analysis').textContent=result.analysis||'—';
      rq('.fc-result-desired').textContent=result.desiredResult||payload.desired||'—';
      rq('.fc-result-question').textContent=result.clarifyingQuestion||'Информации достаточно.';
      currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult:result};
      try{if(typeof save==='function')save();}catch(_){}
      if(!resultDlg.open)resultDlg.showModal();
    }catch(err){
      resultNote.textContent='Не удалось получить ответ ИИ: '+(err?.message||'ошибка запроса');
      resultMain.value='';
      if(!resultDlg.open)resultDlg.showModal();
    }finally{q('.fc-ai').disabled=false;status.textContent='';}
  }

  function useResult(){
    const text=resultMain.value.trim();
    if(!text)return;
    if(!currentClient)return;
    currentClient.mainRequest=text;
    const r=currentRequest(currentClient);
    if(r)r.title=text;
    currentClient.freeConsultation={...(currentClient.freeConsultation||{}),aiResult:{...(currentClient.freeConsultation?.aiResult||{}),mainRequest:text}};
    try{if(typeof save==='function')save();}catch(_){}
    try{document.getElementById('ccMainRequest').value=text;}catch(_){}
    try{if(typeof renderClient==='function')renderClient();}catch(_){}
    if(resultDlg.open)resultDlg.close();
    status.textContent='Основной запрос сохранён';
  }

  q('.fc-close').onclick=close;q('.fc-cancel').onclick=close;q('.fc-save').onclick=()=>persist(true);q('.fc-ai').onclick=generate;
  dlg.addEventListener('cancel',e=>{e.preventDefault();close();});
  dlg.addEventListener('click',e=>{if(e.target===dlg)close();});
  [pain,manifestations,impact,desired].forEach(el=>el.addEventListener('input',()=>{status.textContent='Есть несохранённые изменения';}));
  rq('.fc-result-close').onclick=()=>resultDlg.close();rq('.fc-result-close2').onclick=()=>resultDlg.close();
  rq('.fc-result-use').onclick=useResult;
  rq('.fc-result-copy').onclick=async()=>{const text=resultMain.value.trim();if(!text)return;try{await navigator.clipboard.writeText(text);rq('.fc-result-copy').textContent='Скопировано';setTimeout(()=>rq('.fc-result-copy').textContent='Копировать',1200);}catch(_){}};

  function attach(){const btn=document.getElementById('ccFreeConsultBtn');if(!btn||btn.dataset.freeConsultReady==='1')return;btn.dataset.freeConsultReady='1';btn.onclick=open;}
  attach();
  const mo=new MutationObserver(attach);mo.observe(document.body,{childList:true,subtree:true});

  window.DiagnostikaFreeConsultation={open,save:()=>persist(true)};
})();
