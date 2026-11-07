'use strict';

(() => {
  const OPTIONS=[
    ['','— Не указано —'],
    ['google-meet','Google Meet'],
    ['yandex-telemost','Яндекс Телемост'],
    ['zoom','Zoom'],
    ['telegram','Telegram'],
    ['whatsapp','WhatsApp'],
    ['max','MAX'],
    ['other-video','Другой мессенджер / видеосвязь'],
    ['in-person','Лично'],
    ['other','Другое']
  ];

  const LABELS=Object.fromEntries(OPTIONS);

  function formatLabel(s){
    if(!s?.sessionFormat) return '';
    if(s.sessionFormat==='other') return (s.sessionFormatOther||'Другое').trim()||'Другое';
    return LABELS[s.sessionFormat]||s.sessionFormat;
  }

  function enhanceSessionEditor(event){
    const {session:s,dialog:dlg}=event.detail||{};
    if(!s||!dlg||dlg.querySelector('.session-format-field'))return;
    const grid=dlg.querySelector('.session-edit-grid');
    if(!grid)return;

    grid.classList.add('session-edit-grid-with-format');

    const field=document.createElement('div');
    field.className='session-format-field';

    const label=document.createElement('label');
    label.className='session-format-label';
    label.textContent='Формат проведения';

    const select=document.createElement('select');
    select.className='session-format-select';
    OPTIONS.forEach(([value,text])=>{
      const o=document.createElement('option');
      o.value=value;o.textContent=text;select.appendChild(o);
    });
    select.value=s.sessionFormat||'';

    const other=document.createElement('input');
    other.className='session-format-other';
    other.type='text';
    other.placeholder='Например: FaceTime, Discord';
    other.value=s.sessionFormatOther||'';

    const syncOther=()=>other.classList.toggle('hidden',select.value!=='other');
    select.onchange=syncOther;syncOther();

    field.append(label,select,other);
    grid.appendChild(field);
  }

  document.addEventListener('diagnostika:session-editor-opened',enhanceSessionEditor);

})();
