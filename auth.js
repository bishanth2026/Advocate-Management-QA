(function(){
  "use strict";
  var SUPABASE_URL="https://ykxfidrtvmkmmbxameji.supabase.co";
  var SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreGZpZHJ0dm1rbW1ieGFtZWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODIwMjUsImV4cCI6MjEwNjQ1ODAyNX0.9m6LYk1i2i_B5iwNbjX5iYCHrGrnXFf-O7pFMWVDVDk";
  var client=null;
  function getClient(){
    if(client)return client;
    if(!window.supabase||!window.supabase.createClient)throw new Error("Secure sign-in service did not load. Refresh and try again.");
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  }
  function cache(profile,member,workspace){
    var role=profile.platform_role==="super_admin"?"super_admin":member.role;
    var a={role:role,workspaceRole:member.role,name:profile.full_name||profile.email,email:profile.email,workspaceId:workspace.id,workspaceName:workspace.name,cloudAuth:true,loginAt:new Date().toISOString()};
    localStorage.setItem("advocateDeskAuth",JSON.stringify(a));return a;
  }
  async function resolveAccess(user,portal){
    var c=getClient();
    var p=await c.from("profiles").select("user_id,full_name,email,platform_role").eq("user_id",user.id).maybeSingle();
    if(p.error)throw p.error;
    if(!p.data)throw new Error("Your AdvocateDesk profile is not ready. Contact the workspace administrator.");
    if(portal==="super_admin"){
      if(p.data.platform_role!=="super_admin")throw new Error("This account is not authorized for the Super Admin portal.");
    }
    var m=await c.from("workspace_members").select("workspace_id,role,workspaces(id,name,status)").eq("user_id",user.id);
    if(m.error)throw m.error;
    var members=m.data||[];
    if(portal==="admin")members=members.filter(function(x){return x.role==="admin"&&x.workspaces&&x.workspaces.status==="active"});
    else members=members.filter(function(x){return x.workspaces&&x.workspaces.status==="active"});
    if(!members.length)throw new Error(portal==="admin"?"No active Admin workspace is assigned to this account.":"No active workspace is assigned to this account.");
    // Resolve the workspace strictly from the authenticated user's active memberships.
    // Never hardcode a workspace ID in production authentication logic.
    var chosen=members[0];
    return cache(p.data,chosen,chosen.workspaces);
  }
  window.ADAuth={
    get:function(){try{return JSON.parse(localStorage.getItem("advocateDeskAuth")||"null")}catch(e){return null}},
    set:function(role,name,email,workspaceId){var a={role:role,name:name,email:email,workspaceId:workspaceId||"",loginAt:new Date().toISOString()};localStorage.setItem("advocateDeskAuth",JSON.stringify(a));return a;},
    client:getClient,
    resetPassword:async function(email){
      var address=String(email||"").trim();
      if(!address)throw new Error("Enter your account email address first.");
      var redirectTo=new URL("reset-password.html",window.location.href).href;
      var r=await getClient().auth.resetPasswordForEmail(address,{redirectTo:redirectTo});
      if(r.error)throw r.error;
      return true;
    },
    signIn:async function(email,password,portal){
      var c=getClient(),r=await c.auth.signInWithPassword({email:String(email||"").trim(),password:String(password||"")});
      if(r.error)throw r.error;
      try{return await resolveAccess(r.data.user,portal)}catch(e){await c.auth.signOut();throw e;}
    },
    validateAppSession:async function(){
      var c=getClient(),s=await c.auth.getSession();
      if(s.error)throw s.error;
      if(!s.data.session||!s.data.session.user)return null;
      var old=this.get(),portal=old&&old.role==="super_admin"?"super_admin":"admin";
      try{return await resolveAccess(s.data.session.user,portal)}catch(e){await c.auth.signOut();return null;}
    },
    logout:async function(){try{await getClient().auth.signOut()}catch(e){}localStorage.removeItem("advocateDeskAuth");window.location.replace("login.html");},
    require:function(){var a=this.get();if(!a||!a.cloudAuth){window.location.replace("login.html");return null}return a;}
  };
})();