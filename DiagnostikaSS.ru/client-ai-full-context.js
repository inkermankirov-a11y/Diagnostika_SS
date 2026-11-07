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
    if(id===undefined||id===null||id==='')return null;
    try{return window.DiagnostikaAIUIContext?.clientsApi?.()?.findById?.(id)||null;}catch(_){return null;}
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

  function cleanQuestionnaire(q,index){
    if(!q||typeof q!=='object')return null;
    const items=Array.isArray(q.answerItems)
      ?q.answerItems.map(x=>({question:clip(x?.question,1200),answer:clip(x?.answer,2500)}))
      :Object.entries(q.answers||{}).map(([question,answer])=>({
        question:clip(question,1200),
        answer:clip(Array.isArray(answer)?answer.join(', '):answer,2500)
      }));
    return {
      number:index+1,
      source:clip(q.source,500),
      receivedAt:q.receivedAt||q.createdAt||q.updatedAt||'',
      createdAt:q.createdAt||'',
      updatedAt:q.updatedAt||'',
      isPrimary:Boolean(q.isPrimary),
      answers:items.filter(x=>x.question||x.answer)
    };
  }

  function cleanInstinct(i){
    return {
      name:clip(i?.name,1000),
      level:i?.level??'',
      comment:clip(i?.comment,2000)
    };
  }

  function cleanDeep(d){
    return {
      text:clip(d?.text||d?.name,2500),
      level:d?.level??'',
      comment:clip(d?.comment,2500),
      instincts:(Array.isArray(d?.instincts)?d.instincts:[]).map(cleanInstinct)
    };
  }

  function cleanFeeling(f){
    return {
      text:clip(f?.text||f?.name,2500),
      level:f?.level??'',
      comment:clip(f?.comment,2500),
      deep:(Array.isArray(f?.deep)?f.deep:[]).map(cleanDeep)
    };
  }

  function cleanBelief(b){
    return {
      text:clip(b?.text||b?.name,3000),
      level:b?.level??'',
      comment:clip(b?.comment,2500),
      feelings:(Array.isArray(b?.feelings)?b.feelings:[]).map(cleanFeeling)
    };
  }

  function cleanSituation(s){
    return {
      name:clip(s?.name||s?.text,3500),
      level:s?.level??'',
      comment:clip(s?.comment,3000),
      result:clip(s?.result,3500),
      beliefs:(Array.isArray(s?.beliefs)?s.beliefs:[]).map(cleanBelief)
    };
  }

  function cleanRequest(r,index,currentRequestId){
    if(!r||typeof r!=='object')return null;
    return {
      number:index+1,
      id:r.id||'',
      title:clip(r.title,5000),
      status:r.status||'',
      isCurrent:String(r.id||'')===String(currentRequestId||''),
      createdAt:r.createdAt||'',
      updatedAt:r.updatedAt||'',
      completedAt:r.completedAt||'',
      situations:(Array.isArray(r.situations)?r.situations:[]).map(cleanSituation)
    };
  }

  function timestamp(value){
    if(value===undefined||value===null||value==='')return NaN;
    if(typeof value==='number')return Number.isFinite(value)?value:NaN;
    const raw=String(value).trim();
    if(!raw)return NaN;
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
      const [year,month,day]=raw.split('-').map(Number);
      return new Date(year,month-1,day,12,0,0,0).getTime();
    }
    const n=Number(raw);
    if(Number.isFinite(n)&&n>1000000000)return n;
    const parsed=Date.parse(raw);
    return Number.isFinite(parsed)?parsed:NaN;
  }

  function timelineEntry(kind,at,data={}){
    const time=timestamp(at);
    return {_time:Number.isFinite(time)?time:Number.POSITIVE_INFINITY,kind,at:at||'',...data};
  }

  function buildLongitudinalTimeline(c,{questionnaires=[],requests=[],consultation=null,archive=[],sessions=[],notes=[]}={}){
    const entries=[];

    questionnaires.forEach(q=>{
      if(!q)return;
      entries.push(timelineEntry('questionnaire',q.receivedAt||q.createdAt||q.updatedAt,{
        title:q.source||'Анкета',
        summary:`Анкета: ${q.answers?.length||0} ответов`
      }));
    });

    requests.forEach(r=>{
      if(!r)return;
      entries.push(timelineEntry('request',r.createdAt||r.updatedAt,{
        requestId:r.id||'',
        requestTitle:r.title||'',
        status:r.status||'',
        summary:clip(`Запрос: ${r.title||'Без названия'}${r.status?' • '+r.status:''}`,1200)
      }));
      if(r.completedAt){
        entries.push(timelineEntry('request_completed',r.completedAt,{
          requestId:r.id||'',
          requestTitle:r.title||'',
          summary:clip(`Запрос завершён: ${r.title||'Без названия'}`,1200)
        }));
      }
    });

    [...archive,consultation].filter(Boolean).forEach(fc=>{
      entries.push(timelineEntry('free_consultation',fc.createdAt||fc.updatedAt,{
        title:'Бесплатная консультация',
        summary:clip(fc.pain||fc.context||fc.desired,1600)
      }));
    });

    sessions.forEach(s=>{
      if(!s)return;
      entries.push(timelineEntry(s.planned===true||String(s.status||'')==='planned'?'planned_session':'session',s.date||s.createdAt||s.updatedAt,{
        requestId:s.requestId||'',
        requestTitle:s.requestTitle||'',
        sessionId:s.id||'',
        summary:clip(s.notes||s.extra?.plan||s.sessionFormat||'Сессия без текстовой заметки',1800)
      }));
    });

    notes.forEach(n=>{
      if(!n)return;
      entries.push(timelineEntry('specialist_note',n.createdAt||n.updatedAt,{
        summary:clip(n.text,1800)
      }));
    });

    return entries
      .sort((a,b)=>a._time-b._time)
      .map(({_time,...entry})=>entry)
      .slice(-240);
  }

  const SESSION_EXCLUDED_KEYS=new Set([
    'payment','aiChat','attachments','files','media','recordingBlob','blob','data','photoData','audioData','videoData'
  ]);
  const SESSION_KNOWN_KEYS=new Set([
    'id','date','requestId','notes','sessionFormat','sessionFormatOther','youtubeUrl','plan','planned','status',
    'scheduledTime','appointmentType','calendarTitle','calendarEventId','createdAt','updatedAt'
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
      scheduledTime:s?.scheduledTime||'',
      requestId,
      requestTitle:requestTitle(c,requestId),
      notes:clip(s?.notes,7000),
      plan:clip(s?.plan,5000),
      planned:Boolean(s?.planned)||String(s?.status||'')==='planned',
      status:s?.status||'',
      appointmentType:s?.appointmentType||'',
      calendarTitle:clip(s?.calendarTitle,1000),
      calendarEventId:s?.calendarEventId||'',
      createdAt:s?.createdAt||'',
      updatedAt:s?.updatedAt||'',
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
    const questionnaires=(Array.isArray(c?.questionnaires)?c.questionnaires:[])
      .map(cleanQuestionnaire).filter(Boolean);
    const requests=(Array.isArray(c?.requests)?c.requests:[])
      .map((r,index)=>cleanRequest(r,index,c?.currentRequestId)).filter(Boolean);
    const sessions=(Array.isArray(c?.sessions)?c.sessions:[]).map((s,index)=>cleanSession(c,s,index));
    const quickNotes=(Array.isArray(c?.quickNotes)?c.quickNotes:[]).map(n=>({
      id:n?.id||'',
      text:clip(n?.text,5000),
      createdAt:n?.createdAt||n?.updatedAt||0,
      updatedAt:n?.updatedAt||n?.createdAt||0,
      source:'specialist_note'
    })).filter(n=>n.text);
    const notes=quickNotes.length?quickNotes:(baseContext?.notes||[]);
    const timeline=buildLongitudinalTimeline(c,{
      questionnaires,
      requests,
      consultation:currentConsultation,
      archive:archived,
      sessions,
      notes
    });

    return {
      ...baseContext,
      profile:fullProfile(c,baseContext?.profile||{}),
      questionnaires,
      requests,
      historicalRequests:requests,
      freeConsultation:currentConsultation,
      freeConsultationArchive:archived,
      sessions,
      notes,
      specialistNotes:notes,
      longitudinal:{
        currentRequestId:c?.currentRequestId||'',
        totalRequests:requests.length,
        totalSessions:sessions.length,
        totalNotes:notes.length,
        timeline
      },
      contextInstruction:[
        'Анализируй клиента только по переданным данным и учитывай весь доступный контекст за всё время работы: карточку, все анкеты, все старые и текущие запросы, бесплатные консультации, сохранённый ИИ-анализ, диагностику, все сессии, планы сессий и заметки специалиста.',
        'Заметки специалиста — самостоятельный важный источник контекста. Учитывай даже старые заметки, если они помогают понять повторение темы, инсайт, улучшение, ухудшение или возвращение проблемы спустя месяцы или годы.',
        'Сопоставляй текущий запрос с историческими запросами клиента. Если клиент вернулся после перерыва, проверяй, есть ли связь с прежними темами, результатами, незавершёнными вопросами или прежними заметками.',
        'По временной линии отмечай подтверждённые признаки прогресса, устойчивых улучшений, регрессии, отката или повторения паттерна. Всегда указывай, на каких датированных данных основан вывод.',
        'Чётко различай: 1) факты и слова клиента, 2) наблюдения/заметки специалиста, 3) собственные рабочие гипотезы.',
        'Не называй работу недоработанной или проблему вернувшейся без достаточных данных. Если причинная связь не подтверждена — формулируй её как гипотезу и указывай, что нужно проверить.',
        'Если данные противоречат друг другу или есть большой временной разрыв — прямо укажи это и предложи конкретные вопросы для проверки.'
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
    const instruction='Используй весь переданный контекст клиента за всё время работы, включая старые запросы, сессии и заметки специалиста. Сравнивай данные по времени и отмечай прогресс, откат или повторение паттернов только там, где это подтверждается данными. Отделяй факты и заметки специалиста от своих гипотез; не выдумывай отсутствующие данные. ';
    return {...payload,clientContext:context,message:instruction+String(payload.message||'')};
  }

  const EXTRA_PROMPTS=[
    ['Динамика клиента','Проанализируй всю историю клиента по времени, включая старые запросы, сессии и заметки специалиста. Покажи подтверждённые улучшения, ухудшения, возврат прежних тем, повторяющиеся паттерны и важные поворотные точки с датами.'],
    ['Прогресс / откат','Сделай карту прогрессии и регрессии клиента по всей временной линии. Для каждого вывода укажи конкретные данные и даты; отдельно отметь, что является фактом, а что только рабочей гипотезой.'],
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
  window.addEventListener('diagnostika:client-ai-widget-ready',refresh);
  refresh();

  window.DiagnostikaClientAIFullContext=Object.freeze({
    buildFullContext,
    enrichPayload,
    refresh
  });
})();
