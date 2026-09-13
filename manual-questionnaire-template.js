'use strict';

(() => {
  if(window.__diagnostikaManualQuestionnaireTemplateReady) return;
  window.__diagnostikaManualQuestionnaireTemplateReady=true;

  const QUESTIONS=[
    'Как к вам обращаться?',
    'Город, в котором вы проживаете',
    'Ваш возраст',
    'Как с вами удобнее связаться?',
    'Ваш номер телефона',
    'С чем вам хотелось бы разобраться на нашей встрече?',
    'Насколько сильно эта ситуация сейчас влияет на вашу жизнь?',
    'Если наша встреча окажется для вас полезной, что хотелось бы понять или изменить?',
    'Пробовали ли вы раньше что-то делать с этой ситуацией?',
    'Что для вас особенно важно в работе со специалистом?',
    'Какие чувства чаще всего возникают у вас в связи с этой ситуацией?',
    'Что вы обычно думаете о себе в такие моменты?',
    'Что бы вы хотели получить в результате нашей работы?'
  ];

  function uid(){
    const id=crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2);
    return 'q-'+id;
  }

  function currentClient(){
    try{return typeof client==='function'?client():null;}catch(_){return null;}
  }

  function applyTemplate(q){
    if(!q||String(q.source||'').toLowerCase()!=='manual') return false;
    q.answerItems=QUESTIONS.map(question=>({id:uid(),question,answer:''}));
    q.answers=Object.fromEntries(QUESTIONS.map(question=>[question,'']));
    q.manualTemplate='yandex-form-2026-09';
    return true;
  }

  function isCompletelyEmpty(q){
    if(!q||String(q.source||'').toLowerCase()!=='manual') return false;
    const items=Array.isArray(q.answerItems)?q.answerItems:[];
    const answers=q.answers&&typeof q.answers==='object'?q.answers:{};
    return items.length===0 && Object.keys(answers).length===0;
  }

  function saveAndRefresh(){
    if(typeof save==='function') save();
    window.DiagnostikaQuestionnaires?.refresh?.();
  }

  function healEmptyCurrent(){
    const c=currentClient();
    if(!c||!Array.isArray(c.questionnaires)) return false;
    let changed=false;
    for(const q of c.questionnaires){
      if(isCompletelyEmpty(q)){applyTemplate(q);changed=true;}
    }
    if(changed) saveAndRefresh();
    return changed;
  }

  function seedJustCreatedManual(){
    const c=currentClient();
    if(!c||!Array.isArray(c.questionnaires)) return false;
    const manuals=c.questionnaires.filter(q=>String(q?.source||'').toLowerCase()==='manual');
    if(!manuals.length) return false;
    manuals.sort((a,b)=>Date.parse(b.receivedAt||0)-Date.parse(a.receivedAt||0));
    const newest=manuals[0];
    const created=Date.parse(newest.receivedAt||0);
    if(!Number.isFinite(created)||Math.abs(Date.now()-created)>5000) return false;
    applyTemplate(newest);
    saveAndRefresh();
    return true;
  }

  document.addEventListener('click',e=>{
    const add=e.target?.closest?.('.cq-add-manual');
    if(add){
      setTimeout(seedJustCreatedManual,0);
      return;
    }
    if(e.target?.closest?.('#ccQuestionnairesBtn,.cq-item')) setTimeout(healEmptyCurrent,0);
  },true);

  window.DiagnostikaManualQuestionnaireTemplate={questions:[...QUESTIONS],heal:healEmptyCurrent};
})();
