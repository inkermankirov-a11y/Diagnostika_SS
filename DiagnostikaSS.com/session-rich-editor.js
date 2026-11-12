'use strict';
(() => {
if(window.DiagnostikaSessionRichEditor)return;
const allowed=new Set(['B','STRONG','I','EM','U','S','STRIKE','DIV','P','BR','UL','OL','LI','BLOCKQUOTE','A','SPAN','H2','H3','PRE','CODE','FONT']);
const fonts=['Arial','Georgia','Verdana','Tahoma','Trebuchet MS','Times New Roman','Courier New'];
const style=document.createElement('style');
style.textContent=[
'.session-rich-launch{display:flex;justify-content:flex-end;margin:6px 0}',
'.session-rich-launch button{background:#e8f2ff;border:1px solid #acd0ef;border-radius:8px;padding:7px 12px;color:#23588d;font-weight:800;cursor:pointer}',
'dialog.session-rich-dialog{max-width:98vw;max-height:98dvh;border:1px solid #abc6e2;border-radius:15px;padding:0;margin:auto;color:#233b55}',
'dialog.session-rich-dialog::backdrop{background:#132c45bb}',
'.session-rich-window{width:min(1050px,96vw);height:min(850px,94dvh);padding:13px;box-sizing:border-box;background:#f5faff;display:flex;flex-direction:column;gap:9px}',
'.session-rich-head,.session-rich-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
'.session-rich-head strong{font-size:18px}',
'.session-rich-dialog button,.session-rich-dialog select{border:1px solid #bdcfe1;border-radius:8px;padding:8px;background:#fff;color:#234e78;cursor:pointer}',
'.session-rich-dialog button.primary{background:#236dc3;color:white;border-color:#236dc3}',
'.session-rich-tools{display:flex;align-items:center;flex-wrap:wrap;gap:5px;padding:9px;border:1px solid #d2e0ef;background:white;border-radius:10px;max-height:28dvh;overflow:auto}',
'.session-rich-tools[hidden]{display:none}',
'.session-rich-tools label{display:inline-flex;align-items:center;gap:4px;font-size:12px}',
'.session-rich-tools input[type=color]{height:30px;width:34px;border:1px solid #c8d8e8;cursor:pointer}',
'.session-rich-surface{flex:1;min-height:130px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;border:1px solid #aecce7;border-radius:10px;padding:22px;background:#fff;color:#1b304b;font:16px/1.65 Arial,sans-serif;outline:none}',
'.session-rich-surface:focus{box-shadow:0 0 0 2px #b7d9fa}',
'.session-rich-surface blockquote{border-left:3px solid #8bb7df;background:#f1f7ff;margin:8px 0;padding:7px 12px}',
'.session-rich-foot small{color:#66819c}',
'.session-rich-inline{display:block;box-sizing:border-box;width:100%;min-height:116px;max-height:210px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#fffefa;border:1px solid #c7d7e8;border-radius:9px;padding:10px 12px;color:#213954;font:13px/1.5 Arial,sans-serif;cursor:text}',
'.session-rich-inline:focus{outline:2px solid #90c3f7;outline-offset:1px}',
'.session-rich-inline:empty::before{content:attr(data-placeholder);color:#93a1b0;pointer-events:none}',
'.session-rich-inline ul,.session-rich-inline ol{padding-left:25px}',
'.session-rich-inline blockquote{border-left:3px solid #a4bdd8;padding-left:9px;margin:5px 0}',
'.session-rich-original-input{display:none!important}',
'@media(max-width:580px){.session-rich-window{width:98vw;height:96dvh;padding:8px}.session-rich-surface{padding:10px}}'
].join('');
document.head.appendChild(style);
function cleanHtml(html){
const parsed=new DOMParser().parseFromString('<div>'+String(html||'')+'</div>','text/html');
const root=parsed.body.firstElementChild;
function sanitize(n){
if(n.nodeType===3)return document.createTextNode(n.textContent||'');
if(n.nodeType!==1)return document.createDocumentFragment();
if(['SCRIPT','STYLE','IFRAME','SVG','IMG','OBJECT','EMBED','FORM'].includes(n.tagName))return document.createDocumentFragment();
const node=allowed.has(n.tagName)?document.createElement(n.tagName.toLowerCase()):document.createDocumentFragment();
for(const child of [...n.childNodes])node.appendChild(sanitize(child));
if(node.nodeType===1){
if(n.tagName==='A'){try{const u=new URL(n.getAttribute('href'));if(['https:','http:','mailto:'].includes(u.protocol)){node.setAttribute('href',u.href);node.setAttribute('rel','noopener noreferrer');node.setAttribute('target','_blank');}}catch(_){}}
const c=n.style;
for(const name of ['color','backgroundColor']){
const value=c?.[name]||'';
if(/^#[0-9a-f]{3,8}$/i.test(value)||/^rgba?\([\d\s,.%]+\)$/i.test(value))node.style[name]=value;
}
if(n.tagName==='FONT'&&n.getAttribute('color')&&/^#[0-9a-f]{3,8}$/i.test(n.getAttribute('color')))node.style.color=n.getAttribute('color');
const font=c?.fontFamily||n.getAttribute('face')||'';
const selected=fonts.find(f=>font.replaceAll('"','').replaceAll("'",'').split(',')[0].trim().toLowerCase()===f.toLowerCase());
if(selected)node.style.fontFamily=selected;
if(['left','center','right','justify'].includes(c?.textAlign))node.style.textAlign=c.textAlign;
if(/^(?:1[2-9]|2[0-8])px$/.test(c?.fontSize||''))node.style.fontSize=c.fontSize;
if(n.tagName==='FONT'&&/^[1-5]$/.test(n.getAttribute('size')||''))node.setAttribute('size',n.getAttribute('size'));
}
return node;
}
const out=document.createElement('div');for(const child of [...root.childNodes])out.appendChild(sanitize(child));return out.innerHTML;
}
function plainToHtml(value){const d=document.createElement('div');d.textContent=String(value||'');return d.innerHTML.replace(/\r\n?/g,'\n').replace(/\n/g,'<br>');}
function toText(el){const c=el.cloneNode(true);c.querySelectorAll('br').forEach(x=>x.replaceWith('\n'));c.querySelectorAll('p,div,li,h2,h3,blockquote,pre').forEach(n=>n.appendChild(document.createTextNode('\n')));return(c.textContent||'').replace(/\u00a0/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
function open({title,textarea,html='',onApply}){
const dialog=document.createElement('dialog');dialog.className='session-rich-dialog';
const panel=document.createElement('div');panel.className='session-rich-window';
const head=document.createElement('div');head.className='session-rich-head';
const heading=document.createElement('strong');heading.textContent=title||'Редактор';
const format=document.createElement('button');format.type='button';format.textContent='Форматирование';format.setAttribute('aria-expanded','false');
const close=document.createElement('button');close.type='button';close.textContent='Закрыть';
let initialHtml='',closing=false;
const hasChanges=()=>cleanHtml(editor.innerHTML)!==initialHtml;
async function exitWithoutApplying(){
  if(closing)return;
  if(!hasChanges()){
    draftApi?.clearField(editor);
    dialog.close();
    return;
  }
  closing=true;
  try{
    const choice=window.AppDialog?.savePrompt
      ?await window.AppDialog.savePrompt('Сохранить изменения в тексте перед закрытием редактора?')
      :'cancel';
    if(choice==='save')apply.click();
    else if(choice==='discard'){
      draftApi?.clearField(editor);
      dialog.close();
    }
  }finally{closing=false;}
}
close.onclick=exitWithoutApplying;
const controls=document.createElement('div');controls.style.display='flex';controls.style.gap='7px';controls.append(format,close);head.append(heading,controls);
const tools=document.createElement('div');tools.className='session-rich-tools';tools.hidden=true;
const editor=document.createElement('div');editor.className='session-rich-surface';editor.contentEditable='true';editor.spellcheck=true;
editor.setAttribute('role','textbox');editor.setAttribute('aria-multiline','true');editor.setAttribute('aria-label',title||'Текст');
editor.innerHTML=html?cleanHtml(html):plainToHtml(textarea.value);
initialHtml=cleanHtml(editor.innerHTML);
const draftApi=window.DiagnostikaEditDrafts;
if(draftApi&&textarea.dataset.editDraftKey){
  draftApi.attach(editor,textarea.dataset.editDraftKey+':fullscreen');
}
dialog.dataset.noBackdropClose='1';
dialog.addEventListener('cancel',e=>{e.preventDefault();exitWithoutApplying();});
let range=null;
function remember(){const sel=window.getSelection();if(sel?.rangeCount&&editor.contains(sel.anchorNode))range=sel.getRangeAt(0).cloneRange();}
editor.addEventListener('keyup',remember);editor.addEventListener('mouseup',remember);
function command(cmd,value){editor.focus();if(range){const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);}document.execCommand(cmd,false,value);remember();}
function add(label,title,cmd,value){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.onmousedown=e=>e.preventDefault();b.onclick=()=>command(cmd,value);tools.appendChild(b);}
add('B','Жирный','bold');add('I','Курсив','italic');add('U','Подчёркнутый','underline');add('S̶','Зачёркнутый','strikeThrough');
add('• Список','Маркированный список','insertUnorderedList');add('1. Список','Нумерованный список','insertOrderedList');
add('❝','Цитата','formatBlock','blockquote');add('Код','Блок кода','formatBlock','pre');
add('Слева','Выровнять слева','justifyLeft');add('Центр','Выровнять по центру','justifyCenter');add('Справа','Выровнять справа','justifyRight');
const font=document.createElement('select');font.setAttribute('aria-label','Шрифт');
for(const f of fonts){const o=document.createElement('option');o.value=f;o.textContent=f;font.appendChild(o);}font.onchange=()=>command('fontName',font.value);tools.appendChild(font);
const size=document.createElement('select');size.setAttribute('aria-label','Размер шрифта');
for(const [v,label] of [['2','Мелкий'],['3','Обычный'],['4','Крупный'],['5','Очень крупный']]){const o=document.createElement('option');o.value=v;o.textContent=label;size.appendChild(o);}size.value='3';size.onchange=()=>command('fontSize',size.value);tools.appendChild(size);
for(const [label,cmd,def] of [['Цвет текста','foreColor','#1b304b'],['Фон текста','hiliteColor','#fff2a8']]){
const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type='color';input.value=def;input.oninput=()=>command(cmd,input.value);l.appendChild(input);tools.appendChild(l);}
const link=document.createElement('button');link.type='button';link.textContent='Ссылка';link.onmousedown=e=>e.preventDefault();link.onclick=()=>{
const value=prompt('Введи ссылку https://…');if(value===null)return;
try{const u=new URL(value);if(!['https:','http:','mailto:'].includes(u.protocol))throw Error('invalid');command('createLink',u.href);}catch(_){alert('Допустима ссылка https://, http:// или mailto:.');}
};tools.appendChild(link);add('Очистить','Убрать форматирование','removeFormat');
format.onclick=()=>{tools.hidden=!tools.hidden;format.setAttribute('aria-expanded',String(!tools.hidden));};
const foot=document.createElement('div');foot.className='session-rich-foot';
const hint=document.createElement('small');hint.textContent='После применения сохрани карточку сессии.';
const actions=document.createElement('div');actions.style.display='flex';actions.style.gap='8px';
const cancel=document.createElement('button');cancel.textContent='Отмена';cancel.onclick=exitWithoutApplying;
const apply=document.createElement('button');apply.textContent='Применить';apply.className='primary';
apply.onclick=()=>{const html=cleanHtml(editor.innerHTML),preview=document.createElement('div');preview.innerHTML=html;
const text=toText(preview);textarea.value=text;textarea.dispatchEvent(new Event('input',{bubbles:true}));onApply?.({html,text});draftApi?.clearField(editor);dialog.close();};
actions.append(cancel,apply);foot.append(hint,actions);
panel.append(head,tools,editor,foot);dialog.appendChild(panel);document.body.appendChild(dialog);
dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();editor.focus();return dialog;
}
window.DiagnostikaSessionRichEditor=Object.freeze({open,cleanHtml,plainToHtml,toText});
})();