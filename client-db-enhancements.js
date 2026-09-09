'use strict';

(() => {
  const FORMAT_INFO={
    'google-meet':{label:'Google Meet',icon:'G',cls:'meet'},
    'yandex-telemost':{label:'Яндекс Телемост',icon:'Я',cls:'yandex'},
    'zoom':{label:'Zoom',icon:'Z',cls:'zoom'},
    'telegram':{label:'Telegram',icon:'TG',cls:'telegram'},
    'whatsapp':{label:'WhatsApp',icon:'WA',cls:'whatsapp'},
    'max':{label:'MAX',icon:'M',cls:'max'},
    'other-video':{label:'Другая видеосвязь',icon:'◉',cls:'other'},
    'in-person':{label:'Лично',icon:'●',cls:'person'},
    'other':{label:'Другое',icon:'…',cls:'other'}
  };

  function parseSessionDate(s,index){
    const raw=s?.date||s?.createdAt||s?.savedAt||'';
    if(!raw) return index;
    const t=new Date(raw).getTime();
    return Number.isFinite(t)?t:index;
  }

  function latestSession(c){
    if(!Array.isArray(c?.sessions)||!c.sessions.length) return null;
    return c.sessions.map((s,index)=>({s,index,time:parseSessionDate(s,index)}))
      .sort((a,b)=>b.time-a.time||b.index-a.index)[0]?.s||null;
  }

  function formatDate(raw){
    if(!raw) return '—';
    const parts=String(raw).slice(0,10).split('-');
    if(parts.length===3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    const d=new Date(raw);
    if(Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString('ru-RU');
  }

  function formatInfo(s){
    if(!s?.sessionFormat) return null;
    const base=FORMAT_INFO[s.sessionFormat]||{label:s.sessionFormat,icon:'◉',cls:'other'};
    if(s.sessionFormat==='other' && s.sessionFormatOther?.trim()) return {...base,label:s.sessionFormatOther.trim()};
    return base;
  }

  window.renderClientDatabaseTable=function(){
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
    table.className='db-table db-table-enhanced';
    table.innerHTML='<thead><tr><th class="db-col-num">№</th><th>ФИО</th><th class="db-col-city">Город</th><th class="db-col-last">Последняя сессия</th><th class="db-col-format">Связь</th><th class="db-col-actions">Действия</th></tr></thead>';
    const tbody=document.createElement('tbody');

    state.clients.forEach((c,index)=>{
      const tr=document.createElement('tr');
      const last=latestSession(c);

      const num=document.createElement('td');
      num.className='db-col-num';
      num.textContent=String(index+1);

      const name=document.createElement('td');
      name.className='db-client-name';
      name.textContent=c.name||'Без имени';

      const city=document.createElement('td');
      city.className='db-col-city';
      city.textContent=c.city||'—';

      const lastCell=document.createElement('td');
      lastCell.className='db-col-last';
      lastCell.textContent=last?formatDate(last.date||last.createdAt||last.savedAt):'—';

      const formatCell=document.createElement('td');
      formatCell.className='db-col-format';
      const info=formatInfo(last);
      if(info){
        const badge=document.createElement('span');
        badge.className=`db-format-icon ${info.cls}`;
        badge.textContent=info.icon;
        badge.title=info.label;
        badge.setAttribute('aria-label',info.label);
        formatCell.appendChild(badge);
      }else{
        formatCell.textContent='—';
      }

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
      delBtn.className='db-delete-btn db-delete-btn-compact';
      delBtn.textContent='Удалить';
      delBtn.onclick=()=>{
        clientId=c.id;
        deleteCurrentClient();
        if(dlg.open) window.renderClientDatabaseTable();
      };

      group.append(openBtn,delBtn);
      actions.appendChild(group);
      tr.append(num,name,city,lastCell,formatCell,actions);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    root.appendChild(table);
  };

  window.openDatabase=function(){
    const dlg=document.querySelector('#clientDialog');
    window.renderClientDatabaseTable();
    if(dlg&&!dlg.open) dlg.showModal();
  };

  const btn=document.querySelector('#clientBaseBtn');
  if(btn) btn.onclick=window.openDatabase;
})();
