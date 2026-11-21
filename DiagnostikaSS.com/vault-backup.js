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
  d.innerHTML='<div class="storage-shell"><div class="storage-title">ШИФРОВАНИЕ БАЗЫ</div><p>Формат .zbv · AES-256-GCM.</p><p style="color:#b42318;font-weight:600">Шифруется папка; рабочий кеш браузера пока не шифруется. Ключ храните отдельно.</p><label>Ключ шифрования<input id="vaultSecret" placeholder="Введите ключ сюда" type="password" autocomplete="off" minlength="16" maxlength="512" spellcheck="false" autocapitalize="off" style="width:100%"></label><p id="vaultKeyStatus" role="status"></p><p>От 16 до 512 символов: латинские буквы (A–Z, a–z), цифры (0–9), специальные символы.</p><div class="storage-actions-main"><button id="vaultGenerate" type="button" title="Создаётся случайный ключ AES-256. Обязательно сохраните его отдельно.">Создать новый случайный ключ</button><button id="vaultCopy" type="button">Скопировать ключ</button><button id="vaultEncrypt" type="button" class="storage-primary">Зашифровать базу</button><button id="vaultSave" disabled type="button">Скачать базу (.zbv)</button><button id="vaultRead" type="button">Восстановить базу (.zbv)</button><button id="vaultRecoveryInside" type="button">Восстановление ключа по лицензии</button></div><input id="vaultFile" type="file" accept=".zbv" hidden><p id="vaultStatus" role="status"></p><div class="storage-footer"><button id="vaultClose" type="button">Закрыть</button></div></div>';
  document.body.append(d);
  const status=t=>{$('vaultStatus').textContent=t};
  const secret=()=>{const value=$('vaultSecret').value;if(!/^[\x21-\x7e]{16,512}$/.test(value))throw Error('Введите от 16 до 512 латинских символов, цифр или специальных символов без пробелов.');return value;};
  let busy=false,valid=false,seq=0,timer=null;
  function keyStatus(state,message){valid=state==='valid';const input=$('vaultSecret'),label=$('vaultKeyStatus');input.style.outline=state==='valid'?'2px solid #16834b':state==='invalid'?'2px solid #b42318':'';label.style.color=state==='valid'?'#16834b':state==='invalid'?'#b42318':'';label.textContent=message;input.setAttribute('aria-invalid',String(state==='invalid'));$('vaultSave').disabled=busy||!valid;}
  function check(){clearTimeout(timer);const token=++seq,value=$('vaultSecret').value;keyStatus('neutral','');if(!value)return;if(!/^[\x21-\x7e]{16,512}$/.test(value)){keyStatus('invalid','Проверьте формат ключа');return;}keyStatus('neutral','Проверка ключа…');timer=setTimeout(async()=>{try{const result=await folder().verifyKey(value);if(token!==seq||!d.open)return;if(result.state==='valid')keyStatus('valid','Ключ введён верно');else keyStatus('neutral',result.state==='new'?'Новая база: ключ будет проверен при шифровании.':'Подключите папку или выберите файл для восстановления.');}catch(e){if(token===seq&&d.open)keyStatus('invalid','Ключ не подходит или файл недоступен');}},350);}
  $('vaultSecret').addEventListener('input',check);
  async function run(fn){if(busy)return;busy=true;for(const id of ['vaultEncrypt','vaultSave','vaultRead','vaultGenerate','vaultClose','vaultRecoveryInside'])$(id).disabled=true;try{await fn()}catch(e){status(e.message||'Не удалось выполнить операцию')}finally{busy=false;for(const id of ['vaultEncrypt','vaultRead','vaultGenerate','vaultClose','vaultRecoveryInside'])$(id).disabled=false;check()}}
  btn.onclick=()=>{status('');d.showModal();check()};
  $('vaultGenerate').onclick=()=>{if($('vaultSecret').value&&!localizedConfirm('Заменить введённый ключ? Старые копии потребуют прежний ключ.'))return;$('vaultSecret').value=cryptoApi().recoveryKey();$('vaultSecret').type='password';check();status('Сохраните ключ отдельно. Нажмите «Скопировать ключ».')};
  const recovery=document.createElement('button');recovery.type='button';recovery.id='vaultRecoveryBtn';recovery.textContent='Восстановление ключа по лицензии';anchor.append(recovery);
  const rd=document.createElement('dialog');rd.className='storage-dialog';rd.id='vaultRecoveryDialog';
  rd.innerHTML='<form class="storage-shell"><div class="storage-title">ВОССТАНОВЛЕНИЕ КЛЮЧА</div><p>Войдите в свой аккаунт и подтвердите активированную лицензию паролем аккаунта. Для восстановления необходимо заранее подключить эту функцию к базе.</p><label>Номер лицензии<input name="license" required inputmode="numeric" pattern="[0-9]{6,12}" autocomplete="off" style="width:100%"></label><label>Пароль аккаунта<input name="password" type="password" required autocomplete="current-password" style="width:100%"></label><p id="vaultRecoveryStatus" role="status"></p><div class="storage-actions-main"><button type="button" id="vaultEnroll">Подключить восстановление (с действующим ключом)</button><button type="submit" id="vaultRotate" class="storage-primary">Получить новый ключ</button><button type="button" id="vaultNewCopy" hidden>Скопировать новый ключ</button></div><div class="storage-footer"><button type="button" id="vaultRecoveryClose">Закрыть</button></div></form>';
  document.body.append(rd);let issuedKey=null,recoveryBusy=false;
  const rs=t=>{$('vaultRecoveryStatus').textContent=t};
  async function openRecovery(){if(rd.open)return;if(!d.open){d.showModal();check()}rd.querySelector('form').reset();issuedKey=null;$('vaultNewCopy').hidden=true;rd.showModal();const info=await folder().recoveryInfo();if(rd.open)rs(info.enrolled?'Восстановление подключено. Можно перевыпустить ключ.':'Для этой базы сначала подключите восстановление с действующим ключом.');}
  recovery.onclick=openRecovery;$('vaultRecoveryInside').onclick=openRecovery;
  $('vaultRecoveryClose').onclick=()=>{if(!recoveryBusy)rd.close()};rd.addEventListener('cancel',e=>{if(recoveryBusy)e.preventDefault()});rd.addEventListener('close',()=>{rd.querySelector('form').reset();issuedKey=null;});
  async function recoveryAction(mode){if(recoveryBusy)return;const form=rd.querySelector('form');if(!form.reportValidity())return;const f=new FormData(form),license=String(f.get('license')).trim(),password=String(f.get('password'));form.elements.password.value='';recoveryBusy=true;$('vaultEnroll').disabled=$('vaultRotate').disabled=$('vaultRecoveryClose').disabled=true;try{rs('Проверяю лицензию и базу…');if(mode==='enroll'){await folder().enrollRecovery(secret(),license,password);rs('Восстановление подключено.');}else{const next=await folder().recoverKey(license,password);issuedKey=next;$('vaultSecret').value=next;$('vaultSecret').type='password';$('vaultNewCopy').hidden=false;rs('Новый ключ создан, база проверена. Скопируйте ключ и сохраните отдельно. Старые скачанные копии требуют прежнего ключа или собственного механизма восстановления.');}check();}catch(e){rs(e.message||'Не удалось восстановить ключ.')}finally{recoveryBusy=false;$('vaultEnroll').disabled=$('vaultRotate').disabled=$('vaultRecoveryClose').disabled=false}}
  $('vaultEnroll').onclick=()=>recoveryAction('enroll');rd.querySelector('form').onsubmit=e=>{e.preventDefault();void recoveryAction('recover')};$('vaultNewCopy').onclick=async()=>{if(issuedKey){try{await navigator.clipboard.writeText(issuedKey);rs('Новый ключ скопирован. Сохраните его отдельно.')}catch{rs('Не удалось скопировать ключ. Закройте окно и используйте «Скопировать ключ».')}}};
  $('vaultCopy').onclick=async()=>{try{await navigator.clipboard.writeText(secret());status('Ключ скопирован. Сохраните его отдельно.')}catch{status('Не удалось скопировать ключ.')}};
  $('vaultClose').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});d.addEventListener('close',()=>{clearTimeout(timer);seq++;$('vaultSecret').value='';$('vaultSecret').type='password';keyStatus('neutral','')});
  $('vaultEncrypt').onclick=()=>run(async()=>{
   const key=secret(),storage=folder(),manager=window.DiagnostikaLocalFolderSync;
   if(!storage||!manager)throw Error('Модуль шифрования не загрузился.');const root=await storage.savedHandle();if(!root)throw Error('Сначала подключите папку.');
   await manager.begin(root);try{status('Шифрую и проверяю папку…');await storage.activate(key,root);manager.finishEncrypted();status('Папка зашифрована: database.zbv. Ключ сохраните отдельно.');}catch(e){manager.fail(e);throw e;}
  });
  $('vaultSave').onclick=()=>run(async()=>{
   if(!valid)throw Error('Сначала введите правильный ключ.');status('Проверяю и сохраняю базу…');
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
