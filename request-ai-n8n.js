'use strict';

(() => {
  if (window.DiagnostikaRequestAI) return;

  const URL_KEY='diagnostika-ai-n8n-webhook-url';
  const ACCESS_KEY='diagnostika-ai-n8n-access-key';

  function getConfig(){
    return {
      url:(localStorage.getItem(URL_KEY)||'').trim(),
      key:(localStorage.getItem(ACCESS_KEY)||'').trim()
    };
  }

  function saveConfig(url,key){
    localStorage.setItem(URL_KEY,String(url||'').trim());
    localStorage.setItem(ACCESS_KEY,String(key||'').trim());
  }

  function clearConfig(){
    localStorage.removeItem(URL_KEY);
    localStorage.removeItem(ACCESS_KEY);
  }

  function configure(){
    const old=getConfig();
    const url=window.prompt('Вставь Production URL Webhook из n8n:',old.url||'');
    if(url===null)return null;
    const cleanUrl=String(url).trim();
    if(!/^https:\/\//i.test(cleanUrl))throw new Error('Webhook URL должен начинаться с https://');

    const key=window.prompt('Введи ключ доступа, который указан в n8n:',old.key||'');
    if(key===null)return null;
    const cleanKey=String(key).trim();
    if(cleanKey.length<12)throw new Error('Ключ доступа должен быть не короче 12 символов');

    saveConfig(cleanUrl,cleanKey);
    return {url:cleanUrl,key:cleanKey};
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

  function urlCandidates(url){
    const clean=String(url||'').trim();
    const out=[clean];
    if(clean.includes('/webhook-test/')){
      const prod=clean.replace('/webhook-test/','/webhook/');
      if(prod!==clean)out.push(prod);
    }
    return [...new Set(out.filter(Boolean))];
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
    if(!cfg.url||!cfg.key){
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

    const candidates=urlCandidates(cfg.url);
    let lastNetworkError=null;
    let lastHttp=null;

    for(let i=0;i<candidates.length;i++){
      const url=candidates[i];
      const attempt=await postForm(url,form);

      if(attempt.networkError){
        lastNetworkError=attempt.networkError;
        continue;
      }

      const response=attempt.response;
      const text=attempt.text;

      if(!response.ok){
        if(response.status===401||response.status===403){
          throw new Error('n8n отклонил ключ доступа. Проверь ключ ИИ.');
        }
        lastHttp={status:response.status,text};
        if(i<candidates.length-1 && [404,405,410].includes(response.status))continue;
        throw new Error(`n8n вернул ошибку ${response.status}${text?`: ${text.slice(0,180)}`:''}`);
      }

      let data;
      try{data=text?JSON.parse(text):{};}catch(_){data={mainRequest:text};}
      if(data&&typeof data==='object'&&data.error)throw new Error(String(data.error));

      const result=normalize(data);
      if(!result.mainRequest)throw new Error('ИИ не вернул развёрнутый основной запрос');

      if(url!==cfg.url){
        saveConfig(url,cfg.key);
        cfg={url,key:cfg.key};
      }
      return result;
    }

    if(lastHttp)throw new Error(`n8n вернул ошибку ${lastHttp.status}${lastHttp.text?`: ${lastHttp.text.slice(0,180)}`:''}`);
    if(lastNetworkError)throw new Error('Не удалось связаться с n8n. Для опубликованного workflow используй Production URL (/webhook/), а не Test URL (/webhook-test/).');
    throw new Error('Не удалось связаться с n8n. Проверь URL webhook и доступность сервера.');
  }

  window.DiagnostikaRequestAI={generate,configure,clearConfig,getConfig,normalize};
})();
