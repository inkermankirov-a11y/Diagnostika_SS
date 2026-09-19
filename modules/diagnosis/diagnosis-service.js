'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const services=platform.services||{};
  if(!platform.services)platform.services=services;
  if(services.diagnosis)return;

  const EVENTS=Object.freeze({
    updated:'diagnosis:updated',
    situationCreated:'diagnosis:situation-created',
    situationUpdated:'diagnosis:situation-updated',
    situationDeleted:'diagnosis:situation-deleted',
    elementCreated:'diagnosis:element-created',
    elementUpdated:'diagnosis:element-updated',
    elementDeleted:'diagnosis:element-deleted'
  });

  const now=()=>new Date().toISOString();
  const clone=value=>{
    if(value===undefined)return undefined;
    try{if(typeof structuredClone==='function')return structuredClone(value);}catch(_){}
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  };
  const makeId=prefix=>{
    try{if(typeof uid==='function')return uid();}catch(_){}
    try{if(crypto?.randomUUID)return crypto.randomUUID();}catch(_){}
    return prefix+'_'+Date.now()+'_'+Math.random().toString(16).slice(2);
  };

  function clientsService(){
    return platform.services?.clients||window.DiagnostikaClients||null;
  }
  function requestsService(){
    return platform.services?.requests
      ||(window.DiagnostikaRequests?.moduleAware===true?window.DiagnostikaRequests:null)
      ||null;
  }

  function resolveClient(clientRef){
    if(clientRef&&typeof clientRef==='object'){
      const id=clientRef.id;
      if(id!==undefined&&id!==null&&id!==''){
        const via=clientsService()?.findById?.(id);
        if(via)return via;
        try{
          const rows=platform.store?.clients?.()||[];
          const canonical=rows.find(c=>c&&String(c.id)===String(id));
          if(canonical)return canonical;
        }catch(_){}
      }
      return clientRef;
    }
    if(clientRef!==undefined&&clientRef!==null&&clientRef!==''){
      const via=clientsService()?.findById?.(clientRef);
      if(via)return via;
      try{
        const rows=platform.store?.clients?.()||[];
        return rows.find(c=>c&&String(c.id)===String(clientRef))||null;
      }catch(_){return null;}
    }
    const current=clientsService()?.current?.();
    if(current)return current;
    try{return platform.store?.currentClient?.()||null;}catch(_){}
    try{return typeof client==='function'?client():null;}catch(_){return null;}
  }

  function resolveRequest(requestRef,c){
    const api=requestsService();
    if(!api||!c)return null;
    if(requestRef&&typeof requestRef==='object'){
      const id=requestRef.id;
      return id!==undefined&&id!==null&&id!==''?api.get?.(id,c)||null:requestRef;
    }
    if(requestRef!==undefined&&requestRef!==null&&requestRef!=='')return api.get?.(requestRef,c)||null;
    return api.viewed?.(c)||api.active?.(c)||null;
  }

  function context(options={}){
    const c=resolveClient(options.client??options.clientId);
    const r=resolveRequest(options.request??options.requestId,c);
    return {c,r};
  }

  function situations(requestRef,clientRef){
    const c=resolveClient(clientRef);
    const r=resolveRequest(requestRef,c);
    return r&&Array.isArray(r.situations)?clone(r.situations):[];
  }

  function snapshot(requestRef,clientRef){
    const c=resolveClient(clientRef);
    const r=resolveRequest(requestRef,c);
    if(!c||!r)return null;
    return Object.freeze({
      clientId:c.id,
      requestId:r.id,
      situations:clone(Array.isArray(r.situations)?r.situations:[])
    });
  }

  function findSituationIn(list,id){
    if(id===undefined||id===null||id==='')return null;
    return list.find(s=>s&&String(s.id)===String(id))||null;
  }
  function findBeliefIn(list,id){
    for(const s of list)for(const b of s?.beliefs||[])if(b&&String(b.id)===String(id))return {s,b};
    return null;
  }
  function findFeelingIn(list,id){
    for(const s of list)for(const b of s?.beliefs||[])for(const f of b?.feelings||[])if(f&&String(f.id)===String(id))return {s,b,f};
    return null;
  }
  function findDeepIn(list,id){
    for(const s of list)for(const b of s?.beliefs||[])for(const f of b?.feelings||[])for(const d of f?.deep||[])if(d&&String(d.id)===String(id))return {s,b,f,d};
    return null;
  }
  function findInstinctIn(list,id){
    for(const s of list)for(const b of s?.beliefs||[])for(const f of b?.feelings||[])for(const d of f?.deep||[])for(const x of d?.instincts||[])if(x&&String(x.id)===String(id))return {s,b,f,d,x};
    return null;
  }

  function getSituation(id,requestRef,clientRef){
    return clone(findSituationIn(situations(requestRef,clientRef),id));
  }
  function findElement(type,id,requestRef,clientRef){
    const list=situations(requestRef,clientRef);
    const hit=type==='belief'?findBeliefIn(list,id)
      :type==='feeling'?findFeelingIn(list,id)
      :type==='deep'?findDeepIn(list,id)
      :type==='instinct'?findInstinctIn(list,id)
      :null;
    if(!hit)return null;
    return clone(type==='belief'?hit.b:type==='feeling'?hit.f:type==='deep'?hit.d:hit.x);
  }

  function fresh(type,data={}){
    let base=null;
    try{
      if(type==='situation'&&typeof newSituation==='function')base=newSituation();
      else if(type==='belief'&&typeof newBelief==='function')base=newBelief();
      else if(type==='feeling'&&typeof newFeeling==='function')base=newFeeling();
      else if(type==='deep'&&typeof newDeep==='function')base=newDeep();
      else if(type==='instinct'&&typeof newInstinct==='function')base=newInstinct();
    }catch(_){}
    if(!base){
      if(type==='situation')base={id:makeId('situation'),name:'Новая ситуация',level:5,comment:'',result:'',beliefs:[]};
      if(type==='belief')base={id:makeId('belief'),text:'',level:5,comment:'',feelings:[]};
      if(type==='feeling')base={id:makeId('feeling'),text:'',level:5,comment:'',deep:[]};
      if(type==='deep')base={id:makeId('deep'),text:'',level:5,comment:'',instincts:[]};
      if(type==='instinct')base={id:makeId('instinct'),name:'',level:5,comment:''};
    }
    const created={...clone(base),...(clone(data)||{})};
    if(!created.id)created.id=makeId(type);
    if(type==='situation'&&!Array.isArray(created.beliefs))created.beliefs=[];
    if(type==='belief'&&!Array.isArray(created.feelings))created.feelings=[];
    if(type==='feeling'&&!Array.isArray(created.deep))created.deep=[];
    if(type==='deep'&&!Array.isArray(created.instincts))created.instincts=[];
    return created;
  }

  function emit(type,detail={}){
    try{
      return platform.events?.emit?.(type,Object.freeze({
        ...detail,
        source:detail.source||'diagnosis-service',
        emittedAt:detail.emittedAt||now()
      }))||0;
    }catch(_){return 0;}
  }

  function render(){
    try{
      if(typeof renderSituationList==='function'){renderSituationList();return true;}
      if(typeof renderTree==='function'){renderTree();return true;}
    }catch(error){
      console.error('[DiagnostikaPlatform] diagnosis render failed',error);
      return false;
    }
    return true;
  }

  function commit(nextSituations,options={},eventType=EVENTS.updated,eventDetail={}){
    const {c,r}=context(options);
    const api=requestsService();
    if(!c||!r||!api?.update||!Array.isArray(nextSituations))return null;
    const updated=api.update(r.id,{situations:clone(nextSituations)},{
      client:c,
      source:options.source||'diagnosis-service',
      render:false
    });
    if(!updated)return null;
    if(options.render!==false)render();
    emit(eventType,{
      clientId:c.id,
      requestId:r.id,
      ...eventDetail,
      source:options.source||'diagnosis-service'
    });
    if(eventType!==EVENTS.updated)emit(EVENTS.updated,{
      clientId:c.id,
      requestId:r.id,
      change:eventDetail.change||eventType,
      source:options.source||'diagnosis-service'
    });
    return updated;
  }

  function addSituation(data={},options={}){
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const created=fresh('situation',data);
    if(findSituationIn(next,created.id))return null;
    next.push(created);
    if(!commit(next,options,EVENTS.situationCreated,{situationId:created.id,change:'created'}))return null;
    return clone(created);
  }

  function updateSituation(id,changes={},options={}){
    const {r}=context(options);if(!r||!changes||typeof changes!=='object')return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const target=findSituationIn(next,id);if(!target)return null;
    const patch=clone(changes)||{};delete patch.id;delete patch.beliefs;
    Object.assign(target,patch);
    if(!commit(next,options,EVENTS.situationUpdated,{situationId:target.id,fields:Object.keys(patch),change:'updated'}))return null;
    return clone(target);
  }

  function removeSituation(id,options={}){
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const index=next.findIndex(s=>s&&String(s.id)===String(id));if(index<0)return null;
    const [removed]=next.splice(index,1);
    if(!commit(next,options,EVENTS.situationDeleted,{situationId:removed.id,change:'deleted'}))return null;
    return clone(removed);
  }

  function addBelief(situationId,data={},options={}){
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const s=findSituationIn(next,situationId);if(!s)return null;
    if(!Array.isArray(s.beliefs))s.beliefs=[];
    const created=fresh('belief',data);s.beliefs.push(created);
    if(!commit(next,options,EVENTS.elementCreated,{type:'belief',elementId:created.id,situationId:s.id,change:'created'}))return null;
    return clone(created);
  }

  function addFeeling(beliefId,data={},options={}){
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const hit=findBeliefIn(next,beliefId);if(!hit)return null;
    if(!Array.isArray(hit.b.feelings))hit.b.feelings=[];
    const created=fresh('feeling',data);hit.b.feelings.push(created);
    if(!commit(next,options,EVENTS.elementCreated,{type:'feeling',elementId:created.id,situationId:hit.s.id,parentId:hit.b.id,change:'created'}))return null;
    return clone(created);
  }

  function replaceFeelings(beliefId,feelings=[],options={}){
    if(!Array.isArray(feelings))return null;
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const hit=findBeliefIn(next,beliefId);if(!hit)return null;
    hit.b.feelings=clone(feelings)||[];
    if(!commit(next,options,EVENTS.elementUpdated,{
      type:'feeling-collection',
      elementId:hit.b.id,
      situationId:hit.s.id,
      fields:['feelings'],
      change:'replaced'
    }))return null;
    return clone(hit.b.feelings);
  }

  function addDeep(feelingId,data={},options={}){
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const hit=findFeelingIn(next,feelingId);if(!hit)return null;
    if(!Array.isArray(hit.f.deep))hit.f.deep=[];
    const created=fresh('deep',data);hit.f.deep.push(created);
    if(!commit(next,options,EVENTS.elementCreated,{type:'deep',elementId:created.id,situationId:hit.s.id,parentId:hit.f.id,change:'created'}))return null;
    return clone(created);
  }

  function addInstinct(deepId,data={},options={}){
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const hit=findDeepIn(next,deepId);if(!hit)return null;
    if(!Array.isArray(hit.d.instincts))hit.d.instincts=[];
    const created=fresh('instinct',data);hit.d.instincts.push(created);
    if(!commit(next,options,EVENTS.elementCreated,{type:'instinct',elementId:created.id,situationId:hit.s.id,parentId:hit.d.id,change:'created'}))return null;
    return clone(created);
  }

  function elementHit(type,list,id){
    return type==='belief'?findBeliefIn(list,id)
      :type==='feeling'?findFeelingIn(list,id)
      :type==='deep'?findDeepIn(list,id)
      :type==='instinct'?findInstinctIn(list,id)
      :null;
  }
  function hitObject(type,hit){
    return type==='belief'?hit?.b:type==='feeling'?hit?.f:type==='deep'?hit?.d:type==='instinct'?hit?.x:null;
  }
  function hitArray(type,hit){
    if(type==='belief')return hit?.s?.beliefs;
    if(type==='feeling')return hit?.b?.feelings;
    if(type==='deep')return hit?.f?.deep;
    if(type==='instinct')return hit?.d?.instincts;
    return null;
  }

  function updateElement(type,id,changes={},options={}){
    if(!['belief','feeling','deep','instinct'].includes(type)||!changes||typeof changes!=='object')return null;
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const hit=elementHit(type,next,id),target=hitObject(type,hit);if(!target)return null;
    const patch=clone(changes)||{};delete patch.id;
    delete patch.feelings;delete patch.deep;delete patch.instincts;
    Object.assign(target,patch);
    if(!commit(next,options,EVENTS.elementUpdated,{type,elementId:target.id,situationId:hit.s?.id||null,fields:Object.keys(patch),change:'updated'}))return null;
    return clone(target);
  }

  function removeElement(type,id,options={}){
    if(!['belief','feeling','deep','instinct'].includes(type))return null;
    const {r}=context(options);if(!r)return null;
    const next=clone(Array.isArray(r.situations)?r.situations:[])||[];
    const hit=elementHit(type,next,id),target=hitObject(type,hit),arr=hitArray(type,hit);
    if(!target||!Array.isArray(arr))return null;
    const index=arr.findIndex(x=>x&&String(x.id)===String(id));if(index<0)return null;
    const [removed]=arr.splice(index,1);
    if(!commit(next,options,EVENTS.elementDeleted,{type,elementId:removed.id,situationId:hit.s?.id||null,change:'deleted'}))return null;
    return clone(removed);
  }

  services.diagnosis=Object.freeze({
    events:EVENTS,
    snapshot,
    situations,
    getSituation,
    findElement,
    addSituation,
    updateSituation,
    removeSituation,
    addBelief,
    addFeeling,
    replaceFeelings,
    addDeep,
    addInstinct,
    updateElement,
    removeElement,
    refresh:render
  });
})();
