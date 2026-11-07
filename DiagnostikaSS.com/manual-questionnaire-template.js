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

  function clientsApi(){
    return window.DiagnostikaClients?.moduleAware===true
      ?window.DiagnostikaClients
      :window.DiagnostikaPlatform?.services?.clients||null;
  }

  function currentClient(){
    return window.DiagnostikaClientUIContext?.currentClient?.()
      || clientsApi()?.current?.()
      || null;
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

  function saveAndRefresh(c,questionnaires,source){
    if(!c?.id||!Array.isArray(questionnaires))return false;
    const updated=clientsApi()?.update?.(c.id,{questionnaires},{render:false,source});
    if(!updated)return false;
    window.DiagnostikaQuestionnaires?.refresh?.();
    return true;
  }

  function healEmptyCurrent(){
    const c=currentClient();
    if(!c||!Array.isArray(c.questionnaires)) return false;
    let changed=false;
    const questionnaires=c.questionnaires.map(q=>{
      if(!isCompletelyEmpty(q))return q;
      const next={...q};
      applyTemplate(next);
      changed=true;
      return next;
    });
    if(changed)return saveAndRefresh(c,questionnaires,'manual-questionnaire-template-heal');
    return false;
  }

  function seedJustCreatedManual(){
    const c=currentClient();
    if(!c||!Array.isArray(c.questionnaires)) return false;
    let newestIndex=-1;
    let newestTime=-Infinity;
    c.questionnaires.forEach((q,index)=>{
      if(String(q?.source||'').toLowerCase()!=='manual')return;
      const created=Date.parse(q?.receivedAt||0);
      if(Number.isFinite(created)&&created>newestTime){newestTime=created;newestIndex=index;}
    });
    if(newestIndex<0||Math.abs(Date.now()-newestTime)>5000) return false;
    const questionnaires=[...c.questionnaires];
    const newest={...questionnaires[newestIndex]};
    applyTemplate(newest);
    questionnaires[newestIndex]=newest;
    return saveAndRefresh(c,questionnaires,'manual-questionnaire-template-seed');
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
