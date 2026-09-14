'use strict';

(() => {
  if(window.__diagnostikaGoogleDriveStorageReady) return;
  window.__diagnostikaGoogleDriveStorageReady=true;

  const AUTH_START='/auth/google';
  const driveIcon=`<svg class="gdrive-icon" viewBox="0 0 87.3 78" aria-hidden="true" focusable="false">
    <path fill="#0066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"/>
    <path fill="#00AC47" d="M43.65 25L29.9 1.2C28.55.4 27 0 25.4 0c-3.1 0-6.2 1.65-7.8 4.5L1.2 32.9C.4 34.3 0 35.85 0 37.4V53h27.5L43.65 25z"/>
    <path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.75l5.85 11.5 7.95 12.3z"/>
    <path fill="#00832D" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H25.4c1.6 0 3.15.45 4.5 1.2L43.65 25z"/>
    <path fill="#2684FC" d="M59.75 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2L59.75 53z"/>
    <path fill="#FFBA00" d="M73.4 26.5L65.2 12.3l-4.05-7c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.1 28H87.2c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z"/>
  </svg>`;

  const style=document.createElement('style');
  style.textContent=`
    .storage-cloud-section{margin-top:14px;padding-top:14px;border-top:1px solid #dce4eb}
    .storage-cloud-title{font-size:12px;font-weight:800;color:#66778a;letter-spacing:.04em;margin-bottom:8px}
    .gdrive-card{border:1px solid #d9e1e8;background:#fff;border-radius:11px;padding:12px}
    .gdrive-main-row{display:flex;align-items:center;gap:11px}
    .gdrive-icon{width:32px;height:29px;flex:0 0 auto}
    .gdrive-copy{min-width:0;flex:1}
    .gdrive-name{font-size:14px;font-weight:800;color:#2e4053}
    .gdrive-status{font-size:11px;color:#74869a;margin-top:3px;line-height:1.4}
    .gdrive-connect{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #cfd8e3;background:#fff;color:#33485d;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:700;white-space:nowrap;box-shadow:0 1px 2px rgba(15,23,42,.04)}
    .gdrive-connect:hover{background:#f7f9fc;border-color:#b8c5d2}
    .gdrive-connect.connected{border-color:#b6dfc5;background:#edf8f1;color:#287047}
    .gdrive-note{margin-top:10px;padding-top:9px;border-top:1px solid #edf1f5;font-size:10.5px;line-height:1.45;color:#7b8b9d}
    .gdrive-tools{display:none;gap:10px;margin-top:8px}
    .gdrive-card.connected .gdrive-tools{display:flex}
    .gdrive-link-btn{border:0;background:transparent;padding:0;color:#4f78a8;font-size:10.5px;cursor:pointer;text-decoration:underline}
    @media(max-width:520px){.gdrive-main-row{align-items:flex-start;flex-wrap:wrap}.gdrive-copy{flex:1 1 180px}.gdrive-connect{width:100%}}
  `;
  document.head.appendChild(style);

  function mount(){
    const dlg=document.querySelector('.storage-dialog');
    const shell=dlg?.querySelector('.storage-shell');
    const footer=shell?.querySelector('.storage-footer');
    if(!dlg||!shell||!footer||shell.querySelector('.gdrive-card')) return false;

    const section=document.createElement('div');
    section.className='storage-cloud-section';
    section.innerHTML=`
      <div class="storage-cloud-title">ОБЛАЧНЫЕ ХРАНИЛИЩА</div>
      <div class="gdrive-card">
        <div class="gdrive-main-row">
          ${driveIcon}
          <div class="gdrive-copy">
            <div class="gdrive-name">Google Drive</div>
            <div class="gdrive-status">Не подключён</div>
          </div>
          <button type="button" class="gdrive-connect">Подключить Google Drive</button>
        </div>
        <div class="gdrive-note">Подключение выполняется через официальный вход Google. Пароль Google в Diagnostika не передаётся.</div>
        <div class="gdrive-tools">
          <button type="button" class="gdrive-link-btn gdrive-disconnect">Отключить Google Drive</button>
        </div>
      </div>`;
    shell.insertBefore(section,footer);

    const card=section.querySelector('.gdrive-card');
    const status=section.querySelector('.gdrive-status');
    const connectBtn=section.querySelector('.gdrive-connect');
    const disconnectBtn=section.querySelector('.gdrive-disconnect');

    async function refresh(){
      try{
        const res=await fetch('/api/google-drive/status',{credentials:'include',cache:'no-store'});
        if(!res.ok) throw new Error('backend unavailable');
        const data=await res.json();
        if(data?.connected){
          card.classList.add('connected');
          connectBtn.classList.add('connected');
          connectBtn.textContent='Google Drive подключён';
          status.textContent=data.email?`Подключён: ${data.email}`:'Подключён';
        }else{
          card.classList.remove('connected');
          connectBtn.classList.remove('connected');
          connectBtn.textContent='Подключить Google Drive';
          status.textContent='Не подключён';
        }
      }catch(_){
        card.classList.remove('connected');
        connectBtn.classList.remove('connected');
        connectBtn.textContent='Подключить Google Drive';
        status.textContent='Готов к подключению после запуска серверной авторизации';
      }
    }

    connectBtn.onclick=async()=>{
      if(card.classList.contains('connected')) return;
      if(location.hostname.endsWith('github.io')){
        const message='Интерфейс Google Drive готов. Для настоящего перенаправления через Google нужен серверный OAuth на VPS. После переноса сайта кнопка будет вести на Google без ввода Client ID.';
        if(window.AppDialog?.alert) await AppDialog.alert(message,'Google Drive'); else alert(message);
        return;
      }
      const returnTo=location.href;
      location.assign(`${AUTH_START}?returnTo=${encodeURIComponent(returnTo)}`);
    };

    disconnectBtn.onclick=async()=>{
      try{
        await fetch('/api/google-drive/disconnect',{method:'POST',credentials:'include'});
      }catch(_){}
      await refresh();
    };

    const params=new URLSearchParams(location.search);
    if(params.get('googleDrive')==='connected'){
      history.replaceState(null,'',location.pathname+location.hash);
      setTimeout(refresh,0);
    }else refresh();
    return true;
  }

  if(!mount()){
    const observer=new MutationObserver(()=>{if(mount()) observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
})();
