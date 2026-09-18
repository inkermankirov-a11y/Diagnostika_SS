'use strict';

(() => {
  if(window.__diagnostikaFormIntegrationsReady) return;
  window.__diagnostikaFormIntegrationsReady=true;

  const DEFAULT_INBOX='https://lugovoyn8n.ru/webhook/diagnostika-forms-inbox';
  const DEFAULT_YANDEX='https://lugovoyn8n.ru/webhook/diagnostika-form-yandex';
  let config=null;
  let checking=false;

  const rand=(prefix='DSS')=>`${prefix}-${crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36)}`;
  const normalizePhone=v=>String(v||'').replace(/\D/g,'').replace(/^8(?=\d{10}$)/,'7');
  const clientsApi=()=>window.DiagnostikaClients
    || window.DiagnostikaPlatform?.clients
    || window.DiagnostikaPlatform?.services?.clients
    || null;

  function blankConfig(){
    return {
      version:1,
      specialistId:'',
      specialistName:'',
      accessKey:'',
      inboxUrl:DEFAULT_INBOX,
      yandex:{enabled:true,intakeUrl:DEFAULT_YANDEX,formKey:''},
      google:{enabled:false,intakeUrl:'',formKey:''}
    };
  }

  function mergeConfig(v){
    const d=blankConfig();v=v||{};
    return {
      ...d,
      ...v,
      inboxUrl:DEFAULT_INBOX,
      yandex:{...d.yandex,...(v.yandex||{}),intakeUrl:DEFAULT_YANDEX},
      google:{...d.google,...(v.google||{})}
    };
  }

  function getClientByPhone(phone){
    const p=normalizePhone(phone);if(!p)return null;
    try{return (clientsApi()?.list?.()||[]).find(c=>normalizePhone(c.phone)===p)||null;}catch(_){return null;}
  }

  function allQuestionnaireIds(){
    const set=new Set();
    try{for(const c of clientsApi()?.list?.()||[])for(const q of c.questionnaires||[])if(q?.externalId)set.add(String(q.externalId));}catch(_){}
    return set;
  }

  function answerBy(answers,needles){
    answers=answers&&typeof answers==='object'?answers:{};
    const keys=Object.keys(answers);
    for(const n of needles){
      const k=keys.find(x=>String(x).toLowerCase().includes(n));
      if(k){const v=answers[k];return Array.isArray(v)?v.join(', '):String(v??'').trim();}
    }
    return '';
  }

  function normalizedProfile(sub){
    const a=sub.answers&&typeof sub.answers==='object'?sub.answers:{};
    const p=sub.profile&&typeof sub.profile==='object'?sub.profile:{};
    return {
      name:String(p.name||answerBy(a,['как к вам обращаться','имя','фио'])).trim(),
      phone:String(p.phone||answerBy(a,['номер телефона','телефон'])).trim(),
      email:String(p.email||answerBy(a,['e-mail','email','электронн'])).trim(),
      city:String(p.city||answerBy(a,['город'])).trim(),
      age:String(p.age||answerBy(a,['ваш возраст','возраст'])).trim(),
      country:String(p.country||answerBy(a,['страна'])).trim(),
      gender:String(p.gender||answerBy(a,['пол'])).trim(),
      contactMethod:String(p.contactMethod||answerBy(a,['как с вами удобнее связаться','удобнее связаться','способ связи'])).trim(),
      vk:String(p.vk||'').trim(),telegram:String(p.telegram||'').trim(),max:String(p.max||'').trim()
    };
  }

  function applyContactMethod(c,p){
    c.preferredContact=p.contactMethod||c.preferredContact||'';
  }

  function newClientFromProfile(p){
    const c=typeof newClient==='function'?newClient():{id:(crypto.randomUUID?crypto.randomUUID():Date.now()+''),name:'Новый клиент',city:'',age:'',birth:'',photoData:'',vk:'',telegram:'',max:'',sessions:[],requests:[]};
    c.name=p.name||'Новый клиент';
    c.phone=p.phone||'';c.email=p.email||'';c.city=p.city||'';c.age=p.age||'';c.country=p.country||'';
    if(['Мужской','Женский'].includes(p.gender))c.gender=p.gender;
    c.vk=p.vk||'';c.telegram=p.telegram||'';c.max=p.max||'';
    c.questionnaires=[];
    applyContactMethod(c,p);
    return c;
  }

  function questionnaireFromSubmission(sub,index=0){
    const p=normalizedProfile(sub);
    return {
      id:String(sub.id||sub.externalId||crypto.randomUUID?.()||Date.now()+'-'+index),
      externalId:String(sub.externalId||sub.id||''),
      source:String(sub.source||'yandex').toLowerCase(),
      receivedAt:sub.receivedAt||new Date().toISOString(),
      profile:p,
      answers:(sub.answers&&typeof sub.answers==='object')?JSON.parse(JSON.stringify(sub.answers)):{},
      raw:sub.raw??null,
      isPrimary:false,
      editedAt:null
    };
  }

  function importSubmissions(list){
    if(!Array.isArray(list)||!list.length)return {imported:0,newClients:0,attached:0,skipped:0,names:[]};
    const known=allQuestionnaireIds();
    let imported=0,newClients=0,attached=0,skipped=0;const names=[];
    for(let i=0;i<list.length;i++){
      const sub=list[i]||{};
      const ext=String(sub.externalId||sub.id||'');
      if(ext&&known.has(ext)){skipped++;continue;}
      const q=questionnaireFromSubmission(sub,i);const p=q.profile;
      let c=getClientByPhone(p.phone);
      if(!c){
        const seed=newClientFromProfile(p);
        q.isPrimary=true;
        seed.questionnaires=[q];
        seed.lastQuestionnaireAt=q.receivedAt;
        seed.lastQuestionnaireSource=q.source;
        c=clientsApi()?.create?.(seed,{source:'form-integration-import',select:false,render:false})||null;
        if(!c){skipped++;continue;}
        newClients++;
      }else{
        attached++;
        if(!Array.isArray(c.questionnaires))c.questionnaires=[];
        if(!c.questionnaires.length)q.isPrimary=true;
        c.questionnaires.push(q);
        c.lastQuestionnaireAt=q.receivedAt;
        c.lastQuestionnaireSource=q.source;
      }
      if(ext)known.add(ext);
      imported++;names.push(c.name||p.name||'Новый клиент');
    }
    if(imported){
      if(typeof save==='function')save();
      if(typeof renderClient==='function')renderClient();
      window.dispatchEvent(new CustomEvent('diagnostika:questionnairesImported',{detail:{imported,newClients,attached}}));
    }
    return {imported,newClients,attached,skipped,names};
  }

  function toast(text){
    let el=document.getElementById('formIntegrationToast');
    if(!el){
      el=document.createElement('div');el.id='formIntegrationToast';
      Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:'99999',background:'#172033',color:'#fff',padding:'12px 15px',borderRadius:'10px',boxShadow:'0 10px 28px rgba(0,0,0,.28)',font:'600 14px system-ui',maxWidth:'360px',opacity:'0',transition:'opacity .2s'});
      document.body.appendChild(el);
    }
    el.textContent=text;el.style.opacity='1';clearTimeout(el._t);el._t=setTimeout(()=>el.style.opacity='0',3500);
  }

  async function checkInbox({silent=false}={}){
    if(checking)return {imported:0};
    config=mergeConfig(config||await window.DiagnostikaIntegrationStorage?.load?.());
    if(!config.specialistId||!config.accessKey){
      if(!silent)throw new Error('Сначала настрой интеграцию анкет: ID специалиста и ключ.');
      return {imported:0};
    }
    checking=true;
    try{
      const r=await fetch(DEFAULT_INBOX,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({specialistId:config.specialistId,accessKey:config.accessKey})});
      const text=await r.text();let data={};try{data=text?JSON.parse(text):{};}catch(_){data={raw:text};}
      if(!r.ok)throw new Error(data?.error||`Сервис анкет вернул HTTP ${r.status}`);
      const list=Array.isArray(data)?data:(Array.isArray(data.submissions)?data.submissions:[]);
      const result=importSubmissions(list);
      if(result.imported)toast(silent?`Новые анкеты: ${result.imported}`:`Получено анкет: ${result.imported}. Новых клиентов: ${result.newClients}.`);
      return result;
    }finally{checking=false;}
  }

  const dlg=document.createElement('dialog');dlg.id='formIntegrationsDialog';dlg.className='form-integrations-dialog';
  dlg.innerHTML=`<div class="fi-card"><div class="fi-title">ИНТЕГРАЦИИ АНКЕТ</div>
    <div class="fi-grid">
      <label><span>ID специалиста</span><div class="fi-inline"><input id="fiSpecialistId"><button type="button" id="fiGenId">Создать</button></div></label>
      <label><span>Имя специалиста</span><input id="fiSpecialistName"></label>
      <label><span>Ключ программы ↔ n8n</span><div class="fi-inline"><input id="fiAccessKey" type="password"><button type="button" id="fiGenAccess">Новый ключ</button></div></label>
      <label class="fi-wide"><span>URL получения анкет из n8n</span><input id="fiInboxUrl" readonly></label>
    </div>
    <div class="fi-source"><div class="fi-source-head"><strong>Яндекс Формы</strong><label class="fi-switch"><input id="fiYandexEnabled" type="checkbox"> включено</label></div>
      <label><span>Ключ Яндекс Формы</span><div class="fi-inline"><input id="fiYandexKey" type="password"><button type="button" id="fiGenYandex">Новый ключ</button></div></label>
      <label><span>Webhook для Яндекс Формы</span><input id="fiYandexUrl" readonly></label>
    </div>
    <div class="fi-source fi-muted"><div class="fi-source-head"><strong>Google Forms</strong><span>подключим следующим этапом</span></div></div>
    <div id="fiStatus" class="fi-status"></div>
    <div class="fi-actions"><button type="button" id="fiCheck">Проверить анкеты сейчас</button><span></span><button type="button" id="fiClose">Закрыть</button><button type="button" id="fiSave" class="primary">Сохранить</button></div>
  </div>`;
  document.body.appendChild(dlg);

  const style=document.createElement('style');style.textContent=`
    .form-integrations-dialog{border:0;background:transparent;padding:0;width:min(820px,96vw);max-width:none}.form-integrations-dialog::backdrop{background:rgba(15,23,42,.5)}
    .fi-card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.35);font-family:system-ui;color:#172033}.fi-title{font-weight:900;font-size:19px;margin-bottom:16px}
    .fi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fi-grid label,.fi-source>label{display:grid;gap:6px;font-size:12px;font-weight:800}.fi-grid input,.fi-source input{height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px;font-size:14px}.fi-wide{grid-column:1/-1}.fi-inline{display:grid;grid-template-columns:1fr auto;gap:7px}.fi-inline button,.fi-actions button{border:1px solid #cbd5e1;background:#f8fafc;border-radius:9px;padding:0 12px;font-weight:800;cursor:pointer}.fi-source{margin-top:16px;padding:14px;border:1px solid #dbe3ed;border-radius:12px;display:grid;gap:10px}.fi-source-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.fi-muted{opacity:.55}.fi-status{min-height:24px;margin-top:12px;font-size:13px}.fi-actions{display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;margin-top:10px}.fi-actions button{height:40px}.fi-actions .primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.fi-switch{font-size:13px;font-weight:600}@media(max-width:650px){.fi-grid{grid-template-columns:1fr}.fi-wide{grid-column:auto}.fi-actions{grid-template-columns:1fr 1fr}.fi-actions span{display:none}}
  `;document.head.appendChild(style);

  const q=id=>document.getElementById(id);
  function fillDialog(){
    config=mergeConfig(config);
    q('fiSpecialistId').value=config.specialistId||'';
    q('fiSpecialistName').value=config.specialistName||'';
    q('fiAccessKey').value=config.accessKey||'';
    q('fiInboxUrl').value=DEFAULT_INBOX;
    q('fiYandexEnabled').checked=config.yandex.enabled!==false;
    q('fiYandexKey').value=config.yandex.formKey||'';
    q('fiYandexUrl').value=DEFAULT_YANDEX;
    q('fiStatus').textContent='';
  }
  function collect(){
    return mergeConfig({specialistId:q('fiSpecialistId').value.trim(),specialistName:q('fiSpecialistName').value.trim(),accessKey:q('fiAccessKey').value.trim(),inboxUrl:DEFAULT_INBOX,yandex:{enabled:q('fiYandexEnabled').checked,formKey:q('fiYandexKey').value.trim(),intakeUrl:DEFAULT_YANDEX},google:config?.google||{enabled:false}});
  }
  async function openDialog(){config=mergeConfig(await window.DiagnostikaIntegrationStorage?.load?.());fillDialog();dlg.showModal();}

  q('fiGenId').onclick=()=>{q('fiSpecialistId').value='sp-'+(crypto.randomUUID?crypto.randomUUID().slice(0,12):Math.random().toString(36).slice(2,14));};
  q('fiGenAccess').onclick=()=>q('fiAccessKey').value=rand('DSS');q('fiGenYandex').onclick=()=>q('fiYandexKey').value=rand('YF');
  q('fiClose').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
  q('fiSave').onclick=async()=>{
    const next=collect();if(!next.specialistId)return q('fiStatus').textContent='Укажи ID специалиста.';if(!next.accessKey)return q('fiStatus').textContent='Создай ключ программы ↔ n8n.';if(next.yandex.enabled&&!next.yandex.formKey)return q('fiStatus').textContent='Создай ключ Яндекс Формы.';
    q('fiSave').disabled=true;q('fiStatus').textContent='Сохраняю…';
    try{const res=await window.DiagnostikaIntegrationStorage.save(next,{folder:true,requestFolder:true});config=mergeConfig(res.config);q('fiStatus').textContent=res.folderSaved?'Сохранено в браузере и подключённой папке (Diagnostika/integrations.json).':`Сохранено в браузере.${res.folderError?' Папка: '+res.folderError:''}`;}
    catch(e){q('fiStatus').textContent=e?.message||'Ошибка сохранения';}finally{q('fiSave').disabled=false;}
  };
  q('fiCheck').onclick=async()=>{config=collect();q('fiCheck').disabled=true;q('fiStatus').textContent='Проверяю очередь анкет…';try{const r=await checkInbox({silent:false});q('fiStatus').textContent=r.imported?`Получено новых: ${r.imported}. Новых клиентов: ${r.newClients}. Добавлено к существующим: ${r.attached}.`:'Анкет не найдено.';}catch(e){q('fiStatus').textContent=e?.message||'Не удалось получить анкеты.';}finally{q('fiCheck').disabled=false;}};

  function attachSettingsButton(){
    const panel=document.getElementById('settingsPanel');
    if(!panel||panel.querySelector('#formIntegrationsBtn'))return;
    const b=document.createElement('button');
    b.id='formIntegrationsBtn';
    b.type='button';
    b.className='header-btn';
    b.textContent='Анкеты / формы';
    b.style.cssText='background:#6d5d91;color:#fff;width:100%;height:42px';
    b.onclick=openDialog;
    const storageBtn=panel.querySelector('#storageBtn');
    if(storageBtn) storageBtn.insertAdjacentElement('afterend',b);
    else panel.prepend(b);
  }

  window.DiagnostikaForms={openSettings:openDialog,checkInbox,importSubmissions,getConfig:()=>config};
  (async()=>{
    config=mergeConfig(await window.DiagnostikaIntegrationStorage?.load?.());
    try{
      const storage=window.DiagnostikaIntegrationStorage;
      const local=storage?.readLocal?.();
      if(local&&typeof local==='object'){
        local.inboxUrl=DEFAULT_INBOX;
        local.yandex={...(local.yandex||{}),intakeUrl:DEFAULT_YANDEX};
        storage.writeLocal?.(local);
      }
      localStorage.removeItem('diagnostika-yandex-form-mode-v1');
    }catch(_){}
    attachSettingsButton();
    const host=String(location?.hostname||'').toLowerCase();
    const allowBackgroundInboxPolling=!['127.0.0.1','localhost','::1'].includes(host);
    if(allowBackgroundInboxPolling){
      setTimeout(()=>checkInbox({silent:true}).catch(()=>{}),2500);
      setInterval(()=>checkInbox({silent:true}).catch(()=>{}),120000);
    }
  })();
})();
