'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'modules/payments/ui/receipts.js'),'utf8');
const sessionEditor=fs.readFileSync(path.join(root,'modules/payments/ui/session-editor.js'),'utf8');
const paymentDialog=fs.readFileSync(path.join(root,'modules/payments/ui/payment-dialog.js'),'utf8');
const enhancements=fs.readFileSync(path.join(root,'modules/payments/ui/enhancements.js'),'utf8');
const consistency=fs.readFileSync(path.join(root,'modules/payments/ui/consistency.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

class FakeBlob{constructor(size,type='image/png',name='Чек.png'){this.size=size;this.type=type;this.name=name;}}
class FakeURL{
  constructor(input){
    const match=String(input).trim().match(/^([a-z]+):\/\/([^\/?#]+)(.*)$/i);
    if(!match)throw Error('Bad URL');
    this.protocol=match[1].toLowerCase()+':';
    this.hostname=match[2];
    this.href=match[1]+'://'+match[2]+match[3];
  }
}

function makeHarness(){
  const client={
    id:'client-1',
    requests:[{id:'r1',payment:{mode:'parts',payments:[
      {id:'p1',amount:100,receiptUrl:''},
      {id:'p2',amount:200,receiptUrl:''},
      {id:'p3',amount:300,receiptUrl:'',sessionId:'s1'}
    ]}}],
    sessions:[{id:'s1',requestId:'r1',payment:{paid:true,amount:300,receiptUrl:''}},
      {id:'s2',requestId:'r1',payment:{paid:true,amount:500,receiptUrl:''}}]
  };
  const files=new Map(),calls=[],events=[],removed=[];
  let failWrite=false,failFile=false,failAdd=false,next=0;
  const write=(row,changes)=>{
    if(failWrite)return null;
    Object.assign(row,changes);return row;
  };
  const pay={
    moduleAware:true,
    request:(id,c)=>c.requests.find(x=>x.id===id)?.payment||null,
    session:(id,c)=>c.sessions.find(x=>x.id===id)?.payment||null,
    updatePayment:(r,p,patch,opts)=>{
      calls.push({kind:'payment',r,p,patch,opts});
      return write(client.requests.find(x=>x.id===r).payment.payments.find(x=>x.id===p),patch);
    },
    updateSession:(id,patch,opts)=>{
      calls.push({kind:'session',id,patch,opts});
      return write(client.sessions.find(x=>x.id===id).payment,patch);
    },
    refresh(){}
  };
  const store={
    moduleAware:true,
    async add(blob,ctx){
      if(failFile)return null;
      const entry={id:'receipt-file-'+(++next),blob,
        name:ctx.name,type:ctx.type,clientId:ctx.clientId,sessionId:ctx.sessionId};
      files.set(entry.id,entry);return entry;
    },
    async get(id){return files.get(id)||null;},
    async remove(id){
      removed.push(id);files.delete(id);
      return true;
    }
  };
  const window={
    DiagnostikaPaymentUIContext:{currentClient:()=>client},
    DiagnostikaPayments:pay,DiagnostikaFiles:store,
    dispatchEvent:event=>events.push(event.type)
  };
  const document={
    createElement:()=>({textContent:'',style:{},classList:{toggle(){}},appendChild(){}}),
    head:{appendChild(){}}
  };
  function CustomEvent(type){this.type=type;}
  vm.runInNewContext(code,{window,document,Blob:FakeBlob,URL:FakeURL,
    CustomEvent,Date,Error,String,Number,Array,console:{warn(){}},setTimeout(){}});
  const api=window.DiagnostikaPaymentReceipts;
  return {api,client,files,calls,events,removed,
    failWrite(value){failWrite=value;},
    failFile(value){failFile=value;}
  };
}

test('a different receipt is linked to every installment, not the whole client',async()=>{
  const h=makeHarness();
  const [p1,p2]=h.client.requests[0].payment.payments;
  const a=h.api.requestRef(h.client,h.client.requests[0],p1);
  const b=h.api.requestRef(h.client,h.client.requests[0],p2);
  await h.api.putLink(a,'https://example.test/first');
  await h.api.putLink(b,'https://example.test/second');
  assert.equal(p1.receiptUrl,'https://example.test/first');
  assert.equal(p2.receiptUrl,'https://example.test/second');
  assert.equal(h.client.requests[0].payment.payments[2].receiptUrl,'');
  assert.equal(h.calls.length,2);
});

test('receipt in installment linked to a session points to the same payment record',()=>{
  const h=makeHarness();
  const ref=h.api.sessionRef(h.client,h.client.sessions[0],h.client.requests[0]);
  assert.equal(ref.kind,'request');
  assert.equal(ref.paymentId,'p3');
  const without=h.api.sessionRef(h.client,h.client.sessions[1],h.client.requests[0]);
  assert.equal(without.kind,'session');
  assert.equal(without.sessionId,'s2');
});

test('switching to per-session mode never attaches an obsolete installment receipt',()=>{
  const h=makeHarness();
  const request=h.client.requests[0];
  request.payment.mode='session';
  const ref=h.api.sessionRef(h.client,h.client.sessions[0],request);
  assert.equal(ref.kind,'session');
  assert.equal(ref.sessionId,'s1');
});

test('file receipt uses separate FileService storage and metadata in payment record',async()=>{
  const h=makeHarness();
  const ref=h.api.requestRef(h.client,h.client.requests[0],h.client.requests[0].payment.payments[0]);
  await h.api.putFile(ref,new FakeBlob(5000,'image/png','Receipt.png'));
  const pay=h.client.requests[0].payment.payments[0];
  assert.ok(pay.receiptFileId);
  assert.equal(pay.receiptUrl,'');
  assert.equal(pay.receiptFileName,'Receipt.png');
  assert.equal(h.files.get(pay.receiptFileId).sessionId,'receipt:payment:r1:p1');
  assert.equal(h.calls[0].patch.blob,undefined);
  assert.ok(h.events.includes('diagnostika:payment-receipt-saved'));
});

test('PDF and BMP are supported, unsupported formats and oversized files rejected',()=>{
  const h=makeHarness();
  assert.ok(h.api.validateFile(new FakeBlob(1024,'application/pdf','invoice.pdf')));
  assert.ok(h.api.validateFile(new FakeBlob(1024,'image/bmp','invoice.bmp')));
  assert.throws(()=>h.api.validateFile(new FakeBlob(1000,'application/javascript','script.js')),/Разрешены/);
  assert.throws(()=>h.api.validateFile(new FakeBlob(16*1024*1024,'image/png','huge.png')),/15 МБ/);
  assert.throws(()=>h.api.validateUrl('javascript:alert(1)'),/HTTP или HTTPS|https:\/\//);
});

test('failure of database write preserves old receipt and rolls back new file',async()=>{
  const h=makeHarness();
  const ref=h.api.requestRef(h.client,h.client.requests[0],h.client.requests[0].payment.payments[0]);
  await h.api.putLink(ref,'https://example.test/old');
  h.failWrite(true);
  await assert.rejects(()=>h.api.putFile(ref,new FakeBlob(1000)),/Старый чек не изменён/);
  assert.equal(h.client.requests[0].payment.payments[0].receiptUrl,'https://example.test/old');
  assert.equal(h.files.size,0);
});

test('replacing a file deletes its previous local binary only after metadata commit',async()=>{
  const h=makeHarness();
  const ref=h.api.requestRef(h.client,h.client.requests[0],h.client.requests[0].payment.payments[0]);
  await h.api.putFile(ref,new FakeBlob(1000));
  const old=h.client.requests[0].payment.payments[0].receiptFileId;
  await h.api.putFile(ref,new FakeBlob(1200,'image/jpeg','next.jpg'));
  assert.ok(!h.files.has(old));
  assert.ok(h.removed.includes(old));
  assert.equal(h.files.size,1);
  await h.api.erase(ref);
  assert.equal(h.files.size,0);
  assert.equal(h.client.requests[0].payment.payments[0].receiptFileId,'');
});

test('reference is isolated to the selected client',async()=>{
  const h=makeHarness();
  const stolen={kind:'request',clientId:'another-client',requestId:'r1',paymentId:'p1'};
  assert.equal(h.api.resolve(stolen),null);
  await assert.rejects(()=>h.api.putLink(stolen,'https://example.test/a'),/Не найден платёж/);
});

test('both payment lists, session editor and session card expose receipt actions',()=>{
  assert.match(paymentDialog,/requestRef\(c,r,pay\)/);
  assert.match(paymentDialog,/sessionRef\?\.\(c,x.session,x.request\)/);
  assert.match(sessionEditor,/receipts\.sessionRef\(c,s,linked\)/);
  assert.ok(sessionEditor.includes('installmentReceipt.hidden=!(parts&&existing)'));
  assert.match(enhancements,/receipts\.sessionRef\(c,s,r\)/);
  assert.match(consistency,/receipts\.requestRef\(c,x.request,x.pay\)/);
  assert.match(consistency,/receiptApi\.sessionRef\(currentClient\(\),item.session,item.request\)/);
});

test('receipt URL and file ID are not cleared by routine payment changes',()=>{
  assert.doesNotMatch(sessionEditor,/const next=\{\.\.\.sp,paid:!!paid,amount,receiptUrl:''/);
  assert.doesNotMatch(enhancements,/manualAmount:true,receiptUrl:''/);
  assert.doesNotMatch(consistency,/const next=\{\.\.\.sp,paid:false,note:'',receiptUrl:''/);
  assert.doesNotMatch(paymentDialog,/receiptUrl:row\.querySelector\('\.pr-receipt'\)\.value\.trim\(\)/);
});

test('clipboard paste, file input, link and cache-busting scripts are wired',()=>{
  assert.match(code,/event\.clipboardData\?\.items/);
  assert.match(code,/new File\(\[blob\]/);
  assert.match(code,/file\.type='file'/);
  assert.match(code,/saveUrl\.onclick=/);
  assert.match(code,/download\.onclick=/);
  assert.match(code,/local\-warning/);
  assert.match(index,/modules\/payments\/ui\/receipts\.js\?v=20261112-dual-receipts-1/);
});
