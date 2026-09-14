'use strict';

(() => {
  if(window.__diagnostikaAccountSettingsReady) return;
  window.__diagnostikaAccountSettingsReady=true;

  const NAME_KEY='diagnostika-specialist-name';
  const AVATAR_KEY='diagnostika-specialist-avatar';

  const LABELS={
    ru:{accounts:'Учетные записи',name:'Имя специалиста',hint:'Укажи своё имя. Оно будет записываться при передаче клиентов.',save:'Сохранить',saved:'Сохранено',changeAvatar:'Изменить аватар',empty:'Имя специалиста'},
    en:{accounts:'Accounts',name:'Specialist name',hint:'Enter your name. It will be recorded when clients are transferred.',save:'Save',saved:'Saved',changeAvatar:'Change avatar',empty:'Specialist name'},
    fr:{accounts:'Comptes',name:'Nom du spécialiste',hint:'Indiquez votre nom. Il sera enregistré lors du transfert des clients.',save:'Enregistrer',saved:'Enregistré',changeAvatar:"Changer l’avatar",empty:'Nom du spécialiste'},
    de:{accounts:'Konten',name:'Name des Spezialisten',hint:'Gib deinen Namen an. Er wird bei der Übertragung von Klienten gespeichert.',save:'Speichern',saved:'Gespeichert',changeAvatar:'Avatar ändern',empty:'Name des Spezialisten'},
    it:{accounts:'Account',name:'Nome dello specialista',hint:'Inserisci il tuo nome. Verrà registrato durante il trasferimento dei clienti.',save:'Salva',saved:'Salvato',changeAvatar:'Cambia avatar',empty:'Nome dello specialista'}
  };

  function currentLang(){
    const lang=window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'ru';
    return LABELS[lang]?lang:'ru';
  }
  function t(){return LABELS[currentLang()];}
  function getName(){return String(localStorage.getItem(NAME_KEY)||'').trim();}
  function getAvatar(){return String(localStorage.getItem(AVATAR_KEY)||'');}
  function initials(name){
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return '👤';
    return (parts[0][0]+(parts[1]?.[0]||'')).toUpperCase();
  }

  const style=document.createElement('style');
  style.textContent=`
    .settings-profile-summary{display:flex;align-items:center;gap:11px;padding:8px 7px 10px;border-bottom:1px solid #e4eaf0;margin-bottom:2px}
    .settings-profile-avatar{width:46px;height:46px;border-radius:50%;border:1px solid #cbd5e1;background:#eef3f8;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;color:#405268;font-weight:900;font-size:15px;cursor:pointer;position:relative}
    .settings-profile-avatar img{width:100%;height:100%;object-fit:cover;display:block}
    .settings-profile-name{min-width:0;font-size:13px;font-weight:900;color:#2f4154;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .settings-profile-sub{margin-top:2px;font-size:10.5px;color:#8190a2}
    .settings-account-content{display:none;border:1px solid #d8e1ea;border-radius:11px;background:#f8fafc;padding:9px;gap:8px}
    .settings-account-content.open{display:grid}
    .account-avatar-large{display:grid;justify-items:center;gap:6px;padding:4px 0 6px}
    .account-avatar-large .settings-profile-avatar{width:72px;height:72px;font-size:22px}
    .account-avatar-change{border:0;background:transparent;color:#55779b;font-size:10.5px;text-decoration:underline;cursor:pointer}
    .account-name-preview{font-size:14px;font-weight:900;color:#2f4154;text-align:center;min-height:18px}
    .account-field{display:grid;gap:6px}
    .account-label{font-size:12px;font-weight:900;color:#26384b}
    .account-input{width:100%;box-sizing:border-box;height:36px;border:1px solid #b9c9d9;border-radius:8px;background:#fff;padding:0 10px;font-size:13px;color:#26384b;outline:none}
    .account-input:focus{border-color:#4f8fd8;box-shadow:0 0 0 2px rgba(79,143,216,.13)}
    .account-hint{font-size:10.5px;line-height:1.35;color:#728399}
    .account-save{height:36px;border:0;border-radius:8px;background:linear-gradient(#47b47d,#24945f);color:#fff;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 3px 7px rgba(36,148,95,.22)}
    .account-save:hover{filter:brightness(1.04)}
  `;
  document.head.appendChild(style);

  function attach(){
    const panel=document.getElementById('settingsPanel');
    const accountsBtn=panel?.querySelector('.settings-accounts-btn');
    if(!panel||!accountsBtn) return false;
    if(panel.querySelector('.settings-account-content')) return true;

    const summary=document.createElement('div');
    summary.className='settings-profile-summary';
    summary.innerHTML=`
      <button type="button" class="settings-profile-avatar" aria-label="Avatar"><span class="avatar-fallback">👤</span></button>
      <div class="settings-profile-copy"><div class="settings-profile-name"></div><div class="settings-profile-sub"></div></div>`;
    panel.insertBefore(summary,panel.firstChild);

    const content=document.createElement('div');
    content.className='settings-account-content';
    content.innerHTML=`
      <div class="account-avatar-large">
        <button type="button" class="settings-profile-avatar account-avatar-button" aria-label="Avatar"><span class="avatar-fallback">👤</span></button>
        <button type="button" class="account-avatar-change"></button>
        <div class="account-name-preview"></div>
      </div>
      <div class="account-field">
        <div class="account-label"></div>
        <input class="account-input" type="text" autocomplete="name">
        <div class="account-hint"></div>
        <button type="button" class="account-save"></button>
      </div>
      <input class="account-avatar-input" type="file" accept="image/*" hidden>`;
    accountsBtn.insertAdjacentElement('afterend',content);

    const accountInput=content.querySelector('.account-input');
    const avatarInput=content.querySelector('.account-avatar-input');
    const saveBtn=content.querySelector('.account-save');
    const avatars=[summary.querySelector('.settings-profile-avatar'),content.querySelector('.account-avatar-button')];

    function paintAvatar(){
      const avatar=getAvatar();
      const name=getName();
      avatars.forEach(el=>{
        el.innerHTML='';
        if(avatar){const img=document.createElement('img');img.src=avatar;img.alt='';el.appendChild(img);}
        else{const span=document.createElement('span');span.className='avatar-fallback';span.textContent=initials(name);el.appendChild(span);}
      });
    }
    function render(){
      const tr=t();
      const name=getName();
      summary.querySelector('.settings-profile-name').textContent=name||tr.empty;
      summary.querySelector('.settings-profile-sub').textContent=tr.accounts;
      content.querySelector('.account-name-preview').textContent=name||tr.empty;
      content.querySelector('.account-label').textContent=tr.name;
      content.querySelector('.account-hint').textContent=tr.hint;
      content.querySelector('.account-avatar-change').textContent=tr.changeAvatar;
      saveBtn.textContent=tr.save;
      if(document.activeElement!==accountInput) accountInput.value=name;
      paintAvatar();
    }

    accountsBtn.addEventListener('click',e=>{
      e.stopImmediatePropagation();
      e.preventDefault();
      const open=!content.classList.contains('open');
      content.classList.toggle('open',open);
      accountsBtn.classList.toggle('active',open);
      const interfaceContent=panel.querySelector('.settings-interface-content');
      const interfaceBtn=panel.querySelector('.settings-interface-btn');
      if(open){interfaceContent?.classList.remove('open');interfaceBtn?.classList.remove('active');}
      render();
    },true);

    saveBtn.onclick=e=>{
      e.stopPropagation();
      localStorage.setItem(NAME_KEY,accountInput.value.trim());
      render();
      const old=saveBtn.textContent;
      saveBtn.textContent=t().saved;
      setTimeout(()=>{saveBtn.textContent=t().save;},900);
      window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:{name:getName(),avatar:getAvatar()}}));
    };

    function openAvatarPicker(e){e?.stopPropagation();avatarInput.click();}
    avatars.forEach(x=>x.addEventListener('click',openAvatarPicker));
    content.querySelector('.account-avatar-change').onclick=openAvatarPicker;
    avatarInput.onchange=()=>{
      const file=avatarInput.files?.[0];
      if(!file) return;
      if(!file.type.startsWith('image/')) return;
      const reader=new FileReader();
      reader.onload=()=>{
        try{localStorage.setItem(AVATAR_KEY,String(reader.result||''));}catch(err){console.warn('Avatar save failed',err);}
        render();
        window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:{name:getName(),avatar:getAvatar()}}));
      };
      reader.readAsDataURL(file);
      avatarInput.value='';
    };

    window.addEventListener('diagnostika-language-changed',()=>setTimeout(render,0));
    render();
    window.DiagnostikaSpecialistProfile={getName,getAvatar,nameKey:NAME_KEY,avatarKey:AVATAR_KEY};
    return true;
  }

  if(!attach()){
    const obs=new MutationObserver(()=>{if(attach()) obs.disconnect();});
    obs.observe(document.body,{childList:true,subtree:true});
  }
})();
