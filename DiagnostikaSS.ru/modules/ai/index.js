'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const MODULE_ID='ai';

  async function install(){
    await platform.ready;
    const service=platform.services?.ai;
    if(!platform.modules||!service)throw new Error('AI module dependencies are unavailable.');

    if(!platform.modules.get(MODULE_ID)){
      platform.modules.register({
        id:MODULE_ID,
        roles:['specialist','admin'],
        async init(){
          platform.ai=service;
          platform.events?.emit('ai:ready',{
            moduleId:MODULE_ID,
            role:platform.access?.currentRole?.()||null
          });
          return service;
        },
        async destroy(){
          if(platform.ai===service)platform.ai=null;
        }
      });
    }

    await platform.modules.start(MODULE_ID);
  }

  install().catch(error=>{
    console.error('[DiagnostikaPlatform] AI module failed to initialize',error);
  });
})();
