(function(){
  window.ADAuth={
    get:function(){try{return JSON.parse(localStorage.getItem('advocateDeskAuth')||'null')}catch(e){return null}},
    set:function(role,name,email){localStorage.setItem('advocateDeskAuth',JSON.stringify({role:role,name:name,email:email,loginAt:new Date().toISOString()}))},
    logout:function(){localStorage.removeItem('advocateDeskAuth');window.location.href='login.html'},
    require:function(){var a=this.get();if(!a){window.location.replace('login.html');return null}return a}
  };
})();
