'use strict';

(() => {
  if (window.DiagnostikaRequestAI) return;

  const PRODUCTION_URL='https://lugovoyn8n.ru/webhook/diagnostika-ai-request-v2';
  const ACCESS_KEY='diagnostika-ai-n8n-access-key';

  function getConfig(){
    return {
      url:PRODUCTION_URL,
      key:(localStorage.getItem(ACCESS_KEY)||'').trim()
    };
  }

  function saveConfig(_url,key){
    localStorage.setItem(ACCESS_KEY,String(key||'').trim());
  }

  function clearConfig(){
    localStorage.removeItem(ACCESS_KEY);
  }

  function configure(){
    const old=getConfig();
    const key=window.prompt('Введи ключ доступа, который указан в n8n:',old.key||'');
    if(key===null)return null;
    const cleanKey=String(key).trim();
    if(cleanKey.length<12)throw new Error('Ключ доступа должен быть не короче 12 символов');
    saveConfig(PRODUCTION_URL,cleanKey);
    return {url:PRODUCTION_URL,key:cleanKey};
  }

  function clampPriority(v){
    const n=Math.round(Number(v));
    return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;
  }

  function normalizeShortRequests(out){
    let raw=Array.isArray(out?.shortRequests)?out.shortRequests:
      Array.isArray(out?.short_requests)?out.short_requests:
      Array.isArray(out?.alternatives)?out.alternatives:[];

    const list=raw.map((item,index)=>{
      if(typeof item==='string')return {title:item.trim(),priority:index===0?100:0};
      item=item&&typeof item==='object'?item:{};
      return {
        title:String(item.title||item.request||item.shortRequest||item.short_request||'').trim(),
        priority:clampPriority(item.priority??item.percent??item.probability??item.score)
      };
    }).filter(x=>x.title);

    list.sort((a,b)=>b.priority-a.priority);
    return list.slice(0,4);
  }

  function normalizeStringArray(value){
    if(Array.isArray(value))return value.map(x=>typeof x==='string'?x:String(x?.text||x?.question||x?.name||'')).map(x=>x.trim()).filter(Boolean);
    const one=String(value||'').trim();
    return one?[one]:[];
  }

  function normalize(out){
    if(typeof out==='string'){
      try{out=JSON.parse(out);}catch(_){return {mainRequest:out,shortRequests:[],rationale:'',desiredResult:'',clarifyingQuestions:[],situations:[]};}
    }
    out=out&&typeof out==='object'?out:{};
    return {
      mainRequest:String(out.mainRequest||out.main_request||'').trim(),
      shortRequests:normalizeShortRequests(out),
      rationale:String(out.rationale||out.reasoning||out.analysis||out.explanation||'').trim(),
      desiredResult:String(out.desiredResult||out.desired_result||'').trim(),
      clarifyingQuestions:normalizeStringArray(out.clarifyingQuestions||out.clarifying_questions||out.clarifyingQuestion||out.clarifying_question),
      situations:normalizeStringArray(out.situations)
    };
  }

  async function postForm(url,form){
    try{
      const response=await fetch(url,{
        method:'POST',
        body:form,
        cache:'no-store',
        credentials:'omit',
        redirect:'follow'
      });
      const text=await response.text();
      return {response,text,networkError:null};
    }catch(err){
      return {response:null,text:'',networkError:err};
    }
  }

  async function generate(payload){
    let cfg=getConfig();
    if(!cfg.key){
      cfg=configure();
      if(!cfg)throw new Error('Настройка ИИ отменена');
    }

    const form=new URLSearchParams();
    form.set('accessKey',cfg.key);
    form.set('clientId',payload?.clientId||'');
    form.set('clientName',payload?.clientName||'');
    form.set('pain',payload?.pain||'');
    form.set('manifestations',payload?.manifestations||'');
    form.set('impact',payload?.impact||'');
    form.set('desired',payload?.desired||'');
    form.set('whyNow',payload?.whyNow||'');
    form.set('lifeAfter',payload?.lifeAfter||'');

    const url=PRODUCTION_URL;
    const attempt=await postForm(url,form);

    if(attempt.networkError){
      throw new Error(`Не удалось получить ответ от production webhook: ${url}. Проверь, что workflow опубликован и в Webhook разрешён CORS для https://inkermankirov-a11y.github.io`);
    }

    const response=attempt.response;
    const text=attempt.text;

    if(!response.ok){
      if(response.status===401||response.status===403){
        throw new Error('n8n отклонил ключ доступа. Проверь ключ ИИ.');
      }
      throw new Error(`Production webhook ${url} вернул HTTP ${response.status}${text?`: ${text.slice(0,220)}`:''}`);
    }

    let data;
    try{data=text?JSON.parse(text):{};}catch(_){data={mainRequest:text};}
    if(data&&typeof data==='object'&&data.error)throw new Error(String(data.error));

    const result=normalize(data);
    if(!result.mainRequest)throw new Error('ИИ не вернул развёрнутый основной запрос');
    return result;
  }

  window.DiagnostikaRequestAI={generate,configure,clearConfig,getConfig,normalize,productionUrl:PRODUCTION_URL};
})();
