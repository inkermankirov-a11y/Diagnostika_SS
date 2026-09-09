'use strict';
const KEY='diagnostika-web-v1';
const $=s=>document.querySelector(s);
const INSTINCTS=['Бей / атаковать','Беги / убежать','Замри / спрятаться'];
let state=loadState();
let clientId=state.clients[0]?.id||null;
let requestId=null;
let situationId=null;
let selected=null;
let mode='card';
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}
function lvl(v){return Math.max(1,Math.min(10,Number(v)||1))}
function today(){return new Date().toISOString().slice(0,10)}
function newClient(){return{id:uid(),name:'Новый клиент',city:'',age:'',birth:'',photoData:'',vk:'',telegram:'',max:'',sessions:[],requests:[]}}
function newRequest(){return{id:uid(),title:'Новый запрос',situations:[]}}
function newSituation(){return{id:uid(),name:'Новая ситуация',level:5,comment:'',result:'',beliefs:[]}}
function newBelief(){return{id:uid(),text:'',level:5,comment:'',feelings:[]}}
function newFeeling(){return{id:uid(),text:'',level:5,comment:'',deep:[]}}
function newDeep(){return{id:uid(),text:'',level:5,comment:'',instincts:[newInstinct()]}}
function newInstinct(){return{id:uid(),name:'',level:5,comment:''}}
function migrate(c){
 if(!Array.isArray(c.sessions))c.sessions=[];
 if(!Array.isArray(c.requests))c.requests=[];
 if(c.diagnosis&&(c.diagnosis.request||c.diagnosis.situations?.length)){c.requests.push({id:uid(),title:c.diagnosis.request||'Запрос',situations:c.diagnosis.situations||[]});delete c.diagnosis}
 c.photoData=c.photoData||''; c.age=c.age||'';
 return c;
}
function loadState(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x?.clients){x.clients=x.clients.map(migrate);return x}}catch(e){}return{version:4,clients:[]}}
function save(){state.version=4;localStorage.setItem(KEY,JSON.stringify(state))}
function client(){return state.clients.find(x=>x.id===clientId)||null}
function request(){return client()?.requests.find(x=>x.id===requestId)||null}
function situation(){return request()?.situations.find(x=>x.id===situationId)||null}
function calcAge(c){if(c.age)return c.age;if(!c.birth)return'';const d=new Date(c.birth);if(Number.isNaN(d.getTime()))return'';const n=new Date();let a=n.getFullYear()-d.getFullYear();if(n<new Date(n.getFullYear(),d.getMonth(),d.getDate()))a--;return a}
function normalizeUrl(v){v=(v||'').trim();if(!v)return'';return /^[a-z]+:\/\//i.test(v)?v:'https://'+v}
function renderClientSelect(){const s=$('#clientSelect');s.innerHTML='';state.clients.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name||'Без имени';s.appendChild(o)});if(clientId)s.value=clientId}
function renderClient(){renderClientSelect();const c=client();if(!c)return;$('#clientName').value=c.name||'';$('#clientCity').value=c.city||'';$('#clientAge').value=calcAge(c);$('#clientHomeName').textContent=c.name||'';const f=$('#photoFrame'),img=$('#clientPhoto');if(c.photoData){img.src=c.photoData;f.classList.add('has-photo')}else{img.removeAttribute('src');f.classList.remove('has-photo')}if(!requestId||!c.requests.some(r=>r.id===requestId))requestId=c.requests[0]?.id||null;renderRequests();renderSessions();renderMode()}
function renderRequests(){const c=client(),sel=$('#requestSelect');sel.innerHTML='';if(!c)return;c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent='Запрос '+(c.requests.indexOf(r)+1)+': '+(r.title||'Без названия');sel.appendChild(o)});if(requestId)sel.value=requestId;const r=request();$('#requestTitle').value=r?.title||'';if(!situationId||!r?.situations?.some(s=>s.id===situationId))situationId=r?.situations?.[0]?.id||null;renderSituationList()}
function situationColor(i){return ['#5B4BA3','#2F6F9F','#287A55','#A85A2A','#A34A68','#347477','#9A6A16','#4E5C8A'][i%8]}
function situationBg(i){return ['#E8E1FF','#DDF0FF','#DDF6EA','#FFE8D8','#FCE0EA','#E2F1F1','#FFF0C9','#E7EAF7'][i%8]}
function renderSituationList(){const root=$('#situationList');root.innerHTML='';const r=request();if(!r){renderTree();return}r.situations.forEach((s,i)=>{const d=document.createElement('div');d.className='situation-item'+(s.id===situationId?' active':'');if(s.id!==situationId){d.style.borderLeft='5px solid '+situationColor(i)}d.textContent=`${s.name||'Без названия'}   [${lvl(s.level)}/10]`;d.onclick=()=>{situationId=s.id;selected=null;renderSituationList()};root.appendChild(d)});renderTree()}
function addTreeRow(root,cls,text,meta){const d=document.createElement('div');d.className='tree-row '+cls+(selected?.obj===meta.obj?' active-selection':'');d.textContent=text;d.onclick=()=>{selected=meta;renderTree()};root.appendChild(d)}
function renderTree(){const s=situation(),root=$('#tree');root.innerHTML='';const r=request();if(s&&r){const i=r.situations.indexOf(s);$('#situationTitle').textContent=s.name||'Без названия';$('#situationTitle').style.background=situationBg(i);$('#situationTitle').style.color=situationColor(i);$('#situationInfo').textContent=`Дискомфорт: ${lvl(s.level)}/10`;$('#situationResult').value=s.result||'';$('#resultBlock').classList.remove('hidden')}else{$('#situationTitle').textContent='Выберите ситуацию';$('#situationTitle').style.background='transparent';$('#situationTitle').style.color='#202124';$('#situationInfo').textContent='';$('#resultBlock').classList.add('hidden');root.innerHTML='<div style="padding:16px;color:#888">Добавьте или выберите ситуацию.</div>';renderEditor();return}
(s.beliefs||[]).forEach((b,bi)=>{addTreeRow(root,'primary',`⌄ Убеждение 1: ${b.text||'Не заполнено'} (${lvl(b.level)}/10)`,{type:'belief',obj:b,parent:s,index:bi});(b.feelings||[]).forEach((f,fi)=>{addTreeRow(root,'feeling',`⌄ ☑ ${f.text||'Вторичное чувство'} (${lvl(f.level)}/10)`,{type:'feeling',obj:f,parent:b,index:fi});(f.deep||[]).forEach((d,di)=>{addTreeRow(root,'deep',`⌄ Убеждение 2: ${d.text||'Не заполнено'} (${lvl(d.level)}/10)`,{type:'deep',obj:d,parent:f,index:di});(d.instincts||[]).forEach((x,ii)=>addTreeRow(root,'instinct',`Инстинкт ${ii+1}: ${x.name||'Не выбран'} (${lvl(x.level)}/10)`,{type:'instinct',obj:x,parent:d,index:ii}))})})});renderEditor()}
function renderEditor(){const map={belief:'Убеждение 1',feeling:'Вторичное чувство',deep:'Убеждение 2',instinct:'Инстинкт'};$('#editorType').textContent=selected?map[selected.type]:'Элемент не выбран';$('#editorText').value=selected?(selected.obj.text??selected.obj.name??''):'';$('#editorLevel').value=selected?lvl(selected.obj.level):5;$('#editorComment').value=selected?(selected.obj.comment||''):'';$('#instinctFrame').classList.toggle('hidden',selected?.type!=='deep');if(selected?.type==='deep'){const arr=selected.obj.instincts||(selected.obj.instincts=[]);if(!arr.length)arr.push(newInstinct());const x=arr[0];$('#instinctSelectedLabel').textContent='Инстинкт 1';$('#instinctCombo').innerHTML='';INSTINCTS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;$('#instinctCombo').appendChild(o)});$('#instinctCombo').value=x.name||'';$('#instinctLevel').value=lvl(x.level);$('#instinctComment').value=x.comment||''}}
function renderSessions(){const c=client(),root=$('#sessionsList');root.innerHTML='';if(!c)return;if(!c.sessions.length){root.innerHTML='<div style="color:#9CA3AF;padding:8px 0">Сессий пока нет.</div>';return}c.sessions.forEach((s,i)=>{const row=document.createElement('div');row.className='session-row';const date=document.createElement('input');date.type='date';date.value=s.date||today();const link=document.createElement('select');link.innerHTML='<option value="">— Без связи —</option>';c.requests.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.title||'Без названия';link.appendChild(o)});link.value=s.requestId||'';const del=document.createElement('button');del.className='tk-btn';del.textContent='Удалить';const notes=document.createElement('textarea');notes.placeholder='Что делали, результат, заметки';notes.value=s.notes||'';date.oninput=e=>{s.date=e.target.value;save()};link.onchange=e=>{s.requestId=e.target.value;save()};notes.oninput=e=>{s.notes=e.target.value;save()};del.onclick=()=>{if(confirm('Удалить эту сессию?')){c.sessions.splice(i,1);save();renderSessions()}};row.append(date,link,del,notes);root.appendChild(row)})}
function renderMode(){const diag=mode==='diagnosis';$('#clientHome').classList.toggle('hidden',diag);$('#centerPanel').classList.toggle('hidden',!diag);$('#rightPanel').classList.toggle('hidden',!diag);$('#diagnosticsLeft').classList.toggle('hidden',!diag);$('#backToProgressBtn').classList.toggle('hidden',!diag);$('#clientCardModeBtn').classList.toggle('active',!diag);$('#diagnosisModeBtn').classList.toggle('active',diag);if(diag)renderTree()}
function openDatabase(){const dlg=$('#clientDialog'),root=$('#clientDatabaseList');root.innerHTML='';state.clients.forEach(c=>{const r=document.createElement('div');r.className='db-row';const n=document.createElement('div');n.textContent=c.name||'Без имени';const city=document.createElement('div');city.textContent=c.city||'';const b=document.createElement('button');b.type='button';b.className='tk-btn';b.textContent='Открыть';b.onclick=()=>{clientId=c.id;requestId=null;situationId=null;selected=null;dlg.close();renderClient()};r.append(n,city,b);root.appendChild(r)});dlg.showModal()}
function download(name,text,type){const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

$('#clientSelect').onchange=e=>{clientId=e.target.value;requestId=null;situationId=null;selected=null;renderClient()};
$('#addClientBtn').onclick=$('#dialogAddClientBtn').onclick=()=>{const c=newClient();state.clients.push(c);clientId=c.id;requestId=null;save();renderClient();if($('#clientDialog').open)$('#clientDialog').close()};
$('#clientName').oninput=e=>{const c=client();if(!c)return;c.name=e.target.value;save();renderClientSelect();$('#clientHomeName').textContent=c.name||''};
$('#clientCity').oninput=e=>{const c=client();if(!c)return;c.city=e.target.value;save()};
$('#saveClientBtn').onclick=()=>{save();alert('Данные клиента сохранены')};
$('#clientBaseBtn').onclick=openDatabase;
$('#photoFrame').onclick=()=>$('#photoInput').click();
$('#photoInput').onchange=e=>{const f=e.target.files?.[0],c=client();if(!f||!c)return;const r=new FileReader();r.onload=()=>{c.photoData=r.result;save();renderClient()};r.readAsDataURL(f)};
$('#vkBtn').onclick=()=>{const u=normalizeUrl(client()?.vk);if(u)window.open(u,'_blank')};$('#tgBtn').onclick=()=>{const u=normalizeUrl(client()?.telegram);if(u)window.open(u,'_blank')};$('#maxBtn').onclick=()=>{const u=normalizeUrl(client()?.max);if(u)window.open(u,'_blank')};
$('#clientCardModeBtn').onclick=$('#backToProgressBtn').onclick=()=>{mode='card';renderMode()};$('#diagnosisModeBtn').onclick=()=>{mode='diagnosis';renderMode()};
$('#addSessionBtn').onclick=()=>{const c=client();if(!c)return;c.sessions.push({id:uid(),date:today(),requestId:'',notes:''});save();renderSessions()};
$('#requestSelect').onchange=e=>{requestId=e.target.value;situationId=null;selected=null;renderRequests()};
$('#addRequestBtn').onclick=()=>{const c=client();if(!c)return;const r=newRequest();c.requests.push(r);requestId=r.id;situationId=null;save();renderRequests()};
$('#deleteRequestBtn').onclick=()=>{const c=client(),r=request();if(!c||!r)return;if(confirm('Удалить запрос?')){c.requests=c.requests.filter(x=>x.id!==r.id);requestId=c.requests[0]?.id||null;situationId=null;selected=null;save();renderRequests()}};
$('#requestTitle').oninput=e=>{const r=request();if(!r)return;r.title=e.target.value;save();renderRequests()};
$('#addSituationBtn').onclick=()=>{const r=request();if(!r)return;const s=newSituation();r.situations.push(s);situationId=s.id;selected=null;save();renderSituationList()};
$('#editSituationBtn').onclick=()=>{const s=situation();if(!s)return;const n=prompt('Название ситуации',s.name||'');if(n!==null)s.name=n;const l=prompt('Дискомфорт 1–10',s.level);if(l!==null)s.level=lvl(l);save();renderSituationList()};
$('#deleteSituationBtn').onclick=()=>{const r=request(),s=situation();if(!r||!s)return;if(confirm('Удалить ситуацию?')){r.situations=r.situations.filter(x=>x.id!==s.id);situationId=r.situations[0]?.id||null;selected=null;save();renderSituationList()}};
$('#addBeliefBtn').onclick=()=>{const s=situation();if(!s)return;(s.beliefs||(s.beliefs=[])).push(newBelief());save();renderTree()};
$('#addFeelingBtn').onclick=()=>{if(selected?.type!=='belief')return alert('Сначала выберите Убеждение 1');(selected.obj.feelings||(selected.obj.feelings=[])).push(newFeeling());save();renderTree()};
$('#addDeepBtn').onclick=()=>{if(selected?.type!=='feeling')return alert('Сначала выберите вторичное чувство');(selected.obj.deep||(selected.obj.deep=[])).push(newDeep());save();renderTree()};
$('#deleteElementBtn').onclick=()=>{if(!selected)return;const arr=selected.type==='belief'?selected.parent.beliefs:selected.type==='feeling'?selected.parent.feelings:selected.type==='deep'?selected.parent.deep:selected.parent.instincts;arr.splice(selected.index,1);selected=null;save();renderTree()};
$('#saveElementBtn').onclick=()=>{if(!selected)return;const o=selected.obj;if(selected.type==='instinct')o.name=$('#editorText').value;else o.text=$('#editorText').value;o.level=lvl($('#editorLevel').value);o.comment=$('#editorComment').value;save();renderTree()};
$('#saveInstinctBtn').onclick=()=>{if(selected?.type!=='deep')return;const arr=selected.obj.instincts||(selected.obj.instincts=[]);if(!arr.length)arr.push(newInstinct());arr[0].name=$('#instinctCombo').value;arr[0].level=lvl($('#instinctLevel').value);arr[0].comment=$('#instinctComment').value;save();renderTree()};
$('#addInstinctBtn').onclick=()=>{if(selected?.type!=='deep')return;selected.obj.instincts.push(newInstinct());save();renderTree()};
$('#saveResultBtn').onclick=()=>{const s=situation();if(!s)return;s.result=$('#situationResult').value;save()};
$('#saveHistoryBtn').onclick=()=>{save();download('diagnostika-backup-'+today()+'.json',JSON.stringify(state,null,2),'application/json')};
$('#exportTxtBtn').onclick=()=>{const c=client(),r=request(),s=situation();if(!c)return;let t=`ПСИХОЛОГИЧЕСКАЯ ДИАГНОСТИКА\n\nКлиент: ${c.name||''}\n`;if(r)t+=`\nОБЩИЙ ЗАПРОС\n${r.title||''}\n`;if(s){t+=`\nСИТУАЦИЯ: ${s.name||''}\nДискомфорт: ${lvl(s.level)}/10\n`;for(const b of s.beliefs||[]){t+=`\nУбеждение 1: ${b.text||''} (${lvl(b.level)}/10)`;for(const f of b.feelings||[]){t+=`\n  Вторичное чувство: ${f.text||''} (${lvl(f.level)}/10)`;for(const d of f.deep||[]){t+=`\n    Убеждение 2: ${d.text||''} (${lvl(d.level)}/10)`;for(const x of d.instincts||[])t+=`\n      Инстинкт: ${x.name||''} (${lvl(x.level)}/10)`}}}t+=`\n\nЖЕЛАЕМЫЙ РЕЗУЛЬТАТ\n${s.result||''}\n`}download((c.name||'client')+'.txt',t)};
$('#hintBtn').onclick=()=>alert('Подсказки убеждений: «Я недостаточно хорош(а)», «Я не справляюсь», «Со мной что-то не так», «Я недостоин(а)», «Меня отвергнут», «Я беспомощен/беспомощна».');
if(!state.clients.length){const c=newClient();state.clients.push(c);clientId=c.id;save()}
renderClient();renderMode();