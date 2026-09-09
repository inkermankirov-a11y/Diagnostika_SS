'use strict';

const KEY='diagnostika-web-v1';
const $=s=>document.querySelector(s);
let state=load();
let clientId=state.clients[0]?.id||null;
let requestId=null;
let situationId=null;
let selected=null;

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}
function lvl(v){return Math.max(1,Math.min(10,Number(v)||1))}
function today(){return new Date().toISOString().slice(0,10)}
function newClient(){return{id:uid(),name:'Новый клиент',city:'',age:'',photoData:'',vk:'',telegram:'',max:'',sessions:[],requests:[]}}
function newRequest(){return{id:uid(),title:'Новый запрос',situations:[]}}
function newSituation(){return{id:uid(),name:'Новая ситуация',level:5,comment:'',result:'',beliefs:[]}}
function newBelief(){return{id:uid(),text:'',level:5,comment:'',feelings:[]}}
function newFeeling(){return{id:uid(),text:'',level:5,comment:'',deep:[]}}
function newDeep(){return{id:uid(),text:'',level:5,comment:'',instincts:[]}}
function newInstinct(){return{id:uid(),name:'',level:5,comment:''}}
function migrate(c){
  if(!Array.isArray(c.sessions))c.sessions=[];
  if(!Array.isArray(c.requests))c.requests=[];
  if(c.diagnosis&&(c.diagnosis.request||c.diagnosis.situations?.length)){
    c.requests.push({id:uid(),title:c.diagnosis.request||'Запрос',situations:c.diagnosis.situations||[]});delete c.diagnosis;
  }
  c.age=c.age||'';c.photoData=c.photoData||'';return c;
}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x?.clients){x.clients=x.clients.map(migrate);return x}}catch(e){}return{version:3,clients:[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function client(){return state.clients.find(x=>x.id===clientId)||null}
function request(){return client()?.requests.find(x=>x.id===requestId)||null}
function situation(){return request()?.situations.find(x=>x.id===situationId)||null}

function renderClientSelect(){
  const sel=$('#clientSelect');sel.innerHTML='';
  state.clients.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name||'Без имени';sel.appendChild(o)});
  if(clientId)sel.value=clientId;
}
function renderClient(){
  const c=client();renderClientSelect();
  if(!c){$('#clientName').value='';$('#clientCity').value='';$('#clientAge').value='';$('#cardClientName').textContent='';renderRequests();renderSessions();return}
  $('#clientName').value=c.name||'';$('#clientCity').value=c.city||'';$('#clientAge').value=c.age||'';$('#cardClientName').textContent=c.name||'';
  const wrap=$('.photo-wrap'),img=$('#clientPhoto');
  if(c.photoData){img.src=c.photoData;wrap.classList.add('has-photo')}else{img.removeAttribute('src');wrap.classList.remove('has-photo')}
  if(!requestId||!c.requests.some(r=>r.id===requestId))requestId=c.requests[0]?.id||null;
  renderRequests();renderSessions();
}
function renderRequests(){
  const c=client(),sel=$('#requestSelect');sel.innerHTML='';
  if(!c)return;
  c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent='Запрос: '+(r.title||'Без названия');sel.appendChild(o)});
  if(requestId)sel.value=requestId;
  const r=request();$('#requestTitle').value=r?.title||'';
  renderSituationList();
}
function renderSituationList(){
  const root=$('#situationList');root.innerHTML='';const r=request();
  if(!r)return renderTree();
  r.situations.forEach(s=>{const d=document.createElement('div');d.className='situation-item'+(s.id===situationId?' active':'');d.textContent=`${s.name||'Без названия'}   [${lvl(s.level)}/10]`;d.onclick=()=>{situationId=s.id;selected=null;renderSituationList();renderTree()};root.appendChild(d)});
  if(!situationId||!r.situations.some(s=>s.id===situationId))situationId=r.situations[0]?.id||null;
  renderTree();
}
function renderTree(){
  const s=situation(),root=$('#tree');root.innerHTML='';
  $('#situationTitle').textContent=s?.name||'Выберите ситуацию';$('#situationLevel').textContent=s?`Дискомфорт: ${lvl(s.level)}/10`:'Дискомфорт: —';$('#situationResult').value=s?.result||'';
  if(!s){root.innerHTML='<div class="empty-note">Добавьте или выберите ситуацию.</div>';renderEditor();return}
  (s.beliefs||[]).forEach((b,bi)=>{
    addRow(root,'belief',`⌄ Убеждение 1: ${b.text||'Не заполнено'} (${lvl(b.level)}/10)`,{type:'belief',obj:b,parent:s,index:bi});
    (b.feelings||[]).forEach((f,fi)=>{
      addRow(root,'feeling',`⌄ ☑ ${f.text||'Вторичное чувство'} (${lvl(f.level)}/10)`,{type:'feeling',obj:f,parent:b,index:fi});
      (f.deep||[]).forEach((d,di)=>{
        addRow(root,'deep',`⌄ Убеждение 2: ${d.text||'Не заполнено'} (${lvl(d.level)}/10)`,{type:'deep',obj:d,parent:f,index:di});
        (d.instincts||[]).forEach((x,ii)=>addRow(root,'instinct',`Инстинкт ${ii+1}: ${x.name||'Не выбран'} (${lvl(x.level)}/10)`,{type:'instinct',obj:x,parent:d,index:ii}));
      });
    });
  });
  renderEditor();
}
function addRow(root,cls,text,meta){const d=document.createElement('div');d.className=`tree-row ${cls}`+(selected?.obj===meta.obj?' selected':'');d.textContent=text;d.onclick=()=>{selected=meta;renderTree()};root.appendChild(d)}
function renderEditor(){
  const map={belief:'Убеждение 1',feeling:'Вторичное чувство',deep:'Убеждение 2',instinct:'Инстинкт'};
  $('#editorType').textContent=selected?map[selected.type]:'Элемент не выбран';
  $('#editorText').value=selected?(selected.obj.text??selected.obj.name??''):'';$('#editorLevel').value=selected?lvl(selected.obj.level):5;$('#editorComment').value=selected?(selected.obj.comment||''):'';
}
function renderSessions(){
  const c=client(),root=$('#sessions');root.innerHTML='';if(!c)return;
  if(!c.sessions.length){root.innerHTML='<div class="empty-note">Здесь будет история работы и прогресс клиента.</div>';return}
  c.sessions.forEach((s,i)=>{const n=$('#sessionTemplate').content.firstElementChild.cloneNode(true);n.querySelector('.session-date').value=s.date||today();const link=n.querySelector('.session-request-link');link.innerHTML='<option value="">— Без связи —</option>';c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.title;link.appendChild(o)});link.value=s.requestId||'';n.querySelector('.session-notes').value=s.notes||'';n.querySelector('.session-date').oninput=e=>{s.date=e.target.value;save()};link.onchange=e=>{s.requestId=e.target.value;save()};n.querySelector('.session-notes').oninput=e=>{s.notes=e.target.value;save()};n.querySelector('.delete-session').onclick=()=>{c.sessions.splice(i,1);save();renderSessions()};root.appendChild(n)})
}
function switchView(view){const diag=view==='diagnosis';$('#cardView').classList.toggle('hidden',diag);$('#diagnosisView').classList.toggle('hidden',!diag);$('#requestSidebar').classList.toggle('hidden',!diag);document.querySelectorAll('.work-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view))}

$('#clientSelect').onchange=e=>{clientId=e.target.value;requestId=null;situationId=null;selected=null;renderClient()};
$('#addClientBtn').onclick=()=>{const c=newClient();state.clients.push(c);clientId=c.id;save();renderClient()};
['clientName','clientCity','clientAge'].forEach(id=>$('#'+id).oninput=e=>{const c=client();if(!c)return;const k={clientName:'name',clientCity:'city',clientAge:'age'}[id];c[k]=e.target.value;save();renderClientSelect();$('#cardClientName').textContent=c.name||''});
$('#saveClientBtn').onclick=()=>{save();alert('Данные клиента сохранены')};
$('#clientBaseBtn').onclick=()=>alert('База клиентов — следующий экран. Сейчас клиенты выбираются в списке сверху.');
$('.photo-wrap').onclick=()=>$('#photoInput').click();$('#photoInput').onchange=e=>{const f=e.target.files?.[0],c=client();if(!f||!c)return;const r=new FileReader();r.onload=()=>{c.photoData=r.result;save();renderClient()};r.readAsDataURL(f)};
$('#vkBtn').onclick=()=>{const c=client();if(c?.vk)window.open(c.vk,'_blank')};$('#tgBtn').onclick=()=>{const c=client();if(c?.telegram)window.open(c.telegram,'_blank')};$('#maxBtn').onclick=()=>{const c=client();if(c?.max)window.open(c.max,'_blank')};
document.querySelectorAll('.work-tab').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('#addSessionBtn').onclick=()=>{const c=client();if(!c)return;c.sessions.push({id:uid(),date:today(),requestId:'',notes:''});save();renderSessions()};
$('#requestSelect').onchange=e=>{requestId=e.target.value;situationId=null;selected=null;renderRequests()};
$('#addRequestBtn').onclick=()=>{const c=client();if(!c)return;const r=newRequest();c.requests.push(r);requestId=r.id;situationId=null;save();renderRequests()};
$('#deleteRequestBtn').onclick=()=>{const c=client(),r=request();if(!c||!r)return;if(confirm('Удалить запрос?')){c.requests=c.requests.filter(x=>x.id!==r.id);requestId=c.requests[0]?.id||null;situationId=null;selected=null;save();renderRequests()}};
$('#requestTitle').oninput=e=>{const r=request();if(!r)return;r.title=e.target.value;save();renderClientSelect();const opt=[...$('#requestSelect').options].find(o=>o.value===r.id);if(opt)opt.textContent='Запрос: '+r.title};
$('#addSituationBtn').onclick=()=>{const r=request();if(!r)return;const s=newSituation();r.situations.push(s);situationId=s.id;save();renderSituationList()};
$('#deleteSituationBtn').onclick=()=>{const r=request(),s=situation();if(!r||!s)return;if(confirm('Удалить ситуацию?')){r.situations=r.situations.filter(x=>x.id!==s.id);situationId=r.situations[0]?.id||null;selected=null;save();renderSituationList()}};
$('#editSituationBtn').onclick=()=>{const s=situation();if(!s)return;const name=prompt('Название ситуации',s.name||'');if(name!==null)s.name=name;const n=prompt('Дискомфорт 1–10',s.level);if(n!==null)s.level=lvl(n);save();renderSituationList()};
$('#addBeliefBtn').onclick=()=>{const s=situation();if(!s)return;(s.beliefs||(s.beliefs=[])).push(newBelief());save();renderTree()};
$('#addFeelingBtn').onclick=()=>{if(selected?.type!=='belief')return alert('Сначала выберите Убеждение 1');(selected.obj.feelings||(selected.obj.feelings=[])).push(newFeeling());save();renderTree()};
$('#addDeepBtn').onclick=()=>{if(selected?.type!=='feeling')return alert('Сначала выберите вторичное чувство');(selected.obj.deep||(selected.obj.deep=[])).push(newDeep());save();renderTree()};
$('#addInstinctBtn').onclick=()=>{if(selected?.type!=='deep')return alert('Сначала выберите Убеждение 2');(selected.obj.instincts||(selected.obj.instincts=[])).push(newInstinct());save();renderTree()};
$('#deleteElementBtn').onclick=()=>{if(!selected)return;const arr=selected.type==='belief'?selected.parent.beliefs:selected.type==='feeling'?selected.parent.feelings:selected.type==='deep'?selected.parent.deep:selected.parent.instincts;arr.splice(selected.index,1);selected=null;save();renderTree()};
$('#saveElementBtn').onclick=()=>{if(!selected)return;const o=selected.obj;if(selected.type==='instinct')o.name=$('#editorText').value;else o.text=$('#editorText').value;o.level=lvl($('#editorLevel').value);o.comment=$('#editorComment').value;save();renderTree()};
$('#saveResultBtn').onclick=()=>{const s=situation();if(!s)return;s.result=$('#situationResult').value;save()};
$('#saveHistoryBtn').onclick=()=>{save();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='diagnostika-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#exportTxtBtn').onclick=()=>{const c=client(),r=request(),s=situation();if(!c)return;let t=`Клиент: ${c.name||''}\n\n`;if(r)t+=`Запрос: ${r.title||''}\n\n`;if(s){t+=`Ситуация: ${s.name||''} (${lvl(s.level)}/10)\n`;for(const b of s.beliefs||[]){t+=`\nУбеждение 1: ${b.text||''} (${lvl(b.level)}/10)`;for(const f of b.feelings||[]){t+=`\n  Чувство: ${f.text||''} (${lvl(f.level)}/10)`;for(const d of f.deep||[]){t+=`\n    Убеждение 2: ${d.text||''} (${lvl(d.level)}/10)`;for(const x of d.instincts||[])t+=`\n      Инстинкт: ${x.name||''} (${lvl(x.level)}/10)`}}}t+=`\n\nЖелаемый результат:\n${s.result||''}`}const blob=new Blob([t],{type:'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(c.name||'client')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
$('#hintBtn').onclick=()=>alert('Подсказки убеждений подключим следующим шагом.');

if(!state.clients.length){const c=newClient();state.clients.push(c);clientId=c.id;save()}
renderClient();switchView('card');