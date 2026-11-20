'use strict';

(() => {
  if(window.DiagnostikaAITransport)return;

  async function postForm(url,form){
    try{
      const response=await fetch(location.hostname==='zabvenye.com'?'/account/api/ai/diagnosis':url,{
        method:'POST',
        body:form,
        cache:'no-store',
        credentials:location.hostname==='zabvenye.com'?'same-origin':'omit',
        redirect:'follow'
      });
      const text=await response.text();
      return {response,text,networkError:null};
    }catch(err){
      return {response:null,text:'',networkError:err};
    }
  }

  window.DiagnostikaAITransport=Object.freeze({postForm});
})();
