'use strict';

(() => {
  if (window.__fcClientCardSyncReady) return;
  window.__fcClientCardSyncReady = true;

  const START='--- ДАННЫЕ ТЕКУЩЕЙ БК ---';
  const END='--- КОНЕЦ ДАННЫХ БК ---';

  function getClient(){
    try{ if(typeof client==='function'){ const c=client(); if(c) return c; } }catch(_){}
    try{ return state?.clients?.find(c=>String(c.id)===String(clientId))||null; }catch(_){}
    return null;
  }

  function arr(v){ return Array.isArray(v)?v.filter(Boolean):[]; }

  function currentShort(ai){
    return String(ai?.selectedShortRequest?.title || ai?.shortRequests?.[0]?.title || '').trim();
  }

  function desiredText(fc){
    const ai=fc?.aiResult||{};
    const parts=[];
    if(String(fc?.desired||'').trim()) parts.push('Что хочет вместо этого: '+String(fc.desired).trim());
    if(String(fc?.lifeAfter||'').trim()) parts.push('Как изменится жизнь: '+String(fc.lifeAfter).trim());
    if(String(ai?.desiredResult||'').trim()) parts.push('Желаемый результат по анализу ИИ: '+String(ai.desiredResult).trim());
    return parts.join('\n\n');
  }

  function summaryText(fc){
    const ai=fc?.aiResult||{};
    const lines=[];
    if(String(fc?.manifestations||'').trim()) lines.push('Где проявляется: '+String(fc.manifestations).trim());
    if(String(fc?.impact||'').trim()) lines.push('Как мешает жить: '+String(fc.impact).trim());
    if(String(fc?.whyNow||'').trim()) lines.push('Почему сейчас: '+String(fc.whyNow).trim());
    const short=currentShort(ai);
    if(short) lines.push('Короткий запрос для Диагностики: '+short);
    if(String(ai?.rationale||'').trim()) lines.push('Обоснование ИИ: '+String(ai.rationale).trim());
    const qs=arr(ai?.clarifyingQuestions||ai?.clarifyingQuestion);
    if(qs.length) lines.push('Уточняющие вопросы: '+qs.join(' | '));
    const situations=arr(ai?.situations);
    if(situations.length) lines.push('Ситуации: '+situations.join(' | '));
    return lines.join('\n');
  }

  function replaceAutoBlock(text,block){
    text=String(text||'');
    const re=new RegExp('\\n?'+START.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'[\\s\\S]*?'+END.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'\\n?','g');
    const manual=text.replace(re,'\n').replace(/^\s+|\s+$/g,'');
    if(!block) return manual;
    return (manual?manual+'\n\n':'')+START+'\n'+block+'\n'+END;
  }

  function refreshOpenCard(c){
    const map={
      ccInitialProblem:c.initialProblem||'',
      ccMainRequest:c.mainRequest||'',
      ccDesiredOutcome:c.desiredOutcome||'',
      ccClientNotes:c.clientNotes||''
    };
    for(const [id,val] of Object.entries(map)){
      const el=document.getElementById(id); if(el) el.value=val;
    }
  }

  function syncCurrent(saveNow=true){
    const c=getClient(); if(!c) return;
    const fc=c.freeConsultation&&typeof c.freeConsultation==='object'?c.freeConsultation:{};
    const ai=fc.aiResult||{};

    c.initialProblem=String(fc.pain||'').trim();
    c.mainRequest=String(ai.mainRequest||'').trim();
    c.desiredOutcome=desiredText(fc);
    c.clientNotes=replaceAutoBlock(c.clientNotes,summaryText(fc));
    c.freeConsultationLinkedAt=new Date().toISOString();

    if(saveNow){ try{ if(typeof save==='function') save(); }catch(_){} }
    refreshOpenCard(c);
    window.dispatchEvent(new CustomEvent('diagnostika:freeConsultationSynced',{detail:{clientId:c.id,consultationId:fc.id||null}}));
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.fc-save,.fc-archive-save,.fc-archive-current,.fc-archive-restore,.fc-v2-save-main')){
      setTimeout(()=>syncCurrent(true),120);
    }

    if(e.target?.closest?.('.fc-ai')){
      const c=getClient();
      const before=JSON.stringify(c?.freeConsultation?.aiResult||null);
      const started=Date.now();
      const timer=setInterval(()=>{
        const cc=getClient();
        const now=JSON.stringify(cc?.freeConsultation?.aiResult||null);
        if(now!==before || Date.now()-started>90000){
          clearInterval(timer);
          if(now!==before) syncCurrent(true);
        }
      },300);
    }
  });

  document.getElementById('freeConsultationDialog')?.addEventListener('close',()=>setTimeout(()=>syncCurrent(true),0));
  document.getElementById('freeConsultationAiResultDialog')?.addEventListener('close',()=>setTimeout(()=>syncCurrent(true),0));

  window.DiagnostikaFreeConsultationSync={syncCurrent};
})();
