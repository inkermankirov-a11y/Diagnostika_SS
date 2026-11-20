'use strict';
(()=>{
  if(window.DiagnostikaVaultCrypto)return;
  const subtle=crypto.subtle,encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
  const magic='ZABVENYE-VAULT',version=1,iterations=600000;
  const random=n=>crypto.getRandomValues(new Uint8Array(n));
  function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s)}
  function unb64(s){if(typeof s!=='string')throw Error('Некорректный формат ZBV');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
  function recoveryKey(){return 'ZBV1-'+b64(random(32)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  async function derive(secret,salt){
    if(typeof secret!=='string'||secret.length<16||secret.length>512)throw Error('Ключ или пароль должен содержать от 16 до 512 символов.');
    if(/^ZBV1-[A-Za-z0-9_-]{43}$/.test(secret)){
      const raw=unb64(secret.slice(5).replace(/-/g,'+').replace(/_/g,'/')+'=');
      const key=await subtle.importKey('raw',raw,'HKDF',false,['deriveKey']);
      return subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt,info:encoder.encode('ZABVENYE Vault v1')},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    }
    const key=await subtle.importKey('raw',encoder.encode(secret),'PBKDF2',false,['deriveKey']);
    return subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function header(kind,salt,iv){return {format:magic,version,kind,kdf:'HKDF-SHA256-or-PBKDF2-SHA256-600000',cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv)}}
  async function seal(value,secret,kind='backup'){
    if(!['backup','client'].includes(kind))throw Error('Неизвестный тип данных');
    const salt=random(32),iv=random(12),h=header(kind,salt,iv),key=await derive(secret,salt);
    const data=encoder.encode(JSON.stringify(value));
    const cipher=await subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify(h)),tagLength:128},key,data);
    return JSON.stringify({...h,data:b64(new Uint8Array(cipher))});
  }
  async function open(raw,secret,kind){
    let doc;try{doc=JSON.parse(raw)}catch{throw Error('Некорректный файл ZBV')}
    if(doc?.format!==magic||doc.version!==version||!['backup','client'].includes(doc.kind)||kind&&doc.kind!==kind)throw Error('Неподдерживаемый формат ZBV');
    const salt=unb64(doc.salt),iv=unb64(doc.iv);
    if(salt.length!==32||iv.length!==12||doc.cipher!=='AES-256-GCM'||doc.kdf!=='HKDF-SHA256-or-PBKDF2-SHA256-600000')throw Error('Некорректный заголовок ZBV');
    const h=header(doc.kind,salt,iv),key=await derive(secret,salt);
    try{const data=await subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(JSON.stringify(h)),tagLength:128},key,unb64(doc.data));return JSON.parse(decoder.decode(data))}
    catch{throw Error('Неверный ключ или файл повреждён. Данные не изменены.')}
  }
  window.DiagnostikaVaultCrypto=Object.freeze({seal,open,recoveryKey,b64,unb64});
})();
