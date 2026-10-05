'use strict';

(() => {
  const clientsApi=()=>window.DiagnostikaClients
    || window.DiagnostikaPlatform?.clients
    || window.DiagnostikaPlatform?.services?.clients
    || null;

  const style=document.createElement('style');
  style.textContent=`
    .db-archive-list-btn{height:34px;padding:0 14px;border:1px solid #c99a42;border-radius:8px;background:linear-gradient(180deg,#fff7df,#f2dfae);color:#6e5018;font-weight:800;cursor:pointer}
    .db-archive-list-btn:hover{filter:brightness(1.02)}
    .archive-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .archive-dialog::backdrop{background:rgba(15,23,42,.52);backdrop-filter:blur(5px)}
    .archive-window{width:min(760px,calc(100vw - 24px));max-height:86dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:15px;box-shadow:0 24px 65px rgba(15,23,42,.34);padding:16px;box-sizing:border-box;color:#243447}
    .archive-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .archive-head h2{margin:0;font-size:20px}
    .archive-close{width:36px;height:36px;padding:0!important}
    .archive-list{display:grid;gap:8px}
    .archive-empty{padding:24px;text-align:center;color:#7b8ba1;border:1px dashed #cbd5e1;border-radius:10px;background:#fff}
    .archive-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid #e4d5ae;border-radius:10px;background:#fffdf7}
    .archive-name{font-weight:900;color:#26384b}
    .archive-meta{margin-top:4px;font-size:12px;color:#7b8ba1}
    .archive-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .archive-restore{background:#2d9a61!important;color:#fff!important;border-color:#238052!important}
    @media(max-width:640px){.archive-row{grid-template-columns:1fr}.archive-actions{justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  const dlg=document.createElement('dialog');
  dlg.className='archive-dialog';
  dlg.innerHTML='<div class="archive-window"><div class="archive-head"><h2>Архив клиентов</h2><button type="button" class="tk-btn archive-close">×</button></div><div class="archive-list"></div></div>';
  document.body.appendChild(dlg);

  dlg.querySelector('.archive-close').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  function formatArchivedAt(v){
    if(!v)return 'Дата архивации не указана';
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return 'Дата архивации не указана';
    return `В архиве с: ${d.toLocaleString('ru-RU')}`;
  }

  function refreshDatabase(){
    return window.DiagnostikaClientUIContext?.refreshDatabase?.()===true;
  }

  function refreshDashboard(){
    try{window.DiagnostikaHomeDashboard?.refresh?.();}catch(_){}
  }

  function renderArchive(){
    const items=clientsApi()?.archiveList?.()||[];
    const root=dlg.querySelector('.archive-list');
    root.innerHTML='';

    if(!items.length){
      const empty=document.createElement('div');
      empty.className='archive-empty';
      empty.textContent='В архиве клиентов нет.';
      root.appendChild(empty);
      return;
    }

    [...items].sort((a,b)=>String(b.archivedAt||'').localeCompare(String(a.archivedAt||''))).forEach(c=>{
      const row=document.createElement('div');
      row.className='archive-row';

      const info=document.createElement('div');
      info.innerHTML='<div class="archive-name"></div><div class="archive-meta"></div>';
      info.querySelector('.archive-name').textContent=c.name||'Без имени';
      info.querySelector('.archive-meta').textContent=`${c.city||'Город не указан'} · ${formatArchivedAt(c.archivedAt)}`;

      const actions=document.createElement('div');
      actions.className='archive-actions';

      const restore=document.createElement('button');
      restore.type='button';
      restore.className='tk-btn archive-restore';
      restore.textContent='Вернуть в базу';
      restore.onclick=()=>{
        const restored=clientsApi()?.unarchive?.(c.id,{source:'client-archive-ui'});
        if(!restored)return;
        refreshDatabase();
        refreshDashboard();
        renderArchive();
      };

      actions.appendChild(restore);
      row.append(info,actions);
      root.appendChild(row);
    });
  }

  window.renderArchivedClients=renderArchive;
  window.openArchivedClients=function(){
    renderArchive();
    if(!dlg.open)dlg.showModal();
  };

  function installButton(){
    const actions=document.querySelector('#clientDialog .dialog-actions');
    if(!actions||actions.querySelector('#archivedClientsBtn'))return false;

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='archivedClientsBtn';
    btn.className='db-archive-list-btn';
    btn.textContent='Архив клиентов';

    const close=actions.querySelector('[value="cancel"]');
    if(close)actions.insertBefore(btn,close);
    else actions.appendChild(btn);

    btn.onclick=()=>window.openArchivedClients();
    return true;
  }

  installButton();
})();
