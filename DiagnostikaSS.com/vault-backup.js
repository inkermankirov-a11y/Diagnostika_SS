'use strict';
(()=>{
 if(location.hostname!=='zabvenye.com')return;
 const cryptoApi=()=>window.DiagnostikaVaultCrypto;
 const db=()=>window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
 const files=()=>window.DiagnostikaPlatform?.services?.files;
 const $=id=>document.getElementById(id);
 function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/octet-stream'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
 function createUI(){
  if($('vaultDialog'))return;
  const anchor=$('storageBtn');if(!anchor)return;
  const btn=document.createElement('button');btn.type='button';btn.id='vaultBackupBtn';btn.className='header-btn';btn.textContent='Vault';btn.title='Зашифрованные резервные копии';anchor.after(btn);
  const d=document.createElement('dialog');d.id='vaultDialog';d.className='storage-dialog';
  d.innerHTML='<div class="storage-shell"><div class="storage-title">ZABVENYE Vault</div><p>Зашифрованная резервная копия. Ключ храните отдельно от файла: восстановить потерянный ключ невозможно.</p><label>Ключ восстановления или пароль (от 16 символов)<input id="vaultSecret" type="password" autocomplete="off" style="width:100%"></label><div class="storage-actions-main"><button id="vaultGenerate" type="button">Создать новый случайный ключ</button><button id="vaultCopy" type="button">Скопировать ключ</button><button id="vaultSave" type="button" class="storage-primary">Скачать зашифрованную копию .zbv</button><button id="vaultRead" type="button">Восстановить из .zbv / старого JSON</button></div><input id="vaultFile" type="file" accept=".zbv,.json" hidden><p id="vaultStatus" role="status"></p><div class="storage-footer"><button id="vaultClose" type="button">Закрыть</button></div></div>';
  document.body.append(d);
  const status=t=>{$('vaultStatus').textContent=t};
  const secret=()=>$('vaultSecret').value;
  let busy=false;
  async function run(fn){if(busy)return;busy=true;for(const id of ['vaultSave','vaultRead','vaultGenerate','vaultClose'])$(id).disabled=true;try{await fn()}catch(e){status(e.message||'Не удалось выполнить операцию')}finally{busy=false;for(const id of ['vaultSave','vaultRead','vaultGenerate','vaultClose'])$(id).disabled=false}}
  btn.onclick=()=>{status('');d.showModal()};
  $('vaultGenerate').onclick=()=>{if(secret()&&!confirm('Заменить введённый ключ? Старые копии потребуют прежний ключ.'))return;$('vaultSecret').value=cryptoApi().recoveryKey();$('vaultSecret').type='text';status('Сохраните ключ в отдельном безопасном месте. Не отправляйте его вместе с резервной копией.')};
  $('vaultCopy').onclick=async()=>{try{await navigator.clipboard.writeText(secret());status('Ключ скопирован. Сохраните его отдельно.')}catch{status('Не удалось скопировать ключ.')}};
  $('vaultClose').onclick=()=>d.close();d.addEventListener('cancel',e=>{if(busy)e.preventDefault()});d.addEventListener('close',()=>{$('vaultSecret').value='';$('vaultSecret').type='password'});
  $('vaultSave').onclick=()=>run(async()=>{
   if(!secret())throw Error('Введите ключ или создайте новый');
   status('Собираю данные и файлы…');
   const data=db()?.readState();if(!data||!Array.isArray(data.clients))throw Error('База недоступна');
   const snapshot=JSON.parse(JSON.stringify(data));
   const api=files();if(!api?.list)throw Error('Хранилище вложений не готово. Повторите позже.');
   const records=[];for(const record of await api.list({})){const {blob,...meta}=record;if(!(blob instanceof Blob))throw Error('Вложение недоступно — копия не создана');records.push({meta,bytes:cryptoApi().b64(new Uint8Array(await blob.arrayBuffer()))})}
   const pkg={format:'zbv-backup-v1',state:snapshot,files:records};
   status('Шифрую и проверяю копию…');const raw=await cryptoApi().seal(pkg,secret());
   const check=await cryptoApi().open(raw,secret(),'backup');if(JSON.stringify(check)!==JSON.stringify(pkg))throw Error('Не пройдена проверка копии');
   download(raw,'ZABVENYE-'+new Date().toISOString().slice(0,10)+'.zbv');status('Зашифрованная копия проверена и передана браузеру для скачивания. Сохраните также ключ.');
  });
  $('vaultRead').onclick=()=>$('vaultFile').click();
  $('vaultFile').onchange=()=>{const file=$('vaultFile').files[0];$('vaultFile').value='';if(!file)return;run(async()=>{
   status('Проверяю файл…');const raw=await file.text();let pkg;
   if(file.name.toLowerCase().endsWith('.zbv'))pkg=await cryptoApi().open(raw,secret(),'backup');
   else pkg={format:'legacy-json',state:JSON.parse(raw),files:[]};
   if(!pkg||!Array.isArray(pkg.state?.clients)||!Array.isArray(pkg.files))throw Error('Неверный формат базы');
   // Import into an empty database only; never silently replace existing clients.
   const current=db()?.readState();if(!current||!Array.isArray(current.clients))throw Error('База недоступна');
   if(current.clients.length||current.archivedClients?.length||current.deletedClients?.length)throw Error('Восстановление разрешено только в пустую базу. Сначала сохраните текущую базу отдельно.');
   if(!confirm('Восстановить клиентов: '+pkg.state.clients.length+'? При импорте старого JSON вложения могут отсутствовать.'))return;
   const api=files();if(!api?.put||!api?.list)throw Error('Хранилище файлов не готово');
   if((await api.list({})).length)throw Error('В браузере уже есть вложения. Восстановление отменено.');
   const prepared=pkg.files.map(f=>{if(!f.meta?.id||!f.meta.clientId||!f.meta.sessionId)throw Error('Некорректное вложение');return {...f.meta,blob:new Blob([cryptoApi().unb64(f.bytes)],{type:f.meta.type||'application/octet-stream'})}});
   const added=[];try{for(const rec of prepared){if(!await api.put(rec,{source:'vault-import'}))throw Error('Не удалось записать вложение');added.push(rec.id)}if(db().writeState(pkg.state,{source:'vault-import'})!==true)throw Error('Не удалось восстановить базу');}catch(e){for(const id of added)try{await api.remove(id,{source:'vault-import-rollback'})}catch{}throw e}
   status('База восстановлена. Страница обновляется.');location.reload();
  })};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',createUI,{once:true});else createUI();
})();
