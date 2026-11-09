'use strict';

/*
 * Lossless, synchronous compact representation of the JSON state.
 *
 * Web Storage often counts UTF-16 code units toward its small quota. The
 * database contains large ASCII data: URLs (photos), so store UTF-8 data
 * as a reversible, 15-bit-per-code-unit sequence. The output uses only
 * printable/BMP-safe code points [0x20..0x801f], never surrogates. This
 * is a representation change, not a lossy resize of clients or photos.
 *
 * This version intentionally stores no secondary copy and never deletes
 * the previous state before the replacement write succeeds.
 */
(() => {
  if(window.DiagnostikaStateCodec)return;

  const PREFIX='DSS15V1:';
  const encoder=new TextEncoder();
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const makeHash=bytes=>{
    let hash=2166136261;
    for(let i=0;i<bytes.length;i++){
      hash^=bytes[i];
      hash=Math.imul(hash,16777619)>>>0;
    }
    return hash>>>0;
  };

  function pack(value){
    if(typeof value!=='string')throw new TypeError('State codec accepts strings');
    const bytes=encoder.encode(value);
    let acc=0,bits=0;
    const output=[];
    let chunk=[];
    for(let i=0;i<bytes.length;i++){
      acc|=bytes[i]<<bits;
      bits+=8;
      if(bits>=15){
        chunk.push(String.fromCharCode((acc&0x7fff)+32));
        acc>>>=15;
        bits-=15;
        if(chunk.length===4096){
          output.push(chunk.join(''));
          chunk=[];
        }
      }
    }
    if(bits)chunk.push(String.fromCharCode((acc&0x7fff)+32));
    if(chunk.length)output.push(chunk.join(''));
    return PREFIX+bytes.length.toString(36)+':'+makeHash(bytes).toString(36)+':'+output.join('');
  }

  function unpack(value){
    if(typeof value!=='string'||!value.startsWith(PREFIX))throw new Error('State codec format mismatch');
    const first=value.indexOf(':',PREFIX.length);
    const second=value.indexOf(':',first+1);
    if(first<0||second<0||first-PREFIX.length>14||second-first>14)throw new Error('Invalid state header');
    const lenRaw=value.slice(PREFIX.length,first);
    const hashRaw=value.slice(first+1,second);
    if(!/^[0-9a-z]+$/.test(lenRaw)||!/^[0-9a-z]+$/.test(hashRaw))throw new Error('Invalid state header fields');
    const expected=Number.parseInt(lenRaw,36);
    const checksum=Number.parseInt(hashRaw,36);
    if(!Number.isSafeInteger(expected)||expected<0||expected>1024*1024*512||!Number.isSafeInteger(checksum)||checksum<0||checksum>0xffffffff){
      throw new Error('Invalid state header size or checksum');
    }
    const charCount=Math.ceil(expected*8/15);
    if(value.length-second-1!==charCount)throw new Error('Invalid state payload length');
    const bytes=new Uint8Array(expected);
    let acc=0,bits=0,position=0;
    for(let i=second+1;i<value.length;i++){
      const unit=value.charCodeAt(i)-32;
      if(unit<0||unit>32767)throw new Error('Invalid packed state character');
      acc|=unit<<bits;
      bits+=15;
      while(bits>=8&&position<expected){
        bytes[position++]=acc&255;
        acc>>>=8;
        bits-=8;
      }
    }
    if(position!==expected||acc!==0||makeHash(bytes)!==checksum)throw new Error('Packed state integrity check failed');
    return decoder.decode(bytes);
  }

  window.DiagnostikaStateCodec=Object.freeze({
    version:1,prefix:PREFIX,pack,unpack,
    isPacked:value=>typeof value==='string'&&value.startsWith(PREFIX)
  });
})();
