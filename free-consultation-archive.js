'use strict';

(() => {
  if (window.__freeConsultationArchiveReady) return;
  window.__freeConsultationArchiveReady = true;

  const FIELDS = [
    ['pain','Боль клиента'],
    ['manifestations','Где проявляется'],
    ['impact','Как мешает жить'],
    ['desired','Что хочет вместо этого'],
    ['whyNow','Почему сейчас'],
    ['lifeAfter','Как изменится жизнь после решения проблемы']
  ];

  const clone = value => {
    try { return structuredClone(value); } catch (_) {}
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  };
  const makeId = () => {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return 'bc-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function getClient(){
    try { if (typeof client === 'function') { const c=client(); if(c) return c; } } catch(_) {}
    try { return state?.clients?.find(c => String(c.id) === String(clientId)) || null; } catch(_) {}
    return null;
  }
  function saveState(){ try { if (typeof save === 'function') save(); } catch(_) {} }

  function blankConsultation(){
    const now = new Date().toISOString();
    return {id:makeId(),createdAt:now,updatedAt:now,pain:'',manifestations:'',impact:'',desired:'',whyNow:'',lifeAfter:'',aiResult:null};
  }

  function ensureClientData(c){
    if(!c) return;
    if(!c.freeConsultation || typeof c.freeConsultation !== 'object' || Array.isArray(c.freeConsultation)) c.freeConsultation=blankConsultation();
    if(!c.freeConsultation.id) c.freeConsultation.id=makeId();
    if(!c.freeConsultation.createdAt) c.freeConsultation.createdAt=c.freeConsultation.updatedAt||new Date().toISOString();
    if(!Array.isArray(c.freeConsultationArchive)) c.freeConsultationArchive=[];
    c.freeConsultationArchive.forEach(item=>{ if(item && !item.id) item.id=makeId(); });
  }

  function hasContent(fc){
    if(!fc) return false;
    return FIELDS.some(([key])=>String(fc[key]||'').trim()) || !!fc.aiResult;
  }

  function syncCurrentFromForm(c){
    const dlg=document.getElementById('freeConsultationDialog');
    if(!c||!dlg) return;
    ensureClientData(c);
    const map={pain:'.fc-pain',manifestations:'.fc-manifestations',impact:'.fc-impact',desired:'.fc-desired',whyNow:'.fc-why-now',lifeAfter:'.fc-life-after'};
    for(const [key,sel] of Object.entries(map)){
      const el=dlg.querySelector(sel); if(el) c.freeConsultation[key]=el.value||'';
    }
    c.freeConsultation.updatedAt=new Date().toISOString();
  }

  function refreshCurrentForm(c){
    const dlg=document.getElementById('freeConsultationDialog');
    if(!c||!dlg) return;
    ensureClientData(c);
    const map={pain:'.fc-pain',manifestations:'.fc-manifestations',impact:'.fc-impact',desired:'.fc-desired',whyNow:'.fc-why-now',lifeAfter:'.fc-life-after'};
    for(const [key,sel] of Object.entries(map)){
      const el=dlg.querySelector(sel); if(el) el.value=c.freeConsultation[key]||'';
    }
    const st=dlg.querySelector('.fc-status');
    if(st){ st.textContent=''; }
  }

  function shortRequestsToText(ai){
    const arr=Array.isArray(ai?.shortRequests)?ai.shortRequests:[];
    return arr.map(x=>`${Math.max(0,Math.min(100,Math.round(Number(x?.priority)||0)))}% — ${String(x?.title||'').trim()}`).filter(x=>!x.endsWith('— ')).join('\n');
  }
  function parseShortRequests(text){
    return String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{
      const m=line.match(/^\s*(\d{1,3})\s*%\s*[—-]?\s*(.+)$/);
      if(m) return {title:m[2].trim(),priority:Math.max(0,Math.min(100,Number(m[1])||0))};
      return {title:line.replace(/^[-•]\s*/,''),priority:index===0?100:0};
    }).filter(x=>x.title).slice(0,4);
  }
  function lines(value){ return Array.isArray(value)?value.join('\n'):String(value||''); }
  function splitLines(value){ return String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean); }

  const style=document.createElement('style');
  style.textContent=`
    .fc-archive-dialog{width:min(1180px,95vw);height:min(780px,91vh);border:0;border-radius:16px;padding:0;box-shadow:0 26px 90px rgba(15,23,42,.42);background:#f8fafc;color:#26384d}
    .fc-archive-dialog::backdrop{background:rgba(15,23,42,.52);backdrop-filter:blur(4px)}
    .fc-archive-shell{height:100%;display:grid;grid-template-rows:auto 1fr;overflow:hidden}
    .fc-archive-head{display:flex;align-items:center;gap:10px;padding:15px 17px;background:#fff;border-bottom:1px solid #dce5ef}
    .fc-archive-head strong{font-size:20px}.fc-archive-head .spacer{flex:1}.fc-archive-count{font-size:12px;color:#68809a;font-weight:700}
    .fc-archive-body{min-height:0;display:grid;grid-template-columns:330px 1fr}
    .fc-archive-left{min-height:0;display:flex;flex-direction:column;border-right:1px solid #dce5ef;background:#f3f7fb}
    .fc-archive-toolbar{display:grid;gap:7px;padding:12px;border-bottom:1px solid #dce5ef}
    .fc-archive-list{overflow:auto;padding:10px;display:grid;align-content:start;gap:8px}
    .fc-archive-card{border:1px solid #cfdae6;background:#fff;border-radius:10px;padding:10px;cursor:pointer;text-align:left;color:#293c52;display:grid;gap:5px}
    .fc-archive-card:hover{border-color:#91b7e9}.fc-archive-card.selected{border-color:#3f83de;box-shadow:0 0 0 2px rgba(63,131,222,.11);background:#f5f9ff}
    .fc-archive-card-top{display:flex;align-items:center;gap:7px}.fc-archive-card-title{font-weight:900;font-size:12px}.fc-archive-card-date{margin-left:auto;color:#72849a;font-size:10px}
    .fc-archive-card-text{font-size:11px;line-height:1.35;color:#52687f;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .fc-archive-ai-chip{justify-self:start;font-size:9px;font-weight:900;border-radius:999px;padding:3px 6px;background:#eaf6ef;color:#287048;border:1px solid #bfe1cc}
    .fc-archive-empty{padding:18px 10px;text-align:center;color:#7b8b9d;font-size:12px}
    .fc-archive-editor{min-width:0;overflow:auto;padding:15px 17px 22px;background:#fff}
    .fc-archive-editor-title{font-size:14px;font-weight:900;margin-bottom:10px;display:flex;gap:8px;align-items:center}.fc-archive-current-badge{font-size:10px;padding:3px 7px;border-radius:999px;background:#e9f3ff;color:#2469ba}
    .fc-archive-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fc-archive-field{display:grid;gap:5px}.fc-archive-field span,.fc-archive-ai-field span{font-size:10px;font-weight:900;color:#5f748c}
    .fc-archive-field textarea,.fc-archive-ai-field textarea,.fc-archive-ai-field input{box-sizing:border-box;width:100%;border:1px solid #cbd7e3;border-radius:8px;padding:8px 9px;font:500 12px 'Segoe UI',Arial,sans-serif;color:#26384d;background:#fff;resize:vertical}
    .fc-archive-field textarea{min-height:86px}.fc-archive-section-title{margin:16px 0 8px;font-size:11px;font-weight:1000;color:#385878;border-top:1px solid #e2e8f0;padding-top:12px}
    .fc-archive-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fc-archive-ai-field{display:grid;gap:5px}.fc-archive-ai-field.wide{grid-column:1/-1}.fc-archive-ai-field textarea{min-height:74px}.fc-archive-main-request textarea{min-height:96px}
    .fc-archive-no-ai{padding:11px;border:1px dashed #cbd7e3;border-radius:8px;color:#7b8b9d;font-size:11px;background:#f8fafc}
    .fc-archive-actions{position:sticky;bottom:-22px;margin:16px -17px -22px;padding:11px 17px;background:rgba(255,255,255,.96);border-top:1px solid #dfe7ef;display:flex;gap:8px;flex-wrap:wrap;backdrop-filter:blur(6px)}
    .fc-archive-restore{background:linear-gradient(#4ca876,#278755)!important;color:white!important;border-color:#278755!important;font-weight:900!important}.fc-archive-delete{margin-left:auto;color:#a02c35!important}
    .fc-archive-btn{white-space:nowrap}.fc-ai-saved-btn{display:none}.fc-ai-saved-btn.show{display:inline-flex}
    @media(max-width:820px){.fc-archive-body{grid-template-columns:1fr}.fc-archive-left{max-height:270px;border-right:0;border-bottom:1px solid #dce5ef}.fc-archive-fields,.fc-archive-ai-grid{grid-template-columns:1fr}.fc-archive-ai-field.wide{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const archiveDlg=document.createElement('dialog');
  archiveDlg.className='fc-archive-dialog';
  archiveDlg.innerHTML=`<div class="fc-archive-shell">
    <div class="fc-archive-head"><strong>Архив БК</strong><span class="fc-archive-count"></span><span class="spacer"></span><button type="button" class="tk-btn fc-archive-close">×</button></div>
    <div class="fc-archive-body">
      <div class="fc-archive-left">
        <div class="fc-archive-toolbar"><button type="button" class="tk-btn fc-archive-current">Архивировать текущую БК</button></div>
        <div class="fc-archive-list"></div>
      </div>
      <div class="fc-archive-editor"><div class="fc-archive-empty">Выбери БК слева.</div></div>
    </div>
  </div>`;
  document.body.appendChild(archiveDlg);

  let selected={kind:'current',id:null};
  const listEl=archiveDlg.querySelector('.fc-archive-list');
  const editorEl=archiveDlg.querySelector('.fc-archive-editor');
  const countEl=archiveDlg.querySelector('.fc-archive-count');

  function itemTitle(fc){
    return String(fc?.aiResult?.mainRequest || fc?.aiResult?.selectedShortRequest?.title || fc?.pain || 'Без описания').trim();
  }
  function dateText(fc,kind){
    const raw=kind==='current'?(fc?.updatedAt||fc?.createdAt):(fc?.archivedAt||fc?.updatedAt||fc?.createdAt);
    if(!raw) return '—';
    try{return new Date(raw).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return raw;}
  }

  function getSelected(c){
    ensureClientData(c);
    if(selected.kind==='current') return c.freeConsultation;
    return c.freeConsultationArchive.find(x=>String(x.id)===String(selected.id))||null;
  }

  function renderList(){
    const c=getClient(); if(!c) return;
    ensureClientData(c);
    listEl.innerHTML='';
    countEl.textContent=`В архиве: ${c.freeConsultationArchive.length}`;

    const current=c.freeConsultation;
    const currentCard=document.createElement('button');
    currentCard.type='button'; currentCard.className='fc-archive-card'+(selected.kind==='current'?' selected':'');
    currentCard.innerHTML=`<div class="fc-archive-card-top"><span class="fc-archive-card-title">Текущая БК</span><span class="fc-archive-card-date">${esc(dateText(current,'current'))}</span></div><div class="fc-archive-card-text">${esc(hasContent(current)?itemTitle(current):'Пустая новая консультация')}</div>${current.aiResult?'<span class="fc-archive-ai-chip">ИИ-анализ сохранён</span>':''}`;
    currentCard.onclick=()=>{selected={kind:'current',id:current.id};renderList();renderEditor();};
    listEl.appendChild(currentCard);

    const items=[...c.freeConsultationArchive].sort((a,b)=>String(b.archivedAt||'').localeCompare(String(a.archivedAt||'')));
    if(!items.length){ const d=document.createElement('div');d.className='fc-archive-empty';d.textContent='Архив пока пуст.';listEl.appendChild(d); }
    items.forEach((fc,index)=>{
      const card=document.createElement('button');card.type='button';card.className='fc-archive-card'+(selected.kind==='archive'&&String(selected.id)===String(fc.id)?' selected':'');
      card.innerHTML=`<div class="fc-archive-card-top"><span class="fc-archive-card-title">БК №${items.length-index}</span><span class="fc-archive-card-date">${esc(dateText(fc,'archive'))}</span></div><div class="fc-archive-card-text">${esc(itemTitle(fc))}</div>${fc.aiResult?'<span class="fc-archive-ai-chip">ИИ-анализ сохранён</span>':''}`;
      card.onclick=()=>{selected={kind:'archive',id:fc.id};renderList();renderEditor();};
      listEl.appendChild(card);
    });
  }

  function editorHtml(fc,kind){
    const ai=fc?.aiResult||null;
    return `<div class="fc-archive-editor-title">${kind==='current'?'Текущая бесплатная консультация':'Архивная бесплатная консультация'} ${kind==='current'?'<span class="fc-archive-current-badge">активная</span>':''}</div>
      <div class="fc-archive-fields">${FIELDS.map(([key,label])=>`<label class="fc-archive-field"><span>${esc(label)}</span><textarea data-fc-key="${key}">${esc(fc?.[key]||'')}</textarea></label>`).join('')}</div>
      <div class="fc-archive-section-title">СОХРАНЁННЫЙ АНАЛИЗ ИИ</div>
      ${ai?`<div class="fc-archive-ai-grid">
        <label class="fc-archive-ai-field wide fc-archive-main-request"><span>Развёрнутый основной запрос</span><textarea data-ai-key="mainRequest">${esc(ai.mainRequest||'')}</textarea></label>
        <label class="fc-archive-ai-field wide"><span>Короткие запросы · формат: 70% — Название</span><textarea data-ai-key="shortRequests">${esc(shortRequestsToText(ai))}</textarea></label>
        <label class="fc-archive-ai-field"><span>Выбранный короткий запрос</span><input data-ai-key="selectedShort" value="${esc(ai.selectedShortRequest?.title||'')}"></label>
        <label class="fc-archive-ai-field"><span>Обоснование</span><textarea data-ai-key="rationale">${esc(ai.rationale||ai.analysis||'')}</textarea></label>
        <label class="fc-archive-ai-field"><span>Желаемый результат</span><textarea data-ai-key="desiredResult">${esc(ai.desiredResult||'')}</textarea></label>
        <label class="fc-archive-ai-field"><span>Уточняющие вопросы · по одному на строку</span><textarea data-ai-key="clarifyingQuestions">${esc(lines(ai.clarifyingQuestions||ai.clarifyingQuestion))}</textarea></label>
        <label class="fc-archive-ai-field wide"><span>Ситуации · по одной на строку</span><textarea data-ai-key="situations">${esc(lines(ai.situations))}</textarea></label>
      </div>`:'<div class="fc-archive-no-ai">Для этой БК анализ ИИ ещё не выполнялся.</div>'}
      <div class="fc-archive-actions">
        <button type="button" class="tk-btn fc-archive-save">Сохранить изменения</button>
        ${kind==='archive'?'<button type="button" class="tk-btn fc-archive-restore">Восстановить и продолжить эту БК</button><button type="button" class="tk-btn fc-archive-delete">Удалить БК</button>':''}
      </div>`;
  }

  function renderEditor(){
    const c=getClient(); if(!c) return;
    const fc=getSelected(c);
    if(!fc){editorEl.innerHTML='<div class="fc-archive-empty">БК не найдена.</div>';return;}
    editorEl.innerHTML=editorHtml(fc,selected.kind);
    editorEl.querySelector('.fc-archive-save')?.addEventListener('click',saveSelected);
    editorEl.querySelector('.fc-archive-restore')?.addEventListener('click',restoreSelected);
    editorEl.querySelector('.fc-archive-delete')?.addEventListener('click',deleteSelected);
  }

  function collectEditorInto(target){
    if(!target) return;
    editorEl.querySelectorAll('[data-fc-key]').forEach(el=>target[el.dataset.fcKey]=el.value||'');
    target.updatedAt=new Date().toISOString();
    if(target.aiResult){
      const ai={...target.aiResult};
      const get=key=>editorEl.querySelector(`[data-ai-key="${key}"]`);
      if(get('mainRequest')) ai.mainRequest=get('mainRequest').value.trim();
      if(get('shortRequests')) ai.shortRequests=parseShortRequests(get('shortRequests').value);
      if(get('selectedShort')){
        const title=get('selectedShort').value.trim();
        const found=(ai.shortRequests||[]).find(x=>x.title===title);
        ai.selectedShortRequest=title?{title,priority:found?.priority||0}:null;
      }
      if(get('rationale')) ai.rationale=get('rationale').value.trim();
      if(get('desiredResult')) ai.desiredResult=get('desiredResult').value.trim();
      if(get('clarifyingQuestions')) ai.clarifyingQuestions=splitLines(get('clarifyingQuestions').value);
      if(get('situations')) ai.situations=splitLines(get('situations').value);
      target.aiResult=ai;
    }
  }

  function saveSelected(){
    const c=getClient(); if(!c) return;
    const fc=getSelected(c); if(!fc) return;
    collectEditorInto(fc); saveState();
    if(selected.kind==='current') refreshCurrentForm(c);
    renderList();renderEditor();
    const btn=editorEl.querySelector('.fc-archive-save');if(btn){btn.textContent='Сохранено';setTimeout(()=>{if(btn.isConnected)btn.textContent='Сохранить изменения';},1000);}
    refreshAiSavedButton();
  }

  function archiveCurrent(){
    const c=getClient(); if(!c) return alert('Сначала выбери клиента.');
    ensureClientData(c); syncCurrentFromForm(c);
    if(!hasContent(c.freeConsultation)) return alert('Текущая БК пустая — архивировать нечего.');
    const snap=clone(c.freeConsultation);
    snap.id=snap.id||makeId(); snap.archivedAt=new Date().toISOString(); snap.updatedAt=snap.archivedAt;
    c.freeConsultationArchive.push(snap);
    c.freeConsultation=blankConsultation();
    saveState();refreshCurrentForm(c);selected={kind:'current',id:c.freeConsultation.id};renderList();renderEditor();refreshAiSavedButton();
    const st=document.querySelector('#freeConsultationDialog .fc-status');if(st){st.textContent='БК сохранена в архив. Можно начинать новую.';setTimeout(()=>{if(st.textContent.includes('сохранена в архив'))st.textContent='';},2400);}
  }

  function restoreSelected(){
    const c=getClient(); if(!c||selected.kind!=='archive') return;
    ensureClientData(c); syncCurrentFromForm(c);
    const idx=c.freeConsultationArchive.findIndex(x=>String(x.id)===String(selected.id)); if(idx<0) return;
    const restoring=clone(c.freeConsultationArchive[idx]);
    if(hasContent(c.freeConsultation)){
      const cur=clone(c.freeConsultation);cur.id=cur.id||makeId();cur.archivedAt=new Date().toISOString();cur.updatedAt=cur.archivedAt;c.freeConsultationArchive.push(cur);
    }
    c.freeConsultationArchive.splice(idx,1);
    delete restoring.archivedAt; restoring.restoredAt=new Date().toISOString(); restoring.updatedAt=restoring.restoredAt; restoring.id=restoring.id||makeId();
    c.freeConsultation=restoring;
    saveState();refreshCurrentForm(c);selected={kind:'current',id:restoring.id};refreshAiSavedButton();renderList();renderEditor();archiveDlg.close();
    const st=document.querySelector('#freeConsultationDialog .fc-status');if(st){st.textContent='Архивная БК восстановлена — продолжаем работу с ней.';setTimeout(()=>{if(st.textContent.includes('восстановлена'))st.textContent='';},2600);}
  }

  function deleteSelected(){
    const c=getClient(); if(!c||selected.kind!=='archive') return;
    const fc=getSelected(c);if(!fc)return;
    if(!confirm('Удалить эту БК из архива без возможности восстановления?')) return;
    c.freeConsultationArchive=c.freeConsultationArchive.filter(x=>String(x.id)!==String(selected.id));
    saveState();selected={kind:'current',id:c.freeConsultation?.id};renderList();renderEditor();
  }

  function openArchive(selectCurrent=true){
    const c=getClient();if(!c)return alert('Сначала выбери клиента.');
    ensureClientData(c);syncCurrentFromForm(c);saveState();
    if(selectCurrent)selected={kind:'current',id:c.freeConsultation.id};
    renderList();renderEditor();archiveDlg.showModal();
  }

  function refreshAiSavedButton(){
    const c=getClient();const btn=document.querySelector('#freeConsultationDialog .fc-ai-saved-btn');
    if(btn)btn.classList.toggle('show',!!c?.freeConsultation?.aiResult);
  }

  function attachButtons(){
    const dlg=document.getElementById('freeConsultationDialog');if(!dlg)return;
    const left=dlg.querySelector('.fc-actions-left');if(!left)return;
    if(!left.querySelector('.fc-archive-btn')){
      const b=document.createElement('button');b.type='button';b.className='tk-btn fc-archive-btn';b.textContent='Архив БК';b.onclick=()=>openArchive(true);left.appendChild(b);
    }
    if(!left.querySelector('.fc-ai-saved-btn')){
      const b=document.createElement('button');b.type='button';b.className='tk-btn fc-ai-saved-btn';b.textContent='Сохранённый анализ ИИ';b.onclick=()=>openArchive(true);left.appendChild(b);
    }
    refreshAiSavedButton();
  }

  archiveDlg.querySelector('.fc-archive-close').onclick=()=>archiveDlg.close();
  archiveDlg.querySelector('.fc-archive-current').onclick=archiveCurrent;
  archiveDlg.addEventListener('click',e=>{if(e.target===archiveDlg)archiveDlg.close();});

  attachButtons();
  new MutationObserver(()=>{attachButtons();refreshAiSavedButton();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});

  window.DiagnostikaFreeConsultationArchive={open:openArchive,archiveCurrent,refresh:()=>{renderList();renderEditor();refreshAiSavedButton();}};
})();