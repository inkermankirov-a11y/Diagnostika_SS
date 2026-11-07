import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexSource=fs.readFileSync('index.html','utf8');

const moduleFiles=[
  'modules/calendar/ui/calendar.js',
  'modules/calendar/ui/session-planning.js',
  'modules/calendar/ui/google-link.js'
];
const retiredRootFiles=[
  'client-calendar.js',
  'calendar-session-planning.js',
  'calendar-google-link.js'
];

for(const path of moduleFiles){
  assert.equal(fs.existsSync(path),true,'Calendar module UI file missing: '+path);
  assert.equal(indexSource.split(path).length-1,1,'Calendar module UI must load exactly once: '+path);
}
for(const path of retiredRootFiles){
  assert.equal(fs.existsSync(path),false,'Retired Calendar root file returned: '+path);
  assert.equal(indexSource.includes('src="'+path),false,'index.html still loads retired Calendar root file: '+path);
}

console.log('CALENDAR_STAGE8_UI_BOUNDARY_SUCCESS',JSON.stringify({
  moduleFiles:moduleFiles.length,
  retiredRootFiles:retiredRootFiles.length
}));
