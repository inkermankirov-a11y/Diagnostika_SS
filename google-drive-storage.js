'use strict';

(() => {
  if(window.__diagnostikaGoogleDriveStorageReady) return;
  window.__diagnostikaGoogleDriveStorageReady=true;

  const CLIENT_ID_KEY='diagnostika-google-drive-client-id-v1';
  const TOKEN_KEY='diagnostika-google-drive-token-v1';
  const FOLDER_NAME='Diagnostika';
  const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';

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
    .gdrive-card{border:1px solid #d9e1e8;background:#fff;border-radius:10px;padding:11px}
    .gdrive-main-row{display:flex;align-items:center;gap:10px}
    .gdrive-icon{width:29px;height:26px;flex:0 0 auto}
    .gdrive-copy{min-width:0;flex:1}
    .gdrive-name{font-size:14px;font-weight:800;color:#2e4053}
    .gdrive-status{font-size:11px;color:#74869a;margin-top:2px;line-height:1.35}
    .gdrive-connect{border:1px solid #d0d8e0;background:#fff;color:#33485d;border-radius:7px;padding:8px 11px;cursor:pointer;font-weight:700;white-space:nowrap}
    .gdrive-connect:hover{background:#f6f9fc}
    .gdrive-connect.connected{border-color:#b6dfc5;background:#edf8f1;color:#287047}
    .gdrive-connect:disabled{opacity:.65;cursor:wait}
    .gdrive-config{display:none;margin-top:10px;padding-top:10px;border-top:1px solid #edf1f5}
    .gdrive-config.open{display:block}
    .gdrive-config label{display:block;font-size:11px;font-weight:700;color:#5f7286;margin-bottom:5px}
    .gdrive-config-row{display:flex;gap:7px}
    .gdrive-client-id{min-width:0;flex:1;border:1px solid #cad5df;border-radius:7px;padding:8px 9px;font:12px 'Segoe UI',Arial,sans-serif;color:#34495e}
    .gdrive-config-save{border:1px solid #4f78a8;background:#4f78a8;color:#fff;border-radius:7px;padding:8px 11px;cursor:pointer;font-weight:700}
    .gdrive-hint{font-size:10px;line-height:1.45;color:#8190a0;margin-top:7px}
    .gdrive-tools{display:flex;gap:10px;margin-top:8px}
    .gdrive-link-btn{border:0;background:transparent;padding:0;color:#4f78a8;font-size:10px;cursor:pointer;text-decoration:underline}
    @media(max-width:520px){.gdrive-main-row{align-items:flex-start;flex-wrap:wrap}.gdrive-copy{flex:1 1 180px}.gdrive-connect{width:100%}.gdrive-config-row{flex-direction:column}}
  `;
  document.head.appendChild(style);

  let tokenClient=null;
  let googleScriptPromise=null;
  let currentToken=null;

  function loadGoogleIdentity(){
    if(window.google?.accounts?.oauth2) return Promise.resolve();
    if(googleScriptPromise) return googleScriptPromise;
    googleScriptPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-diagnostika-google-gsi]');
      if(existing){
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',()=>reject(new Error('Не удалось загрузить Google Identity Services.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src='https://accounts.google.com/gsi/client';
      s.async=true;
      s.defer=true;
      s.dataset.diagnostikaGoogleGsi='1';
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Не удалось загрузить Google Identity Services.'));
      document.head.appendChild(s);
    });
    return googleScriptPromise;
  }

  function getSavedToken(){
    try{
      const raw=sessionStorage.getItem(TOKEN_KEY);
      if(!raw) return null;
      const data=JSON.parse(raw);
      if(!data?.access_token || !data?.expires_at || Date.now()>=data.expires_at-30000){
        sessionStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return data;
    }catch(_){return null;}
  }

  function saveToken(resp){
    const expiresIn=Math.max(60,Number(resp.expires_in)||3600);
    const data={access_token:resp.access_token,expires_at:Date.now()+expiresIn*1000};
    currentToken=data;
    try{sessionStorage.setItem(TOKEN_KEY,JSON.stringify(data));}catch(_){}
  }

  function clientId(){
    try{return String(localStorage.getItem(CLIENT_ID_KEY)||'').trim();}catch(_){return '';}
  }

  function escDriveQuery(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

  async function driveFetch(path,options={}){
    const token=currentToken||getSavedToken();
    if(!token?.access_token) throw new Error('Google Drive не подключён.');
    const headers=new Headers(options.headers||{});
    headers.set('Authorization',`Bearer ${token.access_token}`);
    if(options.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
    const res=await fetch(`https://www.googleapis.com${path}`,{...options,headers});
    if(res.status===401){
      currentToken=null;
      try{sessionStorage.removeItem(TOKEN_KEY);}catch(_){}
      throw new Error('Сессия Google истекла. Подключи Google Drive снова.');
    }
    if(!res.ok){
      let msg=`Google Drive API: ${res.status}`;
      try{const j=await res.json();msg=j?.error?.message||msg;}catch(_){}
      throw new Error(msg);
    }
    return res.status===204?null:res.json();
  }

  async function ensureDiagnostikaFolder(){
    const q=encodeURIComponent(`name='${escDriveQuery(FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const list=await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=10`);
    if(list?.files?.length) return list.files[0];
    return driveFetch('/drive/v3/files?fields=id,name',{method:'POST',body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})});
  }

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
          <button type="button" class="gdrive-connect">Подключить</button>
        </div>
        <div class="gdrive-config">
          <label>Google OAuth Client ID</label>
          <div class="gdrive-config-row">
            <input class="gdrive-client-id" type="text" autocomplete="off" placeholder="xxxxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com">
            <button type="button" class="gdrive-config-save">Сохранить и подключить</button>
          </div>
          <div class="gdrive-hint">Client ID нужен только для входа через Google и не является секретным ключом. Для текущего сайта в Google Cloud нужно разрешить JavaScript origin: https://inkermankirov-a11y.github.io</div>
        </div>
        <div class="gdrive-tools">
          <button type="button" class="gdrive-link-btn gdrive-settings">Настроить OAuth</button>
          <button type="button" class="gdrive-link-btn gdrive-disconnect" style="display:none">Отключить Google Drive</button>
        </div>
      </div>`;
    shell.insertBefore(section,footer);

    const status=section.querySelector('.gdrive-status');
    const connectBtn=section.querySelector('.gdrive-connect');
    const config=section.querySelector('.gdrive-config');
    const input=section.querySelector('.gdrive-client-id');
    const saveBtn=section.querySelector('.gdrive-config-save');
    const settingsBtn=section.querySelector('.gdrive-settings');
    const disconnectBtn=section.querySelector('.gdrive-disconnect');

    function setUi(text,connected=false,busy=false){
      status.textContent=text;
      connectBtn.disabled=busy;
      connectBtn.classList.toggle('connected',connected);
      connectBtn.textContent=busy?'Подключаю…':connected?'Подключено':'Подключить';
      disconnectBtn.style.display=connected?'inline':'none';
    }

    async function connect(){
      const id=clientId();
      if(!id){
        input.value='';
        config.classList.add('open');
        input.focus();
        status.textContent='Сначала укажи OAuth Client ID.';
        return;
      }
      setUi('Открываю авторизацию Google…',false,true);
      try{
        await loadGoogleIdentity();
        tokenClient=window.google.accounts.oauth2.initTokenClient({
          client_id:id,
          scope:DRIVE_SCOPE,
          prompt:'consent',
          callback:async(resp)=>{
            if(resp?.error){setUi(`Ошибка Google: ${resp.error}`,false,false);return;}
            try{
              saveToken(resp);
              setUi('Проверяю доступ к Google Drive…',false,true);
              const folder=await ensureDiagnostikaFolder();
              setUi(`Подключён. Папка «${folder?.name||FOLDER_NAME}» готова.`,true,false);
              config.classList.remove('open');
            }catch(e){setUi(e?.message||'Не удалось проверить Google Drive.',false,false);}
          }
        });
        tokenClient.requestAccessToken();
      }catch(e){
        setUi(e?.message||'Не удалось открыть авторизацию Google.',false,false);
      }
    }

    connectBtn.onclick=()=>{
      if(currentToken||getSavedToken()) return;
      connect();
    };
    settingsBtn.onclick=()=>{
      input.value=clientId();
      config.classList.toggle('open');
      if(config.classList.contains('open')) input.focus();
    };
    saveBtn.onclick=()=>{
      const value=input.value.trim();
      if(!value || !value.endsWith('.apps.googleusercontent.com')){
        status.textContent='Проверь Client ID: он должен оканчиваться на .apps.googleusercontent.com';
        return;
      }
      try{localStorage.setItem(CLIENT_ID_KEY,value);}catch(_){}
      config.classList.remove('open');
      connect();
    };
    disconnectBtn.onclick=()=>{
      const token=currentToken||getSavedToken();
      if(token?.access_token && window.google?.accounts?.oauth2){
        try{window.google.accounts.oauth2.revoke(token.access_token,()=>{});}catch(_){}
      }
      currentToken=null;
      try{sessionStorage.removeItem(TOKEN_KEY);}catch(_){}
      setUi('Не подключён',false,false);
    };

    currentToken=getSavedToken();
    if(currentToken) setUi('Подключён в этой вкладке.',true,false);
    else if(clientId()) setUi('OAuth настроен. Нажми «Подключить».',false,false);
    else setUi('Не подключён',false,false);

    return true;
  }

  if(!mount()){
    const observer=new MutationObserver(()=>{if(mount()) observer.disconnect();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
})();
