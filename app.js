/* AdvocateDesk build 2026-09-26-17: client search + stable SPA refresh */
const auth=ADAuth.require();
if(!auth){throw new Error('Authentication required');}
const seed = {
  cases:[
    {id:"CS-2026-001",number:"OS 145/2026",title:"Rahman v. State",client:"Abdul Rahman",court:"District Court, Kozhikode",next:"2026-09-08",status:"Active",type:"Civil"},
    {id:"CS-2026-002",number:"CC 88/2026",title:"Fathima v. Kareem",client:"Fathima P.",court:"JMFC Court II",next:"2026-09-10",status:"Pending",type:"Criminal"},
    {id:"CS-2026-003",number:"WP 422/2026",title:"ABC Traders v. State",client:"ABC Traders",court:"High Court of Kerala",next:"2026-09-15",status:"Active",type:"Writ"},
    {id:"CS-2026-004",number:"OP 71/2025",title:"Shameer v. Amina",client:"Shameer K.",court:"Family Court",next:"2026-09-18",status:"Reserved",type:"Family"}
  ],
  clients:[
    {id:"CL-001",name:"Abdul Rahman",phone:"9876543210",email:"rahman@example.com",role:"Petitioner",cases:1,status:"Active"},
    {id:"CL-002",name:"Fathima P.",phone:"9895001122",email:"fathima@example.com",role:"Respondent",cases:1,status:"Active"},
    {id:"CL-003",name:"ABC Traders",phone:"9847002211",email:"office@abctraders.example",role:"Petitioner",cases:1,status:"Active"},
    {id:"CL-004",name:"Shameer K.",phone:"9961007788",email:"shameer@example.com",role:"Victim",cases:1,status:"Active"}
  ],
  hearings:[
    {date:"2026-09-08",time:"10:30 AM",case:"OS 145/2026",title:"Rahman v. State",court:"District Court, Kozhikode",stage:"Evidence"},
    {date:"2026-09-10",time:"11:00 AM",case:"CC 88/2026",title:"Fathima v. Kareem",court:"JMFC Court II",stage:"Arguments"},
    {date:"2026-09-15",time:"10:00 AM",case:"WP 422/2026",title:"ABC Traders v. State",court:"High Court of Kerala",stage:"Admission"},
    {date:"2026-09-18",time:"02:00 PM",case:"OP 71/2025",title:"Shameer v. Amina",court:"Family Court",stage:"Mediation"}
  ],
  tasks:[
    {title:"Prepare counter affidavit",case:"OS 145/2026",due:"2026-09-06",priority:"High",status:"In Progress"},
    {title:"Collect client documents",case:"CC 88/2026",due:"2026-09-07",priority:"Medium",status:"Pending"},
    {title:"Review writ petition",case:"WP 422/2026",due:"2026-09-11",priority:"High",status:"Pending"}
  ]
};
/* Each Admin gets an isolated workspace. Legacy demo data belongs only to the
   built-in demo Admin; newly created Admins start with a clean workspace. */
let workspaceIdentity=String(auth.workspaceId||"").trim();
if(!workspaceIdentity){
  workspaceIdentity=(auth.role==="admin" && String(auth.email||"").trim().toLowerCase()==="admin@advocatedesk.local")
    ?"demo-admin"
    :"ws_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);
  auth.workspaceId=workspaceIdentity;
  try{localStorage.setItem("advocateDeskAuth",JSON.stringify(auth))}catch(e){}
}
const identity=String(auth.email||auth.name||auth.role||"user").trim().toLowerCase();
const dataKey="advocateDeskData:"+(workspaceIdentity||identity);
const isDemoAdmin=auth.role==="admin" && identity==="admin@advocatedesk.local";
const legacyData=localStorage.getItem("advocateDeskData");
let storedData=localStorage.getItem(dataKey);
if(storedData===null && isDemoAdmin && legacyData){
  storedData=legacyData;
  localStorage.setItem(dataKey,legacyData);
}
const emptyState={
  cases:[],clients:[],hearings:[],tasks:[],discussions:[],meetings:[],payments:[],invoices:[]
};
let state=auth.cloudAuth ? JSON.parse(JSON.stringify(window.ADCloudInitialState||emptyState)) : (storedData ? (JSON.parse(storedData)||emptyState) : (isDemoAdmin ? JSON.parse(JSON.stringify(seed)) : emptyState));
state.discussions=Array.isArray(state.discussions)?state.discussions:[];
state.meetings=Array.isArray(state.meetings)?state.meetings:[];
state.payments=Array.isArray(state.payments)?state.payments:[];
state.invoices=Array.isArray(state.invoices)?state.invoices:(isDemoAdmin?[
  {id:"INV-101",date:"2026-09-13",client:"ABC Traders",clientId:"CL-003",case:"WP 422/2026",caseId:"CS-2026-003",caseNumber:"WP 422/2026",amount:1000,paid:500,status:"Partial"},
  {id:"INV-001",date:"2026-09-13",client:"ABC Traders",clientId:"CL-003",case:"WP 422/2026",caseId:"CS-2026-003",caseNumber:"WP 422/2026",amount:25000,paid:15000,status:"Partial"}
]:[]);
let stateChangedByDemoMigration=false;
// Migrate only the known legacy demo invoices. Genuine user-created invoices are not rewritten.
if(!auth.cloudAuth && Array.isArray(state.invoices)){
  state.invoices.forEach(inv=>{
    if(inv && (inv.id==="INV-101"||inv.id==="INV-001") && (
      inv.client==="ABC Industries" ||
      inv.case==="WP 422/2026" ||
      inv.caseId==="CS-2026-003" ||
      inv.clientId==="CL-003"
    )){
      inv.client="ABC Traders";
      inv.clientId="CL-003";
      inv.case="WP 422/2026";
      inv.caseNumber="WP 422/2026";
      inv.caseId="CS-2026-003";
      const amount=Number(inv.amount||0), paid=Number(inv.paid||0);
      inv.status=paid>=amount && amount>0 ? "Paid" : paid>0 ? "Partial" : "Pending";
      stateChangedByDemoMigration=true;
    }
  });
}
const save=()=>{
  if(!auth.cloudAuth){localStorage.setItem(dataKey,JSON.stringify(state));return;}
  if(window.ADCloudSync&&typeof window.ADCloudSync.save==="function"){
    window.ADCloudSync.save(state).catch(function(err){
      console.error("AdvocateDesk cloud save failed",err);
      if(typeof window.showToast==="function")window.showToast("Cloud sync failed. Your latest changes may not be saved online. Check your connection and retry.");
      else if(typeof window.toast==="function")window.toast("Cloud sync failed. Check your connection and retry.");
    });
  }
};
window.advocateDeskDataKey=dataKey;
window.saveAdvocateDeskState=save;
if(stateChangedByDemoMigration && !auth.cloudAuth) save();
window.appState=state;
if(storedData===null && !auth.cloudAuth) save();
const fmtDate=d=>new Date(d+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
const KOZHIKODE_COURTS = [
  "JFCM Court, Kunnamangalam",
  "District Court / Rent Control Appellate Authority, Kozhikode",
  "Sub Court Kozhikode",
  "Munsiff Court 1 Kozhikode",
  "Munsiff Court 2 Kozhikode",
  "JFCM 1 Kozhikode",
  "JFCM 2 Kozhikode",
  "JFCM 3 Kozhikode",
  "JFCM 5 Kozhikode",
  "Chief Judicial Magistrate Court, Kozhikode",
  "MACT Kozhikode",
  "JFCM IV Kozhikode",
  "Additional District and Sessions Court-III, Kozhikode",
  "Additional District Court, POCSO, Kozhikode",
  "JFCM 7, NI ACT Cases, Kozhikode",
  "Special Fast Track Court, Kozhikode",
  "Commercial Court Kozhikode",
  "Judicial First Class Magistrate 8 Kozhikode",
  "Judicial First Class Magistrate 9 Kozhikode",
  "Judicial First Class Magistrate 10 Kozhikode",
  "Judicial First Class Magistrate 11 Kozhikode",
  "Family Court Vatakara",
  "Munsiff Court,Koyilandy",
  "Sub Court,Koyilandy",
  "Judicial First Class Magistrate Court, Koyilandy",
  "Special Fast Track Court, Koyilandy",
  "Commercial Court, Koyilandy",
  "Family Court,Kozhikode",
  "Munsiff-Magistrate Court, Perambra",
  "Judicial First Class Magistrate Court-I, Perambra",
  "Judicial First Class Magistrate Court-II, Perambra",
  "Munsiff Court, Payyoli",
  "Judicial First Class Magistrate Court,Payyoli",
  "Munsiff Court, Nadapuram",
  "Judicial First Class Magistrate Court, Nadapuram",
  "Fast Track Special Court, Nadapuram",
  "JFCM I Thamarassery",
  "JFCM II Thamarassery",
  "Munsiff Court, Thamarassery",
  "JFCM VI Kozhikode, Eranhipalam",
  "Spl. Addl Sessions Court, Marad Cases, Kozhikode",
  "Addl. District and Sessions Court, Vatakara",
  "Judicial First Class Magistrate Court, Vatakara",
  "MACT Vatakara",
  "Sub Court, Vatakara",
  "Munsiff Court, Vadakara",
  "JFCM II Court, Vatakara",
  "NDPS Act Cases, Vatakara",
  "Commercial Court, Vatakara",
  "Addl. District Court-II Vatakara",
  "Grama Nyayalaya Kunnummal",
  "Grama Nyayalaya Koduvally"
];
const HEARING_STAGES = ['Admission','Evidence','Arguments','Mediation','Hearing','Cross Examination','Chief Examination','Final Hearing','Judgment','Orders','Posting','For Compliance','For Filing','For Appearance','For Consideration','Settlement','Notice','Reply','Counter','Disposed'];
const courtOptions = selected => { const courts=KOZHIKODE_COURTS.slice(); if(selected && !courts.includes(selected)) courts.unshift(selected); return ['<option value="">Select court</option>', ...courts.map(c => `<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`)].join(''); };

state.courts = Array.isArray(state.courts) ? state.courts.filter(Boolean) : [];
const getCourtList = () => [...new Set([...KOZHIKODE_COURTS, ...state.courts])];
const courtDatalist = (id="caseCourtOptions") => `<datalist id="${id}">${getCourtList().map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist>`;
const badge=s=>{const label=esc(s);return `<span class="badge ${s==="Active"||s==="Completed"?"green":s==="High"||s==="Reserved"?"gold":s==="Pending"?"blue":"red"}">${label}</span>`};
const content=document.getElementById("content");
document.title=(auth.role==="super_admin"?"Super Admin":"Admin")+" — AdvocateDesk";

document.querySelector(".user-chip").innerHTML=`${auth.role==="super_admin"?"👑":"A"} <span>${esc(auth.name)}</span> ▾`;
if(auth.role!=="super_admin"){document.querySelectorAll(".admin-only").forEach(el=>el.remove())}


function layout(title,sub,action=""){return `<div class="page-title"><div><h1>${title}</h1><p>${sub}</p></div>${action?`<button class="primary" onclick="${action}">＋ New</button>`:""}</div>`}

function advocatePhotoKey(){
  const identity=String(auth.workspaceId||auth.email||auth.name||auth.role||"advocate").trim().toLowerCase();
  return "advocateDeskProfilePhoto:"+identity;
}
function getAdvocatePhoto(){try{return localStorage.getItem(advocatePhotoKey())||""}catch(e){return ""}}
function saveAdvocateProfilePhoto(input){
  const file=input&&input.files&&input.files[0]; if(!file)return;
  if(!String(file.type||"").startsWith("image/")){alert("Please select an image file.");input.value="";return;}
  const reader=new FileReader(); reader.onload=function(){const img=new Image(); img.onload=function(){
    const max=420,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL("image/jpeg",0.82);
    try{localStorage.setItem(advocatePhotoKey(),data);const p=document.getElementById("advocateProfilePreview");if(p)p.src=data;dashboard()}catch(e){alert("The photo could not be saved in this browser. Please choose a smaller image.");}
  };img.src=reader.result;}; reader.readAsDataURL(file);
}
function removeAdvocateProfilePhoto(){try{localStorage.removeItem(advocatePhotoKey())}catch(e){};settings()}
function calendarEventsForDate(date){
  const key=String(date||"").slice(0,10);
  const events=[];
  (state.hearings||[]).filter(x=>String(x.date||"").slice(0,10)===key).forEach(x=>events.push({type:"hearing",title:x.title||"Court Hearing",time:x.time||"",meta:[x.court,x.case,x.stage].filter(Boolean).join(" • ")}));
  (state.meetings||[]).filter(x=>String(x.date||"").slice(0,10)===key).forEach(x=>events.push({type:"meeting",title:x.subject||"Client Meeting",time:x.time||"",meta:[x.mode,x.location].filter(Boolean).join(" • ")}));
  (state.tasks||[]).filter(x=>String(x.due||x.date||"").slice(0,10)===key && x.status!=="Completed").forEach(x=>events.push({type:"task",title:x.title||"Task",time:"",meta:[x.priority?x.priority+" priority":"",x.status||"Pending"].filter(Boolean).join(" • ")}));
  return events.sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")));
}
function sameDayCalendarDetails(date){
  const d=date||new Date().toISOString().slice(0,10);
  const events=calendarEventsForDate(d);
  const label=new Date(d+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  return `<div class="panel same-day-calendar"><div class="panel-head"><div><h3>Today's Calendar</h3><span>${label}</span></div><button class="secondary" onclick="navigate('calendar')">Open calendar module</button></div><div class="list">${events.length?events.map(e=>`<div class="list-row"><div class="date-box"><b>${e.type==="hearing"?"⚖":e.type==="meeting"?"☏":"✓"}</b><small>${esc(e.type)}</small></div><div class="list-main"><strong>${esc(e.title)}</strong><small>${esc(e.time||"All day")}${e.meta?" • "+esc(e.meta):""}</small></div>${badge(e.type==="hearing"?"Hearing":e.type==="meeting"?"Meeting":"Task")}</div>`).join(""):`<div class="empty">No hearings, meetings or pending tasks scheduled for today.</div>`}</div></div>`;
}
function dashboardCalendar(){
  const now=new Date();
  const year=now.getFullYear(), month=now.getMonth();
  const monthName=now.toLocaleString("en-IN",{month:"long",year:"numeric"});
  const first=new Date(year,month,1).getDay();
  const days=new Date(year,month+1,0).getDate();
  const pad=n=>String(n).padStart(2,"0");
  const key=d=>`${year}-${pad(month+1)}-${pad(d)}`;
  const events={};
  const add=(date,type,title)=>{if(!date)return;(events[String(date).slice(0,10)]||(events[String(date).slice(0,10)]=[])).push({type,title});};
  (state.hearings||[]).forEach(h=>add(h.date,"hearing",h.title||"Court Hearing"));
  (state.meetings||[]).forEach(m=>add(m.date,"meeting",m.subject||"Client Meeting"));
  (state.tasks||[]).filter(t=>t.status!=="Completed").forEach(t=>add(t.due||t.date,"task",t.title||"Task"));
  let cells="";
  for(let i=0;i<first;i++) cells+='<div class="dash-cal-day muted-day"></div>';
  for(let d=1;d<=days;d++){
    const date=key(d), list=events[date]||[], today=date===`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    cells+=`<button class="dash-cal-day ${today?"today":""} ${list.length?"has-events":""}" title="${esc(list.map(x=>x.title).join(" • "))}" onclick="navigate('calendar')"><span>${d}</span>${list.length?`<i class="dash-cal-dots">${list.slice(0,3).map(x=>`<b class="${x.type}"></b>`).join("")}</i>`:""}</button>`;
  }
  return `<div class="panel dashboard-calendar"><div class="panel-head"><div><h3>Calendar</h3><span>${monthName}</span></div><button class="secondary" onclick="navigate('calendar')">Open calendar</button></div><div class="dash-cal-weekdays">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<span>${x}</span>`).join("")}</div><div class="dash-cal-grid">${cells}</div><div class="dash-cal-legend"><span><b class="hearing"></b> Hearings</span><span><b class="meeting"></b> Meetings</span><span><b class="task"></b> Tasks</span></div></div>`;
}
function composeDashboardHero(){
  const hero=document.querySelector(".dashboard-hero");
  const photo=getAdvocatePhoto();
  if(!hero||auth.role==="super_admin")return;
  const base=new Image();
  base.onload=function(){
    const w=Math.max(1,Math.round(hero.clientWidth)), h=Math.max(1,Math.round(hero.clientHeight));
    const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext("2d");
    /* Create a dedicated photo zone on the left. The legal banner itself is
       shifted right, so none of its text sits underneath the profile photo. */
    const zone=w<=720?Math.min(190,Math.round(w*.24)):Math.min(330,Math.round(w*.235));
    ctx.drawImage(base,0,0,1,base.naturalHeight,0,0,zone,h);
    ctx.drawImage(base,zone,0,w-zone,h);
    if(photo){
      const person=new Image();
      person.onload=function(){
        /* Keep the entire circle comfortably inside the banner height. */
        const photoSize=w<=720?Math.min(145,h-18):Math.min(240,h-18);
        const cx=zone/2;
        const cy=h/2;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx,cy,photoSize/2,0,Math.PI*2); ctx.clip();
        const scale=Math.max(photoSize/person.naturalWidth,photoSize/person.naturalHeight);
        const pw=person.naturalWidth*scale, ph=person.naturalHeight*scale;
        ctx.drawImage(person,cx-pw/2,cy-ph/2,pw,ph);
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx,cy,photoSize/2-1,0,Math.PI*2);
        ctx.lineWidth=w<=720?3:5; ctx.strokeStyle="#fff"; ctx.stroke();
        hero.style.backgroundImage='url("'+canvas.toDataURL("image/jpeg",.94)+'")';
        hero.style.backgroundSize="100% 100%";
        hero.style.backgroundPosition="center";
        hero.innerHTML="";
      };
      person.src=photo;
      return;
    }
    hero.style.backgroundImage='url("'+canvas.toDataURL("image/jpeg",.94)+'")';
    hero.style.backgroundSize="100% 100%";
    hero.style.backgroundPosition="center";
    hero.innerHTML="";
  };
  base.src="assets/dashboard-legal-banner.png";
}
function dashboard(){
  if(auth.role==="super_admin"){
    const today=new Date();
    const users=(window.ADPlatformAccounts||[]).filter(u=>u&&u.role==="admin").map(u=>({...u,organization:(u.workspaces||[]).map(w=>w.name).join(", ")||"Law Office",createdAt:u.created_at,status:u.status}));
    const activeAdmins=users.filter(u=>String(u.status||"Active")==="Active").length;
    const organizations=[...new Set(users.map(u=>String(u.organization||u.officeName||u.office||"Law Office").trim()).filter(Boolean))];
    const alerts=users.filter(u=>String(u.status||"Active")==="Suspended").length;
    const recent=users.slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,5);
    const dashHour=new Date().getHours();
    const dashGreeting=dashHour<12?"Good morning":dashHour<17?"Good afternoon":"Good evening";
    const dashDate=today.toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
    content.innerHTML=layout("Hi System Owner, "+dashGreeting+"!",dashDate+" • Platform Control",`openModal('case')`)+
    `<div class="dashboard-hero super-admin-hero" role="img" aria-label="AdvocateDesk Super Admin banner"></div>
    <div class="notice">System Owner view. Practice records remain inside each Admin's separate workspace.</div>
    <div class="cards">
      <div class="stat"><div class="stat-top">Organizations <span>🏢</span></div><div class="stat-value">${organizations.length}</div><div class="stat-foot">Law offices on the platform</div></div>
      <div class="stat"><div class="stat-top">Active Admins <span>👤</span></div><div class="stat-value">${activeAdmins}</div><div class="stat-foot">Active administrator accounts</div></div>
      <div class="stat"><div class="stat-top">Admin Accounts <span>🛡️</span></div><div class="stat-value">${users.length}</div><div class="stat-foot">Administrator accounts</div></div>
      <div class="stat"><div class="stat-top">System Alerts <span>⚠</span></div><div class="stat-value">${alerts}</div><div class="stat-foot">${alerts?"Accounts need attention":"No account alerts"}</div></div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="panel"><div class="panel-head"><div><h3>Organizations & Administrators</h3><span>Account management only</span></div><button class="secondary" onclick="navigate('central-control')">Open Central Control</button></div>
        <div class="list">${users.length?users.slice(0,6).map((u,i)=>`<div class="list-row"><div class="date-box"><b>✓</b><small>${esc(String(u.status||"Active"))}</small></div><div class="list-main"><strong>${esc(u.name||"Administrator")}</strong><small>${esc(u.organization||u.officeName||u.office||"Law Office")}</small></div><button class="secondary" onclick="navigate('central-control')">Manage</button></div>`).join(""):`<div class="empty">No Admin accounts created yet.</div>`}</div>
      </div>
      <div class="panel"><div class="panel-head"><div><h3>Recent System Activity</h3><span>Platform account activity</span></div></div>
        <div class="list">${recent.length?recent.map(u=>`<div class="list-row"><div class="date-box"><b>+</b><small>Admin</small></div><div class="list-main"><strong>Admin account created</strong><small>${esc(u.name||"Administrator")} • ${u.createdAt?esc(new Date(u.createdAt).toLocaleDateString("en-IN")):"Date unavailable"}</small></div></div>`).join(""):`<div class="empty">No recent system activity.</div>`}</div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>System Management</h3><span>Platform-level controls</span></div></div><div class="quick-grid">
      <button class="quick" onclick="navigate('central-control')"><strong>👥 Admin Accounts</strong><small>Create and manage administrators</small></button>
      <button class="quick" onclick="navigate('central-control')"><strong>🏢 Organizations</strong><small>Manage law office accounts</small></button>
      <button class="quick" onclick="navigate('central-control')"><strong>🔐 Security</strong><small>Review platform access</small></button>
      <button class="quick" onclick="navigate('central-control')"><strong>📋 Audit Logs</strong><small>Review account activity</small></button>
    </div></div>`;
    return;
  }
  const today=new Date(); today.setHours(0,0,0,0);
  const upcoming=state.hearings.filter(h=>h.date && new Date(h.date+"T00:00:00")>=today).sort((a,b)=>(String(a.date)+String(a.time||"")).localeCompare(String(b.date)+String(b.time||""))).slice(0,4);
  const upcomingMeetings=state.meetings.filter(m=>m.date && new Date(m.date+"T00:00:00")>=today).sort((a,b)=>(String(a.date)+String(a.time||"")).localeCompare(String(b.date)+String(b.time||""))).slice(0,4);
  const upcomingTasks=state.tasks.filter(t=>t.due && t.status!=="Completed" && new Date(t.due+"T00:00:00")>=today).sort((a,b)=>String(a.due).localeCompare(String(b.due))).slice(0,4);
  const meetingClient=(m)=>state.clients.find(c=>c.id===m.clientId);
  const dashDate=today.toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  const dashHour=new Date().getHours(); const dashGreeting=dashHour<12?"Good morning":dashHour<17?"Good afternoon":"Good evening"; const advocateName=String(auth.name||"Advocate").trim(); const advocateGreeting="Hi "+advocateName+", "+dashGreeting+"!"; content.innerHTML=layout(advocateGreeting,dashDate+" • "+(window.ADCloudSync?(auth.workspaceName||"Cloud Workspace"):"Demo Workspace"),`openModal('case')`)+
  `<div class="dashboard-hero ${auth.role==="super_admin"?"super-admin-hero":""}" role="img" aria-label="AdvocateDesk ${auth.role==="super_admin"?"Super Admin":"legal practice"} banner">${auth.role!=="super_admin"&&getAdvocatePhoto()?`<div class="dashboard-advocate-photo"><img src="${getAdvocatePhoto()}" alt="${esc(auth.name||"Advocate")} profile photo"></div>`:""}</div>
  ${auth.cloudAuth?`<div class="notice">Cloud workspace is active. Your practice records are securely synced with your workspace.</div>`:`<div class="notice">Demo mode is active. Records are stored in this browser for now.</div>`}
  <div class="cards">
   <div class="stat"><div class="stat-top">Active Cases <span>⚖</span></div><div class="stat-value">${state.cases.filter(x=>x.status==="Active").length}</div><div class="stat-foot">Live case portfolio</div></div>
   <div class="stat"><div class="stat-top">Upcoming Hearings <span>◷</span></div><div class="stat-value">${upcoming.length}</div><div class="stat-foot">Upcoming hearings</div></div>
   <div class="stat"><div class="stat-top">Clients <span>♙</span></div><div class="stat-value">${state.clients.length}</div><div class="stat-foot">Registered clients</div></div>
   <div class="stat"><div class="stat-top">Pending Tasks <span>✓</span></div><div class="stat-value">${state.tasks.filter(x=>x.status!=="Completed").length}</div><div class="stat-foot">Requires attention</div></div>
  </div>
  <div class="dashboard-calendar-wrap"><div id="dashboard-calendar-module"></div></div>
  <div class="grid-2">
   <div class="panel"><div class="panel-head"><h3>Upcoming Hearings</h3><button class="secondary" onclick="navigate('hearings')">View all</button></div>
   <div class="list">${upcoming.length?upcoming.map(h=>`<div class="list-row"><div class="date-box"><b>${new Date(h.date+"T00:00:00").getDate()}</b><small>${new Date(h.date+"T00:00:00").toLocaleString("en",{month:"short"})}</small></div><div class="list-main"><strong>${esc(h.case)} — ${esc(h.title)}</strong><small>${esc(h.time)} • ${esc(h.court)} • ${esc(h.stage)}</small></div></div>`).join(""):`<div class="empty">No upcoming hearings.</div>`}</div></div>
   <div class="panel"><div class="panel-head"><h3>Upcoming Client Meetings</h3><button class="secondary" onclick="navigate('client-management')">View all</button></div>
   <div class="list">${upcomingMeetings.length?upcomingMeetings.map(m=>{const c=meetingClient(m); return `<div class="list-row"><div class="date-box"><b>${new Date(m.date+"T00:00:00").getDate()}</b><small>${new Date(m.date+"T00:00:00").toLocaleString("en",{month:"short"})}</small></div><div class="list-main"><strong>${esc(m.subject||"Client Meeting")}</strong><small>${esc(c?.name||"Client")} • ${esc(m.time||"")} • ${esc(m.mode||"Meeting")}</small>${m.location?`<small>${esc(m.location)}</small>`:""}</div><button class="secondary" onclick="sendMeetingWhatsApp(${state.meetings.indexOf(m)})">WhatsApp</button></div>`;}).join(""):`<div class="empty">No upcoming client meetings.</div>`}</div></div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Upcoming Tasks</h3><button class="secondary" onclick="navigate('tasks')">View all</button></div>
   <div class="list">${upcomingTasks.length?upcomingTasks.map(t=>`<div class="list-row"><div class="date-box"><b>${new Date(t.due+"T00:00:00").getDate()}</b><small>${new Date(t.due+"T00:00:00").toLocaleString("en",{month:"short"})}</small></div><div class="list-main"><strong>${esc(t.title||"Task")}</strong><small>${esc(t.case||"No case")} • ${esc(t.priority||"Medium")} priority</small><small>Due: ${fmtDate(t.due)} • ${esc(t.status||"Pending")}</small></div></div>`).join(""):`<div class="empty">No upcoming tasks.</div>`}</div></div>
  <div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Quick Actions</h3></div><div class="panel-body" style="padding:14px"><div class="quick-grid">
    <button class="quick" onclick="openModal('case')"><strong>＋ New Case</strong><small>Create a case file</small></button>
    <button class="quick" onclick="openModal('client')"><strong>＋ New Client</strong><small>Add client details</small></button>
    <button class="quick" onclick="openModal('hearing')"><strong>＋ Hearing</strong><small>Schedule hearing</small></button>
    <button class="quick" onclick="openModal('meeting')"><strong>＋ Client Meeting</strong><small>Schedule and WhatsApp client</small></button>
   </div></div></div>`;
  if(window.renderDashboardTodayCalendarInto){window.renderDashboardTodayCalendarInto(document.getElementById("dashboard-calendar-module"));}
  requestAnimationFrame(composeDashboardHero);
}

function caseClient(){
 content.innerHTML=layout("All Cases","Manage cases, parties and client relationships",`openModal('case')`)+
 `<div class="toolbar"><input class="filter" id="caseClientFilter" placeholder="Search case number, title, client, phone or court..." oninput="filterTable('caseClientTable',this.value)"></div>
 <div class="panel"><table id="caseClientTable"><thead><tr><th>Case Number</th><th>Case Title</th><th>Parties / Clients</th><th>Court</th><th>Next Hearing</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.cases.map((c,i)=>{const linkedIds=Array.isArray(c.clientIds)?c.clientIds:(c.clientId?[c.clientId]:[]); const parties=state.clients.filter(x=>linkedIds.includes(x.id)||x.name===c.client||((c.clients||[]).includes(x.name)));return `<tr><td><strong>${esc(c.number||'—')}</strong></td><td><strong>${esc(c.title||'—')}</strong></td><td>${parties.length?parties.map(x=>`<div>${esc(x.name)} <span class="muted">(${esc(x.role||'Party')})</span></div>`).join(''):esc(c.client||'—')}</td><td>${esc(c.court||'—')}</td><td>${c.next?fmtDate(c.next):"—"}${c.hearingTime?`<div class="muted" style="margin-top:4px">${esc(hearingTimeDisplayValue(c.hearingTime))}</div>`:""}</td><td>${badge(c.status)}</td><td><button class="secondary" onclick="openEditModal('case',${i})">Edit</button><button class="secondary" onclick="deleteRecord('case',${i})">Delete</button></td></tr>`}).join('')}</tbody></table></div>
 <div class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>All Clients / Parties</h3><span class="muted">Search and filter registered clients and parties</span></div><button class="primary" onclick="openModal('client')">＋ Add Client</button></div><div class="toolbar client-search-toolbar" style="display:flex!important;visibility:visible!important;opacity:1!important;align-items:center!important;gap:10px!important;width:100%!important;margin:0 0 15px!important"><div class="client-search-box" style="position:relative;flex:1;min-width:0;display:block!important;visibility:visible!important"><input class="filter" id="clientTableFilter" autocomplete="off" placeholder="Search client name, role, phone, email or ID..." oninput="clientTableFilterLive(this.value)" onfocus="clientTableFilterLive(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();clientTableApplySearch()}"><div id="clientTableSuggestions" class="client-search-suggestions" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:1000;background:#fff;border:1px solid #dbe3f0;border-radius:10px;box-shadow:0 12px 28px rgba(20,40,80,.14);overflow:hidden"></div></div><button class="secondary" type="button" style="display:inline-flex!important;visibility:visible!important;opacity:1!important;align-items:center;justify-content:center;min-width:96px!important" onclick="clientTableApplySearch()">Search</button></div><table id="clientTable"><thead><tr><th>Client</th><th>Role</th><th>Phone</th><th>Email</th><th>Cases</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.clients.map((c,i)=>`<tr><td><strong>${esc(c.name)}</strong><br><span class="muted">${esc(c.id)}</span></td><td>${esc(c.role||'Petitioner')}</td><td>${esc(c.phone||'')}</td><td>${esc(c.email||'')}</td><td>${c.cases||0}</td><td>${badge(c.status)}</td><td><button class="secondary" onclick="openEditModal('client',${i})">Edit</button><button class="secondary" onclick="deleteRecord('client',${i})">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function clientTableFilterLive(value){
  const input=document.getElementById("clientTableFilter");
  const table=document.getElementById("clientTable");
  const popup=document.getElementById("clientTableSuggestions");
  const q=String(value||"").trim().toLowerCase();
  if(!table)return;
  const rows=Array.from(table.querySelectorAll("tbody tr"));
  let visible=0;
  rows.forEach(row=>{
    const haystack=String(row.textContent||"").replace(/\\s+/g," ").trim().toLowerCase();
    const show=!q||haystack.includes(q);
    row.style.display=show?"":"none";
    if(show)visible++;
  });
  if(!popup)return;
  if(!q){popup.innerHTML="";popup.style.display="none";return;}
  const clients=Array.isArray(state.clients)?state.clients:[];
  const matches=clients.filter(c=>[c.name,c.role,c.phone,c.email,c.id].some(v=>String(v??"").toLowerCase().includes(q))).slice(0,8);
  popup.innerHTML=matches.length?matches.map(c=>"<button type='button' onclick='selectClientTableSuggestion("+JSON.stringify(c.id)+")' style='display:block;width:100%;padding:11px 14px;border:0;border-bottom:1px solid #eef2f7;background:#fff;text-align:left;cursor:pointer'><strong style='display:block;color:#172033'>"+esc(c.name)+"</strong><span style='display:block;margin-top:3px;color:#64748b;font-size:12px'>"+esc(c.role||"Party")+" • "+esc(c.phone||"No phone")+" • "+esc(c.id||"")+"</span></button>").join(""):"<div style='padding:12px 14px;color:#64748b'>No matching client or party found.</div>";
  popup.style.display="block";
  if(visible===0 && !matches.length) popup.innerHTML="<div style='padding:12px 14px;color:#64748b'>No matching client or party found.</div>";
}
function clientTableSearchSuggestions(value){
  const input=document.getElementById("clientTableFilter");
  const popup=document.getElementById("clientTableSuggestions");
  if(!input||!popup)return;
  const q=String(value||"").trim().toLowerCase();
  const clients=Array.isArray(state.clients)?state.clients:[];
  filterTable("clientTable",value||"");
  if(!q){popup.innerHTML="";popup.style.display="none";return;}
  const matches=clients.filter(c=>[c.name,c.role,c.phone,c.email,c.id].some(v=>String(v??"").toLowerCase().includes(q))).slice(0,8);
  if(!matches.length){popup.innerHTML="<div style='padding:12px 14px;color:#64748b'>No matching client or party found.</div>";popup.style.display="block";return;}
  popup.innerHTML=matches.map(c=>"<button type='button' onclick='selectClientTableSuggestion("+JSON.stringify(c.id)+")' style='display:block;width:100%;padding:11px 14px;border:0;border-bottom:1px solid #eef2f7;background:#fff;text-align:left;cursor:pointer'><strong style='display:block;color:#172033'>"+esc(c.name)+"</strong><span style='display:block;margin-top:3px;color:#64748b;font-size:12px'>"+esc(c.role||"Party")+" • "+esc(c.phone||"No phone")+" • "+esc(c.id||"")+"</span></button>").join("");
  popup.style.display="block";
}
function selectClientTableSuggestion(id){
  const client=(Array.isArray(state.clients)?state.clients:[]).find(c=>c.id===id);
  const input=document.getElementById("clientTableFilter");
  if(!client||!input)return;
  input.value=client.name||client.id||"";
  filterTable("clientTable",input.value);
  const popup=document.getElementById("clientTableSuggestions");
  if(popup){popup.innerHTML="";popup.style.display="none";}
}
function clientTableApplySearch(){
  const input=document.getElementById("clientTableFilter");
  if(!input)return;
  filterTable("clientTable",input.value||"");
  const popup=document.getElementById("clientTableSuggestions");
  if(popup){popup.innerHTML="";popup.style.display="none";}
}
document.addEventListener("click",function(e){
  const box=document.querySelector(".client-search-box");
  const popup=document.getElementById("clientTableSuggestions");
  if(popup&&box&&!box.contains(e.target))popup.style.display="none";
});
function caseDetails(query="", selectedId="") {
  const q=String(query||"").trim().toLowerCase();
  const norm=v=>String(v||"").toLowerCase();
  const linked=c=>{const ids=Array.isArray(c.clientIds)?c.clientIds:(c.clientId?[c.clientId]:[]);return state.clients.filter(x=>ids.includes(x.id)||x.name===c.client||((c.clients||[]).includes(x.name)));};
  const matches=(Array.isArray(state.cases)?state.cases:[]).filter(c=>!q||[c.number,c.title,c.court,c.type,c.status,c.client,...(Array.isArray(c.clients)?c.clients:[])].some(v=>norm(v).includes(q))||linked(c).some(x=>[x.name,x.phone,x.email,x.id,x.role].some(v=>norm(v).includes(q))));
  const active=state.cases.find(c=>c.id===selectedId)||matches[0];
  const details=(label,val)=>`<div><span class="muted">${label}</span><br><strong>${esc(val||"—")}</strong></div>`;
  const caseCard=c=>`<button class="case360-result" onclick="caseDetails(${JSON.stringify(q)},${JSON.stringify(c.id)})"><strong>${esc(c.number||"No case number")}</strong><span>${esc(c.title||"Untitled case")}</span><small>${esc(c.court||"No court")} • ${esc(c.client||"No client")}</small></button>`;
  let workspace=`<div class="empty">Search and select a case to open its complete Case 360 workspace.</div>`;
  if(active){const parties=linked(active);const hs=(Array.isArray(state.hearings)?state.hearings:[]).filter(h=>h.case===active.number||h.case===active.id||h.caseNumber===active.number);const ts=(Array.isArray(state.tasks)?state.tasks:[]).filter(t=>t.case===active.number||t.case===active.title||t.caseId===active.id||t.caseNumber===active.number);const ms=(Array.isArray(state.meetings)?state.meetings:[]).filter(m=>parties.some(c=>c.id===m.clientId)||m.case===active.number||m.caseId===active.id);const ds=(Array.isArray(state.discussions)?state.discussions:[]).filter(d=>parties.some(c=>c.id===d.clientId)||d.case===active.number||d.caseId===active.id);const hearingForCase=hs.slice().sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))[0];const caseHearingTime=active.hearingTime||hearingForCase?.time||"";const tx=Array.isArray(state.transactions)?state.transactions.filter(t=>t.case===active.number||t.case===active.id||t.caseId===active.id||t.caseNumber===active.number):[];const finance=active.finance||{};const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");const received=tx.filter(t=>String(t.type||t.kind||"").toLowerCase().includes("receipt")||String(t.type||t.kind||"").toLowerCase().includes("payment")).reduce((a,t)=>a+Number(t.amount||0),0)+Number(finance.received||0);const expenses=tx.filter(t=>String(t.type||t.kind||"").toLowerCase().includes("expense")).reduce((a,t)=>a+Number(t.amount||0),0)+Number(finance.expenses||0);const billed=Number(finance.total||finance.fees||0);const balance=Math.max(0,billed-received);window.case360ActiveCaseId=active.id;workspace=`<div class="panel case360-workspace"><div class="panel-head"><div><h2>${esc(active.number)}</h2><span>${esc(active.title||"Untitled case")}</span></div><div>${badge(active.status||"Active")}</div></div><div class="case360-links"><button class="secondary" onclick="navigate('case-client')">Case & Client</button><button class="secondary" onclick="navigate('hearings')">Hearings</button><button class="secondary" onclick="navigate('calendar')">Calendar</button><button class="secondary" onclick="navigate('tasks')">Tasks</button><button class="secondary" onclick="navigate('client-management')">Client Management</button><button class="secondary" onclick="navigate('documents')">Documents</button><button class="secondary" onclick="navigate('finance')">Finance</button></div><div class="panel-body" style="padding:18px"><div class="grid-2"><div>${details("Case Type",active.type)}${details("Category",active.civilCategory||active.criminalCategory)}${details("Court",active.court)}${details("Case Number / Year",active.number)}</div><div>${details("Next Hearing",active.next?fmtDate(active.next):"Not scheduled")}${details("Hearing Time",hearingTimeDisplayValue(caseHearingTime)||"Not scheduled")}${details("Status",active.status)}${details("Case ID",active.id)}</div></div><hr><h3>Clients / Parties</h3><div class="case360-parties">${parties.length?parties.map(c=>`<div class="party-card"><strong>${esc(c.name)}</strong><span>${esc(c.role||"Party")}</span><small>☎ ${esc(c.phone||"No phone")}<br>${esc(c.email||"No email")}</small></div>`).join(""):esc(active.client||"No linked clients")}</div><hr><h3>Finance</h3><div class="cards"><div class="stat"><div class="stat-top">Total Fees</div><div class="stat-value">${money(billed)}</div></div><div class="stat"><div class="stat-top">Received</div><div class="stat-value">${money(received)}</div></div><div class="stat"><div class="stat-top">Outstanding</div><div class="stat-value">${money(balance)}</div></div><div class="stat"><div class="stat-top">Expenses</div><div class="stat-value">${money(expenses)}</div></div></div>${tx.length?`<div class="panel"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead><tbody>${tx.map(t=>`<tr><td>${fmtDate(t.date||t.created||"2026-01-01")}</td><td>${esc(t.description||t.note||"Transaction")}</td><td>${esc(t.type||t.kind||"—")}</td><td>${money(t.amount)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No financial transactions recorded for this case.</div>`}<hr><h3>Directly Connected Records</h3><div class="quick-grid"><button class="quick" onclick="openModal('hearing')"><strong>＋ Add Hearing</strong><small>Schedule for this case</small></button><button class="quick" onclick="openModal('task')"><strong>＋ Add Task</strong><small>Create a case task</small></button><button class="quick" onclick="openModal('meeting')"><strong>＋ Add Meeting</strong><small>Schedule client meeting</small></button><button class="quick" onclick="navigate('documents')"><strong>View Documents</strong><small>Open document records</small></button><button class="quick" onclick="navigate('finance')"><strong>View Finance</strong><small>Open financial records</small></button></div><hr><h3>Case Timeline & Related Records</h3><div class="case360-columns"><section><h4>Hearings (${hs.length})</h4>${hs.length?hs.map(h=>`<div class="list-row"><div class="list-main"><strong>${fmtDate(h.date)} ${esc(hearingTimeDisplayValue(h.time)||"")}</strong><small>${esc(h.court||active.court||"")} • ${esc(h.stage||"Hearing")}</small></div></div>`).join(""):`<div class="empty">No hearings</div>`}</section><section><h4>Tasks (${ts.length})</h4>${ts.length?ts.map(t=>`<div class="list-row"><div class="list-main"><strong>${esc(t.title)}</strong><small>Due ${fmtDate(t.due)} • ${esc(t.status||"Pending")}</small></div></div>`).join(""):`<div class="empty">No tasks</div>`}</section><section><h4>Meetings & Discussions (${ms.length+ds.length})</h4>${[...ms.map(m=>`<div class="list-row"><div class="list-main"><strong>Meeting: ${esc(m.subject||"Client Meeting")}</strong><small>${fmtDate(m.date)} • ${esc(m.time||"")}</small></div></div>`),...ds.map(d=>`<div class="list-row"><div class="list-main"><strong>Discussion: ${esc(d.subject||"Client Discussion")}</strong><small>${fmtDate(d.date)}</small></div></div>`)].join("")||`<div class="empty">No communication records</div>`}</section></div></div></div>`;}
  content.innerHTML=layout("Case 360 / Case Details","Search once and manage every record connected to the selected case in one workspace")+`<div class="panel"><div class="panel-body" style="padding:16px"><div class="toolbar" style="margin:0"><input class="filter" id="caseDetailsSearch" value="${esc(query)}" placeholder="Search case number, client name or phone number..." oninput="caseDetailsSearch(this.value)"><button class="primary" onclick="caseDetailsSearch(document.getElementById('caseDetailsSearch').value)">Search</button></div></div></div><div class="case360-layout"><div><h3>Matching Cases (${matches.length})</h3>${matches.map(caseCard).join("")||`<div class="empty">No matching cases.</div>`}</div><div>${workspace}</div></div>`;
  if(window.renderDashboardTodayCalendarInto){window.renderDashboardTodayCalendarInto(document.getElementById("dashboard-calendar-module"));}

}
function caseDetailsSearch(value){caseDetails(value);}

function cases(){caseClient()}
function clients(){caseClient()}
function getHearingClient(h){
  if(h.clientId){ return state.clients.find(c=>c.id===h.clientId) || null; }
  const relatedCase=state.cases.find(c=>c.number===h.case || c.id===h.case);
  if(!relatedCase) return null;
  return state.clients.find(c=>c.id===relatedCase.clientId || c.name===relatedCase.client) || null;
}
function normalizeWhatsApp(phone){
  let digits=String(phone||"").replace(/\D/g,"");
  if(digits.startsWith("00")) digits=digits.slice(2);
  if(digits.length===10 && /^[6-9]/.test(digits)) digits="91"+digits;
  return digits;
}
function caseWhatsAppUrl(c,client){
  if(!client) return null;
  const number=normalizeWhatsApp(client.phone);
  if(!number) return null;
  const message=[
    `Dear ${client.name},`,
    ``,
    `Your case has been added to AdvocateDesk.`,
    `Case Number: ${c.number||"—"}`,
    `Case Title: ${c.title||"—"}`,
    `Case Type: ${c.type||"—"}`,
    `Court: ${c.court||"—"}`,
    `Next Hearing Date: ${c.next?fmtDate(c.next):"Not scheduled"}`,
    `Hearing Time: ${c.hearingTime||"Not scheduled"}`,
    `Status: ${c.status||"Active"}`,
    ``,
    `Please contact the advocate's office for further information.`
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
function hearingWhatsAppUrl(h){
  const client=getHearingClient(h);
  if(!client) return null;
  const number=normalizeWhatsApp(client.phone);
  if(!number) return null;
  const message=[
    `Dear ${client.name},`,
    ``,
    `This is a hearing reminder from AdvocateDesk.`,
    `Case: ${h.case}`,
    `Case Title: ${h.title}`,
    `Hearing Date: ${fmtDate(h.date)}`,
    `Hearing Time: ${h.time}`,
    `Court: ${h.court}`,
    `Stage: ${h.stage}`,
    ``,
    `Please contact the advocate's office for any further information.`
  ].join("\n");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
function sendHearingWhatsApp(index){
  const h=state.hearings[index];
  const client=getHearingClient(h);
  const url=hearingWhatsAppUrl(h);
  if(!client){alert("No client is linked to this hearing.");return;}
  if(!url){alert(`No valid WhatsApp/mobile number is available for ${client.name}. Please update the client phone number.`);return;}
  window.open(url,"_blank","noopener,noreferrer");
}
function hearings(){
 content.innerHTML=layout("Hearings","Upcoming court dates and proceedings",`openModal('hearing')`)+
 `<div class="panel"><table id="hearingTable"><thead><tr><th>Date</th><th>Time</th><th>Case</th><th>Client</th><th>Court</th><th>Stage</th><th>Action</th></tr></thead><tbody>${state.hearings.map((h,i)=>{const c=getHearingClient(h);return `<tr><td><strong>${fmtDate(h.date)}</strong></td><td>${esc(h.time)}</td><td><strong>${esc(h.case)}</strong><br><span class="muted">${esc(h.title)}</span></td><td>${c?esc(c.name):"—"}</td><td>${esc(h.court)}</td><td>${badge(h.stage)}</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="secondary" onclick="openEditModal('hearing',${i})">Edit</button><button class="secondary" onclick="deleteRecord('hearing',${i})">Delete</button><button class="secondary" onclick="sendHearingWhatsApp(${i})">WhatsApp</button></div></td></tr>`}).join("")}</tbody></table></div>`;
}
function clientManagement(){
 const clientOptions=state.clients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.phone||"No phone")})</option>`).join("");
 const selectedId=window.clientManagementSelectedId || (state.clients[0]?.id||"");
 const selected=state.clients.find(c=>c.id===selectedId) || state.clients[0];
 if(selected) window.clientManagementSelectedId=selected.id;
 const discussions=selected?state.discussions.filter(d=>d.clientId===selected.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))):[];
 const meetings=selected?state.meetings.filter(m=>m.clientId===selected.id).sort((a,b)=>(String(a.date)+String(a.time)).localeCompare(String(b.date)+String(b.time))):[];
 content.innerHTML=layout("Client Management","Client discussions, meetings and WhatsApp communication",`openModal('discussion')`)+
 `<div class="toolbar"><div class="field" style="min-width:260px"><label>Select Client</label><select class="filter" id="clientManagementSelect" onchange="selectClientManagement(this.value)">${clientOptions}</select></div><button class="primary" onclick="openModal('meeting')">＋ Schedule Meeting</button></div>
 ${selected?`<div class="grid-2">
  <div class="panel"><div class="panel-head"><div><h3>${esc(selected.name)}</h3><span>${esc(selected.phone||"No phone number")} • ${esc(selected.email||"No email")}</span></div><span>${badge(selected.status||"Active")}</span></div>
   <div class="panel-body" style="padding:14px"><div class="quick-grid"><button class="quick" onclick="openModal('discussion')"><strong>＋ Add Discussion</strong><small>Record client conversation</small></button><button class="quick" onclick="openModal('meeting')"><strong>＋ Schedule Meeting</strong><small>Send meeting details on WhatsApp</small></button></div></div>
  </div>
  <div class="panel"><div class="panel-head"><h3>Client Summary</h3></div><div class="panel-body" style="padding:14px;line-height:1.8;font-size:12px"><b>Cases:</b> ${Number(selected.cases)||0}<br><b>WhatsApp:</b> ${esc(selected.phone||"Not available")}<br><b>Communication Records:</b> ${discussions.length+meetings.length}</div></div>
 </div>
 <div class="grid-2" style="margin-top:16px">
  <div class="panel"><div class="panel-head"><div><h3>Discussion History</h3><span>Notes and follow-up points</span></div><button class="secondary" onclick="openModal('discussion')">＋ Add</button></div>
   ${discussions.length?`<div class="list">${discussions.map((d)=>{const idx=state.discussions.indexOf(d);return `<div class="list-row"><div class="date-box"><b>${new Date(d.date+"T00:00:00").getDate()}</b><small>${new Date(d.date+"T00:00:00").toLocaleString("en",{month:"short"})}</small></div><div class="list-main"><strong>${esc(d.subject)}</strong><small>${esc(d.discussion)}</small>${d.nextAction?`<small><b>Next:</b> ${esc(d.nextAction)}</small>`:""}</div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="secondary" onclick="openEditModal('discussion',${idx})">Edit</button><button class="secondary" onclick="deleteRecord('discussion',${idx})">Delete</button></div></div>`;}).join("")}</div>`:`<div class="empty">No discussions recorded for this client yet.</div>`}
  </div>
  <div class="panel"><div class="panel-head"><div><h3>Client Meetings</h3><span>Scheduled appointments</span></div><button class="secondary" onclick="openModal('meeting')">＋ Schedule</button></div>
   ${meetings.length?`<div class="list">${meetings.map((m)=>{const idx=state.meetings.indexOf(m);return `<div class="list-row"><div class="date-box"><b>${new Date(m.date+"T00:00:00").getDate()}</b><small>${new Date(m.date+"T00:00:00").toLocaleString("en",{month:"short"})}</small></div><div class="list-main"><strong>${esc(m.subject)}</strong><small>${esc(m.time)} • ${esc(m.mode)}${m.location?` • ${esc(m.location)}`:""}</small><small>${esc(m.agenda||m.details||"Meeting details not added")}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="secondary" onclick="openEditModal('meeting',${idx})">Edit</button><button class="secondary" onclick="deleteRecord('meeting',${idx})">Delete</button><button class="secondary" onclick="sendMeetingWhatsApp(${idx})">WhatsApp</button></div></div>`;}).join("")}</div>`:`<div class="empty">No meetings scheduled for this client yet.</div>`}
  </div>
 </div>`:`<div class="panel"><div class="empty">Please create a client first.</div></div>`}`;
 if(selected) document.getElementById("clientManagementSelect").value=selected.id;
}
function selectClientManagement(clientId){ window.clientManagementSelectedId=clientId; clientManagement(); }
function meetingWhatsAppUrl(m){
 const client=state.clients.find(c=>c.id===m.clientId); if(!client) return null;
 const number=normalizeWhatsApp(client.phone); if(!number) return null;
 const msg=[`Dear ${client.name},`,'',`Your meeting with the advocate's office has been scheduled.`,`Meeting: ${m.subject}`,`Date: ${fmtDate(m.date)}`,`Time: ${m.time}`,`Mode: ${m.mode}`,m.location?`Location: ${m.location}`:'',m.agenda?`Agenda: ${m.agenda}`:'',m.details?`Details: ${m.details}`:'','',`Please contact the office if you need to reschedule.`].filter(Boolean).join("\n");
 return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}
function sendMeetingWhatsApp(index){
 const m=state.meetings[index]; if(!m) return;
 const client=state.clients.find(c=>c.id===m.clientId); const url=meetingWhatsAppUrl(m);
 if(!client){alert("No client is linked to this meeting.");return;}
 if(!url){alert(`No valid WhatsApp/mobile number is available for ${client.name}. Please update the client record.`);return;}
 window.open(url,"_blank","noopener,noreferrer");
}
function calendarModuleMarkup(date, showBack=true){
  const day=String(date||new Date().toISOString().slice(0,10)).slice(0,10);
  const label=new Date(day+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const events=calendarEventsForDate(day);
  return `<div class="panel same-day-calendar calendar-module-panel"><div class="panel-head"><div><h3>Today's Calendar</h3><span>${label}</span></div>${showBack?`<button class="secondary" onclick="navigate('dashboard')">Back to dashboard</button>`:""}</div><div class="list">${events.length?events.map(e=>`<div class="list-row"><div class="date-box"><b>${e.type==="hearing"?"⚖":e.type==="meeting"?"☏":"✓"}</b><small>${esc(e.type)}</small></div><div class="list-main"><strong>${esc(e.title)}</strong><small>${esc(e.time||"All day")}${e.meta?" • "+esc(e.meta):""}</small></div>${badge(e.type==="hearing"?"Hearing":e.type==="meeting"?"Meeting":"Task")}</div>`).join(""):`<div class="empty">No hearings, meetings or pending tasks scheduled for today.</div>`}</div></div>`;
}
function calendar(){
  /* The Calendar module has its own full month-grid renderer in calendar.js.
     Always delegate to it when available so SPA navigation cannot fall back
     to the older same-day calendar markup. */
  if(typeof window.calendar==="function"){
    window.calendar();
    return;
  }
  const today=new Date().toISOString().slice(0,10);
  content.innerHTML=layout("Calendar","Court hearings, appointments and deadlines")+calendarModuleMarkup(today,true);
}
/* Client-side file signature preflight is defense in depth only; the browser can be bypassed. */
async function validateDocumentFileSignature(file){
 const bytes=new Uint8Array(await file.arrayBuffer());
 const starts=(sig)=>sig.every((v,i)=>bytes[i]===v);
 const mime=String(file.type||"").toLowerCase();
 if(mime==="application/pdf"){
  const head=new TextDecoder("latin1").decode(bytes.slice(0,1024));
  return head.includes("%PDF-");
 }
 if(mime==="image/png")return starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
 if(mime==="image/jpeg"){
  if(!starts([0xff,0xd8,0xff]))return false;
  const tail=new Uint8Array(await file.slice(Math.max(0,file.size-2)).arrayBuffer());
  return tail.length===2&&tail[0]===0xff&&tail[1]===0xd9;
 }
 if(mime==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
  if(!starts([0x50,0x4b,0x03,0x04]))return false;
  const zipHeader=new TextDecoder("latin1").decode(bytes);
  return zipHeader.includes("[Content_Types].xml")&&zipHeader.includes("word/document.xml");
 }
 return false;
}
async function documents(){
 const workspaceId=String(auth.workspaceId||"");
 const cloud=!!auth.cloudAuth&&!!workspaceId;
 content.innerHTML=layout("Documents","Secure digital case files and document workspace",`openModal('document')`)+
 `<div class="cards"><div class="stat"><div class="stat-top">Case Documents</div><div class="stat-value" id="documentCount">—</div><div class="stat-foot">Private workspace files</div></div><div class="stat"><div class="stat-top">Allowed Formats</div><div class="stat-value">4</div><div class="stat-foot">PDF, DOCX, JPG, PNG · 20 MB max</div></div></div><div class="panel" id="documentsPanel"><div class="empty">${cloud?"Loading secure documents…":"Sign in to a cloud workspace to manage secure documents."}</div></div>`;
 if(!cloud)return;
 try{
  const result=await ADAuth.client().from("case_documents").select("id,workspace_id,case_id,document_name,category,original_file_name,mime_type,file_size,uploaded_by,created_at,storage_path").eq("workspace_id",workspaceId).order("created_at",{ascending:false});
  if(result.error)throw result.error;
  const rows=Array.isArray(result.data)?result.data:[];
  const panel=document.getElementById("documentsPanel"),count=document.getElementById("documentCount");
  if(!panel)return;if(count)count.textContent=String(rows.length);
  panel.innerHTML=rows.length?`<div style="overflow-x:auto"><table><thead><tr><th>Document</th><th>Case</th><th>Category</th><th>Uploaded</th><th>Size</th><th>Actions</th></tr></thead><tbody>${rows.map(d=>{const c=state.cases.find(x=>String(x.id)===String(d.case_id)||String(x.number)===String(d.case_id));return `<tr><td><strong>${esc(d.document_name)}</strong><br><small>${esc(d.original_file_name)}</small></td><td>${esc(c?.number||d.case_id)}</td><td>${esc(d.category)}</td><td>${esc(new Date(d.created_at).toLocaleDateString("en-IN"))}</td><td>${(Number(d.file_size)/1048576).toFixed(2)} MB</td><td><button class="secondary" onclick="openCaseDocument('${esc(d.id)}')">Preview / Download</button> <button class="secondary" onclick="deleteCaseDocument('${esc(d.id)}')">Delete</button></td></tr>`}).join("")}</tbody></table></div>`:`<div class="empty">No documents uploaded yet. Use “Add Document” to upload a case file securely.</div>`;
 }catch(error){console.error("Document list failed",error);const panel=document.getElementById("documentsPanel");if(panel)panel.innerHTML=`<div class="empty">Could not load documents: ${esc(error?.message||"Please check access and connection.")}</div>`;}
}
window.openCaseDocument=async function(id){
 const popup=window.open("about:blank","_blank");if(!popup){alert("Please allow pop-ups to open the secure document.");return;}
 try{const client=ADAuth.client(),workspaceId=String(auth.workspaceId||"");if(!auth.cloudAuth||!workspaceId)throw new Error("Sign in to the correct cloud workspace.");const q=await client.from("case_documents").select("storage_path,original_file_name").eq("id",id).eq("workspace_id",workspaceId).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("Document not found or access denied.");const r=await client.storage.from("advocatedesk-documents").createSignedUrl(q.data.storage_path,60);if(r.error)throw r.error;if(!r.data?.signedUrl)throw new Error("Could not create a secure download link.");popup.location.replace(r.data.signedUrl);}catch(e){popup.close();alert("Unable to open document: "+(e?.message||"Please try again."));}
};
window.deleteCaseDocument=async function(id){
 if(!confirm("Delete this document permanently?"))return;
 try{const c=ADAuth.client(),workspaceId=String(auth.workspaceId||"");if(!auth.cloudAuth||!workspaceId)throw new Error("Sign in to the correct cloud workspace.");const q=await c.from("case_documents").select("storage_path").eq("id",id).eq("workspace_id",workspaceId).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("Document not found or access denied.");const removed=await c.storage.from("advocatedesk-documents").remove([q.data.storage_path]);if(removed.error){console.error("Document storage removal failed; metadata retained for retry",removed.error);throw new Error("The stored file could not be removed. The document record was kept; please retry.");}const del=await c.from("case_documents").delete().eq("id",id).eq("workspace_id",workspaceId).select("id").maybeSingle();if(del.error)throw del.error;if(!del.data)throw new Error("The file was removed, but its record could not be deleted. Refresh and retry cleanup.");await documents();}catch(e){alert("Unable to delete document: "+(e?.message||"Please try again."));}
};
async function uploadCaseDocument(){
 const name=String(document.getElementById("documentName")?.value||"").trim(),caseId=String(document.getElementById("documentCaseInput")?.value||"").trim(),category=String(document.getElementById("documentCategory")?.value||"Other"),file=document.getElementById("documentFile")?.files?.[0];
 const selected=state.cases.find(c=>String(c.id)===caseId||String(c.number)===caseId);
 if(!name){alert("Enter a document name.");return;}if(!selected){alert("Select a valid case from the case list.");return;}if(!file){alert("Choose a file to upload.");return;}
 const allowed=["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/png"];
 if(!allowed.includes(file.type)){alert("Only PDF, DOCX, JPG and PNG files are allowed.");return;}if(file.size<=0||file.size>20971520){alert("File must be smaller than or equal to 20 MB.");return;}if(!(await validateDocumentFileSignature(file))){alert("The selected file content does not match a supported PDF, DOCX, JPG or PNG document. Please choose a valid file.");return;}
 const workspaceId=String(auth.workspaceId||"");if(!auth.cloudAuth||!workspaceId){alert("Secure document upload requires an authenticated cloud workspace.");return;}
 const btn=document.getElementById("uploadDocumentButton");if(btn){btn.disabled=true;btn.textContent="Uploading…";}
 const client=ADAuth.client(),id=(function(){if(window.crypto&&typeof window.crypto.randomUUID==="function")return window.crypto.randomUUID();const b=new Uint8Array(16);if(window.crypto&&typeof window.crypto.getRandomValues==="function")window.crypto.getRandomValues(b);else for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)})(),safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-150)||"document",path=workspaceId+"/"+id+"/"+safeName;
 try{
  const userResult=await client.auth.getUser();if(userResult.error)throw userResult.error;if(!userResult.data?.user?.id)throw new Error("Your cloud session has expired. Sign in again.");
  const upload=await client.storage.from("advocatedesk-documents").upload(path,file,{contentType:file.type,upsert:false});if(upload.error)throw upload.error;
  const meta=await client.from("case_documents").insert({id,workspace_id:workspaceId,case_id:String(selected.id||selected.number),document_name:name,category,original_file_name:file.name,mime_type:file.type,file_size:file.size,uploaded_by:userResult.data.user.id,storage_path:path}).select("id").single();
  if(meta.error){await client.storage.from("advocatedesk-documents").remove([path]);throw meta.error;}
  closeModal();documents();
 }catch(e){console.error("Document upload failed",e);alert("Upload failed: "+(e?.message||"Please verify storage setup and access policies."));}
 finally{if(btn){btn.disabled=false;btn.textContent="Upload Document";}}
}
function tasks(){
 content.innerHTML=layout("Tasks","Work assigned across your practice",`openModal('task')`)+
 `<div class="panel"><table id="taskTable"><thead><tr><th>Task</th><th>Case</th><th>Due</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.tasks.map((t,i)=>`<tr><td><strong>${esc(t.title)}</strong></td><td>${esc(t.case)}</td><td>${fmtDate(t.due)}</td><td>${badge(t.priority)}</td><td>${badge(t.status)}</td><td><button class="secondary" onclick="openEditModal('task',${i})">Edit</button><button class="secondary" onclick="deleteRecord('task',${i})">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
}
window.selectedFinanceClient=window.selectedFinanceClient||"";
window.filterFinanceClient=function(value){const typed=String(value||"").trim();const clients=[...new Set(state.invoices.map(x=>x.client||"Unknown Client"))];const exact=clients.find(c=>c.toLowerCase()===typed.toLowerCase());window.selectedFinanceClient=exact||typed;finance();};
function finance(){
 const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
 const total=state.invoices.reduce((a,x)=>a+Number(x.amount||0),0);
 const paid=state.invoices.reduce((a,x)=>a+Number(x.paid||0),0);
 const outstanding=state.invoices.reduce((sum,x)=>sum+Math.max(0,Number(x.amount||0)-Number(x.paid||0)),0);
 content.innerHTML=layout("Billing & Accounts","Track invoices, client fees and outstanding payments",`openModal('invoice')`)+`<div style="margin:12px 0"><button class="secondary" onclick="openModal('payment')">＋ Record Payment</button></div>`+
 `<div class="cards"><div class="stat"><div class="stat-top">Total Invoiced</div><div class="stat-value">${money(total)}</div><div class="stat-foot">All invoices</div></div><div class="stat"><div class="stat-top">Collected</div><div class="stat-value">${money(paid)}</div><div class="stat-foot">Payments received</div></div><div class="stat"><div class="stat-top">Outstanding</div><div class="stat-value">${money(outstanding)}</div><div class="stat-foot">Receivables</div></div></div>
 <div class="panel"><table class="finance-main-table"><thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Paid</th><th>Status</th><th>Action</th></tr></thead><tbody>${state.invoices.map((x,i)=>`<tr><td><strong>${esc(x.id)}</strong><br><small>${fmtDate(x.date)}</small></td><td>${esc(x.client)}</td><td>${money(x.amount)}</td><td>${money(x.paid)}</td><td>${badge(x.status)}</td><td><div class="table-actions"><button class="secondary" onclick="openEditModal('invoice',${i})">Edit</button><button class="secondary" onclick="deleteRecord('invoice',${i})">Delete</button><button class="secondary" onclick="printInvoice(${i})">Print</button><button class="secondary" onclick="saveInvoice(${i})">Save</button><button class="secondary" onclick="sendInvoiceWhatsApp(${i})">WhatsApp</button></div></td></tr>`).join("")}</tbody></table></div><div class="panel" style="margin-top:18px"><div class="panel-head"><h3>Client-wise Payment Record</h3><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span>Invoice-wise and date-wise payment details</span><input list="finance-client-options" value="${esc(window.selectedFinanceClient||"")}" placeholder="Type client name..." aria-label="Select client by typing" style="min-width:220px" onchange="filterFinanceClient(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();filterFinanceClient(this.value)}"><datalist id="finance-client-options"><option value="">All Clients</option>${[...new Set(state.invoices.map(x=>x.client||"Unknown Client"))].sort((a,b)=>String(a).localeCompare(String(b))).map(client=>`<option value="${esc(client)}"></option>`).join("")}</datalist></div></div><table class="finance-client-table"><thead><tr><th>Client / Invoice</th><th>Invoice Date</th><th>Total Amount</th><th>Paid Amount</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>${(()=>{const grouped={};state.invoices.filter(x=>!window.selectedFinanceClient||(x.client||"Unknown Client")===window.selectedFinanceClient).slice().sort((a,b)=>String(a.client||"").localeCompare(String(b.client||""))||String(a.date||"").localeCompare(String(b.date||""))).forEach(x=>{const k=x.client||"Unknown Client";(grouped[k]||(grouped[k]=[])).push(x);});let out="";Object.keys(grouped).forEach(client=>{const rows=grouped[client];const total=rows.reduce((s,x)=>s+Number(x.amount||0),0);const paid=rows.reduce((s,x)=>s+Number(x.paid||0),0);const outstanding=rows.reduce((s,x)=>s+Math.max(0,Number(x.amount||0)-Number(x.paid||0)),0);out+=`<tr class="client-group-row"><td colspan="6"><strong>${esc(client)}</strong> <small>(${rows.length} invoice${rows.length===1?"":"s"})</small></td></tr>`;out+=rows.map(x=>`<tr><td style="padding-left:28px"><strong>${esc(x.id||"Invoice")}</strong></td><td>${fmtDate(x.date)}</td><td>${money(x.amount)}</td><td>${money(x.paid)}</td><td>${money(Math.max(0,Number(x.amount||0)-Number(x.paid||0)))}</td><td>${badge(x.status||"Pending")}</td></tr>`).join("");out+=`<tr class="client-total-row"><td colspan="2" style="padding-left:28px"><strong>Total for ${esc(client)}</strong></td><td><strong>${money(total)}</strong></td><td><strong>${money(paid)}</strong></td><td><strong>${money(outstanding)}</strong></td><td></td></tr>`;});return out||`<tr><td colspan="6"><div class="empty">No client payment records available.</div></td></tr>`})()}</tbody></table></div><div class="panel" style="margin-top:18px"><div class="panel-head"><h3>Client-wise Payment Received</h3><span>Payments grouped by client and date, with current balance</span></div><table class="finance-payment-table"><thead><tr><th>Client / Payment Date</th><th>Invoice</th><th>Payment Method</th><th>Amount Received</th><th>Client Balance</th><th>Reference / Notes</th></tr></thead><tbody>${(()=>{const grouped={};state.payments.filter(p=>!window.selectedFinanceClient||(p.client||"Unknown Client")===window.selectedFinanceClient).slice().sort((a,b)=>String(a.client||"").localeCompare(String(b.client||""))||String(a.date||"").localeCompare(String(b.date||""))).forEach(p=>{const k=p.client||"Unknown Client";(grouped[k]||(grouped[k]=[])).push(p);});let out="";Object.keys(grouped).forEach(client=>{const rows=grouped[client];const invoices=state.invoices.filter(i=>(i.client||"Unknown Client")===client);const balance=invoices.reduce((sum,i)=>sum+Math.max(0,Number(i.amount||0)-Number(i.paid||0)),0);const received=rows.reduce((sum,p)=>sum+Number(p.amount||0),0);out+=`<tr class="client-group-row"><td colspan="6"><strong>${esc(client)}</strong> <small>(${rows.length} payment${rows.length===1?"":"s"})</small></td></tr>`;out+=rows.map(p=>`<tr><td style="padding-left:28px">${fmtDate(p.date)}</td><td>${esc(p.invoiceId||"—")}</td><td>${esc(p.method||"—")}</td><td><strong>${money(p.amount)}</strong></td><td>${money(balance)}</td><td>${esc(p.notes||"—")}</td></tr>`).join("");out+=`<tr class="client-total-row"><td colspan="3" style="padding-left:28px"><strong>Total received — ${esc(client)}</strong></td><td><strong>${money(received)}</strong></td><td><strong>${money(balance)} outstanding</strong></td><td></td></tr>`;});return out||`<tr><td colspan="6"><div class="empty">No payments recorded yet.</div></td></tr>`})()}</tbody></table></div>`;
}


function invoiceDetails(invoice){
  const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
  const outstanding=Math.max(0,Number(invoice.amount||0)-Number(invoice.paid||0));
  return `<div class="invoice-sheet">
    <div class="invoice-brand"><div class="brand-mark">⚖</div><div><h1>ADVOCATE PRO</h1><p>Biznexco Legal Suite</p><small>Legal Practice Management</small></div><div class="invoice-label"><strong>TAX INVOICE</strong><span>${esc(invoice.id||"—")}</span></div></div>
    <div class="invoice-rule"></div>
    <div class="invoice-meta"><div><span>Bill To</span><strong>${esc(invoice.client||"—")}</strong><p>Case: ${esc(invoice.case||"—")}</p></div><div><span>Invoice Date</span><strong>${fmtDate(invoice.date)}</strong><p>Status: <b>${esc(invoice.status||"Pending")}</b></p></div></div>
    <table class="invoice-table"><thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead><tbody>
      <tr><td>Advocate Fee</td><td class="amount">${money(invoice.advocateFee)}</td></tr>
      <tr><td>Clerk Fee</td><td class="amount">${money(invoice.clerkFee)}</td></tr>
      <tr><td>Court Fees</td><td class="amount">${money(invoice.courtFees)}</td></tr>
      <tr><td>Other Charges</td><td class="amount">${money(invoice.otherCharges)}</td></tr>
    </tbody></table>
    <div class="invoice-total"><div><span>Total Invoice Amount</span><strong>${money(invoice.amount)}</strong></div><div><span>Paid Amount</span><strong>${money(invoice.paid)}</strong></div><div class="due"><span>Balance Due</span><strong>${money(outstanding)}</strong></div></div>
    <div class="invoice-footer"><div><strong>Thank you for your trust.</strong><p>This invoice is issued for professional legal services and related expenses.</p></div><div class="signature"><div></div><span>Authorized Signature</span></div></div>
    <div class="invoice-note">Generated by Advocate Pro · Biznexco Legal Suite</div>
  </div>`;
}
function invoicePrintHtml(invoice){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.id||"Invoice")} - Professional Invoice</title><style>
  @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172033;font-family:Arial,Helvetica,sans-serif}.invoice-sheet{width:100%;max-width:780px;margin:24px auto;background:#fff;padding:38px;border:1px solid #dce3ee;box-shadow:0 8px 30px rgba(20,40,80,.08)}.invoice-brand{display:flex;align-items:center;gap:14px}.brand-mark{width:58px;height:58px;border-radius:12px;background:#172b63;color:#f4cf76;display:flex;align-items:center;justify-content:center;font-size:31px}.invoice-brand h1{margin:0;color:#172b63;font-size:25px;letter-spacing:1px}.invoice-brand p{margin:4px 0;color:#50617d;font-size:14px;font-weight:bold}.invoice-brand small{color:#7b879b}.invoice-label{margin-left:auto;text-align:right;color:#172b63}.invoice-label strong{display:block;font-size:22px;letter-spacing:1px}.invoice-label span{display:block;margin-top:7px;color:#64748b;font-size:13px}.invoice-rule{height:4px;background:linear-gradient(90deg,#172b63,#3f78d8,#f4cf76);margin:26px 0}.invoice-meta{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:28px}.invoice-meta span{display:block;text-transform:uppercase;font-size:11px;letter-spacing:1px;color:#7b879b;margin-bottom:7px}.invoice-meta strong{font-size:17px;color:#172b63}.invoice-meta p{margin:7px 0 0;color:#52627b;font-size:13px}.invoice-table{width:100%;border-collapse:collapse;margin-top:10px}.invoice-table th{background:#172b63;color:white;padding:13px 15px;text-align:left;font-size:13px}.invoice-table td{padding:15px;border-bottom:1px solid #e4eaf2;font-size:14px}.invoice-table tbody tr:nth-child(even){background:#f8faff}.amount{text-align:right}.invoice-total{margin:24px 0 30px 42%;border:1px solid #dbe4f0;border-radius:10px;overflow:hidden}.invoice-total>div{display:flex;justify-content:space-between;gap:20px;padding:12px 16px;border-bottom:1px solid #e5ebf3;font-size:13px}.invoice-total>div:last-child{border-bottom:0}.invoice-total span{color:#64748b}.invoice-total strong{color:#172b63}.invoice-total .due{background:#edf4ff}.invoice-total .due strong{font-size:18px;color:#174ea6}.invoice-footer{display:flex;justify-content:space-between;gap:30px;margin-top:36px;color:#52627b;font-size:12px}.invoice-footer p{margin-top:7px}.signature{text-align:center;min-width:170px;padding-top:20px}.signature div{border-top:1px solid #9aa8bc;margin-bottom:8px}.signature span{font-size:11px}.invoice-note{text-align:center;border-top:1px solid #e2e8f0;margin-top:35px;padding-top:14px;color:#8a96a8;font-size:10px}@media print{body{background:#fff}.invoice-sheet{max-width:none;margin:0;border:0;box-shadow:none;padding:0}.invoice-total{margin-left:42%}}
  </style></head><body>${invoiceDetails(invoice)}</body></html>`;
}
window.printInvoice=function(index){
  const invoice=state.invoices[index];
  if(!invoice)return;
  const popup=window.open("","_blank","width=900,height=800");
  if(!popup){alert("Please allow pop-ups to print the invoice.");return;}
  popup.document.write(invoicePrintHtml(invoice));
  popup.document.close();popup.focus();setTimeout(()=>popup.print(),300);
};
window.saveInvoice=function(index){
  const invoice=state.invoices[index];
  if(!invoice)return;
  const blob=new Blob([invoicePrintHtml(invoice)],{type:"text/html;charset=utf-8"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=(invoice.id||"Invoice")+".html";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.sendInvoiceWhatsApp=function(index){
  const invoice=state.invoices[index];
  if(!invoice)return;
  const client=state.clients.find(c=>c.name===invoice.client||c.id===invoice.clientId);
  const phone=String(client?.phone||invoice.phone||"").replace(/\D/g,"");
  if(!phone){alert("This client does not have a valid WhatsApp/mobile number. Please update the client record.");return;}
  const text=`Invoice ${invoice.id}\nClient: ${invoice.client}\nCase: ${invoice.case||"—"}\nAdvocate Fee: ₹${Number(invoice.advocateFee||0).toLocaleString("en-IN")}\nClerk Fee: ₹${Number(invoice.clerkFee||0).toLocaleString("en-IN")}\nCourt Fees: ₹${Number(invoice.courtFees||0).toLocaleString("en-IN")}\nOther Charges: ₹${Number(invoice.otherCharges||0).toLocaleString("en-IN")}\nTotal: ₹${Number(invoice.amount||0).toLocaleString("en-IN")}\nPaid: ₹${Number(invoice.paid||0).toLocaleString("en-IN")}\nOutstanding: ₹${Math.max(0,Number(invoice.amount||0)-Number(invoice.paid||0)).toLocaleString("en-IN")}`;
  window.open("https://wa.me/"+phone+"?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
};

function reports(){
 document.body.classList.remove('report-mode');
 content.innerHTML=layout("Reports","Practice performance and operational reports")+`<div class="quick-grid">
 <button class="quick" onclick="openReport('cases')"><strong>Case Report</strong><small>Active, pending and disposed cases</small></button>
 <button class="quick" onclick="openReport('hearings')"><strong>Hearing Report</strong><small>Upcoming and completed hearings</small></button>
 <button class="quick" onclick="openReport('clients')"><strong>Client Report</strong><small>Client-wise case activity</small></button>
 <button class="quick" onclick="openReport('finance')"><strong>Financial Report</strong><small>Fees, expenses and balances</small></button>
 <button class="quick" onclick="openReport('case360')"><strong>Case 360° Report</strong><small>Complete connected report for a selected case</small></button>
 </div>`;
}
function reportShell(title,subtitle,body){
 document.body.classList.add('report-mode');
 content.innerHTML=`<div class="report-page"><header class="report-header"><div class="report-brand"><div class="report-logo">⚖</div><div><strong>AdvocateDesk</strong><span>Practice Management</span></div></div><div class="report-heading"><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="report-actions"><button class="secondary" onclick="reports()">← Reports</button><button class="primary" onclick="window.print()">🖨 Print / Save PDF</button></div></header><main class="report-content">${body}</main><footer class="report-footer"><span>AdvocateDesk · Confidential Office Report</span><span>Generated on ${new Date().toLocaleDateString('en-IN')}</span></footer></div>`;
}
function openReport(type){
 const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
 if(type==='cases'){
  reportShell('Case Report','All cases with current status',`<table><thead><tr><th>Case Number</th><th>Title</th><th>Client</th><th>Court</th><th>Type</th><th>Status</th></tr></thead><tbody>${state.cases.map(c=>`<tr><td><strong>${esc(c.number||'—')}</strong></td><td>${esc(c.title||'—')}</td><td>${esc(c.client||'—')}</td><td>${esc(c.court||'—')}</td><td>${esc(c.type||'—')}</td><td>${badge(c.status||'Pending')}</td></tr>`).join('')}</tbody></table>`);
 }else if(type==='hearings'){
  reportShell('Hearing Report','All scheduled hearings, ordered by date',`<table><thead><tr><th>Date</th><th>Time</th><th>Case</th><th>Stage</th><th>Court</th></tr></thead><tbody>${state.hearings.slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).map(h=>`<tr><td>${fmtDate(h.date)}</td><td>${esc(h.time||'—')}</td><td>${esc(h.case||h.title||'—')}</td><td>${esc(h.stage||'—')}</td><td>${esc(h.court||'—')}</td></tr>`).join('')}</tbody></table>`);
 }else if(type==='clients'){
  reportShell('Client Report','Client-wise case activity',`<table><thead><tr><th>Client</th><th>Role</th><th>Phone</th><th>Email</th><th>Linked Cases</th><th>Status</th></tr></thead><tbody>${state.clients.map(c=>`<tr><td><strong>${esc(c.name||'—')}</strong></td><td>${esc(c.role||'Party')}</td><td>${esc(c.phone||'—')}</td><td>${esc(c.email||'—')}</td><td>${esc(state.cases.filter(x=>Array.isArray(x.clientIds)?x.clientIds.includes(c.id):(x.clientId===c.id||x.client===c.name||(Array.isArray(x.clients)&&x.clients.includes(c.name)))).length)}</td><td>${badge(c.status||'Active')}</td></tr>`).join('')}</tbody></table>`);
 }else if(type==='finance'){
  const clientNames=[...new Set(state.invoices.map(x=>String(x.client||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const options=clientNames.map(name=>`<option value="${esc(name)}"></option>`).join('');
  reportShell('Financial Report','Select a client to view invoices, payments and outstanding balances',`<div class="report-filter"><div class="field"><label for="financialClientSearch">Client name</label><input id="financialClientSearch" list="financialClientOptions" placeholder="Type or select client name..." autocomplete="off"><datalist id="financialClientOptions">${options}</datalist></div><button class="primary" onclick="generateFinancialReport(document.getElementById('financialClientSearch').value)">View Client Report</button></div><div id="financialClientReport" class="report-empty"><p>Select a client and click <strong>View Client Report</strong> to generate the financial report.</p></div>`);
 }else if(type==='case360'){
  const options=state.cases.map(c=>`<option value="${esc(c.number||c.id)} — ${esc(c.client||c.title||'No client')}"></option>`).join('');
  reportShell('Case 360° Report','Search and select a case by client name or case number',`<div class="field"><label>Client name / Case number</label><input id="reportCaseSearch" list="reportCaseOptions" placeholder="Type client name or case number..." autocomplete="off"><datalist id="reportCaseOptions">${options}</datalist><small style="display:block;margin-top:6px;color:#667085">Start typing to find the client or case number.</small></div><br><button class="primary" onclick="generateCase360Report(document.getElementById('reportCaseSearch').value)">Generate Case 360° Report</button>`);
 }
}
function generateFinancialReport(clientQuery){
 const query=String(clientQuery||'').trim().toLowerCase();
 if(!query){alert('Please type or select a client name.');return;}
 const invoices=state.invoices.filter(x=>String(x.client||'').trim().toLowerCase()===query);
 if(!invoices.length){alert('No invoices found for the selected client.');return;}
 const client=String(invoices[0].client||clientQuery).trim();
 const money=v=>"₹"+Number(v||0).toLocaleString('en-IN');
 const outstanding=x=>Math.max(0,Number(x.amount||0)-Number(x.paid||0));
 const total=invoices.reduce((a,x)=>a+Number(x.amount||0),0);
 const paid=invoices.reduce((a,x)=>a+Number(x.paid||0),0);
 const due=Math.max(0,total-paid);
 const rows=invoices.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(x=>`<tr><td><strong>${esc(x.id||'—')}</strong></td><td>${fmtDate(x.date)}</td><td>${esc(x.case||x.caseNumber||'—')}</td><td>${money(x.amount)}</td><td>${money(x.paid)}</td><td>${money(outstanding(x))}</td><td>${badge(x.status|| (outstanding(x)?'Pending':'Paid'))}</td></tr>`).join('');
 const target=document.getElementById('financialClientReport');
 if(target)target.innerHTML=`<div class="report-selection-summary"><strong>Client:</strong> ${esc(client)} <span>${invoices.length} invoice${invoices.length===1?'':'s'}</span></div><div class="cards"><div class="stat"><div class="stat-top">Total Invoiced</div><div class="stat-value">${money(total)}</div></div><div class="stat"><div class="stat-top">Collected</div><div class="stat-value">${money(paid)}</div></div><div class="stat"><div class="stat-top">Outstanding</div><div class="stat-value">${money(due)}</div></div></div><table><thead><tr><th>Invoice</th><th>Date</th><th>Case</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">${esc(client)} Total</th><th>${money(total)}</th><th>${money(paid)}</th><th>${money(due)}</th><th></th></tr></tfoot></table>`;
}

function generateCase360Report(id){
 const query=String(id||'').trim().toLowerCase();
 const c=state.cases.find(x=>String(x.id||'').toLowerCase()===query||String(x.number||'').toLowerCase()===query||String(x.client||'').toLowerCase()===query||`${x.number||x.id} — ${x.client||x.title||'No client'}`.toLowerCase()===query||String(x.number||'').toLowerCase().includes(query)||String(x.client||'').toLowerCase().includes(query));
 if(!c){alert('Please type or select a valid client name or case number.');return;}
 const parties=state.clients.filter(x=>x.id===c.clientId||x.name===c.client||(Array.isArray(c.clientIds)&&c.clientIds.includes(x.id)));
 const match=arr=>arr.filter(x=>x.caseId===c.id||x.caseNumber===c.number||x.case===c.id||x.case===c.number||x.case===c.title);
 const hearings=match(state.hearings), tasks=match(state.tasks), invoices=state.invoices.filter(x=>x.case===c.id||x.case===c.number||x.case===c.title||x.caseId===c.id||x.caseNumber===c.number);
 const money=v=>"₹"+Number(v||0).toLocaleString('en-IN');
 reportShell('Case 360° Report',c.number||'Complete case report',`<h2>${esc(c.number||'Case')} — ${esc(c.title||'Untitled case')}</h2><p><strong>Court:</strong> ${esc(c.court||'—')} &nbsp; <strong>Status:</strong> ${esc(c.status||'—')} &nbsp; <strong>Type:</strong> ${esc(c.type||'—')}</p><h3>Clients / Parties</h3><table><thead><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th></tr></thead><tbody>${parties.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.role||'Party')}</td><td>${esc(p.phone||'—')}</td><td>${esc(p.email||'—')}</td></tr>`).join('')||'<tr><td colspan="4">No linked clients.</td></tr>'}</tbody></table><h3>Hearings</h3><table><thead><tr><th>Date</th><th>Time</th><th>Stage</th><th>Court</th></tr></thead><tbody>${hearings.map(h=>`<tr><td>${fmtDate(h.date)}</td><td>${esc(h.time||'—')}</td><td>${esc(h.stage||h.purpose||'Hearing')}</td><td>${esc(h.court||c.court||'—')}</td></tr>`).join('')||'<tr><td colspan="4">No hearings.</td></tr>'}</tbody></table><h3>Tasks</h3><table><thead><tr><th>Task</th><th>Due Date</th><th>Priority</th><th>Status</th></tr></thead><tbody>${tasks.map(t=>`<tr><td>${esc(t.title||'Task')}</td><td>${fmtDate(t.due||t.dueDate)}</td><td>${esc(t.priority||'—')}</td><td>${esc(t.status||'—')}</td></tr>`).join('')||'<tr><td colspan="4">No tasks.</td></tr>'}</tbody></table><h3>Finance</h3><table><thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th>Total</th><th>Paid</th><th>Outstanding</th></tr></thead><tbody>${invoices.map(x=>`<tr><td>${esc(x.id||'—')}</td><td>${fmtDate(x.date)}</td><td>${esc(x.client||'—')}</td><td>${money(x.amount)}</td><td>${money(x.paid)}</td><td>${money(Math.max(0,Number(x.amount||0)-Number(x.paid||0)))}</td></tr>`).join('')||'<tr><td colspan="6">No invoices or payments.</td></tr>'}</tbody></table>`);
}
function settings(){
 const photo=getAdvocatePhoto();
 content.innerHTML=layout("Settings","Workspace, profile and application settings")+`<div class="grid-2"><div class="panel"><div class="panel-head"><h3>Advocate Profile</h3></div><div class="advocate-profile-settings"><div class="advocate-profile-preview-wrap">${photo?`<img id="advocateProfilePreview" src="${photo}" alt="Advocate profile photo">`:`<span>${esc((auth.name||"A").slice(0,1).toUpperCase())}</span>`}</div><div class="advocate-profile-info"><strong>${esc(auth.name||"Advocate")}</strong><small>${esc(auth.email||"")}</small><label class="secondary advocate-photo-upload">Choose Profile Photo<input type="file" accept="image/*" onchange="saveAdvocateProfilePhoto(this)"></label>${photo?`<button type="button" class="secondary" onclick="removeAdvocateProfilePhoto()">Remove Photo</button>`:""}<small class="profile-photo-help">Shown on your Dashboard banner. Stored locally in this browser until Supabase profile storage is connected.</small></div></div></div><div class="grid-2"><div class="panel"><div class="panel-head"><h3>Workspace</h3></div><div style="padding:18px"><div class="field"><label>Law Office / Practice Name</label><input value="AdvocateDesk Demo Office"></div><br><div class="field"><label>Default Court</label><input value="District Court, Kozhikode"></div></div></div><div class="panel"><div class="panel-head"><h3>Next Phase</h3></div><div style="padding:18px;font-size:12px;color:#667085;line-height:1.7">Supabase authentication, PostgreSQL records, role permissions, secure document storage and audit logs will be connected after the GitHub frontend is approved.</div></div></div>`;
}
const pages={dashboard,"case-client":caseClient,"case-details":caseDetails,cases,clients,"client-management":clientManagement,hearings,calendar,documents,tasks,finance,reports,settings};
if(auth.role==="super_admin") pages["central-control"]=function(){
  content.innerHTML=layout("Central Control","System-wide administration across all organizations")+`<div class="admin-grid"><div class="admin-card admin-card-super"><div class="admin-card-icon">👑</div><div><h3>Super Admin</h3><p>Full platform-wide control across every organization and law office.</p></div><span class="role-badge">FULL CONTROL</span></div><div class="admin-card admin-card-admin"><div class="admin-card-icon">🛡️</div><div><h3>Admin</h3><p>Office-level control for authorized users, cases, clients and operations.</p></div><span class="role-badge">OFFICE CONTROL</span></div></div><div class="panel central-panel"><div class="panel-head"><div><h3>Organizations & Administrators</h3><span>Central account control</span></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
 <button class="secondary" onclick="addSuperAdminDemo()">＋ Create Super Admin</button>
 <button class="primary" onclick="addAdminDemo()">＋ Create Admin</button>
 </div></div><table id="centralControlTable"><thead><tr><th>Organization</th><th>Administrator</th><th>Email / Role</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table></div><div class="admin-control-grid"><div class="control-tile"><strong>🏢 Organizations</strong><span>Create and manage law offices.</span></div><div class="control-tile"><strong>👥 Users & Roles</strong><span>Control Admin, Advocate, Clerk, Accountant and Staff access.</span></div><div class="control-tile"><strong>🔐 Security</strong><span>Global authentication and security policies.</span></div><div class="control-tile"><strong>📋 Audit Logs</strong><span>Review important administrator activity.</span></div><div class="control-tile"><strong>💾 Data Policies</strong><span>Manage backup and retention policies.</span></div><div class="control-tile"><strong>⚙ System Settings</strong><span>Configure global platform defaults.</span></div></div>`;
  const tbody=document.querySelector("#centralControlTable tbody");
  if(tbody){
    const created=getDemoUsers().filter(u=>u&&((u.role==="admin")||(u.role==="super_admin")));
    const rows=[{role:"admin",name:"Advocate Admin",email:"admin@advocatedesk.local",organization:"Demo Law Office"}].concat(created);
    const seen={};
    tbody.innerHTML=rows.filter(u=>{
      const key=String(u.email||u.name||"").trim().toLowerCase();
      if(seen[key]) return false; seen[key]=true; return true;
    }).map(u=>{
      const isSuper=u.role==="super_admin";
      const org=u.organization||u.officeName||u.office||"Law Office";
      const status=String(u.status||"Active");
      const userIndex=created.indexOf(u);
      const editButton=(!isSuper && userIndex>=0)?'<button type="button" class="secondary" style="padding:6px 12px;font-size:12px" onclick="editAdminDemo('+userIndex+')">Edit</button>':"—";
      return '<tr><td><strong>'+esc(org)+'</strong></td><td><strong>'+esc(u.name||"Administrator")+'</strong></td><td>'+badge(status)+'</td><td>'+editButton+'</td></tr>';
    }).join("");
  }
   renderPlatformAccounts();
   refreshPlatformAccounts().catch(function(e){const el=document.getElementById("centralAccountStatus");if(el)el.textContent="Could not load cloud accounts: "+(e.message||"Unknown error");});
};
function navigate(page,fromHistory){
  if(!pages[page]) return;
  if(page!=="case-details") window.case360ActiveCaseId=null;
  // Persist the active SPA route so refresh restores the same module. Normal
  // module clicks create browser history entries; Back/Forward replays them.
  try{sessionStorage.setItem("advocateDeskCurrentPage",page)}catch(e){}
  try{localStorage.setItem("advocateDeskCurrentPage",page)}catch(e){}
  try{
    if(location.hash!=="#"+page){
      if(fromHistory) history.replaceState(null,"","#"+page);
      else history.pushState(null,"","#"+page);
    }
  }catch(e){}
  if(page!=="reports") document.body.classList.remove("report-mode");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  pages[page]();

  /* When returning from Calendar (or any other SPA page), rebuild the
     Dashboard calendar immediately without requiring a browser refresh. */
  if(page==="dashboard"){
    const restoreDashboardCalendar=function(){
      try{
        const target=document.getElementById("dashboard-calendar-module");
        if(target && typeof window.renderDashboardTodayCalendarInto==="function"){
          window.renderDashboardTodayCalendarInto(target);
        }
      }catch(e){}
    };
    if(typeof window.requestAnimationFrame==="function") window.requestAnimationFrame(restoreDashboardCalendar);
    else setTimeout(restoreDashboardCalendar,0);
  }

  setMobileMenu(false)
}
function getDemoUsers(){try{return JSON.parse(localStorage.getItem("advocateDeskUsers")||"[]")}catch(e){return []}}
function saveDemoUsers(users){try{localStorage.setItem("advocateDeskUsers",JSON.stringify(users));return true}catch(e){return false}}
function closeAdminEdit(){
  const modal=document.getElementById("adminEditModal");
  if(modal) modal.remove();
}
function saveAdminEdit(index){
  if(auth.role!=="super_admin"){alert("Only Super Admin can edit Admin accounts.");return}
  const users=getDemoUsers();
  const user=users[index];
  if(!user || user.role!=="admin"){alert("Admin account not found.");return}
  const name=String(document.getElementById("editAdminName")?.value||"").trim();
  const email=String(document.getElementById("editAdminEmail")?.value||"").trim();
  const password=String(document.getElementById("editAdminPassword")?.value||"");
  const organization=String(document.getElementById("editAdminOffice")?.value||"").trim();
  const status=String(document.getElementById("editAdminStatus")?.value||"Active");
  if(!name||!email){alert("Admin name and email are required.");return}
  const duplicate=users.some((u,i)=>i!==index&&String(u.email||"").trim().toLowerCase()===email.toLowerCase());
  if(duplicate){alert("An account with this email already exists.");return}
  user.name=name;
  user.email=email;
  user.organization=organization||"Law Office";
  user.status=status;
  if(password.trim()) user.password=password;
  if(!user.workspaceId) user.workspaceId="ws_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);
  if(!saveDemoUsers(users)){alert("Could not save the Admin account in this browser.");return}
  if(String(auth.workspaceId||"")===String(user.workspaceId||"")){
    auth.name=user.name;
    auth.email=user.email;
    try{localStorage.setItem("advocateDeskAuth",JSON.stringify(auth))}catch(e){}
  }
  closeAdminEdit();
  pages["central-control"]();
}
function editAdminDemo(index){
  if(auth.role!=="super_admin"){alert("Only Super Admin can edit Admin accounts.");return}
  const users=getDemoUsers();
  const user=users[index];
  if(!user || user.role!=="admin"){alert("Admin account not found.");return}
  const escHtml=v=>esc(String(v==null?"":v));
  const createdDate=user.createdAt?new Date(user.createdAt).toLocaleString():"Not available";
  const modal=document.createElement("div");
  modal.id="adminEditModal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(15,23,42,.38);display:flex;align-items:center;justify-content:center;padding:20px;z-index:9999;";
  modal.innerHTML=`
    <div style="width:min(520px,100%);background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.22);overflow:hidden;">
      <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
        <div><h3 style="margin:0;color:#172554;">Edit Admin Account</h3><small style="color:#667085;">Account settings only — practice records are unchanged.</small></div>
        <button type="button" class="secondary" onclick="closeAdminEdit()" style="padding:6px 10px;">×</button>
      </div>
      <div style="padding:20px;display:grid;gap:14px;">
        <div class="field"><label>Admin Name</label><input id="editAdminName" value="${escHtml(user.name)}"></div>
        <div class="field"><label>Email</label><input id="editAdminEmail" type="email" value="${escHtml(user.email)}"></div>
        <div class="field"><label>New Password <small style="color:#667085;">(leave blank to keep current)</small></label><input id="editAdminPassword" type="password" value=""></div>
        <div class="field"><label>Office / Organization</label><input id="editAdminOffice" value="${escHtml(user.organization||user.officeName||user.office||"Law Office")}"></div>
        <div class="field"><label>Status</label><select id="editAdminStatus"><option value="Active"${String(user.status||"Active")==="Active"?" selected":""}>Active</option><option value="Suspended"${String(user.status)==="Suspended"?" selected":""}>Suspended</option></select></div>
        <div style="font-size:12px;color:#667085;">Created: ${escHtml(createdDate)}</div>
      </div>
      <div style="padding:14px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" class="secondary" onclick="closeAdminEdit()">Cancel</button>
        <button type="button" class="primary" onclick="saveAdminEdit(${index})">Save Changes</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click",e=>{if(e.target===modal)closeAdminEdit()});
}
async function refreshPlatformAccounts(){
 if(auth.role!=="super_admin")throw new Error("Only Super Admin can view platform accounts.");
 const r=await ADAuth.client().functions.invoke("advocatedesk-provision-user",{body:{action:"list_admins"}});
 if(r.error)throw r.error;if(r.data&&r.data.error)throw new Error(r.data.error);
 window.ADPlatformAccounts=Array.isArray(r.data.users)?r.data.users:[];
 renderPlatformAccounts();return window.ADPlatformAccounts;
}
function renderPlatformAccounts(){
 const tbody=document.querySelector("#centralControlTable tbody");if(!tbody)return;
 const users=window.ADPlatformAccounts||[];
 tbody.innerHTML=users.length?users.map(u=>{const ws=(u.workspaces||[]).map(w=>w.name).join(", ")||(u.role==="super_admin"?"Platform":"—");return '<tr><td><strong>'+esc(ws)+'</strong></td><td><strong>'+esc(u.name||"Administrator")+'</strong></td><td>'+esc(u.email||"—")+'<br><small>'+esc(u.role==="super_admin"?"Super Admin":"Admin")+'</small></td><td>'+badge(u.status||"Unknown")+'</td><td>Managed in Supabase</td></tr>';}).join(""):'<tr><td colspan="5">No cloud administrator accounts found.</td></tr>';
 const el=document.getElementById("centralAccountStatus");if(el)el.textContent="Showing "+users.length+" account(s) from Supabase. Browser demo entries are excluded.";
}
async function provisionPlatformUser(action){
 if(auth.role!=="super_admin"){alert("Only Super Admin can provision platform accounts.");return;}
 const name=prompt("Full name:");if(!name||!name.trim())return;
 const email=prompt("Email address:");if(!email||!email.trim())return;
 let workspace_name="";if(action==="invite_admin"){workspace_name=prompt("Law office / workspace name:");if(!workspace_name||!workspace_name.trim())return;}
 try{const r=await ADAuth.client().functions.invoke("advocatedesk-provision-user",{body:{action,email:email.trim(),full_name:name.trim(),workspace_name:workspace_name.trim()}});
 if(r.error)throw r.error;if(r.data&&r.data.error)throw new Error(r.data.error);
 alert("Invitation sent to "+email.trim()+". The user must complete the email invitation before signing in.");await refreshPlatformAccounts();
 }catch(e){let detail=e&&e.message?e.message:"Unknown error";try{const response=e&&e.context;if(response&&typeof response.clone==="function"){const body=await response.clone().json();if(body&&body.error)detail=body.error;else if(body&&body.message)detail=body.message;}}catch(_parseError){}const normalized=detail.toLowerCase();if(normalized.includes("already")||normalized.includes("registered")||normalized.includes("exists")){try{const users=await refreshPlatformAccounts();const existing=users.find(u=>(u.email||"").toLowerCase()===email.trim().toLowerCase());if(existing){alert("This email already has a platform account. Current status: "+existing.status+". No duplicate account was created.");return;}}catch(_refreshError){}alert("This email may already be registered in Supabase. Check the Central Control account list before retrying. Details: "+detail);return;}alert("Could not create account: "+detail);}
}
function addSuperAdminDemo(){provisionPlatformUser("invite_super_admin");}
function addAdminDemo(){provisionPlatformUser("invite_admin");}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
const mobileMenu=document.getElementById("mobileMenu");
const mobileOverlay=document.getElementById("mobileOverlay");
function setMobileMenu(open){
  const sidebar=document.querySelector(".sidebar");
  if(!sidebar) return;
  sidebar.classList.toggle("open",!!open);
  if(mobileOverlay){ mobileOverlay.classList.toggle("open",!!open); mobileOverlay.setAttribute("aria-hidden",open?"false":"true"); }
  document.body.classList.toggle("menu-open",!!open);
  if(mobileMenu) mobileMenu.setAttribute("aria-expanded",open?"true":"false");
}
if(mobileMenu){ mobileMenu.addEventListener("click",()=>setMobileMenu(!document.querySelector(".sidebar")?.classList.contains("open"))); }
if(mobileOverlay){ mobileOverlay.addEventListener("click",()=>setMobileMenu(false)); }
document.addEventListener("keydown",e=>{if(e.key==="Escape") setMobileMenu(false);});
document.getElementById("modalClose").onclick=()=>document.getElementById("modal").classList.add("hidden");
document.getElementById("globalSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){navigate("cases");document.getElementById("caseFilter").value=e.target.value;filterTable("caseTable",e.target.value)}});

function filterTable(id,q){q=q.toLowerCase();document.querySelectorAll(`#${id} tbody tr`).forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?"":"none")}
function openModal(type){
 const titles={case:"Create New Case",client:"Create New Client",hearing:"Schedule Hearing",task:"Create Task",document:"Add Document",discussion:"Add Client Discussion",meeting:"Schedule Client Meeting",invoice:"Create Invoice",payment:"Record Client Payment"};
 document.getElementById("modalTitle").textContent=titles[type];
 const forms={
 case:`<div class="form-grid"><div class="field"><label>Case Type</label><select id="f6" onchange="toggleCivilCategory()"><option>Civil</option><option>Criminal</option><option>Writ</option><option>Family</option></select></div><div class="field" id="civilCategoryWrap"><label>Civil Case Category</label><select id="f7"><option value="OS">OS</option><option value="OP">OP</option></select></div><div class="field" id="criminalCategoryWrap" style="display:none"><label>Criminal Case Category</label><select id="f10"><option value="CC">CC</option><option value="CP">CP</option><option value="ST">ST</option><option value="MC">MC</option></select></div><div class="field full"><label>Case Number / Year</label><input id="f11" placeholder="123/2026"></div><div class="field"><label>Clients / Parties</label><select id="f2" multiple size="4" title="Select one or more clients">${state.clients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.id)}) — ${esc(c.role||"Party")}</option>`).join("")}</select><div style="display:flex;justify-content:flex-start;margin-top:8px"><button type="button" class="secondary" onclick="toggleQuickCaseClient()">＋ Add New Client</button></div><div id="quickCaseClient" class="panel" style="display:none;margin-top:10px;padding:12px"><div class="form-grid"><div class="field"><label>Client Name</label><input id="quickClientName" placeholder="Full name"></div><div class="field"><label>Role</label><select id="quickClientRole"><option>Petitioner</option><option>Respondent</option><option>Victim</option><option>Applicant</option><option>Accused</option><option>Witness</option><option>Other</option></select></div><div class="field"><label>Phone / WhatsApp</label><input id="quickClientPhone" type="tel" placeholder="Mobile number"></div><div class="field"><label>Email</label><input id="quickClientEmail" type="email" placeholder="Email address"></div></div><div class="form-actions"><button type="button" class="primary" onclick="quickAddCaseClient()">Save &amp; Select Client</button></div></div><small class="muted">Select one or more clients/parties.</small></div><div class="field full"><label>Case Title</label><input id="f1" placeholder="Party v. Party"></div><div class="field"><label>Court</label><input id="f3" type="text" list="caseCourtOptions" autocomplete="off" placeholder="Type to search court">${courtDatalist()}</div><div class="field"><label>Next Hearing Date</label><input id="f4" type="date"></div><div class="field"><label>Hearing Time</label><input id="f5" type="time"></div><div class="field"><label>Status</label><select id="f9"><option>Active</option><option>Pending</option><option>Reserved</option><option>Disposed</option></select></div></div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('case')">Save &amp; Send WhatsApp</button></div>`,
 client:`<div class="form-grid"><div class="field"><label>Client Name</label><input id="f1" placeholder="Full client name" required></div><div class="field"><label>Client Role</label><select id="fRole"><option>Petitioner</option><option>Respondent</option><option>Victim</option><option>Applicant</option><option>Accused</option><option>Witness</option><option>Other</option></select></div><div class="field"><label>Phone / WhatsApp</label><input id="f2" type="tel" placeholder="Mobile number"></div><div class="field"><label>Email</label><input id="f3" type="email" placeholder="Email address"></div><div class="field"><label>Status</label><select id="f4"><option>Active</option><option>Inactive</option></select></div></div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('client')">Save Client</button></div>`,

 hearing:`<div class="form-grid"><div class="field"><label>Date</label><input id="f1" type="date"></div><div class="field"><label>Time</label><input id="f2" type="time"></div><div class="field"><label>Case Number</label><input id="f3" type="text" list="hearingCaseOptions" autocomplete="off" placeholder="Search case number, title, client or court" onchange="syncHearingCase()" oninput="clearHearingCaseSelection()"><datalist id="hearingCaseOptions">${state.cases.map(c=>`<option value="${esc(c.number)} — ${esc(c.title||c.client||'Untitled case')}"></option>`).join("")}</datalist><input id="f3CaseId" type="hidden"></div><div class="field"><label>Case Title</label><input id="f4" readonly></div><div class="field"><label>Client</label><input id="fClient" readonly placeholder="Selected from case"></div><div class="field full"><label>Court</label><input id="f5" list="hearingCourtOptions" autocomplete="off" placeholder="Type to search court"><datalist id="hearingCourtOptions">${KOZHIKODE_COURTS.map(c=>`<option value="${esc(c)}"></option>`).join("")}</datalist></div><div class="field"><label>Stage</label><input id="f6" list="hearingStageOptions" autocomplete="off" placeholder="Type to search stage"><datalist id="hearingStageOptions">${HEARING_STAGES.map(x=>`<option value="${esc(x)}"></option>`).join("")}</datalist></div></div><div class="notice" style="margin-top:14px">When you schedule this hearing, WhatsApp will open with the hearing details prepared for the selected client.</div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('hearing')">Schedule & WhatsApp</button></div>`,
 task:`<div class="form-grid"><div class="field full"><label>Task</label><input id="f1"></div><div class="field"><label>Case</label><input id="f2"></div><div class="field"><label>Due Date</label><input id="f3" type="date"></div><div class="field"><label>Priority</label><select id="f4"><option>High</option><option>Medium</option><option>Low</option></select></div><div class="field"><label>Status</label><select id="f5"><option>Pending</option><option>In Progress</option><option>Completed</option></select></div></div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('task')">Save Task</button></div>`,
 discussion:`<div class="form-grid"><div class="field"><label>Client</label><select id="f1">${state.clients.map(c=>`<option value="${esc(c.id)}" ${c.id===window.clientManagementSelectedId?'selected':''}>${esc(c.name)}</option>`).join("")}</select></div><div class="field"><label>Case (optional)</label><select id="fCase"><option value="">No case link</option>${state.cases.map(c=>`<option value="${esc(c.id)}">${esc(c.number||c.id)} — ${esc(c.title||c.client||"Untitled case")}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="f2" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field full"><label>Discussion Subject</label><input id="f3" placeholder="e.g. Case strategy discussion"></div><div class="field full"><label>Discussion Details</label><textarea id="f4" placeholder="Record what was discussed, client instructions, documents requested, etc."></textarea></div><div class="field full"><label>Next Action / Follow-up</label><textarea id="f5" placeholder="Next steps or follow-up required"></textarea></div></div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('discussion')">Save Discussion</button></div>`,
 payment:`<div class="form-grid"><div class="field"><label>Client</label><select id="f1" onchange="refreshPaymentInvoices()">${(()=>{const names=[...new Set([...(Array.isArray(state.clients)?state.clients:[]).map(c=>c.name),...(Array.isArray(state.invoices)?state.invoices:[]).map(i=>i.client)])].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b)));return names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");})()}</select></div><div class="field"><label>Invoice</label><select id="f2"></select></div><div class="field"><label>Payment Date</label><input id="f3" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Payment Amount</label><input id="f4" type="number" min="0" value="0"></div><div class="field"><label>Payment Method</label><select id="f5"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Other</option></select></div><div class="field full"><label>Reference / Notes</label><input id="f6" placeholder="Transaction reference or notes"></div></div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('payment')">Save Payment</button></div>`,
  invoice:`<div class="form-grid"><div class="field"><label>Client</label><select id="f1">${state.clients.map(c=>`<option>${esc(c.name)}</option>`).join("")}</select></div><div class="field"><label>Case</label><select id="f2" onchange="syncInvoiceCaseClient()">${state.cases.map(c=>`<option value="${esc(c.number)}">${esc(c.number)}${c.title?' — '+esc(c.title):''}</option>`).join("")}</select></div><div class="field"><label>Advocate Fee</label><input id="f3" type="number" min="0" value="0"></div><div class="field"><label>Clerk Fee</label><input id="f4" type="number" min="0" value="0"></div><div class="field"><label>Court Fees</label><input id="f5" type="number" min="0" value="0"></div><div class="field"><label>Other Charges</label><input id="f6" type="number" min="0" value="0"></div><div class="field"><label>Invoice Date</label><input id="f7" type="date" value="${new Date().toISOString().slice(0,10)}"></div></div><div class="notice" style="margin-top:14px">Total invoice amount is calculated automatically from Advocate Fee + Clerk Fee + Court Fees + Other Charges.</div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('invoice')">Save Record</button></div>`,
meeting:`<div class="form-grid"><div class="field"><label>Client</label><select id="f1">${state.clients.map(c=>`<option value="${esc(c.id)}" ${c.id===window.clientManagementSelectedId?'selected':''}>${esc(c.name)} — ${esc(c.phone||'No WhatsApp')}</option>`).join("")}</select></div><div class="field"><label>Case (optional)</label><select id="fCase"><option value="">No case link</option>${state.cases.map(c=>`<option value="${esc(c.id)}">${esc(c.number||c.id)} — ${esc(c.title||c.client||"Untitled case")}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="f2" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Time</label><input id="f3" type="time" value="10:00"></div><div class="field"><label>Meeting Type / Mode</label><select id="f4"><option>Office Meeting</option><option>Phone Call</option><option>Video Call</option><option>Other</option></select></div><div class="field full"><label>Meeting Subject</label><input id="f5" placeholder="e.g. Case consultation"></div><div class="field"><label>Location / Meeting Link</label><input id="f6" placeholder="Office / Google Meet link"></div><div class="field"><label>Agenda</label><input id="f7" placeholder="Main discussion topic"></div><div class="field full"><label>Meeting Details</label><textarea id="f8" placeholder="Additional instructions or details for the client"></textarea></div></div><div class="notice" style="margin-top:14px">When you save the meeting, WhatsApp will open with the meeting date, time, mode, location, agenda and details pre-filled for the selected client.</div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="addRecord('meeting')">Save & WhatsApp</button></div>`,
 document:`<div class="form-grid"><div class="field full"><label for="documentName">Document Name</label><input id="documentName" maxlength="255" placeholder="e.g. Petition - Rahman v State" required></div><div class="field full"><label for="documentCaseInput">Case</label><input id="documentCaseInput" type="text" list="documentCaseOptions" autocomplete="off" placeholder="Type case number to search" required><datalist id="documentCaseOptions">${state.cases.map(c=>`<option value="${esc(c.number||c.id)}">${esc(c.title||c.client||"Case")}</option>`).join("")}</datalist></div><div class="field"><label for="documentCategory">Category</label><select id="documentCategory"><option>Petition</option><option>Order</option><option>Evidence</option><option>Other</option></select></div><div class="field full"><label for="documentFile">Select File</label><input id="documentFile" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"><small class="muted">PDF, DOCX, JPG or PNG · Maximum 20 MB</small></div></div><div class="notice" style="margin-top:14px">Files are stored in a private workspace bucket. Upload is available only after the reviewed Supabase migration is applied and tested.</div><div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button id="uploadDocumentButton" class="primary" type="button" onclick="uploadCaseDocument()">Upload Document</button></div>`
 };
 document.getElementById("modalBody").innerHTML=forms[type];document.getElementById("modal").classList.remove("hidden");
 if(type==="payment") refreshPaymentInvoices();
}


window.refreshPaymentInvoices=function(){
 const clientEl=document.getElementById("f1"), invoiceEl=document.getElementById("f2");
 if(!clientEl||!invoiceEl) return;
 const norm=v=>String(v||"").trim().replace(/\s+/g," ").toLowerCase();
 const client=norm(clientEl.value);
 const invoices=(Array.isArray(state.invoices)?state.invoices:[]).filter(i=>norm(i.client)===client && (Number(i.amount||0)-Number(i.paid||0))>0);
 invoiceEl.innerHTML=invoices.length?invoices.map(i=>{const due=Math.max(0,Number(i.amount||0)-Number(i.paid||0));return `<option value="${esc(i.id)}">${esc(i.id)} — ₹${due.toLocaleString("en-IN")} outstanding</option>`;}).join(""): '<option value="">No outstanding invoices for this client</option>';
};
function hearingTimeInputValue(value){
 const raw=String(value||'').trim();
 if(!raw) return '';
 const parts=raw.split(/[: ]+/); const ap=String(parts[2]||'').toUpperCase();
 let h=Number(parts[0]); const mins=parts[1]||'00';
 if(!Number.isFinite(h)) return '';
 if(ap==='AM' && h===12) h=0;
 if(ap==='PM' && h<12) h+=12;
 if(h>=0 && h<=23 && /^\d{2}$/.test(mins)) return String(h).padStart(2,'0')+':'+mins;
 return raw;
}
function hearingTimeDisplayValue(value){
 const input=hearingTimeInputValue(value); if(!input) return String(value||'').trim();
 const parts=input.split(':'); const h=Number(parts[0]); const mins=parts[1];
 return ((h%12)||12)+':'+mins+' '+(h>=12?'PM':'AM');
}
function openEditModal(type,index){
 const key=type==='case'?'cases':type==='client'?'clients':type==='hearing'?'hearings':type==='task'?'tasks':type==='discussion'?'discussions':type==='meeting'?'meetings':'invoices';
 const item=state[key][index];
 if(!item) return;
 document.getElementById("modalTitle").textContent=`Edit ${type.charAt(0).toUpperCase()+type.slice(1)}`;
 let form="";
 if(type==='client'){
  form=`<div class="form-grid"><div class="field"><label>Client Name</label><input id="f1" value="${esc(item.name)}"></div><div class="field"><label>Client Role</label><select id="fRole">${['Petitioner','Respondent','Victim','Applicant','Accused','Witness','Other'].map(x=>`<option ${x===item.role?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Phone / WhatsApp</label><input id="f2" value="${esc(item.phone)}"></div><div class="field"><label>Email</label><input id="f3" value="${esc(item.email)}"></div><div class="field"><label>Status</label><select id="f4"><option ${item.status==='Active'?'selected':''}>Active</option><option ${item.status==='Inactive'?'selected':''}>Inactive</option></select></div></div>`;
 } else if(type==='case'){
  const linkedIds=Array.isArray(item.clientIds)&&item.clientIds.length?item.clientIds:(item.clientId?[item.clientId]:state.clients.filter(c=>String(item.client||'').split(',').map(v=>v.trim()).includes(c.name)).map(c=>c.id));
  const selectedCategory=item.civilCategory||'';
  const numberPart=item.caseNumber||String(item.number||'').replace(/^(OS|OP|CC|CP|ST|MC)\s+/,'').split('/')[0];
  const yearPart=item.caseYear||String(item.number||'').split('/')[1]||'';
  form=`<div class="form-grid"><div class="field"><label>Case Type</label><select id="f6" onchange="toggleEditCaseCategory()">${['Civil','Criminal','Writ','Family'].map(x=>`<option ${x===item.type?'selected':''}>${x}</option>`).join('')}</select></div><div class="field" id="editCivilCategoryWrap" style="display:${item.type==='Civil'?'':'none'}"><label>Civil Case Category</label><select id="f7">${['OS','OP'].map(x=>`<option ${x===selectedCategory?'selected':''}>${x}</option>`).join('')}</select></div><div class="field" id="editCriminalCategoryWrap" style="display:${item.type==='Criminal'?'':'none'}"><label>Criminal Case Category</label><select id="f10">${['CC','CP','ST','MC'].map(x=>`<option ${x===selectedCategory?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Case Number</label><input id="f11" value="${esc(numberPart+'/'+yearPart)}" placeholder="123/2026"></div><div class="field full"><label>Case Title</label><input id="f1" value="${esc(item.title)}"></div><div class="field"><label>Clients / Parties</label><select id="f2" multiple size="4">${state.clients.map(c=>`<option value="${esc(c.id)}" ${linkedIds.includes(c.id)?'selected':''}>${esc(c.name)} (${esc(c.id)}) — ${esc(c.role||'Party')}</option>`).join('')}</select><small class="muted">Select one or more clients/parties.</small></div><div class="field"><label>Court</label><input id="f3" type="text" list="caseCourtOptions" autocomplete="off" value="${esc(item.court)}" placeholder="Type to search court">${courtDatalist()}</div><div class="field"><label>Next Hearing</label><input id="f4" type="date" value="${esc(item.next)}"></div><div class="field"><label>Hearing Time</label><input id="f5" type="time" value="${esc(item.hearingTime||'')}"></div><div class="field"><label>Status</label><select id="f9">${['Active','Pending','Reserved','Disposed'].map(x=>`<option ${x===item.status?'selected':''}>${x}</option>`).join('')}</select></div></div>`;
 } else if(type==='hearing'){
  const relatedCase=state.cases.find(c=>c.number===item.case || c.id===item.case || c.id===item.caseId);
  const caseId=relatedCase?relatedCase.id:'';
  form=`<div class="form-grid"><div class="field"><label>Date</label><input id="f1" type="date" value="${esc(item.date)}"></div><div class="field"><label>Time</label><input id="f2" type="time" step="60" value="${hearingTimeInputValue(item.time)}" onclick="if(typeof this.showPicker===\"function\"){try{this.showPicker();}catch(e){}}" onfocus="if(typeof this.showPicker===\"function\"){try{this.showPicker();}catch(e){}}"></div><div class="field"><label>Case Number</label><input id="f3" type="text" list="hearingCaseOptions" autocomplete="off" value="${esc(relatedCase?((relatedCase.number||"")+" — "+(relatedCase.title||relatedCase.client||"Untitled case")):item.case||"")}" onchange="syncHearingCase()" oninput="clearHearingCaseSelection()"><datalist id="hearingCaseOptions">${state.cases.map(c=>`<option value="${esc(c.number)} — ${esc(c.title||c.client||"Untitled case")}"></option>`).join("")}</datalist><input id="f3CaseId" type="hidden" value="${esc(caseId)}"></div><div class="field"><label>Case Title</label><input id="f4" readonly value="${esc(item.title)}"></div><div class="field"><label>Client</label><input id="fClient" readonly></div><div class="field full"><label>Court</label><input id="f5" list="hearingCourtOptions" autocomplete="off" value="${esc(item.court)}" placeholder="Type to search court"><datalist id="hearingCourtOptions">${KOZHIKODE_COURTS.map(c=>`<option value="${esc(c)}"></option>`).join("")}</datalist></div><div class="field"><label>Stage</label><input id="f6" list="hearingStageOptions" autocomplete="off" value="${esc(item.stage)}" placeholder="Type to search stage"><datalist id="hearingStageOptions">${HEARING_STAGES.map(x=>`<option value="${esc(x)}"></option>`).join("")}</datalist></div></div>`;
 } else if(type==='task'){
  form=`<div class="form-grid"><div class="field full"><label>Task</label><input id="f1" value="${esc(item.title)}"></div><div class="field"><label>Case</label><input id="f2" value="${esc(item.case)}"></div><div class="field"><label>Due Date</label><input id="f3" type="date" value="${esc(item.due)}"></div><div class="field"><label>Priority</label><select id="f4">${['High','Medium','Low'].map(x=>`<option ${x===item.priority?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Status</label><select id="f5">${['Pending','In Progress','Completed'].map(x=>`<option ${x===item.status?'selected':''}>${x}</option>`).join('')}</select></div></div>`;
 } else if(type==='discussion'){
  form=`<div class="form-grid"><div class="field"><label>Client</label><select id="f1">${state.clients.map(c=>`<option value="${esc(c.id)}" ${c.id===item.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Case (optional)</label><select id="fCase"><option value="">No case link</option>${state.cases.map(c=>`<option value="${esc(c.id)}" ${c.id===item.caseId?"selected":""}>${esc(c.number||c.id)} — ${esc(c.title||c.client||"Untitled case")}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="f2" type="date" value="${esc(item.date)}"></div><div class="field full"><label>Discussion Subject</label><input id="f3" value="${esc(item.subject)}"></div><div class="field full"><label>Discussion Details</label><textarea id="f4">${esc(item.discussion)}</textarea></div><div class="field full"><label>Next Action / Follow-up</label><textarea id="f5">${esc(item.nextAction||'')}</textarea></div></div>`;
 } else if(type==='invoice'){
  const clientNames=state.clients.map(c=>c.name);
  const selectedClient=item.client||'';
  const invoiceCaseSeen=new Set(); const invoiceCases=state.cases.filter(c=>{const value=String(c.number||c.caseNumber||c.case_no||c.caseNo||c.case_number||c.id||'').trim().toLowerCase().replace(/\s+/g,' ');if(!value||invoiceCaseSeen.has(value))return false;invoiceCaseSeen.add(value);return true;}); const caseOptions=invoiceCases.map(c=>{ const value=c.number||c.caseNumber||c.case_no||c.caseNo||c.case_number||c.id||''; const selected=value===item.case||c.id===item.case||c.number===item.case?'selected':''; return '<option value="'+esc(value)+'" '+selected+'>'+esc(value)+(c.title?' — '+esc(c.title):'')+'</option>'; }).join('');
  form='<div class="form-grid"><div class="field"><label>Client</label><select id="f1">'+clientNames.map(n=>'<option '+(n===selectedClient?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></div><div class="field"><label>Case</label><select id="f2">'+caseOptions+'</select></div><div class="field"><label>Advocate Fee</label><input id="f3" type="number" min="0" value="'+Number(item.advocateFee||0)+'"></div><div class="field"><label>Clerk Fee</label><input id="f4" type="number" min="0" value="'+Number(item.clerkFee||0)+'"></div><div class="field"><label>Court Fees</label><input id="f5" type="number" min="0" value="'+Number(item.courtFees||0)+'"></div><div class="field"><label>Other Charges</label><input id="f6" type="number" min="0" value="'+Number(item.otherCharges||0)+'"></div><div class="field"><label>Invoice Date</label><input id="f7" type="date" value="'+esc(item.date||'')+'"></div></div>';
 } else if(type==='meeting'){
  form=`<div class="form-grid"><div class="field"><label>Client</label><select id="f1">${state.clients.map(c=>`<option value="${esc(c.id)}" ${c.id===item.clientId?'selected':''}>${esc(c.name)} — ${esc(c.phone||'No WhatsApp')}</option>`).join('')}</select></div><div class="field"><label>Case (optional)</label><select id="fCase"><option value="">No case link</option>${state.cases.map(c=>`<option value="${esc(c.id)}" ${c.id===item.caseId?"selected":""}>${esc(c.number||c.id)} — ${esc(c.title||c.client||"Untitled case")}</option>`).join("")}</select></div><div class="field"><label>Date</label><input id="f2" type="date" value="${esc(item.date)}"></div><div class="field"><label>Time</label><input id="f3" type="time" value="${esc(item.time)}"></div><div class="field"><label>Meeting Type / Mode</label><select id="f4">${['Office Meeting','Phone Call','Video Call','Other'].map(x=>`<option ${x===item.mode?'selected':''}>${x}</option>`).join('')}</select></div><div class="field full"><label>Meeting Subject</label><input id="f5" value="${esc(item.subject)}"></div><div class="field"><label>Location / Meeting Link</label><input id="f6" value="${esc(item.location||'')}"></div><div class="field"><label>Agenda</label><input id="f7" value="${esc(item.agenda||'')}"></div><div class="field full"><label>Meeting Details</label><textarea id="f8">${esc(item.details||'')}</textarea></div></div>`;
 }
 document.getElementById("modalBody").innerHTML=form+`<div class="form-actions"><button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="updateRecord('${type}',${index})">Update ${type.charAt(0).toUpperCase()+type.slice(1)}</button></div>`;
 document.getElementById("modal").classList.remove("hidden");
 if(type==='hearing') syncHearingCase();
}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function updateRecord(type,index){
 const key=type==='case'?'cases':type==='client'?'clients':type==='hearing'?'hearings':type==='task'?'tasks':type==='discussion'?'discussions':type==='meeting'?'meetings':'invoices';
 const item=state[key][index];
 if(!item) return;
 if(type==='client'){
  const oldName=item.name; item.name=document.getElementById('f1').value.trim()||oldName; item.role=document.getElementById('fRole').value||'Petitioner'; item.phone=document.getElementById('f2').value.trim()||'—'; item.email=document.getElementById('f3').value.trim()||'—'; item.status=document.getElementById('f4').value;
  state.cases.forEach(c=>{const linked=Array.isArray(c.clientIds)?c.clientIds.includes(item.id):(c.clientId===item.id||c.client===oldName||(Array.isArray(c.clients)&&c.clients.includes(oldName)));if(linked){c.clientId=item.id;c.client=item.name;if(Array.isArray(c.clientIds)&&c.clientIds.length){c.clients=c.clientIds.map(id=>{const x=state.clients.find(cl=>cl.id===id);return x?x.name:"";}).filter(Boolean);c.client=c.clients[0]||item.name;}}});
  state.invoices.forEach(inv=>{if(inv.clientId===item.id||inv.client===oldName) {inv.clientId=item.id;inv.client=item.name;}});
  state.tasks.forEach(t=>{if(t.clientId===item.id||t.client===oldName){t.clientId=item.id;t.client=item.name;}});
  state.meetings.forEach(m=>{if(m.clientId===item.id){m.client=item.name;}});
  state.discussions.forEach(d=>{if(d.clientId===item.id){d.client=item.name;}});
 } else if(type==='case'){
  const oldNumber=item.number;
  const selectedClientIds=Array.from(document.getElementById('f2').selectedOptions).map(o=>o.value).filter(Boolean);
  const selectedClients=state.clients.filter(c=>selectedClientIds.includes(c.id));
  if(!selectedClients.length){alert('Please select at least one client/party.');return;}
  const caseType=document.getElementById('f6').value;
  const category=caseType==='Civil'?document.getElementById('f7')?.value||'':caseType==='Criminal'?document.getElementById('f10')?.value||'':'';
  const caseNumberYear=document.getElementById('f11').value.trim();
  const parts=caseNumberYear.split('/');
  const caseNumber=(parts[0]||'').trim();
  const caseYear=(parts[1]||'').trim();
  const newNumber=(category?category+' ':'')+caseNumberYear;
  if(!caseNumber||!/^\d{4}$/.test(caseYear)){alert('Please enter a valid case number and year, for example 145/2026.');return;}
  if(state.cases.some((c,i)=>i!==index&&String(c.number||'').trim().toLowerCase()===newNumber.trim().toLowerCase())){alert('A case with this case number already exists.');return;}
  item.number=newNumber||oldNumber; item.title=document.getElementById('f1').value.trim()||'Untitled'; const typedCourt=document.getElementById('f3').value.trim(); if(typedCourt && !getCourtList().some(c=>c.toLowerCase()===typedCourt.toLowerCase())) state.courts.push(typedCourt); item.client=selectedClients.map(c=>c.name).join(', '); item.clients=selectedClients.map(c=>c.name); item.clientIds=selectedClientIds; item.client=selectedClients[0].name; item.clientId=selectedClientIds[0]; item.court=document.getElementById('f3').value.trim()||'—'; item.next=document.getElementById('f4').value||item.next; item.hearingTime=document.getElementById('f5').value||''; item.type=caseType; item.civilCategory=category; item.caseNumber=caseNumber; item.caseYear=caseYear; item.status=document.getElementById('f9').value;
  state.hearings.forEach(h=>{if(h.caseId===item.id||h.case===oldNumber||h.caseNumber===oldNumber){h.case=item.number;h.caseNumber=item.number;h.caseId=item.id;}});
  state.tasks.forEach(t=>{if(t.caseId===item.id||t.case===oldNumber||t.caseNumber===oldNumber){t.case=item.number;t.caseNumber=item.number;t.caseId=item.id;}});
  state.invoices.forEach(inv=>{if(inv.caseId===item.id||inv.case===oldNumber||inv.caseNumber===oldNumber){inv.case=item.number;inv.caseNumber=item.number;inv.caseId=item.id;}});
  state.meetings.forEach(m=>{if(m.caseId===item.id||m.case===oldNumber||m.caseNumber===oldNumber){m.case=item.number;m.caseNumber=item.number;m.caseId=item.id;}});
  state.discussions.forEach(d=>{if(d.caseId===item.id||d.case===oldNumber||d.caseNumber===oldNumber){d.case=item.number;d.caseNumber=item.number;d.caseId=item.id;}});
  state.clients.forEach(c=>{c.cases=state.cases.filter(x=>(Array.isArray(x.clientIds)?x.clientIds.includes(c.id):x.clientId===c.id)||x.client===c.name||(x.clients||[]).includes(c.name)).length;});
 } else if(type==='hearing'){
  const selectedCaseId=(document.getElementById('f3CaseId')||{}).value||"";
  const relatedCase=state.cases.find(c=>c.id===selectedCaseId); if(!relatedCase){alert('Please select a case.');return;}
  const client=getHearingClient({clientId:relatedCase.clientId,case:relatedCase.number}); if(!client){alert('The selected case is not linked to a client.');return;}
  item.date=document.getElementById('f1').value||item.date; const editedTime=document.getElementById('f2').value; if(editedTime) item.time=hearingTimeDisplayValue(editedTime); item.case=relatedCase.number; item.caseNumber=relatedCase.number; item.caseId=relatedCase.id; item.title=relatedCase.title; item.court=document.getElementById('f5').value.trim()||relatedCase.court||'Court'; item.stage=document.getElementById('f6').value.trim()||'Hearing'; item.clientId=client.id;
 } else if(type==='task'){
  const typedCase=document.getElementById('f2').value.trim();
  const relatedCase=state.cases.find(c=>String(c.id)===typedCase||String(c.number)===typedCase||String(c.title)===typedCase||String(c.number+" — "+c.title)===typedCase);
  if(typedCase && !relatedCase){alert('Please select a valid case.');return;}
  item.title=document.getElementById('f1').value.trim()||item.title;
  item.case=relatedCase?relatedCase.number:typedCase||'—';
  item.caseId=relatedCase?relatedCase.id:(item.caseId||"");
  item.caseNumber=relatedCase?relatedCase.number:(item.caseNumber||item.case||"");
  if(relatedCase){item.clientId=relatedCase.clientId||item.clientId;item.client=relatedCase.client||item.client;}
  item.due=document.getElementById('f3').value||item.due; item.priority=document.getElementById('f4').value; item.status=document.getElementById('f5').value;
 } else if(type==='discussion'){
  const clientId=document.getElementById('f1').value; const client=state.clients.find(c=>c.id===clientId); if(!client){alert('Please select a client.');return;}
  const selectedCase=state.cases.find(c=>c.id===document.getElementById("fCase")?.value); if(selectedCase && !((Array.isArray(selectedCase.clientIds)&&selectedCase.clientIds.includes(clientId))||selectedCase.clientId===clientId||selectedCase.client===client.name||(Array.isArray(selectedCase.clients)&&selectedCase.clients.includes(client.name)))){alert('Selected case is not linked to the selected client.');return;} item.clientId=clientId; item.caseId=selectedCase?.id||""; item.caseNumber=selectedCase?.number||""; item.case=selectedCase?.number||""; item.date=document.getElementById('f2').value||item.date; item.subject=document.getElementById('f3').value.trim()||'Client Discussion'; item.discussion=document.getElementById('f4').value.trim()||''; item.nextAction=document.getElementById('f5').value.trim()||'';
  window.clientManagementSelectedId=clientId;
 } else if(type==='invoice'){
  const client=document.getElementById('f1').value.trim();
  const caseValue=document.getElementById('f2').value.trim();
  const advocateFee=Number(document.getElementById('f3').value||0), clerkFee=Number(document.getElementById('f4').value||0), courtFees=Number(document.getElementById('f5').value||0), otherCharges=Number(document.getElementById('f6').value||0), paidAmount=Number(item.paid||0);
  const amount=advocateFee+clerkFee+courtFees+otherCharges;
  if(!client){alert('Please select a client.');return;} if(!caseValue){alert('Please select a case.');return;} if(amount<=0){alert('Invoice amount must be greater than zero.');return;} if(paidAmount<0||paidAmount>amount){alert('Paid amount cannot exceed the invoice total.');return;}
  const invoiceClient=state.clients.find(c=>c.name===client); const invoiceCase=state.cases.find(c=>c.number===caseValue||c.id===caseValue); if(!invoiceClient||!invoiceCase){alert('Please select a valid client and case.');return;} if(!((Array.isArray(invoiceCase.clientIds)&&invoiceCase.clientIds.includes(invoiceClient.id))||invoiceCase.clientId===invoiceClient.id||invoiceCase.client===invoiceClient.name||(Array.isArray(invoiceCase.clients)&&invoiceCase.clients.includes(invoiceClient.name)))){alert('Selected case is not linked to the selected client.');return;} item.clientId=invoiceClient?.id||item.clientId||""; item.client=client; item.caseId=invoiceCase?.id||item.caseId||""; item.caseNumber=invoiceCase?.number||item.caseNumber||caseValue; item.case=invoiceCase?.number||caseValue; item.advocateFee=advocateFee; item.clerkFee=clerkFee; item.courtFees=courtFees; item.otherCharges=otherCharges; item.amount=amount; item.paid=Math.min(Math.max(0,paidAmount),amount); item.date=document.getElementById('f7').value||item.date; item.status=item.paid>=amount?'Paid':item.paid>0?'Partial':'Pending';
  } else if(type==='meeting'){
  const clientId=document.getElementById('f1').value; const client=state.clients.find(c=>c.id===clientId); if(!client){alert('Please select a client.');return;}
  const selectedCase=state.cases.find(c=>c.id===document.getElementById("fCase")?.value); if(selectedCase && !((Array.isArray(selectedCase.clientIds)&&selectedCase.clientIds.includes(clientId))||selectedCase.clientId===clientId||selectedCase.client===client.name||(Array.isArray(selectedCase.clients)&&selectedCase.clients.includes(client.name)))){alert('Selected case is not linked to the selected client.');return;} item.clientId=clientId; item.caseId=selectedCase?.id||""; item.caseNumber=selectedCase?.number||""; item.case=selectedCase?.number||""; item.date=document.getElementById('f2').value||item.date; item.time=document.getElementById('f3').value||item.time; item.mode=document.getElementById('f4').value||item.mode; item.subject=document.getElementById('f5').value.trim()||'Client Meeting'; item.location=document.getElementById('f6').value.trim()||''; item.agenda=document.getElementById('f7').value.trim()||''; item.details=document.getElementById('f8').value.trim()||'';
  window.clientManagementSelectedId=clientId;
 }
 if(type==='hearing'){ if(!Array.isArray(state.hearings)||!state.hearings[index]){alert('Unable to save this hearing because the hearing record could not be found.');return;} window.hearingFilter='all'; } save(); closeModal(); navigate(type==='case'?'cases':type==='client'?'clients':type==='hearing'?'hearings':type==='discussion'||type==='meeting'?'client-management':'tasks');
}
function deleteRecord(type,index){
 const collections={case:"cases",client:"clients",hearing:"hearings",task:"tasks",discussion:"discussions",meeting:"meetings",invoice:"invoices"};
 const key=collections[type]; if(!key) return;
 const item=state[key][index]; if(!item) return;
 const label=type==="case"?"case":type==="client"?"client":type==="hearing"?"hearing":type==="task"?"task":type==="discussion"?"discussion":type==="meeting"?"meeting":"invoice";
 let message="Delete this "+label+"? This action cannot be undone.";
 if(type==="case") message="Delete this case and its directly linked hearings, tasks, invoices, meetings and discussions? This action cannot be undone.";
 if(type==="client") message="Delete this client and directly linked discussions, meetings, tasks and invoices? This action cannot be undone.";
 if(!confirm(message)) return;
 if(type==="case"){
   const caseId=item.id, caseNumber=item.number;
   state.hearings=state.hearings.filter(h=>h.caseId!==caseId&&h.caseNumber!==caseNumber&&h.case!==caseId&&h.case!==caseNumber);
   state.tasks=state.tasks.filter(t=>t.caseId!==caseId&&t.caseNumber!==caseNumber&&t.case!==caseId&&t.case!==caseNumber);
   state.invoices=state.invoices.filter(inv=>inv.caseId!==caseId&&inv.caseNumber!==caseNumber&&inv.case!==caseId&&inv.case!==caseNumber);
   state.meetings=state.meetings.filter(m=>m.caseId!==caseId&&m.caseNumber!==caseNumber&&m.case!==caseId&&m.case!==caseNumber);
   state.discussions=state.discussions.filter(d=>d.caseId!==caseId&&d.caseNumber!==caseNumber&&d.case!==caseId&&d.case!==caseNumber);
   state.cases.splice(index,1);
   state.clients.forEach(c=>{c.cases=state.cases.filter(x=>(Array.isArray(x.clientIds)?x.clientIds.includes(c.id):x.clientId===c.id)||x.client===c.name||(x.clients||[]).includes(c.name)).length;});
 } else if(type==="client"){
   const clientId=item.id, clientName=item.name;
   state.discussions=state.discussions.filter(d=>d.clientId!==clientId&&d.client!==clientName);
   state.meetings=state.meetings.filter(m=>m.clientId!==clientId&&m.client!==clientName);
   state.tasks=state.tasks.filter(t=>t.clientId!==clientId&&t.client!==clientName);
   state.invoices=state.invoices.filter(inv=>inv.clientId!==clientId&&inv.client!==clientName);
   state.hearings.forEach(h=>{if(h.clientId===clientId) h.clientId="";});
   state.cases.forEach(c=>{
     if(Array.isArray(c.clientIds)){
       c.clientIds=c.clientIds.filter(id=>id!==clientId);
       c.clients=state.clients.filter(cl=>c.clientIds.includes(cl.id)).map(cl=>cl.name);
       c.client=c.clients[0]||""; c.clientId=c.clientIds[0]||"";
     } else if(c.clientId===clientId||c.client===clientName){c.clientId="";c.client="";}
   });
   state.clients.splice(index,1);
 } else { state[key].splice(index,1); }
 save();
 navigate(type==="case"||type==="client"?"cases":type==="hearing"?"hearings":type==="task"?"tasks":type==="invoice"?"finance":"client-management");
}
function syncInvoiceCaseClient(){
  const caseInput=document.getElementById("f2");
  const clientSelect=document.getElementById("f1");
  if(!caseInput||!clientSelect) return;
  const value=String(caseInput.value||"").trim();
  const relatedCase=state.cases.find(c=>String(c.number||"")===value||String(c.id||"")===value);
  if(!relatedCase) return;
  let client=null;
  if(Array.isArray(relatedCase.clientIds)&&relatedCase.clientIds.length){
    client=state.clients.find(c=>c.id===relatedCase.clientIds[0])||null;
  }
  if(!client&&relatedCase.clientId){
    client=state.clients.find(c=>c.id===relatedCase.clientId)||null;
  }
  if(!client&&relatedCase.client){
    client=state.clients.find(c=>c.name===relatedCase.client)||null;
  }
  if(!client&&Array.isArray(relatedCase.clients)&&relatedCase.clients.length){
    client=state.clients.find(c=>c.name===relatedCase.clients[0])||null;
  }
  if(client){
    clientSelect.value=client.name;
    clientSelect.dispatchEvent(new Event("change",{bubbles:true}));
  }
}
function clearHearingCaseSelection(){
  const input=document.getElementById("f3");
  const hidden=document.getElementById("f3CaseId");
  if(!input) return;
  const currentId=hidden?String(hidden.value||""):"";
  const currentCase=state.cases.find(c=>String(c.id||"")===currentId);
  const currentLabel=currentCase?`${currentCase.number||""} — ${currentCase.title||currentCase.client||"Untitled case"}`:"";
  if(currentId && input.value!==currentLabel && hidden) hidden.value="";
  const title=document.getElementById("f4");
  const client=document.getElementById("fClient");
  const court=document.getElementById("f5");
  const stage=document.getElementById("f6");
  if(currentId && input.value!==currentLabel){
    if(title) title.value="";
    if(client) client.value="";
    if(court) court.value="";
    if(stage) stage.value="";
  }
}
function syncHearingCase(){
  const input=document.getElementById("f3");
  const hidden=document.getElementById("f3CaseId");
  const title=document.getElementById("f4");
  const clientInput=document.getElementById("fClient");
  const court=document.getElementById("f5");
  const stage=document.getElementById("f6");
  if(!input) return;
  const raw=String(input.value||"").trim();
  const hiddenId=hidden?String(hidden.value||"").trim():"";
  const relatedCase=state.cases.find(c=>{
    const label=`${c.number||""} — ${c.title||c.client||"Untitled case"}`.trim();
    return (hiddenId && String(c.id)===hiddenId) ||
      String(c.id||"")===raw ||
      String(c.number||"")===raw ||
      label.toLowerCase()===raw.toLowerCase();
  });
  if(!relatedCase){
    if(hidden) hidden.value="";
    if(title) title.value="";
    if(clientInput) clientInput.value="";
    if(court) court.value="";
    if(stage) stage.value="";
    return;
  }
  if(hidden) hidden.value=relatedCase.id||"";
  if(input.value!==`${relatedCase.number||""} — ${relatedCase.title||relatedCase.client||"Untitled case"}`) input.value=`${relatedCase.number||""} — ${relatedCase.title||relatedCase.client||"Untitled case"}`;
  const client=getHearingClient({clientId:relatedCase.clientId,case:relatedCase.number});
  if(title) title.value=relatedCase.title||"";
  if(clientInput) clientInput.value=client?`${client.name}${client.phone?` — ${client.phone}`:""}`:(relatedCase.client||"No client linked");
  if(court) court.value=relatedCase.court||"";
  if(stage) stage.value=relatedCase.stage||stage.value||"";
}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function toggleEditCaseCategory(){const t=document.getElementById('f6');const w=document.getElementById('editCivilCategoryWrap');const cw=document.getElementById('editCriminalCategoryWrap');if(t&&w)w.style.display=t.value==='Civil'?'':'none';if(t&&cw)cw.style.display=t.value==='Criminal'?'':'none';}
function toggleCivilCategory(){const t=document.getElementById("f6");const w=document.getElementById("civilCategoryWrap");const cw=document.getElementById("criminalCategoryWrap");if(t&&w)w.style.display=t.value==="Civil"?"":"none";if(t&&cw)cw.style.display=t.value==="Criminal"?"":"none";}
window.toggleQuickCaseClient=function(){const p=document.getElementById("quickCaseClient");if(p)p.style.display=p.style.display==="none"?"block":"none";};
window.quickAddCaseClient=function(){const name=(document.getElementById("quickClientName")?.value||"").trim();if(!name){alert("Please enter the client name.");return;}const phone=(document.getElementById("quickClientPhone")?.value||"").trim();const email=(document.getElementById("quickClientEmail")?.value||"").trim();const role=document.getElementById("quickClientRole")?.value||"Petitioner";const duplicate=state.clients.find(x=>String(x.name||"").trim().toLowerCase()===name.toLowerCase()&&(phone?String(x.phone||"").trim()===phone:true));if(duplicate){const sel=document.getElementById("f2");const opt=Array.from(sel.options).find(o=>o.value===duplicate.id);if(opt)opt.selected=true;alert("This client already exists and has been selected.");document.getElementById("quickCaseClient").style.display="none";return;}const id="CL-"+String(Date.now()).slice(-8);const client={id,name,phone:phone||"—",email:email||"—",role,cases:0,status:"Active"};state.clients.unshift(client);const sel=document.getElementById("f2");const opt=document.createElement("option");opt.value=id;opt.textContent=name+" ("+id+") — "+role;opt.selected=true;sel.insertBefore(opt,sel.firstChild);sel.dispatchEvent(new Event("change",{bubbles:true}));save();document.getElementById("quickCaseClient").style.display="none";document.getElementById("quickClientName").value="";document.getElementById("quickClientPhone").value="";document.getElementById("quickClientEmail").value="";};
function addRecord(type){
 if(type==="case"){
  const selectedClientIds=Array.from(document.getElementById("f2").selectedOptions).map(o=>o.value).filter(Boolean);
  const selectedClients=state.clients.filter(c=>selectedClientIds.includes(c.id));
  if(!selectedClients.length){alert("Please select at least one client/party.");return}
  const caseType=document.getElementById("f6").value; const category=caseType==="Civil"?document.getElementById("f7")?.value||"":caseType==="Criminal"?document.getElementById("f10")?.value||"":""; const caseNumberYear=document.getElementById("f11").value.trim(); const caseParts=caseNumberYear.split("/"); const caseNumber=(caseParts[0]||"").trim(); const caseYear=(caseParts[1]||"").trim(); if(!caseNumber||!/^\d{4}$/.test(caseYear)){alert("Please enter a valid case number and year, for example 145/2026.");return;} const formattedNumber=(category?category+" ":"")+caseNumberYear; if(state.cases.some(c=>String(c.number||"").trim().toLowerCase()===formattedNumber.toLowerCase())){alert("A case with this case number already exists.");return;} selectedClients.forEach(c=>c.cases=(Number(c.cases)||0)+1); const typedCourt=document.getElementById("f3").value.trim(); if(typedCourt && !getCourtList().some(c=>c.toLowerCase()===typedCourt.toLowerCase())) state.courts.push(typedCourt); const newCase={id:"CS-"+Date.now(),number:formattedNumber||"New Case",title:document.getElementById("f1").value||"Untitled",client:selectedClients.map(c=>c.name).join(", "),clients:selectedClients.map(c=>c.name),clientIds:selectedClientIds,client:selectedClients[0].name,clientId:selectedClientIds[0],court:document.getElementById("f3").value||"—",next:document.getElementById("f4").value||"",hearingTime:document.getElementById("f5").value||"",status:document.getElementById("f9")?.value||"Active",type:caseType,civilCategory:category,caseNumber,caseYear}; state.cases.unshift(newCase); if(newCase.next){state.hearings=Array.isArray(state.hearings)?state.hearings:[]; state.hearings.push({id:"HEAR-"+Date.now(),date:newCase.next,time:newCase.hearingTime||"Time not set",case:newCase.number,caseId:newCase.id,caseNumber:newCase.number,title:newCase.title,court:newCase.court,stage:"Hearing",clientId:newCase.clientId,clientIds:newCase.clientIds,clients:newCase.clients});} save(); closeModal(); navigate("cases"); const url=caseWhatsAppUrl(newCase,selectedClients[0]); if(url){window.open(url,"_blank","noopener,noreferrer");} else {alert(`Case saved, but ${selectedClients[0].name} does not have a valid WhatsApp/mobile number. Please update the client record.`);} return;
}
 if(type==="payment"){ const invoice=state.invoices.find(i=>i.id===document.getElementById("f2").value); const amount=Number(document.getElementById("f4").value||0); if(!invoice||amount<=0){alert("Please select an invoice and enter a valid payment amount.");return;} const remaining=Math.max(0,Number(invoice.amount||0)-Number(invoice.paid||0)); if(amount>remaining){alert("Payment cannot exceed the outstanding balance of this invoice.");return;} state.payments.unshift({id:"PAY-"+String(Date.now()).slice(-5),client:document.getElementById("f1").value,invoiceId:invoice.id,date:document.getElementById("f3").value||new Date().toISOString().slice(0,10),amount,method:document.getElementById("f5").value,notes:document.getElementById("f6").value||""}); invoice.paid=Number(invoice.paid||0)+amount; invoice.status=invoice.paid>=Number(invoice.amount||0)?"Paid":"Partial"; save(); closeModal(); navigate("finance"); return; }
if(type==="invoice"){ const advocateFee=Number(document.getElementById("f3").value||0); const clerkFee=Number(document.getElementById("f4").value||0); const courtFees=Number(document.getElementById("f5").value||0); const otherCharges=Number(document.getElementById("f6").value||0); const amount=advocateFee+clerkFee+courtFees+otherCharges; const paidAmount=0; if(!document.getElementById("f1").value.trim()){alert("Please select a client.");return;} if(!document.getElementById("f2").value.trim()){alert("Please select a case.");return;} if(amount<=0){alert("Invoice amount must be greater than zero.");return;} if(paidAmount<0||paidAmount>amount){alert("Paid amount cannot exceed the invoice total.");return;} const invoiceClient=state.clients.find(c=>c.name===document.getElementById("f1").value); const invoiceCase=state.cases.find(c=>c.number===document.getElementById("f2").value||c.id===document.getElementById("f2").value); if(!invoiceClient||!invoiceCase){alert("Please select a valid client and case.");return;} if(!((Array.isArray(invoiceCase.clientIds)&&invoiceCase.clientIds.includes(invoiceClient.id))||invoiceCase.clientId===invoiceClient.id||invoiceCase.client===invoiceClient.name||(Array.isArray(invoiceCase.clients)&&invoiceCase.clients.includes(invoiceClient.name)))){alert("Selected case is not linked to the selected client.");return;} state.invoices.unshift({id:"INV-"+String(Date.now()).slice(-5),date:document.getElementById("f7").value||new Date().toISOString().slice(0,10),clientId:invoiceClient?.id||"",client:document.getElementById("f1").value,caseId:invoiceCase?.id||"",caseNumber:invoiceCase?.number||"",case:document.getElementById("f2").value,advocateFee,clerkFee,courtFees,otherCharges,amount,paid:paidAmount,status:paidAmount>=amount?"Paid":paidAmount>0?"Partial":"Pending"}); save(); closeModal(); navigate("finance"); return; }
 if(type==="client"){state.clients.unshift({id:"CL-"+String(Date.now()).slice(-5),name:document.getElementById("f1").value||"New Client",phone:document.getElementById("f2").value||"—",email:document.getElementById("f3").value||"—",role:document.getElementById("fRole").value||"Petitioner",cases:0,status:document.getElementById("f4").value})}
 if(type==="hearing"){
  const selectedCaseId=(document.getElementById("f3CaseId")||{}).value||"";
  const relatedCase=state.cases.find(c=>c.id===selectedCaseId);
  if(!relatedCase){alert("Please select a case.");return;}
  const client=getHearingClient({clientId:relatedCase.clientId,case:relatedCase.number});
  if(!client){alert("The selected case is not linked to a client. Please check the case/client relationship.");return;}
  let tm=document.getElementById("f2").value||"10:00";
  const hearing={id:"HEAR-"+Date.now(),date:document.getElementById("f1").value||new Date().toISOString().slice(0,10),time:tm,case:relatedCase.number,caseId:relatedCase.id,caseNumber:relatedCase.number,title:document.getElementById("f4").value||relatedCase.title,court:document.getElementById("f5").value||relatedCase.court||"Court",stage:document.getElementById("f6").value||"Hearing",clientId:client.id};
  state.hearings.push(hearing);
  save();
  const url=hearingWhatsAppUrl(hearing);
  closeModal();
  navigate("hearings");
  if(url){window.open(url,"_blank","noopener,noreferrer");}
  else{alert(`Hearing saved, but ${client.name} does not have a valid WhatsApp/mobile number. Please update the client record.`);}
  return;
 }
 if(type==="task"){const taskId="TASK-"+(window.crypto&&typeof window.crypto.randomUUID==="function"?window.crypto.randomUUID():(Date.now().toString(36)+"-"+Math.random().toString(36).slice(2)));state.tasks.unshift({id:taskId,title:document.getElementById("f1").value||"New task",case:document.getElementById("f2").value||"—",due:document.getElementById("f3").value||new Date().toISOString().slice(0,10),priority:document.getElementById("f4").value,status:document.getElementById("f5")?.value||"Pending"})}
 if(type==="discussion"){
  const clientId=document.getElementById("f1").value; const client=state.clients.find(c=>c.id===clientId); if(!client){alert("Please select a client.");return;} const selectedCase=state.cases.find(c=>c.id===document.getElementById("fCase")?.value); if(selectedCase && !((Array.isArray(selectedCase.clientIds)&&selectedCase.clientIds.includes(clientId))||selectedCase.clientId===clientId||selectedCase.client===client.name||(Array.isArray(selectedCase.clients)&&selectedCase.clients.includes(client.name)))){alert("Selected case is not linked to the selected client.");return;}
  state.discussions.unshift({id:"DISC-"+Date.now(),clientId,caseId:(state.cases.find(c=>c.id===document.getElementById("fCase")?.value)||{}).id||"",caseNumber:(state.cases.find(c=>c.id===document.getElementById("fCase")?.value)||{}).number||"",case:(state.cases.find(c=>c.id===document.getElementById("fCase")?.value)||{}).number||"",date:document.getElementById("f2").value||new Date().toISOString().slice(0,10),subject:document.getElementById("f3").value.trim()||"Client Discussion",discussion:document.getElementById("f4").value.trim()||"",nextAction:document.getElementById("f5").value.trim()||""});
  window.clientManagementSelectedId=clientId; save(); closeModal(); navigate("client-management"); return;
 }
 if(type==="meeting"){
  const clientId=document.getElementById("f1").value; const client=state.clients.find(c=>c.id===clientId); if(!client){alert("Please select a client.");return;} const selectedCase=state.cases.find(c=>c.id===document.getElementById("fCase")?.value); if(selectedCase && !((Array.isArray(selectedCase.clientIds)&&selectedCase.clientIds.includes(clientId))||selectedCase.clientId===clientId||selectedCase.client===client.name||(Array.isArray(selectedCase.clients)&&selectedCase.clients.includes(client.name)))){alert("Selected case is not linked to the selected client.");return;}
  const meeting={id:"MEET-"+Date.now(),clientId,caseId:(state.cases.find(c=>c.id===document.getElementById("fCase")?.value)||{}).id||"",caseNumber:(state.cases.find(c=>c.id===document.getElementById("fCase")?.value)||{}).number||"",case:(state.cases.find(c=>c.id===document.getElementById("fCase")?.value)||{}).number||"",date:document.getElementById("f2").value||new Date().toISOString().slice(0,10),time:document.getElementById("f3").value||"10:00",mode:document.getElementById("f4").value||"Office Meeting",subject:document.getElementById("f5").value.trim()||"Client Meeting",location:document.getElementById("f6").value.trim()||"",agenda:document.getElementById("f7").value.trim()||"",details:document.getElementById("f8").value.trim()||""};
  state.meetings.push(meeting); window.clientManagementSelectedId=clientId; save(); const url=meetingWhatsAppUrl(meeting); closeModal(); navigate("client-management"); if(url){window.open(url,"_blank","noopener,noreferrer");} else {alert(`Meeting saved, but ${client.name} does not have a valid WhatsApp/mobile number. Please update the client record.`);} return;
 }
 save();closeModal();navigate(type==="case"?"cases":type==="client"?"clients":type==="hearing"?"hearings":"tasks")
}
// Restore the page that was open before a browser refresh/reload.
// URL hash is the primary route because it survives a hard refresh; storage
// values provide backward compatibility for existing sessions without a hash.
// Define route restoration here, but execute it only after all page
// overrides/enhancements in this file have been registered. Previously this
// ran before caseDetails360Enhanced replaced pages["case-details"], so a hard
// refresh rendered the legacy Case 360 view while normal navigation rendered
// the enhanced view.
window.__advocateDeskRestoreRoute=function(){
  let saved="";
  try{saved=String(location.hash||"").replace(/^#/ ,"").trim()}catch(e){}
  if(!saved){try{saved=sessionStorage.getItem("advocateDeskCurrentPage")||""}catch(e){}}
  if(!saved){try{saved=localStorage.getItem("advocateDeskCurrentPage")||""}catch(e){}}
  const initial=pages[saved]?saved:"dashboard";
  navigate(initial);
};
// Keep the rendered page synchronized with browser Back/Forward.
window.addEventListener("popstate",function(){
  const page=String(location.hash||"").replace(/^#/ ,"").trim();
  if(pages[page]) navigate(page,true);
});
// Central Control demo interactions. Supabase will enforce these permissions server-side later.
document.addEventListener("click", function(e){
  if(e.target && e.target.id==="add-admin-user"){
    const name=prompt("User name:");
    if(!name) return;
    const role=prompt("Role (Admin / Advocate / Clerk / Accountant / Staff):","Staff") || "Staff";
    const tbody=document.getElementById("admin-users-table");
    if(tbody){
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${esc(name)}</td><td><span class="role-badge">${esc(role)}</span></td><td>Main Office</td><td><span class="status-badge active">Active</span></td><td>Assigned by role</td>`;
      tbody.prepend(tr);
    }
  }
});

/* User profile/logout interactions are handled by user-menu-fix.js. */
(function(){
  const originalCaseDetails=window.caseDetails;
  window.caseDetails=function(q,id){window.case360ActiveCaseId=id||window.case360ActiveCaseId;return originalCaseDetails(q,id);};
})();

// Case 360 video-style workspace enhancement
function caseDetails360Enhanced(query="", selectedId="") {
  const q=String(query||"").trim().toLowerCase();
  const norm=v=>String(v??"").toLowerCase();
  const clients=Array.isArray(state.clients)?state.clients:[];
  const casesList=Array.isArray(state.cases)?state.cases:[];
  const linked=c=>{const ids=Array.isArray(c.clientIds)?c.clientIds:(c.clientId?[c.clientId]:[]);return clients.filter(x=>ids.includes(x.id)||x.name===c.client||((c.clients||[]).includes(x.name)));};
  const matches=casesList.filter(c=>!q||[c.number,c.title,c.court,c.type,c.status,c.client,c.cnr,...(Array.isArray(c.clients)?c.clients:[])].some(v=>norm(v).includes(q))||linked(c).some(x=>[x.name,x.phone,x.email,x.id,x.role].some(v=>norm(v).includes(q))));
  let savedSelectedId="";
  if(!selectedId){
    try{savedSelectedId=sessionStorage.getItem("advocateDeskCase360SelectedId")||""}catch(e){}
  }
  // When the user explicitly searches, the first matching case must become
  // the active workspace. A previously selected Case 360 ID is only restored
  // when the page is opened without a search query (for example after refresh).
  const active=selectedId
    ? (casesList.find(c=>c.id===selectedId)||matches[0])
    : (q ? matches[0] : (casesList.find(c=>c.id===savedSelectedId)||matches[0]));
  const escv=v=>esc(v==null?"":String(v));
  const money=v=>"₹"+Number(v||0).toLocaleString("en-IN");
  const section=(title,action,body,cls="")=>`<section class="c360-section ${cls}"><div class="c360-section-head"><h3>${title}</h3>${action||""}</div>${body}</section>`;
  const btn=(label,fn)=>`<button class="secondary" onclick="${fn}">${label}</button>`;
  let workspace=`<div class="panel empty">Search for a case and select it to open the Case 360 workspace.</div>`;
  if(active){
    const parties=linked(active);
    const byCase=(arr)=>arr.filter(x=>x.caseId===active.id||x.caseNumber===active.number||x.case===active.id||x.case===active.number||x.case===active.title);
    const hearings=byCase(Array.isArray(state.hearings)?state.hearings:[]);
    const hearingForCase=hearings.slice().sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))[0];
    const caseHearingTime=active.hearingTime||hearingForCase?.time||"";
    const displayCaseHearingTime=hearingTimeDisplayValue(caseHearingTime)||"Not scheduled";
    const tasks=byCase(Array.isArray(state.tasks)?state.tasks:[]);
    const meetings=byCase(Array.isArray(state.meetings)?state.meetings:[]);
    const discussions=byCase(Array.isArray(state.discussions)?state.discussions:[]);
    const transactions=byCase(Array.isArray(state.transactions)?state.transactions:[]);
    const invoices=(Array.isArray(state.invoices)?state.invoices:[]).filter(inv=>inv.case===active.id||inv.case===active.number||inv.case===active.title||inv.caseNumber===active.number||inv.caseId===active.id);
    const finance=active.finance||{};
    const received=transactions.filter(t=>/receipt|payment/i.test(t.type||t.kind||"")).reduce((s,t)=>s+Number(t.amount||0),0)+Number(finance.received||0);
    const expenses=transactions.filter(t=>/expense/i.test(t.type||t.kind||"")).reduce((s,t)=>s+Number(t.amount||0),0)+Number(finance.expenses||0);
    const invoiceTotal=invoices.reduce((sum,inv)=>sum+Number(inv.amount||0),0);
    const invoicePaid=invoices.reduce((sum,inv)=>sum+Number(inv.paid||0),0);
    const fees=invoiceTotal||Number(finance.total||finance.fees||0);
    const invoiceReceived=invoicePaid||received;
    const balance=Math.max(0,fees-invoiceReceived);
    window.case360ActiveCaseId=active.id;
    try{sessionStorage.setItem("advocateDeskCase360SelectedId",active.id||"")}catch(e){}
    workspace=`<div class="c360-workspace">
      <div class="c360-hero"><div><div class="c360-kicker">CASE 360 / CASE WORKSPACE</div><h2>${escv(active.number||"Case")}</h2><p>${escv(active.title||"Untitled case")}</p><small>${escv(active.court||"Court not specified")}</small></div><div class="c360-hero-actions">${badge(active.status||"Active")} ${btn("Print",`printCase360()`)} ${btn("Save",`saveCase360()`)}</div></div>
      <div class="c360-summary"><div><span>Client</span><strong>${escv(parties[0]?.name||active.client||"—")}</strong><small>${escv(parties[0]?.role||"Party")}</small><small>☎ ${escv(parties[0]?.phone||"—")}</small><small>✉ ${escv(parties[0]?.email||"—")}</small></div><div><span>Court</span><strong>${escv(active.court||"—")}</strong></div><div><span>Next Hearing</span><strong>${active.next?fmtDate(active.next):"Not scheduled"}</strong><small>${escv(displayCaseHearingTime)}</small></div><div><span>Open Tasks</span><strong>${tasks.filter(t=>!/^completed$/i.test(t.status||"")).length}</strong></div></div>
      ${section("Case Details","",`<div class="c360-detail-grid"><div><label>Case Number</label><strong>${escv(active.number)}</strong></div><div><label>Case Type</label><strong>${escv(active.type)}</strong></div><div><label>Category</label><strong>${escv(active.civilCategory||active.criminalCategory||"—")}</strong></div><div><label>Status</label><strong>${escv(active.status)}</strong></div><div><label>Next Hearing</label><strong>${active.next?fmtDate(active.next):"—"}</strong></div><div><label>Hearing Time</label><strong>${escv(displayCaseHearingTime)}</strong></div></div>`)}
      ${section("Hearings",btn("Open Hearings","navigate('hearings')"),hearings.length?`<div class="c360-table-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>Case / Stage</th><th>Court</th></tr></thead><tbody>${hearings.map(h=>`<tr><td>${fmtDate(h.date)}</td><td>${escv(hearingTimeDisplayValue(h.time)||"Time not set")}</td><td>${escv(h.stage||h.purpose||"Hearing")}</td><td>${escv(h.court||active.court||"—")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No hearings connected to this case.</div>`)}
      ${section("Discussion History",btn("Open Discussions","navigate('client-management')"),discussions.length?`<div class="c360-table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Subject</th><th>Details</th></tr></thead><tbody>${discussions.map(d=>`<tr><td>${fmtDate(d.date)}</td><td>${escv(d.client||parties[0]?.name||"—")}</td><td><strong>${escv(d.subject||"Discussion")}</strong></td><td>${escv(d.details||d.discussion||d.description||d.note||"—")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No discussion history connected to this case.</div>`)}
      ${section("Client Meetings",btn("Open Meetings","navigate('client-management')"),meetings.length?`<div class="c360-table-wrap"><table><thead><tr><th>Client</th><th>Date / Time</th><th>Meeting</th><th>Mode</th><th>Details</th></tr></thead><tbody>${meetings.map(m=>`<tr><td>${escv(parties.find(p=>p.id===m.clientId)?.name||m.client||parties[0]?.name||"—")}</td><td>${fmtDate(m.date)}<br>${escv(m.time||"")}</td><td><strong>${escv(m.subject||"Client Meeting")}</strong></td><td>${escv(m.mode||"Office Meeting")}</td><td>${escv(m.details||m.description||"—")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No client meetings connected to this case.</div>`)}
      ${section("Tasks",btn("Open Tasks","navigate('tasks')"),tasks.length?`<div class="c360-table-wrap"><table><thead><tr><th>Task</th><th>Due Date</th><th>Priority</th><th>Status</th></tr></thead><tbody>${tasks.map(t=>`<tr><td>${escv(t.title||"Task")}</td><td>${fmtDate(t.due||t.dueDate)}</td><td>${escv(t.priority||"Medium")}</td><td>${escv(t.status||"Pending")}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No tasks connected to this case.</div>`)}
      ${section("Finance",btn("Open Finance","navigate('finance')"),`<div class="c360-finance"><div><span>Total Invoiced</span><strong>${money(fees)}</strong></div><div><span>Collected</span><strong>${money(invoiceReceived)}</strong></div><div><span>Outstanding</span><strong>${money(balance)}</strong></div><div><span>Expenses</span><strong>${money(expenses)}</strong></div></div>${invoices.length?`<div class="c360-table-wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Client</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead><tbody>${invoices.map(inv=>`<tr><td><strong>${escv(inv.id||"Invoice")}</strong></td><td>${fmtDate(inv.date)}</td><td>${escv(inv.client||parties[0]?.name||"—")}</td><td>${money(inv.amount)}</td><td>${money(inv.paid)}</td><td>${escv(inv.status||"Pending")}</td></tr>`).join("")}</tbody></table></div>`:transactions.length?`<div class="c360-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead><tbody>${transactions.map(t=>`<tr><td>${fmtDate(t.date||t.created)}</td><td>${escv(t.description||t.note||"Transaction")}</td><td>${escv(t.type||t.kind||"—")}</td><td>${money(t.amount)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No invoices or payment history connected to this case.</div>`}`)}
      ${section("Documents",btn("Open Documents","navigate('documents')"),`<div class="empty">Documents for this case can be opened and managed from the Documents module. Case ID: ${escv(active.id)}</div>`)}
    </div>`;
  }
  content.innerHTML=layout("Case 360°","Everything about your case, connected in one place.")+`<div class="panel"><div class="panel-body" style="padding:16px"><div class="toolbar case360-search-toolbar" style="margin:0"><div class="case360-search-wrap"><input class="filter" id="caseDetailsSearch" value="${escv(query)}" autocomplete="off" placeholder="Search case number, client name, phone, title or court..." oninput="caseDetails360LiveSearch(this.value);case360SearchSuggestions(this.value)" onfocus="case360SearchSuggestions(this.value)" onkeydown="if(event.key==='Enter'){caseDetails360Search(this.value)}"><div id="case360SearchSuggestions" class="case360-search-suggestions" style="display:none"></div></div><button class="primary" onclick="caseDetails360Search(document.getElementById('caseDetailsSearch').value)">Search</button></div></div></div><div class="case360-layout"><div id="case360Matches"><h3>Matching Cases (${matches.length})</h3>${matches.map(c=>`<button class="case360-result" data-case-id="${escv(c.id)}"><strong>${escv(c.number||"No case number")}</strong><span>${escv(c.title||"Untitled case")}</span><small>${escv(c.court||"No court")} • ${escv(c.client||"No client")}</small></button>`).join("")||`<div class="empty">No matching cases.</div>`}</div><div>${workspace}</div></div>`;
}
function caseDetails360LiveSearch(value){
  const host=document.getElementById("case360Matches");
  if(!host)return;
  const q=String(value||"").trim().toLowerCase();
  const clients=Array.isArray(state.clients)?state.clients:[];
  const casesList=Array.isArray(state.cases)?state.cases:[];
  const norm=v=>String(v??"").toLowerCase();
  const escv=v=>esc(v==null?"":String(v));
  const linked=c=>{const ids=Array.isArray(c.clientIds)?c.clientIds:(c.clientId?[c.clientId]:[]);return clients.filter(x=>ids.includes(x.id)||x.name===c.client||((c.clients||[]).includes(x.name)));};
  const matches=casesList.filter(c=>!q||[c.number,c.title,c.court,c.type,c.status,c.client,c.cnr,...(Array.isArray(c.clients)?c.clients:[])].some(v=>norm(v).includes(q))||linked(c).some(x=>[x.name,x.phone,x.email,x.id,x.role].some(v=>norm(v).includes(q))));
  host.innerHTML=`<h3>Matching Cases (${matches.length})</h3>`+(matches.map(c=>`<button class="case360-result" data-case-id="${escv(c.id)}"><strong>${escv(c.number||"No case number")}</strong><span>${escv(c.title||"Untitled case")}</span><small>${escv(c.court||"No court")} • ${escv(c.client||"No client")}</small></button>`).join("")||`<div class="empty">No matching cases.</div>`);
}

document.addEventListener("click",function(e){const card=e.target.closest&&e.target.closest(".case360-result");if(!card)return;const input=document.getElementById("caseDetailsSearch");caseDetails360Enhanced(input?input.value:"",card.getAttribute("data-case-id")||"");});

function case360SearchSuggestions(value){
  const popup=document.getElementById("case360SearchSuggestions");
  if(!popup)return;
  const q=String(value||"").trim().toLowerCase();
  if(!q){popup.innerHTML="";popup.style.display="none";return;}
  const clients=Array.isArray(state.clients)?state.clients:[];
  const casesList=Array.isArray(state.cases)?state.cases:[];
  const norm=v=>String(v??"").toLowerCase();
  const linked=c=>{const ids=Array.isArray(c.clientIds)?c.clientIds:(c.clientId?[c.clientId]:[]);return clients.filter(x=>ids.includes(x.id)||x.name===c.client||((c.clients||[]).includes(x.name)));};
  const matches=casesList.filter(c=>[c.number,c.title,c.court,c.type,c.status,c.client,c.cnr,...(Array.isArray(c.clients)?c.clients:[])].some(v=>norm(v).includes(q))||linked(c).some(x=>[x.name,x.phone,x.email,x.id,x.role].some(v=>norm(v).includes(q)))).slice(0,8);
  popup.innerHTML=matches.length?matches.map(c=>{
    const party=linked(c)[0];
    const secondary=[c.title,c.court,party&&party.name].filter(Boolean).join(" • ");
    return "<button type=\"button\" class=\"case360-suggestion\" data-case-id=\""+esc(c.id||"")+"\"><strong>"+esc(c.number||"No case number")+"</strong><span>"+esc(secondary||"Case")+"</span></button>";
  }).join(""):"<div class=\"case360-suggestion-empty\">No matching case found.</div>";
  popup.style.display="block";
  popup.querySelectorAll("[data-case-id]").forEach(btn=>btn.onclick=()=>selectCase360Suggestion(btn.dataset.caseId));
}
function selectCase360Suggestion(id){
  const c=(Array.isArray(state.cases)?state.cases:[]).find(x=>x.id===id);
  if(!c)return;
  const input=document.getElementById("caseDetailsSearch");
  if(input)input.value=c.number||c.title||"";
  const popup=document.getElementById("case360SearchSuggestions");
  if(popup){popup.innerHTML="";popup.style.display="none";}
  caseDetails360Enhanced("",id);
}
function caseDetails360Search(value){caseDetails360Enhanced(String(value||document.getElementById("caseDetailsSearch")?.value||""));}

if(typeof pages!=="undefined") pages["case-details"]=caseDetails360Enhanced;
window.caseDetails=caseDetails360Enhanced;

// Restore the current route only after the enhanced Case 360 page has been
// registered, so refresh and in-app navigation use the exact same renderer.
/* Route restoration is triggered once, from app.html after every module has loaded. */


// Case 360 print/save actions
window.printCase360=function(){
  const node=document.querySelector(".c360-workspace");
  if(!node){alert("Please select a case first.");return;}
  const popup=window.open("","_blank","width=1100,height=800");
  if(!popup){alert("Please allow pop-ups to print Case 360.");return;}
  popup.document.write("<!doctype html><html><head><title>Case 360</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}button{display:none!important}.c360-workspace{max-width:1100px;margin:auto}.c360-hero{background:#173b8f;color:#fff;padding:24px;border-radius:12px}.c360-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.c360-summary>div,.c360-section,.c360-card{border:1px solid #dbe2ef;border-radius:10px;padding:14px}.c360-table-wrap{overflow:visible}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dbe2ef;padding:8px;text-align:left}h3{margin-top:22px}@media print{body{padding:0}.c360-summary{grid-template-columns:repeat(4,1fr)}} </style></head><body>"+node.outerHTML+"</body></html>");
  popup.document.close();
  popup.focus();
  setTimeout(()=>popup.print(),300);
};
window.saveCase360=function(){
  const node=document.querySelector(".c360-workspace");
  if(!node){alert("Please select a case first.");return;}
  const number=(window.case360ActiveCaseId||"case").toString().replace(/[^a-z0-9_-]/gi,"_");
  const html="<!doctype html><html><head><meta charset=\"utf-8\"><title>Case 360</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#172033}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dbe2ef;padding:8px;text-align:left}.c360-hero{background:#173b8f;color:#fff;padding:20px;border-radius:12px}.c360-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.c360-summary>div{border:1px solid #dbe2ef;padding:12px;border-radius:10px}button{display:none!important}</style></head><body>"+node.outerHTML+"</body></html>";
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="Case-360-"+number+".html";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};