(function(){
  function displayTime(value){ var s=String(value||'').trim(); var m=s.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/); if(!m) return s; var h=Number(m[1]),min=m[2],ap=m[3]?m[3].toUpperCase():(h>=12?'PM':'AM'); if(h>12)h-=12; if(h===0)h=12; return h+':'+min+' '+ap; }
  function renderHearings(){
    var filter=window.hearingFilter||'all';
    var today=new Date(); today.setHours(0,0,0,0);
    var rows=(state.hearings||[]).map(function(h,i){return {h:h,i:i};}).filter(function(x){
      if(filter==='all') return true;
      var d=new Date(String(x.h.date||'').slice(0,10)+'T00:00:00');
      return filter==='upcoming' ? d>=today : d<today;
    });
    var html=layout('Hearings','Upcoming and past court dates and proceedings',"openModal('hearing')");
    html+='<div class="toolbar"><label class="field" style="min-width:190px"><span>Show</span><select class="filter" id="hearingFilter"><option value="all">All hearings</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select></label></div>';
    html+='<div class="panel"><table id="hearingTable"><thead><tr><th>Date</th><th>Time</th><th>Case</th><th>Client</th><th>Court</th><th>Stage</th><th>Action</th></tr></thead><tbody>';
    rows.forEach(function(x){
      var h=x.h,i=x.i,c=getHearingClient(h);
      html+='<tr><td><strong>'+fmtDate(h.date)+'</strong></td><td>'+esc(displayTime(h.time))+'</td><td><strong>'+esc(h.case)+'</strong><br><span class="muted">'+esc(h.title)+'</span></td><td>'+(c?esc(c.name):'—')+'</td><td>'+esc(h.court)+'</td><td>'+badge(h.stage)+'</td><td><button class="secondary" onclick="openEditModal(\'hearing\','+i+')">Edit</button> <button class="secondary" onclick="deleteRecord(\'hearing\','+i+')">Delete</button> <button class="secondary" onclick="sendHearingWhatsApp('+i+')">WhatsApp</button></td></tr>';
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