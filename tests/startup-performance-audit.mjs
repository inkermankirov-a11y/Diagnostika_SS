import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const loader=fs.readFileSync('app-loader.js','utf8');
const scripts=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match=>match[1]);
const loaderIndex=scripts.findIndex(src=>src.startsWith('app-loader.js'));

assert.ok(loaderIndex>=0&&loaderIndex<=6,'app-loader must start immediately after the core shell');
assert.equal(scripts.filter(src=>src.startsWith('app-loader.js')).length,1,'app-loader must load exactly once');
assert.equal(scripts.some(src=>src.startsWith('diagnosis-api.js')),false,'diagnosis API must not be downloaded twice');
assert.ok(loader.includes('Promise.all(['),'startup module graph must load domains in parallel');
assert.ok(loader.includes('...DOMAINS.map(loadDomain)'),'all startup domains must use the parallel loader');
assert.equal((loader.match(/id:'/g)||[]).length,9,'startup domain list must contain all nine runtime domains');
assert.ok(loader.includes('warmDashboardAssets();'),'dashboard assets must be warmed before runtime verification');
assert.ok(loader.includes('home-dashboard.css?v=20261002-fast-start-1'),'dashboard CSS cache key missing');
assert.ok(loader.includes('home-dashboard.js?v=20261002-fast-start-1'),'dashboard JS cache key missing');
assert.ok(loader.includes('home-dashboard-sessions.js?v=20261002-fast-start-1'),'dashboard sessions preload missing');
assert.equal(/api\.onload=load[A-Z]/.test(loader),false,'legacy serial API waterfall returned');

console.log('STARTUP_PERFORMANCE_AUDIT_OK',JSON.stringify({loaderIndex,scriptCount:scripts.length,domains:9}));
