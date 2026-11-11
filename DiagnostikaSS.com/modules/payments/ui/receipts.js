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
  function scope(ref){return ref.kind==='session'?'receipt:session:'+ref.sessionId:
    'receipt:payment:'+ref.requestId+':'+ref.paymentId;}
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
  async function putFile(ref,file){
    validateFile(file);const ctx=resolve(ref),store=files();
    if(!ctx)throw Error('Не найден платёж для чека.');
    if(!store)throw Error('Файловое хранилище недоступно.');
    const old=ctx.record.receiptFileId||'';
    const result=await store.add(file,{
      clientId:ref.clientId,sessionId:scope(ref),
      name:file.name||'Чек.png',type:file.type||'application/octet-stream'
    },{source:'payment-receipt-attach'});
    if(!result?.id)throw Error('Не удалось сохранить файл.');
    const update=resolve(ref)?.save({receiptFileId:result.id,receiptFileName:result.name,
      receiptFileType:result.type,receiptUrl:'',receiptUpdatedAt:new Date().toISOString()});
    if(!update){
      await store.remove(result.id,{source:'payment-receipt-failed-rollback'}).catch(()=>{});
      throw Error('Не удалось привязать файл к платежу. Старый чек не изменён.');
    }
    if(old&&old!==result.id)try{await store.remove(old,{source:'payment-receipt-replace'});}catch(_){}
    notify();return update;
  }
  async function putLink(ref,value){
    const url=validateUrl(value),ctx=resolve(ref);
    if(!ctx)throw Error('Не найден платёж для чека.');
    const old=ctx.record.receiptFileId||'';
    const update=ctx.save({receiptUrl:url,receiptFileId:'',receiptFileName:'',
      receiptFileType:'',receiptUpdatedAt:new Date().toISOString()});
    if(!update)throw Error('Сохранение ссылки не удалось.');
    if(old)try{await files()?.remove(old,{source:'payment-receipt-to-link'});}catch(_){}
    notify();return update;
  }
  async function erase(ref){
    const ctx=resolve(ref);if(!ctx)throw Error('Платёж не найден.');
    const old=ctx.record.receiptFileId||'';
    const update=ctx.save({receiptUrl:'',receiptFileId:'',receiptFileName:'',
      receiptFileType:'',receiptUpdatedAt:new Date().toISOString()});
    if(!update)throw Error('Не удалось удалить чек.');
    if(old)try{await files()?.remove(old,{source:'payment-receipt-remove'});}catch(_){}
    notify();return update;
  }
  function openUrl(url){
    const a=document.createElement('a');a.href=validateUrl(url);
    a.rel='noopener noreferrer';a.target='_blank';document.body.appendChild(a);a.click();a.remove();
  }
  async function openFile(ref,download=false){
    const record=resolve(ref)?.record;
    if(!record?.receiptFileId)throw Error('Файл чека не прикреплён.');
    const file=await files()?.get(record.receiptFileId);
    if(!file?.blob||String(file.clientId)!==String(ref.clientId)||String(file.sessionId)!==scope(ref))
      throw Error('Файл чека отсутствует на этом компьютере. Проверь устройство, на котором он был добавлен.');
    const url=URL.createObjectURL(file.blob),a=document.createElement('a');
    a.href=url;a.rel='noopener noreferrer';
    if(download)a.download=file.name||'Чек';
    else a.target='_blank';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
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
    '.payment-receipt-description{overflow-wrap:anywhere;font-size:12px;color:#476f86}'
  ].join('');
  document.head.appendChild(style);

  function makeButton(ref){
    const button=document.createElement('button');button.type='button';
    const redraw=()=>{
      const row=resolve(ref)?.record||{},present=Boolean(row.receiptUrl||row.receiptFileId);
      button.classList.toggle('has-receipt',present);
      button.textContent=present?'✓ Чек':'+ Чек';
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
    const heading=document.createElement('strong');heading.textContent='Чек по платежу';
    const close=document.createElement('button');close.textContent='Закрыть';close.type='button';close.onclick=()=>dlg.close();head.append(heading,close);
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
    warning.textContent='Файлы чеков пока сохраняются локально в этом браузере. На другом компьютере они не появятся до реализации облачной синхронизации вложений. Ссылка сохраняется в базе.';
    panel.append(head,description,actions,controls,status,warning);dlg.appendChild(panel);document.body.appendChild(dlg);
    const refresh=()=>{
      const row=resolve(ref)?.record||{},hasFile=!!row.receiptFileId,hasUrl=!!row.receiptUrl;
      description.textContent=hasFile?'Файл: '+(row.receiptFileName||'Чек'):hasUrl?'Ссылка: '+row.receiptUrl:'Чек пока не прикреплён.';
      actions.hidden=!(hasFile||hasUrl);download.hidden=!hasFile;
      input.value=hasUrl?row.receiptUrl:'';
      onSaved();
    };
    const report=(message,error=false)=>{status.textContent=message;status.classList.toggle('payment-receipt-error',error);};
    let busy=false;
    async function save(action){
      if(busy)return;busy=true;file.disabled=true;saveUrl.disabled=true;remove.disabled=true;
      report('Сохраняю чек…');
      try{await action();refresh();report('Чек сохранён для этого платежа.');}
      catch(e){console.warn('[Payment receipt]',e?.name||'Error');report(e?.message||'Не удалось сохранить чек.',true);}
      finally{busy=false;file.disabled=false;saveUrl.disabled=false;remove.disabled=false;file.value='';}
    }
    file.onchange=()=>{if(file.files?.[0])save(()=>putFile(ref,file.files[0]));};
    dlg.addEventListener('paste',event=>{
      if(event.target===input)return;
      const image=[...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&/^image\//.test(item.type||''));
      if(!image)return;
      event.preventDefault();
      let blob=image.getAsFile();if(!blob)return;
      const type=blob.type||'image/png';
      const extension=type==='image/jpeg'?'jpg':type==='image/webp'?'webp':/bmp/.test(type)?'bmp':'png';
      if(!EXT.test(blob.name||''))blob=new File([blob],'Чек-'+new Date().toISOString().slice(0,10)+'.'+extension,{type});
      const value=blob;save(()=>putFile(ref,value));
    });
    saveUrl.onclick=()=>save(()=>putLink(ref,input.value));
    remove.onclick=()=>save(()=>erase(ref));
    view.onclick=async()=>{
      try{const row=resolve(ref)?.record||{};if(row.receiptFileId)await openFile(ref);else openUrl(row.receiptUrl);}
      catch(e){report(e?.message||'Не удалось открыть чек.',true);}
    };
    download.onclick=async()=>{try{await openFile(ref,true);}catch(e){report(e?.message||'Не удалось скачать чек.',true);}};
    dlg.addEventListener('close',()=>dlg.remove(),{once:true});
    refresh();dlg.showModal();paste.focus();return dlg;
  }
  window.DiagnostikaPaymentReceipts=Object.freeze({
    requestRef,sessionRef,resolve,mount,open,putFile,putLink,erase,validateFile,validateUrl
  });
})();