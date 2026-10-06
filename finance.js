(function(){
'use strict';
if(window.__advocateDeskFinanceCaseAutocompleteV2)return;
window.__advocateDeskFinanceCaseAutocompleteV2=true;
var mounted=new WeakMap(),active=null;
function store(){return window.appState||{};}
function s(v){return v==null?'':String(v).trim();}
function n(v){return s(v).toLowerCase().replace(/\s+/g,' ');}
function num(c){return s(c.number||c.caseNumber||c.case_no||c.caseNo||c.case_number||c.displayNumber||c.id);}
function title(c){return s(c.title||c.caseTitle||c.name||c.case_name);}
function id(c){return s(c.id||c.caseId||c.case_id||c.value||num(c));}
function label(c){return s(c.label||c.text)||[num(c),title(c)].filter(Boolean).join(' — ')||num(c);}
function modal(){var m=document.getElementById('modal'),t=document.getElementById('modalTitle');return m&&!m.classList.contains('hidden')&&t&&/invoice|finance|payment/i.test(t.textContent||'')?m:null;}
function field(m){var ls=[].slice.call(m.querySelectorAll('label'));for(var i=0;i<ls.length;i++){if(!/^\s*case\s*$/i.test(ls[i].textContent||''))continue;var fid=ls[i].htmlFor||ls[i].getAttribute('for');if(fid){var x=document.getElementById(fid);if(x)return x;}var p=ls[i].parentElement,x=p&&p.querySelector('select,input:not([type="hidden"]),textarea');if(x)return x;}return null;}
function records(original){var d=store(),a=[];['cases','caseRecords','allCases'].forEach(function(k){if(Array.isArray(d[k]))a=a.concat(d[k]);});if(original&&original.tagName==='SELECT')[].slice.call(original.options||[]).forEach(function(o){var t=s(o.textContent);if(t&&!/^select case$/i.test(t))a.push({id:o.value,number:t,label:t});});var seenLabels=new Set(),seenNumbers=new Set();return a.filter(function(c){var l=label(c),ln=n(l),cn=n(num(c));if(!l||seenLabels.has(ln)||(cn&&seenNumbers.has(cn)))return false;seenLabels.add(ln);if(cn)seenNumbers.add(cn);return true;});}
function mount(){var m=modal();if(!m)return;var body=document.getElementById('modalBody');if(!body)return;var original=field(m);if(!original||mounted.has(original))return;var parent=original.parentElement;if(!parent)return;var wrap=document.createElement('div');wrap.className='finance-case-autocomplete';wrap.style.cssText='position:relative;width:100%;';parent.insertBefore(wrap,original);wrap.appendChild(original);var isSelect=original.tagName==='SELECT',input=isSelect?document.createElement('input'):original;if(isSelect){original.style.display='none';input.type='text';input.className=original.className||'';input.placeholder='Type case number...';input.autocomplete='off';input.setAttribute('aria-autocomplete','list');input.style.cssText='width:100%;box-sizing:border-box;';wrap.appendChild(input);}else{input.autocomplete='off';input.placeholder=input.placeholder||'Type case number...';input.setAttribute('aria-autocomplete','list');}
var menu=document.createElement('div');menu.className='finance-case-results';menu.setAttribute('role','listbox');menu.style.cssText='position:fixed;display:none;z-index:2147483647;background:#fff;color:#111827;border:1px solid #cbd5e1;border-radius:8px;max-height:240px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.18);';document.body.appendChild(menu);var item={original:original,input:input,wrap:wrap,menu:menu,rows:[],index:0};mounted.set(original,item);
function position(){var r=input.getBoundingClientRect();menu.style.left=Math.max(4,r.left)+'px';menu.style.top=(r.bottom+2)+'px';menu.style.width=r.width+'px';}
function close(){menu.style.display='none';if(active===item)active=null;}
function choose(c){var wanted=id(c),text=label(c),opts=[].slice.call(original.options||[]),o=opts.find(function(x){return n(x.value)===n(wanted)||n(x.textContent)===n(text)||n(x.textContent).indexOf(n(num(c)))!==-1||n(x.value)===n(num(c));});if(!o){o=document.createElement('option');o.value=wanted||num(c);o.textContent=text;original.appendChild(o);}original.value=o.value;input.value=text;original.dispatchEvent(new Event('input',{bubbles:true}));original.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();}
function paint(){var q=n(input.value),seen=new Set(),rows=records(original).filter(function(c){return !q||n([num(c),title(c),label(c),id(c)].join(' ')).indexOf(q)!==-1;}).filter(function(c){var key=n(label(c)).replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[^a-z0-9]+/g,'');if(!key||seen.has(key))return false;seen.add(key);return true;}).slice(0,100);menu.innerHTML='';item.rows=rows;item.index=rows.length?0:-1;rows.forEach(function(c,i){var b=document.createElement('button');b.type='button';b.textContent=label(c);b.setAttribute('role','option');b.style.cssText='display:block;width:100%;padding:10px 12px;text-align:left;border:0;background:#fff;color:#111827;font:inherit;cursor:pointer;';b.addEventListener('mousedown',function(e){e.preventDefault();choose(c);});b.addEventListener('click',function(e){e.preventDefault();choose(c);});menu.appendChild(b);});position();menu.style.display=rows.length?'block':'none';active=item;}
input.addEventListener('focus',paint);input.addEventListener('click',paint);input.addEventListener('input',paint);input.addEventListener('keydown',function(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(!item.rows.length)return;e.preventDefault();item.index=e.key==='ArrowDown'?Math.min(item.index+1,item.rows.length-1):Math.max(item.index-1,0);[].slice.call(menu.children).forEach(function(b,i){b.style.background=i===item.index?'#2563eb':'#fff';b.style.color=i===item.index?'#fff':'#111827';});}else if(e.key==='Enter'){e.preventDefault();if(item.rows.length&&item.index>=0)choose(item.rows[item.index]);}else if(e.key==='Escape'){e.preventDefault();close();}});
window.addEventListener('resize',function(){if(active===item&&menu.style.display!=='none')position();});window.addEventListener('scroll',function(){if(active===item&&menu.style.display!=='none')position();},true);
}
document.addEventListener('mousedown',function(e){if(active&&!active.wrap.contains(e.target)&&!active.menu.contains(e.target)){active.menu.style.display='none';active=null;}},true);
function init(){if(!document.body)return;new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});mount();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== finance-case-before-client.js ===== */
(function(){
'use strict';
function text(v){return String(v||'').replace(/\s+/g,' ').trim().toLowerCase();}
function isLabel(el,name){return text(el.textContent||'')===name;}
function findField(body,name){
  var labels=[].slice.call(body.querySelectorAll('label'));
  for(var i=0;i<labels.length;i++){
    if(!isLabel(labels[i],name)) continue;
    var p=labels[i].parentElement;
    if(!p) continue;
    var control=p.querySelector('select,input,textarea');
    if(control) return {label:labels[i],control:control,wrapper:p};
  }
  return null;
}
function move(){
  var modal=document.getElementById('modal');
  var body=document.getElementById('modalBody');
  var title=document.getElementById('modalTitle');
  if(!modal||modal.classList.contains('hidden')||!body||!title) return;
  if(!/invoice|finance|payment/i.test(title.textContent||'')) return;
  var client=findField(body,'client');
  var kase=findField(body,'case');
  if(!client||!kase||!client.wrapper||!kase.wrapper||client.wrapper===kase.wrapper) return;
  var parent=client.wrapper.parentElement;
  if(!parent||kase.wrapper.parentElement!==parent) return;
  if(kase.wrapper.compareDocumentPosition(client.wrapper)&Node.DOCUMENT_POSITION_FOLLOWING) return;
  parent.insertBefore(kase.wrapper,client.wrapper);
}
function init(){
  var body=document.getElementById('modalBody');
  if(!body) return;
  var observer=new MutationObserver(function(){setTimeout(move,0);setTimeout(move,80);});
  observer.observe(body,{childList:true,subtree:true});
  document.addEventListener('click',function(){setTimeout(move,0);setTimeout(move,100);},true);
  document.addEventListener('input',function(){setTimeout(move,0);},true);
  move();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();

/* ===== finance-case-client-final-root-fix.js ===== */
(function(){
'use strict';
function s(v){return v==null?'':String(v).trim();}
function k(v){return s(v).toLowerCase().replace(/\s+/g,' ');}
function data(){return window.appState||{};}
function arr(n){var d=data();return Array.isArray(d[n])?d[n]:[];}
function num(c){return s(c.number||c.caseNumber||c.case_no||c.caseNo||c.case_number||c.displayNumber);}
function cid(c){return s(c.id||c.caseId||c.case_id||c.value);}
function cname(c){return s(c.name||c.clientName||c.client_name||c.fullName||c.full_name);}
function clientLink(c){return s(c.clientId||c.client_id||c.clientName||c.client_name||c.client||c.party||c.partyName);}
function modal(){var m=document.getElementById('modal'),t=document.getElementById('modalTitle');return m&&!m.classList.contains('hidden')&&t&&/invoice/i.test(t.textContent||'')?m:null;}
function caseInput(m){return m.querySelector('.finance-case-autocomplete input:not([type="hidden"])')||null;}
function caseSelect(m){return m.querySelector('.finance-case-autocomplete select')||null;}
function clientCtl(m){var d=m.querySelector('[data-finance-client-display="true"]');if(d)return {display:d,select:null};var ls=[].slice.call(m.querySelectorAll('label'));for(var i=0;i<ls.length;i++){if(!/^client(?: name)?$/i.test(s(ls[i].textContent)))continue;var p=ls[i].parentElement;return {display:p&&p.querySelector('input:not([type="hidden"])'),select:p&&p.querySelector('select')};}return {display:null,select:null};}
function findCase(m,raw){var q=k(raw),list=arr('cases').slice();var cs=caseSelect(m);if(cs)[].slice.call(cs.options||[]).forEach(function(o){if(o.value||o.textContent)list.push({id:o.value,number:s(o.textContent)});});var seen={};list=list.filter(function(c){var z=k(cid(c)+'|'+num(c));if(seen[z])return false;seen[z]=1;return true;});return list.find(function(c){return k(cid(c))===q||k(num(c))===q||k(label(c))===q;})||list.find(function(c){return k(num(c))&&k(num(c))===q;})||null;}
function findClient(c){var link=k(clientLink(c));if(!link)return null;var found=arr('clients').find(function(x){return k(s(x.id||x.clientId||x.client_id))===link||k(cname(x))===link;});return found||{id:'',name:clientLink(c)};}
function setClient(m,c){var ctl=clientCtl(m),name=cname(c)||s(c.name),id=s(c.id||c.clientId||c.client_id);if(!name)return;if(ctl.select){var o=[].slice.call(ctl.select.options||[]).find(function(x){return k(x.value)===k(id)||k(x.textContent)===k(name);});if(!o){o=document.createElement('option');o.value=id||name;o.textContent=name;ctl.select.appendChild(o);}ctl.select.value=o.value;ctl.select.dataset.selectedClientId=id;}if(ctl.display){ctl.display.value=name;ctl.display.placeholder='';ctl.display.readOnly=true;ctl.display.dataset.selectedClientId=id;ctl.display.dataset.selectedClientName=name;}}
function clearClient(m){var ctl=clientCtl(m);if(ctl.select){ctl.select.value='';ctl.select.dataset.selectedClientId='';}if(ctl.display){ctl.display.value='';ctl.display.placeholder='Select a case';delete ctl.display.dataset.selectedClientId;delete ctl.display.dataset.selectedClientName;}}
function sync(){var m=modal();if(!m)return;var ci=caseInput(m);if(!ci)return;var raw=s(ci.value);if(!raw){clearClient(m);return;}var c=findCase(m,raw);if(!c)return;var cl=findClient(c);if(!cl)return;ci.dataset.selectedCaseId=cid(c);ci.dataset.selectedCaseNumber=num(c);var cs=caseSelect(m);if(cs){cs.dataset.selectedCaseId=cid(c);cs.dataset.selectedCaseNumber=num(c);}setClient(m,cl);}
function init(){if(window.__financeCaseClientFinalRootFix)return;window.__financeCaseClientFinalRootFix=true;var run=function(){sync();setTimeout(sync,30);setTimeout(sync,150);};['input','change','click','blur'].forEach(function(ev){document.addEventListener(ev,function(e){if(e.target&&e.target.closest&&e.target.closest('.finance-case-autocomplete'))run();},true);});document.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.closest&&e.target.closest('.finance-case-autocomplete'))run();},true);new MutationObserver(run).observe(document.body,{childList:true,subtree:true});run();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
