'use strict';
(()=>{
 const localizedConfirm=message=>window.confirm(window.DiagnostikaI18n?.translate(message)||message);
 if(location.hostname!=='zabvenye.com')return;
 const cryptoApi=()=>window.DiagnostikaVaultCrypto;
 const db=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
 const files=()=>window.DiagnostikaPlatform?.services?.files;
 const $=id=>document.getElementById(id);
 const tr=text=>window.DiagnostikaI18n?.translate(text)||text;
 function download(raw,name,host){
  const url=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;
  // Attach inside the active modal; elements outside it may be inert.
  host.append(a);
  try{a.click()}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 }
 function createUI(){
  if($('vaultDialog'))return;
  const anchor=document.querySelector('.storage-dialog .storage-actions-main');if(!anchor)return;
  const btn=document.createElement('button');btn.type='button';btn.id='vaultBackupBtn';btn.className='storage-primary';btn.textContent='Зашифрованная резервная копия';btn.title='Защищённые резервные копии';anchor.append(btn);
  const d=document.createElement('dialog');d.id='vaultDialog';d.className='storage-dialog';
  d.innerHTML='<div class="storage-shell"><div class="storage-title">ZABVENYE Vault</div><p>Зашифрованная резервная копия. Ключ храните отдельно от файла: для старых копий без сохранённого ключа восстановление невозможно.</p><label>Ключ восстановления или пароль (от 16 символов)<input id="vaultSecret" type="password" autocomplete="off" minlength="16" maxlength="512" aria-describedby="vaultStatus" style="width:100%"></label><div class="storage-actions-main"><button id="vaultGenerate" type="button">Создать новый случайный ключ</button><button id="vaultCopy" type="button">Скопировать ключ</button><button id="vaultSave" type="button" class="storage-primary">Скачать зашифрованную копию .zbv</button><button id="vaultRead" type="button">Восстановить из .zbv / старого JSON</button></div><input id="vaultFile" type="file" accept=".zbv,.json" hidden><p id="vaultStatus" role="status" aria-live="polite"></p><a id="vaultDownloadReady" class="storage-primary" hidden style="display:block;text-align:center;padding:10px;border-radius:6px;text-decoration:none" download>Скачать готовый файл .zbv</a><div class="storage-footer"><button id="vaultClose" type="button">Закрыть</button></div></div>';
  document.body.append(d);
  const status=t=>{$('vaultStatus').textContent=tr(t)};
  const secret=()=>$('vaultSecret').value;
  const input=$('vaultSecret'),readyLink=$('vaultDownloadReady');
  let busy=false,downloadUrl=null;
  function clearDownload(){
   if(downloadUrl){const old=downloadUrl;setTimeout(()=>URL.revokeObjectURL(old),60000);}
   downloadUrl=null;readyLink.hidden=true;readyLink.removeAttribute('href');
  }
  function validateSecret(){
   if(secret().length>=16&&secret().length<=512){input.removeAttribute('aria-invalid');return true;}
   input.setAttribute('aria-invalid','true');status('Ключ или пароль должен содержать от 16 до 512 символов.');
   input.focus();return false;
  }
  input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');clearDownload();status('')});
  function publishDownload(raw,name){
   clearDownload();
   downloadUrl=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'}));
   readyLink.href=downloadUrl;readyLink.download=name;readyLink.hidden=false;
   status('Копия проверена. Если скачивание не началось, нажмите «Скачать готовый файл .zbv». Сохраните ключ отдельно.');
   // Keep the visible link available for a real second user gesture even if
   // automatic downloads are blocked after asynchronous encryption.
   try{readyLink.click()}catch(_){}
  }
  let busyControls=['vaultSave','vaultRead','vaultGenerate','vaultClose','vaultSecret','vaultCopy'];
  async function run(fn){if(busy)return;busy=true;for(const id of busyControls)$(id).disabled=true;try{await fn()}catch(e){status(e.message||'Не удалось выполнить операцию')}finally{busy=false;for(const id of busyControls)$(id).disabled=false}}
  btn.onclick=()=>{status('');d.showModal()};
  $('vaultGenerate').onclick=()=>{if(secret()&&!localizedConfirm('Заменить введённый ключ? Старые копии потребуют прежний ключ.'))return;clearDownload();$('vaultSecret').removeAttribute('aria-invalid');$('vaultSecret').value=cryptoApi().recoveryKey();$('vaultSecret').type='text';status('Сохраните ключ в отдельном безопасном месте. Не отправляйте его вместе с резервной копией.')};
  const recovery=document.createElement('button');recovery.type='button';recovery.id='vaultRecoveryBtn';recovery.textContent='Восстановить ключ доступа';recovery.style.cssText='color:#304e69;background:#fff';anchor.append(recovery);
  const rd=document.createElement('dialog');rd.className='storage-dialog';rd.id='vaultRecoveryDialog';
  rd.innerHTML='<form class="storage-shell"><div class="storage-title">Восстановление ключа</div><p>Укажите лицензионный номер и контакт для связи с администратором. Не вводите пароль, лицензионный код или данные клиентов.</p><label>Лицензионный номер<input name="license" required maxlength="120" autocomplete="off" style="width:100%"></label><label>Электронная почта для ответа<input name="email" type="email" required maxlength="254" autocomplete="email" style="width:100%"></label><p>Автоматическая отправка и восстановление пока не подключены. Сохраните запрос и передайте его администратору. Старые копии без ключа пока восстановить нельзя.</p><div class="storage-actions-main"><button type="submit" class="storage-primary">Скачать запрос администратору</button></div><div class="storage-footer"><button type="button" id="vaultRecoveryClose">Закрыть</button></div></form>';
  document.body.append(rd);recovery.onclick=()=>{if(!rd.open)rd.showModal()};rd.querySelector('#vaultRecoveryClose').onclick=()=>rd.close();
  rd.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);download(JSON.stringify({type:'vault-key-recovery-request-v1',license:String(f.get('license')).trim(),email:String(f.get('email')).trim(),createdAt:new Date().toISOString()},null,2),'ZABVENYE-key-recovery-request.json',rd);};
  rd.addEventListener('close',()=>rd.querySelector('form').reset());
  $('vaultCopy').onclick=async()=>{try{await navigator.clipboard.writeText(secret());status('Ключ скопирован. Сохраните его отдельно.')}catch{status('Не удалось скопировать ключ.')}};
  $('vaultClose').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});d.addEventListener('close',()=>{clearDownload();input.value='';input.type='password';input.removeAttribute('aria-invalid')});
  $('vaultSave').onclick=e=>{
   e.preventDefault();e.stopPropagation();
   if(busy||!validateSecret())return;
   clearDownload();const key=secret();
   return run(async()=>{
   status('Собираю данные и файлы…');
   const data=db()?.readState();if(!data||!Array.isArray(data.clients))throw Error('База недоступна');
   const snapshot=JSON.parse(JSON.stringify(data));
   const api=files();if(!api?.list)throw Error('Хранилище вложений не готово. Повторите позже.');
   const records=[];for(const record of await api.list({})){const {blob,...meta}=record;if(!(blob instanceof Blob))throw Error('Вложение недоступно — копия не создана');records.push({meta,bytes:cryptoApi().b64(new Uint8Array(await blob.arrayBuffer()))})}
   const pkg={format:'zbv-backup-v1',state:snapshot,files:records};
   status('Шифрую и проверяю копию…');const raw=await cryptoApi().seal(pkg,key);
   const check=await cryptoApi().open(raw,key,'backup');if(JSON.stringify(check)!==JSON.stringify(pkg))throw Error('Не пройдена проверка копии');
   publishDownload(raw,'ZABVENYE-'+new Date().toISOString().slice(0,10)+'.zbv');
  });};
  $('vaultRead').onclick=()=>$('vaultFile').click();
  $('vaultFile').onchange=()=>{const file=$('vaultFile').files[0];$('vaultFile').value='';if(!file)return;run(async()=>{
   status('Проверяю файл…');const raw=await file.text();let pkg;
   if(file.name.toLowerCase().endsWith('.zbv'))pkg=await cryptoApi().open(raw,secret(),'backup');
   else pkg={format:'legacy-json',state:JSON.parse(raw),files:[]};
   if(!pkg||!Array.isArray(pkg.state?.clients)||!Array.isArray(pkg.files))throw Error('Неверный формат базы');
   // Import into an empty database only; never silently replace existing clients.
   const current=db()?.readState();if(!current||!Array.isArray(current.clients))throw Error('База недоступна');
   if(current.clients.length||current.archivedClients?.length||current.deletedClients?.length)throw Error('Восстановление разрешено только в пустую базу. Сначала сохраните текущую базу отдельно.');
   if(!localizedConfirm('Восстановить клиентов: '+pkg.state.clients.length+'? При импорте старого JSON вложения могут отсутствовать.'))return;
   const api=files();if(!api?.put||!api?.list)throw Error('Хранилище файлов не готово');
   if((await api.list({})).length)throw Error('В браузере уже есть вложения. Восстановление отменено.');
   const prepared=pkg.files.map(f=>{if(!f.meta?.id||!f.meta.clientId||!f.meta.sessionId)throw Error('Некорректное вложение');return {...f.meta,blob:new Blob([cryptoApi().unb64(f.bytes)],{type:f.meta.type||'application/octet-stream'})}});
   const added=[];try{for(const rec of prepared){if(!await api.put(rec,{source:'vault-import'}))throw Error('Не удалось записать вложение');added.push(rec.id)}if(db().writeState(pkg.state,{source:'vault-import'})!==true)throw Error('Не удалось восстановить базу');}catch(e){for(const id of added)try{await api.remove(id,{source:'vault-import-rollback'})}catch{}throw e}
   status('База восстановлена. Страница обновляется.');location.reload();
  })};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createUI,{once:true});else createUI();
})();
