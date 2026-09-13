'use strict';

(() => {
  if (window.DiagnostikaRequestAI) return;

  const TEST_URL='https://lugovoyn8n.ru/webhook-test/diagnostika-ai-request-v2';
  const ACCESS_KEY='diagnostika-ai-n8n-access-key';

  function getConfig(){
    return {url:TEST_URL,key:(localStorage.getItem(ACCESS_KEY)||'').trim()};
  }
  function saveConfig(_url,key){localStorage.setItem(ACCESS_KEY,String(key||'').trim());}
  function clearConfig(){localStorage.removeItem(ACCESS_KEY);}
  function configure(){
    const old=getConfig();
    const key=window.prompt('Введи ключ доступа, который указан в n8n:',old.key||'');
    if(key===null)return null;
    const cleanKey=String(key).trim();
    if(cleanKey.length<12)throw new Error('Ключ доступа должен быть не короче 12 символов');
    saveConfig(TEST_URL,cleanKey);
    return {url:TEST_URL,key:cleanKey};
  }

  function clampPriority(v){
    const n=Math.round(Number(v));
    return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;
  }
  function tryJson(value){
    if(typeof value!=='string')return value;
    const text=value.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'').trim();
    if(!text)return {};
    try{return JSON.parse(text);}catch(_){return value;}
  }
  function extractOpenAIText(obj){
    if(!obj||typeof obj!=='object')return '';
    if(typeof obj.output_text==='string'&&obj.output_text.trim())return obj.output_text.trim();
    let text='';
    if(Array.isArray(obj.output)){
      for(const item of obj.output){
        if(!Array.isArray(item?.content))continue;
        for(const part of item.content){
          if(part?.type==='output_text'&&part?.text)text+=String(part.text);
        }
      }
    }
    return text.trim();
  }
  function unwrap(out){
    out=tryJson(out);
    for(let i=0;i<6;i++){
      if(Array.isArray(out)){out=tryJson(out[0]??{});continue;}
      if(!out||typeof out!=='object')break;
      if(out.mainRequest||out.main_request||out.shortRequests||out.short_requests)break;
      const aiText=extractOpenAIText(out);
      if(aiText){const parsed=tryJson(aiText);if(parsed!==aiText){out=parsed;continue;}}
      if(out.body!==undefined){out=tryJson(out.body);continue;}
      if(out.data!==undefined){out=tryJson(out.data);continue;}
      if(out.result!==undefined){out=tryJson(out.result);continue;}
      if(out.response!==undefined){out=tryJson(out.response);continue;}
      if(out.json!==undefined){out=tryJson(out.json);continue;}
      break;
    }
    return out;
  }
  function normalizeShortRequests(out){
    const raw=Array.isArray(out?.shortRequests)?out.shortRequests:Array.isArray(out?.short_requests)?out.short_requests:Array.isArray(out?.alternatives)?out.alternatives:[];
    return raw.map((item,index)=>{
      if(typeof item==='string')return {title:item.trim(),priority:index===0?100:0};
      item=item&&typeof item==='object'?item:{};
      return {title:String(item.title||item.request||item.shortRequest||item.short_request||'').trim(),priority:clampPriority(item.priority??item.percent??item.probability??item.score)};
    }).filter(x=>x.title).sort((a,b)=>b.priority-a.priority).slice(0,4);
  }
  function normalizeStringArray(value){
    if(Array.isArray(value))return value.map(x=>typeof x==='string'?x:String(x?.text||x?.question||x?.name||'')).map(x=>x.trim()).filter(Boolean);
    const one=String(value||'').trim();
    return one?[one]:[];
  }
  function normalize(raw){
    let out=unwrap(raw);
    if(typeof out==='string')return {mainRequest:out.trim(),shortRequests:[],rationale:'',desiredResult:'',clarifyingQuestions:[],situations:[],_raw:raw};
    out=out&&typeof out==='object'?out:{};
    return {
      mainRequest:String(out.mainRequest||out.main_request||out.request||out.main||'').trim(),
      shortRequests:normalizeShortRequests(out),
      rationale:String(out.rationale||out.reasoning||out.analysis||out.explanation||'').trim(),
      desiredResult:String(out.desiredResult||out.desired_result||out.resultGoal||out.goal||'').trim(),
      clarifyingQuestions:normalizeStringArray(out.clarifyingQuestions||out.clarifying_questions||out.clarifyingQuestion||out.clarifying_question),
      situations:normalizeStringArray(out.situations||out.scenarios),
      _raw:raw,_unwrapped:out
    };
  }
  async function postForm(url,form){
    try{
      const response=await fetch(url,{method:'POST',body:form,cache:'no-store',credentials:'omit',redirect:'follow'});
      const text=await response.text();
      return {response,text,networkError:null};
    }catch(err){return {response:null,text:'',networkError:err};}
  }
  async function generate(payload){
    let cfg=getConfig();
    if(!cfg.key){cfg=configure();if(!cfg)throw new Error('Настройка ИИ отменена');}

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

    const attempt=await postForm(TEST_URL,form);
    if(attempt.networkError)throw new Error('Тестовый webhook n8n сейчас не слушает. Сначала нажми в n8n «Listen for test event», затем снова запусти анализ.');

    const response=attempt.response;
    const text=attempt.text;
    if(!response.ok){
      if(response.status===401||response.status===403)throw new Error('n8n отклонил ключ доступа. Проверь ключ ИИ.');
      throw new Error(`Test webhook вернул HTTP ${response.status}${text?`: ${text.slice(0,220)}`:''}`);
    }

    let data;
    try{data=text?JSON.parse(text):{};}catch(_){data=text;}
    if(data&&typeof data==='object'&&!Array.isArray(data)&&data.error)throw new Error(String(data.error));
    const result=normalize(data);
    if(!result.mainRequest){
      const shape=result._unwrapped&&typeof result._unwrapped==='object'?Object.keys(result._unwrapped).slice(0,12).join(', '):typeof result._unwrapped;
      throw new Error(`ИИ ответил, но mainRequest не найден. Поля ответа: ${shape||'пусто'}`);
    }
    return result;
  }

  window.DiagnostikaRequestAI={generate,configure,clearConfig,getConfig,normalize,testUrl:TEST_URL};
})();
