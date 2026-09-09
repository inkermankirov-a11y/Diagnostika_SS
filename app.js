'use strict';

const STORAGE_KEY = 'diagnostika-web-v1';
const PRIMARY_BELIEF_HINTS = [
  'Я недостаточно хорошая / хороший','Я недостаточно компетентная / компетентный','Я ничего не умею',
  'Я не справляюсь','Я не способна / не способен','Я слабая / слабый','Я глупая / глупый',
  'Я неудачница / неудачник','Я хуже других','Я недостойна / недостоин','Я не заслуживаю',
  'Я никому не нужна / не нужен','Меня не любят','Меня отвергнут','Со мной что-то не так',
  'Я всё делаю неправильно','Я не имею права ошибаться','Я не имею права проявляться',
  'Я должна / должен всё контролировать','Я один / одна','Я беспомощная / беспомощный'
];
const FEELINGS = ['Боль','Обида','Страх','Стыд','Вина','Грусть','Злость','Разочарование','Одиночество','Беспомощность','Тревога','Унижение','Зависть','Ревность'];
const INSTINCTS = ['Бей / атаковать','Беги / убежать','Замри / спрятаться'];

let state = loadState();
let currentClientId = state.clients[0]?.id || null;
let saveTimer = null;

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function level(v) { return Math.max(1, Math.min(10, Number(v) || 1)); }
function newClient() {
  return { id: uid(), name: 'Новый клиент', phone:'', email:'', gender:'', birth:'', city:'', country:'', vk:'', telegram:'', max:'', cameWith:'', mainRequest:'', tried:'', didntHelp:'', desired:'', source:'', notes:'', diagnosis:{ request:'', situations:[] } };
}
function newSituation() { return { id:uid(), name:'', level:5, comment:'', beliefs:[], result:'' }; }
function newBelief() { return { id:uid(), text:'', level:5, comment:'', feelings:[] }; }
function newFeeling() { return { id:uid(), text:'', level:5, comment:'', deep:[] }; }
function newDeep() { return { id:uid(), text:'', level:5, comment:'', instincts:[{ id:uid(), name:'', level:5, comment:'' }] }; }
function newInstinct() { return { id:uid(), name:'', level:5, comment:'' }; }
function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch(e) { console.warn(e); }
  return { version:1, clients:[] };
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const el = document.getElementById('saveStatus');
  if (el) { el.textContent = `Сохранено ${new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`; }
}
function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 250); }
function currentClient() { return state.clients.find(c => c.id === currentClientId) || null; }

const $ = s => document.querySelector(s);
const clientList = $('#clientList');

function renderClients() {
  const q = ($('#clientSearch').value || '').trim().toLowerCase();
  clientList.innerHTML = '';
  state.clients.filter(c => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)).forEach(c => {
    const b = document.createElement('button');
    b.className = 'client-item' + (c.id === currentClientId ? ' active' : '');
    b.innerHTML = `<span class="client-name"></span><span class="client-sub"></span>`;
    b.querySelector('.client-name').textContent = c.name || 'Без имени';
    b.querySelector('.client-sub').textContent = c.phone || c.city || 'Нет контактов';
    b.onclick = () => { currentClientId = c.id; renderAll(); };
    clientList.appendChild(b);
  });
}

const profileFields = {
  clientName:'name', clientPhone:'phone', clientEmail:'email', clientGender:'gender', clientBirth:'birth', clientCity:'city', clientCountry:'country', clientVk:'vk', clientTelegram:'telegram', clientMax:'max', clientCameWith:'cameWith', clientMainRequest:'mainRequest', clientTried:'tried', clientDidntHelp:'didntHelp', clientDesired:'desired', clientSource:'source', clientNotes:'notes'
};
for (const [id,key] of Object.entries(profileFields)) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => { const c=currentClient(); if(!c)return; c[key]=el.value; renderClients(); queueSave(); });
}

function renderProfile() {
  const c = currentClient(); if (!c) return;
  for (const [id,key] of Object.entries(profileFields)) document.getElementById(id).value = c[key] || '';
}

function makeInput(value, placeholder, onInput, listValues=null) {
  const wrap = document.createElement('div');
  const input = document.createElement('input'); input.className='input'; input.value=value||''; input.placeholder=placeholder||'';
  if (listValues) { const list=document.createElement('datalist'); const listId=`list-${uid()}`; list.id=listId; listValues.forEach(v=>{const o=document.createElement('option');o.value=v;list.appendChild(o);}); input.setAttribute('list',listId); wrap.append(input,list); }
  else wrap.appendChild(input);
  input.addEventListener('input',()=>{onInput(input.value);queueSave();});
  return wrap;
}
function makeLevel(value,onInput) { const i=document.createElement('input'); i.className='level-input'; i.type='number'; i.min='1';i.max='10';i.value=level(value);i.addEventListener('input',()=>{onInput(level(i.value));queueSave();});return i; }
function makeDelete(onClick) { const b=document.createElement('button');b.className='icon-button danger-text';b.textContent='×';b.title='Удалить';b.onclick=onClick;return b; }
function makeComment(value,onInput) { const t=document.createElement('textarea');t.className='textarea';t.placeholder='Комментарий';t.value=value||'';t.addEventListener('input',()=>{onInput(t.value);queueSave();});return t; }
function smallButton(text,onClick) { const b=document.createElement('button');b.className='button ghost small';b.textContent=text;b.onclick=onClick;return b; }

function renderDiagnosis() {
  const c=currentClient(); if(!c)return;
  $('#diagnosisRequest').value=c.diagnosis?.request||'';
  if(!c.diagnosis)c.diagnosis={request:'',situations:[]};
  const root=$('#situations');root.innerHTML='';
  c.diagnosis.situations.forEach((s,si)=>root.appendChild(renderSituation(s,si)));
}
function renderSituation(s,si) {
  const node=document.getElementById('situationTemplate').content.firstElementChild.cloneNode(true);
  const c=currentClient();
  const name=node.querySelector('.situation-name');name.value=s.name||'';name.oninput=()=>{s.name=name.value;queueSave();};
  const lv=node.querySelector('.situation-level');lv.value=level(s.level);lv.oninput=()=>{s.level=level(lv.value);queueSave();};
  const com=node.querySelector('.situation-comment');com.value=s.comment||'';com.oninput=()=>{s.comment=com.value;queueSave();};
  const res=node.querySelector('.situation-result');res.value=s.result||'';res.oninput=()=>{s.result=res.value;queueSave();};
  node.querySelector('.delete-situation').onclick=()=>{if(confirm('Удалить ситуацию со всеми вложенными элементами?')){c.diagnosis.situations.splice(si,1);saveState();renderDiagnosis();}};
  const beliefs=node.querySelector('.beliefs');s.beliefs.forEach((b,bi)=>beliefs.appendChild(renderBelief(s,b,bi)));
  node.querySelector('.add-belief').onclick=()=>{s.beliefs.push(newBelief());saveState();renderDiagnosis();};
  return node;
}
function renderBelief(parent,b,bi) {
  const card=document.createElement('div');card.className='belief-card';
  const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(b.text,'Убеждение',v=>b.text=v,PRIMARY_BELIEF_HINTS));row.appendChild(makeLevel(b.level,v=>b.level=v));row.appendChild(makeDelete(()=>{parent.beliefs.splice(bi,1);saveState();renderDiagnosis();}));row.appendChild(makeComment(b.comment,v=>b.comment=v));card.appendChild(row);
  const feelings=document.createElement('div'); b.feelings.forEach((f,fi)=>feelings.appendChild(renderFeeling(b,f,fi)));card.appendChild(feelings);
  const actions=document.createElement('div');actions.className='nested-actions';actions.appendChild(smallButton('+ Вторичное чувство',()=>{b.feelings.push(newFeeling());saveState();renderDiagnosis();}));card.appendChild(actions);return card;
}
function renderFeeling(parent,f,fi) {
  const card=document.createElement('div');card.className='feeling-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(f.text,'Вторичное чувство',v=>f.text=v,FEELINGS));row.appendChild(makeLevel(f.level,v=>f.level=v));row.appendChild(makeDelete(()=>{parent.feelings.splice(fi,1);saveState();renderDiagnosis();}));row.appendChild(makeComment(f.comment,v=>f.comment=v));card.appendChild(row);
  const deep=document.createElement('div');f.deep.forEach((d,di)=>deep.appendChild(renderDeep(f,d,di)));card.appendChild(deep);
  const a=document.createElement('div');a.className='nested-actions';a.appendChild(smallButton('+ Глубинное убеждение',()=>{f.deep.push(newDeep());saveState();renderDiagnosis();}));card.appendChild(a);return card;
}
function renderDeep(parent,d,di) {
  if(!Array.isArray(d.instincts)) d.instincts=[];
  const card=document.createElement('div');card.className='deep-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(d.text,'Глубинное убеждение',v=>d.text=v,PRIMARY_BELIEF_HINTS));row.appendChild(makeLevel(d.level,v=>d.level=v));row.appendChild(makeDelete(()=>{parent.deep.splice(di,1);saveState();renderDiagnosis();}));row.appendChild(makeComment(d.comment,v=>d.comment=v));card.appendChild(row);
  const ins=document.createElement('div');d.instincts.forEach((x,ii)=>ins.appendChild(renderInstinct(d,x,ii)));card.appendChild(ins);
  const a=document.createElement('div');a.className='nested-actions';a.appendChild(smallButton('+ Инстинкт',()=>{d.instincts.push(newInstinct());saveState();renderDiagnosis();}));card.appendChild(a);return card;
}
function renderInstinct(parent,x,ii) {
  const card=document.createElement('div');card.className='instinct-card';const row=document.createElement('div');row.className='row-editor';
  row.appendChild(makeInput(x.name,'Инстинкт',v=>x.name=v,INSTINCTS));row.appendChild(makeLevel(x.level,v=>x.level=v));row.appendChild(makeDelete(()=>{parent.instincts.splice(ii,1);saveState();renderDiagnosis();}));row.appendChild(makeComment(x.comment,v=>x.comment=v));card.appendChild(row);return card;
}

function renderAll() {
  const c=currentClient();
  $('#emptyState').classList.toggle('hidden',!!c);$('#workspaceContent').classList.toggle('hidden',!c);
  renderClients(); if(c){renderProfile();renderDiagnosis();}
}

$('#addClientBtn').onclick=()=>{const c=newClient();state.clients.push(c);currentClientId=c.id;saveState();renderAll();$('#clientName').focus();$('#clientName').select();};
$('#deleteClientBtn').onclick=()=>{const c=currentClient();if(!c)return;if(confirm(`Удалить клиента «${c.name||'Без имени'}» и всю его диагностику?`)){state.clients=state.clients.filter(x=>x.id!==c.id);currentClientId=state.clients[0]?.id||null;saveState();renderAll();}};
$('#clientSearch').addEventListener('input',renderClients);
$('#diagnosisRequest').addEventListener('input',e=>{const c=currentClient();if(c){c.diagnosis.request=e.target.value;queueSave();}});
$('#addSituationBtn').onclick=()=>{const c=currentClient();if(!c)return;c.diagnosis.situations.push(newSituation());saveState();renderDiagnosis();};

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));document.querySelectorAll('.tab-page').forEach(p=>p.classList.remove('active'));document.getElementById(`${t.dataset.tab}Tab`).classList.add('active');});

function download(name,text,type='text/plain;charset=utf-8') { const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
$('#exportDbBtn').onclick=()=>download(`diagnostika-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json');
$('#importDbInput').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(!parsed||!Array.isArray(parsed.clients))throw new Error('Неверный формат');if(confirm('Импорт заменит текущую локальную базу. Продолжить?')){state=parsed;currentClientId=state.clients[0]?.id||null;saveState();renderAll();}}catch(err){alert(`Не удалось импортировать: ${err.message}`);}finally{e.target.value='';}});
$('#exportTxtBtn').onclick=()=>{const c=currentClient();if(!c)return alert('Сначала выберите клиента.');let out=`ПСИХОЛОГИЧЕСКАЯ ДИАГНОСТИКА\n\nКлиент: ${c.name||''}\n\nОБЩИЙ ЗАПРОС\n${c.diagnosis.request||''}\n\n`;c.diagnosis.situations.forEach((s,i)=>{out+=`СИТУАЦИЯ ${i+1}: ${s.name||''}\nУровень: ${level(s.level)}/10\n${s.comment?`Комментарий: ${s.comment}\n`:''}`;s.beliefs.forEach((b,bi)=>{out+=`\n  УБЕЖДЕНИЕ ${bi+1}: ${b.text||''} (${level(b.level)}/10)\n`;b.feelings.forEach((f,fi)=>{out+=`    ВТОРИЧНОЕ ЧУВСТВО ${fi+1}: ${f.text||''} (${level(f.level)}/10)\n`;f.deep.forEach((d,di)=>{out+=`      ГЛУБИННОЕ УБЕЖДЕНИЕ ${di+1}: ${d.text||''} (${level(d.level)}/10)\n`;d.instincts.forEach((x,ii)=>{out+=`        ИНСТИНКТ ${ii+1}: ${x.name||''} (${level(x.level)}/10)\n`;});});});});out+=`\nЖЕЛАЕМЫЙ РЕЗУЛЬТАТ\n${s.result||''}\n\n${'-'.repeat(60)}\n\n`;});download(`${(c.name||'client').replace(/[\\/:*?"<>|]/g,'_')}-diagnostika.txt`,out);};

window.addEventListener('beforeunload',saveState);
renderAll();
