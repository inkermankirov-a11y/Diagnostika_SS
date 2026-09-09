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

  const originalOpenSessionEditor=window.openSessionEditor;
  if(typeof originalOpenSessionEditor==='function'){
    window.openSessionEditor=function(c,s,number){
      originalOpenSessionEditor(c,s,number);
      const dialogs=[...document.querySelectorAll('dialog.session-edit-dialog')];
      const dlg=dialogs[dialogs.length-1];
      if(!dlg) return;
      const grid=dlg.querySelector('.session-edit-grid');
      if(!grid) return;

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

      const saveBtn=dlg.querySelector('.session-edit-actions .primary');
      if(saveBtn){
        const oldSave=saveBtn.onclick;
        saveBtn.onclick=e=>{
          s.sessionFormat=select.value;
          s.sessionFormatOther=select.value==='other'?other.value.trim():'';
          if(typeof save==='function') save();
          if(typeof oldSave==='function') oldSave.call(saveBtn,e);
        };
      }
    };
  }

  const originalRenderSessions=window.renderSessions;
  if(typeof originalRenderSessions==='function'){
    window.renderSessions=function(){
      originalRenderSessions();
      const c=typeof client==='function'?client():null;
      const root=document.querySelector('#sessionsList');
      if(!c||!root||!Array.isArray(c.sessions)) return;

      const chronological=c.sessions.map((s,index)=>({s,index,time:typeof sessionTimeValue==='function'?sessionTimeValue(s,index):index}))
        .sort((a,b)=>a.time-b.time||a.index-b.index);
      const display=[...chronological].reverse();
      const cards=[...root.querySelectorAll('.session-card')];

      cards.forEach((card,i)=>{
        const s=display[i]?.s;
        const text=formatLabel(s);
        if(!text) return;
        const meta=card.querySelector('.session-card-meta');
        if(!meta) return;
        const chip=document.createElement('span');
        chip.className='session-format-chip '+(s.sessionFormat||'');
        chip.textContent=text;
        chip.title='Формат проведения сессии';
        meta.appendChild(chip);
      });
    };
    window.renderSessions();
  }
})();
