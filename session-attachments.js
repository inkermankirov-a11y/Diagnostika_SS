'use strict';

function filesApi(){
  const facade=window.DiagnostikaFiles;
  if(facade?.moduleAware===true)return facade;
  return window.DiagnostikaPlatform?.services?.files||null;
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
  const h=document.createElement('div');h.className='session-edit-title';h.textContent=`Сессия №${number}`;
  const grid=document.createElement('div');grid.className='session-edit-grid';
  const dateInput=document.createElement('input');dateInput.type='date';dateInput.value=s.date||today();
  const link=document.createElement('select');link.innerHTML='<option value="">— Без связи —</option>';
  c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.title||'Без названия';link.appendChild(o);});
  link.value=s.requestId||'';
  grid.append(dateInput,link);

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
  const saveBtn=document.createElement('button');saveBtn.type='button';saveBtn.className='primary';saveBtn.textContent='Сохранить';
  cancel.onclick=()=>dlg.close();
  saveBtn.onclick=()=>{
    const youtube=normalizeYoutubeUrl(youtubeInput.value);
    if(youtube===null) return alert('Проверь ссылку: сейчас принимаются ссылки YouTube и youtu.be.');

    const api=window.DiagnostikaSessions?.moduleAware===true
      ? window.DiagnostikaSessions
      : window.DiagnostikaPlatform?.services?.sessions||null;
    if(!api?.update)return alert('Модуль сессий ещё загружается.');

    const formatSelect=dlg.querySelector('.session-format-select');
    const formatOther=dlg.querySelector('.session-format-other');
    const changes={
      date:dateInput.value||today(),
      requestId:link.value,
      notes:ta.value,
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
  wrap.append(h,grid,ta,youtubeBlock,mediaBlock,localHint,actions);dlg.appendChild(wrap);document.body.appendChild(dlg);
  dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();
}
