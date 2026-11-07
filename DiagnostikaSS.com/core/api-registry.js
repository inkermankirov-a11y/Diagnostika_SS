'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||platform.api)return;

  const contracts=new Map();
  const unavailableReported=new Set();
  const RESTRICTED_ROLES=Object.freeze(['specialist','admin']);

  const BUILT_INS=Object.freeze({
    clients:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaClients',service:'clients',module:'clients',
      methods:Object.freeze(['list','current','currentId','findById','select','create','update','trashList','findDeletedById','remove','restore','purge','openDatabase'])
    }),
    requests:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaRequests',service:'requests',module:'requests',
      methods:Object.freeze(['list','get','current','currentId','active','activeId','viewed','viewedId','view','select','activate','create','update','complete','resume','remove','requestNumber','refresh'])
    }),
    diagnosis:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaDiagnosis',service:'diagnosis',module:'diagnosis',
      methods:Object.freeze(['open','snapshot','situations','getSituation','findElement','addSituation','updateSituation','removeSituation','addBelief','addFeeling','replaceFeelings','addDeep','addInstinct','updateElement','removeElement','refresh'])
    }),
    sessions:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaSessions',service:'sessions',module:'sessions',
      methods:Object.freeze(['list','get','create','update','remove','forRequest','requestId','sessionNumber','refresh'])
    }),
    files:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaFiles',service:'files',module:'files',
      methods:Object.freeze(['get','list','put','add','remove','removeForSession','removeForClient','count'])
    }),
    export:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaExport',service:'export',module:'export',
      methods:Object.freeze(['safeName','diagnosisTxt','stateBackup','download'])
    }),
    calendar:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaCalendar',service:'calendar',module:'calendar',
      methods:Object.freeze(['open','refresh','list','get','forDate','forClient','create','update','remove','replace'])
    }),
    payments:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaPayments',service:'payments',module:'payments',
      methods:Object.freeze(['request','session','updateRequest','replaceRequest','addPayment','updatePayment','removePayment','replaceSession','updateSession'])
    }),
    ai:Object.freeze({
      roles:RESTRICTED_ROLES,
      global:'DiagnostikaAI',service:'ai',module:'ai',
      methods:Object.freeze(['clientChat','sessionChat','appendClientMessage','replaceClientChat','clearClientChat','appendSessionMessage','replaceSessionChat','clearSessionChat'])
    }),
    roles:Object.freeze({
      roles:Object.freeze([]),
      global:'DiagnostikaRoles',service:null,module:null,
      methods:Object.freeze(['current','revision','settled','isKnown','permissions','can','canUseModule','set','reconcile','module','modules'])
    })
  });

  function normalize(id,definition={}){
    const key=String(id||'').trim();
    if(!key)throw new TypeError('API id is required.');
    const methods=Array.isArray(definition.methods)
      ? [...new Set(definition.methods.map(String).map(x=>x.trim()).filter(Boolean))]
      : [];
    const roles=Array.isArray(definition.roles)
      ? [...new Set(definition.roles.map(String).map(x=>x.trim()).filter(Boolean))]
      : [];
    if(!methods.length)throw new TypeError(`API ${key} must declare methods.`);
    return Object.freeze({
      id:key,
      global:String(definition.global||'').trim(),
      service:definition.service===null?null:String(definition.service||key).trim(),
      module:definition.module===null?null:String(definition.module||definition.service||key).trim(),
      roles:Object.freeze(roles),
      methods:Object.freeze(methods),
      registeredAt:Date.now()
    });
  }

  function register(id,definition={}){
    const record=normalize(id,definition);
    const existing=contracts.get(record.id);
    if(existing){
      const same=existing.global===record.global
        && existing.service===record.service
        && existing.module===record.module
        && existing.roles.join('|')===record.roles.join('|')
        && existing.methods.join('|')===record.methods.join('|');
      if(!same)throw new Error(`API contract already registered: ${record.id}`);
      return existing;
    }
    contracts.set(record.id,record);
    platform.events?.emit('api:registered',{
      id:record.id,
      global:record.global,
      service:record.service,
      module:record.module,
      roles:[...record.roles],
      methods:[...record.methods]
    });
    return record;
  }

  function contract(id){
    return contracts.get(String(id||''))||null;
  }

  function facade(id){
    const record=contract(id);
    return record?.global?window[record.global]||null:null;
  }

  function service(id){
    const record=contract(id);
    return record?.service?platform.services?.[record.service]||null:null;
  }

  function moduleRecord(id){
    const record=contract(id);
    return record?.module?platform.modules?.get?.(record.module)||null:null;
  }

  function allowed(id){
    const record=contract(id);
    if(!record)return false;
    const role=platform.access?.currentRole?.()||'specialist';
    if(record.roles.length&&!record.roles.includes(role))return false;
    if(!record.module)return true;
    const module=moduleRecord(id);
    if(!module)return true;
    return module.allowed!==false&&module.status!=='blocked';
  }

  function health(id){
    const record=contract(id);
    if(!record)return Object.freeze({id:String(id||''),status:'unknown',ready:false,missingMethods:[]});

    const api=facade(id);
    const missingMethods=record.methods.filter(name=>typeof api?.[name]!=='function');
    const module=moduleRecord(id);
    const svc=service(id);
    let status='ready';

    if(!api||api.moduleAware!==true)status='missing-facade';
    else if(missingMethods.length)status='invalid-facade';
    else if(!allowed(record.id))status='blocked';
    else if(record.service&&!svc)status='missing-service';
    else if(module&&module.status!=='started')status=module.status||'module-unavailable';

    return Object.freeze({
      id:record.id,
      status,
      ready:status==='ready',
      version:api?.version||null,
      global:record.global,
      service:record.service,
      module:record.module,
      roles:Object.freeze([...record.roles]),
      moduleStatus:module?.status||null,
      allowed:module?.allowed!==false,
      serviceAvailable:record.service?Boolean(svc):true,
      missingMethods:Object.freeze([...missingMethods])
    });
  }

  function reportUnavailable(id,method,reason){
    const key=`${id}:${method}:${reason}`;
    if(unavailableReported.has(key))return;
    unavailableReported.add(key);
    platform.events?.emit('api:unavailable',{
      id,
      method,
      reason,
      role:platform.access?.currentRole?.()||null
    });
  }

  function invokeService(id,method,args=[],fallback=null,options={}){
    const record=contract(id);
    if(!record||!record.methods.includes(method)){
      if(options.throwOnMissing)throw new Error(`Unknown API method: ${id}.${method}`);
      reportUnavailable(id,method,'unknown-method');
      return fallback;
    }
    if(!allowed(id)){
      if(options.throwOnBlocked){
        const error=new Error(`API blocked for current role: ${id}.${method}`);
        error.name='DiagnostikaAccessDeniedError';
        throw error;
      }
      reportUnavailable(id,method,'blocked');
      return fallback;
    }
    const svc=service(id);
    const fn=svc?.[method];
    if(typeof fn!=='function'){
      if(options.throwOnMissing)throw new Error(`Service method unavailable: ${id}.${method}`);
      reportUnavailable(id,method,'service-method-unavailable');
      return fallback;
    }
    try{
      return fn(...args);
    }catch(error){
      if(options.reportError!==false)platform.events?.emit('api:error',{id,method,error});
      if(options.throwOnError)throw error;
      return fallback;
    }
  }

  async function invokeServiceAsync(id,method,args=[],fallback=null,options={}){
    try{
      const value=invokeService(id,method,args,fallback,{...options,throwOnError:true,reportError:false});
      return await value;
    }catch(error){
      platform.events?.emit('api:error',{id,method,error});
      if(options.throwOnError)throw error;
      return fallback;
    }
  }

  function list(){
    return [...contracts.keys()].map(health);
  }

  function ready(){
    const rows=list();
    return Object.freeze({
      ready:rows.every(x=>x.ready||x.status==='blocked'),
      total:rows.length,
      readyCount:rows.filter(x=>x.ready).length,
      blockedCount:rows.filter(x=>x.status==='blocked').length,
      unhealthy:Object.freeze(rows.filter(x=>!x.ready&&x.status!=='blocked'))
    });
  }

  for(const [id,definition] of Object.entries(BUILT_INS))register(id,definition);

  platform.api=Object.freeze({
    version:'13D',
    moduleAware:true,
    register,
    contract,
    facade,
    service,
    module:moduleRecord,
    allowed,
    health,
    list,
    ready,
    invokeService,
    invokeServiceAsync
  });
  window.DiagnostikaAPI=platform.api;

  platform.events?.emit('api:ready',{version:'13D',contracts:contracts.size});
})();