'use strict';

(() => {
  const LEGACY_KEY='diagnostika-quick-notes-v1';
  if(document.getElementById('quickNotesBtn')) return;

  const TEXT={
    ru:{button:'Заметки',title:'Общие заметки',placeholder:'Запишите мысль, идею или то, что нужно не забыть…',add:'Сохранить заметку',update:'Сохранить изменения',newNote:'Новая заметка',empty:'Заметок пока нет',delete:'Удалить',close:'Закрыть',notesTab:"Заметки",quickTab:"Быстрые мысли",quickPlaceholder:"Запишите мысль, наблюдение или идею…",today:"Сегодня",yesterday:"Вчера",quickEmpty:"Быстрых мыслей пока нет",quickNew:"Новая мысль",quickAdd:"Сохранить мысль",quickUpdate:"Сохранить изменения"},
    en:{button:'Notes',title:'General notes',placeholder:'Write down a thought, idea, or something to remember…',add:'Save note',update:'Save changes',newNote:'New note',empty:'No notes yet',delete:'Delete',close:'Close',notesTab:"Notes",quickTab:"Quick thoughts",quickPlaceholder:"Capture an idea, observation or thought…",today:"Today",yesterday:"Yesterday",quickEmpty:"No quick thoughts yet",quickNew:"New thought",quickAdd:"Save thought",quickUpdate:"Save changes"},
    fr:{button:'Notes',title:'Notes générales',placeholder:'Notez une pensée, une idée ou quelque chose à retenir…',add:'Enregistrer',update:'Enregistrer les modifications',newNote:'Nouvelle note',empty:'Aucune note',delete:'Supprimer',close:'Fermer',notesTab:"Notes",quickTab:"Pensées rapides",quickPlaceholder:"Notez une idée ou une réflexion…",today:"Aujourd'hui",yesterday:"Hier",quickEmpty:"Pas encore de pensées",quickNew:"Nouvelle pensée",quickAdd:"Enregistrer la pensée",quickUpdate:"Enregistrer les modifications"},
    de:{button:'Notizen',title:'Allgemeine Notizen',placeholder:'Gedanke, Idee oder Erinnerung notieren…',add:'Notiz speichern',update:'Änderungen speichern',newNote:'Neue Notiz',empty:'Noch keine Notizen',delete:'Löschen',close:'Schließen',notesTab:"Notizen",quickTab:"Schnelle Gedanken",quickPlaceholder:"Gedanken oder Ideen notieren…",today:"Heute",yesterday:"Gestern",quickEmpty:"Noch keine schnellen Gedanken",quickNew:"Neuer Gedanke",quickAdd:"Gedanken speichern",quickUpdate:"Änderungen speichern"},
    it:{button:'Note',title:'Note generali',placeholder:'Scrivi un pensiero, un’idea o qualcosa da ricordare…',add:'Salva nota',update:'Salva modifiche',newNote:'Nuova nota',empty:'Nessuna nota',delete:'Elimina',close:'Chiudi',notesTab:"Note",quickTab:"Pensieri rapidi",quickPlaceholder:"Scrivi un'idea o un pensiero…",today:"Oggi",yesterday:"Ieri",quickEmpty:"Nessun pensiero rapido",quickNew:"Nuovo pensiero",quickAdd:"Salva pensiero",quickUpdate:"Salva modifiche"}
  };
  const lang=()=>window.DiagnostikaI18n?.language||localStorage.getItem('diagnostika-ui-language')||'en';
  const tr=()=>TEXT[lang()]||TEXT.en;
  const appState=()=>{try{return typeof state!=='undefined'&&state&&typeof state==='object'?state:null;}catch(_){return null;}};
  const legacyLoad=()=>{try{const v=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]');return Array.isArray(v)?v:[]}catch(_){return[]}};
  const clone=v=>{try{return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));}catch(_){return Array.isArray(v)?v.map(x=>({...x})):[];}};
  function persistState(source){
    try{
      if(typeof save==='function')return save({source})!==false;
      const st=appState(),db=window.DiagnostikaDB||window.DiagnostikaPlatform?.db;
      return !!(st&&db?.writeState&&db.writeState(st,{source})===true);
    }catch(error){
      console.error('[Diagnostika] general notes persistence failed',error);
      return false;
    }
  }
  function load(){
    const st=appState();
    if(!st)return [];
    if(Array.isArray(st.generalNotes))return clone(st.generalNotes);
    const legacy=legacyLoad();
    st.generalNotes=clone(legacy);
    if(legacy.length)persistState('general-notes-legacy-migration');
    return clone(st.generalNotes);
  }
  function saveNotes(next,source='general-notes-save'){
    const st=appState();
    if(!st)return false;
    const before=Array.isArray(st.generalNotes)?clone(st.generalNotes):undefined;
    st.generalNotes=clone(Array.isArray(next)?next:[]);
    if(persistState(source)){
      window.dispatchEvent(new CustomEvent('diagnostika-general-notes-changed',{detail:{count:st.generalNotes.length}}));
      return true;
    }
    if(before===undefined)delete st.generalNotes;
    else st.generalNotes=before;
    return false;
  }
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
    .quick-notes-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#e9f2f9;border:1px solid #d2e2ef;border-radius:12px;padding:4px;margin-bottom:13px}
    .quick-notes-tabs .quick-notes-tab{min-height:39px!important;height:auto!important;padding:7px 10px!important;background:transparent!important;color:#637c93!important;border:1px solid transparent!important;border-radius:9px!important;box-shadow:none!important;font-weight:800!important;font-size:13px!important}
    .quick-notes-tabs .quick-notes-tab[aria-selected="true"]{background:#fff!important;border-color:#c1d7ea!important;color:#23698d!important;box-shadow:0 3px 9px rgba(31,76,110,.10)!important}
    .quick-note-day-header{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:850;color:#5285a6;margin:15px 0 1px;padding:2px 3px}
    .quick-notes-tabs .quick-notes-tab:focus-visible{outline:2px solid #65a9dc;outline-offset:2px}
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
  let activeKind='notes';
  const kindOf=item=>item?.kind==='quickThought'?'quickThought':'notes';
  const normalizedKind=kind=>kind==='quickThought'?'quickThought':'notes';
  function fmtDate(ts){
    try{return new Intl.DateTimeFormat(lang()==='ru'?'ru-RU':lang(),{
      day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
    }).format(new Date(ts))}catch(_){return'';}
  }
  function dayKey(ts){
    const d=new Date(ts);
    return Number.isFinite(d.getTime())?
      [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'):'';
  }
  function groupLabel(ts,t){
    const today=new Date();
    const yesterday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-1);
    if(dayKey(ts)===dayKey(today))return t.today;
    if(dayKey(ts)===dayKey(yesterday))return t.yesterday;
    try{return new Intl.DateTimeFormat(lang()==='ru'?'ru-RU':lang(),
      {day:'numeric',month:'long',year:'numeric'}).format(new Date(ts))}
    catch(_){return'';}
  }
  function close(){overlay.hidden=true;overlay.innerHTML='';document.documentElement.style.overflow='';editingId=null;}
  function open(category='notes'){
    activeKind=normalizedKind(typeof category==='string'?category:'notes');
    editingId=null;
    const t=tr();
    overlay.innerHTML=
      '<section class="quick-notes-panel">'+
        '<div class="quick-notes-head"><h2>📝 '+esc(t.title)+'</h2><button type="button" class="tk-btn quick-notes-close">×</button></div>'+
        '<div class="quick-notes-tabs" role="tablist" aria-label="'+esc(t.title)+'">'+
          '<button type="button" class="quick-notes-tab" role="tab" data-kind="notes">'+esc(t.notesTab)+'</button>'+
          '<button type="button" class="quick-notes-tab" role="tab" data-kind="quickThought">'+esc(t.quickTab)+'</button>'+
        '</div>'+
        '<div class="quick-notes-editor"><textarea class="quick-notes-text"></textarea>'+
          '<div class="quick-notes-actions"><button type="button" class="tk-btn quick-notes-new">'+esc(t.newNote)+'</button>'+
          '<button type="button" class="tk-btn quick-notes-save">'+esc(t.add)+'</button></div>'+
        '</div><div class="quick-notes-list" role="tabpanel"></div></section>';
    overlay.hidden=false;document.documentElement.style.overflow='hidden';
    overlay.querySelector('.quick-notes-close').onclick=close;
    const input=overlay.querySelector('.quick-notes-text');
    const saveBtn=overlay.querySelector('.quick-notes-save');
    const newBtn=overlay.querySelector('.quick-notes-new');
    const tabs=[...overlay.querySelectorAll('.quick-notes-tab')];
    function reset(){
      editingId=null;
      input.value='';
      saveBtn.textContent=activeKind==='quickThought'?t.quickAdd:t.add;
      newBtn.textContent=activeKind==='quickThought'?t.quickNew:t.newNote;
      input.focus();
    }
    function render(){
      const list=overlay.querySelector('.quick-notes-list');
      list.innerHTML='';
      input.placeholder=activeKind==='quickThought'?t.quickPlaceholder:t.placeholder;
      newBtn.textContent=activeKind==='quickThought'?t.quickNew:t.newNote;
      if(!editingId)saveBtn.textContent=activeKind==='quickThought'?t.quickAdd:t.add;
      for(const tab of tabs)tab.setAttribute('aria-selected',String(tab.dataset.kind===activeKind));
      const notes=load().filter(note=>kindOf(note)===activeKind);
      if(!notes.length){
        list.innerHTML='<div class="quick-note-empty">'+esc(activeKind==='quickThought'?t.quickEmpty:t.empty)+'</div>';
        return;
      }
      notes.sort((a,b)=>(b.createdAt||b.updatedAt||0)-(a.createdAt||a.updatedAt||0));
      let previousGroup='';
      for(const note of notes){
        if(activeKind==='quickThought'){
          const group=groupLabel(note.createdAt||note.updatedAt,t);
          if(group!==previousGroup){
            const heading=document.createElement('div');
            heading.className='quick-note-day-header';
            heading.textContent=group;
            list.appendChild(heading);
            previousGroup=group;
          }
        }
        const row=document.createElement('div');row.className='quick-note-item';
        row.innerHTML='<div><div class="quick-note-content">'+esc(note.text)+
          '</div><div class="quick-note-date">'+esc(fmtDate(note.createdAt||note.updatedAt))+
          '</div></div><button type="button" class="tk-btn quick-note-delete">'+esc(t.delete)+'</button>';
        row.querySelector('.quick-note-delete').onclick=e=>{
          e.stopPropagation();
          if(!saveNotes(load().filter(x=>x.id!==note.id),'general-notes-delete'))return;
          if(editingId===note.id)reset();
          render();
        };
        row.onclick=()=>{
          editingId=note.id;
          input.value=note.text||'';
          saveBtn.textContent=activeKind==='quickThought'?t.quickUpdate:t.update;
          input.focus();
        };
        list.appendChild(row);
      }
    }
    for(const tab of tabs)tab.onclick=()=>{
      if(tab.dataset.kind===activeKind)return;
      activeKind=normalizedKind(tab.dataset.kind);
      reset();
      render();
    };
    newBtn.onclick=reset;
    saveBtn.onclick=()=>{
      const content=input.value.trim();
      if(!content)return;
      const notes=load(),now=Date.now();
      if(editingId){
        const item=notes.find(x=>x.id===editingId);
        if(!item)return;
        item.text=content;
        item.updatedAt=now;
      }else notes.push({id:'n_'+now+'_'+Math.random().toString(36).slice(2,7),text:content,kind:activeKind,createdAt:now,updatedAt:now});
      if(!saveNotes(notes,editingId?'general-notes-update':'general-notes-create'))return;
      reset();
      render();
    };
    input.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();saveBtn.click();}
    });
    render();
    setTimeout(()=>input.focus(),0);
  }
  function addWithKind(text,kind){
    const content=String(text||'').trim();
    if(!content)return false;
    const notes=load(),now=Date.now();
    notes.push({id:'n_'+now+'_'+Math.random().toString(36).slice(2,7),
      text:content,kind:normalizedKind(kind),createdAt:now,updatedAt:now});
    return saveNotes(notes,kind==='quickThought'?'general-notes-home-quick-thought':'general-notes-create');
  }
  const add=text=>addWithKind(text,'notes');
  const addQuickThought=text=>addWithKind(text,'quickThought');
  const openQuickThoughts=()=>open('quickThought');
  window.DiagnostikaQuickNotes={open,openQuickThoughts,close,isOpen:()=>!overlay.hidden,add,addQuickThought};
  wrap.querySelector('#quickNotesBtn').onclick=open;
  document.addEventListener('diagnostika:quick-notes-open',open);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
})();