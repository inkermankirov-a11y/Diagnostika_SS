'use strict';

(() => {
  if (window.__diagnostikaAccountSettingsReady) return;
  window.__diagnostikaAccountSettingsReady = true;

  const NAME_KEY = 'diagnostika-specialist-name';
  const AVATAR_KEY = 'diagnostika-specialist-avatar';

  const LABELS = {
    ru:{accounts:'Учетные записи',name:'Имя специалиста',hint:'Укажи своё имя. Оно будет записываться при передаче клиентов.',save:'Сохранить',saved:'Сохранено',empty:'Имя специалиста',avatarTitle:'Настройка аватара',avatarHint:'Перетащи фотографию внутри круга, чтобы выставить лицо как нужно.',cancel:'Отмена',avatarSave:'Сохранить'},
    en:{accounts:'Accounts',name:'Specialist name',hint:'Enter your name. It will be recorded when clients are transferred.',save:'Save',saved:'Saved',empty:'Specialist name',avatarTitle:'Avatar setup',avatarHint:'Drag the photo inside the circle to position it.',cancel:'Cancel',avatarSave:'Save'},
    fr:{accounts:'Comptes',name:'Nom du spécialiste',hint:'Indiquez votre nom. Il sera enregistré lors du transfert des clients.',save:'Enregistrer',saved:'Enregistré',empty:'Nom du spécialiste',avatarTitle:'Réglage de l’avatar',avatarHint:'Faites glisser la photo dans le cercle pour la positionner.',cancel:'Annuler',avatarSave:'Enregistrer'},
    de:{accounts:'Konten',name:'Name des Spezialisten',hint:'Gib deinen Namen an. Er wird bei der Übertragung von Klienten gespeichert.',save:'Speichern',saved:'Gespeichert',empty:'Name des Spezialisten',avatarTitle:'Avatar einstellen',avatarHint:'Ziehe das Foto im Kreis an die gewünschte Position.',cancel:'Abbrechen',avatarSave:'Speichern'},
    it:{accounts:'Account',name:'Nome dello specialista',hint:'Inserisci il tuo nome. Verrà registrato durante il trasferimento dei clienti.',save:'Salva',saved:'Salvato',empty:'Nome dello specialista',avatarTitle:'Imposta avatar',avatarHint:'Trascina la foto nel cerchio per posizionarla.',cancel:'Annulla',avatarSave:'Salva'}
  };

  const panel = document.getElementById('settingsPanel');
  const accountsBtn = panel?.querySelector('.settings-accounts-btn');
  if (!panel || !accountsBtn) return;

  function lang(){
    const l = window.DiagnostikaI18n?.language || localStorage.getItem('diagnostika-ui-language') || 'ru';
    return LABELS[l] ? l : 'ru';
  }
  function t(){ return LABELS[lang()]; }
  function getName(){ return String(localStorage.getItem(NAME_KEY) || '').trim(); }
  function getAvatar(){ return String(localStorage.getItem(AVATAR_KEY) || ''); }
  function initials(name){
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '👤';
    return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
  }
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  const style = document.createElement('style');
  style.textContent = `
    #specialistSettings{display:none!important}
    .settings-profile-summary{display:flex;align-items:center;gap:14px;padding:12px 8px 14px;border-bottom:1px solid #e4eaf0;margin-bottom:2px}
    .settings-profile-avatar{width:72px;height:72px;min-width:72px;min-height:72px;border-radius:50%;border:1px solid #cbd5e1;background:#eef3f8;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#405268;font-weight:900;font-size:20px;cursor:pointer;padding:0;box-shadow:0 2px 8px rgba(15,23,42,.14)}
    .settings-profile-avatar img{width:100%;height:100%;display:block;object-fit:cover;border-radius:50%}
    .settings-profile-name{min-width:0;font-size:14px;font-weight:900;color:#2f4154;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .settings-account-content{display:none;border:1px solid #d8e1ea;border-radius:11px;background:#f8fafc;padding:9px;gap:8px}
    .settings-account-content.open{display:grid}
    .account-field{display:grid;gap:6px}
    .account-label{font-size:12px;font-weight:900;color:#26384b}
    .account-input{width:100%;box-sizing:border-box;height:36px;border:1px solid #b9c9d9;border-radius:8px;background:#fff;padding:0 10px;font-size:13px;color:#26384b;outline:none}
    .account-input:focus{border-color:#4f8fd8;box-shadow:0 0 0 2px rgba(79,143,216,.13)}
    .account-hint{font-size:10.5px;line-height:1.35;color:#728399}
    .account-save{height:36px;border:0;border-radius:8px;background:linear-gradient(#47b47d,#24945f);color:#fff;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 3px 7px rgba(36,148,95,.22)}
    .settings-account-content #formIntegrationsBtn{width:100%!important;min-width:0!important;height:42px!important;margin:2px 0 0!important;box-sizing:border-box!important}
    .avatar-editor-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}
    .avatar-editor-dialog::backdrop{background:rgba(15,23,42,.56);backdrop-filter:blur(4px)}
    .avatar-editor-card{width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid #d7e0e9;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.34);padding:18px;box-sizing:border-box;color:#26384b}
    .avatar-editor-title{font-size:17px;font-weight:900;text-align:center;margin-bottom:6px}
    .avatar-editor-hint{font-size:11.5px;line-height:1.4;color:#6e7f92;text-align:center;margin-bottom:14px}
    .avatar-editor-preview{width:210px;height:210px;margin:0 auto;border-radius:50%;overflow:hidden;border:2px solid #bcc9d7;background:#eef3f8;touch-action:none;cursor:grab;box-shadow:0 5px 18px rgba(15,23,42,.16)}
    .avatar-editor-preview.dragging{cursor:grabbing}
    .avatar-editor-preview img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none}
    .avatar-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
    .avatar-editor-actions button{height:38px;border-radius:9px;font-weight:850;cursor:pointer}
    .avatar-editor-cancel{border:1px solid #c7d2de;background:#f7f9fb;color:#4c6075}
    .avatar-editor-save{border:0;background:linear-gradient(#47b47d,#24945f);color:#fff}
  `;
  document.head.appendChild(style);

  const summary = document.createElement('div');
  summary.className = 'settings-profile-summary';
  summary.innerHTML = `<button type="button" class="settings-profile-avatar" aria-label="Avatar"></button><div class="settings-profile-name"></div>`;
  panel.insertBefore(summary,panel.firstChild);

  const content = document.createElement('div');
  content.className = 'settings-account-content';
  content.innerHTML = `
    <div class="account-field">
      <div class="account-label"></div>
      <input class="account-input" type="text" autocomplete="name">
      <div class="account-hint"></div>
      <button type="button" class="account-save"></button>
    </div>
    <input class="account-avatar-input" type="file" accept="image/*" hidden>`;
  accountsBtn.insertAdjacentElement('afterend',content);

  const avatarBtn = summary.querySelector('.settings-profile-avatar');
  const nameEl = summary.querySelector('.settings-profile-name');
  const input = content.querySelector('.account-input');
  const saveBtn = content.querySelector('.account-save');
  const fileInput = content.querySelector('.account-avatar-input');

  function paintAvatar(){
    avatarBtn.innerHTML = '';
    const avatar = getAvatar();
    if (avatar){
      const img = document.createElement('img');
      img.src = avatar;
      img.alt = '';
      avatarBtn.appendChild(img);
    }else{
      avatarBtn.textContent = initials(getName());
    }
  }
  function render(){
    const tr = t();
    const name = getName();
    nameEl.textContent = name || tr.empty;
    content.querySelector('.account-label').textContent = tr.name;
    content.querySelector('.account-hint').textContent = tr.hint;
    saveBtn.textContent = tr.save;
    if (document.activeElement !== input) input.value = name;
    paintAvatar();
  }

  accountsBtn.addEventListener('click',e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const open = !content.classList.contains('open');
    content.classList.toggle('open',open);
    accountsBtn.classList.toggle('active',open);
    const interfaceContent = panel.querySelector('.settings-interface-content');
    const interfaceBtn = panel.querySelector('.settings-interface-btn');
    if (open){
      interfaceContent?.classList.remove('open');
      interfaceBtn?.classList.remove('active');
    }
    render();
  },true);

  saveBtn.addEventListener('click',e=>{
    e.stopPropagation();
    localStorage.setItem(NAME_KEY,input.value.trim());
    render();
    saveBtn.textContent = t().saved;
    setTimeout(()=>{ saveBtn.textContent = t().save; },900);
    window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:{name:getName(),avatar:getAvatar()}}));
  });

  const dlg = document.createElement('dialog');
  dlg.className = 'avatar-editor-dialog';
  dlg.innerHTML = `<div class="avatar-editor-card"><div class="avatar-editor-title"></div><div class="avatar-editor-hint"></div><div class="avatar-editor-preview"><img alt=""></div><div class="avatar-editor-actions"><button type="button" class="avatar-editor-cancel"></button><button type="button" class="avatar-editor-save"></button></div></div>`;
  document.body.appendChild(dlg);

  const preview = dlg.querySelector('.avatar-editor-preview');
  const previewImg = preview.querySelector('img');
  let sourceImage = null;
  let pos = {x:50,y:50};
  let dragging = false;
  let startX = 0, startY = 0, startPosX = 50, startPosY = 50;

  function paintEditorText(){
    const tr=t();
    dlg.querySelector('.avatar-editor-title').textContent=tr.avatarTitle;
    dlg.querySelector('.avatar-editor-hint').textContent=tr.avatarHint;
    dlg.querySelector('.avatar-editor-cancel').textContent=tr.cancel;
    dlg.querySelector('.avatar-editor-save').textContent=tr.avatarSave;
  }
  function paintPreview(){ previewImg.style.objectPosition = `${pos.x}% ${pos.y}%`; }

  preview.addEventListener('pointerdown',e=>{
    if (!sourceImage) return;
    dragging=true;
    preview.classList.add('dragging');
    preview.setPointerCapture?.(e.pointerId);
    startX=e.clientX; startY=e.clientY; startPosX=pos.x; startPosY=pos.y;
    e.preventDefault();
  });
  preview.addEventListener('pointermove',e=>{
    if(!dragging) return;
    const r=preview.getBoundingClientRect();
    pos.x=clamp(startPosX-(e.clientX-startX)/Math.max(1,r.width)*100,0,100);
    pos.y=clamp(startPosY-(e.clientY-startY)/Math.max(1,r.height)*100,0,100);
    paintPreview();
    e.preventDefault();
  });
  function stopDrag(){ dragging=false; preview.classList.remove('dragging'); }
  preview.addEventListener('pointerup',stopDrag);
  preview.addEventListener('pointercancel',stopDrag);

  function cropAvatar(img,p){
    const w=img.naturalWidth||img.width;
    const h=img.naturalHeight||img.height;
    const side=Math.min(w,h);
    const sx=(w-side)*(p.x/100);
    const sy=(h-side)*(p.y/100);
    const canvas=document.createElement('canvas');
    canvas.width=256; canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,sx,sy,side,side,0,0,256,256);
    return canvas.toDataURL('image/jpeg',0.88);
  }

  avatarBtn.addEventListener('click',e=>{ e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener('change',()=>{
    const file=fileInput.files?.[0];
    fileInput.value='';
    if(!file || !file.type.startsWith('image/')) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        sourceImage=img;
        pos={x:50,y:50};
        previewImg.src=String(reader.result||'');
        paintPreview();
        paintEditorText();
        dlg.showModal();
      };
      img.src=String(reader.result||'');
    };
    reader.readAsDataURL(file);
  });

  dlg.querySelector('.avatar-editor-cancel').addEventListener('click',()=>{ sourceImage=null; dlg.close(); });
  dlg.querySelector('.avatar-editor-save').addEventListener('click',()=>{
    if(!sourceImage){ dlg.close(); return; }
    try{
      const data=cropAvatar(sourceImage,pos);
      localStorage.setItem(AVATAR_KEY,data);
      paintAvatar();
      window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:{name:getName(),avatar:data}}));
    }catch(err){ console.warn('Avatar save failed',err); }
    sourceImage=null;
    dlg.close();
  });

  function moveFormsButton(){
    const b=document.getElementById('formIntegrationsBtn');
    if(!b) return false;
    if(b.parentElement!==content) content.appendChild(b);
    return true;
  }
  function retryMoveFormsButton(){
    let attempts=0;
    const tick=()=>{
      if(moveFormsButton()) return;
      attempts+=1;
      if(attempts<30) setTimeout(tick,300);
    };
    tick();
  }
  if(document.readyState==='complete') retryMoveFormsButton();
  else window.addEventListener('load',()=>setTimeout(retryMoveFormsButton,0),{once:true});

  window.addEventListener('diagnostika-language-changed',()=>setTimeout(render,0));
  window.DiagnostikaSpecialistProfile={getName,getAvatar,nameKey:NAME_KEY,avatarKey:AVATAR_KEY};
  render();
})();
