'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const win={};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname,'..','modules/diagnosis/ui/hypothesis-clarity.js'),'utf8'),
  {window:win}
);
const clarity=win.DiagnostikaHypothesisClarity;

const example={
  клиент:{имя:'Ирина Волкова',пол:'Женский'},
  сильные_ВУ:[
    {убеждение:'Я бесполезный',повторений:4,максимальный_уровень:10,ветки:[
      {ситуация:'Боюсь, что после увольнения не будет продаж',первичное_убеждение:'Я не уверен в себе',вторичное_чувство:'злость на себя',уровень_ВУ:10},
      {ситуация:'Боюсь, что после увольнения не будет продаж',первичное_убеждение:'Я не уверен в себе',вторичное_чувство:'разочарование',уровень_ВУ:9}
    ]},
    {убеждение:'Я недостоин любви',повторений:3,максимальный_уровень:10,ветки:[
      {ситуация:'Боюсь, что после увольнения не будет продаж',первичное_убеждение:'Я не уверен в себе',вторичное_чувство:'обида',уровень_ВУ:9}
    ]},
    {убеждение:'Я незначим',повторений:2,максимальный_уровень:9,ветки:[
      {ситуация:'Боюсь, что после увольнения не будет продаж',первичное_убеждение:'Я не уверен в себе',вторичное_чувство:'жалость к себе',уровень_ВУ:8}
    ]},
    {убеждение:'Я благородный',повторений:1,максимальный_уровень:10,ветки:[]},
    {убеждение:'Я слабый',повторений:1,максимальный_уровень:6,ветки:[]}
  ],
  исходный_запрос:{формулировка:'Боюсь, что после ухода с работы не будет продаж'}
};

test('uses 2-3 harsh strong beliefs and excludes positive or weak beliefs',()=>{
  const r=clarity.format(example,'ty');
  assert.equal(r.focus.beliefs.length,3);
  assert.deepEqual(Array.from(r.focus.beliefs,x=>x.text),
    ['Я бесполезная','Я недостойна любви','Я незначима']);
  assert.doesNotMatch(r.expanded,/благородная|слабая/);
  assert.match(r.expanded,/«Я бесполезная», «Я недостойна любви» и «Я незначима»/);
});

test('same belief in masculine and feminine forms is deduplicated',()=>{
  const data={клиент:{пол:'Женский'},сильные_ВУ:[
    {убеждение:'Я бесполезный',максимальный_уровень:9,повторений:2,ветки:[]},
    {убеждение:'Я бесполезная',максимальный_уровень:10,повторений:2,ветки:[]}
  ]};
  const r=clarity.format(data,'ty');
  assert.equal(r.focus.beliefs.length,1);
  assert.equal(r.focus.repeatCount,4);
  assert.equal(r.expanded.match(/«Я бесполезная»/g).length,1);
});

test('all forms of address preserve feminine beliefs and correct third-person pronouns',()=>{
  const ty=clarity.format(example,'ty').expanded;
  const vy=clarity.format(example,'vy').expanded;
  const third=clarity.format(example,'third').expanded;
  assert.match(ty,/твоего запроса/);
  assert.match(vy,/вашего запроса/);
  assert.match(third,/запроса клиентки/);
  assert.match(third,/она может/);
  assert.match(third,/её исходный запрос/);
  for(const value of [ty,vy,third]){
    assert.match(value,/Я недостойна любви/);
    assert.match(value,/Я незначима/);
    assert.match(value,/Я не уверена в себе/);
    assert.doesNotMatch(value,/Я недостоин любви|Я незначим»|Я не уверен в себе/);
    assert.ok(value.split(/\s+/).length<=110);
    assert.doesNotMatch(value,/\n/);
  }
});

test('male client gets masculine beliefs, female saved wording also converts back',()=>{
  const male={...example,клиент:{пол:'Мужской'}};
  const result=clarity.format(male,'third');
  assert.match(result.expanded,/«Я бесполезный»/);
  assert.match(result.expanded,/«Я недостоин любви»/);
  assert.match(result.expanded,/«Я незначим»/);
  assert.match(result.expanded,/он может/);
  assert.match(result.expanded,/его исходный запрос/);
  assert.equal(clarity.inflectBelief('Я бесполезная','male'),'Я бесполезный');
  assert.equal(clarity.inflectBelief('Я недостойна любви','male'),'Я недостоин любви');
});

test('unknown gender is not guessed from feminine name and preserves stored words',()=>{
  const unknown={...example,клиент:{имя:'Ирина Волкова',пол:''}};
  const result=clarity.format(unknown,'third');
  assert.equal(result.focus.gender,'');
  assert.match(result.expanded,/запроса человека/);
  assert.match(result.expanded,/«Я бесполезный»/);
  assert.doesNotMatch(result.expanded,/она может|он может/);
});

test('with two qualifying beliefs shows only two; does not invent a third',()=>{
  const data={клиент:{пол:'Женский'},сильные_ВУ:example.сильные_ВУ.slice(0,2)};
  const result=clarity.format(data,'ty');
  assert.equal(result.focus.beliefs.length,2);
  assert.match(result.expanded,/«Я бесполезная» и «Я недостойна любви»/);
});

test('with one qualifying belief uses singular',()=>{
  const data={клиент:{пол:'Женский'},сильные_ВУ:example.сильные_ВУ.slice(0,1)};
  const result=clarity.format(data,'ty');
  assert.equal(result.focus.beliefs.length,1);
  assert.match(result.expanded,/может лежать глубинное убеждение/);
});

test('fallback to legacy deep beliefs accepts intensity >=6, not low-level noise',()=>{
  const data={клиент:{пол:'Женский'},ситуации:[{
    ситуация:'Новая работа',первичные_убеждения:[{
      убеждение:'Я не справлюсь',вторичные_чувства:[{
        чувство_или_реакция:'страх',вторичные_убеждения:[
          {убеждение_или_самоопределение:'Я бесполезный',уровень:7},
          {убеждение_или_самоопределение:'Я слабый',уровень:4}
        ]
      }]
    }]
  }],исходный_запрос:{формулировка:'Новая работа'}};
  const result=clarity.format(data,'ty');
  assert.equal(result.focus.beliefs.length,1);
  assert.match(result.expanded,/Я бесполезная/);
  assert.doesNotMatch(result.expanded,/Я слабая/);
});

test('no qualifying strong beliefs yields uncertainty, not invented statements',()=>{
  const result=clarity.format({ситуации:[{ситуация:'Страх перемен'}]},'ty');
  assert.equal(result.focus,null);
  assert.match(result.expanded,/пока не выявлено/);
});

test('expanded and short reply follow existing parser contract',()=>{
  const raw=clarity.formatReply(example,'ty');
  assert.match(raw,/^РАСШИРЕННАЯ ГИПОТЕЗА:\n/);
  assert.match(raw,/\n\nКОРОТКАЯ ГИПОТЕЗА:\n/);
  assert.match(raw,/«Я бесполезная»/);
});

test('hypothesis request passes selected client sex to formatter',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','modules/diagnosis/ui/hypothesis.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(source,/пол:cleanText\(c\.gender\|\|c\.sex\)/);
  assert.match(source,/centralBeliefs:3/);
  assert.match(source,/HypothesisClarity\?\.formatReply\?\.\(data,selectedAddressMode\(\)\)/);
  assert.match(html,/hypothesis-clarity\.js\?v=20261101-top3-gender-2/);
  assert.match(html,/hypothesis\.js\?v=20261101-top3-gender-2/);
});
