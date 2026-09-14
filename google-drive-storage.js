'use strict';

(() => {
  if(window.__diagnostikaGoogleDriveStorageReady) return;
  window.__diagnostikaGoogleDriveStorageReady=true;

  const CLIENT_ID=String(window.DIAGNOSTIKA_GOOGLE_CLIENT_ID||'').trim();
  const DRIVE_SCOPE='openid email profile https://www.googleapis.com/auth/drive.file';
  const TOKEN_KEY='diagnostika-google-drive-token-v2';
  const FOLDER_KEY='diagnostika-google-drive-folder-v2';
  const USER_KEY='diagnostika-google-drive-user-v2';
  const STATE_KEY='diagnostika-web-v1';
  const FOLDER_NAME='Diagnostika';

  const driveIcon=`<svg class="gdrive-icon" viewBox="0 0 87.3 78" aria-hidden="true" focusable="false"><path fill="#0066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"/><path fill="#00AC47" d="M43.65 25L29.9 1.2C28.55.4 27 0 25.4 0c-3.1 0-6.2 1.65-7.8 4.5L1.2 32.9C.4 34.3 0 35.85 0 37.4V53h27.5L43.65 25z"/><path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.75l5.85 11.5 7.95 12.3z"/><path fill="#00832D" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H25.4c1.6 0 3.15.45 4.5 1.2L43.65 25z"/><path fill="#2684FC" d="M59.75 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2L59.75 53z"/><path fill="#FFBA00" d="M73.4 26.5L65.2 12.3l-4.05-7c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.1 28H87.2c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z"/></svg>`;

  const style=document.createElement('style');
  style.textContent=`
    .storage-cloud-section{margin-top:14px;padding-top:14px;border-top:1px solid #dce4eb}.storage-cloud-title{font-size:12px;font-weight:800;color:#66778a;letter-spacing:.04em;margin-bottom:8px}.gdrive-card{border:1px solid #d9e1e8;background:#fff;border-radius:11px;padding:12px}.gdrive-main-row{display:flex;align-items:center;gap:11px}.gdrive-icon{width:32px;height:29px;flex:0 0 auto}.gdrive-copy{min-width:0;flex:1}.gdrive-name{font-size:14px;font-weight:800;color:#2e4053}.gdrive-status{font-size:11px;color:#74869a;margin-top:3px;line-height:1.4}.gdrive-connect,.gdrive-action{border:1px solid #cfd8e3;background:#fff;color:#33485d;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:700}.gdrive-connect:hover,.gdrive-action:hover{background:#f7f9fc}.gdrive-connect.connected{border-color:#b6dfc5;background:#edf8f1;color:#287047}.gdrive-note{margin-top:10px;padding-top:9px;border-top:1px solid #edf1f5;font-size:10.5px;line-height:1.45;color:#7b8b9d}.gdrive-tools{display:none;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.gdrive-card.connected .gdrive-tools{display:grid}.gdrive-disconnect{grid-column:1/-1;border:0;background:transparent;color:#a34a4a;text-decoration:underline;cursor:pointer;font-size:10.5px}.gdrive-action:disabled,.gdrive-connect:disabled{opacity:.6;cursor:wait}@media(max-width:520px){.gdrive-main-row{align-items:flex-start;flex-wrap:wrap}.gdrive-copy{flex:1 1 180px}.gdrive-connect{width:100%}.gdrive-tools{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  let googlePromise=null;
  let tokenClient=null;
  function getSession(key){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
  function setSession(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}
  function delSession(key){try{sessionStorage.removeItem(key);}catch{}}
  function token(){const t=getSession(TOKEN_KEY);return t?.access_token&&Date.now()<Number(t.expires_at||0)-30000?t:null;}
  async function notify(message,title='Google Drive'){if(window.AppDialog?.alert)return AppDialog.alert(message,title);alert(message);}
  async function confirmAction(message,title,ok='Продолжить'){if(window.AppDialog?.confirm)return AppDialog.confirm(message,title,ok,'Отмена');return confirm(`${title}\n\n${message}`);}

  function loadGoogle(){
    if(window.google?.accounts?.oauth2)return Promise.resolve();
    if(googlePromise)return googlePromise;
    googlePromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.defer=true;s.onload=resolve;s.onerror=()=>reject(new Error('Не удалось загрузить авторизацию Google.'));document.head.appendChild(s);});
    return googlePromise;
  }
  async function driveFetch(url,options={}){
    const t=token();if(!t)throw new Error('Сессия Google истекла. Подключи Google Drive снова.');
    const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${t.access_token}`);
    const res=await fetch(url,{...options,headers});
    if(res.status===401){delSession(TOKEN_KEY);throw new Error('Сессия Google истекла. Подключи Google Drive снова.');}
    if(!res.ok){let m=`Google Drive: ${res.status}`;try{m=(await res.json())?.error?.message||m;}catch{}throw new Error(m);}
    if(res.status===204)return null;const ct=res.headers.get('content-type')||'';return ct.includes('application/json')?res.json():res.text();
  }
  async function getUser(){const u=getSession(USER_KEY);if(u?.email)return u;const data=await driveFetch('https://openidconnect.googleapis.com/v1/userinfo');setSession(USER_KEY,data);return data;}
  function esc(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  async function ensureFolder(){
    const cached=getSession(FOLDER_KEY);if(cached?.id)return cached;
    const q=encodeURIComponent(`name='${esc(FOLDER_NAME)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const found=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=10`);
    let folder=found?.files?.[0];if(!folder)folder=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})});setSession(FOLDER_KEY,folder);return folder;
  }
  async function findFile(folderId,name){const q=encodeURIComponent(`name='${esc(name)}' and '${folderId}' in parents and trashed=false`);const data=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=10`);return data?.files?.[0]||null;}
  function currentDatabase(){try{if(window.state&&Array.isArray(window.state.clients))return JSON.parse(JSON.stringify(window.state));}catch{}try{const raw=localStorage.getItem(STATE_KEY);const db=raw?JSON.parse(raw):null;if(db&&Array.isArray(db.clients))return db;}catch{}return null;}
  async function uploadDatabase(){
    const db=currentDatabase();if(!db)throw new Error('Не удалось получить текущую базу клиентов.');
    const folder=await ensureFolder(),existing=await findFile(folder.id,'database.json');
    const boundary='diagnostika_'+Math.random().toString(36).slice(2),meta={name:'database.json',mimeType:'application/json'};if(!existing)meta.parents=[folder.id];
    const body=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(meta),`\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,JSON.stringify(db,null,2),`\r\n--${boundary}--`]);
    const url=existing?`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
    const file=await driveFetch(url,{method:existing?'PATCH':'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});return {file,clientCount:db.clients.length};
  }
  async function restoreDatabase(){const folder=await ensureFolder(),file=await findFile(folder.id,'database.json');if(!file)throw new Error('На Google Drive ещё нет database.json.');const text=await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);let db;try{db=typeof text==='string'?JSON.parse(text):text;}catch{throw new Error('database.json на Google Drive повреждён.');}if(!db||!Array.isArray(db.clients))throw new Error('На Google Drive найден некорректный database.json.');return db;}

  function mount(){
    const dlg=document.querySelector('.storage-dialog'),shell=dlg?.querySelector('.storage-shell'),footer=shell?.querySelector('.storage-footer');if(!dlg||!shell||!footer||shell.querySelector('.gdrive-card'))return false;
    const section=document.createElement('div');section.className='storage-cloud-section';section.innerHTML=`<div class="storage-cloud-title">ОБЛАЧНЫЕ ХРАНИЛИЩА</div><div class="gdrive-card"><div class="gdrive-main-row">${driveIcon}<div class="gdrive-copy"><div class="gdrive-name">Google Drive</div><div class="gdrive-status">Не подключён</div></div><button type="button" class="gdrive-connect">Подключить Google Drive</button></div><div class="gdrive-note">Вход выполняется через Google. Пароль Google программе не передаётся. В Google Drive создаётся папка «Diagnostika».</div><div class="gdrive-tools"><button type="button" class="gdrive-action gdrive-backup">Сохранить базу в Google Drive</button><button type="button" class="gdrive-action gdrive-restore">Восстановить базу из Google Drive</button><button type="button" class="gdrive-disconnect">Отключить Google Drive</button></div></div>`;shell.insertBefore(section,footer);
    const card=section.querySelector('.gdrive-card'),status=section.querySelector('.gdrive-status'),connect=section.querySelector('.gdrive-connect'),backup=section.querySelector('.gdrive-backup'),restore=section.querySelector('.gdrive-restore'),disconnect=section.querySelector('.gdrive-disconnect');
    function busy(v){connect.disabled=v;backup.disabled=v;restore.disabled=v;}
    async function ui(){const t=token();if(!t){card.classList.remove('connected');connect.classList.remove('connected');connect.textContent='Подключить Google Drive';status.textContent=CLIENT_ID?'Не подключён':'Google OAuth ещё не настроен';return;}try{const u=await getUser();await ensureFolder();card.classList.add('connected');connect.classList.add('connected');connect.textContent='Google Drive подключён';status.textContent=u?.email?`Подключён: ${u.email}`:'Подключён';}catch(e){status.textContent=e.message;}}
    connect.onclick=async()=>{
      if(token())return;
      if(!CLIENT_ID){await notify('Нужно один раз создать Web OAuth Client ID в Google Cloud для этого сайта. После этого пользователи будут просто нажимать «Подключить Google Drive» и выбирать свой Google-аккаунт.','Нужна настройка Google');return;}
      busy(true);status.textContent='Открываю Google…';
      try{await loadGoogle();tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:DRIVE_SCOPE,callback:async r=>{busy(false);if(r?.error){status.textContent=`Google: ${r.error}`;return;}setSession(TOKEN_KEY,{access_token:r.access_token,expires_at:Date.now()+(Number(r.expires_in)||3600)*1000});delSession(USER_KEY);delSession(FOLDER_KEY);await ui();}});tokenClient.requestAccessToken({prompt:'consent'});}catch(e){busy(false);status.textContent=e.message;}
    };
    backup.onclick=async()=>{busy(true);const old=backup.textContent;backup.textContent='Сохраняю…';try{const r=await uploadDatabase();status.textContent=`База сохранена: ${r.clientCount} клиент(ов)`;}catch(e){await notify(e.message,'Ошибка');}finally{backup.textContent=old;busy(false);}};
    restore.onclick=async()=>{busy(true);const old=restore.textContent;restore.textContent='Загружаю…';try{const db=await restoreDatabase();const ok=await confirmAction(`Будет загружено клиентов: ${db.clients.length}. Текущая база браузера будет заменена.`,'Восстановить базу?','Восстановить');if(ok){localStorage.setItem(STATE_KEY,JSON.stringify(db));location.reload();}}catch(e){await notify(e.message,'Ошибка');}finally{restore.textContent=old;busy(false);}};
    disconnect.onclick=async()=>{const t=token();if(t?.access_token){try{await loadGoogle();window.google.accounts.oauth2.revoke(t.access_token,()=>{});}catch{}}delSession(TOKEN_KEY);delSession(USER_KEY);delSession(FOLDER_KEY);await ui();};
    ui();return true;
  }
  if(!mount()){const o=new MutationObserver(()=>{if(mount())o.disconnect();});o.observe(document.body,{childList:true,subtree:true});}
})();
