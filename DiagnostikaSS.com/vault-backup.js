'use strict';
(()=>{
 const localizedConfirm=message=>window.confirm(window.DiagnostikaI18n?.translate(message)||message);
 if(location.hostname!=='zabvenye.com')return;
 const cryptoApi=()=>window.DiagnostikaVaultCrypto;
 const db=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
 const files=()=>window.DiagnostikaPlatform?.services?.files;
 const folder=()=>window.DiagnostikaFolderVault;
 const $=id=>document.getElementById(id);
 function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 function createUI(){
  if($('vaultDialog'))return;
  const anchor=document.querySelector('.storage-dialog .storage-actions-main');if(!anchor)return;
  const btn=document.createElement('button');btn.type='button';btn.id='vaultBackupBtn';btn.className='storage-primary';btn.textContent='Шифрование';btn.title='Шифрование базы';anchor.append(btn);
  const d=document.createElement('dialog');d.id='vaultDialog';d.className='storage-dialog';
  d.innerHTML='<div class="storage-shell"><div class="storage-title">ШИФРОВАНИЕ БАЗЫ</div><p>Формат .zbv · AES-256-GCM. Шифруется папка; рабочий кеш браузера пока не шифруется. Ключ храните отдельно.</p><label>Ключ шифрования<input id="vaultSecret" type="password" autocomplete="off" minlength="16" maxlength="512" spellcheck="false" autocapitalize="off" style="width:100%"></label><p>От 16 до 512 символов: латинские буквы (A–Z, a–z), цифры (0–9), специальные символы.</p><div class="storage-actions-main"><button id="vaultGenerate" type="button">Создать новый случайный ключ</button><button id="vaultCopy" type="button">Скопировать ключ</button><button id="vaultEncrypt" type="button" class="storage-primary">Зашифровать базу</button><button id="vaultSave" type="button">Скачать базу (.zbv)</button><button id="vaultRead" type="button">Восстановить базу (.zbv)</button></div><input id="vaultFile" type="file" accept=".zbv" hidden><p id="vaultStatus" role="status"></p><div class="storage-footer"><button id="vaultClose" type="button">Закрыть</button></div></div>';
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
   const key=secret(),storage=folder(),manager=window.DiagnostikaLocalFolderSync;
   if(!storage||!manager)throw Error('Модуль шифрования не загрузился.');const root=await storage.savedHandle();if(!root)throw Error('Сначала подключите папку.');
   await manager.begin(root);try{status('Шифрую и проверяю папку…');await storage.activate(key,root);manager.finishEncrypted();status('Папка зашифрована: database.zbv. Ключ сохраните отдельно.');}catch(e){manager.fail(e);throw e;}
  });
  $('vaultSave').onclick=()=>run(async()=>{
   status('Проверяю и сохраняю базу…');
   const storage=folder(),manager=window.DiagnostikaLocalFolderSync;if(!storage)throw Error('Модуль шифрования недоступен.');
   const root=await storage.savedHandle();if(!root)throw Error('Сначала подключите папку.');await manager.begin(root);try{const raw=await storage.download(secret());manager.finishEncrypted();download(raw,'database.zbv');status('Файл .zbv передан браузеру для скачивания.');}catch(e){manager.fail(e);throw e;}
  });
  $('vaultRead').onclick=()=>$('vaultFile').click();
  $('vaultFile').onchange=()=>{const file=$('vaultFile').files[0];$('vaultFile').value='';if(!file)return;run(async()=>{
   status('Проверяю файл…');if(!file.name.toLowerCase().endsWith('.zbv'))throw Error('Выберите файл .zbv');
   const storage=folder(),manager=window.DiagnostikaLocalFolderSync,raw=await file.text();if(!storage)throw Error('Модуль шифрования недоступен.');
   const key=secret();await cryptoApi().openDatabase(raw,key);if(!localizedConfirm('Восстановить зашифрованную базу в пустое рабочее пространство?'))return;
   const root=await storage.savedHandle();if(!root)throw Error('Сначала подключите пустую папку.');await manager.begin(root);
   try{await storage.restoreFile(raw,key);manager.finishEncrypted();status('База восстановлена.');location.reload();}catch(e){manager.fail(e);throw e;}
  })};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createUI,{once:true});else createUI();
})();
