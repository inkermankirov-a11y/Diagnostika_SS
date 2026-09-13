'use strict';

(() => {
  if(window.__diagnostikaClientQuestionnairesReady) return;
  window.__diagnostikaClientQuestionnairesReady=true;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const labelSource=s=>String(s||'').toLowerCase()==='google'?'Google Forms':'Яндекс Форма';
  let selectedId=null;
  let noticeTimer=null;

  function currentClient(){try{return typeof client==='function'?client():null;}catch(_){return null;}}
  function arr(c){return Array.isArray(c?.questionnaires)?c.questionnaires:[];}
  function fmtDate(v){try{return new Date(v).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return String(v||'');}}

  const dlg=document.createElement('dialog');dlg.id='clientQuestionnairesDialog';dlg.className='cq-dialog';
  dlg.innerHTML=`<div class="cq-card"><div class="cq-head"><div><div class="cq-title">АНКЕТЫ КЛИЕНТА</div><div id="cqClientName" class="cq-sub"></div></div><button id="cqClose" type="button">✕</button></div><div id="cqNotice" class="cq-notice" aria-live="polite"></div><div class="cq-layout"><div id="cqList" class="cq-list"></div><div id="cqEditor" class="cq-editor"></div></div></div>`;
  document.body.appendChild(dlg);
  const style=document.createElement('style');style.textContent=`
    .cq-dialog{border:0;background:transparent;padding:0;width:min(1100px,97vw);max-width:none}.cq-dialog::backdrop{background:rgba(15,23,42,.55)}.cq-card{background:#fff;border-radius:16px;box-shadow:0 26px 80px rgba(15,23,42,.38);padding:18px;font-family:system-ui;color:#172033}.cq-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px}.cq-title{font-size:19px;font-weight:900}.cq-sub{font-size:13px;color:#64748b;margin-top:3px}.cq-head button{border:0;background:transparent;font-size:22px;cursor:pointer}.cq-notice{min-height:0;margin-top:0;padding:0;border-radius:9px;font-size:13px;font-weight:800;transition:.15s}.cq-notice.show{min-height:20px;margin-top:10px;padding:8px 10px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0}.cq-layout{display:grid;grid-template-columns:310px 1fr;gap:14px;min-height:520px;margin-top:14px}.cq-list{border-right:1px solid #e2e8f0;padding-right:12px;display:grid;gap:8px;align-content:start;max-height:70vh;overflow:auto}.cq-item{border:1px solid #d8e0ea;border-radius:11px;padding:10px;background:#fff;cursor:pointer;text-align:left}.cq-item.active{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.12)}.cq-item .top{display:flex;justify-content:space-between;gap:8px;font-weight:900}.cq-badge{font-size:11px;border-radius:999px;padding:3px 7px;background:#eef2ff;color:#4338ca}.cq-date{font-size:12px;color:#64748b;margin-top:5px}.cq-primary{font-size:11px;color:#166534;font-weight:800;margin-top:5px}.cq-editor{max-height:70vh;overflow:auto;padding-right:4px}.cq-empty{padding:28px;color:#64748b;text-align:center}.cq-meta{display:flex;gap:8px;align-items:center;margin-bottom:12px}.cq-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cq-grid label,.cq-answer{display:grid;gap:5px;font-size:12px;font-weight:800}.cq-grid input,.cq-answer textarea{border:1px solid #cbd5e1;border-radius:9px;padding:9px;font:14px system-ui}.cq-answer textarea{min-height:74px;resize:vertical}.cq-answer{margin-top:10px}.cq-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.cq-actions button{height:40px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;padding:0 12px;font-weight:800;cursor:pointer}.cq-actions .primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8}.cq-actions .danger{color:#b91c1c}.cq-source-yandex{background:#fff1d6;color:#8a4b00}.cq-source-google{background:#e8f3ff;color:#175ca8}@media(max-width:760px){.cq-layout{grid-template-columns:1fr}.cq-list{border-right:0;border-bottom:1px solid #e2e8f0;padding-right:0;padding-bottom:10px;max-height:220px}.cq-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(style);

  const q=id=>document.getElementById(id);
  function showNotice(text){
    const el=q('cqNotice');if(!el)return;
    clearTimeout(noticeTimer);el.textContent=text||'';el.classList.toggle('show',!!text);
    if(text) noticeTimer=setTimeout(()=>{el.textContent='';el.classList.remove('show');},2600);
  }

  function renderList(){
    const c=currentClient();const root=q('cqList');if(!c){root.innerHTML='';return;}const list=arr(c);if(!list.length){root.innerHTML='<div class="cq-empty">Анкет пока нет.</div>';return;}if(!selectedId||!list.some(x=>String(x.id)===String(selectedId)))selectedId=String((list.find(x=>x.isPrimary)||list[list.length-1]).id);
    root.innerHTML=list.slice().sort((a,b)=>Date.parse(b.receivedAt||0)-Date.parse(a.receivedAt||0)).map(x=>`<button type="button" class="cq-item ${String(x.id)===String(selectedId)?'active':''}" data-id="${esc(x.id)}"><div class="top"><span>${esc(labelSource(x.source))}</span><span class="cq-badge ${x.source==='google'?'cq-source-google':'cq-source-yandex'}">${x.source==='google'?'Google':'Яндекс'}</span></div><div class="cq-date">${esc(fmtDate(x.receivedAt))}</div>${x.isPrimary?'<div class="cq-primary">★ Основная анкета</div>':''}</button>`).join('');
    root.querySelectorAll('.cq-item').forEach(b=>b.onclick=()=>{selectedId=b.dataset.id;renderList();renderEditor();showNotice('');});
  }

  function selected(){const c=currentClient();return arr(c).find(x=>String(x.id)===String(selectedId))||null;}
  function renderEditor(){
    const c=currentClient(),x=selected(),root=q('cqEditor');if(!c||!x){root.innerHTML='<div class="cq-empty">Выбери анкету слева.</div>';return;}const p=x.profile||{};const answers=x.answers&&typeof x.answers==='object'?x.answers:{};
    root.innerHTML=`<div class="cq-meta"><span class="cq-badge ${x.source==='google'?'cq-source-google':'cq-source-yandex'}">${esc(labelSource(x.source))}</span><span>${esc(fmtDate(x.receivedAt))}</span>${x.isPrimary?'<strong>★ Основная</strong>':''}</div>
      <div class="cq-grid"><label>Имя<input data-profile="name" value="${esc(p.name||'')}"></label><label>Телефон<input data-profile="phone" value="${esc(p.phone||'')}"></label><label>Город<input data-profile="city" value="${esc(p.city||'')}"></label><label>Возраст<input data-profile="age" value="${esc(p.age||'')}"></label><label>E-mail<input data-profile="email" value="${esc(p.email||'')}"></label><label>Удобный способ связи<input data-profile="contactMethod" value="${esc(p.contactMethod||'')}"></label></div>
      <div class="cq-answers">${Object.entries(answers).map(([k,v])=>`<label class="cq-answer"><span>${esc(k)}</span><textarea data-answer-key="${esc(k)}">${esc(Array.isArray(v)?v.join(', '):v)}</textarea></label>`).join('')||'<div class="cq-empty">Исходные ответы отсутствуют.</div>'}</div>
      <div class="cq-actions"><button type="button" class="cq-save">Сохранить изменения</button><button type="button" class="cq-primary-btn primary">Сделать основной и обновить данные клиента</button><button type="button" class="cq-delete danger">Удалить анкету</button></div>`;
    root.querySelector('.cq-save').onclick=saveEdited;root.querySelector('.cq-primary-btn').onclick=makePrimary;root.querySelector('.cq-delete').onclick=deleteSelected;
  }

  function writeEditorTo(x){
    if(!x)return false;
    const root=q('cqEditor');if(!root)return false;
    x.profile=x.profile||{};
    root.querySelectorAll('[data-profile]').forEach(el=>x.profile[el.dataset.profile]=el.value.trim());
    x.answers=x.answers||{};
    root.querySelectorAll('[data-answer-key]').forEach(el=>x.answers[el.dataset.answerKey]=el.value);
    x.editedAt=new Date().toISOString();
    return true;
  }

  function saveEdited(){
    const x=selected();if(!x||!writeEditorTo(x))return;
    if(typeof save==='function')save();
    renderList();renderEditor();
    showNotice('Изменения анкеты сохранены.');
  }

  function refreshOpenCard(c){
    const map={ccName:c.name||'',ccPhone:c.phone||'',ccEmail:c.email||'',ccGender:c.gender||'',ccCity:c.city||'',ccAge:c.age||'',ccCountry:c.country||'',ccVk:c.vk||'',ccTelegram:c.telegram||'',ccMax:c.max||''};
    for(const [id,v] of Object.entries(map)){const el=document.getElementById(id);if(el)el.value=v;}
  }

  function makePrimary(){
    const c=currentClient(),x=selected();if(!c||!x)return;
    if(!writeEditorTo(x))return;
    for(const qx of arr(c))qx.isPrimary=String(qx.id)===String(x.id);
    const p=x.profile||{};
    if(p.name)c.name=p.name;if(p.phone)c.phone=p.phone;if(p.email)c.email=p.email;if(p.city)c.city=p.city;if(p.age)c.age=p.age;if(p.country)c.country=p.country;if(['Мужской','Женский'].includes(p.gender))c.gender=p.gender;c.preferredContact=p.contactMethod||c.preferredContact||'';
    if(typeof save==='function')save();
    if(typeof renderClient==='function')renderClient();
    refreshOpenCard(c);renderList();renderEditor();updateButton();
    showNotice('Анкета назначена основной. Данные клиента обновлены.');
  }

  async function deleteSelected(){
    const c=currentClient(),x=selected();if(!c||!x)return;
    const ok=window.AppDialog?.confirm?await AppDialog.confirm('Удалить эту анкету? Клиент останется в базе.','Удаление анкеты'):window.confirm('Удалить эту анкету?');if(!ok)return;
    c.questionnaires=arr(c).filter(qx=>String(qx.id)!==String(x.id));
    if(x.isPrimary&&c.questionnaires.length)c.questionnaires[0].isPrimary=true;
    selectedId=null;if(typeof save==='function')save();renderList();renderEditor();updateButton();showNotice('Анкета удалена.');
  }

  function open(){
    const c=currentClient();if(!c)return alert('Сначала выбери клиента.');
    q('cqClientName').textContent=c.name||'';selectedId=String((arr(c).find(x=>x.isPrimary)||arr(c)[arr(c).length-1]||{}).id||'');showNotice('');renderList();renderEditor();dlg.showModal();
  }
  q('cqClose').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  function updateButton(){
    const c=currentClient();const b=document.getElementById('ccQuestionnairesBtn');if(!b)return;
    const n=arr(c).length;const html=`Анкеты${n?` <span class="cq-count">${n}</span>`:''}`;
    if(b.innerHTML!==html)b.innerHTML=html;
  }

  function attachButton(){
    const actions=document.querySelector('#clientCardDialog .cc-top-actions');if(!actions)return false;
    if(actions.querySelector('#ccQuestionnairesBtn')){updateButton();return true;}
    const b=document.createElement('button');b.id='ccQuestionnairesBtn';b.type='button';b.className='cc-top-action-btn';b.onclick=open;actions.appendChild(b);
    if(!document.getElementById('cqCountStyle')){const css=document.createElement('style');css.id='cqCountStyle';css.textContent='.cq-count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#1d4ed8;color:#fff;font-size:11px;margin-left:4px}';document.head.appendChild(css);}
    updateButton();return true;
  }

  attachButton();
  if(!document.getElementById('ccQuestionnairesBtn')){setTimeout(attachButton,100);setTimeout(attachButton,500);}
  window.addEventListener('diagnostika:questionnairesImported',()=>{updateButton();});
  document.getElementById('clientCardDialog')?.addEventListener('close',updateButton);
  window.DiagnostikaQuestionnaires={open,refresh:()=>{renderList();renderEditor();updateButton();}};
})();