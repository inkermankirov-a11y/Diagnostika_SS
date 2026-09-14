'use strict';

(() => {
  if (window.__diagnostikaClientAiChatViewReady) return;
  window.__diagnostikaClientAiChatViewReady = true;

  const EXPANDED_KEY='diagnostika-client-ai-chat-expanded-v1';
  let attempts=0;
  let widget=null;
  let backdrop=null;
  let messagesObserver=null;
  let lastSeenCount=0;

  const style=document.createElement('style');
  style.textContent=`
    .hd-ai-title-actions{margin-left:auto;display:flex;align-items:center;gap:5px}
    .hd-ai-expand-btn{width:28px;height:28px;border:1px solid #cbd9ea;border-radius:8px;background:#fff;color:#486581;display:grid;place-items:center;cursor:pointer;font-size:15px;line-height:1;padding:0}
    .hd-ai-expand-btn:hover{background:#f1f6fb}
    .hd-ai-backdrop{position:fixed;inset:0;z-index:13990;background:rgba(15,23,42,.28);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
    .hd-ai-backdrop[hidden]{display:none!important}
    #hdClientAiWidget.hd-ai-expanded{position:fixed!important;z-index:14000!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(900px,calc(100vw - 48px))!important;height:min(78vh,760px)!important;max-height:calc(100vh - 48px)!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important;padding:18px!important;background:#fff!important;border-radius:16px!important;box-shadow:0 28px 80px rgba(15,23,42,.38)!important}
    #hdClientAiWidget.hd-ai-expanded .hd-widget-title{font-size:17px!important;margin-bottom:8px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-client{font-size:12px!important;margin-bottom:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-quick{margin-bottom:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-quick button{font-size:11px!important;padding:6px 10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-messages{height:auto!important;min-height:0!important;flex:1 1 auto!important;font-size:14px!important;padding:12px!important;gap:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg{font-size:14px!important;line-height:1.5!important;padding:10px 12px!important;max-width:84%!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-msg-time{font-size:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-compose{grid-template-columns:1fr 44px!important;gap:8px!important;margin-top:10px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-input{height:44px!important;font-size:14px!important}
    #hdClientAiWidget.hd-ai-expanded .hd-ai-send{width:44px!important;height:44px!important}
    @media(max-width:760px){#hdClientAiWidget.hd-ai-expanded{width:calc(100vw - 20px)!important;height:calc(100vh - 20px)!important;max-height:none!important;padding:12px!important}#hdClientAiWidget.hd-ai-expanded .hd-ai-msg{max-width:92%!important}}
  `;
  document.head.appendChild(style);

  function setExpanded(expanded){
    if(!widget)return;
    widget.classList.toggle('hd-ai-expanded',expanded);
    if(backdrop)backdrop.hidden=!expanded;
    const btn=widget.querySelector('.hd-ai-expand-btn');
    if(btn){
      btn.textContent=expanded?'↙':'⛶';
      btn.title=expanded?'Свернуть чат':'Развернуть чат';
      btn.setAttribute('aria-label',btn.title);
    }
    try{localStorage.setItem(EXPANDED_KEY,expanded?'1':'0');}catch(_){ }
    if(expanded){
      const input=widget.querySelector('.hd-ai-input');
      setTimeout(()=>input?.focus(),0);
    }
  }

  function scrollAssistantToStart(){
    if(!widget)return;
    const messages=widget.querySelector('.hd-ai-messages');
    if(!messages)return;
    const items=[...messages.querySelectorAll('.hd-ai-msg')];
    const last=items[items.length-1];
    if(!last||!last.classList.contains('assistant'))return;
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const box=messages.getBoundingClientRect();
        const row=last.getBoundingClientRect();
        const target=row.top-box.top+messages.scrollTop-8;
        messages.scrollTop=Math.max(0,target);
      });
    });
  }

  function watchMessages(){
    const messages=widget?.querySelector('.hd-ai-messages');
    if(!messages)return;
    messagesObserver?.disconnect();
    lastSeenCount=messages.querySelectorAll('.hd-ai-msg').length;
    messagesObserver=new MutationObserver(()=>{
      const count=messages.querySelectorAll('.hd-ai-msg').length;
      if(count>lastSeenCount){
        const last=messages.querySelector('.hd-ai-msg:last-child');
        if(last?.classList.contains('assistant'))scrollAssistantToStart();
      }
      lastSeenCount=count;
    });
    messagesObserver.observe(messages,{childList:true,subtree:false});
  }

  function install(){
    widget=document.getElementById('hdClientAiWidget');
    if(!widget)return false;

    if(!backdrop){
      backdrop=document.createElement('div');
      backdrop.className='hd-ai-backdrop';
      backdrop.hidden=true;
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click',()=>setExpanded(false));
    }

    const title=widget.querySelector('.hd-widget-title');
    if(title&&!title.querySelector('.hd-ai-expand-btn')){
      const actions=document.createElement('span');
      actions.className='hd-ai-title-actions';
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='hd-ai-expand-btn';
      btn.title='Развернуть чат';
      btn.setAttribute('aria-label','Развернуть чат');
      btn.textContent='⛶';
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        setExpanded(!widget.classList.contains('hd-ai-expanded'));
      });
      actions.appendChild(btn);
      title.appendChild(actions);
    }

    let shouldExpand=false;
    try{shouldExpand=localStorage.getItem(EXPANDED_KEY)==='1';}catch(_){ }
    setExpanded(shouldExpand);
    watchMessages();
    return true;
  }

  function init(){
    if(install())return;
    attempts++;
    if(attempts<60)setTimeout(init,250);
  }

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&widget?.classList.contains('hd-ai-expanded'))setExpanded(false);
  });
  window.addEventListener('diagnostika-client-ai-chat-changed',()=>setTimeout(()=>{install();scrollAssistantToStart();},0));

  init();
})();
