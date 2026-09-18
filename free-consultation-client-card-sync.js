'use strict';

(() => {
  if (window.__fcClientCardSyncReady) return;
  window.__fcClientCardSyncReady = true;

  const SYNC_VERSION = 3;
  const NOTES_START = '=== БЕСПЛАТНАЯ КОНСУЛЬТАЦИЯ / ИИ ===';
  const NOTES_END = '=== КОНЕЦ АВТО-БЛОКА ===';

  const text = value => String(value ?? '').trim();
  const escRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clientsApi=()=>window.DiagnostikaClients
    || window.DiagnostikaPlatform?.clients
    || window.DiagnostikaPlatform?.services?.clients
    || null;
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

  function buildLegacyAttempts(fc){
    const lines=[];
    const add=(label,value)=>{ value=text(value); if(value) lines.push(`${label}:\n${value}`); };
    add('Что уже пробовал',fc?.tried);
    add('Что сработало',fc?.worked);
    add('Что не сработало',fc?.didntHelp);
    return lines.join('\n\n').trim();
  }

  function migrateConsultationFields(fc){
    if(!fc) return false;
    let changed=false;
    if(!text(fc.attempts)){
      const legacy=buildLegacyAttempts(fc);
      if(legacy){ fc.attempts=legacy; changed=true; }
    }
    if(fc.context===undefined){ fc.context=''; changed=true; }
    return changed;
  }

  function addConsultationField(grid,className,label,placeholder,beforeSelector){
    const existing=grid.querySelector(`.${className}`);
    if(existing) return existing;
    const wrap=document.createElement('label');
    wrap.className='fc-field fc-card-sync-field';
    wrap.innerHTML=`<span>${label}</span><textarea class="${className}" placeholder="${placeholder}"></textarea>`;
    const before=beforeSelector?grid.querySelector(beforeSelector)?.closest('.fc-field'):null;
    if(before) grid.insertBefore(wrap,before); else grid.appendChild(wrap);
    return wrap.querySelector('textarea');
  }

  function removeLegacyConsultationFields(grid){
    ['.fc-tried','.fc-worked','.fc-didnt-help'].forEach(selector=>{
      const el=grid.querySelector(selector);
      el?.closest('.fc-field')?.remove();
    });
  }

  function cleanupLegacyClientCardFields(){
    document.getElementById('ccWorked')?.closest('label')?.remove();
    document.getElementById('ccDidntHelp')?.closest('label')?.remove();
  }

  function attachConsultationFields(){
    const dlg=document.getElementById('freeConsultationDialog');
    const grid=dlg?.querySelector('.fc-grid');
    if(!grid) return false;

    removeLegacyConsultationFields(grid);

    const context=addConsultationField(
      grid,'fc-context','История клиента / контекст',
      'Свободный рассказ клиента: предыстория, события, отношения, жизненный фон и важные детали до формулировки конкретной проблемы...',
      '.fc-pain'
    );
    const attempts=addConsultationField(
      grid,'fc-attempts','Что пробовал / что сработало / что не сработало',
      'Все предыдущие попытки решения в одном поле: что клиент делал, что помогало хотя бы частично и что не помогло...',
      '.fc-desired'
    );

    [context,attempts].filter(Boolean).forEach(el=>{
      if(el.dataset.fcCardSyncBound==='1') return;
      el.dataset.fcCardSyncBound='1';
      el.addEventListener('input',()=>persistConsultationFields(false));
    });
    return true;
  }

  function loadConsultationFields(){
    if(!attachConsultationFields()) return;
    const c=getClient(); if(!c) return;
    const fc=ensureFreeConsultation(c);
    const migrated=migrateConsultationFields(fc);
    const dlg=document.getElementById('freeConsultationDialog');
    const context=dlg?.querySelector('.fc-context');
    const attempts=dlg?.querySelector('.fc-attempts');
    if(context) context.value=fc.context||'';
    if(attempts) attempts.value=fc.attempts||'';
    if(migrated) saveState();
  }

  function persistConsultationFields(saveNow=true){
    const c=getClient(); if(!c) return null;
    const fc=ensureFreeConsultation(c);
    migrateConsultationFields(fc);
    const dlg=document.getElementById('freeConsultationDialog');
    if(!dlg?.open) return fc;
    attachConsultationFields();
    const context=dlg.querySelector('.fc-context');
    const attempts=dlg.querySelector('.fc-attempts');
    if(context) fc.context=context.value||'';
    if(attempts) fc.attempts=attempts.value||'';
    fc.updatedAt=new Date().toISOString();
    if(saveNow) saveState();
    return fc;
  }

  function selectedShortRequest(ai){
    const selected=text(ai?.selectedShortRequest?.title||ai?.selectedShortRequest);
    if(selected) return selected;
    const first=Array.isArray(ai?.shortRequests)?ai.shortRequests[0]:null;
    return text(typeof first==='string'?first:first?.title);
  }

  function queueAutoField(c,patch,key,next,previousValues){
    next=text(next);
    if(!next) return false;
    const current=text(Object.prototype.hasOwnProperty.call(patch,key)?patch[key]:c[key]);
    const previous=text(previousValues?.[key]);
    if(!current || current===previous || current===next){
      if(text(c[key])!==next){patch[key]=next;return true;}
    }
    return false;
  }

  function stripLegacyAutoBlock(value){
    const original=String(value||'');
    const re=new RegExp(`${escRegExp(NOTES_START)}[\\s\\S]*?${escRegExp(NOTES_END)}`,'g');
    const cleaned=original.replace(re,'').replace(/\n{3,}/g,'\n\n').trim();
    return {value:cleaned,changed:cleaned!==original};
  }

  function legacyAutoNotesPatch(c){
    const patch={};
    for(const key of ['clientNotes','notes']){
      if(typeof c?.[key]!=='string' || !c[key].includes(NOTES_START)) continue;
      const cleaned=stripLegacyAutoBlock(c[key]);
      if(cleaned.changed)patch[key]=cleaned.value;
    }
    return patch;
  }

  function refreshOpenCard(c){
    const dlg=document.getElementById('clientCardDialog');
    if(!dlg?.open || window.DiagnostikaClientCard?.isDraft?.()) return;
    const current=getClient();
    if(!current || String(current.id)!==String(c.id)) return;
    cleanupLegacyClientCardFields();
    const map={
      ccInitialProblem:c.initialProblem||'',
      ccMainRequest:c.mainRequest||'',
      ccTried:c.tried||'',
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
    const migrated=migrateConsultationFields(fc);
    const ai=aiOverride||fc.aiResult||null;
    const profilePatch=legacyAutoNotesPatch(c);
    let profileChanged=Object.keys(profilePatch).length>0;
    let internalChanged=migrated;

    if(ai){
      const sync=fc.cardSync&&typeof fc.cardSync==='object'?fc.cardSync:{};
      const previous=sync.values&&typeof sync.values==='object'?sync.values:{};
      const next={
        initialProblem:text(ai?.mainRequest),
        mainRequest:selectedShortRequest(ai),
        tried:text(fc.attempts),
        desiredOutcome:text(ai?.desiredResult)
      };

      // Старый обработчик кнопки «Сохранить основной запрос» писал развёрнутый
      // запрос в mainRequest. Это известное старое автозначение, его можно безопасно
      // заменить выбранным коротким запросом, не трогая произвольный ручной текст.
      if(next.mainRequest && text(c.mainRequest)===text(ai?.mainRequest) && text(c.mainRequest)!==next.mainRequest){
        profilePatch.mainRequest=next.mainRequest;
        profileChanged=true;
      }

      for(const [key,value] of Object.entries(next)){
        profileChanged=queueAutoField(c,profilePatch,key,value,previous)||profileChanged;
      }

      const valuesChanged=SYNC_VERSION!==sync.version || JSON.stringify(previous)!==JSON.stringify(next);
      fc.cardSync={
        version:SYNC_VERSION,
        syncedAt:new Date().toISOString(),
        values:next
      };
      internalChanged=valuesChanged||internalChanged;
    }

    let updated=c;
    if(profileChanged){
      const api=clientsApi();
      if(api?.update){
        const result=api.update(c.id,profilePatch,{source:'free-consultation-card-sync',render:false});
        if(result)updated=result;
        else profileChanged=false;
      }else{
        console.error('[Diagnostika] ClientService.update is unavailable for free consultation sync.');
        profileChanged=false;
      }
    }

    if(internalChanged&&!profileChanged) saveState();
    const changed=profileChanged||internalChanged;
    refreshOpenCard(updated);
    try{ window.DiagnostikaHomeDashboard?.refresh?.(); }catch(_){}
    window.dispatchEvent(new CustomEvent('diagnostika:free-consultation-card-synced',{detail:{clientId:c.id,changed}}));
    return changed;
  }

  function syncCurrent(){
    persistConsultationFields(false);
    return syncClient(getClient());
  }

  function wrapAiGenerator(){
    const api=window.DiagnostikaRequestAI;
    if(!api || typeof api.generate!=='function' || api.generate.__fcCardSyncWrapped) return false;
    const original=api.generate.bind(api);
    const wrapped=async payload=>{
      const c=getClient();
      const fc=persistConsultationFields(true)||ensureFreeConsultation(c)||{};
      const rawPain=text(payload?.pain||fc.pain);
      const context=text(fc.context);
      const painForAi=context
        ?`История клиента / контекст:\n${context}\n\nБоль клиента:\n${rawPain}`
        :rawPain;
      const attempts=text(fc.attempts);
      return original({
        ...(payload||{}),
        pain:painForAi,
        tried:attempts||payload?.tried||'',
        didntHelp:''
      });
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
    if(oldExisting) api.openExisting=function(){ syncCurrent(); cleanupLegacyClientCardFields(); return oldExisting(); };
    if(oldNew) api.openNew=function(){ cleanupLegacyClientCardFields(); return oldNew(); };
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
    cleanupLegacyClientCardFields();
    wrapAiGenerator();
    wrapClientCardOpen();
    repairImportedQuestionnaireSources();
  }

  const fcDlg=document.getElementById('freeConsultationDialog');
  if(fcDlg){
    new MutationObserver(()=>{
      if(fcDlg.open){
        attachConsultationFields();
        loadConsultationFields();
      }
    }).observe(fcDlg,{attributes:true,attributeFilter:['open']});
  }

  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.cc-free-consult-btn')) setTimeout(loadConsultationFields,0);
    if(event.target?.closest?.('.fc-save,.fc-ai')) persistConsultationFields(true);
    if(event.target?.closest?.('.fc-v2-save-main,.fc-result-save-main')) setTimeout(syncCurrent,0);
  },true);

  window.addEventListener('diagnostika:questionnairesImported',()=>setTimeout(repairImportedQuestionnaireSources,0));
  window.addEventListener('diagnostika:core-ready',()=>setTimeout(bind,0));

  window.DiagnostikaFreeConsultationSync={
    syncCurrent,
    syncClient,
    refresh(){ bind(); loadConsultationFields(); },
    repairQuestionnaireSources:repairImportedQuestionnaireSources
  };

  bind();
  setTimeout(bind,100);
  setTimeout(bind,600);
})();
