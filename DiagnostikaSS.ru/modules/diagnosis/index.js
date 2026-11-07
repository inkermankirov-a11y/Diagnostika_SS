'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const MODULE_ID='diagnosis';

  async function install(){
    await platform.ready;
    const service=platform.services?.diagnosis;
    if(!platform.modules||!service)throw new Error('Diagnosis module dependencies are unavailable.');

    if(!platform.modules.get(MODULE_ID)){
      platform.modules.register({
        id:MODULE_ID,
        roles:['specialist','admin'],
        async init(){
          platform.diagnosis=service;
          platform.events?.emit('diagnosis:ready',{
            moduleId:MODULE_ID,
            role:platform.access?.currentRole?.()||null
          });
          return service;
        },
        async destroy(){
          if(platform.diagnosis===service)platform.diagnosis=null;
        }
      });
    }

    await platform.modules.start(MODULE_ID);
  }

  install().catch(error=>{
    console.error('[DiagnostikaPlatform] diagnosis module failed to initialize',error);
  });
})();
