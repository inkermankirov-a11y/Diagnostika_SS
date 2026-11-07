'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  function expose(){
    if(window.DiagnostikaRoles?.moduleAware===true)return window.DiagnostikaRoles;
    const access=platform.access;
    const modules=platform.modules;
    if(!access||!modules)return null;

    const facade=Object.freeze({
      version:'11D',
      moduleAware:true,
      roles:access.roles,
      current(){return access.currentRole();},
      revision(){return access.roleRevision?.()||0;},
      settled(){return access.whenSettled?.()||Promise.resolve([]);},
      isKnown(role){return access.isKnownRole?.(role)===true;},
      permissions(role){return access.permissions?.(role)||[];},
      can(permission,role){return access.can(permission,role);},
      canUseModule(id,role=access.currentRole()){
        const record=modules.get(id);
        if(!record)return false;
        return access.moduleAllowed(record.roles,role);
      },
      set(role,options={}){
        return access.setRuntimeRole(role,{
          ...options,
          source:options.source||'roles-api'
        });
      },
      async reconcile(options={}){
        return modules.reconcileAccess(access.currentRole(),{
          ...options,
          source:options.source||'roles-api-reconcile'
        });
      },
      module(id){return modules.get(id);},
      modules(){return modules.list();}
    });

    window.DiagnostikaRoles=facade;
    platform.events?.emit('roles:ready',{
      version:facade.version,
      role:facade.current()
    });
    return facade;
  }

  if(!expose()){
    Promise.resolve(platform.ready).then(expose).catch(error=>{
      console.error('[DiagnostikaPlatform] roles facade failed to initialize',error);
    });
  }
})();