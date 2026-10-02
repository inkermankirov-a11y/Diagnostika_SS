import assert from 'node:assert/strict';
import fs from 'node:fs';

const loader=fs.readFileSync('app-loader.js','utf8');
const index=fs.readFileSync('index.html','utf8');

const start=loader.indexOf('async function startModuleGraph()');
const loadDashboard=loader.indexOf('loadDashboard();',start);
const loadRuntime=loader.indexOf('setTimeout(loadRuntimeContract,0);',start);

assert.ok(start>=0,'startModuleGraph missing');
assert.ok(loadDashboard>start,'dashboard is not started by module graph');
assert.ok(loadRuntime>loadDashboard,'runtime audit must start after dashboard');
assert.equal(loader.includes("publishRuntimeGate('ready',report);\n      loadDashboard();"),false,'runtime health audit still gates dashboard rendering');
assert.ok(loader.includes('const report=runtime.ready'),'runtime bootstrap audit promise is not reused');
assert.ok(index.includes('app-loader.js?v=20261002-fast-paint-1'),'app-loader cache key not bumped');

console.log('FAST_DASHBOARD_STARTUP_AUDIT_OK');
