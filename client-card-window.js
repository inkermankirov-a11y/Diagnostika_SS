'use strict';

(() => {
  const dlg = document.createElement('dialog');
  dlg.id = 'clientCardDialog';
  dlg.className = 'client-card-dialog';
  dlg.innerHTML = `
    <div class="client-card-window">
      <div class="client-card-window-title">РАБОТА С КЛИЕНТОМ</div>
      <div class="client-card-sheet">
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
          <label>С чем пришёл<textarea id="ccInitialProblem"></textarea></label>
          <label>Основной запрос<textarea id="ccMainRequest"></textarea></label>
          <label>Что уже делал<textarea id="ccTried"></textarea></label>
          <label>Что не помогло<textarea id="ccDidntHelp"></textarea></label>
          <label>Какой результат хочет получить<textarea id="ccDesiredOutcome"></textarea></label>
        </div>
      </div>
      <div class="client-card-footer">
        <button id="ccCloseBtn" type="button" class="cc-close-btn">Закрыть</button>
        <button id="ccSaveBtn" type="button" class="cc-save-btn">Сохранить карточку</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const q = id => document.getElementById(id);

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

  function fill(){
    const c = client();
    if(!c) return;
    q('ccName').value = c.name || '';
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
  }

  function saveCard(){
    const c = client();
    if(!c) return;
    c.name = q('ccName').value.trim();
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
    save();
    renderClient();
    dlg.close();
  }

  q('ccBirth').addEventListener('input', e => { q('ccAge').value = ageFromBirth(e.target.value); });
  q('ccCloseBtn').onclick = () => dlg.close();
  q('ccSaveBtn').onclick = saveCard;

  const btn = document.getElementById('clientCardModeBtn');
  if(btn){
    btn.onclick = () => {
      const c = client();
      if(!c) return alert('Сначала выбери клиента.');
      fill();
      dlg.showModal();
    };
  }

  dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });
})();
