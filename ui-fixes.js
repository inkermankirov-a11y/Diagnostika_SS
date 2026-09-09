'use strict';

function updateSocialVisibility(){
  const c=client();
  const pairs=[['#vkBtn','vk'],['#tgBtn','telegram'],['#maxBtn','max']];
  for(const [sel,key] of pairs){
    const btn=document.querySelector(sel);
    if(!btn) continue;
    const filled=!!(c && String(c[key]||'').trim());
    btn.classList.toggle('social-hidden',!filled);
  }
}

const originalRenderClientForUi=renderClient;
renderClient=function(){
  originalRenderClientForUi();
  updateSocialVisibility();
};

function renderClientDatabaseTable(){
  const dlg=document.querySelector('#clientDialog');
  const root=document.querySelector('#clientDatabaseList');
  if(!dlg||!root) return;
  root.innerHTML='';

  if(!state.clients.length){
    const empty=document.createElement('div');
    empty.className='db-empty';
    empty.textContent='Клиентов пока нет.';
    root.appendChild(empty);
    return;
  }

  const table=document.createElement('table');
  table.className='db-table';
  table.innerHTML='<thead><tr><th class="db-col-num">№</th><th>ФИО</th><th class="db-col-city">Город</th><th class="db-col-actions">Действия</th></tr></thead>';
  const tbody=document.createElement('tbody');

  state.clients.forEach((c,index)=>{
    const tr=document.createElement('tr');
    const num=document.createElement('td');
    num.className='db-col-num';
    num.textContent=String(index+1);
    const name=document.createElement('td');
    name.textContent=c.name||'Без имени';
    const city=document.createElement('td');
    city.className='db-col-city';
    city.textContent=c.city||'—';
    const actions=document.createElement('td');
    actions.className='db-col-actions';
    const group=document.createElement('div');
    group.className='db-action-group';
    const openBtn=document.createElement('button');
    openBtn.type='button';
    openBtn.className='db-open-btn';
    openBtn.textContent='Открыть';
    openBtn.onclick=()=>{
      clientId=c.id;
      requestId=null;
      situationId=null;
      selected=null;
      dlg.close();
      renderClient();
    };
    const delBtn=document.createElement('button');
    delBtn.type='button';
    delBtn.className='db-delete-btn';
    delBtn.textContent='Удалить';
    delBtn.onclick=()=>{
      clientId=c.id;
      deleteCurrentClient();
      if(dlg.open) renderClientDatabaseTable();
    };
    group.append(openBtn,delBtn);
    actions.appendChild(group);
    tr.append(num,name,city,actions);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  root.appendChild(table);
}

openDatabase=function(){
  const dlg=document.querySelector('#clientDialog');
  renderClientDatabaseTable();
  if(dlg && !dlg.open) dlg.showModal();
};

const clientBaseBtnUi=document.querySelector('#clientBaseBtn');
if(clientBaseBtnUi) clientBaseBtnUi.onclick=openDatabase;

function closeDiagnosisDialogs(){
  const a=document.querySelector('#diagnosisLaunchDialog');
  const b=document.querySelector('#requestHistoryDialog');
  if(a?.open)a.close();
  if(b?.open)b.close();
}

const cardBtn=document.querySelector('#clientCardModeBtn');
if(cardBtn){
  cardBtn.onclick=()=>{
    closeDiagnosisDialogs();
    mode='card';
    selected=null;
    renderMode();
    renderSessions();
  };
}

const backBtn=document.querySelector('#backToProgressBtn');
if(backBtn){
  backBtn.onclick=()=>{
    closeDiagnosisDialogs();
    mode='card';
    selected=null;
    renderMode();
    renderSessions();
  };
}

function sessionTimeValue(s,index){
  const raw=s.createdAt||s.savedAt||s.date||'';
  const t=raw?new Date(raw).getTime():NaN;
  return Number.isFinite(t)?t:index;
}

let editingSession=null;
const sessionEditDialog=document.createElement('dialog');
sessionEditDialog.id='sessionEditDialog';
sessionEditDialog.className='session-edit-dialog';
sessionEditDialog.innerHTML=`
  <div class="session-edit-card">
    <div class="session-edit-title">Редактирование сессии</div>
    <textarea id="sessionEditText" class="session-edit-text" placeholder="Что делали, результат, заметки"></textarea>
    <div class="session-edit-actions">
      <button id="sessionEditCancel" type="button">Отмена</button>
      <button id="sessionEditSave" type="button" class="primary">Сохранить</button>
    </div>
  </div>`;
document.body.appendChild(sessionEditDialog);

document.querySelector('#sessionEditCancel').onclick=()=>sessionEditDialog.close();
document.querySelector('#sessionEditSave').onclick=()=>{
  if(!editingSession)return sessionEditDialog.close();
  editingSession.notes=document.querySelector('#sessionEditText').value;
  save();
  sessionEditDialog.close();
  editingSession=null;
  renderSessions();
};
sessionEditDialog.addEventListener('click',e=>{if(e.target===sessionEditDialog)sessionEditDialog.close();});

function openSessionEditor(s){
  editingSession=s;
  document.querySelector('#sessionEditText').value=s.notes||'';
  sessionEditDialog.showModal();
  setTimeout(()=>document.querySelector('#sessionEditText').focus(),0);
}

renderSessions=function(){
  const c=client();
  const root=document.querySelector('#sessionsList');
  if(!root)return;
  root.innerHTML='';
  if(!c)return;
  if(!Array.isArray(c.sessions))c.sessions=[];
  if(!c.sessions.length){
    root.innerHTML='<div style="color:#9CA3AF;padding:8px 0">Сессий пока нет.</div>';
    return;
  }

  const chronological=c.sessions.map((s,index)=>({s,index,time:sessionTimeValue(s,index)}))
    .sort((a,b)=>a.time-b.time||a.index-b.index);
  const numbers=new Map();
  chronological.forEach((item,i)=>numbers.set(item.s.id,i+1));
  const display=[...chronological].reverse();

  display.forEach(item=>{
    const s=item.s;
    const originalIndex=c.sessions.indexOf(s);
    const row=document.createElement('div');
    row.className='session-row session-row-compact';

    const head=document.createElement('div');
    head.className='session-compact-head';

    const title=document.createElement('div');
    title.className='session-number';
    title.textContent=`Сессия №${numbers.get(s.id)}`;

    const date=document.createElement('input');
    date.type='date';
    date.className='session-date';
    date.value=s.date||today();

    const link=document.createElement('select');
    link.className='session-request';
    link.innerHTML='<option value="">— Без связи —</option>';
    c.requests.forEach(r=>{
      const o=document.createElement('option');
      o.value=r.id;
      o.textContent=r.title||'Без названия';
      link.appendChild(o);
    });
    link.value=s.requestId||'';

    const edit=document.createElement('button');
    edit.type='button';
    edit.className='session-icon-btn session-edit-btn';
    edit.title='Редактировать заметку';
    edit.setAttribute('aria-label','Редактировать заметку');
    edit.textContent='✎';

    const del=document.createElement('button');
    del.type='button';
    del.className='session-icon-btn session-delete-btn';
    del.title='Удалить сессию';
    del.setAttribute('aria-label','Удалить сессию');
    del.textContent='×';

    const note=document.createElement('div');
    note.className='session-note-readonly'+(!String(s.notes||'').trim()?' empty':'');
    note.textContent=String(s.notes||'').trim()||'Заметка к сессии не заполнена';

    date.oninput=e=>{s.date=e.target.value;save();renderSessions()};
    link.onchange=e=>{s.requestId=e.target.value;save()};
    edit.onclick=()=>openSessionEditor(s);
    del.onclick=()=>{
      if(confirm(`Удалить сессию №${numbers.get(s.id)}?`)){
        c.sessions.splice(originalIndex,1);
        save();
        renderSessions();
      }
    };

    head.append(title,date,link,edit,del);
    row.append(head,note);
    root.appendChild(row);
  });
};

const addSessionBtnUi=document.querySelector('#addSessionBtn');
if(addSessionBtnUi){
  addSessionBtnUi.onclick=()=>{
    const c=client();
    if(!c)return;
    c.sessions.push({id:uid(),date:today(),requestId:'',notes:'',createdAt:new Date().toISOString()});
    save();
    renderSessions();
  };
}

const saveHistoryBtn=document.querySelector('#saveHistoryBtn');
if(saveHistoryBtn){
  saveHistoryBtn.onclick=()=>{
    const c=client();
    if(!c)return alert('Сначала выбери клиента.');
    const r=request();
    const s=situation();
    if(!Array.isArray(c.sessions))c.sessions=[];
    const notes=[];
    if(r)notes.push(`Запрос: ${r.title||'Без названия'}`);
    if(s){
      notes.push(`Ситуация: ${s.name||'Без названия'} (${lvl(s.level)}/10)`);
      if(s.result)notes.push(`Желаемый результат: ${s.result}`);
    }
    if(!notes.length)notes.push('Сохранено из карточки клиента.');
    c.sessions.push({
      id:uid(),
      date:today(),
      requestId:r?.id||'',
      notes:notes.join('\n'),
      createdAt:new Date().toISOString(),
      source:'history'
    });
    save();
    renderSessions();
    const old=saveHistoryBtn.textContent;
    saveHistoryBtn.textContent='Сохранено';
    setTimeout(()=>{saveHistoryBtn.textContent=old;},1200);
  };
}

updateSocialVisibility();
