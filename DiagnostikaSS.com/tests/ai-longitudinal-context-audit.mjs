import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('client-ai-full-context.js','utf8');
const index=fs.readFileSync('index.html','utf8');

for(const token of [
  'function cleanRequest(',
  'function buildLongitudinalTimeline(',
  'historicalRequests:requests',
  'specialistNotes:notes',
  'longitudinal:{',
  'totalRequests:requests.length',
  'totalSessions:sessions.length',
  'totalNotes:notes.length',
  'Прогресс / откат',
  'Заметки специалиста — самостоятельный важный источник контекста'
]){
  assert(source.includes(token),'Longitudinal AI context missing: '+token);
}

assert(source.includes("kind,'at:at||''")===false,'Malformed timeline entry marker');
assert(source.includes("kind,at:at||''"),'Timeline entries do not preserve date/time');
assert(source.includes("kind:'specialist_note'")===false,'Unexpected hard-coded specialist note object');
assert(source.includes("timelineEntry('specialist_note'"),'Specialist notes are not placed on timeline');
assert(source.includes("timelineEntry('request_completed'"),'Completed historical requests are not placed on timeline');
assert(source.includes("s.planned===true||String(s.status||'')==='planned'"),'Planned session timeline state missing');
assert(source.includes("requests=(Array.isArray(c?.requests)?c.requests:[])"),'All client requests are not sourced directly from canonical client history');
assert(source.includes("questionnaires=(Array.isArray(c?.questionnaires)?c.questionnaires:[])"),'All questionnaires are not sourced directly from canonical client history');
assert(index.includes('client-ai-full-context.js?v=20261003-longitudinal-ai-1'),'Longitudinal AI cache key missing');

console.log('AI_LONGITUDINAL_CONTEXT_OK');
