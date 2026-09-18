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

  const style=document.createElement('style');
  style.textContent='.request-title-display-wrap{display:flex;align-items:center;gap:10px;margin:5px 0 14px}.request-title-display{flex:1;min-width:0;padding:11px 13px;border:1px solid #c8d5e5;border-left:5px solid #4b67dc;border-radius:8px;background:linear-gradient(180deg,#f8fbff,#eef4ff);color:#22324a;font-size:17px;font-weight:800;line-height:1.28;box-shadow:0 1px 2px rgba(15,23,42,.08);word-break:break-word}.request-title-edit{flex:0 0 auto;min-height:40px!important;padding:8px 12px!important;font-size:11px!important}@media(max-width:700px){.request-title-display-wrap{align-items:stretch;flex-direction:column;gap:7px}.request-title-display{font-size:16px}.request-title-edit{align-self:flex-start}}';
  document.head.appendChild(style);

  function platform(){return window.DiagnostikaPlatform||null;}
  function api(){
    if(window.DiagnostikaRequests?.moduleAware===true)return window.DiagnostikaRequests;
    return platform()?.services?.requests||null;
  }
  function cclient(){return window.DiagnostikaClients?.current?.()||(typeof client==='function'?client():null);}

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

  document.querySelector('#requestTitleEditBtn')?.addEventListener('click',()=>{
    const a=api(),c=cclient(),r=getViewedRequest();
    if(!a||!r)return;
    const next=window.prompt('Редактировать основной запрос',r.title||'');
    if(next===null)return;
    const value=next.trim();
    if(!value)return;
    const updated=a.update(r.id,{title:value},{client:c,source:'request-title-display'});
    if(!updated)return;
    textarea.value=updated.title||value;
    sync();
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

  window.DiagnostikaRequestTitleDisplay=Object.freeze({refresh:sync});
  bindEvents().catch(()=>{});
  sync();
})();
