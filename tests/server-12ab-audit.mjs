import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT=process.cwd();
const SERVER_DIR=path.join(ROOT,'server');
const DATA_DIR=path.join(SERVER_DIR,'data');
const CONNECTIONS_FILE=path.join(DATA_DIR,'google-drive-connections.json');
const ENV_FILE=path.join(SERVER_DIR,'.env');
const PORT=32187;
const BASE=`http://127.0.0.1:${PORT}`;

fs.mkdirSync(DATA_DIR,{recursive:true});
fs.writeFileSync(CONNECTIONS_FILE,JSON.stringify({
  sentinel:{
    provider:'google-drive',
    refreshToken:'SECRET_REFRESH_TOKEN_MARKER',
    email:'private@example.com'
  }
},null,2),'utf8');

const previousEnvFile=fs.existsSync(ENV_FILE)?fs.readFileSync(ENV_FILE,'utf8'):null;
fs.writeFileSync(ENV_FILE,[
  `PORT=${PORT}`,
  `PUBLIC_BASE_URL=${BASE}`,
  'GOOGLE_CLIENT_ID=test-client-id',
  'GOOGLE_CLIENT_SECRET=test-client-secret',
  'SESSION_SECRET=0123456789abcdef0123456789abcdef',
  `TOKEN_ENCRYPTION_KEY=${'11'.repeat(32)}`,
  'NODE_ENV=test'
].join('\n')+'\n','utf8');

const childEnv={...process.env};
for(const key of ['PORT','PUBLIC_BASE_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','SESSION_SECRET','TOKEN_ENCRYPTION_KEY','NODE_ENV']){
  delete childEnv[key];
}

const child=spawn(process.execPath,['server/server.js'],{
  cwd:ROOT,
  env:childEnv,
  stdio:['ignore','pipe','pipe']
});

let stdout='';
let stderr='';
child.stdout.on('data',d=>{stdout+=String(d)});
child.stderr.on('data',d=>{stderr+=String(d)});

async function waitReady(){
  let last;
  for(let i=0;i<80;i++){
    try{
      const res=await fetch(BASE+'/api/health');
      if(res.ok)return res;
      last=new Error('HTTP '+res.status);
    }catch(error){last=error;}
    await new Promise(r=>setTimeout(r,100));
  }
  throw last||new Error('Server did not start');
}

async function request(url,options={}){
  return fetch(BASE+url,{redirect:'manual',...options});
}

try{
  const healthRes=await waitReady();
  const health=await healthRes.json();
  assert.deepEqual(health,{
    ok:true,
    service:'diagnostika-ss',
    version:'12D',
    googleOAuthConfigured:true
  });
  assert.equal(healthRes.headers.get('cache-control'),'no-store');
  assert.equal(healthRes.headers.get('x-content-type-options'),'nosniff');
  assert.equal(healthRes.headers.get('x-frame-options'),'DENY');
  assert.equal(healthRes.headers.get('content-security-policy'),"frame-ancestors 'none'");
  assert.match(healthRes.headers.get('permissions-policy')||'',/camera=\(\)/);

  const root=await request('/');
  assert.equal(root.status,200);
  assert((await root.text()).includes('<title>Психологическая диагностика</title>'));

  const spa=await request('/clients/example');
  assert.equal(spa.status,200);
  assert((await spa.text()).includes('<title>Психологическая диагностика</title>'));

  for(const blocked of [
    '/server/server.js',
    '/server/data/google-drive-connections.json',
    '/server%2Fdata%2Fgoogle-drive-connections.json',
    '/.gitignore',
    '/.github/workflows/site-audit.yml',
    '/tests/roles-11d-audit.mjs',
    '/n8n/diagnostika-ai-request.json'
  ]){
    const res=await request(blocked);
    const body=await res.text();
    assert.equal(res.status,404,`Expected 404 for ${blocked}, got ${res.status}`);
    assert.equal(body.includes('SECRET_REFRESH_TOKEN_MARKER'),false);
    assert.equal(body.includes('GOOGLE_CLIENT_SECRET'),false);
  }

  const api404=await request('/api/does-not-exist');
  assert.equal(api404.status,404);
  assert.match(api404.headers.get('content-type')||'',/application\/json/);
  assert.deepEqual(await api404.json(),{error:'API route not found.'});

  const auth404=await request('/auth/does-not-exist');
  assert.equal(auth404.status,404);
  assert.equal((await auth404.text()).includes('<title>Психологическая диагностика</title>'),false);

  const evil=await request('/api/google-drive/disconnect',{
    method:'POST',
    headers:{Origin:'https://evil.example'}
  });
  assert.equal(evil.status,403);
  assert.deepEqual(await evil.json(),{error:'Origin not allowed.'});

  const sameOrigin=await request('/api/google-drive/disconnect',{
    method:'POST',
    headers:{Origin:BASE}
  });
  assert.equal(sameOrigin.status,200);
  assert.deepEqual(await sameOrigin.json(),{ok:true,connected:false});

  const malformed=await request('/api/google-drive/backup',{
    method:'POST',
    headers:{Origin:BASE,'Content-Type':'application/json'},
    body:'{"database":'
  });
  assert.equal(malformed.status,400);
  assert.deepEqual(await malformed.json(),{error:'Invalid JSON body.'});

  const status=await request('/api/google-drive/status');
  assert.equal(status.status,200);
  assert.deepEqual(await status.json(),{connected:false});
  assert.match(status.headers.get('set-cookie')||'',/diagnostika_sid=/);
  assert.match(status.headers.get('set-cookie')||'',/HttpOnly/);
  assert.match(status.headers.get('set-cookie')||'',/SameSite=Lax/);

  if(process.platform!=='win32'){
    const mode=fs.statSync(CONNECTIONS_FILE).mode&0o777;
    assert.equal(mode,0o600,`Expected token store mode 0600, got ${mode.toString(8)}`);
  }

  const corrupt='{BROKEN_CONNECTION_STORE';
  fs.writeFileSync(CONNECTIONS_FILE,corrupt,'utf8');
  const corruptStatus=await request('/api/google-drive/status');
  assert.equal(corruptStatus.status,500);
  assert.deepEqual(await corruptStatus.json(),{error:'Internal server error.'});
  assert.equal(fs.readFileSync(CONNECTIONS_FILE,'utf8'),corrupt,'Corrupted store was unexpectedly overwritten');

  console.log('SERVER_12D_SUCCESS',JSON.stringify({
    health:true,
    envFileLoaded:true,
    internalStaticBlocked:true,
    apiBoundary:true,
    authBoundary:true,
    originGuard:true,
    corruptedStoreProtected:true,
    tokenStoreMode:process.platform==='win32'?'n/a':'0600'
  }));
}finally{
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve=>child.once('exit',resolve)),
    new Promise(resolve=>setTimeout(resolve,3000))
  ]);
  try{fs.rmSync(DATA_DIR,{recursive:true,force:true});}catch{}
  try{
    if(previousEnvFile===null)fs.rmSync(ENV_FILE,{force:true});
    else fs.writeFileSync(ENV_FILE,previousEnvFile,'utf8');
  }catch{}
}

if(child.exitCode&&child.exitCode!==0){
  throw new Error(`Server exited with ${child.exitCode}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
}
