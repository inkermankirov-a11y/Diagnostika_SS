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

    const key=window.prompt('Введи ключ доступа, который укажем в n8n:',old.key||'');
    if(key===null)return null;
    const cleanKey=String(key).trim();
    if(cleanKey.length<12)throw new Error('Ключ доступа должен быть не короче 12 символов');

    saveConfig(cleanUrl,cleanKey);
    return {url:cleanUrl,key:cleanKey};
  }

  function normalize(out){
    if(typeof out==='string'){
      try{out=JSON.parse(out);}catch(_){return {mainRequest:out};}
    }
    out=out&&typeof out==='object'?out:{};
    const alternatives=Array.isArray(out.alternatives)?out.alternatives:[];
    return {
      mainRequest:String(out.mainRequest||out.main_request||'').trim(),
      analysis:String(out.analysis||out.mainDifficulty||out.main_difficulty||'').trim(),
      desiredResult:String(out.desiredResult||out.desired_result||'').trim(),
      clarifyingQuestion:String(out.clarifyingQuestion||out.clarifying_question||'').trim(),
      alternatives:alternatives.map(x=>String(x||'').trim()).filter(Boolean)
    };
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

    let response;
    try{
      response=await fetch(cfg.url,{
        method:'POST',
        body:form,
        cache:'no-store',
        credentials:'omit',
        redirect:'follow'
      });
    }catch(err){
      throw new Error('Не удалось связаться с n8n. Проверь URL webhook и доступность сервера.');
    }

    const text=await response.text();
    if(!response.ok){
      if(response.status===401||response.status===403)throw new Error('n8n отклонил ключ доступа. Проверь ключ ИИ.');
      throw new Error(`n8n вернул ошибку ${response.status}${text?`: ${text.slice(0,180)}`:''}`);
    }

    let data;
    try{data=text?JSON.parse(text):{};}catch(_){data={mainRequest:text};}
    if(data&&typeof data==='object'&&data.error)throw new Error(String(data.error));

    const result=normalize(data);
    if(!result.mainRequest)throw new Error('ИИ не вернул основной запрос');
    return result;
  }

  window.DiagnostikaRequestAI={
    generate,
    configure,
    clearConfig,
    getConfig
  };
})();
