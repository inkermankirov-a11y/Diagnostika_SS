import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('home-dashboard.js','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert.equal(home.includes('Быстрый старт'),false,'Quick Start block still exists');
assert.equal(home.includes('hd-step-num'),false,'Quick Start step markup still exists');
assert.ok(home.includes('id="hdOpenNotes"'),'Notes widget was removed accidentally');
assert.ok(home.includes('id="hdPlanBtn"'),'Next-step widget was removed accidentally');
assert.ok(loader.includes('home-dashboard.js?v=20261002-no-quick-start-1'),'dashboard cache key missing');
assert.ok(index.includes('app-loader.js?v=20261002-no-quick-start-1'),'app-loader cache key missing');

console.log('DASHBOARD_NO_QUICK_START_AUDIT_OK');
