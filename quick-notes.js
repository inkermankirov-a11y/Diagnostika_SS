'use strict';

(() => {
  const KEY='diagnostika-quick-notes-v1';
  if(document.getElementById('quickNotesBtn')) return;

  const TEXT={
    ru:{button:'Заметки',title:'Быстрые заметки',placeholder:'Запишите мысль, идею или то, что нужно не забыть…',add:'Сохранить заметку',update:'Сохранить изменения',newNote:'Новая заметка',empty:'Заметок пока нет',delete:'Удалить',close:'Закрыть'},
    en:{button:'Notes',title:'Quick notes',placeholder:'Write down a thought, idea, or something to remember…',add:'Save note',update:'Save changes',newNote:'New note',empty:'No notes yet',delete:'Delete',close:'Close'},
    fr:{button:'Notes',title:'Notes rapides',placeholder:'Notez une pensée, une idée ou quelque chose à retenir…',add:'Enregistrer',update:'Enregistrer les modifications',newNote:'Nouvelle note',empty:'Aucune note',delete:'Supprimer',close:'Fermer'},
    de:{button:'Notizen',title:'Schnelle Notizen',placeholder:'Gedanke, Idee oder Erinnerung notieren…',add:'Notiz speichern',update:'Änderungen speichern',newNote:'Neue Notiz',empty:'Noch keine Notizen',delete:'Löschen',close:'Schließen'},
    it:{button:'Note',title:'Note rapide',placeholder:'Scrivi un pensiero, un’idea o qualcosa da ricordare…',add:'Salva nota',update:'Salva modifiche',newNote:'Nuova nota',empty:'Nessuna nota',delete:'Elimina',close:'Chiudi'}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
  const tr=()=>TEXT[lang()]||TEXT.en;
  const load=()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}};
  const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
  const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const style=document.createElement('style');
  style.textContent=`
    .quick-notes-wrap{display:flex;align-items:center;margin-right:8px}
    .quick-notes-btn{height:42px;min-width:108px;padding:0 13px;border:1px solid #3d4f66;border-radius:10px;background:linear-gradient(#5d7188,#405268);color:#fff;font-family:'Segoe UI',Arial,sans-serif;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 3px 9px rgba(30,41,59,.24)}
    .quick-notes-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
    .quick-notes-overlay{position:fixed;inset:0;z-index:12500;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.54);backdrop-filter:blur(6px)}
    .quick-notes-overlay[hidden]{display:none!important}
    .quick-notes-panel{width:min(680px,calc(100vw - 24px));max-height:86dvh;overflow:auto;background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 25px 70px rgba(15,23,42,.35);padding:16px;box-sizing:border-box;color:#243447}
    .quick-notes-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.quick-notes-head h2{margin:0;font-size:20px}.quick-notes-close{width:36px;height:36px;padding:0!important}
    .quick-notes-editor{padding:12px;border:1px solid #d8e3ec;border-radius:12px;background:#fff}.quick-notes-text{width:100%;min-height:125px;resize:vertical;border:1px solid #b9c6d4;border-radius:9px;padding:10px 12px;box-sizing:border-box;font:14px/1.45 'Segoe UI',Arial,sans-serif}.quick-notes-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
    .quick-notes-list{display:grid;gap:8px;margin-top:12px}.quick-note-item{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 12px;border:1px solid #dbe4ed;border-radius:10px;background:#fff;cursor:pointer}.quick-note-item:hover{background:#f4f8fc}.quick-note-content{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.4}.quick-note-date{font-size:10px;color:#8290a1;margin-top:5px}.quick-note-delete{height:30px!important;padding:0 9px!important;font-size:11px!important;background:linear-gradient(#ef7777,#d95353)!important;color:#fff!important}.quick-note-empty{padding:16px;text-align:center;color:#94a3b8;font-size:12px}
    @media(max-width:760px){.quick-notes-wrap{margin-right:5px}.quick-notes-btn{min-width:46px;width:46px;padding:0}.quick-notes-label{display:none}.quick-notes-overlay{place-items:end center;padding:0}.quick-notes-panel{width:100%;max-height:88dvh;border-radius:18px 18px 0 0}}
  `;
  document.head.appendChild(style);

  const settingsWrap=document.querySelector('.settings-wrap');
  if(!settingsWrap) return;
  const wrap=document.createElement('div');wrap.className='quick-notes-wrap';
  wrap.innerHTML=`<button id="quickNotesBtn" class="quick-notes-btn" type="button"><span>📝</span><span class="quick-notes-label">${tr().button}</span></button>`;
  settingsWrap.parentNode.insertBefore(wrap,settingsWrap);

  const overlay=document.createElement('div');overlay.className='quick-notes-overlay';overlay.hidden=true;document.body.appendChild(overlay);
  let editingId=null;

  function fmtDate(ts){try{return new Intl.DateTimeFormat(lang()==='ru'?'ru-RU':lang(),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}catch(_){return''}}
  function close(){overlay.hidden=true;overlay.innerHTML='';document.documentElement.style.overflow='';editingId=null;}
  function open(){
    const t=tr();
    overlay.innerHTML=`<section class="quick-notes-panel"><div class="quick-notes-head"><h2>📝 ${t.title}</h2><button type="button" class="tk-btn quick-notes-close">×</button></div><div class="quick-notes-editor"><textarea class="quick-notes-text" placeholder="${esc(t.placeholder)}"></textarea><div class="quick-notes-actions"><button type="button" class="tk-btn quick-notes-new">${t.newNote}</button><button type="button" class="tk-btn quick-notes-save">${t.add}</button></div></div><div class="quick-notes-list"></div></section>`;
    overlay.hidden=false;document.documentElement.style.overflow='hidden';
    overlay.querySelector('.quick-notes-close').onclick=close;
    const input=overlay.querySelector('.quick-notes-text'),saveBtn=overlay.querySelector('.quick-notes-save');
    function reset(){editingId=null;input.value='';saveBtn.textContent=t.add;input.focus();}
    overlay.querySelector('.quick-notes-new').onclick=reset;
    function render(){
      const notes=load(),list=overlay.querySelector('.quick-notes-list');list.innerHTML='';
      if(!notes.length){list.innerHTML=`<div class="quick-note-empty">${t.empty}</div>`;return;}
      notes.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0)).forEach(note=>{
        const row=document.createElement('div');row.className='quick-note-item';
        row.innerHTML=`<div><div class="quick-note-content">${esc(note.text)}</div><div class="quick-note-date">${fmtDate(note.updatedAt||note.createdAt)}</div></div><button type="button" class="tk-btn quick-note-delete">${t.delete}</button>`;
        row.querySelector('.quick-note-delete').onclick=e=>{e.stopPropagation();save(load().filter(x=>x.id!==note.id));if(editingId===note.id)reset();render();};
        row.onclick=()=>{editingId=note.id;input.value=note.text||'';saveBtn.textContent=t.update;input.focus();};
        list.appendChild(row);
      });
    }
    saveBtn.onclick=()=>{
      const text=input.value.trim();if(!text)return;
      const notes=load(),now=Date.now();
      if(editingId){const n=notes.find(x=>x.id===editingId);if(n){n.text=text;n.updatedAt=now;}}
      else notes.push({id:'n_'+now+'_'+Math.random().toString(36).slice(2,7),text,createdAt:now,updatedAt:now});
      save(notes);reset();render();
    };
    input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveBtn.click();}});
    render();setTimeout(()=>input.focus(),0);
  }

  wrap.querySelector('#quickNotesBtn').onclick=open;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
})();