'use strict';

(() => {
  if(window.__diagnostikaAccountSettingsLayoutFixReady) return;
  window.__diagnostikaAccountSettingsLayoutFixReady=true;

  const AVATAR_KEY='diagnostika-specialist-avatar';
  const POS_KEY='diagnostika-specialist-avatar-position';

  function getPos(){
    try{
      const p=JSON.parse(localStorage.getItem(POS_KEY)||'null');
      return {x:Math.max(0,Math.min(100,Number(p?.x ?? 50))),y:Math.max(0,Math.min(100,Number(p?.y ?? 50)))};
    }catch{return{x:50,y:50};}
  }

  const style=document.createElement('style');
  style.textContent=`
    #specialistSettings{display:none!important}
    .settings-profile-summary{padding:12px 8px 14px!important;gap:14px!important;align-items:center!important}
    .settings-profile-summary .settings-profile-avatar{width:72px!important;height:72px!important;min-width:72px!important;min-height:72px!important;border-radius:50%!important;overflow:hidden!important;font-size:20px!important;padding:0!important;cursor:pointer!important;box-shadow:0 2px 8px rgba(15,23,42,.14)!important}
    .settings-profile-summary .settings-profile-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;border-radius:50%!important;display:block!important}
    .settings-profile-name{font-size:14px!important}
    .settings-profile-sub{display:none!important}
    .account-avatar-large{display:none!important}
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

  const dlg=document.createElement('dialog');
  dlg.className='avatar-editor-dialog';
  dlg.innerHTML=`<div class="avatar-editor-card"><div class="avatar-editor-title">Настройка аватара</div><div class="avatar-editor-hint">Перетащи фотографию внутри круга, чтобы выставить лицо как нужно.</div><div class="avatar-editor-preview"><img alt=""></div><div class="avatar-editor-actions"><button type="button" class="avatar-editor-cancel">Отмена</button><button type="button" class="avatar-editor-save">Сохранить</button></div></div>`;
  document.body.appendChild(dlg);

  const preview=dlg.querySelector('.avatar-editor-preview');
  const previewImg=preview.querySelector('img');
  let tempData='';
  let pos=getPos();
  let dragging=false;
  let startX=0,startY=0,startPosX=50,startPosY=50;

  function paintPreview(){previewImg.style.objectPosition=`${pos.x}% ${pos.y}%`;}
  function applyPosition(){const p=getPos();document.querySelectorAll('.settings-profile-avatar img').forEach(img=>{img.style.objectPosition=`${p.x}% ${p.y}%`;});}

  preview.addEventListener('pointerdown',e=>{dragging=true;preview.classList.add('dragging');preview.setPointerCapture?.(e.pointerId);startX=e.clientX;startY=e.clientY;startPosX=pos.x;startPosY=pos.y;e.preventDefault();});
  preview.addEventListener('pointermove',e=>{if(!dragging)return;const rect=preview.getBoundingClientRect();const dx=(e.clientX-startX)/Math.max(1,rect.width)*100;const dy=(e.clientY-startY)/Math.max(1,rect.height)*100;pos.x=Math.max(0,Math.min(100,startPosX-dx));pos.y=Math.max(0,Math.min(100,startPosY-dy));paintPreview();e.preventDefault();});
  function stopDrag(){dragging=false;preview.classList.remove('dragging');}
  preview.addEventListener('pointerup',stopDrag);
  preview.addEventListener('pointercancel',stopDrag);

  dlg.querySelector('.avatar-editor-cancel').onclick=()=>{dlg.close();tempData='';};
  dlg.querySelector('.avatar-editor-save').onclick=()=>{
    if(!tempData){dlg.close();return;}
    try{localStorage.setItem(AVATAR_KEY,tempData);localStorage.setItem(POS_KEY,JSON.stringify(pos));}catch(e){console.warn('Avatar save failed',e);}
    document.querySelectorAll('.settings-profile-avatar').forEach(el=>{el.innerHTML='';const img=document.createElement('img');img.src=tempData;img.alt='';img.style.objectPosition=`${pos.x}% ${pos.y}%`;el.appendChild(img);});
    window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:{avatar:tempData,position:{...pos}}}));
    dlg.close();tempData='';
  };

  function bindAvatarInput(){
    const input=document.querySelector('.account-avatar-input');
    if(!input || input.dataset.manualAvatarEditor==='1') return false;
    input.dataset.manualAvatarEditor='1';
    input.addEventListener('change',e=>{
      const file=input.files?.[0];
      if(!file || !file.type.startsWith('image/')) return;
      e.stopImmediatePropagation();
      const reader=new FileReader();
      reader.onload=()=>{tempData=String(reader.result||'');pos=getPos();previewImg.src=tempData;paintPreview();if(!dlg.open) dlg.showModal();};
      reader.readAsDataURL(file);input.value='';
    },true);
    return true;
  }

  function initProfileFixes(){
    document.querySelectorAll('.settings-profile-sub').forEach(x=>x.remove());
    applyPosition();
    return bindAvatarInput();
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    const done=initProfileFixes();
    if(done || tries>=20) clearInterval(timer);
  },150);
  initProfileFixes();

  document.getElementById('settingsMenuBtn')?.addEventListener('click',()=>setTimeout(()=>{initProfileFixes();},0));
  window.addEventListener('diagnostika-specialist-profile-change',()=>setTimeout(applyPosition,0));
})();
