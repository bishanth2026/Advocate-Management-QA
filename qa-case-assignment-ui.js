(function () {
"use strict";
const a = window.ADAuth && window.ADAuth.get();
if (!a || !a.cloudAuth || a.role !== "admin") return;
const db = window.ADAuth.client();
function install() {
 const root = document.getElementById("content");
 if (!root || !/all cases|clients\s*&\s*cases/i.test(root.innerText.slice(0,180))) return;
 root.querySelectorAll("table tbody tr").forEach(row => {
  if (row.querySelector(".qa-assign-case")) return;
  const first = row.querySelector("td");
  if (!first) return;
  const label = (first.innerText || "").trim().split("\n")[0].trim();
  const cases = window.appState && window.appState.cases || [];
  const c = cases.find(x => String(x.number || x.caseNumber || "").trim() === label);
  if (!c || !c.id) return;
  const action = row.querySelector("td:last-child");
  if (!action) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "secondary qa-assign-case"; b.textContent = "Assign Advocate";
  b.addEventListener("click", async () => {
   try {
    const r = await db.rpc("qa_list_workspace_advocates", {p_workspace_id: a.workspaceId});
    if (r.error) throw r.error;
    const ms = r.data || [];
    if (!ms.length) throw new Error("No Advocate members found in this workspace, or permission to view names is missing.");
    const choice = window.prompt("Which Advocate should be assigned to case " + label + "?\n" + ms.map((m,i)=> (i+1)+". "+(m.full_name || m.email || m.user_id)+" — "+m.role).join("\n") + "\nEnter the number:");
    if (choice === null) return;
    const n = Number(choice)-1;
    if (!Number.isInteger(n) || n<0 || n>=ms.length) throw new Error("ശരിയായ നമ്പർ നൽകുക.");
    const result = await db.rpc("assign_case_to_member",{p_workspace_id:a.workspaceId,p_case_id:String(c.id),p_user_id:ms[n].user_id});
    if (result.error) throw result.error;
    alert("Case successfully assigned to " + (ms[n].full_name || ms[n].email || "the selected advocate") + ".");
   } catch(e) { console.error(e); alert("Assignment പരാജയപ്പെട്ടു: "+(e.message||"ദയവായി വീണ്ടും ശ്രമിക്കുക")); }
  });
  action.appendChild(b);
 });
}
new MutationObserver(install).observe(document.getElementById("content"),{childList:true,subtree:true});
install();
})();