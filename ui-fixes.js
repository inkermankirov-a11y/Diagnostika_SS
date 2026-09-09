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

updateSocialVisibility();
