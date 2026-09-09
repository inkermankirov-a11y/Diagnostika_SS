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

    c.sessions.unshift({
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
