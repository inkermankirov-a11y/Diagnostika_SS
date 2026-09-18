'use strict';

(() => {
  if (window.__diagnostikaAiSettingsButtonReady) return;
  window.__diagnostikaAiSettingsButtonReady = true;

  function loadOnce(src, attr, readyFlag){
    if(window[readyFlag]) return null;
    if(document.querySelector(`script[${attr}]`)) return null;
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(attr,'1');
    document.body.appendChild(s);
    return s;
  }

  function attach(){
    const dlg=document.getElementById('freeConsultationDialog');
    if(!dlg) return;
    const left=dlg.querySelector('.fc-actions-left');
    if(!left || left.querySelector('.fc-ai-settings')) return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='tk-btn fc-ai-settings';
    btn.textContent='⚙ Настройки ИИ';
    btn.title='Изменить ключ доступа ИИ';
    btn.onclick=()=>{
      try{
        const cfg=window.DiagnostikaRequestAI?.configure?.();
        if(cfg){
          const st=dlg.querySelector('.fc-status');
          if(st){
            st.textContent='Настройки ИИ сохранены';
            setTimeout(()=>{if(st.textContent==='Настройки ИИ сохранены')st.textContent='';},1800);
          }
        }
      }catch(err){
        alert(err?.message||'Не удалось сохранить настройки ИИ');
      }
    };
    left.appendChild(btn);
  }

  function attachQuestionnairePanel(){
    if(window.__freeConsultationQuestionnairePanelReady) return;
    const dlg=document.getElementById('freeConsultationDialog');
    const win=dlg?.querySelector('.fc-window');
    const head=dlg?.querySelector('.fc-head');
    const intro=dlg?.querySelector('.fc-intro');
    const grid=dlg?.querySelector('.fc-grid');
    const actions=dlg?.querySelector('.fc-actions');
    if(!dlg||!win||!head||!intro||!grid||!actions) return;
    window.__freeConsultationQuestionnairePanelReady=true;

    const style=document.createElement('style');
    style.textContent=`
      #freeConsultationDialog .fc-window.fcq-enhanced{width:min(1480px,calc(100vw - 28px));max-height:94vh;overflow:hidden;display:flex;flex-direction:column}
      #freeConsultationDialog .fcq-body{display:grid;grid-template-columns:370px minmax(0,1fr);gap:14px;min-height:0;flex:1}
      #freeConsultationDialog .fcq-main{min-width:0;min-height:0;overflow:auto;padding-left:4px}
      #freeConsultationDialog .fcq-panel{min-width:0;min-height:0;border:1px solid #d5e0eb;border-radius:12px;background:#fff;display:flex;flex-direction:column;overflow:hidden}
      #freeConsultationDialog .fcq-panel-head{display:flex;align-items:flex-start;gap:8px;padding:12px 12px 10px;border-bottom:1px solid #e2e8f0;background:#f7faff}
      #freeConsultationDialog .fcq-panel-title{font-size:15px;font-weight:900;color:#263d58;line-height:1.25}
      #freeConsultationDialog .fcq-panel-meta{font-size:11px;color:#71839a;margin-top:3px;line-height:1.35}
      #freeConsultationDialog .fcq-panel-spacer{flex:1}
      #freeConsultationDialog .fcq-hide{height:30px!important;padding:0 9px!important;font-size:12px!important;white-space:nowrap}
      #freeConsultationDialog .fcq-selector-wrap{padding:10px 12px;border-bottom:1px solid #edf1f5;background:#fff}
      #freeConsultationDialog .fcq-selector-label{display:block;font-size:11px;font-weight:900;color:#c23d70;margin-bottom:5px}
      #freeConsultationDialog .fcq-selector{width:100%;box-sizing:border-box;border:1px solid #cbd7e3;border-radius:8px;background:#fff;padding:7px 8px;font:600 12px 'Segoe UI',Arial,sans-serif;color:#31465f}
      #freeConsultationDialog .fcq-panel-body{min-height:0;overflow:auto;padding:10px 12px 14px;display:grid;align-content:start;gap:9px}
      #freeConsultationDialog .fcq-answer{border:1px solid #cfe8d9;border-radius:9px;background:#f4fbf7;padding:9px 10px}
      #freeConsultationDialog .fcq-question{font-size:11px;font-weight:900;line-height:1.35;color:#c23d70;margin-bottom:5px}
      #freeConsultationDialog .fcq-value{font-size:13px;font-weight:700;line-height:1.5;color:#167a45;white-space:pre-wrap;overflow-wrap:anywhere}
      #freeConsultationDialog .fcq-empty{padding:18px 8px;text-align:center;color:#7a8b9f;font-size:12px;line-height:1.45}
      #freeConsultationDialog .fcq-show{display:none;height:34px!important;padding:0 10px!important;margin-left:auto;white-space:nowrap;font-size:12px!important}
      #freeConsultationDialog.fcq-collapsed .fcq-body,#freeConsultationDialog.fcq-no-questionnaire .fcq-body{grid-template-columns:minmax(0,1fr)}
      #freeConsultationDialog.fcq-collapsed .fcq-panel,#freeConsultationDialog.fcq-no-questionnaire .fcq-panel{display:none}
      #freeConsultationDialog.fcq-collapsed.fcq-has-questionnaire .fcq-show{display:inline-flex}
      @media(max-width:1050px){
        #freeConsultationDialog .fc-window.fcq-enhanced{width:min(1040px,calc(100vw - 20px));position:relative}
        #freeConsultationDialog .fcq-body{grid-template-columns:minmax(0,1fr)}
        #freeConsultationDialog .fcq-panel{position:absolute;top:70px;left:18px;right:auto;bottom:18px;width:min(390px,calc(100vw - 36px));z-index:4;box-shadow:0 18px 55px rgba(15,23,42,.22)}
        #freeConsultationDialog.fcq-has-questionnaire .fcq-show{display:inline-flex}
        #freeConsultationDialog:not(.fcq-collapsed).fcq-has-questionnaire .fcq-show{display:none}
      }
      @media(max-width:720px){#freeConsultationDialog .fcq-panel{top:62px;left:10px;right:auto;bottom:10px;width:calc(100vw - 40px)}}
    `;
    document.head.appendChild(style);

    win.classList.add('fcq-enhanced');
    const main=document.createElement('div');
    main.className='fcq-main';
    const body=document.createElement('div');
    body.className='fcq-body';
    const panel=document.createElement('aside');
    panel.className='fcq-panel';
    panel.innerHTML=`<div class="fcq-panel-head"><div><div class="fcq-panel-title">АНКЕТА КЛИЕНТА</div><div class="fcq-panel-meta"></div></div><span class="fcq-panel-spacer"></span><button type="button" class="tk-btn fcq-hide">Скрыть</button></div><div class="fcq-selector-wrap"><span class="fcq-selector-label">Анкета</span><select class="fcq-selector"></select></div><div class="fcq-panel-body"></div>`;
    main.append(intro,grid,actions);
    body.append(panel,main);
    win.appendChild(body);

    const showBtn=document.createElement('button');
    showBtn.type='button';
    showBtn.className='tk-btn fcq-show';
    showBtn.textContent='📋 Анкета клиента';
    const closeBtn=head.querySelector('.fc-close');
    if(closeBtn) head.insertBefore(showBtn,closeBtn); else head.appendChild(showBtn);

    const meta=panel.querySelector('.fcq-panel-meta');
    const selectorWrap=panel.querySelector('.fcq-selector-wrap');
    const selector=panel.querySelector('.fcq-selector');
    const panelBody=panel.querySelector('.fcq-panel-body');
    let selectedId='';
    let lastClientId='';

    function getClient(){
      try{const c=typeof client==='function'?client():null;if(c)return c;}catch(_){}
      try{return state?.clients?.find(c=>String(c.id)===String(clientId))||null;}catch(_){return null;}
    }
    function fmtDate(value){
      if(!value)return 'без даты';
      try{return new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return String(value);}
    }
    function sourceLabel(value){const s=String(value||'').toLowerCase();return s==='google'?'Google Forms':s==='manual'?'Ручная анкета':'Яндекс Форма';}
    function questionnaires(c){return Array.isArray(c?.questionnaires)?c.questionnaires.filter(Boolean):[];}
    function sorted(list){return [...list].sort((a,b)=>{if(!!a.isPrimary!==!!b.isPrimary)return a.isPrimary?-1:1;return Date.parse(b.receivedAt||0)-Date.parse(a.receivedAt||0);});}
    function answerText(value){
      if(Array.isArray(value))return value.map(v=>String(v??'').trim()).filter(Boolean).join(', ');
      if(value&&typeof value==='object'){try{return JSON.stringify(value,null,2);}catch(_){return String(value);}}
      return String(value??'').trim();
    }
    function answerItems(q){
      if(String(q?.source||'').toLowerCase()==='manual'&&Array.isArray(q.answerItems))return q.answerItems.map(item=>({question:String(item?.question||'').trim(),answer:answerText(item?.answer)})).filter(x=>x.question&&x.answer);
      const answers=q?.answers&&typeof q.answers==='object'&&!Array.isArray(q.answers)?q.answers:{};
      return Object.entries(answers).map(([question,answer])=>({question:String(question||'').trim(),answer:answerText(answer)})).filter(x=>x.question&&x.answer);
    }
    function renderSelected(list){
      const q=list.find(x=>String(x.id)===String(selectedId))||list[0]||null;
      if(!q)return;
      selectedId=String(q.id||'');
      selector.value=selectedId;
      meta.textContent=`${q.isPrimary?'★ Основная · ':''}${sourceLabel(q.source)} · ${fmtDate(q.receivedAt)}`;
      const items=answerItems(q);
      panelBody.innerHTML='';
      if(!items.length){panelBody.innerHTML='<div class="fcq-empty">В этой анкете нет заполненных ответов.</div>';return;}
      items.forEach(item=>{
        const card=document.createElement('div');card.className='fcq-answer';
        const question=document.createElement('div');question.className='fcq-question';question.textContent=item.question;
        const value=document.createElement('div');value.className='fcq-value';value.textContent=item.answer;
        card.append(question,value);panelBody.appendChild(card);
      });
    }
    function render(){
      const c=getClient();const cid=String(c?.id||'');
      if(cid!==lastClientId){selectedId='';lastClientId=cid;}
      const list=sorted(questionnaires(c));
      dlg.classList.toggle('fcq-has-questionnaire',list.length>0);
      dlg.classList.toggle('fcq-no-questionnaire',list.length===0);
      if(!list.length){selectorWrap.style.display='none';meta.textContent='';panelBody.innerHTML='<div class="fcq-empty">У клиента пока нет анкеты.</div>';return;}
      selectorWrap.style.display=list.length>1?'block':'none';
      if(!selectedId||!list.some(x=>String(x.id)===String(selectedId)))selectedId=String((list.find(x=>x.isPrimary)||list[0])?.id||'');
      selector.innerHTML='';
      list.forEach((q,index)=>{const o=document.createElement('option');o.value=String(q.id||'');o.textContent=`${q.isPrimary?'★ Основная · ':''}${sourceLabel(q.source)} · ${fmtDate(q.receivedAt)}`||`Анкета ${index+1}`;selector.appendChild(o);});
      renderSelected(list);
    }

    selector.addEventListener('change',()=>{selectedId=selector.value;renderSelected(sorted(questionnaires(getClient())));});
    panel.querySelector('.fcq-hide').onclick=()=>dlg.classList.add('fcq-collapsed');
    showBtn.onclick=()=>{dlg.classList.remove('fcq-collapsed');render();};
    new MutationObserver(()=>{if(dlg.hasAttribute('open')){dlg.classList.remove('fcq-collapsed');setTimeout(render,0);}}).observe(dlg,{attributes:true,attributeFilter:['open']});
    window.DiagnostikaFreeConsultationQuestionnairePanel={refresh:render};
  }

  function loadQuestionnaireIntegrations(){
    if(window.__diagnostikaStableFormLoaderStarted) return;
    window.__diagnostikaStableFormLoaderStarted=true;

    const storage=loadOnce('integration-folder-storage.js?v=20260913-142','data-integration-folder-storage','__diagnostikaIntegrationStorageReady');
    const loadCore=()=>{
      const core=loadOnce('form-integrations.js?v=20260918-ai6a','data-form-integrations','__diagnostikaFormIntegrationsReady');
      const loadHelpers=()=>{
        loadOnce('form-integrations-copy-fix.js?v=20260913-142','data-form-integrations-copy-fix','__formIntegrationsCopyFixReady');
        loadOnce('form-integrations-inbox-fix.js?v=20260913-142','data-form-integrations-inbox-fix','__formIntegrationsInboxFixReady');
        loadOnce('form-integrations-lock.js?v=20260913-142','data-form-integrations-lock','__formIntegrationsLockReady');
        const questionnaires=loadOnce('client-questionnaires.js?v=20260918-clients2c2','data-client-questionnaires','__diagnostikaClientQuestionnairesReady');
        const loadManualTemplate=()=>loadOnce('manual-questionnaire-template.js?v=20260913-142','data-manual-questionnaire-template','__diagnostikaManualQuestionnaireTemplateReady');
        if(questionnaires) questionnaires.addEventListener('load',loadManualTemplate,{once:true}); else loadManualTemplate();
      };
      if(core) core.addEventListener('load',loadHelpers,{once:true}); else loadHelpers();
    };
    if(storage) storage.addEventListener('load',loadCore,{once:true}); else loadCore();
  }

  loadOnce('free-consultation-archive.js?v=20260913-142','data-fc-archive','__freeConsultationArchiveReady');
  loadOnce('free-consultation-extra-fields.js?v=20260913-142','data-fc-extra-fields','__freeConsultationExtraFieldsReady');
  attach();
  attachQuestionnairePanel();

  if(document.readyState==='complete') loadQuestionnaireIntegrations();
  else window.addEventListener('load',loadQuestionnaireIntegrations,{once:true});
})();
