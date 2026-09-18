'use strict';

(() => {
  if (window.__diagnostikaClientAiFullContextReady) return;
  window.__diagnostikaClientAiFullContextReady = true;

  const MAX_TEXT=7000;
  const text=value=>String(value??'').trim();
  const clip=(value,max=MAX_TEXT)=>{
    const s=text(value);
    return s.length>max?s.slice(0,max)+'…':s;
  };

  function currentClientById(id){
    try{return state?.clients?.find(c=>String(c.id)===String(id))||null;}catch(_){return null;}
  }

  function selectedShort(ai){
    const direct=text(ai?.selectedShortRequest?.title||ai?.selectedShortRequest);
    if(direct)return direct;
    const first=Array.isArray(ai?.shortRequests)?ai.shortRequests[0]:null;
    return text(typeof first==='string'?first:first?.title);
  }

  function cleanAi(ai){
    if(!ai||typeof ai!=='object')return null;
    const shorts=(Array.isArray(ai.shortRequests)?ai.shortRequests:[]).map(item=>({
      title:clip(typeof item==='string'?item:item?.title,900),
      priority:typeof item==='object'&&item?item.priority??'':''
    })).filter(x=>x.title);
    return {
      mainRequest:clip(ai.mainRequest,7000),
      selectedShortRequest:clip(selectedShort(ai),1800),
      shortRequests:shorts,
      rationale:clip(ai.rationale,7000),
      desiredResult:clip(ai.desiredResult,5000),
      clarifyingQuestions:(Array.isArray(ai.clarifyingQuestions)?ai.clarifyingQuestions:[]).map(x=>clip(x,1200)).filter(Boolean),
      situations:(Array.isArray(ai.situations)?ai.situations:[]).map(x=>clip(typeof x==='string'?x:x?.text||x?.name,1800)).filter(Boolean)
    };
  }

  function cleanConsultation(fc){
    if(!fc||typeof fc!=='object')return null;
    const attempts=clip(fc.attempts||[
      text(fc.tried)?`Что уже пробовал:\n${text(fc.tried)}`:'',
      text(fc.worked)?`Что сработало:\n${text(fc.worked)}`:'',
      text(fc.didntHelp)?`Что не сработало:\n${text(fc.didntHelp)}`:''
    ].filter(Boolean).join('\n\n'),7000);
    return {
      id:fc.id||'',
      createdAt:fc.createdAt||'',
      updatedAt:fc.updatedAt||'',
      context:clip(fc.context,7000),
      pain:clip(fc.pain,7000),
      manifestations:clip(fc.manifestations,5000),
      impact:clip(fc.impact,5000),
      attempts,
      desired:clip(fc.desired,5000),
      whyNow:clip(fc.whyNow,5000),
      lifeAfter:clip(fc.lifeAfter,5000),
      savedAiAnalysis:cleanAi(fc.aiResult)
    };
  }

  function requestTitle(c,requestId){
    return text((c?.requests||[]).find(r=>String(r.id)===String(requestId))?.title);
  }

  const SESSION_EXCLUDED_KEYS=new Set([
    'payment','aiChat','attachments','files','media','recordingBlob','blob','data','photoData','audioData','videoData'
  ]);
  const SESSION_KNOWN_KEYS=new Set([
    'id','date','requestId','notes','sessionFormat','sessionFormatOther','youtubeUrl'
  ]);

  function safeExtra(value,depth=0){
    if(value==null)return value;
    if(typeof value==='string')return clip(value,4000);
    if(typeof value==='number'||typeof value==='boolean')return value;
    if(depth>=2)return undefined;
    if(Array.isArray(value)){
      return value.slice(0,30).map(v=>safeExtra(v,depth+1)).filter(v=>v!==undefined);
    }
    if(typeof value==='object'){
      const out={};
      for(const [k,v] of Object.entries(value)){
        if(SESSION_EXCLUDED_KEYS.has(k)||/blob|base64|binary|attachment|media/i.test(k))continue;
        const cleaned=safeExtra(v,depth+1);
        if(cleaned!==undefined&&cleaned!==''&&!(Array.isArray(cleaned)&&!cleaned.length))out[k]=cleaned;
      }
      return Object.keys(out).length?out:undefined;
    }
    return undefined;
  }

  function cleanSession(c,s,index){
    const requestId=s?.requestId||s?.payment?.requestId||'';
    const extra={};
    for(const [key,value] of Object.entries(s||{})){
      if(SESSION_KNOWN_KEYS.has(key)||SESSION_EXCLUDED_KEYS.has(key)||/blob|base64|binary|attachment|media/i.test(key))continue;
      const cleaned=safeExtra(value,0);
      if(cleaned!==undefined&&cleaned!==''&&!(Array.isArray(cleaned)&&!cleaned.length))extra[key]=cleaned;
    }
    return {
      number:index+1,
      id:s?.id||'',
      date:s?.date||'',
      requestId,
      requestTitle:requestTitle(c,requestId),
      notes:clip(s?.notes,7000),
      sessionFormat:s?.sessionFormat||'',
      sessionFormatOther:clip(s?.sessionFormatOther,500),
      hasYoutubeRecord:Boolean(text(s?.youtubeUrl)),
      extra:Object.keys(extra).length?extra:undefined
    };
  }

  function fullProfile(c,baseProfile={}){
    return {
      ...baseProfile,
      name:c?.name||'',
      phone:c?.phone||'',
      email:c?.email||'',
      gender:c?.gender||'',
      country:c?.country||'',
      city:c?.city||'',
      birth:c?.birth||'',
      age:c?.age||'',
      vk:c?.vk||'',
      telegram:c?.telegram||'',
      max:c?.max||'',
      initialProblem:clip(c?.initialProblem,7000),
      mainRequest:clip(c?.mainRequest,5000),
      tried:clip(c?.tried,7000),
      desiredOutcome:clip(c?.desiredOutcome,7000),
      clientNotes:clip(c?.clientNotes||c?.notes,7000)
    };
  }

  function buildFullContext(c,baseContext={}){
    const currentConsultation=cleanConsultation(c?.freeConsultation);
    const archived=(Array.isArray(c?.freeConsultationArchive)?c.freeConsultationArchive:[])
      .map(cleanConsultation).filter(Boolean);
    const sessions=(Array.isArray(c?.sessions)?c.sessions:[]).map((s,index)=>cleanSession(c,s,index));
    const quickNotes=(Array.isArray(c?.quickNotes)?c.quickNotes:[]).map(n=>({
      text:clip(n?.text,5000),
      createdAt:n?.createdAt||n?.updatedAt||0,
      updatedAt:n?.updatedAt||n?.createdAt||0
    })).filter(n=>n.text);

    return {
      ...baseContext,
      profile:fullProfile(c,baseContext?.profile||{}),
      questionnaires:baseContext?.questionnaires||[],
      requests:baseContext?.requests||[],
      freeConsultation:currentConsultation,
      freeConsultationArchive:archived,
      sessions,
      notes:quickNotes.length?quickNotes:(baseContext?.notes||[]),
      contextInstruction:[
        'Анализируй клиента только по переданным данным и учитывай весь доступный контекст: карточку, анкеты, бесплатную консультацию, сохранённый ИИ-анализ, диагностику, все сессии и заметки специалиста.',
        'Чётко различай: 1) факты и слова клиента, 2) наблюдения/заметки специалиста, 3) собственные рабочие гипотезы.',
        'Не выдавай гипотезу за установленный факт. Если данных недостаточно или они противоречат друг другу — прямо укажи это и предложи, что уточнить.',
        'При рекомендациях связывай выводы с конкретными данными клиента и учитывай динамику от ранних данных к последним сессиям.'
      ].join(' ')
    };
  }

  function enrichPayload(payload){
    if(!payload||typeof payload!=='object'||payload.sessionId)return payload;
    const c=currentClientById(payload.clientId);
    if(!c)return payload;
    let base=payload.clientContext||{};
    try{
      const apiBase=window.DiagnostikaClientAIChat?.buildContext?.(c);
      if(apiBase&&typeof apiBase==='object')base={...apiBase,...base};
    }catch(_){}
    const context=buildFullContext(c,base);
    const instruction='Используй весь переданный контекст клиента. Отделяй факты и заметки специалиста от своих гипотез; не выдумывай отсутствующие данные. ';
    return {...payload,clientContext:context,message:instruction+String(payload.message||'')};
  }

  const EXTRA_PROMPTS=[
    ['Динамика клиента','Проанализируй динамику клиента по времени: что изменилось от анкеты и бесплатной консультации к диагностике и последним сессиям, что повторяется, а что стало лучше или хуже.'],
    ['Что уточнить?','Составь конкретный список вопросов, которые стоит уточнить у клиента на следующей встрече. Отдельно укажи, какие пробелы в данных мешают сделать уверенный вывод.'],
    ['Противоречия','Найди противоречия и расхождения между анкетой, бесплатной консультацией, карточкой клиента, диагностикой и сессиями. Не додумывай причины — только покажи, что именно расходится и что стоит проверить.'],
    ['Рабочие гипотезы','Сформулируй 2–4 рабочие гипотезы по клиенту. Для каждой укажи: на каких данных она основана, что её подтверждает, что пока не подтверждено и как её проверить в работе.'],
    ['Ресурсы клиента','Найди ресурсы клиента: что уже помогает, сильные стороны, поддерживающие отношения, успешные действия и то, на что можно опереться в дальнейшей работе.']
  ];

  function installPrompts(){
    const host=document.querySelector('#hdClientAiWidget .hd-ai-quick');
    if(!host)return false;
    for(const [label,prompt] of EXTRA_PROMPTS){
      if([...host.querySelectorAll('button')].some(b=>b.textContent.trim()===label))continue;
      const btn=document.createElement('button');
      btn.type='button';
      btn.textContent=label;
      btn.dataset.prompt=prompt;
      btn.onclick=()=>{
        const api=window.DiagnostikaClientAIChat;
        if(typeof api?.send==='function')api.send(prompt);
      };
      host.appendChild(btn);
    }
    return true;
  }

  function refresh(){installPrompts();}
  const observer=new MutationObserver(()=>refresh());
  observer.observe(document.body,{childList:true,subtree:true});
  refresh();
  setTimeout(refresh,150);
  setTimeout(refresh,600);
  setTimeout(refresh,1500);

  window.DiagnostikaClientAIFullContext={
    buildFullContext,
    enrichPayload,
    refresh
  };
})();
