'use strict';

(() => {
  if (window.__formIntegrationsLockReady) return;
  window.__formIntegrationsLockReady = true;

  const dlg=document.getElementById('formIntegrationsDialog');
  if(!dlg) return;

  const q=id=>document.getElementById(id);
  const card=dlg.querySelector('.fi-card');
  if(!card) return;

  let locked=true;

  const bar=document.createElement('div');
  bar.id='fiConfigLockBar';
  bar.className='fi-lockbar';
  bar.innerHTML=`
    <div class="fi-lock-state"><span class="fi-lock-icon">🔒</span><span class="fi-lock-text">Настройки заблокированы</span></div>
    <button type="button" id="fiConfigLockToggle">Разблокировать</button>`;

  const title=card.querySelector('.fi-title');
  if(title) title.insertAdjacentElement('afterend',bar);
  else card.prepend(bar);

  const style=document.createElement('style');
  style.textContent=`
    .fi-lockbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-4px 0 14px;padding:10px 12px;border:1px solid #d7dee8;border-radius:10px;background:#f8fafc}
    .fi-lock-state{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:#475569}.fi-lock-icon{font-size:17px}.fi-lockbar button{height:34px;padding:0 12px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-weight:900;cursor:pointer;color:#334155}
    .fi-lockbar.unlocked{background:#fff7ed;border-color:#fdba74}.fi-lockbar.unlocked .fi-lock-state{color:#9a3412}.fi-lockbar.unlocked button{border-color:#fb923c;color:#9a3412}
    .fi-config-locked input[readonly],.fi-config-locked input:disabled{background:#f1f5f9!important;color:#475569!important;cursor:default}.fi-config-locked button:disabled{opacity:.45;cursor:not-allowed!important;filter:grayscale(.2)}
    @media(max-width:650px){.fi-lockbar{align-items:stretch;flex-direction:column}.fi-lockbar button{width:100%}}
  `;
  document.head.appendChild(style);

  const editableTextIds=['fiSpecialistId','fiSpecialistName','fiAccessKey','fiYandexKey'];
  const dangerousButtonIds=['fiGenId','fiGenAccess','fiGenYandex'];
  const alwaysReadonlyIds=['fiInboxUrl','fiYandexUrl'];
  const toggle=q('fiConfigLockToggle');
  const saveBtn=q('fiSave');

  function applyState(){
    dlg.classList.toggle('fi-config-locked',locked);
    bar.classList.toggle('unlocked',!locked);
    const icon=bar.querySelector('.fi-lock-icon');
    const text=bar.querySelector('.fi-lock-text');
    if(icon) icon.textContent=locked?'🔒':'🔓';
    if(text) text.textContent=locked?'Настройки заблокированы':'Редактирование разрешено';
    if(toggle) toggle.textContent=locked?'Разблокировать':'Заблокировать';

    editableTextIds.forEach(id=>{
      const el=q(id);
      if(el) el.readOnly=locked;
    });
    alwaysReadonlyIds.forEach(id=>{
      const el=q(id);
      if(el) el.readOnly=true;
    });

    const enabled=q('fiYandexEnabled');
    if(enabled) enabled.disabled=locked;
    dangerousButtonIds.forEach(id=>{const b=q(id);if(b)b.disabled=locked;});
    if(saveBtn) saveBtn.disabled=locked;
  }

  function lock(){locked=true;applyState();}
  function unlock(){
    const ok=window.confirm('Разблокировать настройки интеграции? Изменение ID или ключей может нарушить получение анкет.');
    if(!ok) return;
    locked=false;
    applyState();
  }

  toggle?.addEventListener('click',()=>locked?unlock():lock());

  if(saveBtn && typeof saveBtn.onclick==='function'){
    const originalSave=saveBtn.onclick;
    saveBtn.onclick=async function(e){
      if(locked) return;
      try{return await originalSave.call(this,e);}
      finally{lock();}
    };
  }

  dlg.addEventListener('close',lock);
  dlg.addEventListener('cancel',()=>setTimeout(lock,0));

  // Окно всегда открывается в безопасном режиме. Копирующие кнопки не блокируются.
  lock();

  window.DiagnostikaIntegrationLock={lock,unlock,isLocked:()=>locked};
})();
