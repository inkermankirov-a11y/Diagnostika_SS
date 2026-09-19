'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const MODULE_ID='export';

  async function install(){
    await platform.ready;
    const service=platform.services?.export;
    if(!platform.modules||!service)throw new Error('Export module dependencies are unavailable.');

    if(!platform.modules.get(MODULE_ID)){
      platform.modules.register({
        id:MODULE_ID,
        roles:['specialist','admin'],
        async init(){
          platform.export=service;
          platform.events?.emit('export:ready',{
            moduleId:MODULE_ID,
            role:platform.access?.currentRole?.()||null
          });
          return service;
        },
        async destroy(){
          if(platform.export===service)platform.export=null;
        }
      });
    }
    await platform.modules.start(MODULE_ID);
  }

  install().catch(error=>{
    console.error('[DiagnostikaPlatform] export module failed to initialize',error);
  });
})();