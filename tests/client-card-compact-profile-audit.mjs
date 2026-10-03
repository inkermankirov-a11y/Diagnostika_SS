import fs from 'node:fs';
import assert from 'node:assert/strict';

const js=fs.readFileSync('modules/clients/ui/card.js','utf8');
const css=fs.readFileSync('modules/clients/ui/card.css','utf8');
const app=fs.readFileSync('app.js','utf8');
const service=fs.readFileSync('modules/clients/client-service.js','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

new Function(js);
new Function(app);
new Function(service);

assert(js.includes('id="ccBirthTime" type="time"'),'Birth time field missing');
assert(js.includes('id="ccAgeAuto" type="checkbox"'),'Automatic age toggle missing');
assert(js.includes("ageAuto:q('ccAgeAuto').checked===true"),'Age mode is not persisted');
assert(js.includes("birthTime:q('ccBirthTime').value"),'Birth time is not persisted');
assert(js.includes('cc-social-column'),'Social contacts are not grouped in one column');
const calendarPos=js.indexOf('id="ccCalendarBtn"');
const diagnosisPos=js.indexOf('id="ccDiagnosisBtn"');
const freePos=js.indexOf('id="ccFreeConsultBtn"');
assert(calendarPos>=0&&diagnosisPos>calendarPos&&freePos>diagnosisPos,'Client action order must be Calendar → Diagnosis → Free consultation');
assert(js.includes("q('ccDiagnosisBtn').onclick"),'Diagnosis button handler missing');
assert(js.includes('window.DiagnostikaDiagnosis?.open'),'Diagnosis button does not open the diagnosis module');
assert(css.includes('.cc-diagnosis-btn'),'Diagnosis button style missing');
assert(js.includes('photoActionsDlg.showModal()'),'Existing client photo does not open an action menu');
assert(js.includes("data-photo-action=\"edit\""),'Edit-thumbnail photo action missing');
assert(js.includes("data-photo-action=\"replace\""),'Replace-photo action missing');
assert(js.includes("data-photo-action=\"delete\""),'Delete-photo action missing');
assert(js.includes('photoSourceData:photoSourceData || photoData ||'),'Photo source is not persisted');
assert(js.includes('photoCrop:{...photoCrop}'),'Photo crop is not persisted');
assert(js.includes('cropClientPhoto(img,crop)'),'Client photo crop editor missing');
assert(!js.includes("dlg.addEventListener('click', e => { if(e.target === dlg) closeDraftAware(); });"),'Client card still closes on backdrop click');

assert(css.includes('grid-template-columns:166px minmax(370px,1fr) 165px 170px'),'Compact desktop profile layout missing');
assert(css.includes('.cc-social-column{display:grid;grid-template-columns:1fr'),'Social links are not vertical');
assert(css.includes('.cc-top-actions{display:grid;grid-template-columns:1fr'),'Client actions are not vertical');
assert(css.includes('width:min(360px,100%)'),'Client time block is still oversized');
assert(css.includes('overflow-x:hidden'),'Client card horizontal overflow guard missing');
assert(css.includes('.cc-photo-editor-preview'),'Client photo thumbnail editor styles missing');

assert(app.includes("birthTime:''")&&app.includes("photoSourceData:''"),'Legacy newClient defaults missing new profile fields');
assert(service.includes("birthTime: ''")&&service.includes("photoSourceData: ''"),'Client service defaults missing new profile fields');
assert(loader.includes('modules/clients/client-service.js?v=20260918-clients2b2&db=14b&pin=18a&cleanup=23b&profile=20261003-1'),'Client service cache marker missing');
assert(index.includes('modules/clients/ui/card.css?v=20261003-diagnosis-action-1'),'Client card CSS cache marker missing');
assert(index.includes('modules/clients/ui/card.js?v=20261003-diagnosis-action-1'),'Client card JS cache marker missing');

console.log('CLIENT_CARD_COMPACT_PROFILE_AUDIT_SUCCESS');
