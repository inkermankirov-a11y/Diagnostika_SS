'use strict';

(() => {
  if (window.__diagnostikaAccountSettingsReady) return;
  window.__diagnostikaAccountSettingsReady = true;

  const NAME_KEY = 'diagnostika-specialist-name';
  const AVATAR_KEY = 'diagnostika-specialist-avatar';

  const LABELS = {
    ru:{accounts:'Учетные записи',name:'Имя специалиста',hint:'Данные карточки сохраняются вместе с базой.',save:'Сохранить карточку',saved:'Сохранено',empty:'Имя специалиста',profile:'Карточка специалиста',title:'Специализация / должность',titlePlaceholder:'Например: гипнотерапевт, психолог-консультант',experience:'Опыт работы',experiencePlaceholder:'Например: 8 лет',areas:'Направления работы',areasPlaceholder:'Отношения, деньги, карьера, самореализация',about:'О специалисте',aboutPlaceholder:'Коротко о подходе, опыте и формате работы',reviews:'Отзывы',reviewAuthor:'Автор / подпись',reviewText:'Текст отзыва',reviewAdd:'Добавить отзыв',reviewEmpty:'Отзывов пока нет',reviewDelete:'Удалить',photo:'Фотография',photoEdit:'Изменить миниатюру',photoReplace:'Заменить фото',photoDelete:'Удалить фото',avatarTitle:'Редактор фотографии',avatarHint:'Перетаскивай фотографию, меняй масштаб и положение внутри круга.',zoom:'Масштаб',cancel:'Отмена',avatarSave:'Сохранить миниатюру'},
    en:{accounts:'Accounts',name:'Specialist name',hint:'Profile data is stored with the database.',save:'Save profile',saved:'Saved',empty:'Specialist name',profile:'Specialist profile',title:'Role / specialty',titlePlaceholder:'For example: therapist, counselor',experience:'Experience',experiencePlaceholder:'For example: 8 years',areas:'Areas of work',areasPlaceholder:'Relationships, money, career, self-realization',about:'About specialist',aboutPlaceholder:'Short description of approach and experience',reviews:'Reviews',reviewAuthor:'Author / signature',reviewText:'Review text',reviewAdd:'Add review',reviewEmpty:'No reviews yet',reviewDelete:'Delete',photo:'Photo',photoEdit:'Edit thumbnail',photoReplace:'Replace photo',photoDelete:'Delete photo',avatarTitle:'Photo editor',avatarHint:'Drag the photo, change zoom and position inside the circle.',zoom:'Zoom',cancel:'Cancel',avatarSave:'Save thumbnail'},
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
  function t(){ return {...LABELS.en,...(LABELS[lang()]||LABELS.ru)}; }
  const clone=value=>{try{return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}catch(_){return value&&typeof value==='object'?{...value}:value;}};
  const uid=()=>crypto.randomUUID?crypto.randomUUID():'review_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  function appState(){try{return typeof state!=='undefined'&&state&&typeof state==='object'?state:null;}catch(_){return null;}}
  function normalizeAreas(value){if(Array.isArray(value))return value.map(x=>String(x||'').trim()).filter(Boolean);return String(value||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean);}
  function normalizeReviews(value){return(Array.isArray(value)?value:[]).map(item=>({id:String(item?.id||uid()),author:String(item?.author||'').trim(),text:String(item?.text||'').trim(),createdAt:Number(item?.createdAt)||Date.now()})).filter(item=>item.text);}
  function normalizeProfile(value={}){
    return{
      name:String(value?.name||'').trim(),title:String(value?.title||'').trim(),experience:String(value?.experience||'').trim(),
      areas:normalizeAreas(value?.areas),about:String(value?.about||'').trim(),reviews:normalizeReviews(value?.reviews),
      avatar:String(value?.avatar||''),avatarSource:String(value?.avatarSource||''),
      avatarCrop:{x:clamp(Number(value?.avatarCrop?.x)||50,0,100),y:clamp(Number(value?.avatarCrop?.y)||50,0,100),zoom:clamp(Number(value?.avatarCrop?.zoom)||1,1,3)},
      updatedAt:Number(value?.updatedAt)||Date.now()
    };
  }
  function ensureProfile(){
    const st=appState();
    if(st){
      const had=st.specialistProfile&&typeof st.specialistProfile==='object';
      const profile=normalizeProfile(had?st.specialistProfile:{});
      let changed=!had;
      const legacyName=String(localStorage.getItem(NAME_KEY)||'').trim(),legacyAvatar=String(localStorage.getItem(AVATAR_KEY)||'');
      if(!profile.name&&legacyName){profile.name=legacyName;changed=true;}
      if(!profile.avatar&&legacyAvatar){profile.avatar=legacyAvatar;changed=true;}
      if(!profile.avatarSource&&profile.avatar){profile.avatarSource=profile.avatar;changed=true;}
      st.specialistProfile=profile;
      if(changed&&typeof save==='function'){try{save({source:'specialist-profile-migration'});}catch(_){}}
      return profile;
    }
    return normalizeProfile({name:localStorage.getItem(NAME_KEY)||'',avatar:localStorage.getItem(AVATAR_KEY)||''});
  }
  function getProfile(){return normalizeProfile(ensureProfile());}
  function getName(){return getProfile().name;}
  function getAvatar(){return getProfile().avatar;}
  function persistProfile(next,source='specialist-profile-save'){
    const profile=normalizeProfile({...next,updatedAt:Date.now()}),st=appState();
    if(st){
      const before=clone(st.specialistProfile);st.specialistProfile=profile;
      let ok=true;if(typeof save==='function'){try{ok=save({source})!==false;}catch(_){ok=false;}}
      if(!ok){st.specialistProfile=before;return false;}
    }
    try{localStorage.setItem(NAME_KEY,profile.name);if(profile.avatar)localStorage.setItem(AVATAR_KEY,profile.avatar);else localStorage.removeItem(AVATAR_KEY);}catch(_){}
    window.dispatchEvent(new CustomEvent('diagnostika-specialist-profile-change',{detail:clone(profile)}));
    return true;
  }
  function initials(name){
    const p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '👤';
    return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
  }
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

  const style = document.createElement('style');
  style.textContent = `
    #specialistSettings{display:none!important}
    .settings-profile-summary{display:grid;grid-template-columns:72px minmax(0,1fr);gap:14px;align-items:center;padding:12px 8px 14px;border-bottom:1px solid rgba(255,255,255,.24);margin-bottom:2px}
    .settings-profile-avatar{width:72px;height:72px;min-width:72px;min-height:72px;border-radius:50%;border:1px solid rgba(255,255,255,.58);background:rgba(255,255,255,.88);display:flex;align-items:center;justify-content:center;overflow:hidden;color:#405268;font-weight:900;font-size:20px;cursor:pointer;padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.94),0 4px 12px rgba(15,23,42,.18)}
    .settings-profile-avatar img{width:100%;height:100%;display:block;object-fit:cover;border-radius:50%}
    .settings-profile-meta{min-width:0}
    .settings-profile-name{font-size:15px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 2px rgba(0,0,0,.35)}
    .settings-profile-title{margin-top:4px;color:rgba(255,255,255,.88);font-size:11.5px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .settings-profile-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
    .settings-profile-tag{max-width:100%;padding:3px 6px;border-radius:999px;background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:9.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .settings-account-content{display:none;border:1px solid rgba(255,255,255,.70);border-radius:13px;background:rgba(255,255,255,.90);padding:10px;gap:10px;max-height:58vh;overflow-y:auto;overflow-x:hidden}
    .settings-account-content.open{display:grid}
    .specialist-card-title{font-size:14px;font-weight:900;color:#173b63;padding-bottom:8px;border-bottom:1px solid #dbe5ef}
    .account-field{display:grid;gap:6px}
    .account-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .account-label{font-size:11.5px;font-weight:900;color:#26384b}
    .account-input,.account-textarea{width:100%;box-sizing:border-box;border:1px solid #b9c9d9;border-radius:9px;background:#fff;padding:0 10px;font-size:12.5px;color:#26384b;outline:none}
    .account-input{height:38px}.account-textarea{min-height:72px;padding:9px 10px;resize:vertical;line-height:1.4}
    .account-input:focus,.account-textarea:focus{border-color:#4f8fd8;box-shadow:0 0 0 2px rgba(79,143,216,.13)}
    .account-save{height:38px;border:0;border-radius:9px;background:linear-gradient(#47b47d,#24945f);color:#fff;font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 3px 7px rgba(36,148,95,.22)}
    .account-photo-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.account-photo-actions button{height:34px;border-radius:8px;font-size:11px;font-weight:850;cursor:pointer}
    .account-photo-edit,.account-photo-replace{border:1px solid #b9c9d9;background:#f7fbff;color:#31506f}.account-photo-delete{grid-column:1/-1;border:1px solid #e1b4b4;background:#fff7f7;color:#a63c3c}
    .account-reviews{display:grid;gap:8px;padding-top:2px}.account-review-editor{display:grid;gap:6px;padding:9px;border:1px solid #d8e2ec;border-radius:10px;background:#f8fbfd}
    .account-review-add{height:34px;border:0;border-radius:8px;background:linear-gradient(#6f98df,#4d78c6);color:#fff;font-size:11.5px;font-weight:900;cursor:pointer}
    .account-review-list{display:grid;gap:6px}.account-review-item{position:relative;padding:9px 32px 9px 10px;border:1px solid #dce5ee;border-radius:10px;background:#fff}
    .account-review-author{font-size:11px;font-weight:900;color:#31506f;margin-bottom:4px}.account-review-text{font-size:11.5px;line-height:1.4;color:#455a70;white-space:pre-wrap;overflow-wrap:anywhere}
    .account-review-delete{position:absolute;right:6px;top:6px;width:24px;height:24px;border:0;border-radius:7px;background:#fff1f1;color:#b33;font-weight:900;cursor:pointer}.account-review-empty{padding:8px;text-align:center;color:#8a9aad;font-size:11px}
    .settings-account-content #formIntegrationsBtn{width:100%!important;min-width:0!important;height:42px!important;margin:2px 0 0!important;box-sizing:border-box!important}
    .avatar-editor-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 20px)}.avatar-editor-dialog::backdrop{background:rgba(15,23,42,.44);backdrop-filter:blur(4px)}
    .avatar-editor-card{width:min(390px,calc(100vw - 28px));background:#fff;border:1px solid #d7e0e9;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.34);padding:18px;box-sizing:border-box;color:#26384b}
    .avatar-editor-title{font-size:17px;font-weight:900;text-align:center;margin-bottom:6px}.avatar-editor-hint{font-size:11.5px;line-height:1.4;color:#6e7f92;text-align:center;margin-bottom:14px}
    .avatar-editor-preview{width:230px;height:230px;margin:0 auto;border-radius:50%;overflow:hidden;border:2px solid #bcc9d7;background:#eef3f8;touch-action:none;cursor:grab;box-shadow:0 5px 18px rgba(15,23,42,.16)}
    .avatar-editor-preview.dragging{cursor:grabbing}.avatar-editor-preview img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;-webkit-user-drag:none;pointer-events:none;will-change:transform}
    .avatar-zoom-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:14px;font-size:11px;font-weight:850;color:#52677e}.avatar-zoom{width:100%}
    .avatar-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.avatar-editor-actions button{height:38px;border-radius:9px;font-weight:850;cursor:pointer}
    .avatar-editor-cancel{border:1px solid #c7d2de;background:#f7f9fb;color:#4c6075}.avatar-editor-save{border:0;background:linear-gradient(#47b47d,#24945f);color:#fff}
    @media(max-width:560px){.account-field-grid{grid-template-columns:1fr}.account-photo-actions{grid-template-columns:1fr}.account-photo-delete{grid-column:auto}}
  `;
  document.head.appendChild(style);

  const summary = document.createElement('div');
  summary.className = 'settings-profile-summary';
  summary.innerHTML = '<button type="button" class="settings-profile-avatar" aria-label="Avatar"></button><div class="settings-profile-meta"><div class="settings-profile-name"></div><div class="settings-profile-title"></div><div class="settings-profile-tags"></div></div>';
  panel.insertBefore(summary,panel.firstChild);

  const content = document.createElement('div');
  content.className = 'settings-account-content';
  content.innerHTML = '<div class="specialist-card-title"></div>'
    +'<div class="account-field"><div class="account-label account-name-label"></div><input class="account-input account-name" type="text" autocomplete="name"></div>'
    +'<div class="account-field-grid"><div class="account-field"><div class="account-label account-title-label"></div><input class="account-input account-title" type="text"></div><div class="account-field"><div class="account-label account-experience-label"></div><input class="account-input account-experience" type="text"></div></div>'
    +'<div class="account-field"><div class="account-label account-areas-label"></div><textarea class="account-textarea account-areas"></textarea></div>'
    +'<div class="account-field"><div class="account-label account-about-label"></div><textarea class="account-textarea account-about"></textarea></div>'
    +'<div class="account-field"><div class="account-label account-photo-label"></div><div class="account-photo-actions"><button type="button" class="account-photo-edit"></button><button type="button" class="account-photo-replace"></button><button type="button" class="account-photo-delete"></button></div></div>'
    +'<div class="account-field account-reviews"><div class="account-label account-reviews-label"></div><div class="account-review-editor"><input class="account-input account-review-author-input" type="text"><textarea class="account-textarea account-review-text-input"></textarea><button type="button" class="account-review-add"></button></div><div class="account-review-list"></div></div>'
    +'<button type="button" class="account-save"></button><input class="account-avatar-input" type="file" accept="image/*" hidden>';
  accountsBtn.insertAdjacentElement('afterend',content);

  const avatarBtn=summary.querySelector('.settings-profile-avatar');
  const nameEl=summary.querySelector('.settings-profile-name');
  const titleEl=summary.querySelector('.settings-profile-title');
  const tagsEl=summary.querySelector('.settings-profile-tags');
  const nameInput=content.querySelector('.account-name');
  const titleInput=content.querySelector('.account-title');
  const experienceInput=content.querySelector('.account-experience');
  const areasInput=content.querySelector('.account-areas');
  const aboutInput=content.querySelector('.account-about');
  const saveBtn=content.querySelector('.account-save');
  const fileInput=content.querySelector('.account-avatar-input');
  const photoEditBtn=content.querySelector('.account-photo-edit');
  const photoReplaceBtn=content.querySelector('.account-photo-replace');
  const photoDeleteBtn=content.querySelector('.account-photo-delete');
  const reviewAuthorInput=content.querySelector('.account-review-author-input');
  const reviewTextInput=content.querySelector('.account-review-text-input');
  const reviewAddBtn=content.querySelector('.account-review-add');
  const reviewList=content.querySelector('.account-review-list');

  function paintAvatar(profile=getProfile()){
    avatarBtn.innerHTML='';
    if(profile.avatar){
      const img=document.createElement('img');img.src=profile.avatar;img.alt='';avatarBtn.appendChild(img);
    }else avatarBtn.textContent=initials(profile.name);
  }
  function paintSummary(profile=getProfile()){
    const tr=t();
    nameEl.textContent=profile.name||tr.empty;
    titleEl.textContent=[profile.title,profile.experience].filter(Boolean).join(' • ');
    tagsEl.innerHTML='';
    profile.areas.slice(0,4).forEach(area=>{
      const tag=document.createElement('span');tag.className='settings-profile-tag';tag.textContent=area;tagsEl.appendChild(tag);
    });
    paintAvatar(profile);
  }
  function renderReviews(profile=getProfile()){
    const tr=t();reviewList.innerHTML='';
    if(!profile.reviews.length){reviewList.innerHTML='<div class="account-review-empty">'+tr.reviewEmpty+'</div>';return;}
    profile.reviews.forEach(review=>{
      const item=document.createElement('div');item.className='account-review-item';
      const author=document.createElement('div');author.className='account-review-author';author.textContent=review.author||'Отзыв';
      const text=document.createElement('div');text.className='account-review-text';text.textContent=review.text;
      const del=document.createElement('button');del.type='button';del.className='account-review-delete';del.textContent='×';del.title=tr.reviewDelete;
      del.onclick=e=>{e.stopPropagation();const next=getProfile();next.reviews=next.reviews.filter(x=>x.id!==review.id);if(persistProfile(next,'specialist-profile-review-delete'))render();};
      item.append(author,text,del);reviewList.appendChild(item);
    });
  }
  function render(){
    const tr=t(),profile=getProfile();
    paintSummary(profile);
    content.querySelector('.specialist-card-title').textContent=tr.profile;
    content.querySelector('.account-name-label').textContent=tr.name;
    content.querySelector('.account-title-label').textContent=tr.title;
    content.querySelector('.account-experience-label').textContent=tr.experience;
    content.querySelector('.account-areas-label').textContent=tr.areas;
    content.querySelector('.account-about-label').textContent=tr.about;
    content.querySelector('.account-photo-label').textContent=tr.photo;
    content.querySelector('.account-reviews-label').textContent=tr.reviews;
    nameInput.placeholder=tr.name;titleInput.placeholder=tr.titlePlaceholder;experienceInput.placeholder=tr.experiencePlaceholder;areasInput.placeholder=tr.areasPlaceholder;aboutInput.placeholder=tr.aboutPlaceholder;
    reviewAuthorInput.placeholder=tr.reviewAuthor;reviewTextInput.placeholder=tr.reviewText;
    photoEditBtn.textContent=tr.photoEdit;photoReplaceBtn.textContent=tr.photoReplace;photoDeleteBtn.textContent=tr.photoDelete;reviewAddBtn.textContent=tr.reviewAdd;saveBtn.textContent=tr.save;
    if(document.activeElement!==nameInput)nameInput.value=profile.name;
    if(document.activeElement!==titleInput)titleInput.value=profile.title;
    if(document.activeElement!==experienceInput)experienceInput.value=profile.experience;
    if(document.activeElement!==areasInput)areasInput.value=profile.areas.join(', ');
    if(document.activeElement!==aboutInput)aboutInput.value=profile.about;
    photoEditBtn.disabled=!profile.avatar;photoDeleteBtn.disabled=!profile.avatar;
    renderReviews(profile);
  }
  function profileFromForm(){
    const profile=getProfile();
    profile.name=nameInput.value.trim();profile.title=titleInput.value.trim();profile.experience=experienceInput.value.trim();profile.areas=normalizeAreas(areasInput.value);profile.about=aboutInput.value.trim();
    return profile;
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
    if(!persistProfile(profileFromForm(),'specialist-profile-card-save'))return;
    render();
    saveBtn.textContent=t().saved;
    setTimeout(()=>{saveBtn.textContent=t().save;},900);
  });

  reviewAddBtn.addEventListener('click',e=>{
    e.stopPropagation();
    const text=reviewTextInput.value.trim();
    if(!text)return;
    const profile=profileFromForm();
    profile.reviews.push({id:uid(),author:reviewAuthorInput.value.trim(),text,createdAt:Date.now()});
    if(!persistProfile(profile,'specialist-profile-review-add'))return;
    reviewAuthorInput.value='';reviewTextInput.value='';render();
  });

  const dlg=document.createElement('dialog');
  dlg.className='avatar-editor-dialog';
  dlg.innerHTML='<div class="avatar-editor-card"><div class="avatar-editor-title"></div><div class="avatar-editor-hint"></div><div class="avatar-editor-preview"><img alt=""></div><div class="avatar-zoom-row"><span class="avatar-zoom-label"></span><input class="avatar-zoom" type="range" min="1" max="3" step="0.05" value="1"><span class="avatar-zoom-value">100%</span></div><div class="avatar-editor-actions"><button type="button" class="avatar-editor-cancel"></button><button type="button" class="avatar-editor-save"></button></div></div>';
  document.body.appendChild(dlg);

  const preview=dlg.querySelector('.avatar-editor-preview');
  const previewImg=preview.querySelector('img');
  const zoomInput=dlg.querySelector('.avatar-zoom');
  const zoomValue=dlg.querySelector('.avatar-zoom-value');
  let sourceImage=null,sourceData='';
  let pos={x:50,y:50,zoom:1};
  let dragging=false,startX=0,startY=0,startPosX=50,startPosY=50;

  function paintEditorText(){
    const tr=t();
    dlg.querySelector('.avatar-editor-title').textContent=tr.avatarTitle;
    dlg.querySelector('.avatar-editor-hint').textContent=tr.avatarHint;
    dlg.querySelector('.avatar-zoom-label').textContent=tr.zoom;
    dlg.querySelector('.avatar-editor-cancel').textContent=tr.cancel;
    dlg.querySelector('.avatar-editor-save').textContent=tr.avatarSave;
  }
  function paintPreview(){
    previewImg.style.objectPosition=pos.x+'% '+pos.y+'%';
    previewImg.style.transform='scale('+pos.zoom+')';
    previewImg.style.transformOrigin=pos.x+'% '+pos.y+'%';
    zoomInput.value=String(pos.zoom);
    zoomValue.textContent=Math.round(pos.zoom*100)+'%';
  }
  function loadImage(data){
    return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});
  }
  function compressSource(img){
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,max=1600,scale=Math.min(1,max/Math.max(w,h));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',0.90);
  }
  async function openEditor(data,crop={x:50,y:50,zoom:1}){
    if(!data)return false;
    try{
      sourceImage=await loadImage(data);sourceData=data;
      pos={x:clamp(Number(crop?.x)||50,0,100),y:clamp(Number(crop?.y)||50,0,100),zoom:clamp(Number(crop?.zoom)||1,1,3)};
      previewImg.src=data;paintEditorText();paintPreview();dlg.showModal();return true;
    }catch(_){return false;}
  }

  preview.addEventListener('pointerdown',e=>{
    if(!sourceImage)return;
    dragging=true;preview.classList.add('dragging');preview.setPointerCapture?.(e.pointerId);
    startX=e.clientX;startY=e.clientY;startPosX=pos.x;startPosY=pos.y;e.preventDefault();
  });
  preview.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const r=preview.getBoundingClientRect(),sensitivity=100/Math.max(1,pos.zoom);
    pos.x=clamp(startPosX-(e.clientX-startX)/Math.max(1,r.width)*sensitivity,0,100);
    pos.y=clamp(startPosY-(e.clientY-startY)/Math.max(1,r.height)*sensitivity,0,100);
    paintPreview();e.preventDefault();
  });
  function stopDrag(){dragging=false;preview.classList.remove('dragging');}
  preview.addEventListener('pointerup',stopDrag);preview.addEventListener('pointercancel',stopDrag);
  zoomInput.addEventListener('input',()=>{pos.zoom=clamp(Number(zoomInput.value)||1,1,3);paintPreview();});

  function cropAvatar(img,p){
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,base=Math.min(w,h);
    const side=base/clamp(Number(p.zoom)||1,1,3);
    const sx=(w-side)*(clamp(Number(p.x)||50,0,100)/100),sy=(h-side)*(clamp(Number(p.y)||50,0,100)/100);
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
    canvas.getContext('2d').drawImage(img,sx,sy,side,side,0,0,320,320);
    return canvas.toDataURL('image/jpeg',0.90);
  }

  avatarBtn.addEventListener('click',e=>{e.stopPropagation();const profile=getProfile();if(profile.avatar)photoEditBtn.click();else fileInput.click();});
  photoEditBtn.addEventListener('click',async e=>{e.stopPropagation();const profile=getProfile();await openEditor(profile.avatarSource||profile.avatar,profile.avatarCrop);});
  photoReplaceBtn.addEventListener('click',e=>{e.stopPropagation();fileInput.click();});
  photoDeleteBtn.addEventListener('click',e=>{
    e.stopPropagation();const profile=getProfile();profile.avatar='';profile.avatarSource='';profile.avatarCrop={x:50,y:50,zoom:1};
    if(persistProfile(profile,'specialist-profile-avatar-delete'))render();
  });

  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];fileInput.value='';
    if(!file||!file.type.startsWith('image/'))return;
    const reader=new FileReader();
    reader.onload=async()=>{try{const original=await loadImage(String(reader.result||''));const compressed=compressSource(original);await openEditor(compressed,{x:50,y:50,zoom:1});}catch(err){console.warn('Avatar load failed',err);}};
    reader.readAsDataURL(file);
  });

  dlg.querySelector('.avatar-editor-cancel').addEventListener('click',()=>{sourceImage=null;sourceData='';dlg.close();});
  dlg.querySelector('.avatar-editor-save').addEventListener('click',()=>{
    if(!sourceImage){dlg.close();return;}
    try{
      const profile=profileFromForm();
      profile.avatar=cropAvatar(sourceImage,pos);
      profile.avatarSource=sourceData||profile.avatarSource||profile.avatar;
      profile.avatarCrop={x:pos.x,y:pos.y,zoom:pos.zoom};
      if(persistProfile(profile,'specialist-profile-avatar-save'))render();
    }catch(err){console.warn('Avatar save failed',err);}
    sourceImage=null;sourceData='';dlg.close();
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
