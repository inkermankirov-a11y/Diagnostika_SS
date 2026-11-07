'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const MODULE_ID='calendar';

  async function install(){
    await platform.ready;
    const service=platform.services?.calendar;
    if(!platform.modules||!service)throw new Error('Calendar module dependencies are unavailable.');

    if(!platform.modules.get(MODULE_ID)){
      platform.modules.register({
        id:MODULE_ID,
        roles:['specialist','admin'],
        async init(){
          platform.calendar=service;
          platform.events?.emit('calendar:ready',{
            moduleId:MODULE_ID,
            role:platform.access?.currentRole?.()||null
          });
          return service;
        },
        async destroy(){
          if(platform.calendar===service)platform.calendar=null;
        }
      });
    }

    await platform.modules.start(MODULE_ID);
  }

  install().catch(error=>{
    console.error('[DiagnostikaPlatform] calendar module failed to initialize',error);
  });
})();