'use strict';

(() => {
  const style=document.createElement('style');
  style.textContent=`
    .app-message-dialog{border:0;padding:0;background:transparent;max-width:calc(100vw - 24px)}
    .app-message-dialog::backdrop{background:rgba(15,23,42,.42);backdrop-filter:blur(5px)}
    .app-message-card{width:min(430px,calc(100vw - 24px));background:#f8fafc;border:1px solid #dbe3ec;border-radius:16px;box-shadow:0 22px 60px rgba(15,23,42,.30);padding:20px;box-sizing:border-box}
    .app-message-title{font-size:18px;font-weight:800;color:#243447;margin:0 0 10px}
    .app-message-text{font-size:14px;line-height:1.5;color:#526174;white-space:pre-line;overflow-wrap:anywhere}
    .app-message-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
    .app-message-actions button{min-width:105px;min-height:40px;border:0;border-radius:9px;padding:9px 14px;font-weight:700;cursor:pointer;box-shadow:0 3px 8px rgba(15,23,42,.16);transition:transform .12s ease,filter .12s ease}
    .app-message-actions button:hover{transform:translateY(-1px);filter:brightness(1.04)}
    .app-message-actions button:active{transform:translateY(1px)}
    .app-message-ok,.app-message-yes{background:linear-gradient(#3fa56f,#218955);color:#fff}
    .app-message-no{background:linear-gradient(#eef2f7,#dbe3ec);color:#334155}
    @media(max-width:520px){.app-message-card{padding:17px}.app-message-actions{display:grid;grid-template-columns:1fr 1fr}.app-message-actions button{width:100%;min-width:0}.app-message-actions.single{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function show({title='Сообщение',text='',confirm=false,okText='ОК',cancelText='Отмена'}={}){
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');
      dialog.className='app-message-dialog';
      dialog.innerHTML=`<div class="app-message-card"><div class="app-message-title"></div><div class="app-message-text"></div><div class="app-message-actions ${confirm?'':'single'}"></div></div>`;
      dialog.querySelector('.app-message-title').textContent=title;
      dialog.querySelector('.app-message-text').textContent=String(text||'');
      const actions=dialog.querySelector('.app-message-actions');

      const finish=value=>{try{dialog.close();}catch(e){} dialog.remove();resolve(value);};
      if(confirm){
        const no=document.createElement('button');
        no.type='button';no.className='app-message-no';no.textContent=cancelText;no.onclick=()=>finish(false);
        const yes=document.createElement('button');
        yes.type='button';yes.className='app-message-yes';yes.textContent=okText;yes.onclick=()=>finish(true);
        actions.append(no,yes);
        dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);},{once:true});
      }else{
        const ok=document.createElement('button');
        ok.type='button';ok.className='app-message-ok';ok.textContent=okText;ok.onclick=()=>finish(true);
        actions.appendChild(ok);
        dialog.addEventListener('cancel',e=>{e.preventDefault();finish(true);},{once:true});
      }
      document.body.appendChild(dialog);
      dialog.showModal();
      requestAnimationFrame(()=>actions.querySelector('button:last-child')?.focus());
    });
  }

  window.AppDialog={
    alert(text,title='Сообщение'){return show({title,text,confirm:false});},
    confirm(text,title='Подтверждение',okText='Продолжить',cancelText='Отмена'){return show({title,text,confirm:true,okText,cancelText});}
  };
})();
