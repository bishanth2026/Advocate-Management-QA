/* Global keyboard-safe focus handling. Presentation only; no record logic changed. */
(function(){
  'use strict';
  if(window.__mobileKeyboardFinalFix)return;
  window.__mobileKeyboardFinalFix=true;
  function keepVisible(el){
    if(!el || !el.closest || !el.closest('.modal-card'))return;
    var run=function(){
      try{
        var card=el.closest('.modal-card');
        var vv=window.visualViewport;
        var bottom=vv?vv.height:window.innerHeight;
        var r=el.getBoundingClientRect();
        if(r.bottom>bottom-24 || r.top<8){
          el.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
        }
        if(card)card.scrollTop+=Math.max(0,r.bottom-(bottom-24),8);
      }catch(e){try{el.scrollIntoView(false);}catch(ignore){}}
    };
    setTimeout(run,80);setTimeout(run,220);setTimeout(run,450);
  }
  document.addEventListener('focusin',function(e){keepVisible(e.target);},true);
  document.addEventListener('click',function(e){
    var el=e.target.closest&&e.target.closest('input,select,textarea');
    if(el)keepVisible(el);
  },true);
  if(window.visualViewport){
    var refresh=function(){
      var active=document.activeElement;
      if(active && active.closest && active.closest('.modal-card'))keepVisible(active);
    };
    window.visualViewport.addEventListener('resize',refresh,{passive:true});
    window.visualViewport.addEventListener('scroll',refresh,{passive:true});
  }
})();