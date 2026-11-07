'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const MODULE_ID='requests';

  async function install(){
    await platform.ready;
    const service=platform.services?.requests;
    if(!platform.modules||!service)throw new Error('Requests module dependencies are unavailable.');

    if(!platform.modules.get(MODULE_ID)){
      platform.modules.register({
        id:MODULE_ID,
        roles:['specialist','admin'],
        async init(){
          platform.requests=service;
          platform.events?.emit('requests:ready',{
            moduleId:MODULE_ID,
            role:platform.access?.currentRole?.()||null
          });
          return service;
        },
        async destroy(){
          if(platform.requests===service)platform.requests=null;
        }
      });
    }

    await platform.modules.start(MODULE_ID);
  }

  install().catch(error=>{
    console.error('[DiagnostikaPlatform] requests module failed to initialize',error);
  });
})();
