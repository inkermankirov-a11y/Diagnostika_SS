import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=JSON.parse(readFileSync('n8n/diagnostika-hypothesis-v1.json','utf8'));
const prep=workflow.nodes.find(n=>n.name==='Подготовить гипотезу');
const api=workflow.nodes.find(n=>n.name==='OpenAI — Responses API');
assert(prep?.parameters?.jsCode,'n8n hypothesis preparation node missing');
assert(api?.parameters?.body?.includes('$json.instructions'),'OpenAI API does not consume the hypothesis instructions');
assert(api?.parameters?.body?.includes('$json.prompt'),'OpenAI API does not consume the diagnostic input');

const execute=new Function('$json',prep.parameters.jsCode);
const beliefs=['беспомощная','лживая','бессильная','грустная','ненужная','слабая','отвергнутая','неспособная','незаметная'];
const diagnosticData={
  клиент:{имя:'Тест'},
  исходный_запрос:{id:'test-request',формулировка:'Отсутствие интереса и удовольствия от жизни'},
  сильные_ВУ:beliefs.map((belief,index)=>({
    убеждение:belief,максимальный_уровень:index<2?10:6,повторений:1,
    ветки:[{ситуация:'Зеркало',первичное_убеждение:'я некрасивая',вторичное_чувство:'стыд',уровень_ВУ:index<2?10:6,реакции:['спрятаться']}]
  })),
  ситуации:[{ситуация:'Зеркало',первичные_убеждения:[{убеждение:'я некрасивая',вторичные_чувства:[]}]}]
};
for(const addressMode of ['ty','vy','third']){
  const result=execute({body:{requestId:'test-request',clientName:'Тест',addressMode,diagnosticData,accessKey:'placeholder-key'}})[0]?.json;
  assert(result,'n8n code did not return an item');
  assert.equal(result.strongVuNames.length,9,'One or more strong beliefs were dropped');
  assert.deepEqual(result.strongVuNames,beliefs,'Strong belief wording or ordering changed');
  assert(result.prompt.includes('9. незаметная'),'Beliefs behind Показать ещё were not included');
  assert(result.instructions.includes('ОДИН цельный абзац'),'Strict expanded format missing');
  assert(result.instructions.includes('Не выбирай только одно или два'),'Obsolete 1–2 cap still active');
  assert(result.instructions.includes('КОРОТКАЯ ГИПОТЕЗА:'),'Short hypothesis output marker missing');
  assert(result.instructions.includes('РАСШИРЕННАЯ ГИПОТЕЗА:'),'Expanded hypothesis output marker missing');
  if(addressMode==='ty')assert(result.instructions.includes('Обращайся к клиенту на «ты»'));
  if(addressMode==='vy')assert(result.instructions.includes('Обращайся к клиенту на «Вы»'));
  if(addressMode==='third')assert(result.instructions.includes('Пиши о клиенте в третьем лице'));
}
const fallback=execute({body:{
  requestId:'test-request',addressMode:'ty',
  diagnosticData:{
    исходный_запрос:{id:'test-request',формулировка:'Запрос'},
    ситуации:[{ситуация:'Зеркало',первичные_убеждения:[{
      убеждение:'я некрасивая',вторичные_чувства:[{
        чувство_или_реакция:'стыд',
        вторичные_убеждения:[
          {убеждение_или_самоопределение:'ненужная',уровень:10,инстинктивные_реакции:[]},
          {убеждение_или_самоопределение:'слабая',уровень:6,инстинктивные_реакции:[]},
          {убеждение_или_самоопределение:'какая-то не такая',уровень:5,инстинктивные_реакции:[]}
        ]
      }]
    }]}]
  }
}})[0].json;
const parsedBody=execute({body:JSON.stringify({
  requestId:'test-request',
  addressMode:'ty',
  diagnosticData
})})[0].json;
assert.equal(parsedBody.strongVuNames.length,9,'Stringified webhook body omitted strong beliefs');
assert.deepEqual(fallback.strongVuNames,['ненужная','слабая'],'Fallback must reproduce the visible Strong VU threshold');
assert.equal(fallback.strongVuNames.includes('какая-то не такая'),false,'Below-threshold belief treated as strong');
console.log('N8N_HYPOTHESIS_STRICT_CHAIN_ALL_STRONG_VU_OK');