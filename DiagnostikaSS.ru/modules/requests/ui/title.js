'use strict';

(() => {
  const textarea=document.querySelector('#requestTitle');
  if(!textarea)return;

  const label=textarea.previousElementSibling;
  const wrap=document.createElement('div');
  wrap.className='request-title-display-wrap';
  wrap.innerHTML='<div class="request-title-display" id="requestTitleDisplay">—</div><button type="button" class="tk-btn request-title-edit" id="requestTitleEditBtn">Редактировать</button>';
  textarea.insertAdjacentElement('beforebegin',wrap);
  textarea.style.display='none';

  if(label&&label.classList.contains('small-section-title')){
    label.textContent='ОСНОВНОЙ ЗАПРОС';
    label.classList.remove('spacer-top');
  }

  const queriesBlock=textarea.closest('.queries-block');
  if(queriesBlock&&label){
    const first=queriesBlock.firstElementChild;
    const fragment=document.createDocumentFragment();
    fragment.appendChild(label);
    fragment.appendChild(wrap);
    fragment.appendChild(textarea);
    queriesBlock.insertBefore(fragment,first);
  }

  const dialog=document.createElement('dialog');
  dialog.className='request-title-dialog';
  dialog.innerHTML=`
    <form class="request-title-dialog-card" method="dialog">
      <div class="request-title-dialog-head">
        <div>
          <div class="request-title-dialog-kicker">ОСНОВНОЙ ЗАПРОС</div>
          <div class="request-title-dialog-title">Редактировать запрос</div>
        </div>
        <button type="button" class="request-title-dialog-close" aria-label="Закрыть">×</button>
      </div>
      <label class="request-title-dialog-label" for="requestTitleDialogInput">Формулировка запроса</label>
      <textarea id="requestTitleDialogInput" class="request-title-dialog-input" rows="4"></textarea>
      <div class="request-title-dialog-error" aria-live="polite"></div>
      <div class="request-title-dialog-actions">
        <button type="button" class="request-title-dialog-cancel">Отмена</button>
        <button type="button" class="request-title-dialog-save">Сохранить</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const dialogInput=dialog.querySelector('#requestTitleDialogInput');
  const dialogError=dialog.querySelector('.request-title-dialog-error');
  const dialogSave=dialog.querySelector('.request-title-dialog-save');
  const dialogCancel=dialog.querySelector('.request-title-dialog-cancel');
  const dialogClose=dialog.querySelector('.request-title-dialog-close');
  const dialogTitle=dialog.querySelector('.request-title-dialog-title');
  let editingRequestId=null;

  const style=document.createElement('style');
  style.textContent=`
    .request-title-display-wrap{display:flex;align-items:center;gap:10px;margin:5px 0 14px}
    .request-title-display{flex:1;min-width:0;padding:11px 13px;border:1px solid #c8d5e5;border-left:5px solid #4b67dc;border-radius:8px;background:linear-gradient(180deg,#f8fbff,#eef4ff);color:#22324a;font-size:17px;font-weight:800;line-height:1.28;box-shadow:0 1px 2px rgba(15,23,42,.08);word-break:break-word}
    .request-title-edit{flex:0 0 auto;min-height:40px!important;padding:8px 12px!important;font-size:11px!important}
    .request-title-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 24px);overflow:visible}
    .request-title-dialog::backdrop{background:rgba(12,24,40,.48);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
    .request-title-dialog-card{width:min(560px,calc(100vw - 28px));padding:0;background:linear-gradient(180deg,#f9fbfe 0%,#eef4fa 100%);border:1px solid #bdd0e4;border-radius:18px;box-shadow:0 24px 70px rgba(9,25,45,.34),inset 0 1px 0 rgba(255,255,255,.92);overflow:hidden}
    .request-title-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 14px;border-bottom:1px solid #d9e4ef;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(242,247,252,.88))}
    .request-title-dialog-kicker{font-size:10px;font-weight:900;letter-spacing:.09em;color:#6c84a1;margin-bottom:4px}
    .request-title-dialog-title{font-size:20px;font-weight:850;color:#17345a}
    .request-title-dialog-close{width:34px;height:34px;border:1px solid #c8d5e3;border-radius:9px;background:#fff;color:#48627f;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 3px 8px rgba(15,23,42,.09)}
    .request-title-dialog-label{display:block;margin:18px 22px 7px;color:#4d647f;font-size:12px;font-weight:800}
    .request-title-dialog-input{display:block;width:calc(100% - 44px);min-height:104px;margin:0 22px;padding:12px 13px;resize:vertical;border:1px solid #b7c9dd;border-radius:10px;background:#fff;color:#203653;font:600 15px/1.45 "Segoe UI",Arial,sans-serif;box-sizing:border-box;outline:none;box-shadow:inset 0 1px 2px rgba(25,49,76,.05)}
    .request-title-dialog-input:focus{border-color:#5d8ee6;box-shadow:0 0 0 3px rgba(65,105,225,.12),inset 0 1px 2px rgba(25,49,76,.04)}
    .request-title-dialog-error{min-height:18px;margin:6px 22px 0;color:#b42336;font-size:11px;font-weight:700}
    .request-title-dialog-actions{display:flex;justify-content:flex-end;gap:9px;padding:14px 22px 20px}
    .request-title-dialog-actions button{min-width:112px;min-height:40px;border-radius:9px;padding:9px 15px;font-weight:800;cursor:pointer;box-shadow:0 3px 9px rgba(15,23,42,.12)}
    .request-title-dialog-cancel{border:1px solid #c7d3df;background:linear-gradient(#fff,#e8eef5);color:#435872}
    .request-title-dialog-save{border:1px solid #315dcc;background:linear-gradient(#5d86ee,#315fcf);color:#fff}
    @media(max-width:700px){.request-title-display-wrap{align-items:stretch;flex-direction:column;gap:7px}.request-title-display{font-size:16px}.request-title-edit{align-self:flex-start}.request-title-dialog-actions{display:grid;grid-template-columns:1fr 1fr}.request-title-dialog-actions button{min-width:0;width:100%}}
  `;
  document.head.appendChild(style);

  function platform(){return window.DiagnostikaPlatform||null;}
  function api(){
    if(window.DiagnostikaRequests?.moduleAware===true)return window.DiagnostikaRequests;
    return platform()?.services?.requests||null;
  }
  function cclient(){return window.DiagnostikaRequestUIContext?.currentClient?.()||null;}

  function getViewedRequest(){
    const a=api(),c=cclient();
    const viaService=a?.viewed?.(c);
    if(viaService)return viaService;
    try{return typeof request==='function'?request():null;}catch(_){return null;}
  }

  function sync(){
    const r=getViewedRequest();
    const display=document.querySelector('#requestTitleDisplay');
    if(display)display.textContent=r?.title?.trim()||'Запрос не заполнен';
    textarea.value=r?.title||'';
    textarea.style.display='none';
    if(label&&label.classList.contains('small-section-title'))label.textContent='ОСНОВНОЙ ЗАПРОС';
  }

  function closeDialog(){
    dialogError.textContent='';
    editingRequestId=null;
    if(dialog.open)dialog.close();
  }

  function openDialog(options={}){
    const a=api(),c=cclient();
    const requestedId=options?.requestId??null;
    const r=requestedId!==null&&requestedId!==undefined&&requestedId!==''
      ? a?.get?.(requestedId,c)||null
      : getViewedRequest();
    if(!r)return false;

    const isNew=options?.newRequest===true;
    editingRequestId=r.id;
    dialogError.textContent='';
    if(dialogTitle)dialogTitle.textContent=isNew?'Новый запрос':'Редактировать запрос';
    dialogInput.value=isNew&&String(r.title||'').trim()==='Новый запрос'?'':(r.title||'');
    dialog.showModal();
    requestAnimationFrame(()=>{
      dialogInput.focus();
      if(dialogInput.value){
        dialogInput.setSelectionRange(0,dialogInput.value.length);
      }else{
        dialogInput.setSelectionRange(0,0);
      }
    });
    return true;
  }

  function openNewEditor(requestId){
    return openDialog({requestId,newRequest:true});
  }

  function saveDialog(){
    const a=api(),c=cclient();
    const r=editingRequestId!==null&&editingRequestId!==undefined
      ? a?.get?.(editingRequestId,c)||null
      : getViewedRequest();
    if(!a||!r)return;
    const value=dialogInput.value.trim();
    if(!value){
      dialogError.textContent='Запрос не может быть пустым.';
      dialogInput.focus();
      return;
    }
    const updated=a.update(r.id,{title:value},{client:c,source:'request-title-modal'});
    if(!updated){
      dialogError.textContent='Не удалось сохранить запрос.';
      return;
    }
    textarea.value=updated.title||value;
    sync();
    closeDialog();
  }

  document.querySelector('#requestTitleEditBtn')?.addEventListener('click',openDialog);
  dialogSave.addEventListener('click',saveDialog);
  dialogCancel.addEventListener('click',closeDialog);
  dialogClose.addEventListener('click',closeDialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
  dialogInput.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){
      e.preventDefault();
      saveDialog();
    }
  });

  async function bindEvents(){
    const p=platform();
    if(!p)return;
    try{await p.ready;}catch(_){}
    const bus=p.events;
    if(!bus?.on)return;
    for(const type of ['requests:ready','request:created','request:selected','request:updated','request:activated','request:completed','request:resumed','request:deleted','client:selected']){
      bus.on(type,()=>setTimeout(sync,0));
    }
  }

  window.DiagnostikaRequestTitleDisplay=Object.freeze({refresh:sync,openEditor:openDialog,openNewEditor});
  bindEvents().catch(()=>{});
  sync();
})();
