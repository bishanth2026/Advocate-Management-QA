(function(){'use strict';
var oldOpen=window.openModal,oldAdd=window.addRecord,chosenClient=null,chosenCase=null;
function data(){if(window.appState)return window.appState;try{return JSON.parse(localStorage.getItem(window.advocateDeskDataKey||'advocateDeskData')||'null')||{}}catch(e){return{}}}
function clients(){var d=data();return Array.isArray(d.clients)?d.clients:[]}
function cases(){var d=data();return Array.isArray(d.cases)?d.cases:[]}
function caseNumber(c){return c.number||c.caseNumber||c.caseNo||c.case_number||c.id||''}
function caseLabel(c){return caseNumber(c)+(c.title||c.caseTitle?' — '+(c.title||c.caseTitle):'')}
function clientLabel(c){return c.name||c.clientName||c.title||c.id||''}
function makeField(after,label,idName,listName,placeholder,items,kind){
 var f=document.createElement('div');f.className='field';
 f.innerHTML='<label for="'+idName+'">'+label+'</label><input id="'+idName+'" type="text" list="'+listName+'" autocomplete="off" placeholder="'+placeholder+'"><datalist id="'+listName+'"></datalist>';
 var dl=f.querySelector('datalist');items.forEach(function(x){var o=document.createElement('option');o.value=kind==='case'?caseLabel(x):clientLabel(x);dl.appendChild(o)});
 after.insertAdjacentElement('afterend',f);var input=f.querySelector('input');
 function resolve(){var q=input.value.trim().toLowerCase();return items.find(function(x){var label=(kind==='case'?caseLabel(x):clientLabel(x)).toLowerCase();return label===q||String(kind==='case'?caseNumber(x):x.id||'').toLowerCase()===q||String(kind==='case'?(x.title||x.caseTitle||''):x.name||'').toLowerCase()===q})||null}
 function fillClientForCase(c){
   if(kind!=='case'||!c)return;
   var all=clients(),ref=c.clientId||c.client_id||c.client||c.clientName||c.clientNameId||'';
   var found=all.find(function(x){return String(x.id||'')===String(ref)||String(x.clientId||'')===String(ref)||clientLabel(x).toLowerCase()===String(ref).toLowerCase()});
   if(!found&&c.partyName)found=all.find(function(x){return clientLabel(x).toLowerCase()===String(c.partyName).toLowerCase()});
   var ci=document.getElementById('taskClientTypeahead');
   if(found){chosenClient=found;if(ci)ci.value=clientLabel(found)}
   else if(typeof ref==='string'&&ref&&ci){ci.value=ref;chosenClient=null}
 }
 input.addEventListener('input',function(){var x=resolve();if(kind==='client')chosenClient=x;else{chosenCase=x;fillClientForCase(x)}});
 input.addEventListener('change',function(){var x=resolve();if(kind==='client')chosenClient=x;else{chosenCase=x;fillClientForCase(x)}if(x)input.value=kind==='case'?caseLabel(x):clientLabel(x)});
 return f;
}
function enhance(){
 var m=document.getElementById('modal'),t=document.getElementById('modalTitle');
 if(!m||!t||!/task/i.test(t.textContent||'')||document.getElementById('taskCaseTypeahead'))return;
 var fields=[].slice.call(m.querySelectorAll('.field'));
 var caseField=fields.find(function(f){var l=f.querySelector('label');return l&&/^case(\s*number)?$/i.test(l.textContent.trim())});
 if(!caseField)return;
 caseField.style.display='none';
 var cf=makeField(caseField,'Case Number','taskCaseTypeahead','taskCaseOptions','Type case number or title...',cases(),'case');
 makeField(cf,'Client / Party','taskClientTypeahead','taskClientOptions','Type client / party name...',clients(),'client');
}
window.openModal=function(type){var r=oldOpen.apply(this,arguments);if(type==='task'){chosenClient=null;chosenCase=null;setTimeout(enhance,60)}return r};
function persist(){try{if(typeof window.saveAdvocateDeskState==='function')window.saveAdvocateDeskState();else localStorage.setItem(window.advocateDeskDataKey||'advocateDeskData',JSON.stringify(window.appState));}catch(e){}}
function linksValid(){
 var ci=document.getElementById('taskClientTypeahead'),ca=document.getElementById('taskCaseTypeahead');
 if(ci&&ci.value.trim()&&!chosenClient){alert('Please select a valid client / party from the dropdown.');return false}
 if(ca&&ca.value.trim()&&!chosenCase){alert('Please select a valid case number from the dropdown.');return false}
 if(chosenCase&&chosenClient){
  var linked=(Array.isArray(chosenCase.clientIds)&&chosenCase.clientIds.includes(chosenClient.id))||chosenCase.clientId===chosenClient.id||String(chosenCase.client||'').toLowerCase()===String(clientLabel(chosenClient)||'').toLowerCase()||(Array.isArray(chosenCase.clients)&&chosenCase.clients.includes(clientLabel(chosenClient)));
  if(!linked){alert('Selected case is not linked to the selected client / party.');return false}
 }
 return true;
}
function applyLinks(task){
 if(!task)return;
 var ci=document.getElementById('taskClientTypeahead'),ca=document.getElementById('taskCaseTypeahead');
 if(chosenClient){task.clientId=chosenClient.id||'';task.client=clientLabel(chosenClient);task.clientName=clientLabel(chosenClient)}
 else if(ci&&!ci.value.trim()){delete task.clientId;delete task.client;delete task.clientName}
 if(chosenCase){task.caseId=chosenCase.id||chosenCase.caseId||caseNumber(chosenCase);task.caseNumber=caseNumber(chosenCase);task.caseTitle=chosenCase.title||chosenCase.caseTitle||'';task.case=caseNumber(chosenCase)}
 else if(ca&&!ca.value.trim()){delete task.caseId;delete task.caseNumber;delete task.caseTitle;task.case='—'}
}
function syncOriginalCase(){var original=document.getElementById('f2'),ca=document.getElementById('taskCaseTypeahead');if(!original)return;if(chosenCase)original.value=caseNumber(chosenCase);else if(ca&&!ca.value.trim())original.value='';}
window.addRecord=function(type){
 if(type!=='task')return oldAdd.apply(this,arguments);
 if(!linksValid())return;
 syncOriginalCase();
 var live=window.appState,before=live&&Array.isArray(live.tasks)?live.tasks.length:0;
 var r=oldAdd.apply(this,arguments);
 if(live&&Array.isArray(live.tasks)&&live.tasks.length>before){applyLinks(live.tasks[0]);persist();if(typeof navigate==='function')navigate('tasks');}
 return r;
};
var oldEdit=window.openEditModal,oldUpdate=window.updateRecord;
function prefill(index){
 var t=(data().tasks||[])[index];if(!t)return;
 var ca=document.getElementById('taskCaseTypeahead'),ci=document.getElementById('taskClientTypeahead');
 var c=cases().find(function(x){return t.caseId&&x.id===t.caseId})||cases().find(function(x){return t.case&&(x.number===t.case||x.number===t.caseNumber)});
 if(c){chosenCase=c;if(ca)ca.value=caseLabel(c)}
 var cl=clients().find(function(x){return t.clientId&&x.id===t.clientId})||clients().find(function(x){return t.client&&clientLabel(x)===t.client});
 if(!cl&&c)cl=clients().find(function(x){return x.id===c.clientId||clientLabel(x)===c.client});
 if(cl){chosenClient=cl;if(ci)ci.value=clientLabel(cl)}
}
window.openEditModal=function(type,index){
 chosenClient=null;chosenCase=null;
 var r=oldEdit.apply(this,arguments);
 if(type==='task')setTimeout(function(){enhance();prefill(index)},60);
 return r;
};
window.updateRecord=function(type,index){
 if(type!=='task')return oldUpdate.apply(this,arguments);
 if(!linksValid())return;
 syncOriginalCase();
 var task=(data().tasks||[])[index];
 var r=oldUpdate.apply(this,arguments);
 if(task){applyLinks(task);persist();if(typeof navigate==='function')navigate('tasks');}
 return r;
};
if(window.MutationObserver)new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
})();