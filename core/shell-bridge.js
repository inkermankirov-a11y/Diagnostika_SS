'use strict';

(() => {
  const platform=window.DiagnostikaPlatform;
  if(!platform||platform.shell)return;

  function stateRef(){
    try{return typeof state!=='undefined'&&state&&typeof state==='object'?state:null;}
    catch(_){return null;}
  }

  function currentClientId(){
    try{return typeof clientId!=='undefined'?clientId:null;}
    catch(_){return null;}
  }

  function currentRequestId(){
    try{return typeof requestId!=='undefined'?requestId:null;}
    catch(_){return null;}
  }

  function currentClient(){
    const id=currentClientId();
    const root=stateRef();
    if(root&&Array.isArray(root.clients)&&id!=null){
      const found=root.clients.find(item=>item&&String(item.id)===String(id));
      if(found)return found;
    }
    try{return typeof client==='function'?client():null;}
    catch(_){return null;}
  }

  function navigationSnapshot(){
    try{
      return Object.freeze({
        clientId:typeof clientId!=='undefined'?clientId:null,
        requestId:typeof requestId!=='undefined'?requestId:null,
        situationId:typeof situationId!=='undefined'?situationId:null,
        selected:typeof selected!=='undefined'?selected:null,
        mode:typeof mode!=='undefined'?mode:null
      });
    }catch(_){
      return Object.freeze({clientId:null,requestId:null,situationId:null,selected:null,mode:null});
    }
  }

  function selectClient(id,options={}){
    try{
      clientId=id??null;
      requestId=options.requestId??null;
      situationId=null;
      selected=null;
      if(Object.prototype.hasOwnProperty.call(options,'mode'))mode=options.mode;
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell client selection failed',error);
      return false;
    }
  }

  function viewRequest(id){
    try{
      requestId=id??null;
      situationId=null;
      selected=null;
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell request selection failed',error);
      return false;
    }
  }

  function restoreNavigation(snapshot){
    if(!snapshot||typeof snapshot!=='object')return false;
    try{
      clientId=snapshot.clientId??null;
      requestId=snapshot.requestId??null;
      situationId=snapshot.situationId??null;
      selected=snapshot.selected??null;
      if(Object.prototype.hasOwnProperty.call(snapshot,'mode')&&snapshot.mode!=null)mode=snapshot.mode;
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell navigation restore failed',error);
      return false;
    }
  }

  function renderClientShell(){
    try{
      if(typeof renderClient!=='function')return false;
      renderClient();
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell client render failed',error);
      return false;
    }
  }

  function renderRequestsShell(){
    try{
      if(typeof renderRequests!=='function')return false;
      renderRequests();
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell request render failed',error);
      return false;
    }
  }

  platform.shell=Object.freeze({
    state:stateRef,
    currentClient,
    currentClientId,
    currentRequestId,
    navigationSnapshot,
    selectClient,
    viewRequest,
    restoreNavigation,
    renderClient:renderClientShell,
    renderRequests:renderRequestsShell
  });
})();
