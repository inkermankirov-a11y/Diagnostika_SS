'use strict';
/* Individual payment receipts; binary data remains local FileService data until
   remote attachment synchronization is implemented. */
(() => {
  if(window.DiagnostikaPaymentReceipts)return;
  const MAX_BYTES=15*1024*1024;
  const EXT=/\.(?:jpe?g|png|webp|bmp|pdf)$/i;
  const MIME=/^(?:image\/(?:jpeg|png|webp|bmp|x-ms-bmp)|application\/pdf)$/i;
  const writer=()=>window.DiagnostikaPayments?.moduleAware===true?window.DiagnostikaPayments:null;
  const files=()=>window.DiagnostikaFiles?.moduleAware===true?window.DiagnostikaFiles:null;
  const currentClient=()=>window.DiagnostikaPaymentUIContext?.currentClient?.()||null;
  function requestRef(c,r,p){return c?.id&&r?.id&&p?.id?{
    kind:'request',clientId:String(c.id),requestId:String(r.id),paymentId:String(p.id)}:null;}
  function sessionRef(c,s,r){
    if(!c?.id||!s?.id)return null;
    const request=r||(c.requests||[]).find(x=>String(x.id)===String(s.requestId||s.payment?.requestId||''));
    // Only treat a session-linked installment as its receipt in the
    // installments mode; obsolete records from an older payment mode must
    // never silently replace a current per-session receipt.
    const payment=request?.payment?.mode==='parts'
      ?(request.payment.payments||[]).find(p=>String(p?.sessionId||'')===String(s.id))
      :null;
    return payment?requestRef(c,request,payment):
      {kind:'session',clientId:String(c.id),sessionId:String(s.id)};
  }
  function resolve(ref){
    const c=currentClient(),api=writer();
    if(!c||!api||String(c.id)!==String(ref?.clientId))return null;
    if(ref.kind==='session'){
      const s=(c.sessions||[]).find(x=>String(x.id)===String(ref.sessionId));
      if(!s)return null;
      return {record:api.session(s.id,c)||s.payment||{},
        save:changes=>api.updateSession(s.id,changes,{client:c,source:'receipt-session-save'})};
    }
    const req=(c.requests||[]).find(x=>String(x.id)===String(ref.requestId));
    const payment=(api.request(req?.id,c)?.payments||req?.payment?.payments||[])
      .find(x=>String(x.id)===String(ref.paymentId));
    if(!payment)return null;
    return {record:payment,save:changes=>api.updatePayment(req.id,payment.id,changes,{client:c,source:'receipt-payment-save'})};
  }
  function scope(ref,kind='client'){const base=ref.kind==='session'?'receipt:session:'+ref.sessionId:
    'receipt:payment:'+ref.requestId+':'+ref.paymentId;return kind==='issued'?base+':issued':base;}
  const keyFor=kind=>kind==='issued'?'issuedReceipt':'receipt';
  function itemOf(ref,kind='client'){const p=keyFor(kind),row=resolve(ref)?.record||{};return {id:row[p+'FileId']||'',name:row[p+'FileName']||'',type:row[p+'FileType']||'',url:row[p+'Url']||''};}
  function validateUrl(input){
    const value=String(input||'').trim();if(!value)throw Error('Вставь ссылку на чек.');
    let u;try{u=new URL(value);}catch(_){throw Error('Нужна полная ссылка вида https://...');}
    if(!['https:','http:'].includes(u.protocol)||!u.hostname)throw Error('Чек должен иметь ссылку HTTP или HTTPS.');
    return u.href;
  }
  function validateFile(file){
    if(!(file instanceof Blob)||!file.size)throw Error('Выбери непустой файл.');
    if(file.size>MAX_BYTES)throw Error('Размер чека не должен превышать 15 МБ.');
    if(!EXT.test(String(file.name||''))&&!MIME.test(file.type||''))throw Error('Разрешены JPG, PNG, WebP, BMP и PDF.');
    if(file.type&&!MIME.test(file.type))throw Error('Тип файла не поддерживается.');
    return file;
  }
  function notify(){
    window.dispatchEvent(new CustomEvent('diagnostika:payment-receipt-saved'));
    try{window.DiagnostikaPayments?.refresh?.();}catch(_){}
  }
  async function putFile(ref,file,kind='client'){
    validateFile(file);const ctx=resolve(ref),store=files(),k=keyFor(kind);
    if(!ctx)throw Error('Не найден платёж для чека.');
    if(!store)throw Error('Файловое хранилище недоступно.');
    const old=ctx.record[k+'FileId']||'';
    const result=await store.add(file,{
      clientId:ref.clientId,sessionId:scope(ref,kind),
      name:file.name||'Чек.png',type:file.type||'application/octet-stream'
    },{source:'payment-receipt-attach'});
    if(!result?.id)throw Error('Не удалось сохранить файл.');
    const update=resolve(ref)?.save({[k+'FileId']:result.id,[k+'FileName']:result.name,
      [k+'FileType']:result.type,[k+'Url']:'',[k+'UpdatedAt']:new Date().toISOString()});
    if(!update){
      await store.remove(result.id,{source:'payment-receipt-failed-rollback'}).catch(()=>{});
      throw Error('Не удалось привязать файл к платежу. Старый чек не изменён.');
    }
    if(old&&old!==result.id)try{await store.remove(old,{source:'payment-receipt-replace'});}catch(_){}
    notify();return update;
  }
  async function putLink(ref,value,kind='client'){
    const url=validateUrl(value),ctx=resolve(ref),k=keyFor(kind);
    if(!ctx)throw Error('Не найден платёж для чека.');
    const old=ctx.record[k+'FileId']||'';
    const update=ctx.save({[k+'Url']:url,[k+'FileId']:'',[k+'FileName']:'',
      [k+'FileType']:'',[k+'UpdatedAt']:new Date().toISOString()});
    if(!update)throw Error('Сохранение ссылки не удалось.');
    if(old)try{await files()?.remove(old,{source:'payment-receipt-to-link'});}catch(_){}
    notify();return update;
  }
  async function erase(ref,kind='client'){
    const ctx=resolve(ref),k=keyFor(kind);if(!ctx)throw Error('Платёж не найден.');
    const old=ctx.record[k+'FileId']||'';
    const update=ctx.save({[k+'Url']:'',[k+'FileId']:'',[k+'FileName']:'',
      [k+'FileType']:'',[k+'UpdatedAt']:new Date().toISOString()});
    if(!update)throw Error('Не удалось удалить чек.');
    if(old)try{await files()?.remove(old,{source:'payment-receipt-remove'});}catch(_){}
    notify();return update;
  }
  function openUrl(url){
    const a=document.createElement('a');a.href=validateUrl(url);
    a.rel='noopener noreferrer';a.target='_blank';document.body.appendChild(a);a.click();a.remove();
  }
  async function openFile(ref,download=false,kind='client'){
    const record=itemOf(ref,kind);
    if(!record.id)throw Error('Файл чека не прикреплён.');
    const file=await files()?.get(record.id);
    if(!file?.blob||String(file.clientId)!==String(ref.clientId)||String(file.sessionId)!==scope(ref,kind))
      throw Error('Файл чека отсутствует на этом компьютере. Проверь устройство, на котором он был добавлен.');
    if(!download){return showViewer(file.blob,file.name||record.name,file.type||record.type);}
    const url=URL.createObjectURL(file.blob),a=document.createElement('a');
    a.href=url;a.rel='noopener noreferrer';
    if(download)a.download=file.name||'Чек';
    else a.target='_blank';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  function showViewer(blob,name,type){
    const pdf=/pdf/i.test(type||'')||/\.pdf$/i.test(name||'');
    const url=URL.createObjectURL(blob);
    const dialog=document.createElement('dialog');dialog.className='payment-receipt-preview-dialog';
    const wrap=document.createElement('div');wrap.className='payment-receipt-preview-wrap';
    const head=document.createElement('div');head.className='payment-receipt-preview-head';
    const title=document.createElement('strong');title.textContent=name||'Чек';
    const close=document.createElement('button');close.type='button';close.textContent='Закрыть';close.onclick=()=>dialog.close();
    head.append(title,close);
    const stage=document.createElement('div');stage.className='payment-receipt-preview-stage';
    let img=null,zoom=1,angle=0,x=0,y=0,drag=null;
    if(pdf){const frame=document.createElement('iframe');frame.title='Просмотр PDF';frame.src=url;stage.appendChild(frame);}
    else{img=document.createElement('img');img.alt=name||'Чек';img.draggable=false;img.src=url;stage.appendChild(img);}
    const tools=document.createElement('div');tools.className='payment-receipt-preview-tools';
    const minus=document.createElement('button');minus.textContent='−';
    const percent=document.createElement('span');percent.textContent='100%';
    const plus=document.createElement('button');plus.textContent='+';
    const reset=document.createElement('button');reset.textContent='Вписать';
    const rotate=document.createElement('button');rotate.textContent='↻';
    const copy=document.createElement('button');copy.textContent='Копировать изображение';
    const save=document.createElement('button');save.textContent='Скачать';
    function transform(){if(img)img.style.transform='translate('+x+'px,'+y+'px) rotate('+angle+'deg) scale('+zoom+')';percent.textContent=Math.round(zoom*100)+'%';}
    function scale(delta){zoom=Math.max(.25,Math.min(8,zoom+delta));transform();}
    minus.onclick=()=>scale(-.25);plus.onclick=()=>scale(.25);
    reset.onclick=()=>{zoom=1;x=0;y=0;angle=0;transform();};
    rotate.onclick=()=>{angle=(angle+90)%360;transform();};
    stage.addEventListener('wheel',e=>{if(!img)return;e.preventDefault();scale(e.deltaY<0?.2:-.2);},{passive:false});
    stage.addEventListener('pointerdown',e=>{if(!img)return;drag={x:e.clientX-x,y:e.clientY-y};stage.setPointerCapture?.(e.pointerId);});
    stage.addEventListener('pointermove',e=>{if(!drag)return;x=e.clientX-drag.x;y=e.clientY-drag.y;transform();});
    stage.addEventListener('pointerup',()=>drag=null);stage.addEventListener('pointercancel',()=>drag=null);
    copy.onclick=async()=>{
      try{if(pdf)throw Error('PDF нельзя скопировать как изображение.');
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Копирование изображений не поддерживается браузером.');
        const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');
        canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close?.();
        const png=await new Promise((res,rej)=>canvas.toBlob(b=>b?res(b):rej(Error('Не удалось преобразовать изображение.')),'image/png'));
        await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);copy.textContent='Скопировано';
      }catch(e){window.alert(e.message||'Не удалось скопировать чек.');}
    };
    save.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=name||'Чек';document.body.appendChild(a);a.click();a.remove();};
    if(pdf){for(const b of [minus,plus,reset,rotate,copy])b.hidden=true;}
    tools.append(minus,percent,plus,reset,rotate,copy,save);
    wrap.append(head,stage,tools);dialog.appendChild(wrap);document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);dialog.remove();},{once:true});
    dialog.showModal();return dialog;
  }
  function showExternal(url){
    const dialog=document.createElement('dialog');dialog.className='payment-receipt-preview-dialog';
    const wrap=document.createElement('div');wrap.className='payment-receipt-preview-wrap';
    const close=document.createElement('button');close.textContent='Закрыть';close.onclick=()=>dialog.close();
    const note=document.createElement('p');note.textContent='Внешний источник может запрещать показ внутри сайта. Если документ не виден, открой исходную ссылку.';
    const frame=document.createElement('iframe');frame.title='Чек по ссылке';frame.src=validateUrl(url);frame.style.cssText='width:100%;height:60dvh;border:0';
    const link=document.createElement('a');link.href=validateUrl(url);link.target='_blank';link.rel='noopener noreferrer';link.textContent='Открыть у источника';
    const copy=document.createElement('button');copy.textContent='Скопировать ссылку';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(validateUrl(url));copy.textContent='Скопировано';}catch(e){window.alert('Не удалось скопировать ссылку.');}};
    wrap.append(close,note,frame,link,copy);dialog.appendChild(wrap);document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }

  const style=document.createElement('style');
  style.textContent=[
    '.payment-receipt-inline{display:inline-flex;align-items:center;flex-shrink:0;gap:4px;min-width:0}',
    '.payment-receipt-inline button{min-height:28px!important;padding:5px 9px!important;font-size:11px!important;font-weight:800!important;white-space:nowrap!important;border:1px solid #bad0e5!important;border-radius:8px!important;background:#f0f7fe!important;color:#2b5a81!important;cursor:pointer!important}',
    '.payment-receipt-inline button.has-receipt{background:#edf9f1!important;color:#27784b!important;border-color:#a5d9bc!important}',
    '.payment-receipt-row{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    'dialog.payment-receipt-dialog{border:1px solid #c8d7e6;border-radius:15px;padding:0;max-width:95vw;max-height:90dvh;margin:auto;box-shadow:0 24px 64px #1938565c}',
    'dialog.payment-receipt-dialog::backdrop{background:#132d43a8}',
    '.payment-receipt-panel{width:min(90vw,530px);padding:18px;box-sizing:border-box;max-height:88dvh;overflow:auto;background:#f8fbff;display:grid;gap:12px;color:#213c57}',
    '.payment-receipt-panel button{border:1px solid #b9cbdc;border-radius:8px;padding:8px 11px;background:white;color:#36597a;font-weight:750;cursor:pointer}',
    '.payment-receipt-header,.payment-receipt-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
    '.payment-receipt-controls{display:grid;gap:8px;padding:12px;background:white;border:1px solid #d6e3ed;border-radius:9px}',
    '.payment-receipt-controls label{font-size:12px;font-weight:700}',
    '.payment-receipt-controls input[type="url"]{min-width:0;width:100%;height:36px;padding:7px 9px;border:1px solid #b9cddd;border-radius:8px;box-sizing:border-box}',
    '.payment-receipt-drop{padding:17px 12px;border:2px dashed #a7c9e6;border-radius:9px;text-align:center;color:#456f94;font-size:12px;background:#f4f9ff}',
    '.payment-receipt-drop:focus-visible{outline:3px solid #458ad3;outline-offset:2px}',
    '.payment-receipt-error{color:#b33333!important}',
    '.payment-receipt-local-warning{font-size:11px;color:#94672f;line-height:1.5}',
    '.payment-receipt-status{min-height:18px;font-size:12px;color:#477096}',
    '.payment-receipt-description{overflow-wrap:anywhere;font-size:12px;color:#476f86}',
    '.payment-receipt-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.payment-receipt-tabs button[aria-pressed="true"]{background:#dceeff;border-color:#438cce}',
    'dialog.payment-receipt-preview-dialog{padding:0;border:1px solid #c8d7e6;border-radius:13px;max-width:97vw;max-height:96dvh;margin:auto}',
    'dialog.payment-receipt-preview-dialog::backdrop{background:#10263dcc}',
    '.payment-receipt-preview-wrap{width:min(95vw,940px);max-height:94dvh;background:#f8fbff;padding:12px;box-sizing:border-box;display:grid;gap:10px;color:#213c57}',
    '.payment-receipt-preview-head,.payment-receipt-preview-tools{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap}',
    '.payment-receipt-preview-tools button,.payment-receipt-preview-head button{border:1px solid #b9cbdc;border-radius:8px;padding:7px 10px;background:white;color:#36597a;cursor:pointer}',
    '.payment-receipt-preview-stage{height:clamp(230px,65dvh,750px);display:flex;align-items:center;justify-content:center;overflow:hidden;background:#e6edf4;touch-action:none;border-radius:8px}',
    '.payment-receipt-preview-stage img{max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;user-select:none}',
    '.payment-receipt-preview-stage iframe{width:100%;height:100%;border:0}'
  ].join('');
  document.head.appendChild(style);

  function makeButton(ref){
    const button=document.createElement('button');button.type='button';
    const redraw=()=>{
      const a=itemOf(ref,'client'),b=itemOf(ref,'issued'),present=Boolean(a.url||a.id||b.url||b.id);
      button.classList.toggle('has-receipt',present);
      button.textContent=present?'✓ Чеки':'+ Чеки';
      button.title=present?'Просмотреть или заменить чек':'Прикрепить чек';
    };
    redraw();
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open(ref,redraw);});
    return button;
  }
  function mount(host,ref){
    if(!host||!ref)return null;
    host.querySelector('.payment-receipt-inline')?.remove();
    const wrap=document.createElement('span');wrap.className='payment-receipt-inline';
    wrap.appendChild(makeButton(ref));host.appendChild(wrap);return wrap;
  }
  function open(ref,onSaved=()=>{}){
    if(!resolve(ref)){window.alert('Платёж не найден.');return null;}
    const dlg=document.createElement('dialog');dlg.className='payment-receipt-dialog';
    const panel=document.createElement('div');panel.className='payment-receipt-panel';
    const head=document.createElement('div');head.className='payment-receipt-header';
    const heading=document.createElement('strong');heading.textContent='Чеки по платежу';
    const close=document.createElement('button');close.textContent='Закрыть';close.type='button';close.onclick=()=>dlg.close();head.append(heading,close);
    let kind='client';
    const tabs=document.createElement('div');tabs.className='payment-receipt-tabs';
    const clientTab=document.createElement('button');clientTab.type='button';clientTab.textContent='Чек клиента';
    const issuedTab=document.createElement('button');issuedTab.type='button';issuedTab.textContent='Мой чек';
    tabs.append(clientTab,issuedTab);
    const description=document.createElement('div');description.className='payment-receipt-description';
    const actions=document.createElement('div');actions.className='payment-receipt-actions';
    const view=document.createElement('button');view.type='button';view.textContent='Открыть чек';
    const download=document.createElement('button');download.type='button';download.textContent='Скачать';
    const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить чек';
    actions.append(view,download,remove);
    const controls=document.createElement('div');controls.className='payment-receipt-controls';
    const fileLabel=document.createElement('label');fileLabel.textContent='Загрузить чек (JPG, PNG, WebP, BMP или PDF; до 15 МБ)';
    const file=document.createElement('input');file.type='file';
    file.accept='.jpg,.jpeg,.png,.webp,.bmp,.pdf,image/*,application/pdf';
    const paste=document.createElement('div');paste.className='payment-receipt-drop';
    paste.tabIndex=0;paste.textContent='Нажми сюда и вставь скопированную картинку — Ctrl + V';
    const urlLabel=document.createElement('label');urlLabel.textContent='Или ссылка на чек';
    const input=document.createElement('input');input.type='url';input.placeholder='https://...';
    const saveUrl=document.createElement('button');saveUrl.type='button';saveUrl.textContent='Сохранить ссылку';
    controls.append(fileLabel,file,paste,urlLabel,input,saveUrl);
    const status=document.createElement('div');status.className='payment-receipt-status';status.setAttribute('role','status');
    const warning=document.createElement('div');warning.className='payment-receipt-local-warning';
    warning.textContent='Файлы хранятся локально в этом браузере. Для передачи чека другому человеку нужна доступная HTTPS-ссылка; локальный файл не имеет публичной ссылки. Ссылка сохраняется в базе.';
    panel.append(head,tabs,description,actions,controls,status,warning);dlg.appendChild(panel);document.body.appendChild(dlg);
    const refresh=()=>{
      const row=itemOf(ref,kind),hasFile=!!row.id,hasUrl=!!row.url;
      clientTab.setAttribute('aria-pressed',String(kind==='client'));issuedTab.setAttribute('aria-pressed',String(kind==='issued'));
      description.textContent=hasFile?'Файл: '+(row.name||'Чек'):hasUrl?'Ссылка: '+row.url:'Чек пока не прикреплён.';
      actions.hidden=!(hasFile||hasUrl);download.hidden=!hasFile;
      input.value=hasUrl?row.url:'';
      onSaved();
    };
    clientTab.onclick=()=>{kind='client';refresh();};issuedTab.onclick=()=>{kind='issued';refresh();};
    const report=(message,error=false)=>{status.textContent=message;status.classList.toggle('payment-receipt-error',error);};
    let busy=false;
    async function save(action){
      if(busy)return;busy=true;file.disabled=true;saveUrl.disabled=true;remove.disabled=true;
      report('Сохраняю чек…');
      try{await action();refresh();report('Чек сохранён для этого платежа.');}
      catch(e){console.warn('[Payment receipt]',e?.name||'Error');report(e?.message||'Не удалось сохранить чек.',true);}
      finally{busy=false;file.disabled=false;saveUrl.disabled=false;remove.disabled=false;file.value='';}
    }
    file.onchange=()=>{const chosen=file.files?.[0],selected=kind;if(chosen)save(()=>putFile(ref,chosen,selected));};
    dlg.addEventListener('paste',event=>{
      if(event.target===input)return;
      const image=[...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&/^image\//.test(item.type||''));
      if(!image)return;
      event.preventDefault();
      let blob=image.getAsFile();if(!blob)return;
      const type=blob.type||'image/png';
      const extension=type==='image/jpeg'?'jpg':type==='image/webp'?'webp':/bmp/.test(type)?'bmp':'png';
      if(!EXT.test(blob.name||''))blob=new File([blob],'Чек-'+new Date().toISOString().slice(0,10)+'.'+extension,{type});
      const value=blob,selected=kind;save(()=>putFile(ref,value,selected));
    });
    saveUrl.onclick=()=>{const selected=kind,value=input.value;save(()=>putLink(ref,value,selected));};
    remove.onclick=()=>{const selected=kind;save(()=>erase(ref,selected));};
    view.onclick=async()=>{
      try{const row=itemOf(ref,kind);if(row.id)await openFile(ref,false,kind);else if(row.url)showExternal(row.url);}
      catch(e){report(e?.message||'Не удалось открыть чек.',true);}
    };
    download.onclick=async()=>{try{await openFile(ref,true,kind);}catch(e){report(e?.message||'Не удалось скачать чек.',true);}};
    dlg.addEventListener('close',()=>dlg.remove(),{once:true});
    refresh();dlg.showModal();paste.focus();return dlg;
  }
  window.DiagnostikaPaymentReceipts=Object.freeze({
    requestRef,sessionRef,resolve,mount,open,putFile,putLink,erase,itemOf,validateFile,validateUrl
  });
})();