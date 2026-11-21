'use strict';
(()=>{
  if(window.DiagnostikaMobileUI)return;
  const root=document.documentElement;
  const media=matchMedia('(max-width: 767px), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)');
  const workspace=document.getElementById('diagnosisWorkspace');
  if(!workspace)return;
  const labels={
    home:'Главная',clients:'Клиенты',calendar:'Календарь',notes:'Заметки',weather:'Погода',currency:'Курс',
    situations:'Ситуации',tree:'Диагностика',editor:'Редактор',back:'К клиенту'
  };
  const icons={
    home:'<path d="M3 10l9-7 9 7v10H7V10"/><path d="M10 20v-6h4v6"/>',
    clients:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0112 0v2M16 5a3 3 0 010 6m1 3a5 5 0 014 5v1"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 10h18m-13 5h2m4 0h2"/>',
    notes:'<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
    weather:'<path d="M7 18a4 4 0 010-8 6 6 0 0111 2 3 3 0 010 6zM7 2v3m-5 1 2 2m8-6-1 3"/>',
    currency:'<path d="M4 7h15l-4-4m4 14H4l4 4M19 7l-4 4M4 17l4-4"/>'
  };
  const nav=document.createElement('nav');nav.id='mobileBottomNav';nav.setAttribute('aria-label','Навигация');
  const tabs=document.createElement('nav');tabs.id='mobileDiagnosisTabs';tabs.setAttribute('aria-label','Разделы диагностики');
  const makeButton=(key,icon)=>{const b=document.createElement('button');b.type='button';b.dataset.mobileAction=key;if(icon){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML=icon;b.append(svg);}const text=document.createElement('span');text.textContent=labels[key];b.append(text);return b;};
  for(const key of ['home','clients','calendar','notes','weather','currency'])nav.append(makeButton(key,icons[key]));
  for(const key of ['back','situations','tree','editor'])tabs.append(makeButton(key));
  workspace.prepend(tabs);document.body.append(nav);
  let page='home',section='situations',lastMode='',lastClientView='';
  const guard=async fn=>{const g=window.DiagnostikaEditorGuard;return g?.beforeLeave?g.beforeLeave(fn):fn();};
  const shell=()=>window.DiagnostikaPlatform?.shell;
  const dash=()=>window.DiagnostikaHomeDashboard;
  const diag=()=>shell()?.currentMode?.()==='diagnosis'||(!workspace.hidden&&workspace.isConnected);
  function mark(){
    root.dataset.mobilePage=page;root.dataset.mobileDiagnosis=section;
    for(const el of nav.children){const active=el.dataset.mobileAction===(diag()?'clients':page==='client'?'clients':page);el.setAttribute('aria-current',active?'page':'false');}
    for(const el of tabs.children)el.setAttribute('aria-pressed',String(el.dataset.mobileAction===section));
  }
  function go(next){page=next;mark();if(media.matches)window.scrollTo(0,0);}
  function tab(next){section=next;mark();}
  function sync(){
    const mode=diag()?'diagnosis':'dashboard';
    const view=dash()?.currentView?.()||'home';
    if(mode!==lastMode&&mode==='diagnosis')section='situations';
    if(mode==='dashboard'&&view!==lastClientView)page=view==='client'?'client':'home';
    lastMode=mode;lastClientView=view;mark();
  }
  function openDashboard(next){
    const action=()=>{if(diag())shell()?.clearSelection?.();dash()?.showHome?.();go(next);};
    return diag()?guard(action):action();
  }
  nav.addEventListener('click',e=>{
    const action=e.target.closest('button')?.dataset.mobileAction;
    if(!action)return;
    if(action==='home'||action==='clients'){openDashboard(action);return;}
    const id={calendar:'headerCalendarBtn',notes:'quickNotesBtn',weather:'headerWeatherBtn',currency:'headerCurrencyBtn'}[action];
    document.getElementById(id)?.click();
  });
  tabs.addEventListener('click',e=>{
    const action=e.target.closest('button')?.dataset.mobileAction;
    if(action==='back'){workspace.querySelector('.diagnosis-compact-back')?.click();return;}
    if(['situations','tree','editor'].includes(action))tab(action);
  });
  document.addEventListener('diagnostika:mode-rendered',sync);
  document.addEventListener('diagnostika:dashboard-clients-rendered',sync);
  document.addEventListener('diagnostika:dashboard-home-opened',()=>{sync();go('home');});
  document.addEventListener('diagnostika:mobile-client-opened',()=>{sync();go('client');});
  document.addEventListener('diagnostika:diagnosis-row-selected',()=>{if(media.matches&&diag())tab('editor');});
  // Bring the editor into view for newly added items before the existing focus handler runs.
  document.addEventListener('diagnostika:diagnosis-editor-rendered',()=>{if(!media.matches||!diag())return;const selection=shell()?.currentSelection?.();if(selection&&!(selection.obj?.text||selection.obj?.name)&&section==='tree')tab('editor');});
  document.addEventListener('focusin',e=>{if(media.matches&&diag()&&e.target.matches('#editorText,#editorComment,#editorLevel'))tab('editor');});
  media.addEventListener('change',sync);
  window.addEventListener('diagnostika:ready',sync);
  window.addEventListener('diagnostika:dashboard-loaded',sync);
  window.DiagnostikaMobileUI=Object.freeze({isMobile:()=>media.matches,refresh:sync});
  sync();
})();