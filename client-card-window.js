'use strict';

(() => {
  const dlg = document.createElement('dialog');
  dlg.id = 'clientCardDialog';
  dlg.className = 'client-card-dialog';
  dlg.innerHTML = `
    <div class="client-card-window">
      <div class="client-card-window-title">РАБОТА С КЛИЕНТОМ</div>
      <div class="client-card-sheet">
        <div class="cc-photo-wrap">
          <button id="ccPhotoFrame" class="cc-photo-frame" type="button" title="Добавить или изменить фото">
            <img id="ccPhotoPreview" alt="Фото клиента">
            <span id="ccPhotoPlaceholder">Добавить фото</span>
          </button>
          <input id="ccPhotoInput" type="file" accept="image/*" hidden>
          <div class="cc-photo-help">Нажмите на фото, чтобы добавить или заменить его</div>
        </div>

        <div class="client-card-top-grid">
          <label class="cc-field cc-span-2">ФИО<input id="ccName" type="text"></label>
          <label class="cc-field">Телефон<input id="ccPhone" type="text"></label>
          <label class="cc-field">E-mail<input id="ccEmail" type="text"></label>
          <label class="cc-field">Пол<select id="ccGender"><option value=""></option><option>Мужской</option><option>Женский</option></select></label>
          <label class="cc-field">Страна<input id="ccCountry" type="text"></label>
          <label class="cc-field">Город<input id="ccCity" type="text"></label>
          <label class="cc-field">Дата рождения<input id="ccBirth" type="date"></label>
          <label class="cc-field">Возраст<input id="ccAge" type="text" readonly></label>
          <label class="cc-field cc-social-field"><span>VK</span><input id="ccVk" type="text"></label>
          <label class="cc-field cc-social-field"><span>Telegram</span><input id="ccTelegram" type="text"></label>
          <label class="cc-field cc-social-field"><span>MAX</span><input id="ccMax" type="text"></label>
        </div>

        <div class="cc-long-fields">
          <label>Исходный запрос<textarea id="ccInitialProblem"></textarea></label>
          <label>Ключевой запрос<textarea id="ccMainRequest"></textarea></label>
          <label>Предыдущие попытки решения<textarea id="ccTried"></textarea></label>
          <label>Что не сработало<textarea id="ccDidntHelp"></textarea></label>
          <label>Желаемый результат<textarea id="ccDesiredOutcome"></textarea></label>
          <label>Рабочие заметки<textarea id="ccClientNotes"></textarea></label>
        </div>
      </div>
      <div class="client-card-footer">
        <button id="ccCloseBtn" type="button" class="cc-close-btn">Закрыть</button>
        <button id="ccSaveBtn" type="button" class="cc-save-btn">Сохранить карточку</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const q = id => document.getElementById(id);
  const fieldIds=['ccName','ccPhone','ccEmail','ccGender','ccCountry','ccCity','ccBirth','ccVk','ccTelegram','ccMax','ccInitialProblem','ccMainRequest','ccTried','ccDidntHelp','ccDesiredOutcome','ccClientNotes'];
  let draftMode=false;
  let draft=null;
  let dirty=false;
  let photoData='';

  function ageFromBirth(value){
    if(!value) return '';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return '';
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    const m = n.getMonth() - d.getMonth();
    if(m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a >= 0 ? String(a) : '';
  }

  function setPhoto(data){
    photoData=data||'';
    const img=q('ccPhotoPreview');
    const ph=q('ccPhotoPlaceholder');
    if(photoData){img.src=photoData;img.style.display='block';ph.style.display='none';}
    else{img.removeAttribute('src');img.style.display='none';ph.style.display='grid';}
  }

  function sourceClient(){
    return draftMode ? draft : (typeof client==='function' ? client() : null);
  }

  function fillFrom(c){
    c=c||{};
    q('ccName').value = c.name && c.name!=='Новый клиент' ? c.name : '';
    q('ccPhone').value = c.phone || '';
    q('ccEmail').value = c.email || '';
    q('ccGender').value = c.gender || '';
    q('ccCountry').value = c.country || '';
    q('ccCity').value = c.city || '';
    q('ccBirth').value = c.birth || '';
    q('ccAge').value = c.age || ageFromBirth(c.birth) || '';
    q('ccVk').value = c.vk || '';
    q('ccTelegram').value = c.telegram || '';
    q('ccMax').value = c.max || '';
    q('ccInitialProblem').value = c.initialProblem || '';
    q('ccMainRequest').value = c.mainRequest || '';
    q('ccTried').value = c.tried || '';
    q('ccDidntHelp').value = c.didntHelp || '';
    q('ccDesiredOutcome').value = c.desiredOutcome || '';
    q('ccClientNotes').value = c.clientNotes || c.notes || '';
    setPhoto(c.photoData||'');
    dirty=false;
  }

  function collectInto(c){
    c.name = q('ccName').value.trim() || 'Новый клиент';
    c.phone = q('ccPhone').value.trim();
    c.email = q('ccEmail').value.trim();
    c.gender = q('ccGender').value;
    c.country = q('ccCountry').value.trim();
    c.city = q('ccCity').value.trim();
    c.birth = q('ccBirth').value;
    c.age = ageFromBirth(c.birth) || q('ccAge').value.trim();
    c.vk = q('ccVk').value.trim();
    c.telegram = q('ccTelegram').value.trim();
    c.max = q('ccMax').value.trim();
    c.initialProblem = q('ccInitialProblem').value;
    c.mainRequest = q('ccMainRequest').value;
    c.tried = q('ccTried').value;
    c.didntHelp = q('ccDidntHelp').value;
    c.desiredOutcome = q('ccDesiredOutcome').value;
    c.clientNotes = q('ccClientNotes').value;
    c.photoData = photoData || '';
    return c;
  }

  function hasAnyDraftData(){
    if(photoData) return true;
    return fieldIds.some(id=>String(q(id)?.value||'').trim()!=='');
  }

  function saveCard(){
    if(draftMode){
      if(!draft) return;
      collectInto(draft);
      state.clients.push(draft);
      clientId=draft.id;
      requestId=null;
      situationId=null;
      selected=null;
      if(typeof save==='function') save();
      if(typeof renderClient==='function') renderClient();
      draftMode=false;draft=null;dirty=false;
      dlg.close();
      return;
    }
    const c = sourceClient();
    if(!c) return;
    collectInto(c);
    if(typeof save==='function') save();
    if(typeof renderClient==='function') renderClient();
    dirty=false;
    dlg.close();
  }

  function closeDraftAware(){
    if(draftMode){
      if(!hasAnyDraftData()){
        draftMode=false;draft=null;dirty=false;dlg.close();return;
      }
      if(window.confirm('Сохранить клиента?')){saveCard();return;}
      draftMode=false;draft=null;dirty=false;dlg.close();return;
    }
    dlg.close();
  }

  function openExisting(){
    const c = typeof client==='function' ? client() : null;
    if(!c) return alert('Сначала выбери клиента.');
    draftMode=false;draft=null;
    q('ccSaveBtn').textContent='Сохранить карточку';
    fillFrom(c);
    dlg.showModal();
  }

  function openNew(){
    draftMode=true;
    draft=typeof newClient==='function' ? newClient() : {id:(crypto.randomUUID?crypto.randomUUID():Date.now()+''),name:'Новый клиент',city:'',age:'',birth:'',photoData:'',vk:'',telegram:'',max:'',sessions:[],requests:[]};
    q('ccSaveBtn').textContent='Сохранить клиента';
    fillFrom(draft);
    dlg.showModal();
    setTimeout(()=>q('ccName')?.focus(),0);
  }

  q('ccBirth').addEventListener('input', e => { q('ccAge').value = ageFromBirth(e.target.value); dirty=true; });
  fieldIds.forEach(id=>q(id)?.addEventListener('input',()=>{dirty=true;}));
  q('ccGender')?.addEventListener('change',()=>{dirty=true;});
  q('ccCloseBtn').onclick = closeDraftAware;
  q('ccSaveBtn').onclick = saveCard;
  q('ccPhotoFrame').onclick=()=>q('ccPhotoInput').click();
  q('ccPhotoInput').onchange=e=>{
    const f=e.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{setPhoto(r.result);dirty=true;};
    r.readAsDataURL(f);
    e.target.value='';
  };

  const btn = document.getElementById('clientCardModeBtn');
  if(btn) btn.onclick = openExisting;

  dlg.addEventListener('click', e => { if(e.target === dlg) closeDraftAware(); });
  dlg.addEventListener('cancel',e=>{e.preventDefault();closeDraftAware();});

  window.DiagnostikaClientCard={openExisting,openNew,isDraft:()=>draftMode};
})();
