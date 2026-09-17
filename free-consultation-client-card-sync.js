'use strict';

(() => {
  if (window.__fcClientCardSyncReady) return;
  window.__fcClientCardSyncReady = true;

  const SYNC_VERSION = 2;
  const NOTES_START = '=== БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ / ИИ ===';
  const NOTES_END = '=== КОНЕЦ АВТО-БЛОКА ===';

  const text = value => String(value ?? '').trim();
  const escRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function getClient(){
    try{ const c=window.DiagnostikaClients?.current?.(); if(c) return c; }catch(_){}
    try{ if(typeof client==='function'){ const c=client(); if(c) return c; } }catch(_){}
    try{ return state?.clients?.find(c=>String(c.id)===String(clientId))||null; }catch(_){}
    return null;
  }

  function saveState(){
    try{ if(typeof save==='function') save(); }catch(_){}
  }

  function ensureFreeConsultation(c){
    if(!c) return null;
    if(!c.freeConsultation || typeof c.freeConsultation!=='object' || Array.isArray(c.freeConsultation)) c.freeConsultation={};
    return c.freeConsultation;
  }

  function addConsultationField(grid,className,label,placeholder,beforeSelector){
    if(grid.querySelector(`.${className}`)) return grid.querySelector(`.${className}`);
    const wrap=document.createElement('label');
    wrap.className='fc-field fc-card-sync-field';
    wrap.innerHTML=`<span>${label}</span><textarea class="${className}" placeholder="${placeholder}"></textarea>`;
    const before=beforeSelector?grid.querySelector(beforeSelector)?.closest('.fc-field'):null;
    if(before) grid.insertBefore(wrap,before); else grid.appendChild(wrap);
    return wrap.querySelector('textarea');
  }

  function attachConsultationFields(){
    const dlg=document.getElementById('freeConsultationDialog');
    const grid=dlg?.querySelector('.fc-grid');
    if(!grid) return false;

    const tried=addConsultationField(
      grid,'fc-tried','Что уже пробовал',
      'Терапия, разговоры, курсы, самостоятельные попытки, конкретные действия...',
      '.fc-desired'
    );
    const worked=addConsultationField(
      grid,'fc-worked','Что сработало',
      'Что помогало хотя бы частично или давало заметный положительный эффект...',
      '.fc-didnt-help, .fc-desired'
    );
    const didnt=addConsultationField(
      grid,'fc-didnt-help','Что не сработало',
      'Что не помогло, дало временный эффект или почему попытка не решила проблему...',
      '.fc-desired'
    );

    [tried,worked,didnt].filter(Boolean).forEach(el=>{
      if(el.dataset.fcCardSyncBound==='1') return;
      el.dataset.fcCardSyncBound='1';
      el.addEventListener('input',()=>persistConsultationExtras(false));
    });
    return true;
  }

  function loadConsultationExtras(){
    if(!attachConsultationFields()) return;
    const c=getClient(); if(!c) return;
    const fc=ensureFreeConsultation(c);
    const dlg=document.getElementById('freeConsultationDialog');
    const map={'.fc-tried':fc.tried||'', '.fc-worked':fc.worked||'', '.fc-didnt-help':fc.didntHelp||''};
    for(const [selector,value] of Object.entries(map)){
      const el=dlg?.querySelector(selector);
      if(el) el.value=value;
    }
  }

  function persistConsultationExtras(saveNow=true){
    const c=getClient(); if(!c) return null;
    const fc=ensureFreeConsultation(c);
    const dlg=document.getElementById('freeConsultationDialog');
    if(!dlg?.open) return fc;
    attachConsultationFields();
    const tried=dlg.querySelector('.fc-tried');
    const worked=dlg.querySelector('.fc-worked');
    const didnt=dlg.querySelector('.fc-didnt-help');
    if(tried) fc.tried=tried.value||'';
    if(worked) fc.worked=worked.value||'';
    if(didnt) fc.didntHelp=didnt.value||'';
    fc.updatedAt=new Date().toISOString();
    if(saveNow) saveState();
    return fc;
  }

  function attachClientCardWorkedField(){
    const root=document.querySelector('#clientCardDialog .cc-long-fields');
    if(!root) return false;
    let worked=document.getElementById('ccWorked');
    if(!worked){
      const label=document.createElement('label');
      label.innerHTML='Что сработало<textarea id="ccWorked"></textarea>';
      const tried=document.getElementById('ccTried')?.closest('label');
      if(tried) tried.insertAdjacentElement('afterend',label); else root.appendChild(label);
      worked=label.querySelector('#ccWorked');
    }
    if(worked.dataset.fcCardSaveBound!=='1'){
      worked.dataset.fcCardSaveBound='1';
      const saveBtn=document.getElementById('ccSaveBtn');
      saveBtn?.addEventListener('click',()=>{
        const value=worked.value;
        setTimeout(()=>{
          const c=getClient();
          if(!c) return;
          c.worked=value;
          saveState();
        },0);
      });
    }
    return true;
  }

  function loadClientCardWorked(){
    if(!attachClientCardWorkedField()) return;
    const worked=document.getElementById('ccWorked');
    if(!worked) return;
    const draft=window.DiagnostikaClientCard?.isDraft?.();
    worked.value=draft?'':(getClient()?.worked||'');
  }

  function safeAutoField(c,key,next,previousValues){
    next=text(next);
    if(!next) return false;
    const current=text(c[key]);
    const previous=text(previousValues?.[key]);
    if(!current || current===previous || current===next){
      if(c[key]!==next){ c[key]=next; return true; }
    }
    return false;
  }

  function buildNotes(fc,ai){
    const lines=[];
    const add=(label,value)=>{ value=text(value); if(value) lines.push(`${label}: ${value}`); };
    add('Где проявляется',fc.manifestations);
    add('Как мешает жить',fc.impact);
    add('Почему обратился сейчас',fc.whyNow);
    add('Как изменится жизнь после решения',fc.lifeAfter);
    add('Обоснование ИИ',ai?.rationale);

    const shorts=Array.isArray(ai?.shortRequests)?ai.shortRequests:[];
    if(shorts.length){
      lines.push('Варианты короткого запроса:');
      shorts.forEach((item,index)=>{
        const title=text(typeof item==='string'?item:item?.title);
        if(!title) return;
        const priority=Number(item?.priority);
        lines.push(`${index+1}. ${title}${Number.isFinite(priority)?` — ${priority}%`:''}`);
      });
    }

    const questions=Array.isArray(ai?.clarifyingQuestions)?ai.clarifyingQuestions.map(text).filter(Boolean):[];
    if(questions.length){
      lines.push('Уточняющие вопросы ИИ:');
      questions.forEach((value,index)=>lines.push(`${index+1}. ${value}`));
    }

    const situations=Array.isArray(ai?.situations)?ai.situations.map(text).filter(Boolean):[];
    if(situations.length){
      lines.push('Ситуации из анализа:');
      situations.forEach((value,index)=>lines.push(`${index+1}. ${value}`));
    }
    return lines.join('\n').trim();
  }

  function mergeAutoNotes(current,body){
    const block=body?`${NOTES_START}\n${body}\n${NOTES_END}`:'';
    let notes=String(current||'');
    const re=new RegExp(`${escRegExp(NOTES_START)}[\\s\\S]*?${escRegExp(NOTES_END)}`,'g');
    const hadBlock=re.test(notes);
    re.lastIndex=0;
    if(hadBlock){
      notes=notes.replace(re,block).replace(/\n{3,}/g,'\n\n').trim();
      return {notes,block,changed:notes!==String(current||'')};
    }
    if(!block) return {notes,block,changed:false};
    notes=notes.trim()?`${notes.trim()}\n\n${block}`:block;
    return {notes,block,changed:notes!==String(current||'')};
  }

  function refreshOpenCard(c){
    const dlg=document.getElementById('clientCardDialog');
    if(!dlg?.open || window.DiagnostikaClientCard?.isDraft?.()) return;
    const current=getClient();
    if(!current || String(current.id)!==String(c.id)) return;
    attachClientCardWorkedField();
    const map={
      ccInitialProblem:c.initialProblem||'',
      ccMainRequest:c.mainRequest||'',
      ccTried:c.tried||'',
      ccWorked:c.worked||'',
      ccDidntHelp:c.didntHelp||'',
      ccDesiredOutcome:c.desiredOutcome||'',
      ccClientNotes:c.clientNotes||c.notes||''
    };
    for(const [id,value] of Object.entries(map)){
      const el=document.getElementById(id);
      if(el && el.value!==value) el.value=value;
    }
  }

  function syncClient(c,aiOverride=null){
    if(!c) return false;
    const fc=ensureFreeConsultation(c);
    const ai=aiOverride||fc.aiResult||null;
    if(!ai && !text(fc.pain) && !text(fc.tried) && !text(fc.worked) && !text(fc.didntHelp) && !text(fc.desired)) return false;

    const sync=fc.cardSync&&typeof fc.cardSync==='object'?fc.cardSync:{};
    const previous=sync.values&&typeof sync.values==='object'?sync.values:{};
    const next={
      initialProblem:text(fc.pain),
      mainRequest:text(ai?.mainRequest),
      tried:text(fc.tried),
      worked:text(fc.worked),
      didntHelp:text(fc.didntHelp),
      desiredOutcome:text(ai?.desiredResult)||text(fc.desired)
    };

    let changed=false;
    for(const [key,value] of Object.entries(next)) changed=safeAutoField(c,key,value,previous)||changed;

    const notesBody=buildNotes(fc,ai);
    const merged=mergeAutoNotes(c.clientNotes||c.notes||'',notesBody);
    if(merged.changed){ c.clientNotes=merged.notes; changed=true; }

    fc.cardSync={
      version:SYNC_VERSION,
      syncedAt:new Date().toISOString(),
      values:next,
      notesBlock:merged.block
    };

    saveState();
    refreshOpenCard(c);
    try{ window.DiagnostikaHomeDashboard?.refresh?.(); }catch(_){}
    window.dispatchEvent(new CustomEvent('diagnostika:free-consultation-card-synced',{detail:{clientId:c.id,changed}}));
    return changed;
  }

  function syncCurrent(){
    persistConsultationExtras(false);
    return syncClient(getClient());
  }

  function wrapAiGenerator(){
    const api=window.DiagnostikaRequestAI;
    if(!api || typeof api.generate!=='function' || api.generate.__fcCardSyncWrapped) return false;
    const original=api.generate.bind(api);
    const wrapped=async payload=>{
      const c=getClient();
      const fc=persistConsultationExtras(true)||ensureFreeConsultation(c)||{};
      const result=await original({
        ...(payload||{}),
        tried:fc.tried||payload?.tried||'',
        worked:fc.worked||payload?.worked||'',
        didntHelp:fc.didntHelp||payload?.didntHelp||''
      });
      if(c) syncClient(c,result);
      return result;
    };
    wrapped.__fcCardSyncWrapped=true;
    api.generate=wrapped;
    return true;
  }

  function wrapClientCardOpen(){
    const api=window.DiagnostikaClientCard;
    if(!api || api.__fcCardSyncWrapped) return false;
    const oldExisting=api.openExisting?.bind(api);
    const oldNew=api.openNew?.bind(api);
    if(oldExisting) api.openExisting=function(){ syncCurrent(); const out=oldExisting(); setTimeout(loadClientCardWorked,0); return out; };
    if(oldNew) api.openNew=function(){ const out=oldNew(); setTimeout(loadClientCardWorked,0); return out; };
    api.__fcCardSyncWrapped=true;
    return true;
  }

  function repairImportedQuestionnaireSources(){
    let changed=false;
    try{
      for(const c of state?.clients||[]){
        for(const q of c?.questionnaires||[]){
          if(text(q?.source).toLowerCase()!=='manual') continue;
          const automaticEvidence=text(q?.externalId) || (q?.raw!==null && q?.raw!==undefined);
          if(!automaticEvidence) continue;
          const rawSource=text(q?.raw?.source||q?.raw?.provider||c?.lastQuestionnaireSource).toLowerCase();
          q.source=rawSource.includes('google')?'google':'yandex';
          changed=true;
        }
      }
    }catch(_){}
    if(changed){
      saveState();
      try{ window.DiagnostikaQuestionnaires?.refresh?.(); }catch(_){}
    }
    return changed;
  }

  function bind(){
    attachConsultationFields();
    attachClientCardWorkedField();
    wrapAiGenerator();
    wrapClientCardOpen();
    repairImportedQuestionnaireSources();
  }

  const fcDlg=document.getElementById('freeConsultationDialog');
  if(fcDlg){
    new MutationObserver(()=>{ if(fcDlg.open){ attachConsultationFields(); loadConsultationExtras(); } }).observe(fcDlg,{attributes:true,attributeFilter:['open']});
  }
  const cardDlg=document.getElementById('clientCardDialog');
  if(cardDlg){
    new MutationObserver(()=>{ if(cardDlg.open) setTimeout(loadClientCardWorked,0); }).observe(cardDlg,{attributes:true,attributeFilter:['open']});
  }

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.cc-free-consult-btn')) setTimeout(loadConsultationExtras,0);
    if(event.target?.closest?.('.fc-save,.fc-ai')) persistConsultationExtras(true);
  },true);

  window.addEventListener('diagnostika:questionnairesImported',()=>setTimeout(repairImportedQuestionnaireSources,0));
  window.addEventListener('diagnostika:core-ready',()=>setTimeout(bind,0));

  window.DiagnostikaFreeConsultationSync={
    syncCurrent,
    syncClient,
    refresh(){ bind(); loadConsultationExtras(); loadClientCardWorked(); },
    repairQuestionnaireSources:repairImportedQuestionnaireSources
  };

  bind();
  setTimeout(bind,100);
  setTimeout(bind,600);
})();
