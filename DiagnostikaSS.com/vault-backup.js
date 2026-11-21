'use strict';
(()=>{
 const localizedConfirm=message=>window.confirm(window.DiagnostikaI18n?.translate(message)||message);
 if(location.hostname!=='zabvenye.com')return;
 const cryptoApi=()=>window.DiagnostikaVaultCrypto;
 const db=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
 const files=()=>window.DiagnostikaPlatform?.services?.files;
 const $=id=>document.getElementById(id);
 function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
 function createUI(){
  if($('vaultDialog'))return;
  const anchor=document.querySelector('.storage-dialog .storage-actions-main');if(!anchor)return;
  const btn=document.createElement('button');btn.type='button';btn.id='vaultBackupBtn';btn.className='storage-primary';btn.textContent='Шифрование';btn.title='Шифрование базы';anchor.append(btn);
  const d=document.createElement('dialog');d.id='vaultDialog';d.className='storage-dialog';
  d.innerHTML='<div class="storage-shell"><div class="storage-title">ШИФРОВАНИЕ БАЗЫ</div><p>Формат .zbv · AES-256-GCM. Храните ключ отдельно от базы.</p><label>Ключ шифрования<input id="vaultSecret" type="password" autocomplete="off" minlength="16" maxlength="512" spellcheck="false" autocapitalize="off" style="width:100%"></label><p>От 16 до 512 символов: латинские буквы (A–Z, a–z), цифры (0–9), специальные символы.</p><div class="storage-actions-main"><button id="vaultGenerate" type="button">Создать новый случайный ключ</button><button id="vaultCopy" type="button">Скопировать ключ</button><button id="vaultEncrypt" type="button" class="storage-primary">Зашифровать базу</button><button id="vaultSave" type="button">Скачать базу (.zbv)</button><button id="vaultRead" type="button">Восстановить базу (.zbv)</button></div><input id="vaultFile" type="file" accept=".zbv" hidden><p id="vaultStatus" role="status"></p><div class="storage-footer"><button id="vaultClose" type="button">Закрыть</button></div></div>';
  document.body.append(d);
  const status=t=>{$('vaultStatus').textContent=t};
  const secret=()=>{const value=$('vaultSecret').value;if(!/^[\x21-\x7e]{16,512}$/.test(value))throw Error('Введите от 16 до 512 латинских символов, цифр или специальных символов без пробелов.');return value;};
  let busy=false;
  async function run(fn){if(busy)return;busy=true;for(const id of ['vaultEncrypt','vaultSave','vaultRead','vaultGenerate','vaultClose'])$(id).disabled=true;try{await fn()}catch(e){status(e.message||'Не удалось выполнить операцию')}finally{busy=false;for(const id of ['vaultEncrypt','vaultSave','vaultRead','vaultGenerate','vaultClose'])$(id).disabled=false}}
  btn.onclick=()=>{status('');d.showModal()};
  $('vaultGenerate').onclick=()=>{if($('vaultSecret').value&&!localizedConfirm('Заменить введённый ключ? Старые копии потребуют прежний ключ.'))return;$('vaultSecret').value=cryptoApi().recoveryKey();$('vaultSecret').type='text';status('Сохраните ключ в отдельном безопасном месте. Не отправляйте его вместе с резервной копией.')};
  const recovery=document.createElement('button');recovery.type='button';recovery.id='vaultRecoveryBtn';recovery.textContent='Восстановить ключ доступа';recovery.style.cssText='color:#304e69;background:#fff';anchor.append(recovery);
  const rd=document.createElement('dialog');rd.className='storage-dialog';rd.id='vaultRecoveryDialog';
  rd.innerHTML='<form class="storage-shell"><div class="storage-title">Восстановление ключа</div><p>Укажите лицензионный номер и контакт для связи с администратором. Не вводите пароль, лицензионный код или данные клиентов.</p><label>Лицензионный номер<input name="license" required maxlength="120" autocomplete="off" style="width:100%"></label><label>Электронная почта для ответа<input name="email" type="email" required maxlength="254" autocomplete="email" style="width:100%"></label><p>Автоматическая отправка и восстановление пока не подключены. Сохраните запрос и передайте его администратору. Старые копии без ключа пока восстановить нельзя.</p><div class="storage-actions-main"><button type="submit" class="storage-primary">Скачать запрос администратору</button></div><div class="storage-footer"><button type="button" id="vaultRecoveryClose">Закрыть</button></div></form>';
  document.body.append(rd);recovery.onclick=()=>{if(!rd.open)rd.showModal()};rd.querySelector('#vaultRecoveryClose').onclick=()=>rd.close();
  rd.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);download(JSON.stringify({type:'vault-key-recovery-request-v1',license:String(f.get('license')).trim(),email:String(f.get('email')).trim(),createdAt:new Date().toISOString()},null,2),'ZABVENYE-key-recovery-request.json');};
  rd.addEventListener('close',()=>rd.querySelector('form').reset());
  $('vaultCopy').onclick=async()=>{try{await navigator.clipboard.writeText(secret());status('Ключ скопирован. Сохраните его отдельно.')}catch{status('Не удалось скопировать ключ.')}};
  $('vaultClose').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});d.addEventListener('close',()=>{$('vaultSecret').value='';$('vaultSecret').type='password'});
  $('vaultEncrypt').onclick=()=>run(async()=>{
   const key=secret(), storage=window.DiagnostikaEncryptedStorage;
   if(typeof storage?.activate!=='function')throw Error('Шифрование рабочей базы ещё не подключено. Данные не изменены.');
   status('Шифрую рабочую базу…');
   await storage.activate(key);
   status('Рабочая база зашифрована.');
  });
  $('vaultSave').onclick=()=>run(async()=>{
   if(!secret())throw Error('Введите ключ или создайте новый');
   status('Собираю данные и файлы…');
   const data=db()?.readState();if(!data||!Array.isArray(data.clients))throw Error('База недоступна');
   const snapshot=JSON.parse(JSON.stringify(data));
   const api=files();if(!api?.list)throw Error('Хранилище вложений не готово. Повторите позже.');
   status('Шифрую и проверяю копию…');const raw=await cryptoApi().packDatabase(snapshot,await api.list({}),secret());
   download(raw,'ZABVENYE-'+new Date().toISOString().slice(0,10)+'.zbv');status('Файл .zbv проверен и передан браузеру для скачивания. Сохраните также ключ.');
  });
  $('vaultRead').onclick=()=>$('vaultFile').click();
  $('vaultFile').onchange=()=>{const file=$('vaultFile').files[0];$('vaultFile').value='';if(!file)return;run(async()=>{
   status('Проверяю файл…');const raw=await file.text();let pkg;
   if(!file.name.toLowerCase().endsWith('.zbv'))throw Error('Выберите файл .zbv');
   pkg=await cryptoApi().openDatabase(raw,secret());
   if(!pkg||!Array.isArray(pkg.state?.clients)||!Array.isArray(pkg.files))throw Error('Неверный формат базы');
   // Import into an empty database only; never silently replace existing clients.
   const current=db()?.readState();if(!current||!Array.isArray(current.clients))throw Error('База недоступна');
   if(current.clients.length||current.archivedClients?.length||current.deletedClients?.length)throw Error('Восстановление разрешено только в пустую базу. Сначала сохраните текущую базу отдельно.');
   if(!localizedConfirm('Восстановить клиентов: '+pkg.state.clients.length+'? '))return;
   const api=files();if(!api?.put||!api?.list)throw Error('Хранилище файлов не готово');
   if((await api.list({})).length)throw Error('В браузере уже есть вложения. Восстановление отменено.');
   const prepared=pkg.files.map(f=>{if(!f.meta?.id||!f.meta.clientId||!f.meta.sessionId)throw Error('Некорректное вложение');return {...f.meta,blob:new Blob([cryptoApi().unb64(f.bytes)],{type:f.meta.type||'application/octet-stream'})}});
   const added=[];try{for(const rec of prepared){if(!await api.put(rec,{source:'vault-import'}))throw Error('Не удалось записать вложение');added.push(rec.id)}if(db().writeState(pkg.state,{source:'vault-import'})!==true)throw Error('Не удалось восстановить базу');}catch(e){for(const id of added)try{await api.remove(id,{source:'vault-import-rollback'})}catch{}throw e}
   status('База восстановлена. Страница обновляется.');location.reload();
  })};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createUI,{once:true});else createUI();
})();
