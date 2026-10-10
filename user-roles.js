(function(){
"use strict";
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function notice(text,bad){var old=document.getElementById("qaUserRoleNotice");if(old)old.remove();var n=document.createElement("div");n.id="qaUserRoleNotice";n.setAttribute("role","status");n.style.cssText="position:fixed;right:20px;bottom:20px;z-index:10002;max-width:440px;padding:14px 18px;border-radius:12px;background:"+(bad?"#fee2e2":"#dcfce7")+";color:"+(bad?"#991b1b":"#166534")+";box-shadow:0 8px 24px #0002";n.textContent=text;document.body.appendChild(n);setTimeout(function(){n.remove()},7000)}
function close(){var m=document.getElementById("qaUserRolesModal");if(m)m.remove()}
function open(){
 var auth=window.ADAuth&&window.ADAuth.get&&window.ADAuth.get();
 if(!auth||auth.role!=="super_admin"){notice("Only the authenticated QA Super Admin can invite test users.",true);return}
 if(document.getElementById("qaUserRolesModal"))return;
 var m=document.createElement("div");m.id="qaUserRolesModal";m.style.cssText="position:fixed;inset:0;background:#0f172a88;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px";
 m.innerHTML='<section style="background:#fff;border-radius:16px;width:min(560px,100%);max-height:calc(100vh - 36px);overflow-y:auto;padding:24px;box-sizing:border-box;box-shadow:0 20px 60px #0004;color:#172033"><div style="display:flex;justify-content:space-between;gap:16px;align-items:center"><h2 style="margin:0;font-size:21px">QA Users &amp; Roles</h2><button id="qaRolesClose" type="button" style="border:0;background:#eee;border-radius:8px;padding:8px 12px">Close</button></div><p style="color:#64748b;font-size:13px;line-height:1.5">Invite a separate non-Admin account in the QA Supabase project. This does not create or modify production accounts.</p><form id="qaRolesForm"><label style="display:block;margin:12px 0 5px">Full name</label><input name="full_name" required maxlength="120" value="AdvocateDesk QA Tester" style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box"><label style="display:block;margin:12px 0 5px">Email</label><input name="email" type="email" required maxlength="254" value="bishanth2026+advocatedesk-qa@gmail.com" style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box"><label style="display:block;margin:12px 0 5px">Role</label><select name="role" required style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px"><option value="advocate">Advocate</option><option value="junior_advocate">Junior Advocate</option><option value="clerk">Clerk</option><option value="accountant">Accountant</option><option value="staff">Staff</option></select><label style="display:block;margin:12px 0 5px">Existing QA workspace</label><select name="workspace_id" required style="width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:8px"><option value="">Loading active QA workspaces…</option></select><p id="qaRolesStatus" role="status" style="font-size:13px;color:#475569"></p><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button id="qaRolesSubmit" type="submit" style="background:#1d3473;color:white;border:0;border-radius:9px;padding:11px 18px;font-weight:600">Send QA invitation</button></div></form></section>';
 document.body.appendChild(m);
 document.getElementById("qaRolesClose").onclick=close;
 loadWorkspaces(m);
 m.addEventListener("click",function(e){if(e.target===m)close()});
 document.getElementById("qaRolesForm").addEventListener("submit",async function(e){
  e.preventDefault();var form=e.currentTarget,btn=document.getElementById("qaRolesSubmit"),status=document.getElementById("qaRolesStatus");
  var data=Object.fromEntries(new FormData(form).entries());btn.disabled=true;btn.textContent="Sending…";status.textContent="Checking session and requesting QA invitation…";
  try{
   if(!window.ADAuth||!window.ADAuth.client)throw new Error("Secure QA authentication client is unavailable. Refresh and sign in again.");
   var client=window.ADAuth.client();var sr=await client.auth.getSession();if(sr.error)throw sr.error;
   var token=sr.data&&sr.data.session&&sr.data.session.access_token;if(!token)throw new Error("Your Super Admin session has expired. Sign in again.");
   var resp=await fetch("https://uqtsksgypncsbcnuanbk.supabase.co/functions/v1/advocatedesk-provision-user",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,"apikey":"sb_publishable_cK6gEEBcDOOEfpkXlgVEDQ_7EVPt-XW"},body:JSON.stringify({action:"invite_member",full_name:data.full_name,email:data.email,role:data.role,workspace_id:data.workspace_id})});
   var body={};try{body=await resp.json()}catch(_){}
   if(!resp.ok||!body.success)throw new Error(body.error||("Invitation request failed (HTTP "+resp.status+")."));
   status.textContent="Invitation accepted by QA service. Check the Gmail inbox, Spam and Promotions.";
   notice("QA invitation request succeeded. Verify email delivery before proceeding.",false);btn.textContent="Invitation requested";btn.disabled=true;
  }catch(err){status.textContent=err&&err.message?err.message:"Unexpected invitation error.";notice(status.textContent,true);btn.disabled=false;btn.textContent="Send QA invitation"}
 });
}
document.addEventListener("click",function(e){
 var tile=e.target&&e.target.closest?e.target.closest(".control-tile"):null;if(!tile)return;
 var title=tile.querySelector("strong");if(title&&/Users\s*&\s*Roles/i.test(title.textContent||"")){e.preventDefault();open()}
});

async function loadWorkspaces(modal){
 var status=document.getElementById("qaRolesStatus"),select=modal.querySelector('[name="workspace_id"]');
 try{
  if(!window.ADAuth||!window.ADAuth.client)throw new Error("Secure QA authentication client is unavailable.");
  var client=window.ADAuth.client(),sr=await client.auth.getSession(),token=sr.data&&sr.data.session&&sr.data.session.access_token;
  if(sr.error||!token)throw new Error("Super Admin session expired. Sign in again.");
  var resp=await fetch("https://uqtsksgypncsbcnuanbk.supabase.co/functions/v1/advocatedesk-provision-user",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token,"apikey":"sb_publishable_cK6gEEBcDOOEfpkXlgVEDQ_7EVPt-XW"},body:JSON.stringify({action:"list_workspaces"})});
  var body=await resp.json();if(!resp.ok)throw new Error(body.error||"Could not load workspaces.");
  select.innerHTML='<option value="">Select an existing QA workspace</option>';
  (body.workspaces||[]).forEach(function(w){var o=document.createElement("option");o.value=w.id;o.textContent=w.name+" ("+w.id.slice(0,8)+")";select.appendChild(o)});
  if(!(body.workspaces||[]).length){select.innerHTML='<option value="">No active QA workspaces found</option>';status.textContent="No active workspace is available; no invitation can be sent.";document.getElementById("qaRolesSubmit").disabled=true}
 }catch(err){select.innerHTML='<option value="">Workspace list unavailable</option>';status.textContent=err.message||"Could not load QA workspaces.";document.getElementById("qaRolesSubmit").disabled=true}
}
window.ADQAUserRoles={open:open,close:close};
})();