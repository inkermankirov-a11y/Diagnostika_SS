'use strict';
/* Local safety net for editable fields. No text is sent to any remote service. */
(() => {
  if(window.DiagnostikaEditDrafts)return;
  const PREFIX='diagnostika:edit-draft:v1:';
  const TTL=7*24*60*60*1000;
  const MAX=100000;
  const selector='textarea,[contenteditable="true"],input[type="text"],input[type="search"],input[type="url"],input[type="email"],input:not([type])';
  const known=new WeakMap();
  const restoring=new WeakSet();
  function storage(){try{return window.localStorage;}catch(_){return null;}}
  function identity(el){
    if(el.dataset.editDraftKey)return el.dataset.editDraftKey;
    const dialog=el.closest('dialog');
    // Anonymous fields in dialogs cannot be safely mapped across clients/records.
    const client=window.DiagnostikaClients?.current?.()?.id||'no-client';
    const root=dialog||el.closest('form')||el.closest('[id]')||document.body;
    const parent=root===document.body?'page':root.id||[...root.classList].slice(0,2).join('.');
    const all=[...root.querySelectorAll(selector)];
    const index=all.indexOf(el);
    const field=el.id||el.name||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'field';
    if(index<0)return '';
    return ['auto',location.pathname,client,parent,field,index].join(':').slice(0,330);
  }
  function value(el){return el.isContentEditable?el.innerHTML:String(el.value??'');}
  function save(key,text){if(!key||text.length>MAX)return;try{storage()?.setItem(PREFIX+key,JSON.stringify({value:text,time:Date.now()}));}catch(_){/* quota/private mode */}}
  function read(key){
    if(!key)return null;
    try{
      const raw=storage()?.getItem(PREFIX+key);if(!raw)return null;
      const entry=JSON.parse(raw);
      if(!entry||typeof entry.value!=='string'||Date.now()-entry.time>TTL){clear(key);return null;}
      return entry.value;
    }catch(_){return null;}
  }
  function clear(key){try{storage()?.removeItem(PREFIX+key);}catch(_){}}
  function assign(el,text){
    if(el.isContentEditable)el.innerHTML=text;
    else el.value=text;
    el.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function init(el){
    if(known.has(el))return;
    const key=identity(el);if(!key)return;
    known.set(el,key);
    const draft=read(key),current=value(el);
    if(draft!==null&&draft!==current){
      // Never silently replace saved content with a draft from an earlier edit.
      if(window.confirm('Найден несохранённый черновик этого поля. Восстановить его?')){
        restoring.add(el);assign(el,draft);restoring.delete(el);
      }else clear(key);
    }
  }
  document.addEventListener('focusin',event=>{
    const el=event.target;
    if(el?.matches?.(selector))init(el);
  },true);
  document.addEventListener('input',event=>{
    const el=event.target;
    if(!el?.matches?.(selector)||restoring.has(el))return;
    if(!known.has(el))known.set(el,identity(el));
    const key=known.get(el);
    if(key)save(key,value(el));
  },true);
  function dirty(dialog){
    return [...dialog.querySelectorAll(selector)].some(el=>{
      const key=known.get(el)||identity(el);
      return !!key&&read(key)!==null;
    });
  }
  // Esc should not silently throw away entered text. Backdrop is handled separately.
  document.addEventListener('cancel',event=>{
    const dlg=event.target;
    if(!(dlg instanceof HTMLDialogElement)||!dirty(dlg))return;
    event.preventDefault();
    // Keeping the dialog open is safer than auto-discarding.
    const leave=window.confirm('Есть несохранённый текст. Закрыть окно? Черновик останется в этом браузере и будет предложен при следующем открытии.');
    if(leave)dlg.close();
  },true);
  window.addEventListener('beforeunload',event=>{
    const live=[...document.querySelectorAll(selector)].some(el=>known.has(el)&&read(known.get(el))!==null);
    if(!live)return;
    event.preventDefault();event.returnValue='';
  });
  window.DiagnostikaEditDrafts=Object.freeze({
    save,read,clear,
    attach(el,key){
      el.dataset.editDraftKey=key;
      // defer restore to focus so existing form initialization is complete.
      known.delete(el);
    },
    clearField(el){const key=known.get(el)||identity(el);clear(key);},
    clearKey:clear
  });
})();
