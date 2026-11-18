'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const js=read('home-dashboard-sessions.js');
const loader=read('app-loader.js');
const html=read('index.html');

test('session cards use equal widths and heights across planned and completed states',()=>{
  assert.match(js,/\.hd-session-card\{width:100%!important;height:160px!important;min-height:160px!important;max-height:160px!important/);
  assert.match(js,/\.hd-sessions-list\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(js,/\.hd-sessions-section\{[^}]*padding:16px 12px/);
  assert.doesNotMatch(js,/\.hd-session-card\{height:112px!important/);
});
test('preview is visibly clamped to exactly three lines above planned action row',()=>{
  assert.match(js,/hd-session-snippet-content/);
  assert.match(js,/-webkit-line-clamp:3;line-clamp:3;max-height:50\.4px;overflow:hidden/);
  assert.match(js,/\.hd-session-card .hd-session-card-actions\{flex:0 0 auto/);
  assert.match(js,/\.hd-session-card .hd-session-top\{flex:0 0 auto;max-height:68px/);
  assert.match(js,/replace\(\/\\\*\\\*\/g,''\)/);
});
test('small-screen session cards have room for wrapping badges and labels',()=>{
  assert.match(js,/@media\(max-width:600px\)\{[^}]*\.hd-session-card\{height:208px!important;min-height:208px!important;max-height:208px!important/);
  assert.match(js,/@media\(max-width:400px\)\{\.hd-session-card\{height:226px!important/);
  assert.match(js,/\.hd-session-card .hd-session-top\{max-height:122px/);
});
test('new client session preview is deployed under cache-busted assets',()=>{
  assert.match(loader,/home-dashboard-sessions\.js\?v=20261118-expanded-preview-4/);
  assert.match(html,/app-loader\.js\?v=20261118-session-cards-and-beacon-3/);
});
