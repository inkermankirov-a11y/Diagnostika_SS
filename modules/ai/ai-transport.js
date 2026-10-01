'use strict';

(() => {
  if(window.DiagnostikaAITransport)return;

  async function postForm(url,form){
    try{
      const response=await fetch(url,{
        method:'POST',
        body:form,
        cache:'no-store',
        credentials:'omit',
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
