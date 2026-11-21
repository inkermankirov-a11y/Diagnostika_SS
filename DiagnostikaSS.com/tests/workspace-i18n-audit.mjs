import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const load=f=>fs.readFileSync(path.join(root,f),'utf8');
const sandbox={window:{}};vm.createContext(sandbox);
vm.runInContext(load('workspace-i18n.js'),sandbox);
const d=sandbox.window.ZabvenyeWorkspaceI18n;
const source=load('home-start-workspace.js');
const block=source.slice(source.indexOf('const thoughts'),source.indexOf('let promptIndex'));
const quotes=[...block.matchAll(/'([^'\n]+)'/g)].map(x=>x[1]).filter(x=>/[А-Яа-яЁё]/.test(x));
assert.equal(quotes.length,72);
const examples=['Психологическая','диагностика','Новые','Ближайшие','Не оплатил','Поиск по клиентам…','Мой рабочий день','Встреч сегодня','Ожидают внимания','Ближайшие события','Мысль дня','ВОПРОС ДЛЯ РАЗМЫШЛЕНИЯ','ПРАКТИКА','Вопрос для сессии','Следующий','Скопировать','БЫСТРЫЕ МЫСЛИ','Месяц','Неделя','Сегодня','Расписание на день','На этот день записей нет','＋ Выбрать и назначить','ТЕКУЩИЙ ЗАПРОС','ОСНОВНОЙ ЗАПРОС','СЕССИИ','ПОСЛЕДНЯЯ СЕССИЯ','ЖЕЛАЕМЫЙ РЕЗУЛЬТАТ','Следующий шаг','Заметки','Сохранить карточку','Телефон','Страна','Пол','Анкеты','Гипотеза по запросу','Форма обращения','Расширенная гипотеза','Короткая гипотеза','Сохранено','Сформировать','СИЛЬНЫЕ ВУ','ПУ','ВЧ','ВУ','Дискомфорт: 6/10','Сессия №3','Клиентов: 10','Всего: 3 · Проведено: 2 · Запланировано: 1','Показать ещё 3','ОПЛАТА ПО ЗАПРОСУ','Материалы сессии','АНКЕТЫ КЛИЕНТА'];
for(const lang of ['en','fr','de','it']){
  for(const s of [...quotes,...examples]){
    assert(d.has(s),'Missing key: '+s);
    const result=d.translate(s,lang);
    assert(!/[А-Яа-яЁё]/.test(result),lang+': '+s+' → '+result);
    assert.equal(d.translate(s,'ru'),s);
  }
  assert(d.translate('Запрос: Исходный текст клиента',lang).includes('Исходный текст клиента'));
  assert.equal(d.translate('Произвольный текст клиента',lang),'Произвольный текст клиента');
  assert(d.translate('Всего: 3 · Проведено: 2 · Запланировано: 1',lang).includes('3'));
}
const html=load('index.html');
assert(html.indexOf('workspace-i18n.js?')<html.indexOf('src="i18n.js?'));
assert(!html.includes('language-flags-fix.js?'));
const i18n=load('i18n.js');assert(i18n.includes('ZabvenyeWorkspaceI18n'));assert(i18n.includes('[data-i18n-user-content]'));
for(const f of ['workspace-i18n.js','i18n.js','app-loader.js','home-start-workspace.js','home-dashboard.js','app.js','modules/calendar/ui/calendar.js','modules/diagnosis/ui/hypothesis.js','modules/diagnosis/ui/hypothesis-clarity.js'])new vm.Script(load(f),{filename:f});
console.log('Workspace localization: '+d.count+' rows, '+quotes.length+' daily texts and '+examples.length+' screenshot UI samples verified for 5 languages.');

// Regression: selecting an existing diagnosis row must not rebuild the tree.
const app=load('app.js');
const addRow=app.slice(app.indexOf('function addTreeRow'),app.indexOf('let lastRenderedSituationKey'));
const selectionTest=new Function(`return (async()=>{
let selected=null,editor=0,tree=0,dirty=false;
const lvl=x=>x;
const document={dispatchEvent(){},createElement:()=>({dataset:{},className:'',classList:{add(){this.active=true},remove(){this.active=false}},append(){},style:{}})};
const rows=[],root={appendChild:x=>rows.push(x),querySelectorAll:()=>rows.filter(x=>x.classList.active)};
const a={type:'feeling',obj:{id:'1'},parent:{id:'a'}},b={type:'deep',obj:{id:'2'},parent:{id:'b'}};
const selectDiagnosisElementById=(t,id)=>selected=id==='1'?a:b;
const diagnosisEditorDraftState=()=>({dirty});
const guardDiagnosisEditorLeave=async fn=>fn();
const renderEditor=()=>editor++,renderTree=()=>tree++;
${addRow}
addTreeRow(root,'feeling','ВЧ','sample',5,a);
addTreeRow(root,'deep','ВУ','sample',6,b);
await rows[0].onclick();await rows[1].onclick();await rows[1].onclick();
if(editor!==2||tree!==0||selected!==b||!rows[1].classList.active||rows[0].classList.active)throw Error('Selection rebuild regression');
dirty=true;await rows[0].onclick();
if(tree!==1||selected!==a)throw Error('Save transition regression');
})()`);
await selectionTest();
const addSamples=['← Назад к клиенту','Последние вычисления сохраняются автоматически','Центральный банк России · Дата курса: 2026-11-20','Назначено: 26.11.2026 · 19:00','ПЛАН:','НА СЕССИИ:','19:00 · то же время','То, что клиент говорит о себе в первую очередь.','То, что клиент чувствует, когда активируется первичное убеждение.','Скрытое, глубокое убеждение о себе, к которому приводит диагностика. Главная задача диагностики — выявить именно его.','Свернуть ВУ и инстинкты','Развернуть ВУ и инстинкты','Связать с запросом','Будет создана запланированная карточка: Сессия №4 • у клиента не выбран текущий запрос'];
for(const lang of ['en','fr','de','it'])for(const sample of addSamples){assert(d.has(sample));assert(!/[А-Яа-яЁё]/.test(d.translate(sample,lang)),lang+': '+sample);}
console.log('Diagnosis selection and additional tooltip localization regression: PASS');
