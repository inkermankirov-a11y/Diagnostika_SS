import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
const url='https://zabvenye.com/';
const fixture={version:4,clients:[{id:'synthetic',name:'Тест 😀'}]};
for(const [engine,launcher] of Object.entries({chromium,firefox,webkit})){
 const browser=await launcher.launch();
 try{
  const page=await browser.newPage({acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(url+'**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body><div class="storage-dialog"><div class="storage-actions-main"></div></div><style>[hidden]{display:none!important}</style></body>'}));
  await page.goto(url);
  await page.evaluate(data=>{
   window.__reads=0;
   window.DiagnostikaDB={readState:()=>{window.__reads++;return data;}};
   window.DiagnostikaPlatform={services:{files:{list:async()=>[{id:'file-1',clientId:'synthetic',sessionId:'s1',name:'test.txt',type:'text/plain',blob:new Blob(['synthetic attachment'],{type:'text/plain'})}]}}};
  },fixture);
  await page.addScriptTag({path:resolve('vault-crypto.js')});
  await page.addScriptTag({path:resolve('vault-backup.js')});
  await page.locator('#vaultBackupBtn').click();
  await page.locator('#vaultSecret').fill('too-short');
  await page.locator('#vaultSave').click();
  assert.match(await page.locator('#vaultStatus').innerText(),/16 до 512/);
  assert.equal(await page.evaluate(()=>window.__reads),0);
  assert.equal(await page.locator('#vaultSecret').getAttribute('aria-invalid'),'true');
  await page.locator('#vaultSecret').fill('');
  await page.locator('#vaultGenerate').click();
  const key=await page.locator('#vaultSecret').inputValue();
  assert.match(key,/^ZBV1-/);
  // Simulate a browser blocking the asynchronous automatic click.
  await page.evaluate(()=>{const a=document.querySelector('#vaultDownloadReady');a.click=()=>{};});
  await page.locator('#vaultSave').click();
  await page.locator('#vaultDownloadReady').waitFor({state:'visible',timeout:15000});
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#vaultDownloadReady').click()]);
  assert.match(download.suggestedFilename(),/^ZABVENYE-.*\.zbv$/);
  const raw=await readFile(await download.path(),'utf8');
  const decoded=await page.evaluate(async ({raw,key})=>window.DiagnostikaVaultCrypto.open(raw,key,'backup'),{raw,key});
  assert.deepEqual(decoded.state,fixture);
  assert.equal(Buffer.from(decoded.files[0].bytes,'base64').toString(),'synthetic attachment');
  assert.equal(page.url(),url);
  await page.locator('#vaultClose').click();
  assert.equal(await page.locator('#vaultSecret').inputValue(),'');
  assert.equal(await page.locator('#vaultDownloadReady').getAttribute('href'),null);
  assert.deepEqual(errors,[]);
  console.log('VAULT_DOWNLOAD_OK',engine);
 }finally{await browser.close();}
}
