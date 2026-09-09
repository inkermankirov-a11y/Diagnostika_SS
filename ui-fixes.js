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
    const num=document.createElement('td');num.className='db-col-num';num.textContent=String(index+1);
    const name=document.createElement('td');name.textContent=c.name||'Без имени';
    const city=document.createElement('td');city.className='db-col-city';city.textContent=c.city||'—';
    const actions=document.createElement('td');actions.className='db-col-actions';
    const group=document.createElement('div');group.className='db-action-group';
    const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='db-open-btn';openBtn.textContent='Открыть';
    openBtn.onclick=()=>{clientId=c.id;requestId=null;situationId=null;selected=null;dlg.close();renderClient();};
    const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='db-delete-btn';delBtn.textContent='Удалить';
    delBtn.onclick=()=>{clientId=c.id;deleteCurrentClient();if(dlg.open)renderClientDatabaseTable();};
    group.append(openBtn,delBtn);actions.appendChild(group);tr.append(num,name,city,actions);tbody.appendChild(tr);
  });
  table.appendChild(tbody);root.appendChild(table);
}

openDatabase=function(){const dlg=document.querySelector('#clientDialog');renderClientDatabaseTable();if(dlg&&!dlg.open)dlg.showModal();};
const clientBaseBtnUi=document.querySelector('#clientBaseBtn');if(clientBaseBtnUi)clientBaseBtnUi.onclick=openDatabase;

function closeDiagnosisDialogs(){
  const a=document.querySelector('#diagnosisLaunchDialog');
  const b=document.querySelector('#requestHistoryDialog');
  if(a?.open)a.close();if(b?.open)b.close();
}

const backBtn=document.querySelector('#backToProgressBtn');
if(backBtn){backBtn.onclick=()=>{closeDiagnosisDialogs();mode='card';selected=null;renderMode();renderSessions();};}

function sessionTimeValue(s,index){
  const raw=s.createdAt||s.savedAt||s.date||'';
  const t=raw?new Date(raw).getTime():NaN;
  return Number.isFinite(t)?t:index;
}

function openSessionEditor(c,s,number){
  const dlg=document.createElement('dialog');
  dlg.className='session-edit-dialog';
  const wrap=document.createElement('div');wrap.className='session-edit-card';
  const h=document.createElement('div');h.className='session-edit-title';h.textContent=`Сессия №${number}`;
  const grid=document.createElement('div');grid.className='session-edit-grid';
  const dateInput=document.createElement('input');dateInput.type='date';dateInput.value=s.date||today();
  const link=document.createElement('select');link.innerHTML='<option value="">— Без связи —</option>';
  c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.title||'Без названия';link.appendChild(o);});
  link.value=s.requestId||'';
  grid.append(dateInput,link);
  const ta=document.createElement('textarea');ta.className='session-edit-text';ta.value=s.notes||'';ta.placeholder='Что делали, результат, заметки';
  const actions=document.createElement('div');actions.className='session-edit-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';
  const saveBtn=document.createElement('button');saveBtn.type='button';saveBtn.className='primary';saveBtn.textContent='Сохранить';
  cancel.onclick=()=>dlg.close();
  saveBtn.onclick=()=>{s.date=dateInput.value||today();s.requestId=link.value;s.notes=ta.value;save();dlg.close();renderSessions();};
  actions.append(cancel,saveBtn);wrap.append(h,grid,ta,actions);dlg.appendChild(wrap);document.body.appendChild(dlg);
  dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();
}

renderSessions=function(){
  const c=client();
  const root=document.querySelector('#sessionsList');
  if(!root)return;
  root.innerHTML='';
  if(!c)return;
  if(!Array.isArray(c.sessions))c.sessions=[];
  if(!c.sessions.length){root.innerHTML='<div class="sessions-empty">Сессий пока нет.</div>';return;}

  const chronological=c.sessions.map((s,index)=>({s,index,time:sessionTimeValue(s,index)})).sort((a,b)=>a.time-b.time||a.index-b.index);
  const numbers=new Map();chronological.forEach((item,i)=>numbers.set(item.s.id,i+1));
  const display=[...chronological].reverse();

  display.forEach(item=>{
    const s=item.s;
    const number=numbers.get(s.id);
    const row=document.createElement('article');row.className='session-card';

    const head=document.createElement('div');head.className='session-card-head';
    const title=document.createElement('div');title.className='session-card-title';title.textContent=`Сессия №${number}`;
    const meta=document.createElement('div');meta.className='session-card-meta';
    const date=document.createElement('span');date.className='session-card-date';date.textContent=s.date||today();
    const req=c.requests.find(r=>r.id===s.requestId);
    const requestLabel=document.createElement('span');requestLabel.className='session-card-request';requestLabel.textContent=req?.title||'Без связи с запросом';
    meta.append(date,requestLabel);
    const edit=document.createElement('button');edit.type='button';edit.className='session-card-edit';edit.title='Редактировать';edit.setAttribute('aria-label','Редактировать сессию');edit.textContent='✎';
    edit.onclick=()=>openSessionEditor(c,s,number);
    head.append(title,meta,edit);

    const notes=document.createElement('div');notes.className='session-card-notes'+(s.notes?'':' empty');notes.textContent=s.notes||'Заметок по сессии нет';
    row.append(head,notes);root.appendChild(row);
  });
};

const addSessionBtnUi=document.querySelector('#addSessionBtn');
if(addSessionBtnUi){addSessionBtnUi.onclick=()=>{const c=client();if(!c)return;c.sessions.push({id:uid(),date:today(),requestId:'',notes:'',createdAt:new Date().toISOString()});save();renderSessions();};}

const saveHistoryBtn=document.querySelector('#saveHistoryBtn');
if(saveHistoryBtn){
  saveHistoryBtn.onclick=()=>{
    const c=client();if(!c)return alert('Сначала выбери клиента.');
    const r=request();const s=situation();if(!Array.isArray(c.sessions))c.sessions=[];
    const notes=[];if(r)notes.push(`Запрос: ${r.title||'Без названия'}`);
    if(s){notes.push(`Ситуация: ${s.name||'Без названия'} (${lvl(s.level)}/10)`);if(s.result)notes.push(`Желаемый результат: ${s.result}`);}
    if(!notes.length)notes.push('Сохранено из карточки клиента.');
    c.sessions.push({id:uid(),date:today(),requestId:r?.id||'',notes:notes.join('\n'),createdAt:new Date().toISOString(),source:'history'});
    save();renderSessions();const old=saveHistoryBtn.textContent;saveHistoryBtn.textContent='Сохранено';setTimeout(()=>{saveHistoryBtn.textContent=old;},1200);
  };
}

updateSocialVisibility();
renderSessions();
