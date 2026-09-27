(function(){
  'use strict';
  function enhance(){
    var modal=document.getElementById('modal');
    if(!modal || modal.classList.contains('hidden')) return;
    var heading=(modal.querySelector('#modalTitle')||{}).textContent||'';
    if(!/meeting/i.test(heading) && !/schedule/i.test(modal.textContent||'')) return;
    modal.querySelectorAll('select').forEach(function(select){
      if(select.dataset.clientTypeahead==='1') return;
      var options=Array.from(select.options||[]).filter(function(o){return o.value && o.textContent.trim();});
      if(!options.length) return;
      var context=(select.name||'')+' '+(select.id||'')+' '+((select.previousElementSibling||{}).textContent||'');
      var likely=/client|party|contact|case|number/i.test(context);
      if(!likely && !options.some(function(o){return /rahman|fathima|traders|shameer|\b\d{1,6}\s*\/\s*\d{4}\b/i.test(o.textContent);})) return;
      select.dataset.clientTypeahead='1';
      var wrap=document.createElement('div'); wrap.style.position='relative'; wrap.style.width='100%';
      var input=document.createElement('input');
      input.type='text'; input.className=select.className||'';
      input.placeholder=/case|number/i.test(context)?'Type case number...':'Type client name...';
      input.autocomplete='off';
      input.value=select.options[select.selectedIndex] ? select.options[select.selectedIndex].textContent.trim() : '';
      var menu=document.createElement('div');
      menu.style.cssText='position:absolute;left:0;right:0;top:100%;z-index:9999;background:#fff;border:1px solid #d1d5db;border-radius:8px;max-height:220px;overflow:auto;display:none;box-shadow:0 8px 20px rgba(0,0,0,.12);';
      function render(){
        var q=input.value.trim().toLowerCase(); menu.innerHTML='';
        options.filter(function(o){return !q || o.textContent.trim().toLowerCase().includes(q);}).forEach(function(o){
          var item=document.createElement('button'); item.type='button'; item.textContent=o.textContent.trim();
          item.style.cssText='display:block;width:100%;text-align:left;padding:10px 12px;border:0;background:#fff;cursor:pointer;';
          item.addEventListener('click',function(){input.value=o.textContent.trim();select.value=o.value;menu.style.display='none';});
          menu.appendChild(item);
        });
        menu.style.display=menu.children.length?'block':'none';
      }
      input.addEventListener('input',function(){select.value='';render();});
      input.addEventListener('focus',render);
      document.addEventListener('click',function(e){if(!wrap.contains(e.target))menu.style.display='none';});
      wrap.appendChild(input); wrap.appendChild(menu); select.style.display='none'; select.parentNode.insertBefore(wrap,select);
    });
  }
  var observer=new MutationObserver(enhance); observer.observe(document.body,{childList:true,subtree:true}); setTimeout(enhance,100);
})();
