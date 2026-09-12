'use strict';

(() => {
  const clone=v=>JSON.parse(JSON.stringify(v));
  const ensureState=()=>{
    if(!Array.isArray(state.deletedClients)) state.deletedClients=[];
    if(!Array.isArray(state.deletedClientTombstones)) state.deletedClientTombstones=[];
    const blocked=new Set(state.deletedClientTombstones);
    const activeIds=new Set((state.clients||[]).map(c=>c?.id).filter(Boolean));
    const before=state.deletedClients.length;
    state.deletedClients=state.deletedClients.filter(c=>c?.id&&!blocked.has(c.id)&&!activeIds.has(c.id));
    if(before!==state.deletedClients.length) save();
  };
  ensureState();

  const style=document.createElement('style');
  style.textContent=`
    .db-trash-btn{height:34px;padding:0 14px;border:1px solid #b9c6d4;border-radius:8px;background:#eef2f6;color:#405268;font-weight:800;cursor:pointer}
    .db-trash-btn:hover{background:#e3eaf1}
    .trash-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .trash-dialog::backdrop{background:rgba(15,23,42,.52);backdrop-filter:blur(5px)}
    .trash-window{width:min(760px,calc(100vw - 24px));max-height:86dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:15px;box-shadow:0 24px 65px rgba(15,23,42,.34);padding:16px;box-sizing:border-box;color:#243447}
    .trash-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.trash-head h2{margin:0;font-size:20px}.trash-close{width:36px;height:36px;padding:0!important}
    .trash-list{display:grid;gap:8px}.trash-empty{padding:24px;text-align:center;color:#7b8ba1;border:1px dashed #cbd5e1;border-radius:10px;background:#fff}
    .trash-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid #d8e1ea;border-radius:10px;background:#fff}
    .trash-name{font-weight:900;color:#26384b}.trash-meta{margin-top:4px;font-size:12px;color:#7b8ba1}.trash-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .trash-restore{background:#2d9a61!important;color:#fff!important;border-color:#238052!important}.trash-delete{background:#d9534f!important;color:#fff!important;border-color:#bd3f3b!important}
    @media(max-width:640px){.trash-row{grid-template-columns:1fr}.trash-actions{justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  const dlg=document.createElement('dialog');
  dlg.className='trash-dialog';
  dlg.innerHTML=`<div class="trash-window"><div class="trash-head"><h2>Удалённые клиенты</h2><button type="button" class="tk-btn trash-close">×</button></div><div class="trash-list"></div></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.trash-close').onclick=()=>dlg.close();
  dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});

  function formatDeletedAt(v){
    if(!v)return 'Дата удаления не указана';
    const d=new Date(v);if(Number.isNaN(d.getTime()))return 'Дата удаления не указана';
    return `Удалён: ${d.toLocaleString('ru-RU')}`;
  }

  function renderTrash(){
    ensureState();
    const root=dlg.querySelector('.trash-list');
    root.innerHTML='';
    if(!state.deletedClients.length){
      const empty=document.createElement('div');empty.className='trash-empty';empty.textContent='Удалённых клиентов нет.';root.appendChild(empty);return;
    }
    [...state.deletedClients].sort((a,b)=>String(b.deletedAt||'').localeCompare(String(a.deletedAt||''))).forEach(c=>{
      const row=document.createElement('div');row.className='trash-row';
      const info=document.createElement('div');
      info.innerHTML=`<div class="trash-name"></div><div class="trash-meta"></div>`;
      info.querySelector('.trash-name').textContent=c.name||'Без имени';
      info.querySelector('.trash-meta').textContent=`${c.city||'Город не указан'} · ${formatDeletedAt(c.deletedAt)}`;
      const actions=document.createElement('div');actions.className='trash-actions';
      const restore=document.createElement('button');restore.type='button';restore.className='tk-btn trash-restore';restore.textContent='Восстановить';
      restore.onclick=()=>{
        state.deletedClients=state.deletedClients.filter(x=>x.id!==c.id);
        state.deletedClientTombstones=state.deletedClientTombstones.filter(id=>id!==c.id);
        const restored=clone(c);delete restored.deletedAt;
        if(!state.clients.some(x=>x.id===restored.id)) state.clients.push(restored);
        save();
        if(typeof window.renderClientDatabaseTable==='function') window.renderClientDatabaseTable();
        renderTrash();
      };
      const forever=document.createElement('button');forever.type='button';forever.className='tk-btn trash-delete';forever.textContent='Удалить навсегда';
      forever.onclick=()=>{
        if(!confirm(`Удалить клиента «${c.name||'Без имени'}» навсегда?\n\nВосстановить его после этого будет нельзя.`))return;
        state.deletedClients=state.deletedClients.filter(x=>x.id!==c.id);
        if(!state.deletedClientTombstones.includes(c.id)) state.deletedClientTombstones.push(c.id);
        save();renderTrash();
      };
      actions.append(restore,forever);row.append(info,actions);root.appendChild(row);
    });
  }

  window.openDeletedClients=function(){renderTrash();if(!dlg.open)dlg.showModal();};

  window.deleteCurrentClient=function(){
    const c=client();if(!c)return;
    const name=c.name||'Без имени';
    if(!confirm(`Удалить клиента «${name}»?\n\nКлиент будет перемещён в «Удалённые клиенты», откуда его можно восстановить.`))return;
    ensureState();
    const index=state.clients.findIndex(x=>x.id===c.id);if(index<0)return;
    const archived=clone(c);archived.deletedAt=new Date().toISOString();
    state.deletedClients=state.deletedClients.filter(x=>x.id!==c.id);
    state.deletedClients.push(archived);
    state.deletedClientTombstones=state.deletedClientTombstones.filter(id=>id!==c.id);
    state.clients.splice(index,1);
    if(!state.clients.length){const replacement=newClient();state.clients.push(replacement);clientId=replacement.id;}
    else{clientId=state.clients[Math.min(index,state.clients.length-1)].id;}
    requestId=null;situationId=null;selected=null;mode='card';
    save();renderClient();
  };

  function installButton(){
    const actions=document.querySelector('#clientDialog .dialog-actions');
    if(!actions||actions.querySelector('#deletedClientsBtn'))return;
    const btn=document.createElement('button');btn.type='button';btn.id='deletedClientsBtn';btn.className='db-trash-btn';btn.textContent='Удалённые клиенты';
    const close=actions.querySelector('[value="cancel"]');
    if(close)actions.insertBefore(btn,close);else actions.appendChild(btn);
    btn.onclick=()=>window.openDeletedClients();
  }
  installButton();
  new MutationObserver(installButton).observe(document.body,{childList:true,subtree:true});
})();
