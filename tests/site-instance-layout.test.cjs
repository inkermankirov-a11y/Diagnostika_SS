'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const com=path.join(root,'DiagnostikaSS.com');
const ru=path.join(root,'DiagnostikaSS.ru');
const read=file=>fs.readFileSync(file,'utf8');

test('both independent folders include complete website entry points and modules',()=>{
  for(const site of [com,ru]){
    for(const resource of [
      'index.html','app-loader.js','app.js','home-dashboard.js',
      'styles.css','modules/diagnosis/ui/hypothesis.js',
      'modules/requests/ui/free-consultation-builder.js',
      'modules/clients/ui/card.js','weather-data.json'
    ]){
      assert.ok(fs.existsSync(path.join(site,resource)),resource+' is missing from '+site);
    }
  }
  assert.match(read(path.join(com,'index.html')),/<title>DiagnostikaSS\.com/);
  assert.match(read(path.join(ru,'index.html')),/<title>DiagnostikaSS\.ru/);
});

test('both instances load their own relative frontend assets',()=>{
  for(const site of [com,ru]){
    const index=read(path.join(site,'index.html'));
    const links=[...index.matchAll(/\b(?:src|href)="([^"]+)"/g)]
      .map(x=>x[1]).filter(x=>!x.startsWith('#')&&!/^(?:https?:|data:|mailto:)/i.test(x));
    for(const value of links){
      const asset=value.split('?')[0].split('#')[0];
      assert.ok(!asset.startsWith('/')&&!asset.startsWith('../'),asset+' escapes '+site);
      assert.ok(fs.existsSync(path.join(site,asset)),asset+' does not exist in '+site);
    }
  }
});

test('second site isolates local browser data; first site keeps legacy browser data',()=>{
  const first=read(path.join(com,'index.html'));
  const second=read(path.join(ru,'index.html'));
  assert.doesNotMatch(first,/diagnostikass\.ru::/);
  assert.match(second,/diagnostikass\.ru::/);
  assert.match(second,/proto\.getItem=function/);
  assert.match(second,/proto\.setItem=function/);
  assert.match(second,/proto\.removeItem=function/);
});

test('root URL redirects to .com without removing legacy audit markup',()=>{
  const index=read(path.join(root,'index.html'));
  assert.match(index,/new URL\('\.\/DiagnostikaSS\.com\/'/);
  assert.match(index,/app-loader\.js/);
});

test('weather updater keeps both site feeds current',()=>{
  const workflow=read(path.join(root,'.github/workflows/update-weather.yml'));
  for(const site of ['DiagnostikaSS.com','DiagnostikaSS.ru']){
    assert.match(workflow,new RegExp('cp weather-data\\.json '+site.replace('.','\\.')+'/weather-data\\.json'));
    assert.match(workflow,new RegExp('git add [^\\n]*'+site.replace('.','\\.')+'/weather-data\\.json'));
  }
});
