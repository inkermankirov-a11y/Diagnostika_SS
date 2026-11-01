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
  сильные_ВУ:[
    {убеждение:'я беспомощный',повторений:4,максимальный_уровень:9,ветки:[
      {ситуация:'Думаю об уходе с работы без продаж',первичное_убеждение:'я хуже тех, у кого получается',вторичное_чувство:'злость на себя',уровень_ВУ:9},
      {ситуация:'Думаю об уходе с работы без продаж',первичное_убеждение:'я хуже тех, у кого получается',вторичное_чувство:'разочарование',уровень_ВУ:8},
      {ситуация:'Думаю об уходе с работы без продаж',первичное_убеждение:'я хуже тех, у кого получается',вторичное_чувство:'жалость к себе',уровень_ВУ:7},
      {ситуация:'Думаю об уходе с работы без продаж',первичное_убеждение:'я хуже тех, у кого получается',вторичное_чувство:'обида',уровень_ВУ:6}
    ]},
    {убеждение:'я слабый',повторений:1,максимальный_уровень:10,ветки:[]},
    {убеждение:'я благородный',повторений:1,максимальный_уровень:9,ветки:[]}
  ],
  исходный_запрос:{формулировка:'Боюсь, что после ухода с работы не будет продаж'}
};

test('one repeated belief, not a list of all strong beliefs',()=>{
  const r=clarity.format(example,'ty');
  assert.equal(r.focus.belief,'Я беспомощный');
  assert.equal(r.focus.repeatCount,4);
  assert.match(r.expanded,/«Я беспомощный»/);
  assert.doesNotMatch(r.expanded,/я слабый|я благородный/i);
  assert.equal(r.expanded.match(/«Я беспомощный»/g).length,1);
});

test('real situation, perception, emotions and original request form one short paragraph',()=>{
  const r=clarity.format(example,'ty');
  assert.match(r.expanded,/Думаю об уходе с работы без продаж/);
  assert.match(r.expanded,/«Я хуже тех, у кого получается»/);
  assert.match(r.expanded,/злость на себя, разочарование, жалость к себе и обида/);
  assert.match(r.expanded,/исходный запрос: «Боюсь, что после ухода с работы не будет продаж»/);
  assert.ok(r.expanded.split(/\s+/).length<100);
  assert.doesNotMatch(r.expanded,/\n|список|вторичные убеждения/i);
});

test('preserves grammatical address forms',()=>{
  assert.match(clarity.format(example,'vy').expanded,/вашего запроса/);
  assert.match(clarity.format(example,'third').expanded,/запроса клиента/);
});

test('fallback uses recorded deep belief even without strong group',()=>{
  const data={ситуации:[{
    ситуация:'Новая работа',первичные_убеждения:[{
      убеждение:'Я не справлюсь',вторичные_чувства:[{
        чувство_или_реакция:'страх',вторичные_убеждения:[{
          убеждение_или_самоопределение:'Я бесполезный',уровень:7
        }]
      }]
    }]
  }],исходный_запрос:{формулировка:'Новая работа'}};
  assert.match(clarity.format(data,'ty').expanded,/Я бесполезный/);
});

test('does not invent a core belief if diagnostic data have none',()=>{
  const result=clarity.format({ситуации:[{ситуация:'Страх перемен'}]},'ty');
  assert.equal(result.focus,null);
  assert.match(result.expanded,/пока не выявлено/);
});

test('reply preserves the established parser format',()=>{
  const raw=clarity.formatReply(example,'ty');
  assert.match(raw,/^РАСШИРЕННАЯ ГИПОТЕЗА:\n/);
  assert.match(raw,/\n\nКОРОТКАЯ ГИПОТЕЗА:\n/);
});
