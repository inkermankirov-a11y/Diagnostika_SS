import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const DATA_DIR=path.join(__dirname,'data');
const CONNECTIONS_FILE=path.join(DATA_DIR,'google-drive-connections.json');
const ENV_FILE=path.join(__dirname,'.env');

function loadEnvFile(file=ENV_FILE){
  if(!fs.existsSync(file))return false;
  const text=fs.readFileSync(file,'utf8');
  for(const rawLine of text.split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line||line.startsWith('#'))continue;
    const normalized=line.startsWith('export ')?line.slice(7).trim():line;
    const i=normalized.indexOf('=');
    if(i<=0)continue;
    const key=normalized.slice(0,i).trim();
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)||process.env[key]!==undefined)continue;
    let value=normalized.slice(i+1).trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))){
      value=value.slice(1,-1);
    }
    process.env[key]=value;
  }
  return true;
}

loadEnvFile();

const PORT=Number(process.env.PORT||3000);
const PUBLIC_BASE_URL=String(process.env.PUBLIC_BASE_URL||'').replace(/\/$/,'');
const GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID||'';
const GOOGLE_CLIENT_SECRET=process.env.GOOGLE_CLIENT_SECRET||'';
const SESSION_SECRET=process.env.SESSION_SECRET||'';
const TOKEN_ENCRYPTION_KEY=process.env.TOKEN_ENCRYPTION_KEY||'';
const SECURE_COOKIE=process.env.NODE_ENV==='production';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME='Diagnostika';
const COOKIE_NAME='diagnostika_sid';
const SERVER_VERSION='12C';
const INTERNAL_STATIC_ROOTS=new Set(['server','.git','.github','tests','n8n']);

if(!Number.isInteger(PORT)||PORT<1||PORT>65535){
  throw new Error('PORT must be an integer between 1 and 65535.');
}

function validPublicBaseUrl(value){
  if(!value)return false;
  try{
    const url=new URL(value);
    return url.protocol==='http:'||url.protocol==='https:';
  }catch{
    return false;
  }
}

if(PUBLIC_BASE_URL&&!validPublicBaseUrl(PUBLIC_BASE_URL)){
  throw new Error('PUBLIC_BASE_URL must be a valid http(s) URL.');
}
if(process.env.NODE_ENV==='production'&&PUBLIC_BASE_URL&&!PUBLIC_BASE_URL.startsWith('https://')){
  throw new Error('PUBLIC_BASE_URL must use https:// in production.');
}

for(const [name,value] of Object.entries({PUBLIC_BASE_URL,GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,SESSION_SECRET,TOKEN_ENCRYPTION_KEY})){
  if(!value) console.warn(`[config] ${name} is not configured`);
}
if(TOKEN_ENCRYPTION_KEY && !/^[a-fA-F0-9]{64}$/.test(TOKEN_ENCRYPTION_KEY)){
  throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
}

const GOOGLE_OAUTH_CONFIGURED=Boolean(PUBLIC_BASE_URL&&GOOGLE_CLIENT_ID&&GOOGLE_CLIENT_SECRET&&SESSION_SECRET&&TOKEN_ENCRYPTION_KEY);
if(GOOGLE_OAUTH_CONFIGURED&&SESSION_SECRET.length<32){
  throw new Error('SESSION_SECRET must be at least 32 characters when Google OAuth is enabled.');
}

fs.mkdirSync(DATA_DIR,{recursive:true,mode:0o700});
try{fs.chmodSync(DATA_DIR,0o700);}catch{}
if(!fs.existsSync(CONNECTIONS_FILE)){
  fs.writeFileSync(CONNECTIONS_FILE,'{}',{encoding:'utf8',mode:0o600});
}
try{fs.chmodSync(CONNECTIONS_FILE,0o600);}catch{}

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);

app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(SECURE_COOKIE)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');
  next();
});

app.use(express.json({limit:'15mb',type:'application/json'}));

function firstPathSegment(reqPath){
  try{
    const decoded=decodeURIComponent(String(reqPath||'/')).replace(/\\/g,'/');
    return decoded.split('/').filter(Boolean)[0]?.toLowerCase()||'';
  }catch{
    return '';
  }
}

function internalPathBlocked(reqPath){
  const first=firstPathSegment(reqPath);
  return first.startsWith('.')||INTERNAL_STATIC_ROOTS.has(first);
}

function configuredOrigin(){
  if(!PUBLIC_BASE_URL)return '';
  try{return new URL(PUBLIC_BASE_URL).origin;}catch{return '';}
}

app.use((req,res,next)=>{
  if(internalPathBlocked(req.path))return res.status(404).type('text/plain').send('Not found');
  next();
});

app.use('/api',(req,res,next)=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
  const origin=String(req.headers.origin||'').trim();
  const allowed=configuredOrigin();
  if(!origin||!allowed)return next();
  try{
    if(new URL(origin).origin!==allowed)return res.status(403).json({error:'Origin not allowed.'});
  }catch{
    return res.status(403).json({error:'Origin not allowed.'});
  }
  next();
});

function parseCookies(req){
  const out={};
  for(const part of String(req.headers.cookie||'').split(';')){
    const i=part.indexOf('=');
    if(i<0) continue;
    const k=part.slice(0,i).trim();
    const v=part.slice(i+1).trim();
    if(k) out[k]=decodeURIComponent(v);
  }
  return out;
}
function setSidCookie(res,sid){
  const attrs=[`${COOKIE_NAME}=${encodeURIComponent(sid)}`,'Path=/','HttpOnly','SameSite=Lax','Max-Age=31536000'];
  if(SECURE_COOKIE) attrs.push('Secure');
  res.setHeader('Set-Cookie',attrs.join('; '));
}
function getOrCreateSid(req,res){
  const cookies=parseCookies(req);
  let sid=String(cookies[COOKIE_NAME]||'');
  if(!/^[a-f0-9-]{36}$/i.test(sid)){
    sid=crypto.randomUUID();
    setSidCookie(res,sid);
  }
  return sid;
}
function b64url(input){return Buffer.from(input).toString('base64url');}
function signState(payload){
  const body=b64url(JSON.stringify(payload));
  const sig=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyState(state){
  const [body,sig]=String(state||'').split('.');
  if(!body||!sig) return null;
  const expected=crypto.createHmac('sha256',SESSION_SECRET).update(body).digest();
  const actual=Buffer.from(sig,'base64url');
  if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) return null;
  const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  if(!payload?.sid || !payload?.iat || Date.now()-payload.iat>10*60*1000) return null;
  return payload;
}
function enc(text){
  if(!text) return '';
  const key=Buffer.from(TOKEN_ENCRYPTION_KEY,'hex');
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(String(text),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return [iv.toString('base64url'),tag.toString('base64url'),ciphertext.toString('base64url')].join('.');
}
function dec(value){
  if(!value) return '';
  const [ivB64,tagB64,dataB64]=String(value).split('.');
  const key=Buffer.from(TOKEN_ENCRYPTION_KEY,'hex');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivB64,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64,'base64url')),decipher.final()]).toString('utf8');
}
function loadConnections(){
  try{return JSON.parse(fs.readFileSync(CONNECTIONS_FILE,'utf8'))||{};}catch{return {};}
}
function saveConnections(data){
  const tmp=`${CONNECTIONS_FILE}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(data,null,2),{encoding:'utf8',mode:0o600});
  fs.renameSync(tmp,CONNECTIONS_FILE);
  try{fs.chmodSync(CONNECTIONS_FILE,0o600);}catch{}
}
function getConnection(sid){return loadConnections()[sid]||null;}
function putConnection(sid,value){const all=loadConnections();all[sid]=value;saveConnections(all);}
function deleteConnection(sid){const all=loadConnections();delete all[sid];saveConnections(all);}

async function tokenRequest(params){
  const res=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams(params)
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data?.error_description||data?.error||`Google token error ${res.status}`);
  return data;
}
async function refreshAccessToken(connection){
  const refreshToken=dec(connection.refreshToken);
  const data=await tokenRequest({
    client_id:GOOGLE_CLIENT_ID,
    client_secret:GOOGLE_CLIENT_SECRET,
    refresh_token:refreshToken,
    grant_type:'refresh_token'
  });
  return data.access_token;
}
async function driveFetch(accessToken,url,options={}){
  const headers=new Headers(options.headers||{});
  headers.set('Authorization',`Bearer ${accessToken}`);
  const res=await fetch(url,{...options,headers});
  if(!res.ok){
    let detail='';
    try{detail=(await res.json())?.error?.message||'';}catch{}
    throw new Error(detail||`Google Drive API ${res.status}`);
  }
  if(res.status===204) return null;
  const ct=res.headers.get('content-type')||'';
  return ct.includes('application/json')?res.json():res.text();
}
async function ensureDriveFolder(accessToken){
  const q=encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const list=await driveFetch(accessToken,`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive&pageSize=10`);
  if(list?.files?.length) return list.files[0];
  return driveFetch(accessToken,'https://www.googleapis.com/drive/v3/files?fields=id,name',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:FOLDER_NAME,mimeType:'application/vnd.google-apps.folder'})
  });
}
async function findFile(accessToken,folderId,name){
  const safe=String(name).replace(/'/g,"\\'");
  const q=encodeURIComponent(`name='${safe}' and '${folderId}' in parents and trashed=false`);
  const list=await driveFetch(accessToken,`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive&pageSize=10`);
  return list?.files?.[0]||null;
}
async function uploadJsonFile(accessToken,folderId,name,data){
  const existing=await findFile(accessToken,folderId,name);
  const boundary=`diagnostika_${crypto.randomBytes(12).toString('hex')}`;
  const metadata={name,mimeType:'application/json'};
  if(!existing) metadata.parents=[folderId];
  const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(data,null,2)}\r\n--${boundary}--`;
  const url=existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,name,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime';
  return driveFetch(accessToken,url,{
    method:existing?'PATCH':'POST',
    headers:{'Content-Type':`multipart/related; boundary=${boundary}`},
    body
  });
}
async function downloadJsonFile(accessToken,folderId,name){
  const file=await findFile(accessToken,folderId,name);
  if(!file) return null;
  const text=await driveFetch(accessToken,`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
  try{return {file,data:JSON.parse(text)};}catch{throw new Error(`${name} on Google Drive is not valid JSON.`);}
}

app.get('/auth/google',(req,res)=>{
  if(!GOOGLE_OAUTH_CONFIGURED){
    return res.status(503).send('Google OAuth is not configured on the server.');
  }
  const sid=getOrCreateSid(req,res);
  const state=signState({sid,iat:Date.now(),nonce:crypto.randomBytes(12).toString('hex')});
  const params=new URLSearchParams({
    client_id:GOOGLE_CLIENT_ID,
    redirect_uri:`${PUBLIC_BASE_URL}/auth/google/callback`,
    response_type:'code',
    scope:`openid email profile ${DRIVE_SCOPE}`,
    access_type:'offline',
    include_granted_scopes:'true',
    prompt:'consent',
    state
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/auth/google/callback',async(req,res)=>{
  try{
    if(req.query.error) throw new Error(String(req.query.error));
    const state=verifyState(req.query.state);
    if(!state) return res.status(400).send('Invalid or expired OAuth state.');
    const code=String(req.query.code||'');
    if(!code) return res.status(400).send('Google authorization code is missing.');
    setSidCookie(res,state.sid);
    const token=await tokenRequest({
      code,
      client_id:GOOGLE_CLIENT_ID,
      client_secret:GOOGLE_CLIENT_SECRET,
      redirect_uri:`${PUBLIC_BASE_URL}/auth/google/callback`,
      grant_type:'authorization_code'
    });
    const userRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`}});
    const user=await userRes.json();
    if(!userRes.ok) throw new Error('Could not read Google account profile.');
    const folder=await ensureDriveFolder(token.access_token);
    const previous=getConnection(state.sid);
    const refreshToken=token.refresh_token|| (previous?.refreshToken?dec(previous.refreshToken):'');
    if(!refreshToken) throw new Error('Google did not return a refresh token. Reconnect and grant access again.');
    putConnection(state.sid,{
      provider:'google-drive',
      googleSub:user.sub||'',
      email:user.email||'',
      name:user.name||'',
      picture:user.picture||'',
      refreshToken:enc(refreshToken),
      folderId:folder.id,
      folderName:folder.name||FOLDER_NAME,
      connectedAt:previous?.connectedAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()
    });
    res.redirect('/?google_drive=connected');
  }catch(err){
    console.error('[google callback]',err);
    res.redirect(`/?google_drive=error&message=${encodeURIComponent(err?.message||'Google OAuth error')}`);
  }
});

app.get('/api/google-drive/status',(req,res)=>{
  const sid=getOrCreateSid(req,res);
  const c=getConnection(sid);
  if(!c) return res.json({connected:false});
  res.json({connected:true,email:c.email,name:c.name,picture:c.picture,folderName:c.folderName||FOLDER_NAME,connectedAt:c.connectedAt,updatedAt:c.updatedAt});
});

app.post('/api/google-drive/disconnect',async(req,res)=>{
  const sid=getOrCreateSid(req,res);
  const c=getConnection(sid);
  if(c){
    try{
      const token=dec(c.refreshToken);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}});
    }catch(err){console.warn('[google revoke]',err?.message||err);}
    deleteConnection(sid);
  }
  res.json({ok:true,connected:false});
});

app.post('/api/google-drive/backup',async(req,res)=>{
  try{
    const sid=getOrCreateSid(req,res);
    const c=getConnection(sid);
    if(!c) return res.status(401).json({error:'Google Drive is not connected.'});
    const database=req.body?.database;
    if(!database || !Array.isArray(database.clients)) return res.status(400).json({error:'Invalid database payload.'});
    const accessToken=await refreshAccessToken(c);
    const file=await uploadJsonFile(accessToken,c.folderId,'database.json',database);
    c.updatedAt=new Date().toISOString();
    putConnection(sid,c);
    res.json({ok:true,file:{id:file.id,name:file.name,modifiedTime:file.modifiedTime},clientCount:database.clients.length});
  }catch(err){
    console.error('[google backup]',err);
    res.status(500).json({error:err?.message||'Google Drive backup failed.'});
  }
});

app.get('/api/google-drive/restore',async(req,res)=>{
  try{
    const sid=getOrCreateSid(req,res);
    const c=getConnection(sid);
    if(!c) return res.status(401).json({error:'Google Drive is not connected.'});
    const accessToken=await refreshAccessToken(c);
    const result=await downloadJsonFile(accessToken,c.folderId,'database.json');
    if(!result) return res.status(404).json({error:'database.json was not found in the Diagnostika folder.'});
    res.json({ok:true,database:result.data,file:result.file});
  }catch(err){
    console.error('[google restore]',err);
    res.status(500).json({error:err?.message||'Google Drive restore failed.'});
  }
});

app.get('/api/health',(req,res)=>res.json({
  ok:true,
  service:'diagnostika-ss',
  version:SERVER_VERSION,
  googleOAuthConfigured:GOOGLE_OAUTH_CONFIGURED
}));

app.use('/api',(req,res)=>{
  res.status(404).json({error:'API route not found.'});
});

app.use(express.static(ROOT,{
  extensions:['html'],
  dotfiles:'deny',
  fallthrough:true,
  index:false,
  setHeaders(res){
    res.setHeader('X-Content-Type-Options','nosniff');
  }
}));

app.get('*',(req,res)=>{
  if(internalPathBlocked(req.path))return res.status(404).type('text/plain').send('Not found');
  res.sendFile(path.join(ROOT,'index.html'));
});

app.use((err,req,res,next)=>{
  if(res.headersSent)return next(err);
  const status=err?.type==='entity.too.large'?413:err instanceof SyntaxError&&'body' in err?400:500;
  if(status===500)console.error('[server error]',err);
  if(req.path.startsWith('/api/')){
    return res.status(status).json({
      error:status===413?'Request body is too large.':status===400?'Invalid JSON body.':'Internal server error.'
    });
  }
  res.status(status).type('text/plain').send(status===413?'Request body is too large.':status===400?'Invalid request.':'Internal server error.');
});

const httpServer=app.listen(PORT,()=>console.log(`Diagnostika_SS server ${SERVER_VERSION} listening on :${PORT}`));

function shutdown(signal){
  console.log(`[server] ${signal}: shutting down`);
  httpServer.close(error=>{
    if(error){
      console.error('[server] shutdown error',error);
      process.exitCode=1;
    }
  });
}
process.once('SIGTERM',()=>shutdown('SIGTERM'));
process.once('SIGINT',()=>shutdown('SIGINT'));
