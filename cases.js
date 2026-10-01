

/* ===== Consolidated from cases-fix-v1.js ===== */
(function(){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const read=()=>window.appState||{};
  const write=d=>{window.appState=d;if(typeof window.saveAdvocateDeskState==='function')window.saveAdvocateDeskState();};
  const caseTypes=['Civil','Criminal','Writ','Family','Commercial','Consumer','Labour','Motor Accident','Matrimonial','Other'];
  const civilPrefixes=['OS','OP'];const criminalPrefixes=['CC','CP','ST','MC'];
  function shell(){return '<div class="page-title"><div><h1>My Cases</h1><p>Manage all your cases.</p></div><button class="primary" onclick="openModal(\'case\')">＋ Add Case</button></div><div class="panel"><div class="empty">Create and manage petitioner, respondent and victim cases from one place.</div></div>'; }
  function list(type){const d=read();const items=Array.isArray(d.caseParties)?d.caseParties.filter(x=>x.type===type):[];const label=type==='petitioner'?'Petitioner':type==='respondent'?'Respondent':'Victim';return '<div class="page-title"><div><h1>'+label+' Cases</h1><p>Manage and save '+label.toLowerCase()+' case details.</p></div><button class="primary" onclick="casesFixAdd(\''+type+'\')">＋ Add '+label+'</button></div><div class="panel"><div class="cases-toolbar"><button class="secondary" onclick="casesFixHome()">← My Cases</button><span class="cases-count">'+items.length+' record(s)</span></div>'+(items.length?'<div class="party-list">'+items.map((x,i)=>'<div class="party-row"><div><strong>'+esc(x.name)+'</strong><small>Case Type: '+esc(x.caseType||'—')+'</small><small>Case No: '+esc(x.caseNumber||'—')+' • '+esc(x.court||'—')+'</small><small>Phone: '+esc(x.phone||'—')+'</small></div><button class="secondary" onclick="casesFixEdit(\''+type+'\','+i+')">Edit</button></div>').join('')+'</div>':'<div class="empty">No '+label.toLowerCase()+' records yet. Click Add to create one.</div>')+'</div>';}
  function form(type,index){const d=read();const all=Array.isArray(d.caseParties)?d.caseParties:[];const filtered=all.filter(x=>x.type===type);const item=index>=0?filtered[index]:{};const label=type==='petitioner'?'Petitioner':type==='respondent'?'Respondent':'Victim';const val=k=>esc(item[k]||'');const options=caseTypes.map(t=>'<option value="'+esc(t)+'"'+(item.caseType===t?' selected':'')+'>'+esc(t)+'</option>').join('');const civil=item.caseType==='Civil';const criminal=item.caseType==='Criminal';const allowedPrefixes=civil?civilPrefixes:criminal?criminalPrefixes:[];const prefix=allowedPrefixes.includes(item.casePrefix)?item.casePrefix:(item.caseNumber||'').trim().split(/\s+/)[0]||allowedPrefixes[0]||'';const number=item.caseNumber?esc((item.caseNumber||'').replace(/^(OS|OP|CC|CP|ST|MC)\s*/i,'')):'';document.getElementById('content').innerHTML='<div class="page-title"><div><h1>'+(index>=0?'Edit ':'Add ')+label+'</h1><p>Enter the details and press Save.</p></div></div><div class="panel party-form"><div class="form-grid"><label>Full Name<input id="partyName" value="'+val('name')+'" required></label><label>Case Type<select id="partyCase" required onchange="casesFixCaseTypeChanged()"><option value="">Select case type</option>'+options+'</select></label><label id="caseNumberField">Case Number<div class="case-number-wrap">'+((civil||criminal)?'<select id="partyPrefix" aria-label="Case number prefix">'+allowedPrefixes.map(p=>'<option value="'+p+'"'+(prefix===p?' selected':'')+'>'+p+'</option>').join('')+'</select>':'<input id="partyPrefix" type="hidden" value="'+esc(prefix)+'">')+'<input id="partyNumber" value="'+number+'" placeholder="123/2026"></div><small class="field-help">'+(civil?'For Civil cases select OS or OP, then enter the number/year.':criminal?'For Criminal cases select CC, CP, ST or MC, then enter the number/year.':'Enter the case number, e.g. 123/2026.')+'</small></label><label>Court<input id="partyCourt" value="'+val('court')+'" placeholder="District Court, Kozhikode"></label><label>Phone<input id="partyPhone" value="'+val('phone')+'" inputmode="tel"></label><label>Email<input id="partyEmail" value="'+val('email')+'" type="email"></label><label>Address<textarea id="partyAddress" rows="3">'+val('address')+'</textarea></label><label>Case Details<textarea id="partyDetails" rows="4">'+val('details')+'</textarea></label></div><div class="form-actions"><button class="secondary" onclick="casesFixOpen(\''+type+'\')">Cancel</button><button class="primary" onclick="casesFixSave(\''+type+'\','+index+')">Save Details</button></div></div>';}
  window.casesFixCaseTypeChanged=()=>{const type=document.getElementById('partyCase').value;const field=document.getElementById('caseNumberField');if(!field)return;const current=document.getElementById('partyNumber');const existing=current?current.value:'';const oldPrefix=(document.getElementById('partyPrefix')||{}).value||'';const choices=type==='Civil'?civilPrefixes:type==='Criminal'?criminalPrefixes:[];const prefix=choices.includes(oldPrefix)?oldPrefix:(choices[0]||'');field.innerHTML='<label>Case Number</label><div class="case-number-wrap">'+(choices.length?'<select id="partyPrefix" aria-label="Case number prefix">'+choices.map(p=>'<option value="'+p+'"'+(p===prefix?' selected':'')+'>'+p+'</option>').join('')+'</select>':'<input id="partyPrefix" type="hidden" value="">')+'<input id="partyNumber" value="'+esc(existing.replace(/^(OS|OP|CC|CP|ST|MC)\s*/i,''))+'" placeholder="123/2026"></div><small class="field-help">'+(type==='Civil'?'For Civil cases select OS or OP, then enter the number/year.':type==='Criminal'?'For Criminal cases select CC, CP, ST or MC, then enter the number/year.':'Enter the case number, e.g. 123/2026.')+'</small>';};
  window.casesFixHome=()=>{document.getElementById('content').innerHTML=shell();};
  window.casesFixOpen=type=>{document.getElementById('content').innerHTML=list(type);};
  window.casesFixAdd=type=>form(type,-1);
  window.casesFixEdit=(type,index)=>form(type,index);
  window.casesFixSave=(type,index)=>{const name=document.getElementById('partyName').value.trim();const caseType=document.getElementById('partyCase').value;if(!name){alert('Please enter the full name.');return;}if(!caseType){alert('Please select the case type.');return;}const prefix=(document.getElementById('partyPrefix')||{}).value||'';const rawNumber=document.getElementById('partyNumber').value.trim();const caseNumber=(caseType==='Civil'||caseType==='Criminal')&&prefix?(prefix+' '+rawNumber).trim():rawNumber;const d=read();d.caseParties=Array.isArray(d.caseParties)?d.caseParties:[];const filtered=d.caseParties.filter(x=>x.type===type);const old=index>=0?filtered[index]:null;const record={...(old||{}),type,name,caseType,casePrefix:(caseType==='Civil'||caseType==='Criminal')?prefix:'',caseNumber,court:document.getElementById('partyCourt').value.trim(),phone:document.getElementById('partyPhone').value.trim(),email:document.getElementById('partyEmail').value.trim(),address:document.getElementById('partyAddress').value.trim(),details:document.getElementById('partyDetails').value.trim(),updatedAt:new Date().toISOString()};if(index>=0){const pos=d.caseParties.indexOf(old);d.caseParties[pos]=record;}else d.caseParties.push(record);write(d);alert('Details saved successfully.');casesFixOpen(type);};
  const style=document.createElement('style');style.textContent='.cases-home{max-width:560px;margin:24px auto;padding:24px}.case-section{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--border,#e5e7eb);padding:24px 8px;cursor:pointer}.case-section:last-child{border-bottom:0}.case-section span{display:flex;flex-direction:column;gap:6px}.case-section b{font-size:20px;color:var(--text,#111827)}.case-section small,.party-row small{display:block;color:var(--muted,#64748b);font-size:14px}.case-section strong{font-size:36px;color:#87909a;font-weight:400}.cases-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--border,#e5e7eb)}.cases-count{color:var(--muted,#64748b)}.party-list{padding:0 16px}.party-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px 0;border-bottom:1px solid var(--border,#e5e7eb)}.party-row:last-child{border-bottom:0}.party-row strong{font-size:17px}.party-form{padding:24px}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.form-grid label{display:flex;flex-direction:column;gap:7px;font-weight:600;color:var(--text,#111827)}.form-grid input,.form-grid select,.form-grid textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid var(--border,#d1d5db);border-radius:8px;font:inherit;background:var(--card,#fff);color:inherit}.form-grid label:nth-last-child(-n+2){grid-column:1/-1}.case-number-wrap{display:flex;gap:8px}.case-number-wrap select{max-width:100px}.case-number-wrap input{min-width:0;flex:1}.field-help{font-weight:400;color:var(--muted,#64748b);font-size:12px}.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}@media(max-width:700px){.form-grid{grid-template-columns:1fr}.form-grid label:nth-last-child(-n+2){grid-column:auto}.party-form{padding:16px}.case-section b{font-size:18px}}';document.head.appendChild(style);
  document.addEventListener('click',function(e){const b=e.target.closest&&e.target.closest('[data-page="cases"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(typeof window.navigate==='function'){window.navigate('cases');}casesFixHome();},true);
})();


/* ===== Consolidated from case-number-rules-v2.js ===== */
(function () {
  'use strict';
  const PREFIXES={Civil:['OS','OP'],Criminal:['CC','CP','ST','MC']};
  function cleanNumber(value){return String(value||'').replace(/^(OS|OP|CC|CP|ST|MC)\s*/i,'').trim();}
  function renderCaseNumber(){
    const type=document.getElementById('partyCase'),field=document.getElementById('caseNumberField');if(!type||!field)return;
    const selected=type.value,prefixes=PREFIXES[selected],numberInput=document.getElementById('partyNumber'),prefixInput=document.getElementById('partyPrefix'),currentNumber=cleanNumber(numberInput?numberInput.value:''),currentPrefix=prefixInput?prefixInput.value:'';
    if(!prefixes){field.innerHTML='<label>Case Number<div class="case-number-wrap"><input id="partyNumber" value="'+escapeHtml(currentNumber)+'" placeholder="123/2026"></div><small class="field-help">Enter the case number, e.g. 123/2026.</small></label>';return;}
    const prefix=prefixes.indexOf(currentPrefix)>=0?currentPrefix:prefixes[0];
    field.innerHTML='<label>Case Number<div class="case-number-wrap"><select id="partyPrefix" aria-label="Case number prefix">'+prefixes.map(function(item){return '<option value="'+item+'"'+(item===prefix?' selected':'')+'>'+item+'</option>';}).join('')+'</select><input id="partyNumber" value="'+escapeHtml(currentNumber)+'" placeholder="123/2026"></div><small class="field-help">Select the case number type, then enter the number/year.</small></label>';
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  window.casesFixCaseTypeChanged=renderCaseNumber;
  const originalSave=window.casesFixSave;
  window.casesFixSave=function(type,index){if(typeof originalSave==='function')return originalSave(type,index);};
  document.addEventListener('change',function(event){if(event.target&&event.target.id==='partyCase')renderCaseNumber();});
  renderCaseNumber();
})();


/* ===== Consolidated from case-client-typeahead.js ===== */
(function(){
  'use strict';
  var STYLE_ID='case-client-typeahead-style';
  var ROOT_CLASS='case-client-typeahead';
  function installStyles(){
    if(document.getElementById(STYLE_ID)) return;
    var s=document.createElement('style');s.id=STYLE_ID;
    s.textContent=''
      +'.'+ROOT_CLASS+'{position:relative;width:100%;font-size:16px}'
      +'.'+ROOT_CLASS+' .cct-control{min-height:112px;box-sizing:border-box;border:1px solid #cfd8e6;border-radius:10px;background:#fff;padding:8px 10px;cursor:text;transition:border-color .15s,box-shadow .15s}'
      +'.'+ROOT_CLASS+' .cct-control:focus-within{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.10)}'
      +'.'+ROOT_CLASS+' .cct-input{width:100%;box-sizing:border-box;border:0;outline:0;background:transparent;padding:3px 2px 8px;font:inherit;color:#172033}'
      +'.'+ROOT_CLASS+' .cct-input::placeholder{color:#7b8799}'
      +'.'+ROOT_CLASS+' .cct-selected{display:flex;flex-wrap:wrap;gap:6px;max-height:62px;overflow:auto}'
      +'.'+ROOT_CLASS+' .cct-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:7px;background:#eef4ff;color:#173b8f;border:1px solid #d8e4ff;font-size:13px;line-height:1.2}'
      +'.'+ROOT_CLASS+' .cct-chip button{border:0;background:transparent;color:#52627a;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 2px}'
      +'.'+ROOT_CLASS+' .cct-options{position:absolute;z-index:10020;left:0;right:0;top:calc(100% + 5px);max-height:220px;overflow:auto;background:#fff;border:1px solid #d7dfeb;border-radius:10px;box-shadow:0 12px 30px rgba(20,35,60,.16);padding:5px;display:none}'
      +'.'+ROOT_CLASS+' .cct-options.open{display:block}'
      +'.'+ROOT_CLASS+' .cct-option{display:block;width:100%;text-align:left;border:0;background:#fff;padding:10px 11px;border-radius:7px;cursor:pointer;color:#172033;font:inherit}'
      +'.'+ROOT_CLASS+' .cct-option:hover,.'+ROOT_CLASS+' .cct-option.active{background:#eef4ff}'
      +'.'+ROOT_CLASS+' .cct-option.is-selected{font-weight:600;color:#173b8f}'
      +'.'+ROOT_CLASS+' .cct-option small{display:block;color:#6b7890;font-size:12px;margin-top:2px}'
      +'.'+ROOT_CLASS+' .cct-empty{padding:10px 11px;color:#718096;font-size:13px}'
      +'.'+ROOT_CLASS+' .cct-hint{margin-top:5px;color:#718096;font-size:12px}'
      +'.'+ROOT_CLASS+' + .muted{display:none}';
    document.head.appendChild(s);
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]});}
  function enhanceSelect(select){
    if(!select || select.tagName!=='SELECT' || !select.multiple || select.id!=='f2') return;
    if(select.dataset.cctEnhanced==='1') return;
    var field=select.closest('.field');if(!field) return;
    var label=field.querySelector('label');if(!label || !/clients?\s*\/\s*parties/i.test(label.textContent||'')) return;
    installStyles();select.dataset.cctEnhanced='1';select.style.display='none';
    var root=document.createElement('div');root.className=ROOT_CLASS;
    root.innerHTML='<div class="cct-control" tabindex="-1"><input class="cct-input" type="text" autocomplete="off" placeholder="Type client / party name..."><div class="cct-selected"></div></div><div class="cct-options" role="listbox" aria-multiselectable="true"></div><div class="cct-hint">Type to search and select one or more clients / parties.</div>';
    select.insertAdjacentElement('afterend',root);
    var input=root.querySelector('.cct-input'),selectedBox=root.querySelector('.cct-selected'),optionsBox=root.querySelector('.cct-options'),activeIndex=-1;
    function options(){return Array.prototype.filter.call(select.options,function(o){return o.value;});}
    function selectedValues(){return options().filter(function(o){return o.selected}).map(function(o){return o.value});}
    function renderSelected(){var selected=options().filter(function(o){return o.selected});selectedBox.innerHTML=selected.map(function(o){return '<span class="cct-chip" data-value="'+esc(o.value)+'"><span>'+esc(o.textContent.trim())+'</span><button type="button" aria-label="Remove '+esc(o.textContent.trim())+'" data-remove="'+esc(o.value)+'">×</button></span>';}).join('');}
    function renderOptions(query){var q=String(query||'').trim().toLowerCase();var list=options().filter(function(o){return !q || o.textContent.toLowerCase().indexOf(q)!==-1});activeIndex=-1;optionsBox.innerHTML=list.length?list.map(function(o,i){var sel=o.selected?' is-selected':'';return '<button type="button" class="cct-option'+sel+'" data-value="'+esc(o.value)+'" data-index="'+i+'" role="option" aria-selected="'+(o.selected?'true':'false')+'">'+esc(o.textContent.trim())+(o.selected?' ✓':'')+'</button>';}).join(''):'<div class="cct-empty">No matching client / party found.</div>';optionsBox.classList.add('open');}
    function sync(){select.dispatchEvent(new Event('change',{bubbles:true}));renderSelected();renderOptions(input.value);}
    function choose(value){var opt=options().find(function(o){return String(o.value)===String(value)});if(!opt)return;opt.selected=!opt.selected;sync();input.value='';input.focus();}
    input.addEventListener('focus',function(){renderOptions(input.value)});input.addEventListener('input',function(){renderOptions(input.value)});
    input.addEventListener('keydown',function(e){var list=optionsBox.querySelectorAll('.cct-option');if(e.key==='ArrowDown'&&list.length){e.preventDefault();activeIndex=Math.min(activeIndex+1,list.length-1);list.forEach(function(x){x.classList.remove('active')});list[activeIndex].classList.add('active');list[activeIndex].scrollIntoView({block:'nearest'});}else if(e.key==='ArrowUp'&&list.length){e.preventDefault();activeIndex=Math.max(activeIndex-1,0);list.forEach(function(x){x.classList.remove('active')});list[activeIndex].classList.add('active');list[activeIndex].scrollIntoView({block:'nearest'});}else if(e.key==='Enter'&&activeIndex>=0&&list[activeIndex]){e.preventDefault();choose(list[activeIndex].dataset.value);}else if(e.key==='Escape'){optionsBox.classList.remove('open');}else if(e.key==='Backspace'&&!input.value){var vals=selectedValues();if(vals.length){var last=vals[vals.length-1];var opt=options().find(function(o){return o.value===last});if(opt){opt.selected=false;renderSelected();renderOptions('');input.focus();}}}});
    optionsBox.addEventListener('mousedown',function(e){var btn=e.target.closest('.cct-option');if(btn){e.preventDefault();choose(btn.dataset.value);}});
    selectedBox.addEventListener('click',function(e){var btn=e.target.closest('[data-remove]');if(!btn)return;e.preventDefault();var opt=options().find(function(o){return o.value===btn.dataset.remove});if(opt){opt.selected=false;select.dispatchEvent(new Event('change',{bubbles:true}));renderSelected();renderOptions(input.value);input.focus();}});
    root.querySelector('.cct-control').addEventListener('click',function(e){if(e.target!==input)input.focus()});
    document.addEventListener('mousedown',function(e){if(!root.contains(e.target))optionsBox.classList.remove('open');});
    renderSelected();
  }
  function scan(){var modal=document.getElementById('modal');if(!modal)return;var select=modal.querySelector('select#f2[multiple]');if(select)enhanceSelect(select);}
  if(window.MutationObserver)new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button');if(b&&/create new case|edit case|new case/i.test(document.getElementById('modalTitle')?.textContent||''))setTimeout(scan,20);},true);
  setTimeout(scan,0);
})();


/* ===== Consolidated from court-searchable-fix.js ===== */
(function(){
  'use strict';
  var courts=['District Court, Kozhikode','Additional District Court, Kozhikode','Sub Court, Kozhikode','Munsiff Court, Kozhikode','Chief Judicial Magistrate Court, Kozhikode','JFCM I Kozhikode','JFCM II Kozhikode','JFCM III Kozhikode','JFCM IV Kozhikode','JFCM V Kozhikode','JFCM VI Kozhikode','JFCM VII Kozhikode','JFCM VIII Kozhikode','JFCM IX Kozhikode','JFCM X Kozhikode','Family Court, Kozhikode','MACT, Kozhikode','Commercial Court, Kozhikode','Special Court, Kozhikode','District Court / Rent Control Appellate Authority, Kozhikode','Family Court, Vatakara','Sub Court, Vatakara','Munsiff Court, Vatakara','JFCM Court, Vatakara','MACT, Vatakara','Commercial Court, Vatakara','Sub Court, Koyilandy','Munsiff Court, Koyilandy','JFCM Court, Koyilandy','Sub Court, Perambra','Munsiff Court, Perambra','JFCM Court, Perambra','Munsiff Court, Payyoli','JFCM Court, Payyoli','Munsiff Court, Nadapuram','JFCM Court, Nadapuram','Munsiff Court, Thamarassery','JFCM Court, Thamarassery','JFCM Court, Kunnamangalam','Grama Nyayalaya, Kunnummal','Grama Nyayalaya, Koduvally'];
  var scheduled=false;
  function getList(){var list=document.getElementById('court-search-options');if(!list){list=document.createElement('datalist');list.id='court-search-options';document.body.appendChild(list);}if(list.dataset.ready==='1')return list;var seen={};courts.forEach(function(c){seen[c]=true;});document.querySelectorAll('#modal select option').forEach(function(o){var v=(o.value||o.textContent||'').trim();if(v&&!/^select court$/i.test(v)&&!/^select$/i.test(v))seen[v]=true;});Object.keys(seen).forEach(function(c){var option=document.createElement('option');option.value=c;list.appendChild(option);});list.dataset.ready='1';return list;}
  function enhance(){getList();var direct=document.getElementById('partyCourt');if(direct){direct.removeAttribute('disabled');direct.removeAttribute('readonly');direct.setAttribute('list','court-search-options');direct.placeholder='Type court name...';return;}document.querySelectorAll('#modal select').forEach(function(select){if(select.dataset.courtSearchable==='1')return;var label=select.closest('label,.form-group,.field,.form-field'),text=label?label.textContent:'';if(!/\bcourt\b/i.test(text))return;var input=document.createElement('input');input.type='text';input.name=select.name||'';input.id=select.id||'';input.className=select.className;input.value=select.value||'';input.placeholder='Type court name...';input.setAttribute('list','court-search-options');input.autocomplete='off';input.dataset.courtSearchable='1';select.parentNode.replaceChild(input,select);});}
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(function(){scheduled=false;enhance();},0);}
  function start(){schedule();var target=document.getElementById('content')||document.body;var observer=new MutationObserver(schedule);observer.observe(target,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();


/* ===== Consolidated from case-clients-top-fix.js ===== */
(function(){
  'use strict';
  function moveClientsToTop(){
    var modal=document.getElementById('modal'),title=document.getElementById('modalTitle'),body=document.getElementById('modalBody');
    if(!modal||!title||!body||modal.classList.contains('hidden'))return;
    if(!/create new case|edit case|new case/i.test((title.textContent||'').trim()))return;
    var groups=Array.prototype.slice.call(body.querySelectorAll('.form-group,.field,.form-field,.input-group')),target=null;
    groups.forEach(function(group){if(target)return;var text=(group.textContent||'').replace(/\s+/g,' ').trim();if(/all clients\s*\/\s*parties|select clients|clients\s*\/\s*parties/i.test(text))target=group;});
    if(!target)return;
    if(target.parentNode===body&&body.firstElementChild!==target)body.insertBefore(target,body.firstElementChild);
    target.classList.add('clients-parties-top');
  }
  var scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;setTimeout(function(){scheduled=false;moveClientsToTop();},0);}
  var observer=new MutationObserver(schedule);
  function start(){var body=document.getElementById('modalBody');if(body)observer.observe(body,{childList:true,subtree:true});document.addEventListener('click',schedule,true);schedule();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();


/* ===== Consolidated from rename-case-client-to-all-cases.js ===== */
(function () {
  'use strict';
  function renameCaseClient(){
    var navItem=document.querySelector('.nav-item[data-page="case-client"]');
    if(navItem){var label=navItem.querySelector('span:not(.nav-icon)');if(label&&label.textContent!=='Clients & Cases')label.textContent='Clients & Cases';}
    var pageTitle=document.querySelector('#content .page-title h1');
    if(pageTitle&&(pageTitle.textContent.trim()==='Case & Client'||pageTitle.textContent.trim()==='Clients & Cases'))pageTitle.textContent='All Cases';
  }
  function run(){renameCaseClient();}
  run();setTimeout(run,0);setTimeout(run,150);setTimeout(run,500);
  document.addEventListener('click',function(event){var item=event.target.closest&&event.target.closest('[data-page="case-client"]');if(item){setTimeout(run,20);setTimeout(run,150);}},true);
})();
