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

  function currentSituationId(){
    try{return typeof situationId!=='undefined'?situationId:null;}
    catch(_){return null;}
  }

  function currentSelection(){
    try{return typeof selected!=='undefined'?selected:null;}
    catch(_){return null;}
  }

  function currentMode(){
    try{return typeof mode!=='undefined'?mode:null;}
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

  function currentRequest(){
    const c=currentClient();
    const id=currentRequestId();
    if(!c||id==null||!Array.isArray(c.requests))return null;
    return c.requests.find(item=>item&&String(item.id)===String(id))||null;
  }

  function currentSituation(){
    const r=currentRequest();
    const id=currentSituationId();
    if(!r||id==null||!Array.isArray(r.situations))return null;
    return r.situations.find(item=>item&&String(item.id)===String(id))||null;
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

  function selectSituation(id){
    try{
      situationId=id??null;
      selected=null;
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell situation selection failed',error);
      return false;
    }
  }

  function clearSelection(){
    try{selected=null;return true;}
    catch(error){
      console.error('[DiagnostikaPlatform] shell selection clear failed',error);
      return false;
    }
  }

  function selectDiagnosisElement(type,id){
    try{
      if(typeof selectDiagnosisElementById!=='function')return null;
      return selectDiagnosisElementById(type,id);
    }catch(error){
      console.error('[DiagnostikaPlatform] shell diagnosis element selection failed',error);
      return null;
    }
  }

  function setMode(next){
    try{mode=next;return true;}
    catch(error){
      console.error('[DiagnostikaPlatform] shell mode update failed',error);
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

  function renderSessionsShell(){
    try{
      if(typeof renderSessions!=='function')return false;
      renderSessions();
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell session render failed',error);
      return false;
    }
  }

  function renderDiagnosisShell(){
    try{
      if(typeof renderSituationList==='function'){
        renderSituationList();
        return true;
      }
      if(typeof renderTree==='function'){
        renderTree();
        return true;
      }
      return false;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell diagnosis render failed',error);
      return false;
    }
  }

  function renderDiagnosisTreeShell(){
    try{
      if(typeof renderTree!=='function')return false;
      renderTree();
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell diagnosis tree render failed',error);
      return false;
    }
  }

  function renderModeShell(){
    try{
      if(typeof renderMode!=='function')return false;
      renderMode();
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell mode render failed',error);
      return false;
    }
  }

  function refreshDashboardShell(){
    try{
      const dashboard=window.DiagnostikaHomeDashboard;
      if(!dashboard?.refresh)return false;
      dashboard.refresh();
      return true;
    }catch(error){
      console.error('[DiagnostikaPlatform] shell dashboard refresh failed',error);
      return false;
    }
  }

  platform.shell=Object.freeze({
    state:stateRef,
    currentClient,
    currentClientId,
    currentRequestId,
    currentSituationId,
    currentSelection,
    currentMode,
    currentRequest,
    currentSituation,
    navigationSnapshot,
    selectClient,
    viewRequest,
    selectSituation,
    clearSelection,
    selectDiagnosisElement,
    setMode,
    restoreNavigation,
    renderClient:renderClientShell,
    renderRequests:renderRequestsShell,
    renderSessions:renderSessionsShell,
    renderDiagnosis:renderDiagnosisShell,
    renderDiagnosisTree:renderDiagnosisTreeShell,
    renderMode:renderModeShell,
    refreshDashboard:refreshDashboardShell
  });
})();
