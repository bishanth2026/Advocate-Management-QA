(function(){
  function displayTime(value){ var s=String(value||'').trim(); var m=s.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/); if(!m) return s; var h=Number(m[1]),min=m[2],ap=m[3]?m[3].toUpperCase():(h>=12?'PM':'AM'); if(h>12)h-=12; if(h===0)h=12; return h+':'+min+' '+ap; }
  function renderHearings(){
    var filter=window.hearingFilter||'all';
    var today=new Date(); today.setHours(0,0,0,0);
    var stored=(state.hearings||[]).map(function(h,i){return {h:h,i:i,stored:true};});
    // Surface case-level next hearing dates even when no separate hearing record exists.
    var derived=(state.cases||[]).filter(function(c){
      return !!c.next && !stored.some(function(x){var h=x.h;return (h.caseId&&h.caseId===c.id)||(h.caseNumber&&h.caseNumber===c.number)||h.case===c.id||h.case===c.number;});
    }).map(function(c){return {h:{date:c.next,time:c.hearingTime||'',case:c.number||c.id,title:c.title||'',court:c.court||'',stage:c.hearingStage||'Scheduled',caseId:c.id,caseNumber:c.number,clientId:c.clientId,_derivedFromCase:true},i:-1,stored:false};});
    var rows=stored.concat(derived).filter(function(x){
      if(filter==='all') return true;
      var d=new Date(String(x.h.date||'').slice(0,10)+'T00:00:00');
      return filter==='upcoming' ? d>=today : d<today;
    }).sort(function(a,b){return String(a.h.date||'').localeCompare(String(b.h.date||''));});
    var html=layout('Hearings','Upcoming and past court dates and proceedings',"openModal('hearing')");
    html+='<div class="toolbar"><label class="field" style="min-width:190px"><span>Show</span><select class="filter" id="hearingFilter"><option value="all">All hearings</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select></label></div>';
    html+='<div class="panel"><table id="hearingTable"><thead><tr><th>Date</th><th>Time</th><th>Case</th><th>Client</th><th>Court</th><th>Stage</th><th>Action</th></tr></thead><tbody>';
    rows.forEach(function(x){
      var h=x.h,i=x.i,c=getHearingClient(h)||(x.stored===false?(state.clients||[]).find(function(cl){return cl.id===h.clientId||cl.id===((state.cases||[]).find(function(cs){return cs.id===h.caseId;})||{}).clientId||cl.name===((state.cases||[]).find(function(cs){return cs.id===h.caseId;})||{}).client;}):null);
      html+='<tr data-derived-hearing="'+(x.stored?'false':'true')+'"><td><strong>'+fmtDate(h.date)+'</strong></td><td>'+esc(displayTime(h.time)||'—')+'</td><td><strong>'+esc(h.case)+'</strong><br><span class="muted">'+esc(h.title)+'</span></td><td>'+(c?esc(c.name):'—')+'</td><td>'+esc(h.court||'—')+'</td><td>'+badge(h.stage||'Scheduled')+'</td><td>'+(x.stored?'<button class="secondary" onclick="openEditModal(\\'hearing\\','+i+')">Edit</button> <button class="secondary" onclick="deleteRecord(\\'hearing\\','+i+')">Delete</button> <button class="secondary" onclick="sendHearingWhatsApp('+i+')">WhatsApp</button>':'<span class="muted">From case next hearing</span>')+'</td></tr>';
    });
    if(!rows.length) html+='<tr><td colspan="7"><div class="empty">No hearings found for this filter.</div></td></tr>';
    html+='</tbody></table></div>';
    content.innerHTML=html;
    var select=document.getElementById('hearingFilter');
    if(select){select.value=filter;select.onchange=function(){window.hearingFilter=this.value;renderHearings();};}
  }
  window.hearings=renderHearings;
  if(typeof pages!=='undefined') pages.hearings=renderHearings;
})();