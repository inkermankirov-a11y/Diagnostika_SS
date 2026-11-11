'use strict';

/* Session-only attachment reading. No server request or storage write. */
(() => {
  if(window.DiagnostikaSessionMaterials)return;

  const TEXT_SUFFIX=/\.(?:txt|md|csv|json|srt|vtt|log|tsv)$/i;
  const TEXT_LIMIT=220000;
  const AI_FILE_LIMIT=160000;
  const AI_TOTAL_LIMIT=200000;
  const AI_FILES_LIMIT=12;
  const IMAGE_LIMIT=3;
  const IMAGE_MAX_BYTES=1800000;
  const IMAGE_TOTAL_BYTES=3600000;
  const UTF8_BOM=[0xef,0xbb,0xbf];
  const isText=record=>TEXT_SUFFIX.test(String(record?.name||''))
    ||/^(?:text\/plain|text\/markdown|text\/csv|application\/json)(?:;|$)/i.test(String(record?.type||''));
  const isImage=record=>/^(?:image\/jpeg|image\/png|image\/webp)$/i.test(String(record?.type||''))
    ||/\.(?:jpe?g|png|webp)$/i.test(String(record?.name||''));
  const utf8Strict=()=>new TextDecoder('utf-8',{fatal:true});
  const cpDecoder=()=>new TextDecoder('windows-1251');

  // A file can already contain UTF-8 text that had previously been read
  // as Windows-1251, producing "РџСЂ..." text. Reconstruct its bytes
  // only if reverse decoding yields convincingly better Cyrillic.
  const cpByteMap=(()=>{
    const map=new Map();
    const decoded=cpDecoder().decode(Uint8Array.from({length:256},(_,i)=>i));
    for(let i=0;i<decoded.length;i++)map.set(decoded[i],i);
    return map;
  })();
  function repairMojibake(text){
    if(!/(?:[РС][^\s]){3,}/u.test(text))return null;
    const bytes=[];
    for(const char of text){
      if(!cpByteMap.has(char))return null;
      bytes.push(cpByteMap.get(char));
    }
    try{
      const repaired=utf8Strict().decode(Uint8Array.from(bytes));
      const bad=s=>(s.match(/[РС][^\s]/gu)||[]).length;
      return bad(repaired)*3+4<bad(text)?repaired:null;
    }catch(_){return null;}
  }
  function encodingLooksBroken(text){
    return (text.match(/\uFFFD/gu)||[]).length>0
      ||(text.match(/(?:[РС][\u0400-\u04ff]){3,}/gu)||[]).length>1;
  }
  function decodeBytes(bytes,mode='auto'){
    const format=mode==='windows-1251'?'windows-1251':mode==='utf-8'?'utf-8':mode==='repair'?'repair':'auto';
    if(format==='windows-1251')return {text:cpDecoder().decode(bytes),encoding:'Windows-1251'};
    if(format==='repair'){
      const raw=utf8Strict().decode(bytes);
      const repaired=repairMojibake(raw);
      return {text:repaired||raw,encoding:repaired?'Восстановленная UTF-8':'UTF-8'};
    }
    if(bytes[0]===0xff&&bytes[1]===0xfe){
      return {text:new TextDecoder('utf-16le').decode(bytes),encoding:'UTF-16 LE'};
    }
    if(bytes[0]===0xfe&&bytes[1]===0xff){
      return {text:new TextDecoder('utf-16be').decode(bytes),encoding:'UTF-16 BE'};
    }
    if(format==='utf-8')return {text:utf8Strict().decode(bytes),encoding:'UTF-8'};
    try{
      const original=utf8Strict().decode(bytes);
      const repaired=repairMojibake(original);
      if(repaired)return {text:repaired,encoding:'Восстановленная UTF-8'};
      // Valid UTF-8 is authoritative; ordinary Russian words are not a
      // reason to reinterpret the file as legacy text.
      return {text:original,encoding:'UTF-8'};
    }catch(_){
      return {text:cpDecoder().decode(bytes),encoding:'Windows-1251'};
    }
  }
  async function readText(record,mode='auto',limit=TEXT_LIMIT){
    if(!record?.blob||!isText(record))throw new Error('Вложение не является поддерживаемым текстовым файлом.');
    if(record.blob.size>4*1024*1024)throw new Error('Текстовый файл больше 4 МБ. Скачайте оригинал.');
    const bytes=new Uint8Array(await record.blob.arrayBuffer());
    const result=decodeBytes(bytes,mode);
    const text=result.text.replace(/\u0000/g,'').replace(/^\uFEFF/,'');
    return {name:String(record.name||'Текст'),text:text.slice(0,limit),
      encoding:result.encoding,truncated:text.length>limit,bytes:bytes.length,
      possiblyBroken:encodingLooksBroken(text)};
  }
  const readFile=async id=>{
    const api=window.DiagnostikaFiles;
    if(!api?.moduleAware)throw new Error('Модуль файлов недоступен.');
    return api.get(id);
  };
  const listSession=async(sessionId,clientId)=>{
    const api=window.DiagnostikaFiles;
    if(!api?.moduleAware)throw new Error('Модуль файлов недоступен.');
    const rows=await api.list({sessionId});
    // Filter by both IDs: no accidentally mixed documents from another
    // client or another session even if storage contains orphan records.
    return (Array.isArray(rows)?rows:[]).filter(r=>
      String(r.sessionId)===String(sessionId)&&String(r.clientId)===String(clientId));
  };
  async function imageData(record){
    if(!record?.blob||!isImage(record))throw new Error('Неподдерживаемый формат изображения.');
    const mime=/image\/(jpeg|png|webp)/i.test(record.blob.type)
      ?record.blob.type.toLowerCase()
      :/\.png$/i.test(record.name)?'image/png':/\.webp$/i.test(record.name)?'image/webp':'image/jpeg';
    let blob=record.blob;
    if(blob.size>IMAGE_MAX_BYTES&&typeof createImageBitmap==='function'){
      try{
        const bitmap=await createImageBitmap(blob);
        const factor=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(bitmap.width*factor));
        canvas.height=Math.max(1,Math.round(bitmap.height*factor));
        canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
        bitmap.close();
        blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.76));
      }catch(_){blob=record.blob;}
    }
    if(!blob||blob.size>IMAGE_MAX_BYTES)throw new Error('Изображение слишком большое для анализа (максимум 1,8 МБ).');
    // Keep MIME and data URL consistent even if the uploaded file had no type.
    if(!/^image\/(jpeg|png|webp)$/i.test(blob.type||''))blob=new Blob([blob],{type:mime});
    const mimeType=blob.type||mime;
    const dataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error||new Error('Не удалось прочитать изображение.'));
      reader.readAsDataURL(blob);
    });
    return {name:String(record.name||'Изображение'),mimeType,
      dataUrl,bytes:blob.size};
  }
  async function collect(sessionId,clientId){
    const attachments=await listSession(sessionId,clientId);
    const texts=[],images=[],skipped=[];
    let totalText=0,totalImages=0;
    for(const record of attachments){
      const name=String(record.name||'Вложение');
      if(isText(record)){
        if(texts.length>=AI_FILES_LIMIT||totalText>=AI_TOTAL_LIMIT){
          skipped.push({name,reason:'Достигнут лимит текстовых материалов'});continue;
        }
        try{
          const limit=Math.min(AI_FILE_LIMIT,AI_TOTAL_LIMIT-totalText);
          const read=await readText(record,'auto',limit);
          if(read.possiblyBroken)skipped.push({name,reason:'Возможная ошибка кодировки — проверьте файл вручную'});
          if(read.truncated)skipped.push({name,reason:'Текст слишком длинный: для ИИ использована только часть файла'});
          texts.push({name,content:read.text,encoding:read.encoding,
            truncated:read.truncated,source:'Вложение текущей сессии'});
          totalText+=read.text.length;
        }catch(error){skipped.push({name,reason:error?.message||'Не удалось прочитать текст'});}
        continue;
      }
      if(isImage(record)){
        if(images.length>=IMAGE_LIMIT||totalImages>=IMAGE_TOTAL_BYTES){
          skipped.push({name,reason:'Достигнут лимит изображений'});continue;
        }
        try{
          const img=await imageData(record);
          if(totalImages+img.bytes>IMAGE_TOTAL_BYTES){skipped.push({name,reason:'Слишком большой суммарный объём изображений'});continue;}
          images.push(img);totalImages+=img.bytes;
        }catch(error){skipped.push({name,reason:error?.message||'Не удалось прочитать изображение'});}
        continue;
      }
      skipped.push({name,reason:'Автоматический анализ этого формата пока не поддерживается'});
    }
    return {texts,images,skipped,count:attachments.length};
  }

  window.DiagnostikaSessionMaterials=Object.freeze({
    isText,isImage,decodeBytes,readText,readFile,listSession,collect
  });
})();