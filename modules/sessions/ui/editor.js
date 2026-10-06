'use strict';

function filesApi(){
  const facade=window.DiagnostikaFiles;
  return facade?.moduleAware===true?facade:null;
}

function sessionToday(){
  return new Date().toISOString().slice(0,10);
}

function sessionDisplayDate(value){
  const raw=String(value||'').trim();
  if(!raw)return '—';
  const iso=raw.slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
    const [year,month,day]=iso.split('-').map(Number);
    return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(year,month-1,day,12,0,0));
  }
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?raw:new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}

// Compatibility wrappers for older storage code. Persistence ownership lives in FileService.
async function mediaDbPut(record){
  const api=filesApi();
  if(!api?.put)throw new Error('Модуль файлов ещё загружается.');
  const saved=await api.put(record,{source:'session-attachment-compat-put',overwrite:true});
  if(!saved)throw new Error('Не удалось сохранить файл.');
  return saved;
}

async function mediaDbGet(id){
  const api=filesApi();
  if(!api?.get)return null;
  return api.get(id);
}

async function mediaDbList(sessionId){
  const api=filesApi();
  if(!api?.list)return [];
  return api.list({sessionId});
}

async function mediaDbDelete(id){
  const api=filesApi();
  if(!api?.remove)return null;
  return api.remove(id,{source:'session-attachment-compat-delete'});
}

function attachmentKind(file){
  const type=(file.type||'').toLowerCase();
  const name=(file.name||'').toLowerCase();
  if(type.startsWith('image/')) return {icon:'▣',label:'Изображение',kind:'image'};
  if(type.startsWith('audio/')) return {icon:'♪',label:'Аудио',kind:'audio'};
  if(type.startsWith('video/')) return {icon:'▶',label:'Видео',kind:'video'};
  if(type.includes('pdf')||name.endsWith('.pdf')) return {icon:'PDF',label:'PDF',kind:'pdf'};
  if(type.startsWith('text/')||/\.(txt|md|rtf|srt|vtt|csv|json)$/i.test(name)) return {icon:'T',label:'Текст',kind:'text'};
  return {icon:'⌑',label:'Файл',kind:'file'};
}

function attachmentSize(bytes){
  const n=Number(bytes)||0;
  if(n<1024) return `${n} Б`;
  if(n<1024*1024) return `${(n/1024).toFixed(n<10240?1:0)} КБ`;
  if(n<1024*1024*1024) return `${(n/1024/1024).toFixed(n<10*1024*1024?1:0)} МБ`;
  return `${(n/1024/1024/1024).toFixed(1)} ГБ`;
}

function normalizeYoutubeUrl(value){
  let v=String(value||'').trim();
  if(!v) return '';
  if(!/^https?:\/\//i.test(v)) v='https://'+v;
  try{
    const u=new URL(v);
    const host=u.hostname.replace(/^www\./,'').toLowerCase();
    if(host==='youtube.com'||host.endsWith('.youtube.com')||host==='youtu.be') return u.href;
  }catch(e){}
  return null;
}

async function openAttachmentRecord(id){
  try{
    const rec=await filesApi()?.get?.(id);
    if(!rec?.blob) return alert('Файл не найден в локальном хранилище.');
    const url=URL.createObjectURL(rec.blob);
    const a=document.createElement('a');
    a.href=url;
    a.target='_blank';
    a.rel='noopener';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){
    console.error(e);
    alert('Не удалось открыть файл.');
  }
}

async function addSessionFiles(c,s,files){
  const list=[...files];
  if(!list.length) return [];
  const api=filesApi();
  if(!api?.add)throw new Error('Модуль файлов ещё загружается.');

  const saved=[];
  try{
    for(const file of list){
      const record=await api.add(file,{
        clientId:c.id,
        sessionId:s.id,
        name:file.name||'Файл',
        type:file.type||'application/octet-stream',
        size:file.size||0
      },{source:'session-attachment-add'});
      if(!record)throw new Error('FileService rejected attachment.');
      saved.push(record);
    }
    return saved;
  }catch(e){
    console.error(e);
    throw new Error('Не удалось сохранить файл. Возможно, в браузере закончилось место.');
  }
}

function makeAttachmentChip(rec,editable,onChanged){
  const kind=attachmentKind(rec);
  const chip=document.createElement('div');
  chip.className=`session-attachment-chip ${kind.kind}`;
  chip.title=`${kind.label}: ${rec.name}`;

  const icon=document.createElement('span');icon.className='session-attachment-icon';icon.textContent=kind.icon;
  const text=document.createElement('span');text.className='session-attachment-text';
  const name=document.createElement('span');name.className='session-attachment-name';name.textContent=rec.name;
  const size=document.createElement('span');size.className='session-attachment-size';size.textContent=attachmentSize(rec.size);
  text.append(name,size);

  const open=document.createElement('button');open.type='button';open.className='session-attachment-open';open.title='Открыть';open.textContent='↗';
  open.onclick=e=>{e.stopPropagation();openAttachmentRecord(rec.id);};
  chip.onclick=e=>{e.stopPropagation();openAttachmentRecord(rec.id);};
  chip.append(icon,text,open);

  if(editable){
    const remove=document.createElement('button');remove.type='button';remove.className='session-attachment-remove';remove.title='Удалить файл';remove.textContent='×';
    remove.onclick=async e=>{
      e.stopPropagation();
      if(!confirm(`Удалить файл «${rec.name}» из этой сессии?`)) return;
      const removed=await filesApi()?.remove?.(rec.id,{source:'session-attachment-delete'});
      if(!removed)return;
      if(onChanged) onChanged();
    };
    chip.append(remove);
  }
  return chip;
}

async function fillSessionAttachmentPreview(container,sessionId){
  try{
    const files=await (filesApi()?.list?.({sessionId})||[]);
    if(!files.length){container.remove();return;}
    const title=document.createElement('div');title.className='session-attachments-title';title.textContent=`Материалы · ${files.length}`;
    const list=document.createElement('div');list.className='session-attachments-list';
    files.forEach(rec=>list.appendChild(makeAttachmentChip(rec,false)));
    container.replaceChildren(title,list);
  }catch(e){
    console.error(e);
    container.remove();
  }
}

function openSessionEditor(c,s,number){
  const dlg=document.createElement('dialog');
  dlg.className='session-edit-dialog';
  const wrap=document.createElement('div');wrap.className='session-edit-card';
  const planned=s?.planned===true||String(s?.status||'')==='planned';
  const overdue=(()=>{
    if(!planned)return false;
    const raw=String(s?.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return false;
    const [y,m,d]=raw.split('-').map(Number);
    const match=String(s?.scheduledTime||'').trim().match(/^(\d{1,2}):(\d{2})/);
    const at=new Date(y,m-1,d,match?Number(match[1]):23,match?Number(match[2]):59,match?0:59,match?0:999).getTime();
    return at<Date.now();
  })();
  const h=document.createElement('div');h.className='session-edit-title';h.textContent=`Сессия №${number}`;

  const plannedBanner=document.createElement('div');
  plannedBanner.className='session-planned-banner';
  plannedBanner.hidden=!planned;
  const plannedType=String(s?.appointmentType||'Сессия');
  const plannedDate=sessionDisplayDate(s?.date||sessionToday());
  const plannedTime=String(s?.scheduledTime||'').trim();
  const plannedBannerTop=document.createElement('div');plannedBannerTop.className='session-planned-banner-top';
  const plannedState=document.createElement('span');plannedState.className='session-planned-state';plannedState.textContent='● ЗАПЛАНИРОВАНО';
  const plannedUndone=document.createElement('span');plannedUndone.className='session-planned-undone'+(overdue?' overdue':'');plannedUndone.textContent=overdue?'⚠ ПРОСРОЧЕНО':'НЕ ПРОВЕДЕНА';
  plannedBannerTop.append(plannedState,plannedUndone);
  const plannedWhen=document.createElement('div');plannedWhen.className='session-planned-when';plannedWhen.textContent=`${plannedDate}${plannedTime?' • '+plannedTime:''} • ${plannedType}`;
  const plannedHint=document.createElement('div');plannedHint.className='session-planned-hint';plannedHint.textContent=overdue?'Запись уже просрочена. На странице клиента отметьте её проведённой или перенесите через календарь.':'Дата и время этой записи управляются из календаря. Здесь можно заранее подготовить план работы.';
  plannedBanner.append(plannedBannerTop,plannedWhen,plannedHint);

  const grid=document.createElement('div');grid.className='session-edit-grid';
  const dateInput=document.createElement('input');dateInput.type='date';dateInput.lang='ru-RU';dateInput.value=s.date||sessionToday();
  if(planned){dateInput.disabled=true;dateInput.title='Дата запланированной записи меняется в календаре';}
  const link=document.createElement('select');link.innerHTML='<option value="">— Без связи —</option>';
  c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.title||'Без названия';link.appendChild(o);});
  link.value=s.requestId||'';
  grid.append(dateInput,link);

  const planBlock=document.createElement('section');
  planBlock.className='session-plan-editor';
  planBlock.hidden=!(planned||String(s?.plan||'').trim());
  const planLabel=document.createElement('div');planLabel.className='session-plan-editor-title';planLabel.textContent='ПЛАН НА СЕССИЮ';
  const planInput=document.createElement('textarea');planInput.className='session-plan-editor-text';planInput.value=s.plan||'';planInput.placeholder='Что важно разобрать, какие техники использовать, что проверить, к какому результату прийти…';
  const planHint=document.createElement('div');planHint.className='session-plan-editor-hint';planHint.textContent='Заполни заранее — перед встречей будет видно, с чем работать.';
  planBlock.append(planLabel,planInput,planHint);

  const notesLabel=document.createElement('div');notesLabel.className='session-notes-editor-title';notesLabel.textContent=planned?'ЗАМЕТКИ / ПОСЛЕ СЕССИИ':'ЗАМЕТКИ ПО СЕССИИ';
  const ta=document.createElement('textarea');ta.className='session-edit-text';ta.value=s.notes||'';ta.placeholder='Что делали, результат, заметки';

  const youtubeBlock=document.createElement('div');youtubeBlock.className='session-youtube-editor';
  const youtubeLabel=document.createElement('label');youtubeLabel.textContent='Ссылка на YouTube';
  const youtubeInput=document.createElement('input');youtubeInput.type='url';youtubeInput.placeholder='https://youtu.be/... или https://youtube.com/watch?v=...';youtubeInput.value=s.youtubeUrl||'';
  const youtubeHint=document.createElement('div');youtubeHint.className='session-youtube-hint';youtubeHint.textContent='Можно прикрепить запись сессии, которая хранится на YouTube.';
  youtubeBlock.append(youtubeLabel,youtubeInput,youtubeHint);

  const mediaBlock=document.createElement('section');mediaBlock.className='session-media-editor';
  const mediaHead=document.createElement('div');mediaHead.className='session-media-head';
  const mediaTitle=document.createElement('div');mediaTitle.innerHTML='<strong>Материалы сессии</strong><span>Аудио, видео, изображения, транскрипты и документы</span>';
  const addLabel=document.createElement('label');addLabel.className='session-media-add';addLabel.textContent='+ Добавить файлы';
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.multiple=true;fileInput.hidden=true;
  fileInput.accept='audio/*,video/*,image/*,.txt,.md,.rtf,.pdf,.doc,.docx,.odt,.srt,.vtt,.csv,.json';
  addLabel.appendChild(fileInput);mediaHead.append(mediaTitle,addLabel);
  const drop=document.createElement('div');drop.className='session-media-drop';drop.textContent='Перетащи файлы сюда или нажми «Добавить файлы»';
  const mediaList=document.createElement('div');mediaList.className='session-media-list-editor';
  mediaBlock.append(mediaHead,drop,mediaList);

  const refreshMedia=async()=>{
    const files=await (filesApi()?.list?.({sessionId:s.id})||[]);
    mediaList.innerHTML='';
    if(!files.length){mediaList.innerHTML='<div class="session-media-empty">Файлов пока нет</div>';return;}
    files.forEach(rec=>mediaList.appendChild(makeAttachmentChip(rec,true,refreshMedia)));
  };
  const ingest=async files=>{
    if(!files?.length) return;
    drop.classList.add('busy');drop.textContent='Сохраняю файлы…';
    try{await addSessionFiles(c,s,files);await refreshMedia();}
    catch(e){alert(e.message||'Не удалось сохранить файлы.');}
    finally{drop.classList.remove('busy');drop.textContent='Перетащи файлы сюда или нажми «Добавить файлы»';fileInput.value='';}
  };
  fileInput.onchange=()=>ingest(fileInput.files);
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragover');};
  drop.ondragleave=()=>drop.classList.remove('dragover');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragover');ingest(e.dataTransfer.files);};
  drop.onclick=()=>fileInput.click();
  refreshMedia();

  const localHint=document.createElement('div');localHint.className='session-media-local-hint';localHint.textContent='Основная копия файлов хранится локально в этом браузере. При подключённой папке создаётся зеркальная копия.';

  const actions=document.createElement('div');actions.className='session-edit-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';
  const saveBtn=document.createElement('button');saveBtn.type='button';saveBtn.className='primary';saveBtn.textContent=planned?'Сохранить план':'Сохранить';
  cancel.onclick=()=>dlg.close();
  saveBtn.onclick=()=>{
    const youtube=normalizeYoutubeUrl(youtubeInput.value);
    if(youtube===null) return alert('Проверь ссылку: сейчас принимаются ссылки YouTube и youtu.be.');

    const api=window.DiagnostikaSessions?.moduleAware===true?window.DiagnostikaSessions:null;
    if(!api?.update)return alert('Модуль сессий ещё загружается.');

    const formatSelect=dlg.querySelector('.session-format-select');
    const formatOther=dlg.querySelector('.session-format-other');
    const changes={
      date:planned?(s.date||sessionToday()):(dateInput.value||sessionToday()),
      requestId:link.value,
      notes:ta.value,
      plan:planInput.value,
      youtubeUrl:youtube
    };
    if(formatSelect){
      changes.sessionFormat=formatSelect.value;
      changes.sessionFormatOther=formatSelect.value==='other'?(formatOther?.value||'').trim():'';
    }

    const updated=api.update(s.id,changes,{
      client:c,
      source:'session-editor-save'
    });
    if(!updated)return alert('Не удалось сохранить сессию.');

    dlg.close();
  };
  actions.append(cancel,saveBtn);
  wrap.append(h,plannedBanner,grid,planBlock,notesLabel,ta,youtubeBlock,mediaBlock,localHint,actions);dlg.appendChild(wrap);document.body.appendChild(dlg);
  dlg.addEventListener('close',()=>dlg.remove());
  dlg.showModal();
  document.dispatchEvent(new CustomEvent('diagnostika:session-editor-opened',{
    detail:{client:c,session:s,number,dialog:dlg}
  }));
}
