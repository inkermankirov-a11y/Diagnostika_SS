'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform)return;

  const MODULE_ID='files';
  let unsubscribers=[];

  async function install(){
    await platform.ready;
    const service=platform.services?.files;
    if(!platform.modules||!service)throw new Error('Files module dependencies are unavailable.');

    if(!platform.modules.get(MODULE_ID)){
      platform.modules.register({
        id:MODULE_ID,
        roles:['specialist','admin'],
        async init(){
          platform.files=service;

          if(platform.events?.on){
            unsubscribers.push(platform.events.on('session:deleted',detail=>{
              if(detail?.sessionId)service.removeForSession(detail.sessionId,{
                clientId:detail.clientId||null,
                source:'files-session-deleted'
              }).catch(error=>console.error('[DiagnostikaPlatform] session file cleanup failed',error));
            }));
            unsubscribers.push(platform.events.on('client:purged',detail=>{
              if(detail?.clientId)service.removeForClient(detail.clientId,{
                source:'files-client-purged'
              }).catch(error=>console.error('[DiagnostikaPlatform] client file cleanup failed',error));
            }));
          }

          platform.events?.emit('files:ready',{
            moduleId:MODULE_ID,
            role:platform.access?.currentRole?.()||null
          });
          return service;
        },
        async destroy(){
          unsubscribers.forEach(fn=>{try{fn?.();}catch(_){}});
          unsubscribers=[];
          if(platform.files===service)platform.files=null;
        }
      });
    }

    await platform.modules.start(MODULE_ID);
  }

  install().catch(error=>{
    console.error('[DiagnostikaPlatform] files module failed to initialize',error);
  });
})();